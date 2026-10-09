"""Adapter behavior tests using synthetic, disposable registries."""
from copy import deepcopy
import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from registry_adapters import build_registry_update, load_registry, normalized_entries


class RegistryAdapterTests(unittest.TestCase):
    def setUp(self):
        # Keep test mutations under the caller's workspace; OS temp directories
        # can be unreadable/unwritable in managed Windows sandbox sessions.
        self.workspace = tempfile.TemporaryDirectory(prefix=".visual-assets-test-", dir=Path.cwd())
        self.addCleanup(self.workspace.cleanup)
        self.root = Path(self.workspace.name)
        self.config = {"key": "test", "adapter": "generic", "file": "registry.json"}
        self.profile = {"registries": [self.config], "assets": {"night-light": {"registry": "test"}}}
        self.prepared = {"assetId": "night-light", "candidate": 2, "checks": []}
        self.review = {"cropProfiles": {"small": {"focalNormalized": [0.5, 0.4]}}}
        self.approval = {"path": "approvals/night-light-v1.json", "sha256": "a" * 64, "ownerStatement": "Approved."}
        self.files = [
            {"path": "assets/night-light-v1.png", "sha256": "b" * 64, "role": "source", "width": 20, "height": 10},
            {"path": "assets/night-light-v1.webp", "sha256": "c" * 64, "role": "runtime", "sourceRectPx": [0, 0, 20, 10]},
            {"path": "native/night-light-v1.webp", "sha256": "c" * 64, "role": "native"},
        ]

    def save(self, document):
        (self.root / "registry.json").write_text(json.dumps(document), encoding="utf-8")

    def build(self, version=1):
        return build_registry_update(self.root, self.profile, "night-light", version,
                                     self.prepared, self.review, self.approval, self.files)

    def test_generic_missing_and_nonmutating_update(self):
        self.assertEqual(load_registry(self.root, self.config), {"schemaVersion": 1, "assets": []})
        original = deepcopy((self.profile, self.prepared, self.review, self.approval, self.files))
        filename, document = self.build()
        self.assertEqual(filename, self.root / "registry.json")
        self.assertFalse(filename.exists())
        self.assertEqual(document["assets"][0]["version"], 1)
        self.assertEqual(original, (self.profile, self.prepared, self.review, self.approval, self.files))

    def test_history_and_unrelated_data_preserved(self):
        _, first = self.build()
        first["metadata"] = {"doNotChange": True}
        first["assets"].append({"assetId": "draft", "notes": "Not approved"})
        first["assets"][0]["unrelated"] = "remain"
        self.save(first)
        original_bytes = (self.root / "registry.json").read_bytes()
        _, second = self.build(2)
        self.assertEqual((self.root / "registry.json").read_bytes(), original_bytes)
        self.assertEqual(second["metadata"], first["metadata"])
        self.assertEqual(second["assets"][1], first["assets"][1])
        self.assertEqual(second["assets"][0]["history"][0]["approval"], first["assets"][0]["approval"])
        self.save(second)
        entries = normalized_entries(self.root, self.profile)
        self.assertEqual([(value["version"], value["historical"]) for value in entries], [(2, False), (1, True)])

    def test_version_and_approval_guards(self):
        with self.assertRaisesRegex(ValueError, "advance by one"):
            self.build(3)
        self.prepared["assetId"] = "another-asset"
        with self.assertRaisesRegex(ValueError, "does not match"):
            self.build()
        self.prepared["assetId"] = "night-light"
        self.files.append(deepcopy(self.files[0]))
        with self.assertRaisesRegex(ValueError, "exactly one preserved source"):
            self.build()

    def test_path_escape_rejected_for_registry_and_resources(self):
        self.config["file"] = "../registry.json"
        with self.assertRaisesRegex(ValueError, "escapes"):
            self.build()
        self.config["file"] = "registry.json"
        self.files[0]["path"] = "../outside.png"
        with self.assertRaisesRegex(ValueError, "escapes"):
            self.build()

    def test_established_scenery_and_histories(self):
        self.config["adapter"] = "remilo-scenes"
        with self.assertRaisesRegex(ValueError, "missing"):
            load_registry(self.root, self.config)
        original = {"schemaVersion": 1, "masterContract": {"width": 30, "height": 20}, "scenes": [{
            "id": "night-light", "reference": {"path": "reference.png", "sha256": "d" * 64},
            "approval": self.approval, "approvedMaster": self.files[0],
            "runtimeExport": self.files[1], "nativeExport": self.files[2],
            "cropPolicy": {"sourceProfiles": {"old": {}}},
            "masterResolutionRequirementMet": False}]}
        self.save(original)
        _, document = self.build(2)
        entry = document["scenes"][0]
        self.assertEqual(entry["reference"], original["scenes"][0]["reference"])
        self.assertEqual(entry["approvedVersionHistory"][0]["cropPolicy"], original["scenes"][0]["cropPolicy"])
        self.assertFalse(entry["masterResolutionRequirementMet"])
        self.save(document)
        normalized = normalized_entries(self.root, self.profile)
        self.assertEqual(len(normalized), 2)
        self.assertTrue(normalized[0]["technicalLimitations"])
        self.assertEqual(normalized[0]["files"][1]["sourceRectPx"], [0, 0, 20, 10])

    def test_brand_shared_source_and_explicit_source_update(self):
        self.config["adapter"] = "remilo-brand"
        original = {"schemaVersion": 1, "source": self.files[0], "noGenerativeRedraw": True,
                    "exports": [{"id": "night-light", "approval": self.approval,
                                 "productionFiles": [self.files[1]], "requiredOutputs": {"size": 10}}]}
        self.save(original)
        normalized = normalized_entries(self.root, self.profile)
        self.assertEqual(normalized[0]["source"]["sha256"], self.files[0]["sha256"])
        _, second = self.build(2)
        self.assertTrue(second["noGenerativeRedraw"])
        self.assertEqual(second["source"], original["source"])
        self.assertEqual(second["exports"][0]["requiredOutputs"], {"size": 10})
        self.assertEqual(len(second["exports"][0]["productionFiles"]), 2)
        self.assertEqual(second["exports"][0]["approvedVersionHistory"][0]["approvedSource"], original["source"])
        second["source"] = {"path": "new-shared-source.png", "sha256": "e" * 64}
        self.save(second)
        history = [value for value in normalized_entries(self.root, self.profile) if value["historical"]][0]
        self.assertEqual(history["source"]["sha256"], original["source"]["sha256"])

    def test_historical_snapshot_is_read_only(self):
        _, document = self.build()
        self.save(document)
        self.config["historical"] = True
        self.assertTrue(normalized_entries(self.root, self.profile)[0]["historical"])
        with self.assertRaisesRegex(ValueError, "read-only"):
            self.build(2)


if __name__ == "__main__":
    unittest.main()

"""Behavior checks for deterministic asset helpers; all approvals are test data."""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest import mock

from PIL import Image

SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPTS))
import asset_common as common


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def pattern(size=(40, 24), mode="RGB") -> Image.Image:
    image = Image.new(mode, size)
    pixels = []
    for y in range(size[1]):
        for x in range(size[0]):
            color = ((x * 31 + y * 7) % 256, (x * 3 + y * 17) % 256,
                     (x * 13 + y * 29) % 256)
            pixels.append(color + ((128 if x < size[0] // 2 else 255),)
                          if mode == "RGBA" else color)
    image.putdata(pixels)
    return image


class FixtureCase(unittest.TestCase):
    def setUp(self):
        # Managed Windows sessions can deny files in the process's OS temp root.
        self.temp_parent = Path(os.environ.get("VISUAL_ASSET_TEST_TMP", Path.cwd()))
        self.temp = tempfile.TemporaryDirectory(prefix=".asset-workflow-tests-", dir=self.temp_parent)
        self.root = Path(self.temp.name)

    def tearDown(self):
        self.temp.cleanup()

    def source(self, name="input.png", size=(40, 24), mode="RGB"):
        path = self.root / name
        pattern(size, mode).save(path)
        return path


class GeometryTests(unittest.TestCase):
    def test_cover_crops_wide_and_portrait_sources(self):
        self.assertEqual(tuple(common.crop_box((400, 200), (100, 100))),
                         (100, 0, 300, 200))
        self.assertEqual(tuple(common.crop_box((200, 400), (400, 200))),
                         (0, 150, 200, 250))

    def test_cover_focal_extremes_clamp_within_source(self):
        self.assertEqual(tuple(common.crop_box((400, 200), (100, 100), (0, 0))),
                         (0, 0, 200, 200))
        self.assertEqual(tuple(common.crop_box((400, 200), (100, 100), (1, 1))),
                         (200, 0, 400, 200))
        for focal in ((-0.01, .5), (.5, 1.01), (float("nan"), .5)):
            with self.subTest(focal=focal), self.assertRaises(ValueError):
                common.crop_box((400, 200), (100, 100), focal)

    def test_invalid_dimensions_fail_clearly(self):
        for source, viewport in (((0, 200), (100, 100)),
                                 ((200, 200), (0, 100)),
                                 ((200, -1), (100, 100))):
            with self.subTest(source=source, viewport=viewport):
                with self.assertRaises(ValueError):
                    common.crop_box(source, viewport)

    def test_combined_landmarks_can_be_mathematically_impossible(self):
        landmarks = [{"name": "left", "bounds": [.05, .4, .15, .6]},
                     {"name": "right", "bounds": [.85, .4, .95, .6]}]
        result = common.crop_feasibility((400, 200), (100, 100), landmarks, (.5, .5))
        self.assertFalse(result["feasible"])
        self.assertFalse(result["currentContainsAll"])

    def test_feasible_landmark_can_require_another_focal_point(self):
        landmarks = [{"name": "cue", "bounds": [.8, .4, .9, .6]}]
        result = common.crop_feasibility((400, 200), (100, 100), landmarks, (0, .5))
        self.assertTrue(result["feasible"])
        self.assertFalse(result["currentContainsAll"])
        adjusted = common.crop_feasibility((400, 200), (100, 100), landmarks, (1, .5))
        self.assertTrue(adjusted["currentContainsAll"])

    def test_focal_transformation_accounts_for_trim(self):
        focal = common.transform_focal((.5, .5), (100, 80), (10, 20, 90, 70))
        self.assertAlmostEqual(focal[0], .5)
        self.assertAlmostEqual(focal[1], .4)


class ImageTests(FixtureCase):
    def test_original_metadata_precedes_conversion(self):
        path = self.source(mode="RGBA")
        measured = common.inspect_image(path)
        self.assertEqual(measured["size"], [40, 24])
        self.assertEqual(measured["mode"], "RGBA")
        self.assertEqual(measured["format"], "PNG")
        self.assertEqual(measured["alphaExtrema"], [128, 255])
        self.assertTrue(measured["hasAlpha"])
        self.assertFalse(measured["opaque"])
        self.assertFalse(measured["iccPresent"])
        self.assertEqual(measured["sha256"], digest(path))

    def test_untagged_source_requires_declared_color_interpretation(self):
        source = self.source()
        facts = common.inspect_image(source)
        self.assertIsNone(facts["iccDescription"])
        plain = common.conformance(facts, {"colorSpace": "srgb"})
        explicit = common.conformance(facts, {"colorSpace": "srgb", "allowAssumedSrgb": True})
        self.assertEqual(next(c for c in plain if c["id"] == "master-color")["status"], "fail")
        self.assertEqual(next(c for c in explicit if c["id"] == "master-color")["status"], "pass")
        self.assertFalse(facts["iccPresent"])

    def test_corrupt_icc_profile_is_not_claimed_as_srgb(self):
        source = self.root / "corrupt-profile.png"
        pattern().save(source, icc_profile=b"not a valid ICC profile")
        facts = common.inspect_image(source)
        self.assertTrue(facts["iccPresent"])
        self.assertFalse(facts["iccValid"])
        checks = common.conformance(facts, {"colorSpace": "srgb", "allowAssumedSrgb": True})
        self.assertEqual(next(c for c in checks if c["id"] == "master-color")["status"], "fail")
        with self.assertRaises(ValueError):
            common.render_export(source, {"size": [20, 12], "fit": "cover"})

    def test_exif_orientation_is_reported_without_source_rewrite(self):
        path = self.root / "oriented.png"
        exif = Image.Exif()
        exif[274] = 6
        pattern((40, 24)).save(path, exif=exif)
        before = path.read_bytes()
        measured = common.inspect_image(path)
        self.assertEqual(measured["size"], [40, 24])
        self.assertEqual(measured["displaySize"], [24, 40])
        self.assertEqual(measured["exifOrientation"], 6)
        self.assertEqual(path.read_bytes(), before)

    def test_rgb_difference_with_unchanged_alpha_is_detected(self):
        left = Image.new("RGBA", (3, 3), (10, 20, 30, 255))
        right = left.copy()
        right.putpixel((1, 1), (11, 20, 30, 255))
        self.assertFalse(common.pixels_equal(left, right))
        self.assertTrue(common.pixels_equal(left, left.copy()))
        right = left.copy()
        right.putpixel((1, 1), (10, 20, 30, 254))
        self.assertFalse(common.pixels_equal(left, right))

    def test_webp_lossless_roundtrip_preserves_every_channel(self):
        path = self.root / "lossless.webp"
        image = pattern(mode="RGBA")
        common.encode_image(image, path, "WEBP", lossless=True)
        with Image.open(path) as decoded:
            self.assertTrue(common.pixels_equal(image, decoded))
        native = self.root / "native.webp"
        shutil.copyfile(path, native)
        self.assertEqual(digest(path), digest(native))

    def test_hidden_color_in_zero_alpha_pixels_is_preserved(self):
        image = Image.new("RGBA", (4, 4), (123, 45, 67, 0))
        image.putpixel((2, 2), (11, 22, 33, 255))
        path = self.root / "transparent.webp"
        common.encode_image(image, path, "WEBP", lossless=True)
        with Image.open(path) as decoded:
            self.assertTrue(common.pixels_equal(image, decoded))

    def test_existing_export_cannot_be_overwritten(self):
        path = self.root / "existing.png"
        common.encode_image(pattern(), path, "PNG")
        original = path.read_bytes()
        with self.assertRaises(ValueError):
            common.encode_image(Image.new("RGB", (10, 10), "red"), path, "PNG")
        self.assertEqual(path.read_bytes(), original)

    def test_contain_preserves_aspect_and_transparency(self):
        source = self.source(size=(40, 20), mode="RGBA")
        rendered, transform = common.render_export(source, {
            "size": [20, 20], "fit": "contain", "format": "PNG"})
        self.assertEqual(rendered.size, (20, 20))
        self.assertEqual(transform["contentRectPx"], [0, 5, 20, 15])
        self.assertEqual(rendered.getpixel((10, 0))[3], 0)
        self.assertEqual(rendered.getpixel((10, 19))[3], 0)
        with Image.open(source) as original:
            expected = original.resize((20, 10), Image.Resampling.LANCZOS)
        self.assertTrue(common.pixels_equal(rendered.crop((0, 5, 20, 15)), expected))

    def test_orientation_is_applied_to_export(self):
        path = self.root / "oriented.png"
        exif = Image.Exif()
        exif[274] = 6
        original = pattern((40, 24))
        original.save(path, exif=exif)
        before = path.read_bytes()
        rendered, transform = common.render_export(path, {
            "size": [12, 20], "fit": "cover", "format": "PNG"})
        expected = original.transpose(Image.Transpose.ROTATE_270).resize((12, 20), Image.Resampling.LANCZOS)
        self.assertTrue(common.pixels_equal(rendered, expected))
        self.assertEqual(transform["sourceDisplaySize"], [24, 40])
        self.assertEqual(path.read_bytes(), before)

    def test_circle_mask_does_not_replace_source_alpha(self):
        source = self.root / "semi.png"
        Image.new("RGBA", (40, 40), (12, 23, 34, 90)).save(source)
        rendered, transform = common.render_export(source, {
            "size": [20, 20], "fit": "cover", "format": "PNG", "mask": "circle"})
        alpha = rendered.getchannel("A")
        self.assertEqual(alpha.getextrema(), (0, 90))
        self.assertEqual(alpha.getpixel((10, 10)), 90)

    def test_render_export_refuses_unpermitted_upscale(self):
        source = self.source(size=(20, 10))
        spec = {"size": [40, 20], "fit": "cover", "format": "PNG"}
        with self.assertRaises(ValueError):
            common.render_export(source, spec)
        enlarged, transform = common.render_export(source, dict(spec, allowUpscale=True))
        self.assertEqual(enlarged.size, (40, 20))
        self.assertIsInstance(transform, dict)

    def test_cover_export_is_crop_then_downsample_and_keeps_alpha(self):
        source = self.source(size=(40, 20), mode="RGBA")
        before = digest(source)
        rendered, transform = common.render_export(source, {
            "size": [10, 10], "fit": "cover", "format": "PNG", "focal": [.5, .5]})
        with Image.open(source) as original:
            expected = original.crop((10, 0, 30, 20)).resize((10, 10), Image.Resampling.LANCZOS)
        self.assertTrue(common.pixels_equal(rendered, expected))
        self.assertEqual(rendered.mode, "RGBA")
        self.assertEqual(digest(source), before)


class PathTests(FixtureCase):
    def test_failed_new_json_publication_does_not_leave_partial_record(self):
        from unittest.mock import patch
        path = self.root / "decision.json"
        operation = "asset_common.os.rename" if os.name == "nt" else "asset_common.os.link"
        with patch(operation, side_effect=OSError("Synthetic interrupted publication")):
            with self.assertRaises(OSError):
                common.atomic_json(path, {"fixture": True})
        self.assertFalse(path.exists())
        common.atomic_json(path, {"fixture": True})
        original = path.read_bytes()
        with self.assertRaises(FileExistsError):
            common.atomic_json(path, {"fixture": False})
        self.assertEqual(path.read_bytes(), original)

    def test_normal_path_resolves_inside_project(self):
        result = common.confined(self.root, "assets/icon.png")
        self.assertEqual(Path(result), self.root / "assets" / "icon.png")

    def test_parent_escape_and_absolute_escape_are_rejected(self):
        for path in ("../escape.png", str(self.root.parent / "escape.png")):
            with self.subTest(path=path), self.assertRaises(ValueError):
                common.confined(self.root, path)

    def test_allowed_output_roots_restrict_other_project_paths(self):
        allowed = ["assets"]
        self.assertEqual(Path(common.confined(self.root, "assets/icon.png", allowed)),
                         self.root / "assets" / "icon.png")
        with self.assertRaises(ValueError):
            common.confined(self.root, "private/icon.png", allowed)

    def test_symlink_cannot_redirect_output_outside_project(self):
        with tempfile.TemporaryDirectory(prefix=".asset-outside-", dir=self.temp_parent) as outside:
            link = self.root / "linked"
            try:
                link.symlink_to(outside, target_is_directory=True)
            except (OSError, NotImplementedError) as error:
                # Windows junctions exercise resolved-path protection without
                # requiring the directory-symlink privilege.
                shell = shutil.which("powershell.exe") if os.name == "nt" else None
                if not shell:
                    self.skipTest(f"Host does not permit directory links: {error}")
                environment = dict(os.environ)
                environment["VISUAL_ASSET_TEST_LINK"] = str(link)
                environment["VISUAL_ASSET_TEST_TARGET"] = outside
                made = subprocess.run([
                    shell, "-NoProfile", "-NonInteractive", "-Command",
                    "New-Item -ItemType Junction -Path $env:VISUAL_ASSET_TEST_LINK "
                    "-Target $env:VISUAL_ASSET_TEST_TARGET -ErrorAction Stop | Out-Null"
                ], env=environment, capture_output=True, text=True)
                if made.returncode:
                    self.skipTest(f"Host also denied a directory junction: {made.stderr}")
                self.assertEqual(link.resolve(), Path(outside).resolve())
            try:
                with self.assertRaises(ValueError):
                    common.confined(self.root, "linked/icon.png")
            finally:
                if link.is_symlink():
                    link.unlink()
                else:
                    link.rmdir()  # Remove only the junction, never its target.


class WorkflowTests(FixtureCase):
    """CLI and promotion tests never consume a real owner's approval."""

    def setUp(self):
        super().setUp()
        self.input = self.source()
        self.reference = self.source("reference.png", size=(32, 20))
        self.prompt = self.root / "brief.txt"
        self.prompt.write_text("Synthetic test pixels; deterministic test fixture only.", encoding="utf-8")
        self.references = self.write_json("references.json", [{
            "file": "reference.png", "role": "style",
            "influence": "Synthetic fixture colors", "inspected": True}])
        self.profile = {
            "schemaVersion": 1, "localRoot": "local", "metadataRoot": "metadata",
            "allowedOutputRoots": ["local", "metadata", "assets", "native"],
            "registries": [{"key": "test", "adapter": "generic", "file": "metadata/registry.json"}],
            "assets": {"scene": {
                "route": "faithful-export", "registry": "test",
                "master": {"destination": "assets/scene-v{version}.png", "minimumSize": [32, 20],
                           "format": "PNG", "alpha": "opaque", "allowAssumedSrgb": True},
                "exports": [{"role": "runtime", "destination": "assets/scene-v{version}.webp",
                             "size": [20, 12], "format": "WEBP", "fit": "cover", "focal": [.5, .5],
                             "lossless": True, "allowUpscale": False,
                             "copies": [{"role": "native", "destination": "native/scene-v{version}.webp"}]}],
                "views": [{"name": "broad", "size": [32, 18], "unit": "px", "fit": "cover",
                           "focal": [.5, .5], "overlayHeight": 5, "landmarks": []}]
            }}
        }
        self.profile_file = self.write_json("profile.json", self.profile)
        self.inspection = self.write_json("inspection.json", {
            "reviewer": "Synthetic fixture observer; not a real production approval",
            "recordedAtUtc": "2026-10-09T00:00:00Z",
            "checks": [{"name": key, "status": "pass", "observation": "Synthetic fixture test observation"}
                       for key in ("identity", "style", "interface-remnants", "edges", "crop-cues")]
        })

    def write_json(self, name, value):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(value, indent=2), encoding="utf-8")
        return path

    def cli(self, command, *args, expected=0):
        proc = subprocess.run([sys.executable, str(SCRIPTS / "asset_workflow.py"), command,
                               "--project-root", str(self.root), "--profile", str(self.profile_file),
                               *map(str, args)], capture_output=True, text=True, cwd=self.root)
        self.assertEqual(proc.returncode, expected, proc.stdout + proc.stderr)
        try:
            return json.loads(proc.stdout)
        except json.JSONDecodeError as error:
            self.fail(f"CLI returned non-JSON output: {proc.stdout!r}; stderr={proc.stderr!r}; {error}")

    def path(self, value):
        value = Path(value)
        return value if value.is_absolute() else self.root / value

    def snapshot(self):
        return {file.relative_to(self.root).as_posix(): digest(file)
                for file in self.root.rglob("*") if file.is_file()}

    def prepare(self, candidate=1, source=None):
        result = self.cli("prepare", "--asset", "scene", "--candidate", candidate,
                          "--source", source or self.input, "--prompt", self.prompt,
                          "--references", self.references, "--generator", "deterministic-export")
        return self.path(result["record"])

    def review(self, record, revision=1, inspected=True, views=None):
        args = ["--record", record, "--revision", revision]
        if inspected:
            args += ["--inspection", self.inspection]
        if views is not None:
            args += ["--views", self.write_json(f"views-{revision}.json", views)]
        result = self.cli("review", *args)
        return self.path(result["record"]), self.path(result["preview"])

    def approval(self, review, preview, candidate=1, source=None, name="approval.json"):
        return self.write_json(name, {
            "ownerStatement": "Fixture owner approves this isolated test candidate and activation.",
            "recordedAtUtc": "2026-10-09T00:01:00Z", "assetId": "scene", "candidate": candidate,
            "candidateSha256": digest(source or self.input), "reviewSha256": digest(preview),
            "reviewRecordSha256": digest(review), "scope": {"artwork": True, "activation": True},
            "exceptions": []})

    def promote(self, record, review, approval, version=1, expected=0):
        return self.cli("promote", "--record", record, "--review", review,
                        "--approval", approval, "--version", version, expected=expected)

    def test_inspect_and_audit_are_read_only(self):
        before = self.snapshot()
        self.cli("inspect", "--asset", "scene", "--source", self.input)
        self.cli("audit")
        self.assertEqual(self.snapshot(), before)

    def test_prepare_review_promotion_and_portable_audit(self):
        original = self.input.read_bytes()
        record = self.prepare()
        review, preview = self.review(record)
        approval = self.approval(review, preview)
        self.promote(record, review, approval)
        master = self.root / "assets/scene-v1.png"
        runtime = self.root / "assets/scene-v1.webp"
        native = self.root / "native/scene-v1.webp"
        self.assertEqual(master.read_bytes(), original)
        self.assertEqual(runtime.read_bytes(), native.read_bytes())
        expected, _ = common.render_export(self.input, self.profile["assets"]["scene"]["exports"][0])
        with Image.open(runtime) as decoded:
            self.assertTrue(common.pixels_equal(expected, decoded))
        before = self.snapshot()
        self.cli("audit")
        self.assertEqual(self.snapshot(), before)
        shutil.rmtree(self.root / "local")
        self.cli("audit")
        self.cli("audit", "--local-provenance", expected=1)

    def test_crop_only_review_revision_preserves_candidate_and_old_review(self):
        before_source = self.input.read_bytes()
        record = self.prepare()
        before_record = record.read_bytes()
        review1, preview1 = self.review(record, inspected=False)
        old_review = review1.read_bytes()
        old_preview = preview1.read_bytes()
        views = [{"name": "compact", "size": [32, 10], "fit": "cover", "focal": [.5, .3]}]
        review2, preview2 = self.review(record, revision=2, views=views)
        self.assertEqual(record.read_bytes(), before_record)
        self.assertEqual(review1.read_bytes(), old_review)
        self.assertEqual(preview1.read_bytes(), old_preview)
        self.assertNotEqual(digest(review1), digest(review2))
        self.assertNotEqual(digest(preview1), digest(preview2))
        self.assertEqual(self.input.read_bytes(), before_source)

    def test_contain_export_maps_focal_and_landmark_through_padding(self):
        export = self.profile["assets"]["scene"]["exports"][0]
        export.update(size=[20, 20], fit="contain")
        self.write_json("profile.json", self.profile)
        record = self.prepare()
        views = [{"name": "square", "size": [20, 20], "fit": "cover", "focal": [.25, .25],
                  "landmarks": [{"name": "cue", "bounds": [.2, .2, .4, .4]}]}]
        review, _ = self.review(record, views=views)
        doc = json.loads(review.read_text())
        mapped = doc["exportProfiles"]["runtime"]["square"]
        self.assertAlmostEqual(mapped["focalNormalized"][0], .25)
        self.assertAlmostEqual(mapped["focalNormalized"][1], .35)
        bounds = mapped["feasibility"]["landmarks"][0]["boundsPx"]
        self.assertAlmostEqual(bounds[1], 6.4)
        self.assertAlmostEqual(bounds[3], 8.8)

    def test_pending_inspection_cannot_activate(self):
        record = self.prepare()
        review, preview = self.review(record, inspected=False)
        approval = self.approval(review, preview)
        self.promote(record, review, approval, expected=2)
        self.assertFalse((self.root / "metadata/registry.json").exists())
        self.assertFalse((self.root / "assets/scene-v1.png").exists())

    def test_presented_supplemental_and_panel_hashes_cannot_change(self):
        extra = self.source("supplemental.png", size=(10, 10))
        inspection = json.loads(self.inspection.read_text())
        inspection["supplementalPreviews"] = [{"localArtifactPath": "supplemental.png", "sha256": digest(extra)}]
        self.write_json("inspection.json", inspection)
        record = self.prepare()
        review, preview = self.review(record)
        approval = self.approval(review, preview)
        original = extra.read_bytes()
        extra.write_bytes(b"changed supplemental preview")
        self.promote(record, review, approval, expected=2)
        extra.write_bytes(original)
        doc = json.loads(review.read_text())
        panel = self.path(doc["previewPanels"][0]["localArtifactPath"])
        panel.write_bytes(b"changed presented panel")
        self.promote(record, review, approval, expected=2)
        self.assertFalse((self.root / "assets/scene-v1.png").exists())

    def test_stale_approval_bindings_and_artwork_only_scope_are_rejected(self):
        record = self.prepare()
        review, preview = self.review(record)
        original = json.loads(self.approval(review, preview).read_text())
        for field, changed in (("candidateSha256", "0" * 64), ("reviewSha256", "0" * 64),
                               ("reviewRecordSha256", "0" * 64), ("candidate", 2),
                               ("scope", {"artwork": True, "activation": False}),
                               ("scope", "Explicitly excludes artwork and activation")):
            approval = self.write_json("bad-approval.json", dict(original, **{field: changed}))
            with self.subTest(field=field):
                self.promote(record, review, approval, expected=2)
                self.assertFalse((self.root / "metadata/registry.json").exists())

    def test_prepare_cannot_write_metadata_or_candidates_outside_allowed_roots(self):
        self.profile["allowedOutputRoots"] = ["assets", "native"]
        self.write_json("profile.json", self.profile)
        self.cli("prepare", "--asset", "scene", "--candidate", 1, "--source", self.input,
                 "--prompt", self.prompt, "--references", self.references,
                 "--generator", "deterministic-export", expected=2)
        self.assertFalse((self.root / "metadata").exists())
        self.assertFalse((self.root / "local").exists())

    def test_explicit_audit_report_stays_in_allowed_output_roots(self):
        self.cli("audit", "--report", "outside-policy/report.json", expected=2)
        self.assertFalse((self.root / "outside-policy/report.json").exists())

    def test_changed_profile_cannot_activate(self):
        record = self.prepare()
        review, preview = self.review(record)
        approval = self.approval(review, preview)
        self.profile["assets"]["scene"]["exports"][0]["size"] = [10, 6]
        self.write_json("profile.json", self.profile)
        self.promote(record, review, approval, expected=2)
        self.assertFalse((self.root / "metadata/registry.json").exists())

    def test_changed_staged_pixels_cannot_activate(self):
        record = self.prepare()
        review, preview = self.review(record)
        approval = self.approval(review, preview)
        evidence = json.loads(record.read_text())
        staged = self.path(evidence["stagedOutputs"][0]["localArtifactPath"])
        with Image.open(staged) as image:
            changed = image.copy()
        changed.putpixel((0, 0), (255, 0, 0))
        changed.save(staged, format="WEBP", lossless=True)
        self.promote(record, review, approval, expected=2)
        self.assertFalse((self.root / "metadata/registry.json").exists())

    def test_undersized_master_requires_named_exception_and_never_upscales(self):
        self.profile["assets"]["scene"]["master"]["minimumSize"] = [64, 40]
        self.write_json("profile.json", self.profile)
        record = self.prepare()
        review, preview = self.review(record)
        approval = self.approval(review, preview)
        self.promote(record, review, approval, expected=2)
        self.assertFalse((self.root / "metadata/registry.json").exists())
        decision = json.loads(approval.read_text())
        decision["exceptions"] = [{"check": "master-size", "ownerStatement":
                                  "Fixture owner explicitly accepts the 40 by 24 source below the 64 by 40 minimum."}]
        approval = self.write_json("approval.json", decision)
        self.promote(record, review, approval)
        with Image.open(self.root / "assets/scene-v1.png") as master:
            self.assertEqual(master.size, (40, 24))
        self.assertEqual((self.root / "assets/scene-v1.png").read_bytes(), self.input.read_bytes())
        approved_record = json.loads((self.root / "metadata/approvals/scene-workflow-v1.json").read_text())
        self.assertEqual(next(c for c in approved_record["checks"] if c["id"] == "master-size")["status"], "fail")
        self.cli("audit")

    def test_impossible_crops_cannot_activate(self):
        self.profile["assets"]["scene"]["views"] = [{
            "name": "portrait", "size": [10, 20], "fit": "cover", "focal": [.5, .5],
            "landmarks": [{"name": "left", "bounds": [.05, .4, .15, .6]},
                          {"name": "right", "bounds": [.85, .4, .95, .6]}]}]
        self.write_json("profile.json", self.profile)
        record = self.prepare()
        review, preview = self.review(record)
        approval = self.approval(review, preview)
        review_data = json.loads(review.read_text())
        self.assertTrue(any(check["status"] == "fail" for check in review_data["checks"]))
        self.promote(record, review, approval, expected=2)
        self.assertFalse((self.root / "metadata/registry.json").exists())

    def test_export_trim_excluding_cue_records_failed_review_evidence(self):
        self.profile["assets"]["scene"]["exports"][0]["size"] = [16, 9]
        self.profile["assets"]["scene"]["views"] = [{
            "name": "wide", "size": [16, 9], "unit": "px", "fit": "cover", "focal": [.5, .5],
            "landmarks": [{"name": "left-edge-cue", "bounds": [.02, .35, .08, .45]}]}]
        self.write_json("profile.json", self.profile)
        record = self.prepare()
        review, preview = self.review(record)
        self.assertTrue(preview.exists())
        evidence = json.loads(review.read_text())
        checks = {check["id"]: check["status"] for check in evidence["checks"]}
        self.assertEqual(checks["crop:source:wide"], "pass")
        self.assertEqual(checks["crop:runtime:wide"], "fail")
        feasibility = evidence["exportProfiles"]["runtime"]["wide"]["feasibility"]
        self.assertFalse(feasibility["feasible"])
        self.assertFalse(feasibility["currentContainsAll"])
        approval = self.approval(review, preview)
        self.promote(record, review, approval, expected=2)
        self.assertFalse((self.root / "metadata/registry.json").exists())

    def test_invalid_or_non_utc_human_timestamp_cannot_activate(self):
        record = self.prepare()
        review, preview = self.review(record)
        approval = self.approval(review, preview)
        original = json.loads(approval.read_text())
        for timestamp in ("not-a-timestamp", "2026-10-09T00:01:00", "2026-10-09T00:01:00-07:00"):
            with self.subTest(timestamp=timestamp):
                changed = dict(original, recordedAtUtc=timestamp)
                approval = self.write_json("approval.json", changed)
                self.promote(record, review, approval, expected=2)
                self.assertFalse((self.root / "metadata/registry.json").exists())
                self.assertFalse((self.root / "assets/scene-v1.png").exists())

    def test_invalid_or_non_utc_inspection_timestamp_cannot_activate(self):
        record = self.prepare()
        inspection = json.loads(self.inspection.read_text())
        for revision, timestamp in enumerate(("not-a-timestamp", "2026-10-09T00:01:00",
                                              "2026-10-09T00:01:00-07:00"), start=1):
            with self.subTest(timestamp=timestamp):
                self.write_json("inspection.json", dict(inspection, recordedAtUtc=timestamp))
                review, preview = self.review(record, revision=revision)
                approval = self.approval(review, preview)
                self.promote(record, review, approval, expected=2)
                self.assertFalse((self.root / "metadata/registry.json").exists())
                self.assertFalse((self.root / "assets/scene-v1.png").exists())

    def test_existing_exclusive_lock_blocks_concurrent_promotion(self):
        record = self.prepare()
        review, preview = self.review(record)
        approval = self.approval(review, preview)
        lock = self.write_json("metadata/transactions/test.lock", {"pid": 12345, "purpose": "synthetic test lock"})
        before = lock.read_bytes()
        self.promote(record, review, approval, expected=2)
        self.assertEqual(lock.read_bytes(), before)
        self.assertFalse((self.root / "metadata/registry.json").exists())

    def test_versions_preserve_previous_files_and_approval(self):
        record1 = self.prepare()
        review1, preview1 = self.review(record1)
        approval1 = self.approval(review1, preview1)
        self.promote(record1, review1, approval1)
        preserved = {file: file.read_bytes() for folder in ("assets", "native", "metadata/approvals")
                     for file in (self.root / folder).rglob("*") if file.is_file()}
        source2 = self.source("second.png")
        with Image.open(source2) as raw:
            second = raw.copy()
        second.putpixel((1, 1), (255, 0, 0))
        second.save(source2)
        record2 = self.prepare(candidate=2, source=source2)
        review2, preview2 = self.review(record2)
        approval2 = self.approval(review2, preview2, candidate=2, source=source2, name="approval2.json")
        self.promote(record2, review2, approval2, version=2)
        for file, previous in preserved.items():
            self.assertEqual(file.read_bytes(), previous, str(file))
        self.assertTrue((self.root / "assets/scene-v2.png").exists())
        self.cli("audit")

    def test_registry_change_after_prepare_is_rejected(self):
        record = self.prepare()
        review, preview = self.review(record)
        approval = self.approval(review, preview)
        self.write_json("metadata/registry.json", {"schemaVersion": 1, "assets": [], "other": "concurrent change"})
        before = (self.root / "metadata/registry.json").read_bytes()
        self.promote(record, review, approval, expected=2)
        self.assertEqual((self.root / "metadata/registry.json").read_bytes(), before)
        self.assertFalse((self.root / "assets/scene-v1.png").exists())

    def test_interrupted_registry_commit_is_recoverable_and_retry_idempotent(self):
        import argparse
        import asset_workflow as workflow
        record = self.prepare()
        review, preview = self.review(record)
        approval = self.approval(review, preview)
        args = argparse.Namespace(record=str(record), review=str(review), approval=str(approval), version=1)
        original_atomic = workflow.atomic_json

        def fail_registry(path, value, *, replace=False):
            if Path(path).name == "registry.json" and replace:
                raise OSError("Synthetic interruption before registry commit")
            return original_atomic(path, value, replace=replace)

        with mock.patch.object(workflow, "atomic_json", side_effect=fail_registry):
            with self.assertRaisesRegex(OSError, "Synthetic interruption"):
                workflow.promote(self.root, self.profile, args)
        self.assertFalse((self.root / "metadata/registry.json").exists())
        self.assertTrue((self.root / "metadata/transactions/scene-v1.json").exists())
        self.promote(record, review, approval)
        before = self.snapshot()
        self.promote(record, review, approval)
        self.assertEqual(self.snapshot(), before)
        self.cli("audit")

    def test_interrupted_file_copy_never_publishes_partial_master(self):
        import argparse
        import asset_workflow as workflow
        record = self.prepare()
        review, preview = self.review(record)
        approval = self.approval(review, preview)
        args = argparse.Namespace(record=str(record), review=str(review), approval=str(approval), version=1)

        def partial_copy(source, destination, *args, **kwargs):
            destination.write(source.read(10))
            raise OSError("Synthetic interruption during copy")

        with mock.patch.object(workflow.shutil, "copyfileobj", side_effect=partial_copy):
            with self.assertRaisesRegex(OSError, "Synthetic interruption during copy"):
                workflow.promote(self.root, self.profile, args)
        self.assertFalse((self.root / "assets/scene-v1.png").exists())
        self.assertFalse((self.root / "metadata/registry.json").exists())
        self.assertFalse((self.root / "metadata/transactions/test.lock").exists())
        self.promote(record, review, approval)
        self.assertEqual((self.root / "assets/scene-v1.png").read_bytes(), self.input.read_bytes())
        self.cli("audit")


if __name__ == "__main__":
    unittest.main()

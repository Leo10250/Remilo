"""Behavior checks for deterministic image and path primitives."""

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

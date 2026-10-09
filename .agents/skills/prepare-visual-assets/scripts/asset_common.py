"""Deterministic image and bounded-file primitives. No generation or approval inference."""
from __future__ import annotations

import copy
import hashlib
import io
import json
import math
import os
import re
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, ImageCms, ImageDraw, ImageFont, ImageOps, features


class AssetError(ValueError):
    pass


def require(condition, message):
    if not condition:
        raise AssetError(message)


def now():
    return datetime.now(timezone.utc).isoformat()


def utc_timestamp(value):
    require(isinstance(value, str) and value, "A UTC ISO timestamp is required")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise AssetError("Invalid UTC ISO timestamp") from exc
    require(parsed.tzinfo is not None and parsed.utcoffset().total_seconds() == 0, "Timestamp must include UTC offset")
    return value


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode()).hexdigest()


def load_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8-sig"))


def confined(root, relative, allowed_roots=None):
    root = Path(root).resolve()
    value = Path(relative)
    path = (value if value.is_absolute() else root / value).resolve()
    require(path.is_relative_to(root), f"Path escapes project root: {relative}")
    if allowed_roots is not None:
        allowed = [(root / folder).resolve() for folder in allowed_roots]
        require(all(p.is_relative_to(root) for p in allowed), "Allowed root escapes project")
        require(any(path.is_relative_to(p) for p in allowed), f"Path outside allowed output roots: {relative}")
    return path


def relative(root, path):
    return Path(path).resolve().relative_to(Path(root).resolve()).as_posix()


def resource(root, path, local=False, **fields):
    return {"localArtifactPath" if local else "path": relative(root, path), "sha256": sha(path), **fields}


def resolve_resource(root, item):
    return confined(root, item.get("path") or item.get("localArtifactPath"))


def atomic_json(path, value, *, replace=False):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    data = (json.dumps(value, indent=2, ensure_ascii=False) + "\n").encode("utf-8")
    temp = path.with_name(path.name + f".{os.getpid()}.tmp")
    try:
        with temp.open("xb") as stream:
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        if replace:
            os.replace(temp, path)
        elif os.name == "nt":
            os.rename(temp, path)
        else:
            os.link(temp, path)
    finally:
        if temp.exists():
            temp.unlink()


def validate_id(value):
    require(isinstance(value, str) and bool(re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", value)), "Invalid asset ID")
    require(len(value) <= 64 and value.upper() not in {"CON", "PRN", "AUX", "NUL", *[f"COM{i}" for i in range(10)], *[f"LPT{i}" for i in range(10)]}, "Reserved/long asset ID")
    return value


def dimensions(size):
    require(isinstance(size, (list, tuple)) and len(size) == 2, "Size must contain width and height")
    require(all(isinstance(n, int) and not isinstance(n, bool) and n > 0 for n in size), "Dimensions must be positive integers")
    return tuple(size)


def focal_pair(focal):
    require(len(focal) == 2 and all(isinstance(v, (int, float)) and math.isfinite(v) and 0 <= v <= 1 for v in focal), "Focal coordinates must be finite and within 0..1")
    return tuple(focal)


def inspect_image(path):
    with Image.open(path) as im:
        im.load()
        alpha = im.convert("RGBA").getchannel("A").getextrema()
        orientation = im.getexif().get(274, 1)
        profile = im.info.get("icc_profile")
        profile_name, profile_valid = None, None
        if profile:
            try:
                profile_name = ImageCms.getProfileDescription(ImageCms.ImageCmsProfile(io.BytesIO(profile))).strip()
                profile_valid = True
            except Exception:
                profile_valid = False
        return {"sha256": sha(path), "width": im.width, "height": im.height, "size": list(im.size), "format": im.format,
                "mode": im.mode, "hasAlpha": "A" in im.getbands() or "transparency" in im.info,
                "opaque": alpha == (255, 255), "alphaExtrema": list(alpha), "iccPresent": bool(profile),
                "iccSha256": hashlib.sha256(profile).hexdigest() if profile else None,
                "iccDescription": profile_name, "iccValid": profile_valid,
                "exifOrientation": orientation, "displaySize": list(im.size[::-1] if orientation in (5, 6, 7, 8) else im.size)}


def spec_for(profile, asset):
    validate_id(asset)
    require(profile.get("schemaVersion") == 1, "Unsupported profile schemaVersion")
    require(asset in profile.get("assets", {}), f"Unknown asset: {asset}")
    spec = copy.deepcopy(profile.get("defaults", {}))
    specific = copy.deepcopy(profile["assets"][asset])
    for key, value in specific.items():
        if isinstance(value, dict) and isinstance(spec.get(key), dict):
            spec[key].update(value)
        else:
            spec[key] = value
    require(not spec.get("helperUnsupported"), spec.get("unsupportedReason", "This asset requires native/vector preparation outside the raster CLI"))
    return spec


def conformance(facts, master):
    checks = []
    def add(name, ok, detail):
        checks.append({"id": name, "status": "pass" if ok else "fail", "detail": detail})
    if master.get("exactSize"):
        add("master-size", facts["size"] == list(dimensions(master["exactSize"])), f"Actual {facts['size']}; required exact {master['exactSize']}")
    elif master.get("minimumSize"):
        minimum = dimensions(master["minimumSize"])
        add("master-size", all(a >= b for a, b in zip(facts["displaySize"], minimum)), f"Actual {facts['displaySize']}; minimum {list(minimum)}")
    if master.get("format"):
        add("master-format", facts["format"].upper() == master["format"].upper(), f"Actual {facts['format']}")
    if master.get("alpha") == "opaque":
        add("master-alpha", facts["opaque"], f"Alpha extrema {facts['alphaExtrema']}")
    elif master.get("alpha") == "transparent":
        add("master-alpha", facts["alphaExtrema"][0] < 255, f"Alpha extrema {facts['alphaExtrema']}")
    if master.get("colorSpace", "srgb").lower() == "srgb":
        # A profile description is recorded evidence, not a gamut/rendering measurement.
        tagged_srgb = facts.get("iccValid") is True and "srgb" in (facts.get("iccDescription") or "").lower().replace(" ", "")
        assumed_srgb = not facts["iccPresent"] and master.get("allowAssumedSrgb") is True and facts["mode"] in ("RGB", "RGBA", "P", "L", "LA")
        add("master-color", tagged_srgb or assumed_srgb,
            "Tagged sRGB description" if tagged_srgb else "Untagged source explicitly interpreted as sRGB" if assumed_srgb else "Original is not confirmed sRGB; require explicit interpretation/conversion or exception")
    return checks


def crop_box(size, viewport, focal=(.5, .5)):
    sw, sh = dimensions(size)
    vw, vh = dimensions(viewport)
    fx, fy = focal_pair(focal)
    if sw / sh < vw / vh:
        cw, ch = sw, min(sh, max(1, round(sw * vh / vw)))
    else:
        cw, ch = min(sw, max(1, round(sh * vw / vh))), sh
    x = max(0, min(sw - cw, round(fx * sw - cw / 2)))
    y = max(0, min(sh - ch, round(fy * sh - ch / 2)))
    return [x, y, x + cw, y + ch]


def crop_feasibility(size, viewport, landmarks, focal=(.5, .5), *, allow_outside=False):
    sw, sh = dimensions(size)
    rect = crop_box(size, viewport, focal)
    found = []
    for landmark in landmarks:
        b = landmark["bounds"]
        require(len(b) == 4 and all(math.isfinite(v) and (allow_outside or 0 <= v <= 1) for v in b) and b[0] < b[2] and b[1] < b[3], "Landmark bounds must be ordered normalized edges")
        pad = landmark.get("padding", 0)
        require(isinstance(pad, (int, float)) and math.isfinite(pad) and 0 <= pad <= 1, "Invalid landmark padding")
        bounds = [(b[0] - pad) * sw, (b[1] - pad) * sh, (b[2] + pad) * sw, (b[3] + pad) * sh]
        visible = rect[0] <= bounds[0] and rect[1] <= bounds[1] and rect[2] >= bounds[2] and rect[3] >= bounds[3]
        found.append({"name": landmark["name"], "boundsPx": bounds, "visible": visible})
    union = [min(p["boundsPx"][0] for p in found), min(p["boundsPx"][1] for p in found), max(p["boundsPx"][2] for p in found), max(p["boundsPx"][3] for p in found)] if found else None
    feasible = union is None or (0 <= union[0] <= union[2] <= sw and 0 <= union[1] <= union[3] <= sh and union[2] - union[0] <= rect[2] - rect[0] and union[3] - union[1] <= rect[3] - rect[1])
    return {"feasible": feasible, "currentContainsAll": all(p["visible"] for p in found), "sourceRectPx": rect, "landmarks": found, "requiredBoundsPx": union}


def transform_focal(focal, source_size, trim_box):
    fx, fy = focal_pair(focal)
    sw, sh = dimensions(source_size)
    x0, y0, x1, y1 = trim_box
    require(0 <= x0 < x1 <= sw and 0 <= y0 < y1 <= sh, "Invalid source trim")
    return [(fx * sw - x0) / (x1 - x0), (fy * sh - y0) / (y1 - y0)]


def pixels_equal(left, right):
    # Compare all channels; RGBA ImageChops.getbbox() may only inspect alpha.
    return left.size == right.size and left.convert("RGBA").tobytes() == right.convert("RGBA").tobytes()


def srgb_pixels(source):
    im = ImageOps.exif_transpose(source)
    alpha = im.convert("RGBA").getchannel("A") if "A" in im.getbands() or "transparency" in im.info else None
    embedded = im.info.get("icc_profile")
    if embedded:
        try:
            color = ImageCms.profileToProfile(im.convert("RGB") if im.mode not in ("RGB", "CMYK", "LAB") else im, ImageCms.ImageCmsProfile(io.BytesIO(embedded)), ImageCms.createProfile("sRGB"), outputMode="RGB")
        except Exception as exc:
            raise AssetError(f"Cannot convert embedded color profile: {exc}") from exc
        note = "Embedded ICC converted to sRGB; source bytes preserved"
    else:
        require(im.mode in ("RGB", "RGBA", "P", "L", "LA"), "Untagged non-RGB color requires an explicit reviewed conversion")
        color = im.convert("RGB")
        note = "Untagged pixels interpreted as sRGB; no measured color-space assertion"
    if alpha is not None:
        color.putalpha(alpha)
    return color, note


def render_export(source, spec):
    with Image.open(source) as raw:
        im, color_note = srgb_pixels(raw)
    sw, sh = im.size
    target = dimensions(spec.get("size", im.size))
    fit = spec.get("fit", "cover")
    focal = focal_pair(spec.get("focal", [.5, .5]))
    require(fit in ("cover", "contain", "none"), "Unsupported export fit")
    rect = [0, 0, sw, sh]
    if fit == "cover":
        rect = crop_box(im.size, target, focal)
        # Use an exact integer aspect crop when possible (Remilo 16:9 trim).
        divisor = math.gcd(*target)
        rw, rh = target[0] // divisor, target[1] // divisor
        multiple = min(sw // rw, sh // rh)
        if multiple:
            cw, ch = rw * multiple, rh * multiple
            x = max(0, min(sw - cw, round(focal[0] * sw - cw / 2)))
            y = max(0, min(sh - ch, round(focal[1] * sh - ch / 2)))
            rect = [x, y, x + cw, y + ch]
        out_size = target
    elif fit == "contain":
        scale = min(target[0] / sw, target[1] / sh)
        out_size = (max(1, round(sw * scale)), max(1, round(sh * scale)))
    else:
        require(target == im.size, "fit=none cannot resize or stretch")
        out_size = im.size
    upscaled = out_size[0] > rect[2] - rect[0] or out_size[1] > rect[3] - rect[1]
    require(not upscaled or spec.get("allowUpscale") is True, "Export would upscale; explicit allowUpscale contract required")
    derived = im.crop(rect).resize(out_size, Image.Resampling.LANCZOS)
    content_box = [0, 0, *out_size]
    if fit == "contain":
        background = spec.get("background", "#00000000" if im.mode == "RGBA" else "#ffffff")
        canvas = Image.new("RGBA" if im.mode == "RGBA" or background == "transparent" else "RGB", target, (0, 0, 0, 0) if background == "transparent" else background)
        x, y = (target[0] - out_size[0]) // 2, (target[1] - out_size[1]) // 2
        canvas.paste(derived, (x, y))
        derived = canvas
        content_box = [x, y, x + out_size[0], y + out_size[1]]
    mask = spec.get("mask")
    if mask:
        require(mask == "circle", "Only declared circle masking is automated; manual/vector isolation stays separate")
        factor = 4
        alpha = Image.new("L", (target[0] * factor, target[1] * factor), 0)
        ImageDraw.Draw(alpha).ellipse((0, 0, target[0] * factor - 1, target[1] * factor - 1), fill=255)
        alpha = alpha.resize(target, Image.Resampling.LANCZOS)
        derived = derived.convert("RGBA")
        # Multiply an existing alpha mask rather than replacing source transparency.
        from PIL import ImageChops
        derived.putalpha(ImageChops.multiply(derived.getchannel("A"), alpha))
    return derived, {"sourceRectPx": rect, "sourceDisplaySize": [sw, sh], "targetSize": list(target), "contentRectPx": content_box,
                     "fit": fit, "focalNormalized": list(focal), "upscaled": upscaled, "resizeFilter": "Lanczos", "mask": mask,
                     "colorPolicy": color_note, "orientationApplied": True, "addedSourceDetail": False}


def encode_image(image, path, format, lossless=True):
    path = Path(path)
    require(not path.exists(), f"Refusing overwrite: {path}")
    fmt = format.upper()
    require(fmt in ("PNG", "WEBP"), "Only PNG and WebP deterministic exports supported")
    require(lossless is True, "Lossy export is not supported by this verified pipeline")
    profile = ImageCms.ImageCmsProfile(ImageCms.createProfile("sRGB")).tobytes()
    path.parent.mkdir(parents=True, exist_ok=True)
    options = {"icc_profile": profile}
    if fmt == "WEBP":
        require(features.check("webp"), "Pillow lacks WebP support")
        options.update(lossless=True, quality=100, method=6, exact=True)
    image.save(path, format=fmt, **options)
    with Image.open(path) as decoded:
        require(pixels_equal(image, decoded), "Export failed exact all-channel pixel verification")


def font(size):
    for candidate in ("DejaVuSans.ttf", "C:/Windows/Fonts/segoeui.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"):
        try:
            return ImageFont.truetype(candidate, size)
        except OSError:
            pass
    try:
        return ImageFont.load_default(size=size)
    except TypeError:
        return ImageFont.load_default()


def preview_fit(image, size, background="#f3f4f6"):
    box = Image.new("RGB", size, background)
    rgba = image.convert("RGBA")
    thumb = ImageOps.contain(rgba, size, Image.Resampling.LANCZOS)
    box.paste(thumb, ((size[0] - thumb.width) // 2, (size[1] - thumb.height) // 2), thumb)
    return box


def checker_preview(image, size):
    box = Image.new("RGB", size, "#ffffff")
    draw = ImageDraw.Draw(box)
    for y in range(0, size[1], 12):
        for x in range(0, size[0], 12):
            if (x // 12 + y // 12) % 2:
                draw.rectangle((x, y, x + 11, y + 11), fill="#d5d9df")
    thumb = ImageOps.contain(image.convert("RGBA"), size, Image.Resampling.LANCZOS)
    box.paste(thumb, ((size[0] - thumb.width) // 2, (size[1] - thumb.height) // 2), thumb)
    return box

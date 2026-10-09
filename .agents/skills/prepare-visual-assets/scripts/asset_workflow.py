"""Prepare and adopt visual assets with measured evidence. ImageGen stays a tool call."""
from __future__ import annotations

import argparse
import copy
import json
import os
import shutil
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageOps, __version__ as pillow_version, features

from asset_common import (AssetError, atomic_json, confined, conformance, crop_box, crop_feasibility,
                          digest, encode_image, font, inspect_image, load_json, now, pixels_equal,
                          preview_fit, relative, render_export, require, resolve_resource,
                          resource, sha, spec_for, transform_focal, validate_id)
from asset_common import utc_timestamp
from asset_common import checker_preview
from registry_adapters import build_registry_update, load_registry, normalized_entries


def input_file(root, value):
    path = Path(value)
    path = path.resolve() if path.is_absolute() else confined(root, value)
    require(path.is_file(), f"Input file missing: {path}")
    return path


def roots(root, profile):
    require(profile.get("allowedOutputRoots"), "Profile requires allowedOutputRoots")
    local = confined(root, profile["localRoot"], profile["allowedOutputRoots"])
    metadata = confined(root, profile["metadataRoot"], profile["allowedOutputRoots"])
    require(local != metadata and not metadata.is_relative_to(local), "Durable metadata cannot live in the candidate directory")
    require(profile.get("allowedOutputRoots"), "Profile requires allowedOutputRoots")
    return local, metadata


def registry_config(profile, spec):
    configs = [r for r in profile.get("registries", []) if r["key"] == spec.get("registry")]
    require(len(configs) == 1, "Asset needs exactly one configured registry")
    require(not configs[0].get("historical"), "Historical snapshots cannot receive new assets")
    validate_id(configs[0]["key"])
    return configs[0]


def destination(root, profile, template, asset, version, suffix):
    require(isinstance(template, str) and template, "Missing production destination")
    try:
        value = template.format(asset=asset, version=version, suffix=suffix)
    except (KeyError, ValueError) as exc:
        raise AssetError(f"Invalid destination template: {template}") from exc
    return confined(root, value, profile["allowedOutputRoots"])


def validate_dependencies(root, profile, spec):
    required = spec.get("requiresAssets", [])
    if required:
        active = {e["assetId"] for e in normalized_entries(root, profile) if not e["historical"]}
        require(all(a in active for a in required), f"Required approved anchors missing: {required}")


def prepare(root, profile, args):
    asset = validate_id(args.asset)
    require(args.candidate > 0, "Candidate must be positive")
    local, metadata = roots(root, profile)
    spec = spec_for(profile, asset)
    prompt_kind = getattr(args, "prompt_kind", "preparation")
    validate_dependencies(root, profile, spec)
    source_input = input_file(root, args.source)
    prompt_input = input_file(root, args.prompt)
    references = load_json(input_file(root, args.references))
    require(isinstance(references, list), "References must be an ordered JSON array")
    if spec.get("route") == "faithful-export":
        require("imagegen" not in args.generator.lower().replace("_", "").replace(" ", ""), "Faithful-export route forbids a generative redraw")
        if spec.get("sourceSha256"):
            require(sha(source_input) == spec["sourceSha256"], "Faithful source differs from configured identity")
    facts = inspect_image(source_input)
    suffix = {"PNG": ".png", "WEBP": ".webp", "JPEG": ".jpg", "TIFF": ".tif"}.get(facts["format"], source_input.suffix.lower())
    require(suffix and suffix[1:].isalnum(), "Unsafe/unknown source extension")
    candidate_dir = local / asset / f"candidate-{args.candidate:02}"
    record_path = metadata / "records" / asset / f"prepared-{args.candidate:02}.json"
    require(not candidate_dir.exists() and not record_path.exists(), "Candidate already exists; increment candidate number")
    # Resolve and inspect all inputs before writing anything.
    ref_items = []
    valid_roles = {"edit-target", "composition", "style", "palette", "detail", "historical", "faithful-source"}
    for ref in references:
        require(isinstance(ref, dict) and ref.get("role") in valid_roles, "Reference requires an explicit supported role")
        require(ref.get("inspected") is True and bool(ref.get("influence")), "Reference inspection and allowed influence must be recorded")
        path = input_file(root, ref["file"])
        ref_items.append((ref, path, inspect_image(path)))
    config = registry_config(profile, spec)
    registry_path = confined(root, config["file"], profile["allowedOutputRoots"])
    load_registry(root, config)
    checks = conformance(facts, spec.get("master", {}))
    # Export computations are staged in memory; a failed required export is explicit evidence.
    computed = []
    for i, export in enumerate(spec.get("exports", [])):
        role = validate_id(export["role"])
        try:
            image, transform = render_export(source_input, export)
            computed.append((i, role, export, image, transform))
            checks.append({"id": f"export:{role}", "status": "pass", "detail": "Deterministic pixels prepared without undeclared enlargement"})
        except ValueError as exc:
            checks.append({"id": f"export:{role}", "status": "fail", "detail": str(exc)})
    candidate_dir.mkdir(parents=True, exist_ok=False)
    source = candidate_dir / ("original" + suffix)
    shutil.copyfile(source_input, source)
    prompt = metadata / "prompts" / asset / f"prepared-{args.candidate:02}.txt"
    require(not prompt.exists(), "Durable prompt already exists; increment candidate")
    prompt.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(prompt_input, prompt)
    source_record = resource(root, source, local=True, **{k: v for k, v in facts.items() if k != "sha256"})
    input_images = []
    for i, (ref, path, measured) in enumerate(ref_items, 1):
        saved = candidate_dir / "references" / f"{i:02}{path.suffix.lower()}"
        saved.parent.mkdir(exist_ok=True)
        shutil.copyfile(path, saved)
        entry = resource(root, saved, local=True, role=ref["role"], influence=ref["influence"], inspected=True, measurements=measured)
        if path.is_relative_to(root):
            entry["originalReference"] = resource(root, path)
        else:
            entry["originalHostPath"] = str(path)
        input_images.append(entry)
    outputs = []
    for i, role, export, image, transform in computed:
        fmt = export.get("format", "PNG").upper()
        file = candidate_dir / "exports" / f"{i:02}-{role}.{fmt.lower()}"
        encode_image(image, file, fmt, export.get("lossless", True))
        outputs.append(resource(root, file, local=True, role=role, destination=export["destination"], width=image.width, height=image.height,
                                format=fmt, mode=image.mode, opaque=image.convert("RGBA").getchannel("A").getextrema() == (255, 255),
                                lossless=True, transform=transform, exportSpec=export,
                                exportDetails={"encoder": "Pillow", "pillowVersion": pillow_version, "libwebpVersion": features.version("webp"), "losslessScope": "Exact transformed pixels, all channels verified"}))
        export_record = outputs[-1]
        for j, item in enumerate(export.get("copies", [])):
            item = {"role": "native", "destination": item} if isinstance(item, str) else item
            copy_path = candidate_dir / "exports" / f"{i:02}-{role}-copy-{j:02}.{fmt.lower()}"
            shutil.copyfile(file, copy_path)
            outputs.append(resource(root, copy_path, local=True, **{k: v for k, v in export_record.items() if k not in ("localArtifactPath", "sha256", "role", "destination")},
                                    role=item["role"], destination=item["destination"], copyOf=role, identicalToRuntime=True))
    record = {"schemaVersion": 1, "assetId": asset, "candidate": args.candidate, "recordedAtUtc": now(), "generator": args.generator,
              "promptKind": prompt_kind, "upstreamGenerationProvenance": "provided-by-operator" if prompt_kind == "generation" else "not-applicable" if spec.get("route") == "faithful-export" else "unknown; supplied preparation brief is not claimed as a generation prompt",
              "source": source_record, "prompt": resource(root, prompt), "inputImages": input_images,
              "spec": spec, "specSha256": digest(spec), "profileSha256": digest(profile), "checks": checks,
              "stagedOutputs": outputs, "expectedRegistrySha256": sha(registry_path) if registry_path.exists() else None,
              "requestedDimensionsAreNotMeasuredOutput": True, "visualInspection": {"status": "pending"}, "approval": None}
    atomic_json(record_path, record)
    return {"record": relative(root, record_path), "source": source_record, "checks": checks, "productionFilesWritten": False}


def verify_prepared(root, profile, record_path):
    record = load_json(record_path)
    require(record.get("schemaVersion") == 1, "Unsupported prepared record")
    require(digest(spec_for(profile, record["assetId"])) == record["specSha256"], "Asset specification changed; prepare a new candidate")
    require(digest(profile) == record["profileSha256"], "Profile changed; prepare a new candidate")
    for item in [record["source"], record["prompt"], *record["inputImages"], *record["stagedOutputs"]]:
        require(sha(resolve_resource(root, item)) == item["sha256"], "Prepared input/output hash changed")
        if item.get("originalReference"):
            ref = item["originalReference"]
            require(sha(resolve_resource(root, ref)) == ref["sha256"], "Original project reference changed")
    return record


def review(root, profile, args):
    local, metadata = roots(root, profile)
    path = confined(root, args.record)
    record = verify_prepared(root, profile, path)
    require(args.revision > 0, "Review revision must be positive")
    spec = record["spec"]
    views = load_json(input_file(root, args.views)) if args.views else spec.get("views", [])
    require(isinstance(views, list), "Views must be a JSON array")
    source = resolve_resource(root, record["source"])
    with Image.open(source) as raw:
        original = ImageOps.exif_transpose(raw).convert("RGBA")
    candidate_dir = source.parent
    review_json = metadata / "records" / record["assetId"] / f"review-{record['candidate']:02}-{args.revision:02}.json"
    preview_path = candidate_dir / f"review-{args.revision:02}.png"
    require(not review_json.exists() and not preview_path.exists(), "Review already exists; increment revision")
    compare_path = input_file(root, args.compare) if args.compare else None
    comparison = None
    if compare_path:
        with Image.open(compare_path) as raw:
            comparison = ImageOps.exif_transpose(raw).convert("RGBA")
    panels = [("Original artwork (aspect preserved)", preview_fit(original, (760, 420)))]
    if comparison:
        panels.append(("Reference / paired comparison", preview_fit(comparison, (760, 420))))
    if original.getchannel("A").getextrema()[0] < 255:
        panels.append(("Transparency on dark surface", preview_fit(original, (760, 300), "#18212f")))
        panels.append(("Transparency on checkerboard", checker_preview(original, (760, 420))))
    source_profiles, export_profiles, checks = {}, {}, []
    image_sets = [("source", original, None)]
    for out in record["stagedOutputs"]:
        if out.get("copyOf"):
            continue
        with Image.open(resolve_resource(root, out)) as raw:
            decoded = raw.convert("RGBA")
        image_sets.append((out["role"], decoded, out))
        panels.append((f"Decoded {out['role']} export: {decoded.width} x {decoded.height}px", preview_fit(decoded, (760, min(420, max(80, decoded.height))))))
        if decoded.getchannel("A").getextrema()[0] < 255 and max(decoded.size) <= 1024:
            for label, background in [("light", "#f3f4f6"), ("dark", "#18212f")]:
                panels.append((f"{out['role']} native pixels on {label}", preview_fit(decoded, decoded.size, background)))
            panels.append((f"{out['role']} native pixels on checkerboard", checker_preview(decoded, decoded.size)))
        # Preserve actual small-pixel artwork; the label/frame is independent of it.
        if decoded.width <= 128 and decoded.height <= 128:
            actual = Image.new("RGB", (max(200, decoded.width), max(100, decoded.height)), "#f3f4f6")
            actual.paste(decoded, (0, 0), decoded)
            panels.append((f"{out['role']}: actual pixels (no magnification)", actual))
        if spec.get("maskReviews"):
            for mask_name in spec["maskReviews"]:
                mask = Image.new("L", decoded.size, 0)
                draw = ImageDraw.Draw(mask)
                if mask_name == "circle":
                    draw.ellipse((0, 0, decoded.width - 1, decoded.height - 1), fill=255)
                elif mask_name == "squircle":
                    draw.rounded_rectangle((0, 0, decoded.width - 1, decoded.height - 1), radius=min(decoded.size) * .24, fill=255)
                else:
                    raise AssetError(f"Unsupported review mask: {mask_name}")
                shown = decoded.copy()
                from PIL import ImageChops
                shown.putalpha(ImageChops.multiply(shown.getchannel("A"), mask))
                panels.append((f"{out['role']} {mask_name} diagnostic (not OEM acceptance)", preview_fit(shown, (240, 240))))
    for role, image, export in image_sets:
        profiles = {}
        for view in views:
            name = validate_id(view["name"])
            fit = view.get("fit", "cover")
            require(fit in ("cover", "contain"), "Review fit must be cover or contain")
            focal = view.get("focal", [.5, .5])
            landmarks = copy.deepcopy(view.get("landmarks", []))
            if export:
                transform = export["transform"]
                sw, sh = transform["sourceDisplaySize"]
                x0, y0, x1, y1 = transform["sourceRectPx"]
                cx0, cy0, cx1, cy1 = transform["contentRectPx"]
                tw, th = transform["targetSize"]
                def mapped_point(x, y):
                    return [((x * sw - x0) / (x1 - x0) * (cx1 - cx0) + cx0) / tw,
                            ((y * sh - y0) / (y1 - y0) * (cy1 - cy0) + cy0) / th]
                focal = mapped_point(*focal)
                focal = [max(0, min(1, v)) for v in focal]
                for cue in landmarks:
                    b = cue["bounds"]
                    pad = cue.get("padding", 0)
                    cue["bounds"] = mapped_point(b[0] - pad, b[1] - pad) + mapped_point(b[2] + pad, b[3] + pad)
                    cue["padding"] = 0
            size = view["size"]
            feasibility = crop_feasibility(image.size, size, landmarks, focal, allow_outside=export is not None)
            if fit == "contain":
                feasibility.update(feasible=True, currentContainsAll=True, sourceRectPx=[0, 0, image.width, image.height])
                cropped = preview_fit(image, tuple(size))
            else:
                cropped = preview_fit(image.crop(feasibility["sourceRectPx"]).resize(tuple(size), Image.Resampling.LANCZOS), tuple(size))
            overlay = view.get("overlayHeight", 0)
            require(isinstance(overlay, (int, float)) and 0 <= overlay <= size[1], "Overlay height must fit viewport")
            if overlay:
                draw = ImageDraw.Draw(cropped)
                for x in range(0, size[0], 12):
                    draw.line((x, overlay, min(x + 6, size[0] - 1), overlay), fill="white", width=1)
            profiles[name] = {"viewportDp" if view.get("unit") == "dp" else "viewportPx": size, "focalNormalized": focal,
                              "sourceRectPx": feasibility["sourceRectPx"], "fit": fit, "toolbarHeightDp": overlay,
                              "feasibility": feasibility}
            if landmarks:
                checks.append({"id": f"crop:{role}:{name}", "status": "pass" if feasibility["feasible"] and feasibility["currentContainsAll"] else "fail",
                               "detail": "Declared cue bounds fit the current crop" if feasibility["currentContainsAll"] else "Cue bounds clipped or impossible; revise framing or obtain explicit tradeoff"})
            panels.append((f"{role} {name}: {size[0]} x {size[1]} {view.get('unit', 'px')} at 1px/unit", cropped))
        if role == "source":
            source_profiles = profiles
        else:
            export_profiles[role] = profiles
    width = max(820, *(im.width + 40 for _, im in panels))
    height = sum(im.height + 55 for _, im in panels) + 105
    board = Image.new("RGB", (width, height), "#f3f4f6")
    draw = ImageDraw.Draw(board)
    draw.text((20, 12), f"{record['assetId']} candidate {record['candidate']}, review {args.revision}", fill="#18212f", font=font(22))
    y = 55
    for label, image in panels:
        draw.text((20, y), label, fill="#18212f", font=font(16))
        board.paste(image, (20, y + 28))
        y += image.height + 55
    draw.text((20, y), "Synthetic framing only; runtime contrast, accessibility and device behavior remain unassessed.", fill="#596475", font=font(14))
    encode_image(board, preview_path, "PNG")
    panel_resources = []
    for index, (label, image) in enumerate(panels, 1):
        panel_file = candidate_dir / f"review-{args.revision:02}-panels" / f"{index:02}.png"
        encode_image(image, panel_file, "PNG")
        panel_resources.append(resource(root, panel_file, local=True, label=label, width=image.width, height=image.height))
    inspection = load_json(input_file(root, args.inspection)) if args.inspection else {"status": "pending", "checks": []}
    supplementary = inspection.get("supplementalPreviews", [])
    require(isinstance(supplementary, list), "Supplemental previews must be an array of hashed project resources")
    for item in supplementary:
        require(sha(resolve_resource(root, item)) == item.get("sha256"), "Supplemental preview hash differs")
    doc = {"schemaVersion": 1, "assetId": record["assetId"], "candidate": record["candidate"], "revision": args.revision,
           "recordedAtUtc": now(), "preparedRecord": resource(root, path), "candidateSha256": record["source"]["sha256"],
           "views": views, "viewsSha256": digest(views), "sourceProfiles": source_profiles, "exportProfiles": export_profiles,
           "checks": checks, "inspection": inspection, "preview": resource(root, preview_path, local=True),
           "previewPanels": panel_resources, "supplementalPreviews": supplementary,
           "stagedOutputIdentities": [{"role": o["role"], "sha256": o["sha256"]} for o in record["stagedOutputs"]],
           "runtimeContrastAssessed": False, "deviceAcceptanceAssessed": False}
    if compare_path:
        doc["comparison"] = resource(root, compare_path, local=compare_path.is_relative_to(local)) if compare_path.is_relative_to(root) else {"originalHostPath": str(compare_path), "sha256": sha(compare_path)}
    atomic_json(review_json, doc)
    return {"record": relative(root, review_json), "preview": relative(root, preview_path), "sha256": doc["preview"]["sha256"], "checks": checks, "inspection": inspection}


def inspection_passes(inspection):
    values = inspection.get("checks", [])
    try:
        utc_timestamp(inspection.get("recordedAtUtc"))
    except ValueError:
        return False
    return bool(inspection.get("reviewer")) and bool(values) and all(c.get("name") and c.get("status") == "pass" and c.get("observation") for c in values)


def promote(root, profile, args):
    local, metadata = roots(root, profile)
    record_path = confined(root, args.record)
    review_path = confined(root, args.review)
    record = verify_prepared(root, profile, record_path)
    view = load_json(review_path)
    decision = load_json(input_file(root, args.approval))
    asset = record["assetId"]
    require(args.version > 0, "Version must be positive")
    require(view["assetId"] == asset and view["candidate"] == record["candidate"], "Review candidate mismatch")
    require(view["preparedRecord"]["sha256"] == sha(record_path) and view["candidateSha256"] == record["source"]["sha256"], "Stale review/prepared binding")
    require(sha(resolve_resource(root, view["preview"])) == view["preview"]["sha256"], "Review pixels changed")
    for item in view.get("previewPanels", []) + view.get("supplementalPreviews", []):
        require(sha(resolve_resource(root, item)) == item.get("sha256"), "Presented preview panel/supplement changed")
    for field, expected in {"assetId": asset, "candidate": record["candidate"], "candidateSha256": record["source"]["sha256"],
                            "reviewSha256": view["preview"]["sha256"], "reviewRecordSha256": sha(review_path)}.items():
        require(decision.get(field) == expected, f"Approval does not bind {field}")
    require(isinstance(decision.get("ownerStatement"), str) and decision["ownerStatement"].strip(), "Approval must preserve exact human statement")
    utc_timestamp(decision.get("recordedAtUtc"))
    scope = decision.get("scope", {})
    require(isinstance(scope, dict) and scope.get("artwork") is True and scope.get("activation") is True, "Approval scope must explicitly cover artwork and activation with boolean fields")
    failures = [c for c in record["checks"] + view["checks"] if c["status"] != "pass"]
    if not inspection_passes(view["inspection"]):
        failures.append({"id": "visual-inspection", "status": "pending", "detail": "Actual visual findings remain pending/failed"})
    exceptions = decision.get("exceptions", [])
    require(isinstance(exceptions, list) and all(isinstance(e, dict) and e.get("ownerStatement") and e.get("check") for e in exceptions), "Exceptions need exact explicit human statements and check IDs")
    waived = {e["check"] for e in exceptions}
    require(all(c["id"] in waived for c in failures), "Technical/visual checks unresolved: " + ", ".join(c["id"] for c in failures if c["id"] not in waived))
    # An exception cannot create missing files or change the reviewed transform.
    needed_roles = [e["role"] for e in record["spec"].get("exports", [])]
    require(all(any(o["role"] == r for o in record["stagedOutputs"]) for r in needed_roles), "Required staged export is missing")
    require(view["stagedOutputIdentities"] == [{"role": o["role"], "sha256": o["sha256"]} for o in record["stagedOutputs"]], "Review export set changed")
    config = registry_config(profile, record["spec"])
    registry_path = confined(root, config["file"], profile["allowedOutputRoots"])
    approval_path = metadata / "approvals" / f"{asset}-workflow-v{args.version}.json"
    journal_path = metadata / "transactions" / f"{asset}-v{args.version}.json"
    lock = metadata / "transactions" / (config["key"] + ".lock")
    lock.parent.mkdir(parents=True, exist_ok=True)
    try:
        lock_fd = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    except FileExistsError as exc:
        raise AssetError(f"Promotion lock exists: {lock}; inspect recorded PID before removing a stale lock") from exc
    try:
        with os.fdopen(lock_fd, "w") as stream:
            stream.write(json.dumps({"pid": os.getpid(), "assetId": asset, "startedAtUtc": now()}))
        decision_hash = digest(decision)
        journal = load_json(journal_path) if journal_path.exists() else None
        if journal:
            require(journal["decisionSha256"] == decision_hash and journal["preparedSha256"] == sha(record_path) and journal["reviewSha256"] == sha(review_path), "Transaction identity differs; do not reuse a version")
            current_hash = sha(registry_path) if registry_path.exists() else None
            if current_hash == journal["newRegistrySha256"]:
                for f in journal["files"]:
                    require(sha(confined(root, f["path"])) == f["sha256"], "Committed production file changed")
                require(sha(approval_path) == journal["approvalSha256"], "Committed approval changed")
                if journal["state"] != "committed":
                    journal["state"] = "committed"
                    atomic_json(journal_path, journal, replace=True)
                return {"assetId": asset, "version": args.version, "alreadyCommitted": True, "files": journal["files"]}
        expected = record["expectedRegistrySha256"]
        require((sha(registry_path) if registry_path.exists() else None) == expected, "Registry changed since preparation; prepare a fresh candidate binding")
        items = []
        source = record["source"]
        source_path = resolve_resource(root, source)
        suffix = source_path.suffix
        master_template = record["spec"].get("master", {}).get("destination", "assets/visual/masters/{asset}-v{version}{suffix}")
        master = destination(root, profile, master_template, asset, args.version, suffix)
        require(master.suffix.lower() == suffix, "Preserved-source destination extension differs from actual format")
        items.append((source_path, master, {**{k: v for k, v in source.items() if k not in ("localArtifactPath", "path")}, "role": "source", "path": relative(root, master), "bytesPreserved": True}))
        for out in record["stagedOutputs"]:
            src = resolve_resource(root, out)
            dst = destination(root, profile, out["destination"], asset, args.version, src.suffix)
            final = {k: v for k, v in out.items() if k not in ("localArtifactPath", "destination")}
            final["path"] = relative(root, dst)
            if out["role"] in view["exportProfiles"]:
                final["cropProfiles"] = view["exportProfiles"][out["role"]]
            elif out.get("copyOf") in view["exportProfiles"]:
                final["cropProfiles"] = view["exportProfiles"][out["copyOf"]]
            final["sourceRectPx"] = out["transform"]["sourceRectPx"]
            items.append((src, dst, final))
        require(len({str(d) for _, d, _ in items}) == len(items), "Duplicate production destinations")
        files = [f for _, _, f in items]
        approval_doc = {"schemaVersion": 1, **decision, "version": args.version, "preparedRecord": resource(root, record_path),
                        "reviewRecord": resource(root, review_path), "files": files, "checks": record["checks"] + view["checks"],
                        "inspection": view["inspection"], "exceptionsDoNotAmendMeasuredConformance": True}
        approval_bytes = (json.dumps(approval_doc, indent=2, ensure_ascii=False) + "\n").encode("utf-8")
        import hashlib
        approval_hash = hashlib.sha256(approval_bytes).hexdigest()
        approval_ref = {"path": relative(root, approval_path), "sha256": approval_hash, "ownerStatement": decision["ownerStatement"], "candidate": record["candidate"], "recordedAtUtc": decision["recordedAtUtc"]}
        prepared = {**record, "preparedRecord": resource(root, record_path)}
        reviewed = {**view, "reviewRecord": resource(root, review_path)}
        _, new_registry = build_registry_update(root, profile, asset, args.version, prepared, reviewed, approval_ref, files)
        registry_bytes = (json.dumps(new_registry, indent=2, ensure_ascii=False) + "\n").encode("utf-8")
        registry_hash = hashlib.sha256(registry_bytes).hexdigest()
        if journal:
            require(journal["newRegistrySha256"] == registry_hash and journal["approvalSha256"] == approval_hash, "Recovery would change reviewed transaction")
        else:
            require(not approval_path.exists() and all(not d.exists() for _, d, _ in items), "Refusing to overwrite approved files")
            journal = {"schemaVersion": 1, "assetId": asset, "version": args.version, "state": "staged", "recordedAtUtc": now(),
                       "decisionSha256": decision_hash, "preparedSha256": sha(record_path), "reviewSha256": sha(review_path),
                       "previousRegistrySha256": expected, "newRegistrySha256": registry_hash, "approvalSha256": approval_hash, "files": files}
            atomic_json(journal_path, journal)
        for src, dst, f in items:
            if dst.exists():
                require(sha(dst) == f["sha256"], "Recovery destination differs; refusing overwrite")
            else:
                dst.parent.mkdir(parents=True, exist_ok=True)
                # A partial copy is never an approved filename. Publish without clobbering.
                temporary = dst.with_name(dst.name + f".{decision_hash[:16]}.part")
                if temporary.exists() and sha(temporary) != f["sha256"]:
                    temporary.unlink()  # Exact task-owned temporary inside validated output root.
                try:
                    if not temporary.exists():
                        with temporary.open("xb") as output, src.open("rb") as input_stream:
                            shutil.copyfileobj(input_stream, output)
                            output.flush()
                            os.fsync(output.fileno())
                    require(sha(temporary) == f["sha256"], "Staged publication hash differs")
                    try:
                        if os.name == "nt":
                            os.rename(temporary, dst)  # Windows rename refuses an existing destination.
                        else:
                            os.link(temporary, dst)  # Atomic no-clobber publication on POSIX.
                    except FileExistsError:
                        require(sha(dst) == f["sha256"], "Destination appeared with different bytes")
                finally:
                    temporary.unlink(missing_ok=True)
                require(sha(dst) == f["sha256"], "Copied production file hash differs")
        if approval_path.exists():
            require(sha(approval_path) == approval_hash, "Recovery approval differs")
        else:
            atomic_json(approval_path, approval_doc)
        journal["state"] = "files-written"
        atomic_json(journal_path, journal, replace=True)
        require((sha(registry_path) if registry_path.exists() else None) == expected, "Registry changed during promotion; active selection not replaced")
        atomic_json(registry_path, new_registry, replace=True)
        journal["state"] = "committed"
        atomic_json(journal_path, journal, replace=True)
        return {"assetId": asset, "version": args.version, "files": files, "approval": approval_ref, "checks": "verified", "exceptions": exceptions}
    finally:
        lock.unlink(missing_ok=True)


def audit(root, profile, args):
    findings, unavailable, limitations = [], [], []
    seen = set()
    def fail(asset, check, detail):
        findings.append({"assetId": asset, "check": check, "detail": detail})
    def check_resource(item, asset):
        key = (item.get("path") or item.get("localArtifactPath"), item.get("sha256"))
        if key in seen:
            return
        seen.add(key)
        path = resolve_resource(root, item)
        if not path.exists():
            if "localArtifactPath" in item and not args.local_provenance:
                unavailable.append({"assetId": asset, "localArtifactPath": item["localArtifactPath"]})
                return
            fail(asset, "missing-resource", str(path))
            return
        if item.get("sha256") and sha(path) != item["sha256"]:
            fail(asset, "hash", relative(root, path))
        if path.suffix.lower() == ".json":
            visit(load_json(path), asset)
        if path.suffix.lower() == ".xml" and item.get("format") == "AndroidVector":
            import importlib.util
            helper_path = root / "scripts" / "promote-manual-brand.py"
            module_spec = importlib.util.spec_from_file_location("manual_brand", helper_path)
            helper = importlib.util.module_from_spec(module_spec)
            module_spec.loader.exec_module(helper)
            try:
                actual = helper.inspect_vector(path)
                for field in ("width", "height", "opaque", "format"):
                    if field in item and item[field] != actual[field]:
                        fail(asset, f"metadata-{field}", relative(root, path))
            except (ValueError, OSError) as error:
                fail(asset, "native-vector-structure", str(error))
        if path.suffix.lower() in (".png", ".webp", ".jpg", ".jpeg"):
            actual = inspect_image(path)
            for field in ("width", "height", "opaque", "mode"):
                if field in item and item[field] != actual[field]:
                    fail(asset, f"metadata-{field}", relative(root, path))
    def visit(value, asset):
        if isinstance(value, list):
            for item in value:
                visit(item, asset)
        elif isinstance(value, dict):
            if (value.get("path") or value.get("localArtifactPath")) and value.get("sha256"):
                check_resource(value, asset)
            for child in value.values():
                visit(child, asset)
    entries = normalized_entries(root, profile)
    for entry in entries:
        asset = entry["assetId"]
        for f in entry["files"]:
            check_resource(f, asset)
        approval = entry["approval"]
        check_resource(approval, asset)
        ap = resolve_resource(root, approval)
        if ap.exists():
            decision = load_json(ap)
            visit(decision, asset)
            if decision.get("ownerStatement") != approval.get("ownerStatement", decision.get("ownerStatement")):
                fail(asset, "approval-statement", "Registry and approval disagree")
            if decision.get("assetId") != asset or decision.get("version", entry["version"]) != entry["version"]:
                fail(asset, "approval-identity", "Approval asset/version mismatch")
            source = entry.get("source")
            bound_source = decision.get("candidateSha256", decision.get("approvedCandidateSha256"))
            if bound_source and source and bound_source != source.get("sha256"):
                fail(asset, "approval-source", "Source hash differs from human decision binding")
        for limit in entry["technicalLimitations"]:
            limitations.append({"assetId": asset, "version": entry["version"], "historical": entry["historical"], "detail": limit})
        source = entry.get("source")
        if not source or not resolve_resource(root, source).exists():
            continue
        for f in entry["files"]:
            path = resolve_resource(root, f)
            if not path.exists() or f.get("role", "").startswith("source"):
                continue
            try:
                if f.get("manualExportSpec"):
                    # Distinct manually isolated sources remain explicit; never
                    # regenerate adaptive layers from the flattened brand tile.
                    import importlib.util
                    helper_path = root / "scripts" / "promote-manual-brand.py"
                    module_spec = importlib.util.spec_from_file_location("manual_brand", helper_path)
                    helper = importlib.util.module_from_spec(module_spec)
                    module_spec.loader.exec_module(helper)
                    expected = helper.manual_pixels(resolve_resource(root, f["derivedFrom"]), f["manualExportSpec"])
                elif f.get("exportSpec"):
                    expected, _ = render_export(resolve_resource(root, source), f["exportSpec"])
                elif entry["adapter"] == "remilo-scenes" and f.get("sourceRectPx"):
                    with Image.open(resolve_resource(root, source)) as raw:
                        expected = raw.convert("RGB").crop(f["sourceRectPx"]).resize((f["width"], f["height"]), Image.Resampling.LANCZOS)
                elif entry["adapter"] == "remilo-brand" and f.get("resizedFromPx"):
                    spec = {"size": [f["width"], f["height"]], "fit": "cover", "allowUpscale": f.get("upscaled", False), "mask": "circle" if f.get("role") == "legacy-round" else None}
                    expected, _ = render_export(resolve_resource(root, source), spec)
                else:
                    expected = None
                if expected is not None:
                    with Image.open(path) as decoded:
                        if not pixels_equal(expected, decoded):
                            fail(asset, "deterministic-pixels", relative(root, path))
                if f.get("copyOf") or f.get("identicalToRuntime"):
                    other = next((p for p in entry["files"] if p.get("role") == f.get("copyOf", "runtime")), None)
                    if not other:
                        fail(asset, "copy-source-missing", relative(root, path))
                    elif sha(resolve_resource(root, other)) != sha(path):
                        fail(asset, "copy-identity", relative(root, path))
                for name, view in f.get("cropProfiles", {}).items():
                    size = view.get("viewportDp", view.get("viewportPx"))
                    if size and view.get("focalNormalized") and view.get("fit", "cover") == "cover":
                        if crop_box((f["width"], f["height"]), size, view["focalNormalized"]) != view["sourceRectPx"]:
                            fail(asset, "crop-metadata", f"{relative(root, path)}:{name}")
            except (ValueError, OSError) as exc:
                fail(asset, "export-validation", str(exc))
    report = {"schemaVersion": 1, "recordedAtUtc": now(), "approvedVersionsChecked": len(entries), "resourcesChecked": len(seen),
              "findings": findings, "technicalLimitations": limitations, "unavailableLocalEvidence": unavailable,
              "runtimeContrastAssessed": False, "deviceAcceptanceAssessed": False}
    if args.report:
        atomic_json(confined(root, args.report, profile["allowedOutputRoots"]), report)
    return report


def parser():
    cli = argparse.ArgumentParser(description=__doc__)
    sub = cli.add_subparsers(dest="operation", required=True)
    for name in ("inspect", "prepare", "review", "promote", "audit"):
        p = sub.add_parser(name)
        p.add_argument("--project-root", required=True)
        p.add_argument("--profile", required=True)
        if name == "inspect":
            p.add_argument("--source", required=True)
            p.add_argument("--asset")
        elif name == "prepare":
            for key in ("asset", "source", "prompt", "references", "generator"):
                p.add_argument("--" + key, required=True)
            p.add_argument("--candidate", type=int, required=True)
            p.add_argument("--prompt-kind", choices=("generation", "preparation"), default="preparation",
                           help="Use generation only for the exact actually submitted generation prompt")
        elif name == "review":
            p.add_argument("--record", required=True)
            p.add_argument("--revision", type=int, required=True)
            for key in ("views", "inspection", "compare"):
                p.add_argument("--" + key)
        elif name == "promote":
            for key in ("record", "review", "approval"):
                p.add_argument("--" + key, required=True)
            p.add_argument("--version", type=int, required=True)
        else:
            p.add_argument("--local-provenance", action="store_true")
            p.add_argument("--report")
    return cli


def main():
    args = parser().parse_args()
    try:
        root = Path(args.project_root).resolve()
        require(root.is_dir(), "Project root must exist")
        profile = load_json(input_file(root, args.profile))
        require(profile.get("schemaVersion") == 1, "Unsupported profile schema")
        if args.operation == "inspect":
            facts = inspect_image(input_file(root, args.source))
            result = {"measurements": facts, "checks": conformance(facts, spec_for(profile, args.asset).get("master", {})) if args.asset else []}
        else:
            result = globals()[args.operation](root, profile, args)
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return 1 if args.operation == "audit" and result["findings"] else 0
    except (ValueError, OSError, KeyError, TypeError) as exc:
        print(json.dumps({"error": str(exc), "operation": args.operation}, ensure_ascii=False))
        return 2


if __name__ == "__main__":
    sys.exit(main())

"""Read-only adapters for generic and established Remilo approval registries.

These helpers never save a registry or rewrite old approval evidence. The caller
owns approval validation, locking, file staging and atomic commit/recovery.
"""
from __future__ import annotations

from copy import deepcopy
import json
from pathlib import Path
import re
from typing import Any


ADAPTERS = {"generic", "remilo-scenes", "remilo-brand"}
ID_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def bounded_path(root: Path, value: str) -> Path:
    """Resolve an explicit resource path, including symlinks, under root."""
    if not isinstance(value, str) or not value or "\x00" in value:
        raise ValueError("Resource path must be a nonempty string")
    base = Path(root).resolve()
    supplied = Path(value)
    resolved = (supplied if supplied.is_absolute() else base / supplied).resolve()
    if not resolved.is_relative_to(base) or resolved == base:
        raise ValueError(f"Resource path escapes project root: {value}")
    return resolved


def _configurations(profile: dict) -> list[dict]:
    values = profile.get("registries", [])
    if not isinstance(values, list):
        raise ValueError("Profile registries must be a list")
    keys: set[str] = set()
    for value in values:
        if not isinstance(value, dict) or not isinstance(value.get("key"), str):
            raise ValueError("Each registry requires a string key")
        if value["key"] in keys:
            raise ValueError(f"Duplicate registry key: {value['key']}")
        keys.add(value["key"])
        if value.get("adapter", "generic") not in ADAPTERS:
            raise ValueError(f"Unsupported registry adapter: {value.get('adapter')}")
    return values


def load_registry(root: Path, config: dict) -> dict:
    adapter = config.get("adapter", "generic")
    if adapter not in ADAPTERS:
        raise ValueError(f"Unsupported registry adapter: {adapter}")
    filename = bounded_path(root, config.get("file"))
    if not filename.exists():
        if adapter == "generic":
            return {"schemaVersion": 1, "assets": []}
        raise ValueError(f"Established registry is missing: {filename}")
    try:
        document = json.loads(filename.read_text(encoding="utf-8-sig"))
    except (OSError, ValueError) as error:
        raise ValueError(f"Cannot read registry {filename}: {error}") from error
    field = {"generic": "assets", "remilo-scenes": "scenes", "remilo-brand": "exports"}[adapter]
    if not isinstance(document, dict) or not isinstance(document.get(field), list):
        raise ValueError(f"Registry must contain a {field} list: {filename}")
    return document


def _resource(root: Path, value: Any, role: str | None = None) -> dict | None:
    if value is None:
        return None
    if isinstance(value, str):
        value = {"path": value}
    if not isinstance(value, dict):
        raise ValueError("Recorded resource must be an object or path string")
    item = deepcopy(value)
    filename = item.get("path", item.get("localArtifactPath"))
    if filename is None:
        raise ValueError("Recorded resource requires path or localArtifactPath")
    bounded_path(root, filename)
    if role is not None:
        item["role"] = role
    return item


def _limits(entry: dict, document: dict, source: dict | None) -> list:
    # Preserve recorded failures; do not infer that artwork approval waived them.
    values = deepcopy(entry.get("technicalLimitations", []))
    if not isinstance(values, list):
        values = [values]
    if entry.get("masterResolutionRequirementMet") is False or (source or {}).get("masterResolutionRequirementMet") is False:
        values.append("Recorded master resolution requirement remains unmet; approval is not a dimensional waiver.")
    contract = document.get("masterContract", {})
    if source and contract.get("width") and contract.get("height"):
        actual = (source.get("width"), source.get("height"))
        required = (contract["width"], contract["height"])
        if None not in actual and actual != required:
            values.append(f"Recorded source dimensions {actual[0]} x {actual[1]} differ from master contract {required[0]} x {required[1]}.")
    return values


def _files(root: Path, values: Any) -> list[dict]:
    if not isinstance(values, list):
        raise ValueError("Recorded files must be a list")
    resources = [_resource(root, value) for value in values]
    if any(value is None for value in resources):
        raise ValueError("Recorded files cannot contain null resources")
    return resources


def _entry(root: Path, config: dict, document: dict, item: dict, asset_id: str, historical: bool) -> dict | None:
    if not item.get("approval"):
        return None
    adapter = config.get("adapter", "generic")
    source = None
    files: list[dict] = []
    if adapter == "remilo-scenes":
        source = _resource(root, item.get("approvedMaster"), "source")
        for field, role in (("approvedMaster", "source"), ("runtimeExport", "runtime"), ("nativeExport", "native")):
            resource = _resource(root, item.get(field), role)
            if resource:
                files.append(resource)
    elif adapter == "remilo-brand":
        source = _resource(root, item.get("approvedSource", document.get("source")), "source")
        files = _files(root, item.get("productionFiles", []))
        files.extend(_files(root, item.get("approvedSources", [])))
        if source:
            files.insert(0, deepcopy(source))
    else:
        source = _resource(root, item.get("source"), "source")
        files = _files(root, item.get("files", []))
        if source and not any(value.get("path") == source.get("path") for value in files):
            files.insert(0, deepcopy(source))
    version = item.get("version", item.get("activeVersion", 1))
    if not isinstance(version, int) or isinstance(version, bool) or version < 1:
        raise ValueError(f"Invalid recorded version for {asset_id}")
    return {
        "assetId": asset_id, "version": version,
        "approval": _resource(root, item["approval"]), "files": files, "source": source,
        "cropPolicy": deepcopy(item.get("cropPolicy", {})),
        "technicalLimitations": _limits(item, document, source),
        "adapter": adapter, "registryFile": config["file"], "registryKey": config["key"],
        "historical": historical,
    }


def normalized_entries(root: Path, profile: dict) -> list[dict]:
    """Normalize active and historical approved versions without changing evidence.

    Configured historical registries (e.g. immutable snapshots) are read-only.
    Mutable registry paths are never substituted for a recorded snapshot.
    """
    result = []
    for config in _configurations(profile):
        document = load_registry(root, config)
        adapter = config.get("adapter", "generic")
        field = {"generic": "assets", "remilo-scenes": "scenes", "remilo-brand": "exports"}[adapter]
        for item in document[field]:
            if not isinstance(item, dict):
                raise ValueError("Registry entries must be objects")
            asset_id = item.get("id", item.get("assetId"))
            if not isinstance(asset_id, str) or not ID_PATTERN.fullmatch(asset_id):
                raise ValueError(f"Invalid recorded asset ID: {asset_id}")
            active = _entry(root, config, document, item, asset_id, bool(config.get("historical", False)))
            if active:
                result.append(active)
            history = item.get("approvedVersionHistory", item.get("history", []))
            if not isinstance(history, list):
                raise ValueError(f"Invalid history for {asset_id}")
            for old in history:
                if not isinstance(old, dict):
                    raise ValueError(f"Invalid historical entry for {asset_id}")
                normalized = _entry(root, config, document, old, asset_id, True)
                if normalized:
                    result.append(normalized)
    return result


def _asset_spec(profile: dict, asset_id: str) -> dict:
    assets = profile.get("assets", {})
    if isinstance(assets, dict):
        value = assets.get(asset_id)
    elif isinstance(assets, list):
        matches = [value for value in assets if value.get("id", value.get("assetId")) == asset_id]
        if len(matches) > 1:
            raise ValueError(f"Duplicate asset configuration: {asset_id}")
        value = matches[0] if matches else None
    else:
        raise ValueError("Profile assets must be an object or list")
    if not isinstance(value, dict):
        raise ValueError(f"No configured asset: {asset_id}")
    return value


def _version(item: dict) -> int:
    return item.get("activeVersion", item.get("version", 1)) if item.get("approval") else 0


def build_registry_update(root: Path, profile: dict, assetId: str, version: int,
                          prepared: dict, review: dict, approval_resource: dict,
                          files: list) -> tuple[Path, dict]:
    """Build a nonmutating next-version registry document for the transaction owner."""
    if not isinstance(assetId, str) or not ID_PATTERN.fullmatch(assetId):
        raise ValueError("Asset ID must contain lowercase words/digits separated by hyphens")
    if not isinstance(version, int) or isinstance(version, bool) or version < 1:
        raise ValueError("Version must be a positive integer")
    spec = _asset_spec(profile, assetId)
    matches = [value for value in _configurations(profile) if value["key"] == spec.get("registry")]
    if len(matches) != 1:
        raise ValueError(f"Asset registry configuration missing: {assetId}")
    config = matches[0]
    if config.get("historical"):
        raise ValueError("Historical registry snapshots are read-only")
    document = deepcopy(load_registry(root, config))
    adapter = config.get("adapter", "generic")
    field = {"generic": "assets", "remilo-scenes": "scenes", "remilo-brand": "exports"}[adapter]
    if any(not isinstance(value, dict) for value in document[field]):
        raise ValueError("Registry entries must be objects")
    existing = [value for value in document[field] if value.get("id", value.get("assetId")) == assetId]
    if len(existing) > 1:
        raise ValueError(f"Duplicate registry asset: {assetId}")
    if existing:
        item = existing[0]
    else:
        item = {"assetId" if adapter == "generic" else "id": assetId}
        document[field].append(item)
    active_version = _version(item)
    if not isinstance(active_version, int) or isinstance(active_version, bool) or version != active_version + 1:
        raise ValueError(f"Version must advance by one from {active_version} for {assetId}")
    if prepared.get("assetId") != assetId:
        raise ValueError("Prepared record asset does not match promotion asset")
    approval = _resource(root, approval_resource)
    if not approval:
        raise ValueError("Promotion requires approval evidence")
    final_files = _files(root, files)
    sources = [value for value in final_files if value.get("role") == "source"]
    if len(sources) != 1:
        raise ValueError("Promotion requires exactly one preserved source file")
    source = sources[0]
    history_field = "history" if adapter == "generic" else "approvedVersionHistory"
    if item.get("approval"):
        old = deepcopy(item)
        old.pop(history_field, None)
        old["version"] = active_version
        if adapter == "remilo-brand" and "approvedSource" not in old and document.get("source"):
            old["approvedSource"] = deepcopy(document["source"])
        item.setdefault(history_field, []).append(old)
    policy = deepcopy(review.get("cropPolicy", {}))
    if not policy:
        policy = {"sourceProfiles": deepcopy(review.get("sourceProfiles", review.get("cropProfiles", {}))),
                  "exportProfiles": deepcopy(review.get("exportProfiles", {}))}
    item["approval"] = approval
    item["activeVersion"] = version
    item["reviewCandidate"] = prepared.get("candidate")
    item["cropPolicy"] = policy
    failures = [deepcopy(value) for value in prepared.get("checks", []) if value.get("status") in ("fail", "failed", "unmet")]
    item["technicalLimitations"] = failures
    if adapter == "remilo-scenes":
        item["approvedMaster"] = source
        for role, name in (("runtime", "runtimeExport"), ("native", "nativeExport")):
            matches = [value for value in final_files if value.get("role") == role]
            if len(matches) != 1:
                raise ValueError(f"Scenery promotion requires exactly one {role} file")
            item[name] = matches[0]
        # This is factual conformance, not an approval/exception switch.
        master_contract = document.get("masterContract", {})
        if master_contract.get("width") and master_contract.get("height"):
            met = (source.get("width"), source.get("height")) == (master_contract["width"], master_contract["height"])
            item["masterResolutionRequirementMet"] = met
            item["approvedMaster"]["masterResolutionRequirementMet"] = met
    elif adapter == "remilo-brand":
        item["approvedSource"] = source
        item["productionFiles"] = [value for value in final_files if value.get("role") != "source"]
    else:
        item["version"] = version
        item["source"] = source
        item["files"] = final_files
    for key in ("preparedRecord", "reviewRecord"):
        record = prepared.get(key) if key == "preparedRecord" else review.get(key)
        if record is not None:
            item[key] = _resource(root, record)
    return bounded_path(root, config["file"]), document

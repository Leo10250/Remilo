"""Add public Google OAuth configuration to an unsigned Remilo test IPA."""

import argparse
from copy import copy
from pathlib import Path
import plistlib
import re
from shutil import copyfileobj
import stat
import zipfile


APP_ROOT = "Payload/Remilo.app"
INFO_PLIST = f"{APP_ROOT}/Info.plist"
EXECUTABLE = f"{APP_ROOT}/Remilo"
ORIGINAL_BUNDLE_ID = "com.remilo.app"
CLIENT_KEY = "GIDClientID"
BUNDLE_KEY = "RemiloGoogleCalendarBundleIdentifier"
URL_TYPES_KEY = "CFBundleURLTypes"
URL_SCHEMES_KEY = "CFBundleURLSchemes"


def read_app_info(archive):
    names = set()
    for entry in archive.infolist():
        name = entry.filename[:-1] if entry.is_dir() else entry.filename
        parts = name.split("/")
        folded = name.casefold()
        if (entry.filename != entry.orig_filename or "\\" in name
                or any(part in ("", ".", "..") for part in parts) or folded in names
                or (name != "Payload" and name != APP_ROOT and not name.startswith(f"{APP_ROOT}/"))
                or (name in ("Payload", APP_ROOT) and not entry.is_dir())
                or entry.flag_bits & 1):
            raise ValueError("Expected the standard app-only Remilo IPA layout with unique unencrypted entries.")
        names.add(folded)
        if len(parts) >= 3 and parts[2].casefold() in ("_codesignature", "embedded.mobileprovision", "coderesources"):
            raise ValueError("The host app contains packaged code signing material. Use the unsigned IPA from CI.")
        if any(part.casefold().endswith((".app", ".appex")) for part in parts[2:]):
            raise ValueError("Use the standard Remilo IPA without embedded apps or extensions.")

    for path in (INFO_PLIST, EXECUTABLE, f"{APP_ROOT}/main.jsbundle"):
        try:
            entry = archive.getinfo(path)
        except KeyError as error:
            raise ValueError(f"The input is missing {path}.") from error
        kind = stat.S_IFMT(entry.external_attr >> 16)
        if not entry.file_size or entry.is_dir() or kind not in (0, stat.S_IFREG):
            raise ValueError(f"Expected a regular, nonempty {path}.")

    data = archive.read(INFO_PLIST)
    info = plistlib.loads(data)
    if (not isinstance(info, dict) or info.get("CFBundleIdentifier") != ORIGINAL_BUNDLE_ID
            or info.get("CFBundleExecutable") != "Remilo" or info.get("DTPlatformName") != "iphoneos"
            or info.get("CFBundlePackageType") != "APPL"):
        raise ValueError("Expected the standard unsigned Remilo app for an iPhone or iPad.")
    return info, plistlib.FMT_BINARY if data.startswith(b"bplist00") else plistlib.FMT_XML


def update_app_info(info, bundle_id, client_id):
    scheme = ".".join(reversed(client_id.split(".")))
    for key, value in ((CLIENT_KEY, client_id), (BUNDLE_KEY, bundle_id)):
        if key in info and info[key] != value:
            raise ValueError(f"The input already has a different {key}. Use the original unconfigured IPA.")
        info[key] = value

    url_types = info.setdefault(URL_TYPES_KEY, [])
    if not isinstance(url_types, list):
        raise ValueError(f"Expected an array in {URL_TYPES_KEY}.")
    schemes = []
    for url_type in url_types:
        if not isinstance(url_type, dict):
            raise ValueError(f"Expected dictionaries in {URL_TYPES_KEY}.")
        entry_schemes = url_type.get(URL_SCHEMES_KEY)
        if not isinstance(entry_schemes, list) or any(not isinstance(item, str) for item in entry_schemes):
            raise ValueError(f"Expected a string array in {URL_SCHEMES_KEY}.")
        schemes.extend(entry_schemes)
    if scheme not in schemes:
        url_types.append({URL_SCHEMES_KEY: [scheme]})


def configure(source, destination, bundle_id, client_id):
    if source.suffix.lower() != ".ipa" or destination.suffix.lower() != ".ipa":
        raise ValueError("Use .ipa paths for both the input and output.")
    if len(bundle_id) > 255 or not re.fullmatch(r"[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+", bundle_id):
        raise ValueError("Enter the actual installed Remilo bundle identifier from the device.")
    if len(client_id) > 255 or not re.fullmatch(r"[A-Za-z0-9-]+\.apps\.googleusercontent\.com", client_id):
        raise ValueError("Enter an iOS OAuth client ID ending in .apps.googleusercontent.com.")

    with zipfile.ZipFile(source) as original:
        info, plist_format = read_app_info(original)
        update_app_info(info, bundle_id, client_id)
        new_plist = plistlib.dumps(info, fmt=plist_format, sort_keys=False)
        # Open exclusively before cleanup is armed so failure can never remove an existing file.
        output = destination.open("x+b")
        try:
            with output:
                with zipfile.ZipFile(output, "w") as configured:
                    configured.comment = original.comment
                    for member in original.infolist():
                        entry = copy(member)
                        if member.filename == INFO_PLIST:
                            configured.writestr(entry, new_plist)
                        else:
                            with original.open(member) as source_entry, configured.open(entry, "w") as output_entry:
                                copyfileobj(source_entry, output_entry)
                        entry.external_attr = member.external_attr
                with zipfile.ZipFile(output) as configured:
                    if configured.testzip() is not None or configured.read(INFO_PLIST) != new_plist:
                        raise ValueError("The configured IPA failed verification.")
        except BaseException:
            destination.unlink(missing_ok=True)
            raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path, help="standard unsigned Remilo IPA from CI")
    parser.add_argument("output", type=Path, help="new IPA path that does not exist")
    parser.add_argument("--bundle-id", required=True, help="actual installed Remilo bundle identifier")
    parser.add_argument("--client-id", required=True, help="Google OAuth iOS client ID for that bundle identifier")
    args = parser.parse_args()
    try:
        configure(args.input, args.output, args.bundle_id, args.client_id)
    except (OSError, ValueError, zipfile.BadZipFile, RuntimeError, plistlib.InvalidFileException) as error:
        parser.exit(1, f"Could not configure the IPA. {error}\n")
    print(f"Created unsigned test IPA at {args.output}.")


if __name__ == "__main__":
    main()

"""Exercise the test IPA helper without Xcode, signing or a real Google client."""

from pathlib import Path
import plistlib
import stat
import struct
import subprocess
import sys
from tempfile import TemporaryDirectory
import unittest
import zipfile


HELPER = Path(__file__).resolve().parents[2] / "scripts" / "configure-ios-test-ipa.py"
APP_ROOT = "Payload/Remilo.app"
INFO_PLIST = f"{APP_ROOT}/Info.plist"
BUNDLE_ID = "com.remilo.app.FIXTURE"
CLIENT_ID = "123-fixture.apps.googleusercontent.com"
URL_SCHEME = "com.googleusercontent.apps.123-fixture"
BASE_INFO = {
    "CFBundleIdentifier": "com.remilo.app",
    "CFBundleExecutable": "Remilo",
    "CFBundlePackageType": "APPL",
    "DTPlatformName": "iphoneos",
    "CFBundleURLTypes": [{"CFBundleURLName": "remilo", "CFBundleURLSchemes": ["remilo", "exp+remilo"]}],
    "UnrelatedValue": {"items": [1, False]},
}


def make_archive(path, *, info=BASE_INFO, fmt=plistlib.FMT_BINARY, extra=None):
    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.comment = b"fixture"
        archive.writestr("Payload/", b"")
        archive.writestr(f"{APP_ROOT}/", b"")
        archive.writestr(INFO_PLIST, plistlib.dumps(info, fmt=fmt))
        executable = zipfile.ZipInfo(f"{APP_ROOT}/Remilo")
        executable.create_system = 3
        executable.external_attr = (stat.S_IFREG | 0o755) << 16
        archive.writestr(executable, b"executable bytes")
        archive.writestr(f"{APP_ROOT}/main.jsbundle", b"bundle bytes")
        symlink = zipfile.ZipInfo(f"{APP_ROOT}/link")
        symlink.create_system = 3
        symlink.external_attr = (stat.S_IFLNK | 0o777) << 16
        archive.writestr(symlink, b"main.jsbundle")
        if extra:
            archive.writestr(extra, b"unexpected")


class ConfigureIPAChecks(unittest.TestCase):
    def setUp(self):
        temporary = TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.source = Path(temporary.name) / "unsigned.ipa"
        self.destination = Path(temporary.name) / "configured.ipa"

    def run_helper(self, *, bundle_id=BUNDLE_ID, client_id=CLIENT_ID, destination=None):
        return subprocess.run(
            [sys.executable, str(HELPER), str(self.source), str(destination or self.destination),
             "--bundle-id", bundle_id, "--client-id", client_id],
            capture_output=True, text=True, check=False,
        )

    def test_configuration_changes_only_info_plist(self):
        make_archive(self.source, extra=f"{APP_ROOT}/Frameworks/Vendor.framework/_CodeSignature/CodeResources")
        original_bytes = self.source.read_bytes()
        run = self.run_helper()
        self.assertEqual(run.returncode, 0, run.stderr)
        self.assertEqual(self.source.read_bytes(), original_bytes)
        with zipfile.ZipFile(self.source) as original, zipfile.ZipFile(self.destination) as configured:
            self.assertIsNone(configured.testzip())
            self.assertEqual(original.namelist(), configured.namelist())
            self.assertEqual(original.comment, configured.comment)
            for name in original.namelist():
                before, after = original.getinfo(name), configured.getinfo(name)
                self.assertEqual(before.external_attr, after.external_attr)
                self.assertEqual(before.create_system, after.create_system)
                self.assertEqual(before.date_time, after.date_time)
                if name != INFO_PLIST:
                    self.assertEqual(original.read(name), configured.read(name))
            data = configured.read(INFO_PLIST)
            self.assertTrue(data.startswith(b"bplist00"))
            self.assertEqual(plistlib.loads(data), {
                **BASE_INFO, "GIDClientID": CLIENT_ID,
                "RemiloGoogleCalendarBundleIdentifier": BUNDLE_ID,
                "CFBundleURLTypes": BASE_INFO["CFBundleURLTypes"] + [{"CFBundleURLSchemes": [URL_SCHEME]}],
            })

    def test_existing_scheme_is_preserved(self):
        info = {**BASE_INFO, "CFBundleURLTypes": [{"CFBundleURLSchemes": ["remilo", URL_SCHEME]}]}
        make_archive(self.source, info=info, fmt=plistlib.FMT_XML)
        run = self.run_helper()
        self.assertEqual(run.returncode, 0, run.stderr)
        with zipfile.ZipFile(self.destination) as configured:
            data = configured.read(INFO_PLIST)
            self.assertTrue(data.startswith(b"<?xml"))
            self.assertEqual(plistlib.loads(data)["CFBundleURLTypes"], info["CFBundleURLTypes"])

    def test_rejects_signed_and_nonstandard_archives(self):
        for extra in (f"{APP_ROOT}/_CodeSignature/CodeResources", f"{APP_ROOT}/embedded.mobileprovision",
                      f"{APP_ROOT}/PlugIns/RemiloWidgets.appex/Info.plist", "Payload/Other.app/Info.plist",
                      f"{APP_ROOT}/INFO.PLIST", f"{APP_ROOT}/../Info.plist"):
            with self.subTest(extra=extra):
                make_archive(self.source, extra=extra)
                self.assertNotEqual(self.run_helper().returncode, 0)
                self.assertFalse(self.destination.exists())

    def test_rejects_incorrect_identity_and_malformed_configuration(self):
        for info in ({**BASE_INFO, "CFBundleIdentifier": "other.app"}, {**BASE_INFO, "DTPlatformName": "iphonesimulator"},
                     {**BASE_INFO, "CFBundleURLTypes": ["remilo"]}, {**BASE_INFO, "GIDClientID": "another-client"}):
            with self.subTest(info=info):
                make_archive(self.source, info=info)
                self.assertNotEqual(self.run_helper().returncode, 0)
                self.assertFalse(self.destination.exists())
        make_archive(self.source)
        self.assertNotEqual(self.run_helper(client_id="secret-or-wrong-id").returncode, 0)
        self.assertNotEqual(self.run_helper(bundle_id="unexpected/format").returncode, 0)
        self.assertFalse(self.destination.exists())

    def test_never_overwrites_input_or_existing_output(self):
        make_archive(self.source)
        original = self.source.read_bytes()
        self.destination.write_bytes(b"existing")
        self.assertNotEqual(self.run_helper().returncode, 0)
        self.assertNotEqual(self.run_helper(destination=self.source).returncode, 0)
        self.assertEqual(self.source.read_bytes(), original)
        self.assertEqual(self.destination.read_bytes(), b"existing")

    def test_failed_archive_copy_removes_partial_output(self):
        make_archive(self.source)
        with zipfile.ZipFile(self.source) as original:
            offset = original.getinfo(f"{APP_ROOT}/link").header_offset
        damaged = bytearray(self.source.read_bytes())
        name_length, extra_length = struct.unpack_from("<HH", damaged, offset + 26)
        damaged[offset + 30 + name_length + extra_length] ^= 1
        self.source.write_bytes(damaged)
        self.assertNotEqual(self.run_helper().returncode, 0)
        self.assertFalse(self.destination.exists())


if __name__ == "__main__":
    unittest.main()

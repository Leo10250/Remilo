#!/bin/sh
set -eu

cd "$(dirname "$0")/../.."
pod_sources=ios/Pods/ZIPFoundation/Sources/ZIPFoundation
test -f "$pod_sources/Archive.swift"
build_dir="$(mktemp -d)"
trap 'rm -f "$build_dir/checks" "$build_dir"/ZIPFoundation.* "$build_dir/libZIPFoundation.dylib"; rmdir "$build_dir"' EXIT
xcrun swiftc -swift-version 5 -module-name ZIPFoundation -emit-module -emit-library \
  -emit-module-path "$build_dir/ZIPFoundation.swiftmodule" -o "$build_dir/libZIPFoundation.dylib" \
  "$pod_sources"/*.swift
xcrun swiftc -swift-version 5 -I "$build_dir" -L "$build_dir" -lZIPFoundation -o "$build_dir/checks" \
  modules/remilo-alarm/ios/RemiloIOSPortableArchive.swift \
  modules/remilo-alarm/ios/RemiloIOSPortableContent.swift \
  modules/remilo-alarm/ios/RemiloIOSPortableRoutines.swift \
  modules/remilo-alarm/ios/RemiloIOSStore.swift \
  modules/remilo-alarm/ios/RemiloIOSProjection.swift \
  modules/remilo-alarm/ios/RemiloIOSSeries.swift \
  modules/remilo-alarm/ios/RemiloIOSRecurrence.swift \
  modules/remilo-alarm/ios/RemiloIOSTime.swift \
  modules/remilo-alarm/ios/RemiloIOSRoutine.swift \
  modules/remilo-alarm/ios/RemiloIOSRoutineAuthoring.swift \
  verification/ios-archive/ArchiveChecks.swift
DYLD_LIBRARY_PATH="$build_dir" "$build_dir/checks"

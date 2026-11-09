#!/bin/sh
set -eu

cd "$(dirname "$0")/../.."
build_dir="$(mktemp -d)"
trap 'rm -f "$build_dir/checks" "$build_dir/recurrence-checks" "$build_dir/coverage-checks"; rmdir "$build_dir"' EXIT
xcrun swiftc -swift-version 5 -o "$build_dir/checks" \
  modules/remilo-alarm/ios/RemiloIOSStore.swift \
  modules/remilo-alarm/ios/RemiloIOSProjection.swift \
  modules/remilo-alarm/ios/RemiloIOSEngine.swift \
  modules/remilo-alarm/ios/RemiloIOSEngineSeries.swift \
  modules/remilo-alarm/ios/RemiloIOSEngineRoutines.swift \
  modules/remilo-alarm/ios/RemiloIOSEnginePortable.swift \
  modules/remilo-alarm/ios/RemiloIOSPortableContent.swift \
  modules/remilo-alarm/ios/RemiloIOSPortableRoutines.swift \
  modules/remilo-alarm/ios/RemiloIOSRecurrence.swift \
  modules/remilo-alarm/ios/RemiloIOSRoutine.swift \
  modules/remilo-alarm/ios/RemiloIOSRoutineAuthoring.swift \
  modules/remilo-alarm/ios/RemiloIOSSeries.swift \
  modules/remilo-alarm/ios/RemiloIOSTime.swift \
  verification/ios-engine/EngineChecks.swift
"$build_dir/checks"
xcrun swiftc -swift-version 5 -parse-as-library -o "$build_dir/recurrence-checks" \
  modules/remilo-alarm/ios/RemiloIOSTime.swift \
  modules/remilo-alarm/ios/RemiloIOSRecurrence.swift \
  verification/ios-engine/RemiloIOSRecurrenceTests.swift
"$build_dir/recurrence-checks"
xcrun swiftc -swift-version 5 -parse-as-library -o "$build_dir/coverage-checks" \
  modules/remilo-alarm/ios/RemiloIOSCoverage.swift \
  verification/ios-engine/IOSCoverageChecks.swift
"$build_dir/coverage-checks"

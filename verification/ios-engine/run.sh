#!/bin/sh
set -eu

cd "$(dirname "$0")/../.."
build_dir="$(mktemp -d)"
trap 'rm -f "$build_dir/checks" "$build_dir/recurrence-checks" "$build_dir/coverage-checks"; rmdir "$build_dir"' EXIT
set --
if [ "${REMILO_WIDGET_FIXTURE:-0}" = 1 ]; then
  set -- -D REMILO_WIDGET_FIXTURE \
    modules/remilo-alarm/ios/WidgetShared/RemiloWidgetSnapshot.swift \
    modules/remilo-alarm/ios/WidgetShared/RemiloWidgetCopy.generated.swift \
    modules/remilo-alarm/ios/WidgetShared/RemiloWidgetDoneAction.swift \
    modules/remilo-alarm/ios/WidgetShared/RemiloWidgetProfileAction.swift \
    modules/remilo-alarm/ios/RemiloIOSWidgetProjection.swift \
    modules/remilo-alarm/ios/RemiloIOSWidgetProfileStore.swift \
    modules/remilo-alarm/ios/RemiloIOSWidgetProfiles.swift \
    verification/ios-engine/WidgetProjectionChecks.swift
fi
xcrun swiftc -swift-version 5 -o "$build_dir/checks" \
  "$@" \
  modules/remilo-alarm/ios/RemiloIOSStore.swift \
  modules/remilo-alarm/ios/RemiloIOSProjection.swift \
  modules/remilo-alarm/ios/RemiloIOSCoverage.swift \
  modules/remilo-alarm/ios/RemiloIOSDeliveryGroup.swift \
  modules/remilo-alarm/ios/RemiloIOSEngine.swift \
  modules/remilo-alarm/ios/RemiloIOSEngineCalendarPublication.swift \
  modules/remilo-alarm/ios/RemiloIOSEngineSeries.swift \
  modules/remilo-alarm/ios/RemiloIOSEngineRoutines.swift \
  modules/remilo-alarm/ios/RemiloIOSEnginePortable.swift \
  modules/remilo-alarm/ios/RemiloIOSPortableContent.swift \
  modules/remilo-alarm/ios/RemiloIOSLegacyBackup.swift \
  modules/remilo-alarm/ios/RemiloIOSPortableRoutines.swift \
  modules/remilo-alarm/ios/RemiloIOSRecurrence.swift \
  modules/remilo-alarm/ios/RemiloIOSRoutine.swift \
  modules/remilo-alarm/ios/RemiloIOSRoutineAlarm.swift \
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

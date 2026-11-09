#!/bin/sh
set -eu

cd "$(dirname "$0")/../.."
build_dir="$(mktemp -d)"
trap 'rm -f "$build_dir/checks"; rmdir "$build_dir"' EXIT
xcrun swiftc -swift-version 5 -parse-as-library -o "$build_dir/checks" \
  modules/remilo-alarm/ios/RemiloIOSGoogleCalendarHTTP.swift \
  modules/remilo-alarm/ios/RemiloIOSGoogleCalendarAuthorization.swift \
  modules/remilo-alarm/ios/RemiloIOSGoogleCalendarOAuth.swift \
  modules/remilo-alarm/ios/RemiloIOSGoogleCalendarTransport.swift \
  modules/remilo-alarm/ios/RemiloIOSGoogleCalendarStore.swift \
  modules/remilo-alarm/ios/RemiloIOSGoogleCalendarConnection.swift \
  modules/remilo-alarm/ios/RemiloIOSGoogleCalendarEvent.swift \
  modules/remilo-alarm/ios/RemiloIOSGoogleCalendarRule.swift \
  modules/remilo-alarm/ios/RemiloIOSRecurrence.swift \
  modules/remilo-alarm/ios/RemiloIOSTime.swift \
  verification/ios-calendar/CalendarChecks.swift \
  verification/ios-calendar/ConnectionChecks.swift \
  verification/ios-calendar/EventChecks.swift
"$build_dir/checks"

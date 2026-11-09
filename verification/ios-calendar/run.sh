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
  modules/remilo-alarm/ios/RemiloIOSGoogleCalendarManagedDiscovery.swift \
  modules/remilo-alarm/ios/RemiloIOSGoogleCalendarManagedSetupJournal.swift \
  modules/remilo-alarm/ios/RemiloIOSGoogleCalendarManagedSetup.swift \
  modules/remilo-alarm/ios/RemiloIOSGoogleCalendarConnection.swift \
  modules/remilo-alarm/ios/RemiloIOSGoogleCalendarRuntime.swift \
  modules/remilo-alarm/ios/RemiloIOSGoogleCalendarEvent.swift \
  modules/remilo-alarm/ios/RemiloIOSGoogleCalendarComparison.swift \
  modules/remilo-alarm/ios/RemiloIOSGoogleCalendarManualLink.swift \
  modules/remilo-alarm/ios/RemiloIOSGoogleCalendarManualLinkStore.swift \
  modules/remilo-alarm/ios/RemiloIOSGoogleCalendarManualLinkRuntime.swift \
  modules/remilo-alarm/ios/RemiloIOSGoogleCalendarRule.swift \
  modules/remilo-alarm/ios/RemiloIOSGoogleCalendarRecurringReview.swift \
  modules/remilo-alarm/ios/RemiloIOSGoogleCalendarPublication.swift \
  modules/remilo-alarm/ios/RemiloIOSGoogleCalendarPublicationJournal.swift \
  modules/remilo-alarm/ios/RemiloIOSGoogleCalendarPublicationRuntime.swift \
  modules/remilo-alarm/ios/RemiloIOSGoogleCalendarWriteTransport.swift \
  modules/remilo-alarm/ios/RemiloIOSGoogleCalendarImport.swift \
  modules/remilo-alarm/ios/RemiloIOSGoogleCalendarImportJournal.swift \
  modules/remilo-alarm/ios/RemiloIOSRecurrence.swift \
  modules/remilo-alarm/ios/RemiloIOSTime.swift \
  verification/ios-calendar/CalendarChecks.swift \
  verification/ios-calendar/ConnectionChecks.swift \
  verification/ios-calendar/ManagedDiscoveryChecks.swift \
  verification/ios-calendar/ManagedSetupChecks.swift \
  verification/ios-calendar/ManagedCreationChecks.swift \
  verification/ios-calendar/RuntimeChecks.swift \
  verification/ios-calendar/EventChecks.swift \
  verification/ios-calendar/RecurringReviewChecks.swift \
  verification/ios-calendar/ComparisonChecks.swift \
  verification/ios-calendar/ManualLinkStoreChecks.swift \
  verification/ios-calendar/PublicationChecks.swift \
  verification/ios-calendar/ImportChecks.swift
"$build_dir/checks"

package com.remilo.alarm.calendar

import androidx.sqlite.db.SupportSQLiteDatabase

/** Calendar-only CE migration; it does not authorize work or inspect the network. */
object CalendarManagedSchema {
  fun create(db: SupportSQLiteDatabase) {
    for (column in listOf("imported", "published", "adopted", "deferred", "excluded", "review"))
      db.execSQL("ALTER TABLE calendar_sync_runs ADD COLUMN $column INTEGER NOT NULL DEFAULT 0")
    db.execSQL("CREATE TABLE IF NOT EXISTS calendar_installation_origin (id TEXT NOT NULL PRIMARY KEY, origin TEXT NOT NULL, installationId TEXT NOT NULL)")
    db.execSQL("CREATE TABLE IF NOT EXISTS calendar_managed_binding (id TEXT NOT NULL PRIMARY KEY, revision INTEGER NOT NULL, authEpoch INTEGER NOT NULL, subject TEXT NOT NULL, calendarId TEXT NOT NULL, calendarName TEXT NOT NULL, calendarZone TEXT NOT NULL, mode TEXT NOT NULL, phase TEXT NOT NULL, bootstrapGeneration INTEGER NOT NULL, initialMode TEXT NOT NULL, initialRecoveryComplete INTEGER NOT NULL, lastObservedAtMs INTEGER, operationId TEXT NOT NULL, message TEXT NOT NULL, attemptedAtMs INTEGER, failedAtMs INTEGER)")
    db.execSQL("CREATE TABLE IF NOT EXISTS calendar_managed_policy (id TEXT NOT NULL PRIMARY KEY, revision INTEGER NOT NULL, automaticImport INTEGER NOT NULL, exportNewReminders INTEGER NOT NULL, importMode TEXT NOT NULL, allDayAlarmMinutes INTEGER NOT NULL, disableGoogleReminders INTEGER NOT NULL)")
    db.execSQL("CREATE TABLE IF NOT EXISTS calendar_managed_previews (previewId TEXT NOT NULL PRIMARY KEY, kind TEXT NOT NULL, connectionRevision INTEGER NOT NULL, bindingRevision INTEGER NOT NULL, authEpoch INTEGER NOT NULL, fingerprint TEXT NOT NULL, payload TEXT NOT NULL, createdAtMs INTEGER NOT NULL, expiresAtMs INTEGER NOT NULL)")
    db.execSQL("CREATE TABLE IF NOT EXISTS calendar_managed_operations (operationId TEXT NOT NULL PRIMARY KEY, requestKey TEXT NOT NULL, kind TEXT NOT NULL, subject TEXT NOT NULL, connectionRevision INTEGER NOT NULL, bindingRevision INTEGER NOT NULL, authEpoch INTEGER NOT NULL, policy TEXT NOT NULL, calendarId TEXT NOT NULL, calendarName TEXT NOT NULL, calendarZone TEXT NOT NULL, marker TEXT NOT NULL, phase TEXT NOT NULL, discoveryCursor TEXT NOT NULL, candidates TEXT NOT NULL, discoveryComplete INTEGER NOT NULL, attempted INTEGER NOT NULL, resultCalendarId TEXT NOT NULL, message TEXT NOT NULL, createdAtMs INTEGER NOT NULL, reviewedItems TEXT NOT NULL, retryAtMs INTEGER NOT NULL, failures INTEGER NOT NULL)")
    db.execSQL("CREATE TABLE IF NOT EXISTS calendar_managed_candidates (candidateId TEXT NOT NULL PRIMARY KEY, remoteKey TEXT NOT NULL, subject TEXT NOT NULL, calendarId TEXT NOT NULL, eventId TEXT NOT NULL, localId TEXT NOT NULL, generation INTEGER NOT NULL, mode TEXT NOT NULL, fingerprint TEXT NOT NULL, event TEXT NOT NULL, title TEXT NOT NULL, revision INTEGER NOT NULL, state TEXT NOT NULL, reason TEXT NOT NULL, operationId TEXT NOT NULL, authEpoch INTEGER NOT NULL, policyRevision INTEGER NOT NULL, policySnapshot TEXT NOT NULL, automatic INTEGER NOT NULL, audit TEXT NOT NULL, observedAtMs INTEGER NOT NULL, retryAtMs INTEGER NOT NULL, failures INTEGER NOT NULL)")
    db.execSQL("CREATE UNIQUE INDEX IF NOT EXISTS index_calendar_managed_candidates_remoteKey ON calendar_managed_candidates(remoteKey)")
    db.execSQL("CREATE TABLE IF NOT EXISTS calendar_managed_cache (subject TEXT NOT NULL, calendarId TEXT NOT NULL, eventId TEXT NOT NULL, generation INTEGER NOT NULL, event TEXT NOT NULL, observedAtMs INTEGER NOT NULL, PRIMARY KEY(subject,calendarId,eventId))")
    db.execSQL("CREATE TABLE IF NOT EXISTS calendar_managed_exports (localId TEXT NOT NULL PRIMARY KEY, subject TEXT NOT NULL, calendarId TEXT NOT NULL, localRevision INTEGER NOT NULL, authEpoch INTEGER NOT NULL, state TEXT NOT NULL, operationId TEXT NOT NULL, reason TEXT NOT NULL, createdAtMs INTEGER NOT NULL, retryAtMs INTEGER NOT NULL, failures INTEGER NOT NULL)")
    db.execSQL("CREATE TABLE IF NOT EXISTS calendar_managed_dispositions (localId TEXT NOT NULL PRIMARY KEY, revision INTEGER NOT NULL, disposition TEXT NOT NULL)")
    db.execSQL("CREATE TABLE IF NOT EXISTS calendar_managed_suppressions (remoteKey TEXT NOT NULL PRIMARY KEY, subject TEXT NOT NULL, calendarId TEXT NOT NULL, eventId TEXT NOT NULL, localId TEXT NOT NULL, reason TEXT NOT NULL, nominalSlot TEXT NOT NULL, createdAtMs INTEGER NOT NULL)")
    db.execSQL("CREATE TABLE IF NOT EXISTS calendar_managed_issues (issueId TEXT NOT NULL PRIMARY KEY, targetKind TEXT NOT NULL, targetId TEXT NOT NULL, reason TEXT NOT NULL, fingerprint TEXT NOT NULL, discoveredAtMs INTEGER NOT NULL, background INTEGER NOT NULL, notifiedFingerprint TEXT NOT NULL)")
    db.execSQL("CREATE TABLE IF NOT EXISTS calendar_managed_receipts (operationId TEXT NOT NULL PRIMARY KEY, kind TEXT NOT NULL, requestKey TEXT NOT NULL, result TEXT NOT NULL)")
    origin(db, "ExistingInstallation")
  }
  fun origin(db: SupportSQLiteDatabase, origin: String) {
    require(origin in setOf("ExistingInstallation", "FreshInstallation"))
    db.execSQL("INSERT OR IGNORE INTO calendar_installation_origin(id,origin,installationId) VALUES ('installation',?,?)", arrayOf(origin, java.util.UUID.randomUUID().toString()))
  }
}

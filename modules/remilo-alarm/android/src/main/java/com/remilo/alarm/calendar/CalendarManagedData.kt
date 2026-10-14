package com.remilo.alarm.calendar

import androidx.room.*

/** Managed Calendar permissions and private recovery records are CE-only. */
@Entity(tableName = "calendar_installation_origin")
data class CalendarInstallationOrigin(@PrimaryKey val id: String = "installation", val origin: String = "FreshInstallation",
  val installationId: String = java.util.UUID.randomUUID().toString())

@Entity(tableName = "calendar_managed_binding")
data class CalendarManagedBinding(@PrimaryKey val id: String = "google", val revision: Long = 1,
  val authEpoch: Long = 0, val subject: String = "", val calendarId: String = "", val calendarName: String = "",
  val calendarZone: String = "", val mode: String = "Disabled", val phase: String = "NotConfigured",
  val bootstrapGeneration: Long = 0, val initialMode: String = "None", val initialRecoveryComplete: Boolean = false,
  val lastObservedAtMs: Long? = null, val operationId: String = "", val message: String = "",
  val attemptedAtMs: Long? = null, val failedAtMs: Long? = null)

@Entity(tableName = "calendar_managed_policy")
data class CalendarManagedPolicy(@PrimaryKey val id: String = "google", val revision: Long = 1,
  val automaticImport: Boolean = true, val exportNewReminders: Boolean = true, val importMode: String = "Alarm",
  val allDayAlarmMinutes: Int = 540, val disableGoogleReminders: Boolean = false)

@Entity(tableName = "calendar_managed_previews")
data class CalendarManagedPreview(@PrimaryKey val previewId: String, val kind: String,
  val connectionRevision: Long, val bindingRevision: Long, val authEpoch: Long,
  val fingerprint: String, val payload: String, val createdAtMs: Long, val expiresAtMs: Long)

@Entity(tableName = "calendar_managed_operations")
data class CalendarManagedSetupOperation(@PrimaryKey val operationId: String, val requestKey: String, val kind: String,
  val subject: String, val connectionRevision: Long, val bindingRevision: Long, val authEpoch: Long,
  val policy: String, val calendarId: String, val calendarName: String, val calendarZone: String, val marker: String,
  val phase: String = "Reviewing", val discoveryCursor: String = "", val candidates: String = "[]",
  val discoveryComplete: Boolean = false, val attempted: Boolean = false, val resultCalendarId: String = "",
  val message: String = "", val createdAtMs: Long, val reviewedItems: String = "[]",
  val retryAtMs: Long = 0, val failures: Int = 0)

@Entity(tableName = "calendar_managed_candidates", indices = [Index(value = ["remoteKey"], unique = true)])
data class CalendarManagedCandidate(@PrimaryKey val candidateId: String, val remoteKey: String, val subject: String,
  val calendarId: String, val eventId: String, val localId: String, val generation: Long, val mode: String,
  val fingerprint: String, val event: String, val title: String, val revision: Long = 1,
  val state: String = "Pending", val reason: String = "", val operationId: String = "", val authEpoch: Long = 0,
  val policyRevision: Long = 0, val policySnapshot: String = "", val automatic: Boolean = true, val audit: String = "", val observedAtMs: Long,
  val retryAtMs: Long = 0, val failures: Int = 0)

@Entity(tableName = "calendar_managed_cache", primaryKeys = ["subject", "calendarId", "eventId"])
data class CalendarManagedCache(val subject: String, val calendarId: String, val eventId: String,
  val generation: Long, val event: String, val observedAtMs: Long)

@Entity(tableName = "calendar_managed_exports")
data class CalendarManagedExport(@PrimaryKey val localId: String, val subject: String, val calendarId: String,
  val localRevision: Long, val authEpoch: Long, val state: String = "Pending", val operationId: String = "",
  val reason: String = "", val createdAtMs: Long, val retryAtMs: Long = 0, val failures: Int = 0)

@Entity(tableName = "calendar_managed_dispositions")
data class CalendarManagedDisposition(@PrimaryKey val localId: String, val revision: Long = 1,
  val disposition: String = "Managed")

@Entity(tableName = "calendar_managed_suppressions")
data class CalendarManagedSuppression(@PrimaryKey val remoteKey: String, val subject: String,
  val calendarId: String, val eventId: String, val localId: String = "", val reason: String,
  val nominalSlot: String = "", val createdAtMs: Long)

@Entity(tableName = "calendar_managed_issues")
data class CalendarManagedIssue(@PrimaryKey val issueId: String, val targetKind: String, val targetId: String,
  val reason: String, val fingerprint: String, val discoveredAtMs: Long, val background: Boolean,
  val notifiedFingerprint: String = "")

@Entity(tableName = "calendar_managed_receipts")
data class CalendarManagedReceipt(@PrimaryKey val operationId: String, val kind: String,
  val requestKey: String, val result: String)

@Dao interface CalendarManagedDao {
  @Query("SELECT * FROM calendar_installation_origin WHERE id = 'installation'") fun installation(): CalendarInstallationOrigin?
  @Insert(onConflict = OnConflictStrategy.IGNORE) fun installation(value: CalendarInstallationOrigin)
  @Query("SELECT * FROM calendar_managed_binding WHERE id = 'google'") fun binding(): CalendarManagedBinding?
  @Insert(onConflict = OnConflictStrategy.REPLACE) fun binding(value: CalendarManagedBinding)
  @Query("SELECT * FROM calendar_managed_policy WHERE id = 'google'") fun policy(): CalendarManagedPolicy?
  @Insert(onConflict = OnConflictStrategy.REPLACE) fun policy(value: CalendarManagedPolicy)
  @Query("SELECT * FROM calendar_managed_previews WHERE previewId = :id") fun preview(id: String): CalendarManagedPreview?
  @Insert fun preview(value: CalendarManagedPreview)
  @Query("DELETE FROM calendar_managed_previews WHERE expiresAtMs < :now") fun expirePreviews(now: Long)
  @Query("DELETE FROM calendar_managed_previews") fun clearPreviews()
  @Query("SELECT * FROM calendar_managed_operations WHERE operationId = :id") fun operation(id: String): CalendarManagedSetupOperation?
  @Query("SELECT * FROM calendar_managed_operations ORDER BY createdAtMs") fun operations(): List<CalendarManagedSetupOperation>
  @Insert fun insert(value: CalendarManagedSetupOperation)
  @Update fun update(value: CalendarManagedSetupOperation)
  @Query("SELECT * FROM calendar_managed_candidates WHERE candidateId = :id") fun candidate(id: String): CalendarManagedCandidate?
  @Query("SELECT * FROM calendar_managed_candidates WHERE remoteKey = :key") fun candidateByKey(key: String): CalendarManagedCandidate?
  @Query("SELECT * FROM calendar_managed_candidates ORDER BY observedAtMs, candidateId") fun candidates(): List<CalendarManagedCandidate>
  @Insert(onConflict = OnConflictStrategy.REPLACE) fun candidate(value: CalendarManagedCandidate)
  @Query("DELETE FROM calendar_managed_candidates WHERE candidateId = :id") fun removeCandidate(id: String)
  @Query("SELECT * FROM calendar_managed_cache WHERE subject = :subject AND calendarId = :calendarId ORDER BY eventId") fun cache(subject: String, calendarId: String): List<CalendarManagedCache>
  @Query("SELECT * FROM calendar_managed_cache WHERE subject = :subject AND calendarId = :calendarId AND eventId = :eventId")
  fun cached(subject: String, calendarId: String, eventId: String): CalendarManagedCache?
  @Insert(onConflict = OnConflictStrategy.REPLACE) fun cache(value: CalendarManagedCache)
  @Query("DELETE FROM calendar_managed_cache WHERE subject = :subject AND calendarId = :calendarId") fun clearCache(subject: String, calendarId: String)
  @Query("DELETE FROM calendar_managed_cache WHERE subject = :subject AND calendarId = :calendarId AND eventId = :eventId") fun removeCache(subject: String, calendarId: String, eventId: String)
  @Query("SELECT * FROM calendar_managed_exports WHERE localId = :id") fun export(id: String): CalendarManagedExport?
  @Query("SELECT * FROM calendar_managed_exports ORDER BY createdAtMs, localId") fun exports(): List<CalendarManagedExport>
  @Insert(onConflict = OnConflictStrategy.REPLACE) fun export(value: CalendarManagedExport)
  @Query("DELETE FROM calendar_managed_exports WHERE localId = :id") fun removeExport(id: String)
  @Query("SELECT * FROM calendar_managed_dispositions WHERE localId = :id") fun disposition(id: String): CalendarManagedDisposition?
  @Insert(onConflict = OnConflictStrategy.REPLACE) fun disposition(value: CalendarManagedDisposition)
  @Query("DELETE FROM calendar_managed_dispositions WHERE localId = :id") fun removeDisposition(id: String)
  @Query("SELECT * FROM calendar_managed_suppressions WHERE remoteKey = :key") fun suppression(key: String): CalendarManagedSuppression?
  @Query("SELECT * FROM calendar_managed_suppressions WHERE localId = :id") fun suppressionsFor(id: String): List<CalendarManagedSuppression>
  @Insert(onConflict = OnConflictStrategy.REPLACE) fun suppression(value: CalendarManagedSuppression)
  @Query("DELETE FROM calendar_managed_suppressions WHERE remoteKey = :key") fun unsuppress(key: String)
  @Query("SELECT * FROM calendar_managed_issues ORDER BY discoveredAtMs, issueId") fun issues(): List<CalendarManagedIssue>
  @Query("SELECT * FROM calendar_managed_issues WHERE issueId = :id") fun issue(id: String): CalendarManagedIssue?
  @Insert(onConflict = OnConflictStrategy.REPLACE) fun issue(value: CalendarManagedIssue)
  @Query("DELETE FROM calendar_managed_issues WHERE issueId = :id") fun resolve(id: String)
  @Query("SELECT * FROM calendar_managed_receipts WHERE operationId = :id") fun receipt(id: String): CalendarManagedReceipt?
  @Insert fun receipt(value: CalendarManagedReceipt)
  @Update fun replaceReceipt(value: CalendarManagedReceipt)
}

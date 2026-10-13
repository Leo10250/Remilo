package com.remilo.alarm.calendar

import androidx.room.*

/** All synchronization authority is CE-only. An absent state means manual permission. */
@Entity(tableName = "calendar_sync_state")
data class CalendarSyncState(@PrimaryKey val associationId: String, val mode: String = "Manual",
  val activationRevision: Long = 0, val baselineVersion: Long = 0, val dirtyRevision: Long = 0,
  val authoredAtMs: Long? = null, val successfulAtMs: Long? = null, val attemptedAtMs: Long? = null,
  val remoteUpdated: String = "", val status: String = "Confirmed", val pauseReason: String = "",
  val operationId: String = "", val retryAtMs: Long = 0, val failures: Int = 0)
@Entity(tableName = "calendar_sync_guards")
data class CalendarSyncGuard(@PrimaryKey val operationId: String, val associationId: String,
  val activationRevision: Long, val baselineVersion: Long, val connectionRevision: Long,
  val localRevision: Long, val localFingerprint: String, val baseline: String, val automatic: Boolean,
  val previousMode: String, val previousStatus: String, val localFields: String)
@Entity(tableName = "calendar_sync_cursors")
data class CalendarSyncCursor(@PrimaryKey val key: String, val subject: String, val calendarId: String,
  val queryVersion: Int = 1, val generation: Long = 1, val syncToken: String = "", val startingToken: String = "",
  val pageToken: String = "", val paging: Boolean = false, val checkedAtMs: Long = 0)
@Entity(tableName = "calendar_sync_cache", primaryKeys = ["associationId", "eventId"])
data class CalendarSyncSnapshot(val associationId: String, val eventId: String, val calendarId: String,
  val generation: Long, val event: String, val pending: Boolean = true)
@Entity(tableName = "calendar_review_issues")
data class CalendarReviewIssue(@PrimaryKey val associationId: String, val reason: String, val fingerprint: String,
  val discoveredAtMs: Long, val background: Boolean, val notifiedFingerprint: String = "")
@Entity(tableName = "calendar_review_preferences")
data class CalendarReviewPreferences(@PrimaryKey val id: String = "calendar", val revision: Long = 1,
  val enabled: Boolean = true, val operationId: String = "")
@Entity(tableName = "calendar_activity")
data class CalendarActivity(@PrimaryKey val checkpoint: String, val associationId: String, val kind: String,
  val groups: String, val occurredAtMs: Long)
@Entity(tableName = "calendar_sync_runs")
data class CalendarSavedRun(@PrimaryKey val id: String = "calendar", val pages: Int, val attempted: Int,
  val confirmed: Int, val continuation: Boolean, val atMs: Long)

@Dao interface CalendarSyncDao {
  @Query("SELECT * FROM calendar_sync_runs WHERE id = 'calendar'") fun run(): CalendarSavedRun?
  @Insert(onConflict = OnConflictStrategy.REPLACE) fun run(value: CalendarSavedRun)
  @Query("SELECT * FROM calendar_sync_state WHERE associationId = :id") fun state(id: String): CalendarSyncState?
  @Query("SELECT * FROM calendar_sync_state ORDER BY attemptedAtMs, associationId") fun states(): List<CalendarSyncState>
  @Insert(onConflict = OnConflictStrategy.REPLACE) fun put(value: CalendarSyncState)
  @Query("SELECT * FROM calendar_sync_guards WHERE operationId = :id") fun guard(id: String): CalendarSyncGuard?
  @Insert fun guard(value: CalendarSyncGuard)
  @Query("SELECT * FROM calendar_sync_cursors WHERE `key` = :key") fun cursor(key: String): CalendarSyncCursor?
  @Query("SELECT * FROM calendar_sync_cursors ORDER BY checkedAtMs, `key`") fun cursors(): List<CalendarSyncCursor>
  @Insert(onConflict = OnConflictStrategy.REPLACE) fun cursor(value: CalendarSyncCursor)
  @Query("SELECT * FROM calendar_sync_cache WHERE associationId = :id") fun snapshots(id: String): List<CalendarSyncSnapshot>
  @Insert(onConflict = OnConflictStrategy.REPLACE) fun snapshot(value: CalendarSyncSnapshot)
  @Query("DELETE FROM calendar_sync_cache WHERE calendarId = :id") fun clearCalendar(id: String)
  @Query("SELECT * FROM calendar_review_issues ORDER BY discoveredAtMs, associationId") fun issues(): List<CalendarReviewIssue>
  @Query("SELECT * FROM calendar_review_issues WHERE associationId = :id") fun issue(id: String): CalendarReviewIssue?
  @Insert(onConflict = OnConflictStrategy.REPLACE) fun issue(value: CalendarReviewIssue)
  @Query("DELETE FROM calendar_review_issues WHERE associationId = :id") fun resolve(id: String)
  @Query("SELECT * FROM calendar_review_preferences WHERE id = 'calendar'") fun preference(): CalendarReviewPreferences?
  @Insert(onConflict = OnConflictStrategy.REPLACE) fun preference(value: CalendarReviewPreferences)
  @Insert(onConflict = OnConflictStrategy.IGNORE) fun activity(value: CalendarActivity)
  @Query("SELECT * FROM calendar_activity WHERE associationId = :id ORDER BY occurredAtMs") fun activity(id: String): List<CalendarActivity>
  @Query("DELETE FROM calendar_activity WHERE associationId = :id") fun purgeActivity(id: String)
  @Query("DELETE FROM calendar_sync_cache WHERE associationId = :id") fun purgeCache(id: String)
  @Query("DELETE FROM calendar_sync_guards WHERE associationId = :id") fun purgeGuards(id: String)
  @Query("DELETE FROM calendar_sync_state WHERE associationId = :id") fun purgeState(id: String)
}

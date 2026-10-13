package com.remilo.alarm.data
import android.content.Context
import androidx.room.*
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase
import com.remilo.alarm.calendar.*

@Entity(tableName = "reminders")
data class ReminderRecord(@PrimaryKey val id: String, val title: String, val eventStartMs: Long,
  val eventEndMs: Long, val dueAtMs: Long, val createdAtMs: Long,
  val completed: Boolean = false, val revision: Long = 1,
  @ColumnInfo(defaultValue = "''") val notes: String = "",
  @ColumnInfo(defaultValue = "''") val listName: String = "",
  @ColumnInfo(defaultValue = "'Alarm'") val mode: String = "Alarm",
  @ColumnInfo(defaultValue = "NULL") val definedAlarmAtMs: Long? = null,
  @ColumnInfo(defaultValue = "0") val allDay: Boolean = false,
  @ColumnInfo(defaultValue = "''") val zoneId: String = "",
  @ColumnInfo(defaultValue = "1") val dueLinked: Boolean = true,
  @ColumnInfo(defaultValue = "1") val alarmLinked: Boolean = true,
  @ColumnInfo(defaultValue = "0") val deleted: Boolean = false,
  @ColumnInfo(defaultValue = "'remilo'") val sound: String = "remilo",
  @ColumnInfo(defaultValue = "0") val vibration: Boolean = false,
  @ColumnInfo(defaultValue = "NULL") val segmentId: String? = null,
  @ColumnInfo(defaultValue = "NULL") val nominalSlot: String? = null,
  @ColumnInfo(defaultValue = "0") val exception: Boolean = false,
  @ColumnInfo(defaultValue = "0") val skipped: Boolean = false,
  @ColumnInfo(defaultValue = "NULL") val listId: String? = null)
@Entity(tableName = "lists", indices = [Index(value = ["normalizedName"])])
data class ListRecord(@PrimaryKey val id: String, val name: String, val normalizedName: String,
  val revision: Long = 1, val createdAtMs: Long)
@Entity(tableName = "series")
data class SeriesRecord(@PrimaryKey val id: String, val seriesId: String, val template: String,
  val rule: String, val revision: Long = 1, val state: String = "Active", val createdAtMs: Long)
@Entity(tableName = "pending_series")
data class PendingSeries(@PrimaryKey val operationId: String, val segmentId: String)
/** Identity only: prevents recovery/old backups from restoring purged content. */
@Entity(tableName = "purged_occurrences")
data class PurgedOccurrence(@PrimaryKey val id: String, val segmentId: String?, val nominalSlot: String?)
@Entity(tableName = "pending_schedules")
data class PendingSchedule(@PrimaryKey val operationId: String, val occurrenceId: String,
  val targetMs: Long, val generation: Long,
  @ColumnInfo(defaultValue = "'Alarm'") val mode: String = "Alarm",
  @ColumnInfo(defaultValue = "'remilo'") val sound: String = "remilo",
  @ColumnInfo(defaultValue = "0") val vibration: Boolean = false,
  @ColumnInfo(defaultValue = "10") val snoozeMinutes: Int = 10,
  @ColumnInfo(defaultValue = "1") val eligible: Boolean = true)
@Entity(tableName = "creation_receipts")
data class CreationReceipt(@PrimaryKey val operationId: String, val occurrenceId: String,
  @ColumnInfo(defaultValue = "'Create'") val kind: String = "Create",
  @ColumnInfo(defaultValue = "NULL") val sourceId: String? = null)
@Entity(tableName = "settings")
data class SettingsRecord(@PrimaryKey val id: String = "app", val revision: Long = 1,
  val snoozeMinutes: Int = 10, val tomorrowMorning: Int = 600,
  val tomorrowAfternoon: Int = 840, val tomorrowEvening: Int = 1020,
  val sound: String = "remilo", val vibration: Boolean = true,
  val theme: String = "system", val lastOperationId: String = "",
  @ColumnInfo(defaultValue = "'automatic'") val atmosphere: String = "automatic")
@Entity(tableName = "history")
data class HistoryRecord(@PrimaryKey val operationId: String, val occurrenceId: String,
  val kind: String, val occurredAtMs: Long, val generation: Long,
  @ColumnInfo(defaultValue = "NULL") val targetMs: Long? = null)
@Dao interface ContentDao {
  @Query("SELECT * FROM reminders ORDER BY eventStartMs") fun all(): List<ReminderRecord>
  @Query("SELECT * FROM reminders WHERE id = :id") fun find(id: String): ReminderRecord?
  @Insert(onConflict = OnConflictStrategy.ABORT) fun insert(record: ReminderRecord)
  @Update fun update(record: ReminderRecord)
  @Query("DELETE FROM reminders WHERE id = :id") fun purgeReminder(id: String)
  @Query("DELETE FROM history WHERE occurrenceId = :id") fun purgeHistory(id: String)
  @Query("DELETE FROM pending_schedules WHERE occurrenceId = :id") fun purgePending(id: String)
  @Query("SELECT * FROM purged_occurrences") fun purged(): List<PurgedOccurrence>
  @Query("SELECT * FROM purged_occurrences WHERE id = :id") fun purged(id: String): PurgedOccurrence?
  @Insert fun purge(record: PurgedOccurrence)
  @Query("SELECT * FROM lists ORDER BY normalizedName, id") fun lists(): List<ListRecord>
  @Query("SELECT * FROM lists WHERE id = :id") fun list(id: String): ListRecord?
  @Insert fun insertList(record: ListRecord)
  @Update fun updateList(record: ListRecord)
  @Query("DELETE FROM lists WHERE id = :id") fun removeList(id: String)
  @Query("SELECT * FROM series ORDER BY createdAtMs") fun series(): List<SeriesRecord>
  @Query("SELECT * FROM series WHERE id = :id") fun series(id: String): SeriesRecord?
  @Insert(onConflict = OnConflictStrategy.REPLACE) fun series(record: SeriesRecord)
  @Insert(onConflict = OnConflictStrategy.REPLACE) fun pendingSeries(record: PendingSeries)
  @Query("SELECT * FROM pending_series") fun pendingSeries(): List<PendingSeries>
  @Query("DELETE FROM pending_series WHERE operationId = :id") fun acknowledgeSeries(id: String)
  @Query("SELECT * FROM settings WHERE id = 'app'") fun settings(): SettingsRecord?
  @Insert(onConflict = OnConflictStrategy.REPLACE) fun settings(record: SettingsRecord)
  @Insert(onConflict = OnConflictStrategy.REPLACE) fun pending(record: PendingSchedule)
  @Query("SELECT * FROM pending_schedules") fun pending(): List<PendingSchedule>
  @Query("DELETE FROM pending_schedules WHERE operationId = :id") fun acknowledge(id: String)
  @Insert fun receipt(record: CreationReceipt)
  @Query("SELECT * FROM creation_receipts WHERE operationId = :id") fun receipt(id: String): CreationReceipt?
  @Insert(onConflict = OnConflictStrategy.IGNORE) fun history(record: HistoryRecord)
  @Query("SELECT * FROM history WHERE occurrenceId = :id ORDER BY occurredAtMs") fun history(id: String): List<HistoryRecord>
  @Query("SELECT * FROM history WHERE kind IN ('Done', 'Skip', 'Delete')") fun collectionHistory(): List<HistoryRecord>
  @Query("SELECT * FROM history WHERE operationId = :id") fun historyOperation(id: String): HistoryRecord?
}
@Database(entities = [ReminderRecord::class, PendingSchedule::class, CreationReceipt::class,
  HistoryRecord::class, SettingsRecord::class, SeriesRecord::class, PendingSeries::class, ListRecord::class, PurgedOccurrence::class,
  CalendarConnection::class, CalendarBinding::class, CalendarOperation::class, CalendarLink::class, CalendarLinkOperation::class,
  CalendarResource::class, CalendarResourceJob::class, CalendarSyncState::class, CalendarSyncGuard::class,
  CalendarSyncCursor::class, CalendarSyncSnapshot::class, CalendarReviewIssue::class, CalendarReviewPreferences::class,
  CalendarActivity::class, CalendarSavedRun::class], version = 11, exportSchema = true)
abstract class ContentDatabase : RoomDatabase() {
  abstract fun records(): ContentDao
  abstract fun calendar(): CalendarDao
  abstract fun links(): CalendarLinkDao
  abstract fun calendarResources(): CalendarResourceDao
  abstract fun sync(): CalendarSyncDao
  companion object {
    fun open(context: Context): ContentDatabase = Room.databaseBuilder(context,
      ContentDatabase::class.java, "remilo-content.db").addMigrations(MIGRATION_1_2, MIGRATION_2_3, MIGRATION_3_4, MIGRATION_4_5, MIGRATION_5_6, MIGRATION_6_7, MIGRATION_7_8, MIGRATION_8_9, MIGRATION_9_10, MIGRATION_10_11).build()
    val MIGRATION_10_11 = object : Migration(10, 11) {
      override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL("ALTER TABLE calendar_link_operations ADD COLUMN mainConfirmed INTEGER NOT NULL DEFAULT 0")
        db.execSQL("CREATE TABLE IF NOT EXISTS calendar_sync_state (associationId TEXT NOT NULL PRIMARY KEY, mode TEXT NOT NULL, activationRevision INTEGER NOT NULL, baselineVersion INTEGER NOT NULL, dirtyRevision INTEGER NOT NULL, authoredAtMs INTEGER, successfulAtMs INTEGER, attemptedAtMs INTEGER, remoteUpdated TEXT NOT NULL, status TEXT NOT NULL, pauseReason TEXT NOT NULL, operationId TEXT NOT NULL, retryAtMs INTEGER NOT NULL, failures INTEGER NOT NULL)")
        db.execSQL("CREATE TABLE IF NOT EXISTS calendar_sync_guards (operationId TEXT NOT NULL PRIMARY KEY, associationId TEXT NOT NULL, activationRevision INTEGER NOT NULL, baselineVersion INTEGER NOT NULL, connectionRevision INTEGER NOT NULL, localRevision INTEGER NOT NULL, localFingerprint TEXT NOT NULL, baseline TEXT NOT NULL, automatic INTEGER NOT NULL, previousMode TEXT NOT NULL, previousStatus TEXT NOT NULL, localFields TEXT NOT NULL)")
        db.execSQL("CREATE TABLE IF NOT EXISTS calendar_sync_cursors (`key` TEXT NOT NULL PRIMARY KEY, subject TEXT NOT NULL, calendarId TEXT NOT NULL, queryVersion INTEGER NOT NULL, generation INTEGER NOT NULL, syncToken TEXT NOT NULL, startingToken TEXT NOT NULL, pageToken TEXT NOT NULL, paging INTEGER NOT NULL, checkedAtMs INTEGER NOT NULL)")
        db.execSQL("CREATE TABLE IF NOT EXISTS calendar_sync_cache (associationId TEXT NOT NULL, eventId TEXT NOT NULL, calendarId TEXT NOT NULL, generation INTEGER NOT NULL, event TEXT NOT NULL, pending INTEGER NOT NULL, PRIMARY KEY(associationId,eventId))")
        db.execSQL("CREATE TABLE IF NOT EXISTS calendar_review_issues (associationId TEXT NOT NULL PRIMARY KEY, reason TEXT NOT NULL, fingerprint TEXT NOT NULL, discoveredAtMs INTEGER NOT NULL, background INTEGER NOT NULL, notifiedFingerprint TEXT NOT NULL)")
        db.execSQL("CREATE TABLE IF NOT EXISTS calendar_review_preferences (id TEXT NOT NULL PRIMARY KEY, revision INTEGER NOT NULL, enabled INTEGER NOT NULL, operationId TEXT NOT NULL)")
        db.execSQL("CREATE TABLE IF NOT EXISTS calendar_activity (checkpoint TEXT NOT NULL PRIMARY KEY, associationId TEXT NOT NULL, kind TEXT NOT NULL, groups TEXT NOT NULL, occurredAtMs INTEGER NOT NULL)")
        db.execSQL("CREATE TABLE IF NOT EXISTS calendar_sync_runs (id TEXT NOT NULL PRIMARY KEY, pages INTEGER NOT NULL, attempted INTEGER NOT NULL, confirmed INTEGER NOT NULL, continuation INTEGER NOT NULL, atMs INTEGER NOT NULL)")
      }
    }
    val MIGRATION_9_10 = object : Migration(9, 10) {
      override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL("CREATE TABLE IF NOT EXISTS calendar_resources (associationId TEXT NOT NULL, resourceId TEXT NOT NULL, calendarId TEXT NOT NULL, eventId TEXT NOT NULL, segmentId TEXT NOT NULL, nominalSlot TEXT NOT NULL, etag TEXT NOT NULL, fields TEXT NOT NULL, availability TEXT NOT NULL, PRIMARY KEY(associationId,resourceId))")
        db.execSQL("CREATE TABLE IF NOT EXISTS calendar_resource_jobs (operationId TEXT NOT NULL, resourceId TEXT NOT NULL, associationId TEXT NOT NULL, calendarId TEXT NOT NULL, eventId TEXT NOT NULL, etag TEXT NOT NULL, desired TEXT NOT NULL, payload TEXT NOT NULL, `insert` INTEGER NOT NULL, attempted INTEGER NOT NULL, confirmed INTEGER NOT NULL, erased INTEGER NOT NULL, outcome TEXT NOT NULL, lookupMaster TEXT NOT NULL, originalStart TEXT NOT NULL, remote TEXT NOT NULL, PRIMARY KEY(operationId,resourceId))")
      }
    }
    val MIGRATION_8_9 = object : Migration(8, 9) {
      override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL("ALTER TABLE calendar_links ADD COLUMN accountEmail TEXT NOT NULL DEFAULT ''")
        db.execSQL("ALTER TABLE calendar_links ADD COLUMN availability TEXT NOT NULL DEFAULT 'Unknown'")
        db.execSQL("ALTER TABLE calendar_links ADD COLUMN availabilityReason TEXT NOT NULL DEFAULT ''")
        db.execSQL("ALTER TABLE calendar_links ADD COLUMN observedAtMs INTEGER")
        db.execSQL("ALTER TABLE calendar_links ADD COLUMN lastCheckAttemptAtMs INTEGER")
        db.execSQL("ALTER TABLE calendar_links ADD COLUMN lastCheckErrorCode TEXT NOT NULL DEFAULT ''")
        db.execSQL("ALTER TABLE calendar_links ADD COLUMN remoteDiffers INTEGER")
        db.execSQL("ALTER TABLE calendar_links ADD COLUMN requiresReview INTEGER NOT NULL DEFAULT 0")
        db.execSQL("UPDATE calendar_links SET lastCheckAttemptAtMs = CASE WHEN erased = 1 THEN NULL ELSE checkedAtMs END, requiresReview = CASE WHEN state = 'Suspended' THEN 1 ELSE 0 END")
        db.execSQL("UPDATE calendar_links SET accountEmail = COALESCE((SELECT email FROM calendar_operations WHERE subject = calendar_links.subject AND occurrenceId = calendar_links.occurrenceId AND email != '' LIMIT 1), (SELECT email FROM calendar_connection WHERE connected = 1 AND subject = calendar_links.subject), '') WHERE erased = 0")
      }
    }
    val MIGRATION_7_8 = object : Migration(7, 8) {
      override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL("CREATE TABLE IF NOT EXISTS calendar_links (occurrenceId TEXT NOT NULL PRIMARY KEY, remoteKey TEXT NOT NULL, subject TEXT NOT NULL, calendarId TEXT NOT NULL, eventId TEXT NOT NULL, calendarName TEXT NOT NULL, origin TEXT NOT NULL, baseline TEXT NOT NULL, etag TEXT NOT NULL, state TEXT NOT NULL, message TEXT NOT NULL, htmlLink TEXT NOT NULL, revision INTEGER NOT NULL, erased INTEGER NOT NULL, checkedAtMs INTEGER)")
        db.execSQL("CREATE TABLE IF NOT EXISTS calendar_link_operations (operationId TEXT NOT NULL PRIMARY KEY, occurrenceId TEXT NOT NULL, remoteKey TEXT NOT NULL, kind TEXT NOT NULL, requestKey TEXT NOT NULL, subject TEXT NOT NULL, calendarId TEXT NOT NULL, eventId TEXT NOT NULL, calendarName TEXT NOT NULL, origin TEXT NOT NULL, etag TEXT NOT NULL, remote TEXT NOT NULL, desired TEXT NOT NULL, draft TEXT NOT NULL, patch TEXT NOT NULL, state TEXT NOT NULL, localStatus TEXT NOT NULL, message TEXT NOT NULL, expectedRevision INTEGER NOT NULL, expectedGeneration INTEGER NOT NULL, expectedLinkRevision INTEGER NOT NULL, expectedConnectionRevision INTEGER NOT NULL, disableReminders INTEGER NOT NULL, localApplied INTEGER NOT NULL, remoteAttempted INTEGER NOT NULL, erased INTEGER NOT NULL, htmlLink TEXT NOT NULL)")
        db.execSQL("CREATE UNIQUE INDEX IF NOT EXISTS index_calendar_links_remoteKey ON calendar_links (remoteKey)")
        db.execSQL("CREATE INDEX IF NOT EXISTS index_calendar_link_operations_remoteKey ON calendar_link_operations (remoteKey)")
      }
    }
    val MIGRATION_6_7 = object : Migration(6, 7) {
      override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL("CREATE TABLE IF NOT EXISTS calendar_connection (id TEXT NOT NULL PRIMARY KEY, revision INTEGER NOT NULL, connected INTEGER NOT NULL, subject TEXT NOT NULL, email TEXT NOT NULL, calendarId TEXT NOT NULL, calendarName TEXT NOT NULL, calendarZone TEXT NOT NULL, message TEXT NOT NULL)")
        db.execSQL("CREATE TABLE IF NOT EXISTS calendar_publications (occurrenceId TEXT NOT NULL PRIMARY KEY, operationId TEXT NOT NULL)")
        db.execSQL("CREATE TABLE IF NOT EXISTS calendar_operations (operationId TEXT NOT NULL PRIMARY KEY, occurrenceId TEXT NOT NULL, requestKey TEXT NOT NULL, reminderRevision INTEGER NOT NULL, connectionRevision INTEGER NOT NULL, subject TEXT NOT NULL, email TEXT NOT NULL, calendarId TEXT NOT NULL, calendarName TEXT NOT NULL, zoneId TEXT NOT NULL, eventId TEXT NOT NULL, fingerprint TEXT NOT NULL, payload TEXT NOT NULL, state TEXT NOT NULL, attempted INTEGER NOT NULL, readOnly INTEGER NOT NULL, message TEXT NOT NULL, htmlLink TEXT NOT NULL, etag TEXT NOT NULL, publishedAtMs INTEGER)")
      }
    }
    val MIGRATION_5_6 = object : Migration(5, 6) {
      override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL("CREATE TABLE IF NOT EXISTS purged_occurrences (id TEXT NOT NULL PRIMARY KEY, segmentId TEXT, nominalSlot TEXT)")
      }
    }
    val MIGRATION_4_5 = object : Migration(4, 5) {
      override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL("ALTER TABLE settings ADD COLUMN atmosphere TEXT NOT NULL DEFAULT 'automatic'")
      }
    }
    val MIGRATION_3_4 = object : Migration(3, 4) {
      override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL("ALTER TABLE reminders ADD COLUMN listId TEXT DEFAULT NULL")
        db.execSQL("CREATE TABLE IF NOT EXISTS lists (id TEXT NOT NULL PRIMARY KEY, name TEXT NOT NULL, normalizedName TEXT NOT NULL, revision INTEGER NOT NULL, createdAtMs INTEGER NOT NULL)")
        db.execSQL("CREATE INDEX IF NOT EXISTS index_lists_normalizedName ON lists (normalizedName)")
        val names = linkedMapOf<String, String>()
        db.query("SELECT listName FROM reminders ORDER BY createdAtMs, id").use { cursor ->
          while (cursor.moveToNext()) cursor.getString(0).takeIf { it.isNotEmpty() }?.let { names.putIfAbsent(it, it) }
        }
        val templates = mutableListOf<Pair<String, org.json.JSONObject>>()
        db.query("SELECT id, template FROM series ORDER BY createdAtMs, id").use { cursor ->
          while (cursor.moveToNext()) {
            val template = org.json.JSONObject(cursor.getString(1))
            templates.add(cursor.getString(0) to template)
            template.optString("listName").takeIf { it.isNotEmpty() }?.let { names.putIfAbsent(it, it) }
          }
        }
        names.forEach { (key, name) -> db.execSQL("INSERT INTO lists (id,name,normalizedName,revision,createdAtMs) VALUES (?,?,?,1,0)", arrayOf(ListNames.legacyId(key), name, ListNames.key(name))) }
        db.query("SELECT id, listName FROM reminders").use { cursor ->
          while (cursor.moveToNext()) {
            val key = cursor.getString(1)
            if (key.isNotEmpty()) db.execSQL("UPDATE reminders SET listId = ?, listName = ? WHERE id = ?", arrayOf(ListNames.legacyId(key), names.getValue(key), cursor.getString(0)))
          }
        }
        templates.forEach { (id, template) ->
          val key = template.optString("listName")
          template.put("listId", if (key.isEmpty()) org.json.JSONObject.NULL else ListNames.legacyId(key))
          template.put("listName", names[key].orEmpty())
          db.execSQL("UPDATE series SET template = ? WHERE id = ?", arrayOf(template.toString(), id))
        }
      }
    }
    val MIGRATION_2_3 = object : Migration(2, 3) {
      override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL("ALTER TABLE reminders ADD COLUMN segmentId TEXT DEFAULT NULL")
        db.execSQL("ALTER TABLE reminders ADD COLUMN nominalSlot TEXT DEFAULT NULL")
        db.execSQL("ALTER TABLE reminders ADD COLUMN exception INTEGER NOT NULL DEFAULT 0")
        db.execSQL("ALTER TABLE reminders ADD COLUMN skipped INTEGER NOT NULL DEFAULT 0")
        db.execSQL("ALTER TABLE creation_receipts ADD COLUMN sourceId TEXT DEFAULT NULL")
        db.execSQL("CREATE TABLE IF NOT EXISTS series (id TEXT NOT NULL PRIMARY KEY, seriesId TEXT NOT NULL, template TEXT NOT NULL, rule TEXT NOT NULL, revision INTEGER NOT NULL, state TEXT NOT NULL, createdAtMs INTEGER NOT NULL)")
        db.execSQL("CREATE TABLE IF NOT EXISTS pending_series (operationId TEXT NOT NULL PRIMARY KEY, segmentId TEXT NOT NULL)")
      }
    }
    val MIGRATION_1_2 = object : Migration(1, 2) {
      override fun migrate(db: SupportSQLiteDatabase) {
        val columns = mapOf("notes" to "TEXT NOT NULL DEFAULT ''", "listName" to "TEXT NOT NULL DEFAULT ''",
          "mode" to "TEXT NOT NULL DEFAULT 'Alarm'", "definedAlarmAtMs" to "INTEGER DEFAULT NULL",
          "allDay" to "INTEGER NOT NULL DEFAULT 0", "zoneId" to "TEXT NOT NULL DEFAULT ''",
          "dueLinked" to "INTEGER NOT NULL DEFAULT 1", "alarmLinked" to "INTEGER NOT NULL DEFAULT 1",
          "deleted" to "INTEGER NOT NULL DEFAULT 0", "sound" to "TEXT NOT NULL DEFAULT 'remilo'",
          "vibration" to "INTEGER NOT NULL DEFAULT 0")
        columns.forEach { (name, type) -> db.execSQL("ALTER TABLE reminders ADD COLUMN $name $type") }
        db.execSQL("UPDATE reminders SET definedAlarmAtMs = eventStartMs")
        db.execSQL("ALTER TABLE creation_receipts ADD COLUMN kind TEXT NOT NULL DEFAULT 'Create'")
        db.execSQL("ALTER TABLE history ADD COLUMN targetMs INTEGER DEFAULT NULL")
        mapOf("mode" to "TEXT NOT NULL DEFAULT 'Alarm'", "sound" to "TEXT NOT NULL DEFAULT 'remilo'",
          "vibration" to "INTEGER NOT NULL DEFAULT 0", "snoozeMinutes" to "INTEGER NOT NULL DEFAULT 10",
          "eligible" to "INTEGER NOT NULL DEFAULT 1").forEach { (name, type) ->
          db.execSQL("ALTER TABLE pending_schedules ADD COLUMN $name $type")
        }
        db.execSQL("CREATE TABLE IF NOT EXISTS settings (id TEXT NOT NULL PRIMARY KEY, revision INTEGER NOT NULL, snoozeMinutes INTEGER NOT NULL, tomorrowMorning INTEGER NOT NULL, tomorrowAfternoon INTEGER NOT NULL, tomorrowEvening INTEGER NOT NULL, sound TEXT NOT NULL, vibration INTEGER NOT NULL, theme TEXT NOT NULL, lastOperationId TEXT NOT NULL)")
      }
    }
  }
}

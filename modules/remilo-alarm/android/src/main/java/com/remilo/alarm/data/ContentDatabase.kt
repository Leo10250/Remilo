package com.remilo.alarm.data
import android.content.Context
import androidx.room.*
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

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
  @ColumnInfo(defaultValue = "0") val skipped: Boolean = false)
@Entity(tableName = "series")
data class SeriesRecord(@PrimaryKey val id: String, val seriesId: String, val template: String,
  val rule: String, val revision: Long = 1, val state: String = "Active", val createdAtMs: Long)
@Entity(tableName = "pending_series")
data class PendingSeries(@PrimaryKey val operationId: String, val segmentId: String)
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
  val theme: String = "system", val lastOperationId: String = "")
@Entity(tableName = "history")
data class HistoryRecord(@PrimaryKey val operationId: String, val occurrenceId: String,
  val kind: String, val occurredAtMs: Long, val generation: Long,
  @ColumnInfo(defaultValue = "NULL") val targetMs: Long? = null)
@Dao interface ContentDao {
  @Query("SELECT * FROM reminders ORDER BY eventStartMs") fun all(): List<ReminderRecord>
  @Query("SELECT * FROM reminders WHERE id = :id") fun find(id: String): ReminderRecord?
  @Insert(onConflict = OnConflictStrategy.ABORT) fun insert(record: ReminderRecord)
  @Update fun update(record: ReminderRecord)
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
  @Query("SELECT * FROM history WHERE operationId = :id") fun historyOperation(id: String): HistoryRecord?
}
@Database(entities = [ReminderRecord::class, PendingSchedule::class, CreationReceipt::class,
  HistoryRecord::class, SettingsRecord::class, SeriesRecord::class, PendingSeries::class], version = 3, exportSchema = true)
abstract class ContentDatabase : RoomDatabase() {
  abstract fun records(): ContentDao
  companion object {
    fun open(context: Context): ContentDatabase = Room.databaseBuilder(context,
      ContentDatabase::class.java, "remilo-content.db").addMigrations(MIGRATION_1_2, MIGRATION_2_3).build()
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

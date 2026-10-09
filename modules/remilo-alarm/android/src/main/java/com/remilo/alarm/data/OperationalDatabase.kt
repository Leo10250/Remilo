package com.remilo.alarm.data
import android.content.Context
import androidx.room.*
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

/** Privacy boundary: never add user-authored content to these entities. */
@Entity(tableName = "alerts")
data class AlertRecord(@PrimaryKey val occurrenceId: String, val targetMs: Long,
  val generation: Long, val state: String, val sessionId: String? = null,
  @ColumnInfo(defaultValue = "'Alarm'") val mode: String = "Alarm",
  @ColumnInfo(defaultValue = "'remilo'") val sound: String = "remilo",
  @ColumnInfo(defaultValue = "0") val vibration: Boolean = false,
  @ColumnInfo(defaultValue = "10") val snoozeMinutes: Int = 10,
  @ColumnInfo(defaultValue = "NULL") val previousState: String? = null,
  @ColumnInfo(defaultValue = "NULL") val segmentId: String? = null,
  @ColumnInfo(defaultValue = "NULL") val nominalSlot: String? = null,
  @ColumnInfo(defaultValue = "0") val exception: Boolean = false,
  @ColumnInfo(defaultValue = "''") val resolvedZone: String = "")
@Entity(tableName = "series_plans")
data class SeriesPlan(@PrimaryKey val id: String, val rule: String, val state: String,
  val mode: String, val sound: String, val vibration: Boolean, val snoozeMinutes: Int,
  val resolvedZone: String, val materializedThrough: String? = null)
@Entity(tableName = "sessions")
data class SessionRecord(@PrimaryKey val id: String, val state: String,
  val startedElapsedMs: Long = 0, val deadlineElapsedMs: Long = 0,
  @ColumnInfo(defaultValue = "'remilo'") val sound: String = "remilo",
  @ColumnInfo(defaultValue = "0") val vibration: Boolean = false,
  @ColumnInfo(defaultValue = "NULL") val resolvedAtmosphere: String? = null,
  @ColumnInfo(defaultValue = "NULL") val resolvedBrightness: String? = null)
/** Allowlist: global enum preferences only. No arbitrary settings/content blobs. */
@Entity(tableName = "appearance_preferences")
data class AppearanceRecord(@PrimaryKey val id: String = "app", val atmosphere: String = "automatic", val theme: String = "system")
@Entity(tableName = "actions")
data class ActionRecord(@PrimaryKey val operationId: String, val occurrenceId: String,
  val kind: String, val occurredAtMs: Long, val generation: Long,
  @ColumnInfo(defaultValue = "NULL") val targetMs: Long? = null)
@Dao interface OperationalDao {
  @Query("SELECT * FROM alerts") fun all(): List<AlertRecord>
  @Query("SELECT * FROM alerts WHERE occurrenceId = :id") fun find(id: String): AlertRecord?
  @Insert(onConflict = OnConflictStrategy.REPLACE) fun put(record: AlertRecord)
  @Query("SELECT * FROM series_plans") fun plans(): List<SeriesPlan>
  @Query("SELECT * FROM series_plans WHERE id = :id") fun plan(id: String): SeriesPlan?
  @Insert(onConflict = OnConflictStrategy.REPLACE) fun plan(record: SeriesPlan)
  @Query("SELECT * FROM sessions WHERE state IN ('Starting','Active') LIMIT 1") fun activeSession(): SessionRecord?
  @Query("SELECT * FROM sessions WHERE id = :id") fun session(id: String): SessionRecord?
  @Insert(onConflict = OnConflictStrategy.REPLACE) fun session(record: SessionRecord)
  @Query("SELECT * FROM appearance_preferences WHERE id = 'app'") fun appearance(): AppearanceRecord?
  @Insert(onConflict = OnConflictStrategy.REPLACE) fun appearance(record: AppearanceRecord)
  @Query("SELECT * FROM alerts WHERE sessionId = :id AND state = 'Alerting'") fun members(id: String): List<AlertRecord>
  @Query("SELECT * FROM actions") fun actions(): List<ActionRecord>
  @Query("SELECT * FROM actions WHERE operationId = :id") fun action(id: String): ActionRecord?
  @Insert(onConflict = OnConflictStrategy.IGNORE) fun action(record: ActionRecord)
  @Query("DELETE FROM actions WHERE operationId = :id") fun acknowledge(id: String)
}
@Database(entities = [AlertRecord::class, SessionRecord::class, ActionRecord::class, SeriesPlan::class, AppearanceRecord::class],
  version = 4, exportSchema = true)
abstract class OperationalDatabase : RoomDatabase() {
  abstract fun records(): OperationalDao
  companion object {
    fun open(context: Context): OperationalDatabase = Room.databaseBuilder(
      context.createDeviceProtectedStorageContext(), OperationalDatabase::class.java,
      "remilo-operational.db").addMigrations(MIGRATION_1_2, MIGRATION_2_3, MIGRATION_3_4).build()
    val MIGRATION_3_4 = object : Migration(3, 4) {
      override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL("CREATE TABLE IF NOT EXISTS appearance_preferences (id TEXT NOT NULL PRIMARY KEY, atmosphere TEXT NOT NULL, theme TEXT NOT NULL)")
        db.execSQL("ALTER TABLE sessions ADD COLUMN resolvedAtmosphere TEXT DEFAULT NULL")
        db.execSQL("ALTER TABLE sessions ADD COLUMN resolvedBrightness TEXT DEFAULT NULL")
      }
    }
    val MIGRATION_2_3 = object : Migration(2, 3) {
      override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL("ALTER TABLE alerts ADD COLUMN segmentId TEXT DEFAULT NULL")
        db.execSQL("ALTER TABLE alerts ADD COLUMN nominalSlot TEXT DEFAULT NULL")
        db.execSQL("ALTER TABLE alerts ADD COLUMN exception INTEGER NOT NULL DEFAULT 0")
        db.execSQL("ALTER TABLE alerts ADD COLUMN resolvedZone TEXT NOT NULL DEFAULT ''")
        db.execSQL("CREATE TABLE IF NOT EXISTS series_plans (id TEXT NOT NULL PRIMARY KEY, rule TEXT NOT NULL, state TEXT NOT NULL, mode TEXT NOT NULL, sound TEXT NOT NULL, vibration INTEGER NOT NULL, snoozeMinutes INTEGER NOT NULL, resolvedZone TEXT NOT NULL, materializedThrough TEXT)")
      }
    }
    val MIGRATION_1_2 = object : Migration(1, 2) {
      override fun migrate(db: SupportSQLiteDatabase) {
        mapOf("mode" to "TEXT NOT NULL DEFAULT 'Alarm'", "sound" to "TEXT NOT NULL DEFAULT 'remilo'",
          "vibration" to "INTEGER NOT NULL DEFAULT 0", "snoozeMinutes" to "INTEGER NOT NULL DEFAULT 10")
          .forEach { (name, type) -> db.execSQL("ALTER TABLE alerts ADD COLUMN $name $type") }
        db.execSQL("ALTER TABLE actions ADD COLUMN targetMs INTEGER DEFAULT NULL")
        db.execSQL("ALTER TABLE alerts ADD COLUMN previousState TEXT DEFAULT NULL")
        db.execSQL("ALTER TABLE sessions ADD COLUMN sound TEXT NOT NULL DEFAULT 'remilo'")
        db.execSQL("ALTER TABLE sessions ADD COLUMN vibration INTEGER NOT NULL DEFAULT 0")
      }
    }
  }
}

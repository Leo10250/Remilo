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
  @ColumnInfo(defaultValue = "''") val resolvedZone: String = "",
  @ColumnInfo(defaultValue = "'Reminder'") val profile: String = "Reminder",
  @ColumnInfo(defaultValue = "0") val expiresAtMs: Long = 0,
  @ColumnInfo(defaultValue = "0") val dayEnded: Boolean = false,
  @ColumnInfo(defaultValue = "0") val prompted: Boolean = false,
  @ColumnInfo(defaultValue = "0") val dayStarted: Boolean = false)
@Entity(tableName = "series_plans")
data class SeriesPlan(@PrimaryKey val id: String, val rule: String, val state: String,
  val mode: String, val sound: String, val vibration: Boolean, val snoozeMinutes: Int,
  val resolvedZone: String, val materializedThrough: String? = null,
  @ColumnInfo(defaultValue = "'Reminder'") val profile: String = "Reminder")
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
/** Durable alarm completion identity. Captured IDs/enums only; no private content. */
@Entity(tableName = "completion_receipts")
data class CompletionReceipt(@PrimaryKey val operationId: String, val kind: String,
  val occurrenceId: String?, val expectedGeneration: Long?, val sessionId: String?,
  val generation: Long?, val count: Int,
  @ColumnInfo(defaultValue = "NULL") val snapshotKey: String? = null)
@Entity(tableName = "pending_completions")
data class PendingCompletion(@PrimaryKey val operationId: String, val occurrenceId: String,
  val generation: Long, val occurredAtMs: Long)
/** Frozen group intent and registration acknowledgements, never private content. */
@Entity(tableName = "bulk_snooze_receipts")
data class BulkSnoozeReceipt(@PrimaryKey val operationId: String, val sessionId: String,
  val snapshotKey: String, val occurredAtMs: Long, val targetMs: Long, val snoozeMinutes: Int?,
  val settled: Boolean = false,
  @ColumnInfo(defaultValue = "'SnoozeAll'") val kind: String = "SnoozeAll")
@Entity(tableName = "bulk_snooze_members", primaryKeys = ["operationId", "occurrenceId"])
data class BulkSnoozeMember(val operationId: String, val occurrenceId: String,
  val expectedGeneration: Long, val generation: Long, val status: String = "Pending")
/** Allowlisted clock preferences only. Absence means no confirmed CE mirror yet. */
@Entity(tableName = "postpone_preferences")
data class PostponePreferencesRecord(@PrimaryKey val id: String = "app",
  val tomorrowMorning: Int = 600, val tomorrowAfternoon: Int = 840,
  val tomorrowEvening: Int = 1020, val revision: Long = 0)
/** Language enums and reconciliation metadata only; never content or message arguments. */
@Entity(tableName = "language_preferences")
data class LanguageRecord(@PrimaryKey val id: String = "app", val preference: String = "system",
  val revision: Long = 1, val settingsRevision: Long = 0, val projected: String = "",
  val pendingProjection: Boolean = false, val externalPending: Boolean = false)
/** Content-free delivery intent; retained after CE history acknowledgement for guarded retries. */
@Entity(tableName = "routine_alert_receipts")
data class RoutineAlertReceipt(@PrimaryKey val operationId: String, val kind: String,
  val occurrenceId: String, val date: String, val expectedGeneration: Long, val expectedSessionId: String,
  val generation: Long, val occurredAtMs: Long, val targetMs: Long?, val snoozeMinutes: Int?, val fingerprint: String, val settled: Boolean = false,
  @ColumnInfo(defaultValue = "'Pending'") val resultStatus: String = "Pending")
@Dao interface OperationalDao {
  @Query("SELECT * FROM postpone_preferences WHERE id = 'app'") fun postponePreferences(): PostponePreferencesRecord?
  @Insert(onConflict = OnConflictStrategy.REPLACE) fun postponePreferences(record: PostponePreferencesRecord)
  @Query("SELECT * FROM routine_alert_receipts WHERE operationId = :id") fun routineAlertReceipt(id: String): RoutineAlertReceipt?
  @Query("SELECT * FROM routine_alert_receipts") fun routineAlertReceipts(): List<RoutineAlertReceipt>
  @Query("SELECT * FROM routine_alert_receipts WHERE settled = 0") fun pendingRoutineAlerts(): List<RoutineAlertReceipt>
  @Insert(onConflict = OnConflictStrategy.REPLACE) fun routineAlertReceipt(record: RoutineAlertReceipt)
  @Query("SELECT * FROM language_preferences WHERE id = 'app'") fun language(): LanguageRecord?
  @Insert(onConflict = OnConflictStrategy.REPLACE) fun language(record: LanguageRecord)
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
  @Query("SELECT * FROM completion_receipts WHERE operationId = :id") fun completionReceipt(id: String): CompletionReceipt?
  @Insert fun completionReceipt(record: CompletionReceipt)
  @Query("SELECT * FROM pending_completions ORDER BY occurredAtMs, operationId") fun completions(): List<PendingCompletion>
  @Insert fun completion(record: PendingCompletion)
  @Query("DELETE FROM pending_completions WHERE operationId = :id") fun acknowledgeCompletion(id: String)
  @Query("SELECT * FROM bulk_snooze_receipts WHERE operationId = :id") fun bulkSnoozeReceipt(id: String): BulkSnoozeReceipt?
  @Query("SELECT * FROM bulk_snooze_receipts WHERE settled = 0") fun pendingBulkSnoozes(): List<BulkSnoozeReceipt>
  @Insert(onConflict = OnConflictStrategy.REPLACE) fun bulkSnoozeReceipt(record: BulkSnoozeReceipt)
  @Query("SELECT * FROM bulk_snooze_members WHERE operationId = :id ORDER BY occurrenceId") fun bulkSnoozeMembers(id: String): List<BulkSnoozeMember>
  @Insert(onConflict = OnConflictStrategy.REPLACE) fun bulkSnoozeMember(record: BulkSnoozeMember)
}
@Database(entities = [AlertRecord::class, SessionRecord::class, ActionRecord::class, SeriesPlan::class, AppearanceRecord::class,
  CompletionReceipt::class, PendingCompletion::class, BulkSnoozeReceipt::class, BulkSnoozeMember::class, LanguageRecord::class, RoutineAlertReceipt::class, PostponePreferencesRecord::class], version = OperationalDatabase.VERSION, exportSchema = true)
abstract class OperationalDatabase : RoomDatabase() {
  abstract fun records(): OperationalDao
  companion object {
    const val VERSION = 10
    fun open(context: Context): OperationalDatabase = Room.databaseBuilder(
      context.createDeviceProtectedStorageContext(), OperationalDatabase::class.java,
      "remilo-operational.db").addMigrations(*MIGRATIONS).build()
    /** Two independently deployed version-8 lineages are retained as explicit inputs. */
    val MIGRATION_7_10 = object : Migration(7, 10) {
      override fun migrate(db: SupportSQLiteDatabase) {
        MIGRATION_7_8.migrate(db)
        MIGRATION_8_9.migrate(db)
        MIGRATION_9_10.migrate(db)
      }
    }
    val MIGRATION_8_10 = object : Migration(8, 10) {
      override fun migrate(db: SupportSQLiteDatabase) {
        val identity = db.query("SELECT identity_hash FROM room_master_table WHERE id = 42").use { row ->
          if (row.moveToFirst()) row.getString(0) else null
        }
        when (identity) {
          "848d76d92f0321341c8071cead845d4a" -> {
            // Chooser v8 already owns frozen Postpone receipts and its preference mirror.
            MIGRATION_7_8.migrate(db)
            MIGRATION_8_9.migrate(db)
          }
          "5d7804e1ece64d848da5b28b8a4e6f0a" -> {
            MIGRATION_8_9.migrate(db)
            MIGRATION_9_10.migrate(db)
          }
          else -> throw IllegalStateException("Unknown operational version 8 schema.")
        }
      }
    }
    val MIGRATION_9_10 = object : Migration(9, 10) {
      override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL("CREATE TABLE bulk_snooze_receipts_v10 (operationId TEXT NOT NULL PRIMARY KEY, sessionId TEXT NOT NULL, snapshotKey TEXT NOT NULL, occurredAtMs INTEGER NOT NULL, targetMs INTEGER NOT NULL, snoozeMinutes INTEGER, settled INTEGER NOT NULL, kind TEXT NOT NULL DEFAULT 'SnoozeAll')")
        db.execSQL("INSERT INTO bulk_snooze_receipts_v10 (operationId,sessionId,snapshotKey,occurredAtMs,targetMs,snoozeMinutes,settled,kind) SELECT operationId,sessionId,snapshotKey,occurredAtMs,targetMs,snoozeMinutes,settled,'SnoozeAll' FROM bulk_snooze_receipts")
        db.execSQL("DROP TABLE bulk_snooze_receipts")
        db.execSQL("ALTER TABLE bulk_snooze_receipts_v10 RENAME TO bulk_snooze_receipts")
        db.execSQL("CREATE TABLE postpone_preferences (id TEXT NOT NULL PRIMARY KEY, tomorrowMorning INTEGER NOT NULL, tomorrowAfternoon INTEGER NOT NULL, tomorrowEvening INTEGER NOT NULL, revision INTEGER NOT NULL)")
      }
    }
    val MIGRATION_8_9 = object : Migration(8, 9) {
      override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL("ALTER TABLE alerts ADD COLUMN dayStarted INTEGER NOT NULL DEFAULT 0")
        db.execSQL("CREATE TABLE IF NOT EXISTS routine_alert_receipts (operationId TEXT NOT NULL PRIMARY KEY, kind TEXT NOT NULL, occurrenceId TEXT NOT NULL, date TEXT NOT NULL, expectedGeneration INTEGER NOT NULL, expectedSessionId TEXT NOT NULL, generation INTEGER NOT NULL, occurredAtMs INTEGER NOT NULL, targetMs INTEGER, snoozeMinutes INTEGER, fingerprint TEXT NOT NULL, settled INTEGER NOT NULL, resultStatus TEXT NOT NULL DEFAULT 'Pending')")
      }
    }
    val MIGRATION_7_8 = object : Migration(7, 8) {
      override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL("ALTER TABLE alerts ADD COLUMN profile TEXT NOT NULL DEFAULT 'Reminder'")
        db.execSQL("ALTER TABLE alerts ADD COLUMN expiresAtMs INTEGER NOT NULL DEFAULT 0")
        db.execSQL("ALTER TABLE alerts ADD COLUMN dayEnded INTEGER NOT NULL DEFAULT 0")
        db.execSQL("ALTER TABLE alerts ADD COLUMN prompted INTEGER NOT NULL DEFAULT 0")
        db.execSQL("ALTER TABLE series_plans ADD COLUMN profile TEXT NOT NULL DEFAULT 'Reminder'")
      }
    }
    val MIGRATION_6_7 = object : Migration(6, 7) {
      override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL("CREATE TABLE IF NOT EXISTS language_preferences (id TEXT NOT NULL PRIMARY KEY, preference TEXT NOT NULL, revision INTEGER NOT NULL, settingsRevision INTEGER NOT NULL, projected TEXT NOT NULL, pendingProjection INTEGER NOT NULL, externalPending INTEGER NOT NULL)")
        db.execSQL("INSERT INTO language_preferences VALUES ('app','en',1,0,'',0,0)")
      }
    }
    val MIGRATION_5_6 = object : Migration(5, 6) {
      override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL("ALTER TABLE completion_receipts ADD COLUMN snapshotKey TEXT DEFAULT NULL")
        db.execSQL("CREATE TABLE IF NOT EXISTS bulk_snooze_receipts (operationId TEXT NOT NULL PRIMARY KEY, sessionId TEXT NOT NULL, snapshotKey TEXT NOT NULL, occurredAtMs INTEGER NOT NULL, targetMs INTEGER NOT NULL, snoozeMinutes INTEGER NOT NULL, settled INTEGER NOT NULL)")
        db.execSQL("CREATE TABLE IF NOT EXISTS bulk_snooze_members (operationId TEXT NOT NULL, occurrenceId TEXT NOT NULL, expectedGeneration INTEGER NOT NULL, generation INTEGER NOT NULL, status TEXT NOT NULL, PRIMARY KEY(operationId, occurrenceId))")
      }
    }
    val MIGRATION_4_5 = object : Migration(4, 5) {
      override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL("CREATE TABLE IF NOT EXISTS completion_receipts (operationId TEXT NOT NULL PRIMARY KEY, kind TEXT NOT NULL, occurrenceId TEXT, expectedGeneration INTEGER, sessionId TEXT, generation INTEGER, count INTEGER NOT NULL)")
        db.execSQL("CREATE TABLE IF NOT EXISTS pending_completions (operationId TEXT NOT NULL PRIMARY KEY, occurrenceId TEXT NOT NULL, generation INTEGER NOT NULL, occurredAtMs INTEGER NOT NULL)")
      }
    }
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
    val MIGRATIONS = arrayOf(MIGRATION_1_2, MIGRATION_2_3, MIGRATION_3_4, MIGRATION_4_5, MIGRATION_5_6, MIGRATION_6_7,
      MIGRATION_7_8, MIGRATION_8_9, MIGRATION_7_10, MIGRATION_8_10, MIGRATION_9_10)
  }
}

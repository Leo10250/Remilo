package com.remilo.alarm.data
import android.content.Context
import androidx.room.*

/** Privacy boundary: never add user-authored content to these entities. */
@Entity(tableName = "alerts")
data class AlertRecord(@PrimaryKey val occurrenceId: String, val targetMs: Long,
  val generation: Long, val state: String, val sessionId: String? = null)
@Entity(tableName = "sessions")
data class SessionRecord(@PrimaryKey val id: String, val state: String,
  val startedElapsedMs: Long = 0, val deadlineElapsedMs: Long = 0)
@Entity(tableName = "actions")
data class ActionRecord(@PrimaryKey val operationId: String, val occurrenceId: String,
  val kind: String, val occurredAtMs: Long, val generation: Long)
@Dao interface OperationalDao {
  @Query("SELECT * FROM alerts") fun all(): List<AlertRecord>
  @Query("SELECT * FROM alerts WHERE occurrenceId = :id") fun find(id: String): AlertRecord?
  @Insert(onConflict = OnConflictStrategy.REPLACE) fun put(record: AlertRecord)
  @Query("SELECT * FROM sessions WHERE state IN ('Starting','Active') LIMIT 1") fun activeSession(): SessionRecord?
  @Query("SELECT * FROM sessions WHERE id = :id") fun session(id: String): SessionRecord?
  @Insert(onConflict = OnConflictStrategy.REPLACE) fun session(record: SessionRecord)
  @Query("SELECT * FROM alerts WHERE sessionId = :id AND state = 'Alerting'") fun members(id: String): List<AlertRecord>
  @Query("SELECT * FROM actions") fun actions(): List<ActionRecord>
  @Query("SELECT * FROM actions WHERE operationId = :id") fun action(id: String): ActionRecord?
  @Insert(onConflict = OnConflictStrategy.IGNORE) fun action(record: ActionRecord)
  @Query("DELETE FROM actions WHERE operationId = :id") fun acknowledge(id: String)
}
@Database(entities = [AlertRecord::class, SessionRecord::class, ActionRecord::class],
  version = 1, exportSchema = true)
abstract class OperationalDatabase : RoomDatabase() {
  abstract fun records(): OperationalDao
  companion object {
    fun open(context: Context): OperationalDatabase = Room.databaseBuilder(
      context.createDeviceProtectedStorageContext(), OperationalDatabase::class.java,
      "remilo-operational.db").build()
  }
}

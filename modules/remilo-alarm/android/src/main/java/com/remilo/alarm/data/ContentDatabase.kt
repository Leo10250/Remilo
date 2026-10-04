package com.remilo.alarm.data
import android.content.Context
import androidx.room.*

@Entity(tableName = "reminders")
data class ReminderRecord(@PrimaryKey val id: String, val title: String, val eventStartMs: Long,
  val eventEndMs: Long, val dueAtMs: Long, val createdAtMs: Long,
  val completed: Boolean = false, val revision: Long = 1)
@Entity(tableName = "pending_schedules")
data class PendingSchedule(@PrimaryKey val operationId: String, val occurrenceId: String,
  val targetMs: Long, val generation: Long)
@Entity(tableName = "creation_receipts")
data class CreationReceipt(@PrimaryKey val operationId: String, val occurrenceId: String)
@Entity(tableName = "history")
data class HistoryRecord(@PrimaryKey val operationId: String, val occurrenceId: String,
  val kind: String, val occurredAtMs: Long, val generation: Long)
@Dao interface ContentDao {
  @Query("SELECT * FROM reminders ORDER BY eventStartMs") fun all(): List<ReminderRecord>
  @Query("SELECT * FROM reminders WHERE id = :id") fun find(id: String): ReminderRecord?
  @Insert(onConflict = OnConflictStrategy.ABORT) fun insert(record: ReminderRecord)
  @Insert(onConflict = OnConflictStrategy.REPLACE) fun pending(record: PendingSchedule)
  @Query("SELECT * FROM pending_schedules") fun pending(): List<PendingSchedule>
  @Query("DELETE FROM pending_schedules WHERE operationId = :id") fun acknowledge(id: String)
  @Insert fun receipt(record: CreationReceipt)
  @Query("SELECT * FROM creation_receipts WHERE operationId = :id") fun receipt(id: String): CreationReceipt?
  @Insert(onConflict = OnConflictStrategy.IGNORE) fun history(record: HistoryRecord)
  @Query("SELECT * FROM history WHERE occurrenceId = :id ORDER BY occurredAtMs") fun history(id: String): List<HistoryRecord>
}
@Database(entities = [ReminderRecord::class, PendingSchedule::class, CreationReceipt::class,
  HistoryRecord::class], version = 1, exportSchema = true)
abstract class ContentDatabase : RoomDatabase() {
  abstract fun records(): ContentDao
  companion object {
    fun open(context: Context): ContentDatabase = Room.databaseBuilder(context,
      ContentDatabase::class.java, "remilo-content.db").build()
  }
}

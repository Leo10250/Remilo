package com.remilo.alarm.data

import androidx.room.*
import androidx.sqlite.db.SupportSQLiteDatabase

/** Authored plans, exercise snapshots and progress are credential-protected only. */
@Entity(tableName = "routine_plans")
data class RoutinePlan(@PrimaryKey val id: String, val revision: Long = 1,
  val startsOn: String, val state: String = "Active", val pauses: String = "[]",
  @ColumnInfo(defaultValue = "'Active'") val priorState: String = "Active",
  @ColumnInfo(defaultValue = "0") val trashedAtMs: Long = 0,
  @ColumnInfo(defaultValue = "'[]'") val trashIntervals: String = "[]")
@Entity(tableName = "exercise_images")
data class ExerciseImage(@PrimaryKey val id: String, val mime: String, val width: Int, val height: Int, val bytes: Long)
@Entity(tableName = "purged_routines")
data class PurgedRoutine(@PrimaryKey val id: String)
@Entity(tableName = "routine_versions", primaryKeys = ["routineId", "revision"])
data class RoutineVersion(val routineId: String, val effectiveDate: String, val title: String,
  val minutes: Int, val mode: String, val listId: String?, val days: String,
  @ColumnInfo(defaultValue = "''") val notes: String = "",
  @ColumnInfo(defaultValue = "'remilo'") val sound: String = "remilo",
  @ColumnInfo(defaultValue = "0") val vibration: Boolean = false,
  @ColumnInfo(defaultValue = "1") val revision: Long = 1,
  @ColumnInfo(defaultValue = "'ByWeekday'") val authoringMode: String = "ByWeekday",
  @ColumnInfo(defaultValue = "'Exercise'") val presentationPreset: String = "Exercise")
@Entity(tableName = "routine_sessions", indices = [Index(value = ["routineId", "date"], unique = true)])
data class RoutineSession(@PrimaryKey val occurrenceId: String, val routineId: String,
  val date: String, val versionDate: String, val steps: String, val done: String = "[]",
  val ended: Boolean = false, val revision: Long = 1, val changes: String = "[]",
  @ColumnInfo(defaultValue = "0") val versionRevision: Long = 0)
/** Captured mutation and acknowledgement survive an interrupted bridge or process. */
@Entity(tableName = "routine_operations")
data class RoutineOperation(@PrimaryKey val operationId: String, val fingerprint: String,
  val occurrenceId: String?, val payload: String, val applied: Boolean = false, val result: String = "{}")
@Dao interface RoutineDao {
  @Query("SELECT * FROM exercise_images") fun images(): List<ExerciseImage>
  @Query("SELECT * FROM exercise_images WHERE id = :id") fun image(id: String): ExerciseImage?
  @Insert(onConflict = OnConflictStrategy.IGNORE) fun image(value: ExerciseImage)
  @Query("DELETE FROM exercise_images WHERE id = :id") fun removeImage(id: String)
  @Query("SELECT * FROM purged_routines") fun purged(): List<PurgedRoutine>
  @Query("SELECT * FROM purged_routines WHERE id = :id") fun purged(id: String): PurgedRoutine?
  @Insert(onConflict = OnConflictStrategy.IGNORE) fun purge(value: PurgedRoutine)
  @Query("DELETE FROM routine_plans WHERE id = :id") fun removePlan(id: String)
  @Query("DELETE FROM routine_versions WHERE routineId = :id") fun removeVersions(id: String)
  @Query("SELECT * FROM routine_plans ORDER BY id") fun plans(): List<RoutinePlan>
  @Query("SELECT * FROM routine_plans WHERE id = :id") fun plan(id: String): RoutinePlan?
  @Insert(onConflict = OnConflictStrategy.REPLACE) fun plan(value: RoutinePlan)
  @Query("SELECT * FROM routine_versions WHERE routineId = :id ORDER BY revision") fun versions(id: String): List<RoutineVersion>
  @Query("SELECT * FROM routine_versions ORDER BY routineId, revision") fun versions(): List<RoutineVersion>
  @Insert fun version(value: RoutineVersion)
  @Query("UPDATE routine_versions SET listId = NULL WHERE listId = :id") fun clearVersionList(id: String)
  @Query("SELECT * FROM routine_sessions ORDER BY date DESC, occurrenceId") fun sessions(): List<RoutineSession>
  @Query("SELECT * FROM routine_sessions WHERE occurrenceId = :id") fun session(id: String): RoutineSession?
  @Query("SELECT * FROM routine_sessions WHERE routineId = :id AND date = :date") fun dated(id: String, date: String): RoutineSession?
  @Insert(onConflict = OnConflictStrategy.REPLACE) fun session(value: RoutineSession)
  @Query("SELECT * FROM routine_operations WHERE operationId = :id") fun operation(id: String): RoutineOperation?
  @Query("SELECT * FROM routine_operations WHERE applied = 0") fun pending(): List<RoutineOperation>
  @Insert(onConflict = OnConflictStrategy.REPLACE) fun operation(value: RoutineOperation)
  @Query("DELETE FROM routine_sessions WHERE occurrenceId = :id") fun purgeSession(id: String)
  @Query("DELETE FROM routine_operations WHERE occurrenceId = :id") fun purgeOperations(id: String)
}
object RoutineSchema {
  fun create(db: SupportSQLiteDatabase) {
    db.execSQL("CREATE TABLE IF NOT EXISTS routine_plans (id TEXT NOT NULL PRIMARY KEY, revision INTEGER NOT NULL, startsOn TEXT NOT NULL, state TEXT NOT NULL, pauses TEXT NOT NULL)")
    db.execSQL("CREATE TABLE IF NOT EXISTS routine_versions (routineId TEXT NOT NULL, effectiveDate TEXT NOT NULL, title TEXT NOT NULL, minutes INTEGER NOT NULL, mode TEXT NOT NULL, listId TEXT, days TEXT NOT NULL, PRIMARY KEY(routineId,effectiveDate))")
    db.execSQL("CREATE TABLE IF NOT EXISTS routine_sessions (occurrenceId TEXT NOT NULL PRIMARY KEY, routineId TEXT NOT NULL, date TEXT NOT NULL, versionDate TEXT NOT NULL, steps TEXT NOT NULL, done TEXT NOT NULL, ended INTEGER NOT NULL, revision INTEGER NOT NULL, changes TEXT NOT NULL)")
    db.execSQL("CREATE UNIQUE INDEX IF NOT EXISTS index_routine_sessions_routineId_date ON routine_sessions (routineId,date)")
    db.execSQL("CREATE TABLE IF NOT EXISTS routine_operations (operationId TEXT NOT NULL PRIMARY KEY, fingerprint TEXT NOT NULL, occurrenceId TEXT, payload TEXT NOT NULL, applied INTEGER NOT NULL, result TEXT NOT NULL)")
  }
}

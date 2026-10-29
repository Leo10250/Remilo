package com.remilo.alarm.data

import android.app.Application
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import androidx.room.Room
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34], application = Application::class)
class OperationalForwardMigrationTest {
  private val context: Context get() = RuntimeEnvironment.getApplication().createDeviceProtectedStorageContext()

  private fun legacy(name: String, resource: String): SQLiteDatabase {
    context.deleteDatabase(name)
    val file = context.getDatabasePath(name)
    file.parentFile!!.mkdirs()
    val schema = JSONObject(javaClass.getResourceAsStream(resource)!!.bufferedReader().use { it.readText() }).getJSONObject("database")
    return SQLiteDatabase.openOrCreateDatabase(file, null).also { db ->
      val entities = schema.getJSONArray("entities")
      for (index in 0 until entities.length()) {
        val entity = entities.getJSONObject(index)
        db.execSQL(entity.getString("createSql").replace("\${TABLE_NAME}", entity.getString("tableName")))
      }
      val setup = schema.getJSONArray("setupQueries")
      for (index in 0 until setup.length()) db.execSQL(setup.getString(index))
      db.version = schema.getInt("version")
    }
  }

  private fun open(name: String) = Room.databaseBuilder(context, OperationalDatabase::class.java, name)
    .allowMainThreadQueries().addMigrations(*OperationalDatabase.MIGRATIONS).build()

  private fun seedShared(db: SQLiteDatabase) {
    db.execSQL("INSERT INTO alerts (occurrenceId,targetMs,generation,state,sessionId) VALUES ('reminder',650000,8,'Pending',NULL)")
    db.execSQL("INSERT INTO sessions (id,state,startedElapsedMs,deadlineElapsedMs) VALUES ('session','Active',1000,301000)")
    db.execSQL("INSERT INTO actions (operationId,occurrenceId,kind,occurredAtMs,generation,targetMs) VALUES ('journal','reminder','Postpone',50000,8,650000)")
    db.execSQL("INSERT INTO appearance_preferences VALUES ('app','night','dark')")
    db.execSQL("INSERT INTO language_preferences VALUES ('app','zh-Hans',4,3,'zh-Hans',1,0)")
    db.execSQL("INSERT INTO completion_receipts (operationId,kind,occurrenceId,expectedGeneration,generation,count,snapshotKey) VALUES ('done','CompleteDelivery','done-member',4,5,1,'retained-completion')")
    db.execSQL("INSERT INTO pending_completions VALUES ('done','done-member',5,51000)")
    db.execSQL("INSERT INTO bulk_snooze_receipts (operationId,sessionId,snapshotKey,occurredAtMs,targetMs,snoozeMinutes,settled) VALUES ('pending','session','retained-snapshot',50000,650000,10,0)")
    db.execSQL("INSERT INTO bulk_snooze_receipts (operationId,sessionId,snapshotKey,occurredAtMs,targetMs,snoozeMinutes,settled) VALUES ('settled','session','settled-snapshot',60000,960000,15,1)")
    db.execSQL("INSERT INTO bulk_snooze_members VALUES ('pending','reminder',7,8,'Pending')")
    db.execSQL("INSERT INTO bulk_snooze_members VALUES ('settled','blocked-member',2,3,'Blocked')")
  }

  private fun assertShared(db: OperationalDatabase) {
    val records = db.records()
    assertEquals(10, db.openHelper.readableDatabase.version)
    assertEquals(650000L, records.find("reminder")!!.targetMs)
    assertEquals(8L, records.find("reminder")!!.generation)
    assertEquals("Pending", records.find("reminder")!!.state)
    assertEquals("Reminder", records.find("reminder")!!.profile)
    assertEquals("Postpone", records.action("journal")!!.kind)
    assertEquals(650000L, records.action("journal")!!.targetMs)
    assertEquals(AppearanceRecord(atmosphere = "night", theme = "dark"), records.appearance())
    assertEquals("zh-Hans", records.language()!!.preference)
    assertEquals(4L, records.language()!!.revision)
    assertEquals("Active", records.session("session")!!.state)
    assertEquals(301000L, records.session("session")!!.deadlineElapsedMs)
    assertEquals("retained-completion", records.completionReceipt("done")!!.snapshotKey)
    assertEquals(51000L, records.completions().single().occurredAtMs)
    assertEquals(BulkSnoozeReceipt("pending", "session", "retained-snapshot", 50000, 650000, 10), records.bulkSnoozeReceipt("pending"))
    assertEquals(BulkSnoozeReceipt("settled", "session", "settled-snapshot", 60000, 960000, 15, true), records.bulkSnoozeReceipt("settled"))
    assertEquals("Blocked", records.bulkSnoozeMembers("settled").single().status)
    assertEquals(7L, records.bulkSnoozeMembers("pending").single().expectedGeneration)
  }

  @Test fun originalVersion7MigratesForwardToCombined10WithoutChangingOperationalIntent() {
    val name = "combined-from-v7.db"
    legacy(name, "/com.remilo.alarm.data.OperationalDatabase/7.json").use(::seedShared)
    val db = open(name)
    try {
      assertShared(db)
      assertNull(db.records().postponePreferences())
      assertTrue(db.records().routineAlertReceipts().isEmpty())
    } finally { db.close(); context.deleteDatabase(name) }
  }

  @Test fun routinesVersion8KeepsProfileExpiryAndDayFlagsWhileAddingPostpone() {
    val name = "combined-from-routines-v8.db"
    legacy(name, "/storage/operational-v8-routines.json").use { raw ->
      seedShared(raw)
      raw.execSQL("INSERT INTO alerts (occurrenceId,targetMs,generation,state,profile,expiresAtMs,dayEnded,prompted) VALUES ('routine',720000,6,'Available','RoutineQuiet',999999,1,1)")
      raw.execSQL("INSERT INTO series_plans (id,rule,state,mode,sound,vibration,snoozeMinutes,resolvedZone,profile) VALUES ('routine-plan','retained-rule','Active','Alarm','remilo',0,15,'UTC','RoutineQuiet')")
    }
    val db = open(name)
    try {
      assertShared(db)
      val routine = db.records().find("routine")!!
      assertEquals("RoutineQuiet", routine.profile); assertEquals(999999L, routine.expiresAtMs)
      assertTrue(routine.dayEnded); assertTrue(routine.prompted); assertFalse(routine.dayStarted)
      assertEquals(6L, routine.generation); assertEquals("Available", routine.state)
      assertEquals("RoutineQuiet", db.records().plan("routine-plan")!!.profile)
      assertEquals("retained-rule", db.records().plan("routine-plan")!!.rule)
      assertNull(db.records().postponePreferences())
    } finally { db.close(); context.deleteDatabase(name) }
  }

  @Test fun chooserVersion8KeepsPostponeReceiptMembersAndMirroredShortcutsWhileAddingRoutines() {
    val name = "combined-from-chooser-v8.db"
    legacy(name, "/storage/operational-v8-postpone.json").use { raw ->
      seedShared(raw)
      raw.execSQL("INSERT INTO bulk_snooze_receipts VALUES ('postpone','session','postpone-snapshot',61000,999999,NULL,0,'PostponeAll')")
      raw.execSQL("INSERT INTO bulk_snooze_members VALUES ('postpone','postponed-member',8,9,'Pending')")
      raw.execSQL("INSERT INTO postpone_preferences VALUES ('app',615,855,1035,22)")
    }
    val db = open(name)
    try {
      assertShared(db)
      assertEquals(BulkSnoozeReceipt("postpone", "session", "postpone-snapshot", 61000, 999999, null, kind = "PostponeAll"), db.records().bulkSnoozeReceipt("postpone"))
      assertEquals(BulkSnoozeMember("postpone", "postponed-member", 8, 9), db.records().bulkSnoozeMembers("postpone").single())
      assertEquals(PostponePreferencesRecord(tomorrowMorning = 615, tomorrowAfternoon = 855, tomorrowEvening = 1035, revision = 22), db.records().postponePreferences())
      assertFalse(db.records().find("reminder")!!.dayStarted)
      assertTrue(db.records().routineAlertReceipts().isEmpty())
    } finally { db.close(); context.deleteDatabase(name) }
  }

  @Test fun routinesVersion9KeepsPendingAndSettledRoutineReceiptsAndDayStartedState() {
    val name = "combined-from-routines-v9.db"
    legacy(name, "/com.remilo.alarm.data.OperationalDatabase/9.json").use { raw ->
      seedShared(raw)
      raw.execSQL("INSERT INTO alerts (occurrenceId,targetMs,generation,state,profile,expiresAtMs,dayEnded,prompted,dayStarted) VALUES ('routine',720000,6,'Available','RoutineQuiet',999999,0,1,1)")
      raw.execSQL("INSERT INTO routine_alert_receipts VALUES ('routine-pending','SnoozeRoutineAlarm','routine','2026-10-28',5,'session',6,51000,720000,15,'frozen-routine',0,'Pending')")
      raw.execSQL("INSERT INTO routine_alert_receipts VALUES ('routine-settled','DismissRoutineAlarm','routine','2026-10-28',4,'session',5,41000,NULL,NULL,'settled-routine',1,'Applied')")
    }
    val db = open(name)
    try {
      assertShared(db)
      assertTrue(db.records().find("routine")!!.dayStarted)
      assertEquals(999999L, db.records().find("routine")!!.expiresAtMs)
      val pending = db.records().routineAlertReceipt("routine-pending")!!
      assertFalse(pending.settled); assertEquals("frozen-routine", pending.fingerprint)
      assertEquals(720000L, pending.targetMs); assertEquals(6L, pending.generation)
      val settled = db.records().routineAlertReceipt("routine-settled")!!
      assertTrue(settled.settled); assertEquals("Applied", settled.resultStatus)
      assertEquals("settled-routine", settled.fingerprint)
      assertNull(db.records().postponePreferences())
    } finally { db.close(); context.deleteDatabase(name) }
  }

  @Test fun unknownVersion8IdentityFailsClosedWithoutChangingSchemaVersionOrReceipts() {
    val name = "combined-unknown-v8.db"
    legacy(name, "/storage/operational-v8-postpone.json").use { raw ->
      seedShared(raw)
      raw.execSQL("UPDATE room_master_table SET identity_hash = 'unknown-v8' WHERE id = 42")
    }
    val db = open(name)
    try { assertThrows(IllegalStateException::class.java) { db.records().all() } }
    finally { db.close() }
    SQLiteDatabase.openDatabase(context.getDatabasePath(name).absolutePath, null, SQLiteDatabase.OPEN_READONLY).use { raw ->
      assertEquals(8, raw.version)
      raw.rawQuery("SELECT targetMs FROM bulk_snooze_receipts WHERE operationId = 'pending'", null).use {
        assertTrue(it.moveToFirst()); assertEquals(650000L, it.getLong(0))
      }
      raw.rawQuery("PRAGMA table_info(alerts)", null).use {
        val fields = mutableListOf<String>()
        while (it.moveToNext()) fields.add(it.getString(1))
        assertFalse(fields.contains("profile")); assertFalse(fields.contains("dayStarted"))
      }
    }
    context.deleteDatabase(name)
  }
}

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
class MigrationTest {
  private fun legacy(context: Context, database: String, name: String, version: Int = 1): SQLiteDatabase {
    context.deleteDatabase(name)
    val path = context.getDatabasePath(name)
    path.parentFile!!.mkdirs()
    val source = javaClass.getResourceAsStream("/$database/$version.json")!!.bufferedReader().use { it.readText() }
    val schema = JSONObject(source).getJSONObject("database")
    return SQLiteDatabase.openOrCreateDatabase(path, null).also { db ->
      val entities = schema.getJSONArray("entities")
      for (index in 0 until entities.length()) {
        val entity = entities.getJSONObject(index)
        db.execSQL(entity.getString("createSql").replace("\${TABLE_NAME}", entity.getString("tableName")))
        val indices = entity.optJSONArray("indices") ?: org.json.JSONArray()
        for (indexIndex in 0 until indices.length()) {
          db.execSQL(indices.getJSONObject(indexIndex).getString("createSql").replace("\${TABLE_NAME}", entity.getString("tableName")))
        }
      }
      val setup = schema.getJSONArray("setupQueries")
      for (index in 0 until setup.length()) db.execSQL(setup.getString(index))
      db.version = version
    }
  }
  @Test fun contentUpgradeRetainsDefinitionsReceiptsAndHistory() {
    val context = RuntimeEnvironment.getApplication()
    legacy(context, "com.remilo.alarm.data.ContentDatabase", "content-migration.db").use { db ->
      db.execSQL("INSERT INTO reminders VALUES ('old', 'Migration probe', 1000, 2000, 1500, 500, 0, 7)")
      db.execSQL("INSERT INTO creation_receipts VALUES ('creation', 'old')")
      db.execSQL("INSERT INTO history VALUES ('action', 'old', 'Snooze', 900, 3)")
    }
    val db = Room.databaseBuilder(context, ContentDatabase::class.java, "content-migration.db")
      .allowMainThreadQueries().addMigrations(ContentDatabase.MIGRATION_1_2, ContentDatabase.MIGRATION_2_3, ContentDatabase.MIGRATION_3_4, ContentDatabase.MIGRATION_4_5).build()
    try {
      val record = db.records().find("old")!!
      assertEquals("Migration probe", record.title)
      assertEquals(7L, record.revision)
      assertEquals(1000L, record.definedAlarmAtMs)
      assertEquals("Create", db.records().receipt("creation")!!.kind)
      assertEquals("Snooze", db.records().history("old").single().kind)
      assertNull(db.records().settings())
    } finally { db.close(); context.deleteDatabase("content-migration.db") }
  }
  @Test fun protectedUpgradeRetainsSnoozedTargetAndGeneration() {
    val context = RuntimeEnvironment.getApplication().createDeviceProtectedStorageContext()
    legacy(context, "com.remilo.alarm.data.OperationalDatabase", "protected-migration.db").use { db ->
      db.execSQL("INSERT INTO alerts VALUES ('old', 60000, 3, 'Scheduled', NULL)")
      db.execSQL("INSERT INTO actions VALUES ('snooze', 'old', 'Snooze', 900, 3)")
    }
    val db = Room.databaseBuilder(context, OperationalDatabase::class.java, "protected-migration.db")
      .allowMainThreadQueries().addMigrations(OperationalDatabase.MIGRATION_1_2, OperationalDatabase.MIGRATION_2_3, OperationalDatabase.MIGRATION_3_4, OperationalDatabase.MIGRATION_4_5, OperationalDatabase.MIGRATION_5_6).build()
    try {
      val alert = db.records().find("old")!!
      assertEquals(60000L, alert.targetMs)
      assertEquals(3L, alert.generation)
      assertEquals("Scheduled", alert.state)
      assertEquals("Snooze", db.records().actions().single().kind)
      assertEquals(10, alert.snoozeMinutes)
      assertNull(alert.previousState)
    } finally { db.close(); context.deleteDatabase("protected-migration.db") }
  }
  @Test fun secondBetaContentUpgradeKeepsSettingsAndIndependentTiming() {
    val context = RuntimeEnvironment.getApplication()
    legacy(context, "com.remilo.alarm.data.ContentDatabase", "content-v2.db", 2).use { db ->
      db.execSQL("INSERT INTO reminders (id,title,eventStartMs,eventEndMs,dueAtMs,createdAtMs,completed,revision,definedAlarmAtMs,notes) VALUES ('v2','Private',1000,2000,1500,500,0,8,1800,'Retained')")
      db.execSQL("INSERT INTO settings VALUES ('app',4,15,600,840,1020,'system',1,'dark','preferences')")
    }
    val db = Room.databaseBuilder(context, ContentDatabase::class.java, "content-v2.db").allowMainThreadQueries()
      .addMigrations(ContentDatabase.MIGRATION_2_3, ContentDatabase.MIGRATION_3_4, ContentDatabase.MIGRATION_4_5).build()
    try {
      assertEquals(1800L, db.records().find("v2")!!.definedAlarmAtMs)
      assertEquals("Retained", db.records().find("v2")!!.notes)
      assertEquals(15, db.records().settings()!!.snoozeMinutes)
      assertEquals("dark", db.records().settings()!!.theme)
      assertTrue(db.records().series().isEmpty())
    } finally { db.close(); context.deleteDatabase("content-v2.db") }
  }
  @Test fun secondBetaProtectedUpgradeKeepsCurrentTargetAndSoundProfile() {
    val context = RuntimeEnvironment.getApplication().createDeviceProtectedStorageContext()
    legacy(context, "com.remilo.alarm.data.OperationalDatabase", "protected-v2.db", 2).use { db ->
      db.execSQL("INSERT INTO alerts (occurrenceId,targetMs,generation,state,mode,sound,vibration,snoozeMinutes) VALUES ('v2',60000,9,'Scheduled','Alarm','system',1,15)")
    }
    val db = Room.databaseBuilder(context, OperationalDatabase::class.java, "protected-v2.db").allowMainThreadQueries()
      .addMigrations(OperationalDatabase.MIGRATION_2_3, OperationalDatabase.MIGRATION_3_4, OperationalDatabase.MIGRATION_4_5, OperationalDatabase.MIGRATION_5_6).build()
    try {
      val alert = db.records().find("v2")!!
      assertEquals(60000L, alert.targetMs); assertEquals(9L, alert.generation)
      assertEquals("system", alert.sound); assertTrue(alert.vibration)
      assertNull(alert.segmentId); assertTrue(db.records().plans().isEmpty())
    } finally { db.close(); context.deleteDatabase("protected-v2.db") }
  }
  @Test fun listMigrationPreservesExactNamesAndAllRetainedTemplateMemberships() {
    val context = RuntimeEnvironment.getApplication()
    val work = ReminderRecord("template", "Repeat", 1000, 2000, 1500, 500, listName = "Work", definedAlarmAtMs = 1000, zoneId = "UTC")
    val spaced = work.copy(listName = " Work ")
    legacy(context, "com.remilo.alarm.data.ContentDatabase", "content-v3-lists.db", 3).use { db ->
      db.execSQL("INSERT INTO reminders (id,title,eventStartMs,eventEndMs,dueAtMs,createdAtMs,completed,revision,listName) VALUES ('a','A',1000,2000,1500,500,0,8,'Work')")
      db.execSQL("INSERT INTO reminders (id,title,eventStartMs,eventEndMs,dueAtMs,createdAtMs,completed,revision,listName,deleted) VALUES ('b','B',1000,2000,1500,500,1,9,'work',1)")
      db.execSQL("INSERT INTO series VALUES ('active','family',?,'{}',4,'Paused',500)", arrayOf(JSONObject(BackupCodec.record(work)).toString()))
      db.execSQL("INSERT INTO series VALUES ('old','family',?,'{}',5,'Archived',500)", arrayOf(JSONObject(BackupCodec.record(spaced)).toString()))
    }
    val db = Room.databaseBuilder(context, ContentDatabase::class.java, "content-v3-lists.db").allowMainThreadQueries()
      .addMigrations(ContentDatabase.MIGRATION_3_4, ContentDatabase.MIGRATION_4_5).build()
    try {
      assertEquals(setOf("Work", "work", " Work "), db.records().lists().map { it.name }.toSet())
      assertEquals(3, db.records().lists().map { it.id }.toSet().size)
      assertEquals(ListNames.legacyId("Work"), db.records().find("a")!!.listId)
      assertEquals(ListNames.legacyId("work"), db.records().find("b")!!.listId)
      assertTrue(db.records().find("b")!!.completed); assertTrue(db.records().find("b")!!.deleted)
      assertEquals(8L, db.records().find("a")!!.revision)
      val active = db.records().series("active")!!; val archived = db.records().series("old")!!
      assertEquals("Paused", active.state); assertEquals(4L, active.revision)
      assertEquals("Archived", archived.state); assertEquals(5L, archived.revision)
      assertEquals(ListNames.legacyId("Work"), BackupCodec.decodeRecord(JSONObject(active.template)).listId)
      assertEquals(ListNames.legacyId(" Work "), BackupCodec.decodeRecord(JSONObject(archived.template)).listId)
    } finally { db.close(); context.deleteDatabase("content-v3-lists.db") }
  }
  @Test fun atmosphereUpgradePreservesBrightnessAndSettingReceiptWithoutTouchingContent() {
    val context = RuntimeEnvironment.getApplication()
    legacy(context, "com.remilo.alarm.data.ContentDatabase", "content-v4-appearance.db", 4).use { db ->
      db.execSQL("INSERT INTO settings VALUES ('app',9,15,620,840,1040,'system',1,'dark','saved-settings')")
      db.execSQL("INSERT INTO reminders (id,title,eventStartMs,eventEndMs,dueAtMs,createdAtMs,completed,revision) VALUES ('old','Private',1000,2000,1500,500,0,7)")
    }
    val db = Room.databaseBuilder(context, ContentDatabase::class.java, "content-v4-appearance.db").allowMainThreadQueries()
      .addMigrations(ContentDatabase.MIGRATION_4_5).build()
    try {
      val settings = db.records().settings()!!
      assertEquals("automatic", settings.atmosphere); assertEquals("dark", settings.theme)
      assertEquals(9L, settings.revision); assertEquals("saved-settings", settings.lastOperationId)
      assertEquals(7L, db.records().find("old")!!.revision)
    } finally { db.close(); context.deleteDatabase("content-v4-appearance.db") }
  }
  @Test fun appearanceProtectedUpgradeKeepsDeliveryAndDoesNotInventSessionCapture() {
    val context = RuntimeEnvironment.getApplication().createDeviceProtectedStorageContext()
    legacy(context, "com.remilo.alarm.data.OperationalDatabase", "protected-v3-appearance.db", 3).use { db ->
      db.execSQL("INSERT INTO alerts (occurrenceId,targetMs,generation,state,sessionId) VALUES ('old',60000,7,'Alerting','session')")
      db.execSQL("INSERT INTO sessions VALUES ('session','Active',1000,301000,'system',1)")
    }
    val db = Room.databaseBuilder(context, OperationalDatabase::class.java, "protected-v3-appearance.db").allowMainThreadQueries()
      .addMigrations(OperationalDatabase.MIGRATION_3_4, OperationalDatabase.MIGRATION_4_5, OperationalDatabase.MIGRATION_5_6).build()
    try {
      assertNull(db.records().appearance())
      val session = db.records().activeSession()!!
      assertNull(session.resolvedAtmosphere); assertNull(session.resolvedBrightness)
      assertEquals(301000L, session.deadlineElapsedMs); assertEquals("system", session.sound)
      assertEquals(7L, db.records().find("old")!!.generation); assertEquals(60000L, db.records().find("old")!!.targetMs)
      val columns = mutableListOf<String>()
      db.openHelper.readableDatabase.query("PRAGMA table_info(appearance_preferences)").use { cursor ->
        while (cursor.moveToNext()) columns.add(cursor.getString(1))
      }
      assertEquals(listOf("id", "atmosphere", "theme"), columns)
    } finally { db.close(); context.deleteDatabase("protected-v3-appearance.db") }
  }
  @Test fun protectedV4UpgradeKeepsLegacyStopsAndAddsOnlyCompletionIdentityTables() {
    val context = RuntimeEnvironment.getApplication()
    legacy(context, "com.remilo.alarm.data.OperationalDatabase", "protected-v4-completion.db", 4).use { db ->
      db.execSQL("INSERT INTO alerts (occurrenceId,targetMs,generation,state) VALUES ('legacy',60000,7,'Stopped')")
      db.execSQL("INSERT INTO actions (operationId,occurrenceId,kind,occurredAtMs,generation) VALUES ('old-stop','legacy','Stop',50000,7)")
    }
    val db = Room.databaseBuilder(context, OperationalDatabase::class.java, "protected-v4-completion.db").allowMainThreadQueries()
      .addMigrations(OperationalDatabase.MIGRATION_4_5, OperationalDatabase.MIGRATION_5_6).build()
    try {
      assertEquals("Stopped", db.records().find("legacy")!!.state)
      assertEquals("Stop", db.records().action("old-stop")!!.kind)
      assertTrue(db.records().completions().isEmpty())
      assertNull(db.records().completionReceipt("old-stop"))
      for (table in listOf("completion_receipts", "pending_completions")) {
        val columns = mutableListOf<String>()
        db.openHelper.readableDatabase.query("PRAGMA table_info($table)").use { cursor ->
          while (cursor.moveToNext()) columns.add(cursor.getString(1))
        }
        assertFalse(columns.any { it in setOf("title", "notes", "listName", "template", "credentials") })
      }
    } finally { db.close(); context.deleteDatabase("protected-v4-completion.db") }
  }
  @Test fun protectedV5UpgradeRetainsLegacyCompletionFingerprintsAndSnoozeProfiles() {
    val context = RuntimeEnvironment.getApplication().createDeviceProtectedStorageContext()
    legacy(context, "com.remilo.alarm.data.OperationalDatabase", "protected-v5-actions.db", 5).use { db ->
      db.execSQL("INSERT INTO alerts (occurrenceId,targetMs,generation,state,snoozeMinutes) VALUES ('old',60000,7,'Completed',15)")
      db.execSQL("INSERT INTO completion_receipts VALUES ('done','Stop','old',6,NULL,7,1)")
      db.execSQL("INSERT INTO pending_completions VALUES ('done','old',7,50000)")
    }
    val db = Room.databaseBuilder(context, OperationalDatabase::class.java, "protected-v5-actions.db").allowMainThreadQueries()
      .addMigrations(OperationalDatabase.MIGRATION_5_6).build()
    try {
      val receipt = db.records().completionReceipt("done")!!
      assertEquals("Stop", receipt.kind); assertEquals(6L, receipt.expectedGeneration); assertNull(receipt.snapshotKey)
      assertEquals(15, db.records().find("old")!!.snoozeMinutes)
      assertEquals(50000L, db.records().completions().single().occurredAtMs)
      assertTrue(db.records().pendingBulkSnoozes().isEmpty())
      for (table in listOf("bulk_snooze_receipts", "bulk_snooze_members")) {
        val columns = mutableListOf<String>()
        db.openHelper.readableDatabase.query("PRAGMA table_info($table)").use { cursor ->
          while (cursor.moveToNext()) columns.add(cursor.getString(1))
        }
        assertFalse(columns.any { it in setOf("title", "notes", "listName", "template", "credentials") })
      }
    } finally { db.close(); context.deleteDatabase("protected-v5-actions.db") }
  }
}

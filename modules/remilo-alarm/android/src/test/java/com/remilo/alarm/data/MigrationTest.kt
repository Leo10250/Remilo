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
      .allowMainThreadQueries().addMigrations(ContentDatabase.MIGRATION_1_2, ContentDatabase.MIGRATION_2_3, ContentDatabase.MIGRATION_3_4).build()
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
      .allowMainThreadQueries().addMigrations(OperationalDatabase.MIGRATION_1_2, OperationalDatabase.MIGRATION_2_3).build()
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
      .addMigrations(ContentDatabase.MIGRATION_2_3, ContentDatabase.MIGRATION_3_4).build()
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
      .addMigrations(OperationalDatabase.MIGRATION_2_3).build()
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
      .addMigrations(ContentDatabase.MIGRATION_3_4).build()
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
}

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
  private fun legacy(context: Context, database: String, name: String): SQLiteDatabase {
    context.deleteDatabase(name)
    val path = context.getDatabasePath(name)
    path.parentFile!!.mkdirs()
    val source = javaClass.getResourceAsStream("/$database/1.json")!!.bufferedReader().use { it.readText() }
    val schema = JSONObject(source).getJSONObject("database")
    return SQLiteDatabase.openOrCreateDatabase(path, null).also { db ->
      val entities = schema.getJSONArray("entities")
      for (index in 0 until entities.length()) {
        val entity = entities.getJSONObject(index)
        db.execSQL(entity.getString("createSql").replace("\${TABLE_NAME}", entity.getString("tableName")))
      }
      val setup = schema.getJSONArray("setupQueries")
      for (index in 0 until setup.length()) db.execSQL(setup.getString(index))
      db.version = 1
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
      .allowMainThreadQueries().addMigrations(ContentDatabase.MIGRATION_1_2).build()
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
      .allowMainThreadQueries().addMigrations(OperationalDatabase.MIGRATION_1_2).build()
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
}

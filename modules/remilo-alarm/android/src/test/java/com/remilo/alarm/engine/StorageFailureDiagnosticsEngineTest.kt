package com.remilo.alarm.engine

import android.app.Application
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.os.UserManager
import android.util.Log
import com.remilo.alarm.data.AlertRecord
import com.remilo.alarm.data.OperationalDatabase
import com.remilo.alarm.data.ContentDatabase
import com.remilo.alarm.system.AlarmRegistrar
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import org.robolectric.shadows.ShadowLog
import java.io.File
import java.util.concurrent.CompletableFuture
import java.util.concurrent.TimeUnit

/** Reproduces one possible generic query failure, not a diagnosis of a connected phone. */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34], application = Application::class)
class StorageFailureDiagnosticsEngineTest {
  private lateinit var context: Context
  private var engine: AlarmEngine? = null
  private var registrations = 0
  private var cancellations = 0
  private val registrar = object : AlarmRegistrar {
    override fun canSchedule() = true
    override fun register(alert: AlertRecord) { registrations++ }
    override fun cancel(alert: AlertRecord) { cancellations++ }
  }

  @Before fun setup() {
    context = RuntimeEnvironment.getApplication()
    shadowOf(context.getSystemService(UserManager::class.java)).setUserUnlocked(true)
    ShadowLog.clear()
  }

  @After fun teardown() { engine?.close(); engine = null }

  @Test fun newerOperationalSchemaRejectsAgendaWithoutChangingItsDataOrVersion() {
    assertNewerSchemaRemainsIntact(context.createDeviceProtectedStorageContext(), "remilo-operational.db",
      OperationalDatabase.VERSION + 1, OperationalDatabase.VERSION)
  }

  @Test fun newerCredentialSchemaRejectsAgendaWithoutChangingItsDataOrVersion() {
    assertNewerSchemaRemainsIntact(context, "remilo-content.db", ContentDatabase.VERSION + 1, ContentDatabase.VERSION)
  }

  private fun assertNewerSchemaRemainsIntact(databaseContext: Context, name: String, newerVersion: Int, currentVersion: Int) {
    val file = databaseContext.getDatabasePath(name)
    assertFalse("The isolated fixture must start without an existing database", file.exists())
    file.parentFile!!.mkdirs()
    val marker = "private-marker-not-for-diagnostics"
    SQLiteDatabase.openOrCreateDatabase(file, null).use { db ->
      db.execSQL("CREATE TABLE fixture_marker (id INTEGER NOT NULL PRIMARY KEY, value TEXT NOT NULL)")
      db.execSQL("INSERT INTO fixture_marker (id, value) VALUES (?, ?)", arrayOf<Any>(1, marker))
      db.version = newerVersion
    }

    val owner = AlarmEngine(context, registrar, { 1_800_000_000_000L }, { 10_000L }, calendarOpportunity = {})
    engine = owner
    val result = CompletableFuture<String>()
    owner.request({ owner.query(mapOf("view" to "agenda"), null) },
      { result.complete("unexpected-success") }, { result.complete(it) })
    assertEquals("NOT_AVAILABLE", result.get(20, TimeUnit.SECONDS))
    owner.close(); engine = null

    assertTrue("A failed open must retain the existing database", file.isFile)
    assertMarker(file, newerVersion, marker)
    assertEquals("A failed query must not register alarms", 0, registrations)
    assertEquals("A failed query must not cancel existing alarms", 0, cancellations)

    val requestErrors = ShadowLog.getLogsForTag("Remilo").filter {
      it.type == Log.ERROR && it.msg.startsWith("Native request failed: ")
    }
    assertTrue("The failed request must expose its safe migration classification", requestErrors.any {
      it.msg == "Native request failed: type=room_missing_migration from=$newerVersion to=$currentVersion exception=IllegalStateException"
    })
    requestErrors.forEach { entry ->
      assertNull("Diagnostics must not attach the original exception", entry.throwable)
      assertFalse(entry.msg.contains(marker))
      assertFalse(entry.msg.contains(file.absolutePath))
      assertFalse(entry.msg.contains("fixture_marker"))
      assertFalse(entry.msg.contains("CREATE TABLE"))
    }
  }

  private fun assertMarker(file: File, version: Int, expected: String) {
    SQLiteDatabase.openDatabase(file.absolutePath, null, SQLiteDatabase.OPEN_READONLY).use { db ->
      assertEquals(version, db.version)
      db.rawQuery("SELECT value FROM fixture_marker WHERE id = 1", null).use { row ->
        assertTrue(row.moveToFirst())
        assertEquals(expected, row.getString(0))
        assertFalse(row.moveToNext())
      }
    }
  }
}

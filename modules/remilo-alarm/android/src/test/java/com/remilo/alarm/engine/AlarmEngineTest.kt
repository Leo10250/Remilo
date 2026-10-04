package com.remilo.alarm.engine

import android.app.Application
import android.content.Context
import android.os.UserManager
import com.remilo.alarm.data.*
import com.remilo.alarm.system.AlarmRegistrar
import com.remilo.alarm.system.AlarmScheduler
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import java.util.concurrent.CompletableFuture
import java.util.concurrent.TimeUnit

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34], application = Application::class)
class AlarmEngineTest {
  private lateinit var context: Context
  private lateinit var engine: AlarmEngine
  private var now = 1_800_000_000_000L
  private val os = FakeRegistrar()
  @Before fun setup() {
    context = RuntimeEnvironment.getApplication()
    shadowOf(context.getSystemService(UserManager::class.java)).setUserUnlocked(true)
    context.deleteDatabase("remilo-content.db")
    context.createDeviceProtectedStorageContext().deleteDatabase("remilo-operational.db")
    engine = AlarmEngine(context, os, { now }, { 10_000L })
  }
  @After fun teardown() { engine.close() }
  private fun request(body: () -> Any?): Any? {
    val result = CompletableFuture<Any?>()
    engine.request(body, { result.complete(it) }, { result.completeExceptionally(AssertionError(it)) })
    return result.get(20, TimeUnit.SECONDS)
  }
  @Suppress("UNCHECKED_CAST") private fun create(operation: String = "create"): Map<String, Any?> =
    request { engine.apply(mapOf("kind" to "Create", "operationId" to operation,
      "title" to "Private title", "alarmAtMs" to now + 60_000)) } as Map<String, Any?>
  @Suppress("UNCHECKED_CAST") private fun id(result: Map<String, Any?>) =
    (result["occurrence"] as Map<String, Any?>)["id"] as String
  @Suppress("UNCHECKED_CAST") private fun action(id: String, kind: String, generation: Long, operation: String) =
    request { engine.apply(mapOf("kind" to kind, "operationId" to operation,
      "occurrenceId" to id, "expectedGeneration" to generation)) } as Map<String, Any?>
  private fun fire(id: String, generation: Long = 1) {
    val done = CompletableFuture<Unit>()
    engine.receive(AlarmScheduler.intent(context, "fire", id, generation)) { done.complete(Unit) }
    done.get(20, TimeUnit.SECONDS)
  }

  @Test fun retryingCreationNeverDuplicatesTheReminder() {
    val first = create()
    val retry = create()
    assertEquals(id(first), id(retry))
    val page = request { engine.query("all", null) } as Map<*, *>
    assertEquals(1, (page["items"] as List<*>).size)
    assertEquals("Scheduled", first["status"])
  }
  @Test fun snoozeFencesOldActionsAndDoesNotChangeDueTime() {
    val id = id(create())
    now += 60_000
    fire(id)
    val before = request { engine.occurrence(id) } as Map<*, *>
    assertEquals("Alerting", before["deliveryState"])
    assertEquals("Applied", action(id, "Snooze", 1, "snooze")["status"])
    assertEquals("STALE_GENERATION", action(id, "Stop", 1, "old-stop")["errorCode"])
    fire(id, 1)
    val after = request { engine.occurrence(id) } as Map<*, *>
    assertEquals("Scheduled", after["deliveryState"])
    assertEquals(before["dueAtMs"], after["dueAtMs"])
    assertEquals(now + 600_000, after["nextAlertMs"])
    assertEquals(false, after["completed"])
  }
  @Test fun stopNeverCompletesAndCannotStopAFutureDelivery() {
    val id = id(create())
    assertEquals("NOT_RINGING", action(id, "Stop", 1, "too-early")["errorCode"])
    now += 60_000; fire(id)
    action(id, "Stop", 1, "stop")
    val after = request { engine.occurrence(id) } as Map<*, *>
    assertEquals("Stopped", after["deliveryState"])
    assertEquals(false, after["completed"])
  }
  @Test fun registrationFailureLeavesARecoverableSave() {
    os.fail = true
    val first = create()
    assertEquals("Blocked", first["status"])
    os.fail = false
    val done = CompletableFuture<Unit>()
    engine.recover { done.complete(Unit) }; done.get(20, TimeUnit.SECONDS)
    val after = request { engine.occurrence(id(first)) } as Map<*, *>
    assertEquals("Scheduled", after["deliveryState"])
  }
  @Test fun recoveryNeverReplaysAnElapsedAlarm() {
    val id = id(create())
    os.registered.clear()
    now += 60_001
    val done = CompletableFuture<Unit>()
    engine.recover { done.complete(Unit) }; done.get(20, TimeUnit.SECONDS)
    assertTrue(os.registered.isEmpty())
    assertEquals("Missed", (request { engine.occurrence(id) } as Map<*, *>)["deliveryState"])
  }
  @Test fun oldProjectionAndHistoryCannotUndoANativeSnooze() {
    val id = id(create())
    action(id, "Snooze", 1, "snooze")
    request {
      val db = ContentDatabase.open(context)
      try {
        db.records().pending(PendingSchedule("interrupted-old-save", id, now + 60_000, 1))
      } finally { db.close() }
    }
    val done = CompletableFuture<Unit>()
    engine.recover { done.complete(Unit) }; done.get(20, TimeUnit.SECONDS)
    val after = request { engine.occurrence(id) } as Map<*, *>
    assertEquals(2L, after["generation"])
    assertEquals(now + 600_000, after["nextAlertMs"])
    request {
      val db = ContentDatabase.open(context)
      try {
        assertTrue(db.records().pending().isEmpty())
        assertEquals("Snooze", db.records().history(id).single().kind)
      } finally { db.close() }
    }
  }
  @Test fun coldProcessInterruptsAnActiveSessionSilently() {
    val id = id(create())
    now += 60_000; fire(id)
    engine.close()
    os.registered.clear()
    engine = AlarmEngine(context, os, { now }, { 1L })
    val after = request { engine.occurrence(id) } as Map<*, *>
    assertEquals("Interrupted", after["deliveryState"])
    assertTrue(os.registered.isEmpty())
  }
  @Test fun directBootDoesNotOpenCredentialStorage() {
    val id = id(create())
    engine.close()
    shadowOf(context.getSystemService(UserManager::class.java)).setUserUnlocked(false)
    engine = AlarmEngine(context, os, { now }, { 10_000L })
    now += 60_000; fire(id)
    val done = CompletableFuture<List<Pair<AlertRecord, String>>>()
    val session = request {
      val db = OperationalDatabase.open(context)
      try { db.records().activeSession()!!.id } finally { db.close() }
    } as String
    engine.sessionMembers(session) { done.complete(it) }
    assertEquals("Reminder", done.get(20, TimeUnit.SECONDS).single().second)
    action(id, "Snooze", 1, "locked-snooze")
    assertEquals(2L, os.registered.last().generation)
  }
  private class FakeRegistrar : AlarmRegistrar {
    var fail = false
    val registered = mutableListOf<AlertRecord>()
    override fun canSchedule() = true
    override fun register(alert: AlertRecord) { if (fail) throw SecurityException(); registered.add(alert) }
    override fun cancel(alert: AlertRecord) {}
  }
}

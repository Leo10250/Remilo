package com.remilo.alarm.engine

import android.app.Application
import android.app.Notification
import android.content.Context
import android.os.UserManager
import com.remilo.alarm.data.*
import com.remilo.alarm.system.AlarmRegistrar
import com.remilo.alarm.system.AlarmScheduler
import com.remilo.alarm.system.RingingService
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
  @Suppress("UNCHECKED_CAST") private fun create(operation: String = "create", delayMs: Long = 60_000): Map<String, Any?> =
    request { engine.apply(mapOf("kind" to "Create", "operationId" to operation,
      "title" to "Private title", "alarmAtMs" to now + delayMs)) } as Map<String, Any?>
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
  private fun deliveryNotification(): Pair<android.content.Intent, Notification> {
    val intent = shadowOf(RuntimeEnvironment.getApplication()).nextStartedService
    assertNotNull("Native delivery must dispatch its foreground service", intent)
    val notification = intent!!.getParcelableExtra(RingingService.INITIAL_NOTIFICATION, Notification::class.java)
    assertNotNull("The first foreground notification must contain controls", notification)
    return intent to notification!!
  }

  @Test fun retryingCreationNeverDuplicatesTheReminder() {
    val first = create()
    val retry = create()
    assertEquals(id(first), id(retry))
    val page = request { engine.query("all", null) } as Map<*, *>
    assertEquals(1, (page["items"] as List<*>).size)
    assertEquals("Scheduled", first["status"])
  }
  @Test fun invalidCommandsIdentifyTheirFieldWithoutPersistingOrScheduling() {
    val cases = listOf(
      "operationId" to " ", "title" to " ", "alarmAtMs" to Double.NaN,
      "alarmAtMs" to now, "alarmAtMs" to now + 60_000.5,
      "eventEndMs" to now, "dueAtMs" to "not a date")
    cases.forEachIndexed { index, (field, value) ->
      val command = mapOf("kind" to "Create", "operationId" to "invalid-$index",
        "title" to "Private title", "alarmAtMs" to now + 60_000) + (field to value)
      val result = request { engine.apply(command) } as Map<*, *>
      assertEquals("Rejected", result["status"])
      assertEquals("INVALID_INPUT", result["errorCode"])
      assertEquals(field, result["errorField"])
      assertFalse(result["errorMessage"].toString().contains("Private title"))
    }
    assertTrue(os.registered.isEmpty())
    val page = request { engine.query("all", null) } as Map<*, *>
    assertTrue((page["items"] as List<*>).isEmpty())
    request {
      val db = ContentDatabase.open(context)
      try { assertTrue(db.records().pending().isEmpty()) } finally { db.close() }
    }
  }
  @Test fun malformedDeliveryGenerationsCannotSnoozeOrChangeTheCurrentAlarm() {
    val id = id(create())
    listOf(Double.NaN, Double.POSITIVE_INFINITY, 0.0, 1.5).forEachIndexed { index, generation ->
      val result = request { engine.apply(mapOf("kind" to "Snooze", "operationId" to "invalid-$index",
        "occurrenceId" to id, "expectedGeneration" to generation)) } as Map<*, *>
      assertEquals("Rejected", result["status"])
      assertEquals("expectedGeneration", result["errorField"])
    }
    val after = request { engine.occurrence(id) } as Map<*, *>
    assertEquals(1L, after["generation"])
    assertEquals(now + 60_000, after["nextAlertMs"])
    assertEquals(1, os.registered.size)
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
  @Test fun firstAndSnoozedDeliveriesIncludeUsableControlsFromTheirFirstPost() {
    val id = id(create())
    now += 60_000; fire(id)
    val (firstIntent, first) = deliveryNotification()
    assertEquals(listOf("Stop", "Snooze 10 min"), first.actions.map { it.title.toString() })
    assertTrue(first.actions.all { it.actionIntent.isImmutable })
    val oldStop = shadowOf(first.actions[0].actionIntent).savedIntent
    assertEquals(1L, oldStop.getLongExtra("generation", -1))
    action(id, "Snooze", 1, "snooze")
    engine.audioEnded(firstIntent.getStringExtra("sessionId")!!, "Stopped")
    request { Unit }
    now += 600_000; fire(id, 2)
    val (_, second) = deliveryNotification()
    assertEquals(listOf("Stop", "Snooze 10 min"), second.actions.map { it.title.toString() })
    val newStop = shadowOf(second.actions[0].actionIntent).savedIntent
    assertEquals(2L, newStop.getLongExtra("generation", -1))
    assertNotEquals(first.actions[0].actionIntent, second.actions[0].actionIntent)
    val done = CompletableFuture<Unit>()
    engine.receive(oldStop) { done.complete(Unit) }; done.get(20, TimeUnit.SECONDS)
    assertEquals("Alerting", (request { engine.occurrence(id) } as Map<*, *>)["deliveryState"])
    val stopped = CompletableFuture<Unit>()
    engine.receive(newStop) { stopped.complete(Unit) }; stopped.get(20, TimeUnit.SECONDS)
    val after = request { engine.occurrence(id) } as Map<*, *>
    assertEquals("Stopped", after["deliveryState"])
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
  @Test fun committedCreationRecoversBeforeItsOperationalProjectionExists() {
    val savedId = "committed-reminder"
    request {
      val db = ContentDatabase.open(context)
      try {
        db.runInTransaction {
          db.records().insert(ReminderRecord(savedId, "Private title", now + 60_000,
            now + 1_860_000, now + 60_000, now))
          db.records().pending(PendingSchedule("interrupted-create", savedId, now + 60_000, 1))
          db.records().receipt(CreationReceipt("interrupted-create", savedId))
        }
      } finally { db.close() }
    }
    assertTrue(os.registered.isEmpty())
    engine.close()
    engine = AlarmEngine(context, os, { now }, { 1L })
    val recovered = CompletableFuture<Unit>()
    engine.recover { recovered.complete(Unit) }; recovered.get(20, TimeUnit.SECONDS)
    assertEquals(savedId, id(create("interrupted-create")))
    assertEquals(setOf(savedId), os.active.keys)
    assertEquals("Scheduled", (request { engine.occurrence(savedId) } as Map<*, *>)["deliveryState"])
    request {
      val db = ContentDatabase.open(context)
      try {
        assertEquals(1, db.records().all().size)
        assertTrue(db.records().pending().isEmpty())
      } finally { db.close() }
    }
  }
  @Test fun committedStopFencesAnObsoleteCallbackAcrossRecovery() {
    val id = id(create())
    now += 60_000; fire(id)
    deliveryNotification()
    request {
      val operational = OperationalDatabase.open(context)
      val content = ContentDatabase.open(context)
      try {
        // Persisted boundary: the native transaction committed, but cancellation
        // and history copying did not run before process loss.
        operational.runInTransaction {
          operational.records().put(AlertRecord(id, now, 2, "Stopped"))
          operational.records().action(ActionRecord("interrupted-stop", id, "Stop", now, 2))
        }
        content.records().pending(PendingSchedule("obsolete-create", id, now, 1))
      } finally { operational.close(); content.close() }
    }
    assertEquals(1L, os.active[id]!!.generation)
    engine.close()
    engine = AlarmEngine(context, os, { now }, { 1L })
    val recovered = CompletableFuture<Unit>()
    engine.recover { recovered.complete(Unit) }; recovered.get(20, TimeUnit.SECONDS)
    fire(id, 1)
    assertNull(shadowOf(RuntimeEnvironment.getApplication()).nextStartedService)
    val after = request { engine.occurrence(id) } as Map<*, *>
    assertEquals("Stopped", after["deliveryState"])
    assertEquals(2L, after["generation"])
    assertEquals(false, after["completed"])
    assertEquals(1, os.registered.size)
    request {
      val db = ContentDatabase.open(context)
      try {
        assertTrue(db.records().pending().isEmpty())
        assertEquals("Stop", db.records().history(id).single().kind)
      } finally { db.close() }
    }
  }
  @Test fun historyCopyCommittedBeforeAcknowledgementIsIdempotent() {
    val id = id(create())
    action(id, "Snooze", 1, "copied-snooze")
    request {
      val db = ContentDatabase.open(context)
      try { db.records().history(HistoryRecord("copied-snooze", id, "Snooze", now, 2)) }
      finally { db.close() }
    }
    engine.close()
    engine = AlarmEngine(context, os, { now }, { 1L })
    val recovered = CompletableFuture<Unit>()
    engine.recover { recovered.complete(Unit) }; recovered.get(20, TimeUnit.SECONDS)
    val after = request { engine.occurrence(id) } as Map<*, *>
    assertEquals(2L, after["generation"])
    assertEquals(now + 600_000, after["nextAlertMs"])
    request {
      val content = ContentDatabase.open(context)
      val operational = OperationalDatabase.open(context)
      try {
        assertEquals(1, content.records().history(id).size)
        assertTrue(operational.records().actions().isEmpty())
      } finally { content.close(); operational.close() }
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
  @Test fun interruptedEarlierDeliveryDoesNotRemoveTheIndependentLaterAlarm() {
    val first = id(create("first"))
    val second = id(create("second", 120_000))
    assertEquals(setOf(first, second), os.registered.map { it.occurrenceId }.toSet())
    now += 60_000
    fire(first)
    engine.close()
    engine = AlarmEngine(context, os, { now }, { 1L })
    assertEquals("Interrupted", (request { engine.occurrence(first) } as Map<*, *>)["deliveryState"])
    assertEquals("Scheduled", (request { engine.occurrence(second) } as Map<*, *>)["deliveryState"])
    now += 60_000
    fire(second)
    assertEquals("Alerting", (request { engine.occurrence(second) } as Map<*, *>)["deliveryState"])
  }
  @Test fun joiningAnActiveSessionKeepsItsFirstDeadlineAndIndependentMembers() {
    val first = id(create("first"))
    val second = id(create("second"))
    now += 60_000
    fire(first)
    val sessionId = request {
      val db = OperationalDatabase.open(context)
      try { db.records().activeSession()!!.id } finally { db.close() }
    } as String
    engine.audioStarted(sessionId, 9_000L)
    fire(second)
    request {
      val db = OperationalDatabase.open(context)
      try {
        assertEquals(309_000L, db.records().activeSession()!!.deadlineElapsedMs)
        assertEquals(setOf(first, second), db.records().members(sessionId).map { it.occurrenceId }.toSet())
      } finally { db.close() }
    }
    action(first, "Stop", 1, "stop-first")
    assertEquals("Stopped", (request { engine.occurrence(first) } as Map<*, *>)["deliveryState"])
    assertEquals("Alerting", (request { engine.occurrence(second) } as Map<*, *>)["deliveryState"])
  }
  @Test fun directBootDoesNotOpenCredentialStorage() {
    val id = id(create())
    engine.close()
    shadowOf(context.getSystemService(UserManager::class.java)).setUserUnlocked(false)
    engine = AlarmEngine(context, os, { now }, { 10_000L })
    now += 60_000; fire(id)
    val (_, notification) = deliveryNotification()
    assertEquals("Reminder", notification.extras.getCharSequence(Notification.EXTRA_TEXT).toString())
    assertEquals(listOf("Stop", "Snooze 10 min"), notification.actions.map { it.title.toString() })
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
    val active = mutableMapOf<String, AlertRecord>()
    override fun canSchedule() = true
    override fun register(alert: AlertRecord) {
      if (fail) throw SecurityException()
      registered.add(alert)
      active[alert.occurrenceId] = alert
    }
    override fun cancel(alert: AlertRecord) {
      if (active[alert.occurrenceId]?.generation == alert.generation) active.remove(alert.occurrenceId)
    }
  }
}

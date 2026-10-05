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
    assertEquals("Reminder", notification.extras.getCharSequence(Notification.EXTRA_TITLE).toString())
    assertEquals("Remilo · alarm ringing", notification.extras.getCharSequence(Notification.EXTRA_TEXT).toString())
    assertFalse(notification.extras.toString().contains("Private title"))
    assertEquals(listOf("Stop", "Snooze 10 min"), notification.actions.map { it.title.toString() })
    val done = CompletableFuture<List<Pair<AlertRecord, String>>>()
    val session = request {
      val db = OperationalDatabase.open(context)
      try { db.records().activeSession()!!.id } finally { db.close() }
    } as String
    engine.sessionMembers(session) { done.complete(it) }
    assertEquals("Reminder", done.get(20, TimeUnit.SECONDS).single().second)
    val snapshot = CompletableFuture<AlarmEngine.SessionSnapshot>()
    engine.sessionSnapshot(session, { snapshot.complete(it) }, { snapshot.completeExceptionally(AssertionError(it)) })
    val controls = snapshot.get(20, TimeUnit.SECONDS)
    assertEquals("system", controls.theme)
    assertEquals("Reminder", controls.members.single().second)
    assertEquals("Starting", controls.state)
    action(id, "Snooze", 1, "locked-snooze")
    assertEquals(2L, os.registered.last().generation)
  }
  @Test fun postponeReplacesSnoozeAndPreservesOriginalTiming() {
    val id = id(create())
    val original = request { engine.occurrence(id) } as Map<*, *>
    action(id, "Snooze", 1, "snooze")
    val result = request { engine.apply(mapOf("kind" to "Postpone", "operationId" to "postpone",
      "occurrenceId" to id, "expectedGeneration" to 2, "alarmAtMs" to now + 900_000)) } as Map<*, *>
    assertEquals("Applied", result["status"])
    fire(id, 1); fire(id, 2)
    assertNull(shadowOf(RuntimeEnvironment.getApplication()).nextStartedService)
    val after = request { engine.occurrence(id) } as Map<*, *>
    assertEquals(3L, after["generation"])
    assertEquals(now + 900_000, after["nextAlertMs"])
    listOf("eventStartMs", "eventEndMs", "dueAtMs", "alarmAtMs").forEach { assertEquals(original[it], after[it]) }
    assertEquals(3L, os.active[id]!!.generation)
  }
  @Test fun doneCancelsTheAlertAndPastReopenDoesNotReplayIt() {
    val id = id(create())
    val done = request { engine.apply(mapOf("kind" to "Done", "operationId" to "done",
      "occurrenceId" to id, "expectedRevision" to 1)) } as Map<*, *>
    assertEquals("Applied", done["status"])
    assertNull(os.active[id])
    assertEquals("STALE_GENERATION", action(id, "Snooze", 1, "old-snooze")["errorCode"])
    now += 60_001
    request { engine.apply(mapOf("kind" to "Reopen", "operationId" to "reopen",
      "occurrenceId" to id, "expectedRevision" to 2)) }
    fire(id, 1)
    assertNull(shadowOf(RuntimeEnvironment.getApplication()).nextStartedService)
    val after = request { engine.occurrence(id) } as Map<*, *>
    assertEquals(false, after["completed"])
    assertEquals("Missed", after["deliveryState"])
  }
  @Test fun metadataEditPreservesPostponementAndStaleRevisionIsRejected() {
    val id = id(create())
    action(id, "Snooze", 1, "snooze")
    now += 120_000 // The definition's original alert is now past, its Snooze is future.
    val edited = request { engine.apply(mapOf("kind" to "Edit", "operationId" to "edit",
      "occurrenceId" to id, "expectedRevision" to 1, "notes" to "Edited notes")) } as Map<*, *>
    assertEquals("Scheduled", edited["status"])
    val after = request { engine.occurrence(id) } as Map<*, *>
    assertEquals(2L, after["generation"])
    assertEquals(now - 120_000 + 600_000, after["nextAlertMs"])
    assertEquals("Edited notes", after["notes"])
    val stale = request { engine.apply(mapOf("kind" to "Delete", "operationId" to "delete",
      "occurrenceId" to id, "expectedRevision" to 1)) } as Map<*, *>
    assertEquals("STALE_REVISION", stale["errorCode"])
    assertEquals(false, (request { engine.occurrence(id) } as Map<*, *>)["deleted"])
  }
  @Test fun deleteAndUndoPreserveAFutureSnoozeWithoutRevivingOldCallbacks() {
    val id = id(create())
    action(id, "Snooze", 1, "snooze")
    request { engine.apply(mapOf("kind" to "Delete", "operationId" to "delete",
      "occurrenceId" to id, "expectedRevision" to 1)) }
    assertNull(os.active[id])
    fire(id, 1); fire(id, 2)
    request { engine.apply(mapOf("kind" to "UndoDelete", "operationId" to "undo",
      "occurrenceId" to id, "expectedRevision" to 2)) }
    val after = request { engine.occurrence(id) } as Map<*, *>
    assertEquals(now + 600_000, after["nextAlertMs"])
    assertEquals("Scheduled", after["deliveryState"])
    assertEquals(false, after["deleted"])
    assertEquals(4L, after["generation"])
    assertEquals(4L, os.active[id]!!.generation)
  }
  @Test fun backupRestorePreservesConflictsAndCopiesOnlyExplicitSelection() {
    val id = id(create())
    val json = request { engine.exportBackup() } as String
    assertFalse(json.contains("generation"))
    assertFalse(json.contains("sessionId"))
    val skipped = request { engine.importBackup(json, emptyList(), "restore-1") } as Map<*, *>
    assertEquals(0, skipped["added"])
    assertEquals(1, skipped["preserved"])
    val copied = request { engine.importBackup(json, listOf(id), "restore-2") } as Map<*, *>
    assertEquals(1, copied["added"])
    request { engine.importBackup(json, listOf(id), "restore-2") }
    val page = request { engine.query("all", null) } as Map<*, *>
    assertEquals(2, (page["items"] as List<*>).size)
    assertEquals(2, os.active.size)
  }
  @Test fun malformedBackupWritesNothingAndCompletedRestoreStaysSilent() {
    val id = id(create())
    request { engine.apply(mapOf("kind" to "Done", "operationId" to "done",
      "occurrenceId" to id, "expectedRevision" to 1)) }
    val json = request { engine.exportBackup() } as String
    val bad = json.replace("\"mode\": \"Alarm\"", "\"mode\": \"Unknown\"")
    request {
      try { engine.importBackup(bad, listOf(id), "invalid-backup"); fail("Malformed backup must be rejected") }
      catch (_: IllegalArgumentException) { /* no partial import */ }
    }
    assertEquals(1, (request { engine.query("history", null) } as Map<*, *>)["items"].let { (it as List<*>).size })
    request { engine.importBackup(json, listOf(id), "restore-completed") }
    assertTrue(os.active.isEmpty())
    assertEquals(2, ((request { engine.query("history", null) } as Map<*, *>)["items"] as List<*>).size)
  }
  @Test fun allDayUsesAnExclusiveLocalBoundaryAcrossDst() {
    val start = java.time.LocalDate.of(2027, 3, 14).atStartOfDay(java.time.ZoneId.of("America/Los_Angeles")).toInstant().toEpochMilli()
    now = start - 60_000
    val result = request { engine.apply(mapOf("kind" to "Create", "operationId" to "all-day",
      "title" to "All-day", "eventStartMs" to start, "allDay" to true, "zoneId" to "America/Los_Angeles")) } as Map<*, *>
    val item = result["occurrence"] as Map<*, *>
    assertEquals(start + 23 * 3_600_000L, item["dueAtMs"])
    assertEquals(start + 8 * 3_600_000L, item["alarmAtMs"])
    assertEquals(item["dueAtMs"], item["eventEndMs"])
  }
  @Test fun failedAlarmEditFencesTheOldGenerationAndRecoversTheNewTarget() {
    val id = id(create())
    os.fail = true
    val edited = request { engine.apply(mapOf("kind" to "Edit", "operationId" to "edit-alarm",
      "occurrenceId" to id, "expectedRevision" to 1, "alarmAtMs" to now + 300_000)) } as Map<*, *>
    assertEquals("Blocked", edited["status"])
    assertNull(os.active[id])
    fire(id, 1)
    assertNull(shadowOf(RuntimeEnvironment.getApplication()).nextStartedService)
    os.fail = false
    val recovered = CompletableFuture<Unit>()
    engine.recover { recovered.complete(Unit) }; recovered.get(20, TimeUnit.SECONDS)
    val after = request { engine.occurrence(id) } as Map<*, *>
    assertEquals(now + 300_000, after["nextAlertMs"])
    assertEquals(2L, after["generation"])
    assertEquals(2L, os.active[id]!!.generation)
  }
  @Test fun preCommitFenceRecoveryPreservesThePreviouslySnoozedTarget() {
    val id = id(create())
    action(id, "Snooze", 1, "snooze")
    request {
      val db = OperationalDatabase.open(context)
      try { db.records().put(db.records().find(id)!!.copy(generation = 3, state = "Changing", previousState = "Scheduled")) }
      finally { db.close() }
    }
    engine.close()
    engine = AlarmEngine(context, os, { now }, { 1L })
    val recovered = CompletableFuture<Unit>()
    engine.recover { recovered.complete(Unit) }; recovered.get(20, TimeUnit.SECONDS)
    val after = request { engine.occurrence(id) } as Map<*, *>
    assertEquals(now + 600_000, after["nextAlertMs"])
    assertEquals(3L, after["generation"])
    fire(id, 2)
    assertNull(shadowOf(RuntimeEnvironment.getApplication()).nextStartedService)
  }
  @Test fun stopAllRejectsAnOldSessionAndKeepsMembersUnfinished() {
    val first = id(create("first")); val second = id(create("second"))
    now += 60_000; fire(first); fire(second)
    val session = (request { engine.capabilities() } as Map<*, *>)["activeSessionId"] as String
    val stale = request { engine.apply(mapOf("kind" to "StopAll", "operationId" to "old-stop-all",
      "expectedSessionId" to "obsolete")) } as Map<*, *>
    assertEquals("STALE_SESSION", stale["errorCode"])
    request { engine.apply(mapOf("kind" to "StopAll", "operationId" to "stop-all", "expectedSessionId" to session)) }
    listOf(first, second).forEach { id ->
      val after = request { engine.occurrence(id) } as Map<*, *>
      assertEquals("Stopped", after["deliveryState"])
      assertEquals(false, after["completed"])
    }
  }
  @Test fun changedSnoozePreferenceIsAvailableBeforeFirstUnlock() {
    val id = id(create())
    request { engine.apply(mapOf("kind" to "Settings", "operationId" to "settings",
      "expectedRevision" to 1, "snoozeMinutes" to 15)) }
    engine.close()
    shadowOf(context.getSystemService(UserManager::class.java)).setUserUnlocked(false)
    engine = AlarmEngine(context, os, { now }, { 1L })
    now += 60_000; fire(id)
    val (_, notification) = deliveryNotification()
    assertEquals("Snooze 15 min", notification.actions[1].title.toString())
    action(id, "Snooze", 1, "locked-snooze")
    assertEquals(now + 900_000, os.active[id]!!.targetMs)
  }
  @Test fun notificationAndNoAlertModesDoNotStartTheRingingService() {
    os.allowed = false
    val noAlert = request { engine.apply(mapOf("kind" to "Create", "operationId" to "no-alert",
      "title" to "No alert", "alarmAtMs" to now + 60_000, "mode" to "None")) } as Map<*, *>
    assertEquals("Applied", noAlert["status"])
    assertTrue(os.registered.isEmpty())
    val notification = request { engine.apply(mapOf("kind" to "Create", "operationId" to "notification",
      "title" to "Gentle reminder", "alarmAtMs" to now + 60_000, "mode" to "Notification")) } as Map<String, Any?>
    assertEquals("Scheduled", notification["status"])
    now += 60_000; fire(id(notification))
    assertNull(shadowOf(RuntimeEnvironment.getApplication()).nextStartedService)
    assertEquals("Notified", (request { engine.occurrence(id(notification)) } as Map<*, *>)["deliveryState"])
    val alarm = create("exact-required")
    assertEquals("Blocked", alarm["status"])
  }
  @Suppress("UNCHECKED_CAST") private fun seriesCommand(operation: String = "series", count: Int = 6): Map<String, Any?> =
    request { engine.apply(mapOf("kind" to "CreateSeries", "operationId" to operation, "title" to "Private series",
      "notes" to "Secret notes", "eventStartMs" to now + 60_000, "alarmAtMs" to now + 60_000,
      "zoneId" to "UTC", "recurrence" to mapOf("frequency" to "daily", "interval" to 1, "count" to count, "zoneMode" to "pinned"))) } as Map<String, Any?>
  private fun protectedRows(): List<AlertRecord> = request {
    val db = OperationalDatabase.open(context)
    try { db.records().all() } finally { db.close() }
  } as List<AlertRecord>
  private fun seriesMutation(segment: String, kind: String, revision: Long = 1): Map<*, *> = request {
    engine.apply(mapOf("kind" to kind, "operationId" to "$kind:$revision", "segmentId" to segment, "expectedRevision" to revision))
  } as Map<*, *>
  private fun recoverNow() {
    val done = CompletableFuture<Unit>(); engine.recover { done.complete(Unit) }; done.get(20, TimeUnit.SECONDS)
  }
  @Test fun seriesRegistersTwoIndependentSlotsAndRetryDoesNotDuplicate() {
    val result = seriesCommand()
    assertEquals(result["segmentId"], seriesCommand()["segmentId"])
    val rows = protectedRows()
    assertEquals(2, rows.size)
    assertEquals(2, rows.map { it.occurrenceId }.distinct().size)
    assertTrue(rows.all { it.state == "Scheduled" && it.segmentId == result["segmentId"] })
    request {
      val db = OperationalDatabase.open(context)
      try { assertFalse(db.records().plans().single().rule.contains("Private")); assertFalse(db.records().plans().single().rule.contains("Secret")) }
      finally { db.close() }
    }
  }
  @Test fun seriesReplenishesBeforeLockedDeliveryWithoutCredentialStore() {
    seriesCommand()
    val first = protectedRows().minBy { it.targetMs }
    engine.close(); shadowOf(context.getSystemService(UserManager::class.java)).setUserUnlocked(false)
    engine = AlarmEngine(context, os, { now }, { 10_000L })
    now = first.targetMs; fire(first.occurrenceId)
    val rows = protectedRows()
    assertEquals(2, rows.count { it.targetMs > now && it.state == "Scheduled" })
    val (_, notification) = deliveryNotification()
    assertFalse(notification.toString().contains("Private series"))
    assertEquals(2, notification.actions.size)
  }
  @Test fun postponedSeriesOccurrenceSurvivesPauseAndSeriesReplacement() {
    val result = seriesCommand(); val segment = result["segmentId"] as String
    val first = protectedRows().minBy { it.targetMs }
    val postponed = now + 3 * 86_400_000
    request { engine.apply(mapOf("kind" to "Postpone", "operationId" to "postpone-series", "occurrenceId" to first.occurrenceId,
      "expectedGeneration" to first.generation, "alarmAtMs" to postponed)) }
    assertEquals(3, protectedRows().count { it.state == "Scheduled" })
    seriesMutation(segment, "PauseSeries")
    assertEquals(1, protectedRows().count { it.state == "Scheduled" })
    assertEquals(postponed, protectedRows().first { it.occurrenceId == first.occurrenceId }.targetMs)
    val replaced = request { engine.apply(mapOf("kind" to "EditSeries", "operationId" to "edit-series", "segmentId" to segment,
      "expectedRevision" to 2, "title" to "New series title", "eventStartMs" to now + 120_000,
      "alarmAtMs" to now + 120_000, "recurrence" to mapOf("frequency" to "daily", "interval" to 2, "zoneMode" to "pinned"))) } as Map<*, *>
    assertNotEquals(segment, replaced["segmentId"])
    val after = request { engine.occurrence(first.occurrenceId) } as Map<*, *>
    assertEquals(postponed, after["nextAlertMs"])
    assertEquals("Private series", after["title"])
    assertEquals(true, after["exception"])
    fire(first.occurrenceId, 1) // Obsolete pre-postponement callback.
    assertEquals("Scheduled", (request { engine.occurrence(first.occurrenceId) } as Map<*, *>)["deliveryState"])
  }
  @Test fun skipDoesNotConsumeExtraCountAndResumeNeverReplaysElapsed() {
    val segment = seriesCommand(count = 4)["segmentId"] as String
    val first = protectedRows().minBy { it.targetMs }
    request { engine.apply(mapOf("kind" to "Skip", "operationId" to "skip", "occurrenceId" to first.occurrenceId, "expectedRevision" to 1)) }
    assertEquals("Skipped", (request { engine.occurrence(first.occurrenceId) } as Map<*, *>)["deliveryState"])
    assertEquals(2, protectedRows().count { it.state == "Scheduled" })
    seriesMutation(segment, "PauseSeries")
    now += 2 * 86_400_000
    seriesMutation(segment, "ResumeSeries", 2)
    assertTrue(protectedRows().filter { it.targetMs <= now }.all { it.state in setOf("Missed", "Skipped") })
    assertNull(shadowOf(RuntimeEnvironment.getApplication()).nextStartedService)
    val normal = protectedRows().filter { it.state == "Scheduled" }
    assertEquals(2, normal.size)
    assertTrue(normal.all { it.targetMs > now })
  }
  @Test fun lateSeriesCallbackStillReplenishesIndependentFutureSlots() {
    seriesCommand()
    val first = protectedRows().minBy { it.targetMs }
    now = first.targetMs + 360_000
    fire(first.occurrenceId)
    assertEquals(2, protectedRows().count { it.state == "Scheduled" && it.targetMs > now })
    assertEquals("Missed", protectedRows().first { it.occurrenceId == first.occurrenceId }.state)
    assertNull(shadowOf(RuntimeEnvironment.getApplication()).nextStartedService)
  }
  @Test fun seriesChangingBeforeContentCommitRecoversPriorCommittedRule() {
    val segment = seriesCommand()["segmentId"] as String
    val before = protectedRows()
    request {
      val db = OperationalDatabase.open(context)
      try { db.records().plan(db.records().plan(segment)!!.copy(state = "Changing"))
        before.forEach { db.records().put(it.copy(state = "SeriesChanging", previousState = it.state, generation = it.generation + 1)) }
      } finally { db.close() }
    }
    engine.close(); engine = AlarmEngine(context, os, { now }, { 10_000L }); recoverNow()
    val rows = protectedRows()
    assertEquals(2, rows.count { it.state == "Scheduled" })
    assertEquals(before.map { it.targetMs }.sorted(), rows.map { it.targetMs }.sorted())
    assertTrue(rows.all { it.generation == 2L })
  }
  @Test fun backupRestoresWholeSeriesAsRetryStableCopyAndKeepsItsExceptions() {
    val segment = seriesCommand()["segmentId"] as String
    val first = protectedRows().minBy { it.targetMs }
    request { engine.apply(mapOf("kind" to "Postpone", "operationId" to "postpone-copy", "occurrenceId" to first.occurrenceId,
      "expectedGeneration" to 1, "alarmAtMs" to now + 6 * 86_400_000)) }
    seriesMutation(segment, "PauseSeries")
    val backup = request { engine.exportBackup() } as String
    val bundle = BackupCodec.decode(backup)
    assertEquals(1, bundle.series.size)
    assertTrue(bundle.records.any { it.exception })
    val preview = request { engine.previewImport(backup) } as Map<*, *>
    assertEquals(1, preview["count"])
    val skipped = request { engine.importBackup(backup, emptyList(), "keep-series") } as Map<*, *>
    assertEquals(0, skipped["added"])
    val copied = request { engine.importBackup(backup, listOf(segment), "copy-series") } as Map<*, *>
    assertEquals(1, copied["added"])
    assertEquals(true, (request { engine.importBackup(backup, listOf(segment), "copy-series") } as Map<*, *>)["retry"])
    val all = request { engine.querySeries() } as List<*>
    assertEquals(2, all.size)
    assertEquals(2, protectedRows().count { it.exception && it.state == "Scheduled" })
    assertTrue(protectedRows().filter { !it.exception }.all { it.state == "Paused" })
  }
  @Test fun longOutageRetainsEveryElapsedSlotSilentlyAndRearmsOnlyFuture() {
    seriesCommand(count = 12)
    now += 7 * 86_400_000
    recoverNow()
    val rows = protectedRows()
    assertEquals(7, rows.count { it.state == "Missed" })
    assertEquals(2, rows.count { it.state == "Scheduled" && it.targetMs > now })
    assertNull(shadowOf(RuntimeEnvironment.getApplication()).nextStartedService)
    assertEquals(9, (request { engine.query("all", null) } as Map<*, *>)["items"].let { it as List<*> }.size)
  }
  @Test fun followingSplitUsesOriginalSlotAndRemainingCountDespitePostponement() {
    val segment = seriesCommand(count = 5)["segmentId"] as String
    val selected = protectedRows().maxBy { it.targetMs }
    val originalSlot = selected.nominalSlot!!
    val draft = request { engine.getSeriesDraft(segment, originalSlot) } as Map<*, *>
    assertEquals(4, draft["remainingCount"])
    request { engine.apply(mapOf("kind" to "Postpone", "operationId" to "postpone-following", "occurrenceId" to selected.occurrenceId,
      "expectedGeneration" to 1, "alarmAtMs" to now + 10 * 86_400_000)) }
    val changed = request { engine.apply(mapOf("kind" to "EditFollowing", "operationId" to "following", "segmentId" to segment,
      "expectedRevision" to 1, "nominalSlot" to originalSlot, "eventStartMs" to selected.targetMs,
      "alarmAtMs" to selected.targetMs, "title" to "Following segment", "recurrence" to mapOf("frequency" to "daily",
        "interval" to 2, "count" to 4, "zoneMode" to "pinned"))) } as Map<*, *>
    assertEquals("Scheduled", changed["status"])
    val preserved = request { engine.occurrence(selected.occurrenceId) } as Map<*, *>
    assertEquals(now + 10 * 86_400_000, preserved["nextAlertMs"])
    assertEquals(originalSlot, preserved["nominalSlot"])
    assertEquals(2, (request { engine.querySeries() } as List<*>).size)
    // Pause affects the complete family, including the later segment.
    seriesMutation(changed["segmentId"] as String, "PauseSeries", 1)
    val ordinary = protectedRows().filter { !it.exception && it.targetMs > now }
    assertEquals(3, ordinary.count { it.state == "Paused" })
    assertEquals(1, ordinary.count { it.state == "Replaced" })
    assertTrue(ordinary.none { it.state == "Scheduled" })
  }
  @Test fun floatingTravelMovesFutureNormalAlertsButNotPostponedOrElapsedOnes() {
    val originalZone = java.util.TimeZone.getDefault()
    try {
      java.util.TimeZone.setDefault(java.util.TimeZone.getTimeZone("UTC"))
      request { engine.apply(mapOf("kind" to "CreateSeries", "operationId" to "floating", "title" to "Travel",
        "zoneId" to "UTC", "eventStartMs" to now + 60_000, "alarmAtMs" to now + 60_000,
        "recurrence" to mapOf("frequency" to "daily", "interval" to 1, "zoneMode" to "floating"))) }
      val initial = protectedRows().sortedBy { it.targetMs }
      val first = initial.first()
      now = first.targetMs + 60_000
      java.util.TimeZone.setDefault(java.util.TimeZone.getTimeZone("America/New_York"))
      recoverNow()
      val elapsed = protectedRows().first { it.occurrenceId == first.occurrenceId }
      assertEquals("Missed", elapsed.state) // Its new local-zone instant would be later, but recovery never revives it.
      assertEquals(first.targetMs, elapsed.targetMs)
      val next = protectedRows().first { it.occurrenceId == initial[1].occurrenceId }
      assertEquals(initial[1].targetMs + 5 * 3_600_000, next.targetMs)
      val postponed = now + 10 * 86_400_000
      request { engine.apply(mapOf("kind" to "Postpone", "operationId" to "travel-postpone", "occurrenceId" to next.occurrenceId,
        "expectedGeneration" to next.generation, "alarmAtMs" to postponed)) }
      java.util.TimeZone.setDefault(java.util.TimeZone.getTimeZone("Asia/Tokyo"))
      recoverNow()
      assertEquals(postponed, protectedRows().first { it.occurrenceId == next.occurrenceId }.targetMs)
      assertEquals("Missed", protectedRows().first { it.occurrenceId == first.occurrenceId }.state)
      assertEquals(2, protectedRows().count { !it.exception && it.state == "Scheduled" && it.targetMs > now })
      assertNull(shadowOf(RuntimeEnvironment.getApplication()).nextStartedService)
    } finally { java.util.TimeZone.setDefault(originalZone) }
  }
  @Test fun reusedSeriesOperationCannotMutateAnotherFamily() {
    val first = seriesCommand("first-family")["segmentId"] as String
    val second = seriesCommand("second-family")["segmentId"] as String
    seriesMutation(first, "PauseSeries")
    val reused = seriesMutation(second, "PauseSeries") // Same operation ID, different source.
    assertEquals("Rejected", reused["status"])
    assertEquals("Active", (request { engine.getSeries(second) } as Map<*, *>)["state"])
    assertEquals(2, protectedRows().count { it.segmentId == second && it.state == "Scheduled" })
  }
  @Test fun replayedActionOperationCannotChangeAnotherOccurrenceAfterHistoryAcknowledgement() {
    val first = id(create("first-action")); val second = id(create("second-action"))
    action(first, "Snooze", 1, "unique-action")
    request { engine.query("all", null) } // Journals are acknowledged after CE history insert.
    assertEquals("Rejected", action(second, "Snooze", 1, "unique-action")["status"])
    assertEquals(now + 60_000, (request { engine.occurrence(second) } as Map<*, *>)["nextAlertMs"])
  }
  @Test fun reopenedFutureSeriesOccurrenceIsIndependentOfOrdinaryCoverage() {
    seriesCommand()
    val first = protectedRows().minBy { it.targetMs }
    request { engine.apply(mapOf("kind" to "Done", "operationId" to "done-series", "occurrenceId" to first.occurrenceId, "expectedRevision" to 1)) }
    assertEquals(2, protectedRows().count { !it.exception && it.state == "Scheduled" })
    request { engine.apply(mapOf("kind" to "Reopen", "operationId" to "reopen-series", "occurrenceId" to first.occurrenceId, "expectedRevision" to 2)) }
    assertEquals(2, protectedRows().count { !it.exception && it.state == "Scheduled" })
    assertEquals(1, protectedRows().count { it.exception && it.state == "Scheduled" })
    assertEquals(first.targetMs, protectedRows().first { it.occurrenceId == first.occurrenceId }.targetMs)
  }
  @Test fun lastMemberSnoozeEndsSessionBeforeAnotherIndependentAlarmArrives() {
    val first = id(create("last-member")); val second = id(create("next-member", 120_000))
    now += 60_000; fire(first)
    val (firstIntent, _) = deliveryNotification()
    action(first, "Snooze", 1, "last-snooze")
    request {
      val db = OperationalDatabase.open(context)
      try { assertNull(db.records().activeSession()) } finally { db.close() }
    }
    now += 60_000; fire(second)
    val (nextIntent, _) = deliveryNotification()
    assertNotEquals(firstIntent.getStringExtra("sessionId"), nextIntent.getStringExtra("sessionId"))
    assertEquals("Alerting", (request { engine.occurrence(second) } as Map<*, *>)["deliveryState"])
    assertEquals("Scheduled", (request { engine.occurrence(first) } as Map<*, *>)["deliveryState"])
  }
  @Test fun agendaOrdersBeforePaginationAndCountsAllMatchingRecords() {
    request {
      val db = ContentDatabase.open(context)
      try {
        (0 until 55).reversed().forEach { n ->
          db.records().insert(ReminderRecord("future-%02d".format(n), "Future $n", now + 86_400_000,
            now + 88_200_000, now + 86_400_000, now, listName = "Work", mode = "None"))
        }
        db.records().insert(ReminderRecord("overdue", "Overdue", now + 172_800_000, now + 174_600_000, now - 1, now, listName = "Work"))
        db.records().insert(ReminderRecord("earlier", "Earlier", now - 86_400_000, now - 84_600_000, now + 3_600_000, now, listName = "Work"))
        db.records().insert(ReminderRecord("complete", "Completed", now, now + 1_800_000, now, now, completed = true, listName = "Work"))
        db.records().insert(ReminderRecord("skip", "Skipped", now, now + 1_800_000, now, now, skipped = true, listName = "Work"))
        db.records().insert(ReminderRecord("other", "Unrelated", now, now + 1_800_000, now, now, listName = "Personal"))
      } finally { db.close() }
    }
    val first = request { engine.query(mapOf("view" to "agenda", "listName" to "Work"), null) } as Map<*, *>
    val firstRows = first["items"] as List<*>
    assertEquals(57, first["total"]); assertEquals(1, first["completedCount"])
    assertEquals(57, (first["groups"] as Map<*, *>).values.sumOf { it as Int })
    assertEquals("overdue", (firstRows[0] as Map<*, *>)["id"])
    assertEquals("earlier", (firstRows[1] as Map<*, *>)["id"])
    assertEquals("future-00", (firstRows[2] as Map<*, *>)["id"])
    val next = request { engine.query(mapOf("view" to "agenda", "listName" to "Work"), first["nextCursor"] as String) } as Map<*, *>
    val combined = firstRows + (next["items"] as List<*>)
    assertEquals(57, combined.map { (it as Map<*, *>)["id"] }.distinct().size)
    assertNull(next["nextCursor"])
    assertEquals(1, (request { engine.query(mapOf("view" to "completed"), null) } as Map<*, *>)["total"])
    assertEquals(2, (request { engine.query(mapOf("view" to "completed", "includeSkipped" to true), null) } as Map<*, *>)["total"])
  }
  @Test fun postponementDoesNotRemoveAnUnfinishedOccurrenceFromOverdue() {
    val reminderId = id(create())
    now += 120_000
    request { engine.apply(mapOf("kind" to "Postpone", "operationId" to "postpone-overdue", "occurrenceId" to reminderId,
      "expectedGeneration" to 1L, "alarmAtMs" to now + 86_400_000)) }
    val page = request { engine.query(mapOf("view" to "overdue"), null) } as Map<*, *>
    val row = (page["items"] as List<*>).single() as Map<*, *>
    assertEquals(reminderId, row["id"]); assertEquals("overdue", row["agendaGroup"])
    assertEquals(now + 86_400_000, row["nextAlertMs"])
    assertEquals("Postponed", row["alertAdjustment"])
  }
  @Test fun sessionSnapshotsConfirmPartialMembershipAndFinalTermination() {
    val first = id(create("first")); val second = id(create("second"))
    now += 60_000; fire(first); fire(second)
    val sessionId = (request { engine.capabilities() } as Map<*, *>)["activeSessionId"] as String
    fun snapshot(): AlarmEngine.SessionSnapshot {
      val future = CompletableFuture<AlarmEngine.SessionSnapshot>()
      engine.sessionSnapshot(sessionId, { future.complete(it) }, { future.completeExceptionally(AssertionError(it)) })
      return future.get(20, TimeUnit.SECONDS)
    }
    assertEquals(2, snapshot().members.size)
    action(first, "Stop", 1L, "stop-first")
    assertEquals(1, snapshot().members.size); assertEquals("Starting", snapshot().state)
    action(second, "Snooze", 1L, "snooze-final")
    assertEquals("Stopped", snapshot().state); assertTrue(snapshot().members.isEmpty())
  }
  @Test fun groupedNotificationStopAllCannotStopALaterSession() {
    val first = id(create("first")); val second = id(create("second"))
    now += 60_000; fire(first); deliveryNotification(); fire(second)
    val (intent, notification) = deliveryNotification()
    val oldSession = intent.getStringExtra("sessionId")!!
    assertEquals(listOf("Stop all"), notification.actions.map { it.title.toString() })
    request { engine.apply(mapOf("kind" to "StopAll", "operationId" to "end-old", "expectedSessionId" to oldSession)) }
    val third = id(create("third")); now += 60_000; fire(third)
    val done = CompletableFuture<Unit>()
    engine.receive(AlarmScheduler.stopAllIntent(context, oldSession)) { done.complete(Unit) }; done.get(20, TimeUnit.SECONDS)
    assertEquals("Alerting", (request { engine.occurrence(third) } as Map<*, *>)["deliveryState"])
  }
  @Test fun repeatFamiliesMergeSplitDatesAndUseWholeFamilyPauseState() {
    val firstSegment = seriesCommand(count = 5)["segmentId"] as String
    val split = protectedRows().maxBy { it.targetMs }
    now += 1_000
    val changed = request { engine.apply(mapOf("kind" to "EditFollowing", "operationId" to "family-split",
      "segmentId" to firstSegment, "expectedRevision" to 1, "nominalSlot" to split.nominalSlot,
      "title" to "Following family", "eventStartMs" to split.targetMs, "alarmAtMs" to split.targetMs,
      "zoneId" to "UTC", "recurrence" to mapOf("frequency" to "daily", "interval" to 1, "count" to 4, "zoneMode" to "pinned"))) } as Map<*, *>
    val current = changed["segmentId"] as String
    fun family() = (request { engine.queryRepeatFamilies() } as List<*>).single() as Map<*, *>
    val active = family()
    assertEquals(firstSegment, active["seriesId"])
    assertEquals(current, (active["current"] as Map<*, *>)["id"])
    assertEquals("Active", active["state"])
    val dates = active["upcoming"] as List<*>
    assertEquals(3, dates.size)
    assertEquals(firstSegment, (dates[0] as Map<*, *>)["segmentId"])
    assertEquals(current, (dates[1] as Map<*, *>)["segmentId"])
    assertEquals(3, active["unfinishedCount"])
    seriesMutation(current, "PauseSeries")
    assertEquals("Paused", family()["state"])
    assertEquals(3, (family()["upcoming"] as List<*>).size)
    now += 6 * 86_400_000
    assertEquals("Ended", family()["state"])
    assertTrue((family()["upcoming"] as List<*>).isEmpty())
  }
  @Test fun familyFiltersRetainArchivedExceptionsAndTheirHistoryWithoutOtherFamilies() {
    val familyId = seriesCommand("history-family")["segmentId"] as String
    val first = protectedRows().filter { it.segmentId == familyId }.minBy { it.targetMs }
    request { engine.apply(mapOf("kind" to "Postpone", "operationId" to "retained-exception", "occurrenceId" to first.occurrenceId,
      "expectedGeneration" to first.generation, "alarmAtMs" to now + 15 * 86_400_000)) }
    now += 1_000
    val replacement = request { engine.apply(mapOf("kind" to "EditSeries", "operationId" to "replacement-family",
      "segmentId" to familyId, "expectedRevision" to 1, "title" to "Current family", "eventStartMs" to now + 120_000,
      "alarmAtMs" to now + 120_000, "zoneId" to "UTC", "recurrence" to mapOf("frequency" to "daily", "interval" to 1, "zoneMode" to "pinned"))) } as Map<*, *>
    seriesCommand("unrelated-family")
    fun page(view: String) = request { engine.query(mapOf("view" to view, "seriesId" to familyId), null) } as Map<*, *>
    val active = page("all")
    assertEquals(3, active["total"])
    assertTrue((active["items"] as List<*>).any { (it as Map<*, *>)["id"] == first.occurrenceId })
    assertTrue((active["items"] as List<*>).all { (it as Map<*, *>)["segmentId"] in setOf(familyId, replacement["segmentId"]) })
    request { engine.apply(mapOf("kind" to "Done", "operationId" to "complete-retained", "occurrenceId" to first.occurrenceId, "expectedRevision" to 1)) }
    val completed = page("completed")
    assertEquals(1, completed["total"]); assertEquals(1, completed["completedCount"])
    assertEquals(first.occurrenceId, ((completed["items"] as List<*>).single() as Map<*, *>)["id"])
    assertEquals(now, ((completed["items"] as List<*>).single() as Map<*, *>)["collectionAtMs"])
    assertEquals(2, ((request { engine.queryRepeatFamilies() } as List<*>).first { (it as Map<*, *>)["seriesId"] == familyId } as Map<*, *>)["unfinishedCount"])
    assertEquals(0, (request { engine.query(mapOf("view" to "all", "seriesId" to "missing-family"), null) } as Map<*, *>)["total"])
  }
  @Test fun futureExceptionDoesNotKeepAnExhaustedOrdinaryFamilyActive() {
    val familyId = seriesCommand(count = 1)["segmentId"] as String
    val first = protectedRows().single()
    request { engine.apply(mapOf("kind" to "Postpone", "operationId" to "last-exception", "occurrenceId" to first.occurrenceId,
      "expectedGeneration" to 1, "alarmAtMs" to now + 15 * 86_400_000)) }
    val family = (request { engine.queryRepeatFamilies() } as List<*>).single() as Map<*, *>
    assertEquals("Ended", family["state"])
    assertTrue((family["upcoming"] as List<*>).isEmpty())
    assertEquals(1, family["unfinishedCount"])
    assertEquals("Scheduled", protectedRows().single().state)
    assertEquals(1, (request { engine.query(mapOf("view" to "all", "seriesId" to familyId), null) } as Map<*, *>)["total"])
  }
  @Test fun aPausedFamilyKeepsItsIndependentExceptionWithoutBecomingActive() {
    val familyId = seriesCommand(count = 5)["segmentId"] as String
    val first = protectedRows().minBy { it.targetMs }
    request { engine.apply(mapOf("kind" to "Postpone", "operationId" to "paused-exception", "occurrenceId" to first.occurrenceId,
      "expectedGeneration" to 1, "alarmAtMs" to now + 15 * 86_400_000)) }
    seriesMutation(familyId, "PauseSeries")
    val family = (request { engine.queryRepeatFamilies() } as List<*>).single() as Map<*, *>
    assertEquals("Paused", family["state"])
    assertEquals(3, (family["upcoming"] as List<*>).size)
    assertEquals("Scheduled", protectedRows().first { it.occurrenceId == first.occurrenceId }.state)
    assertEquals(3, family["unfinishedCount"])
  }
  @Test fun historyOrdersByCollectionActionBeforePaginationAndKeepsStableFallbacks() {
    request {
      val db = ContentDatabase.open(context)
      try {
        (0 until 55).reversed().forEach { n ->
          val id = "history-%02d".format(n)
          db.records().insert(ReminderRecord(id, "Completed $n", now + (55 - n) * 60_000,
            now + (85 - n) * 60_000, now, now, completed = true, mode = "None"))
          db.records().history(HistoryRecord("done-$n", id, "Done", now + n * 1_000, 1))
          db.records().history(HistoryRecord("later-stop-$n", id, "Stop", now + 1_000_000, 1))
        }
        db.records().insert(ReminderRecord("skipped", "Skipped", now, now + 1_800_000, now, now, skipped = true))
        db.records().history(HistoryRecord("skip-history", "skipped", "Skip", now + 55_000, 1))
        db.records().insert(ReminderRecord("trash", "Trash", now, now + 1_800_000, now, now, deleted = true))
        db.records().history(HistoryRecord("delete-history", "trash", "Delete", now + 56_000, 1))
      } finally { db.close() }
    }
    val filter = mapOf("view" to "completed", "includeSkipped" to true)
    val first = request { engine.query(filter, null) } as Map<*, *>
    val rows = first["items"] as List<*>
    assertEquals(56, first["total"])
    assertEquals("skipped", (rows[0] as Map<*, *>)["id"])
    assertEquals("history-54", (rows[1] as Map<*, *>)["id"])
    assertEquals(now + 54_000, (rows[1] as Map<*, *>)["collectionAtMs"])
    val second = request { engine.query(filter, first["nextCursor"] as String) } as Map<*, *>
    assertEquals(56, (rows + (second["items"] as List<*>)).map { (it as Map<*, *>)["id"] }.distinct().size)
    assertNull(second["nextCursor"])
    val deleted = request { engine.query(mapOf("view" to "deleted"), null) } as Map<*, *>
    assertEquals(now + 56_000, ((deleted["items"] as List<*>).single() as Map<*, *>)["collectionAtMs"])
  }
  @Test fun historyUsesLatestMatchingActionAndStableIdsWhenActionEvidenceIsAbsent() {
    request {
      val db = ContentDatabase.open(context)
      try {
        listOf("fallback-b", "fallback-a", "latest").forEach { id -> db.records().insert(
          ReminderRecord(id, id, now - 10_000, now + 1_790_000, now, now, completed = true, mode = "None")) }
        db.records().history(HistoryRecord("old-done", "latest", "Done", now - 20_000, 1))
        db.records().history(HistoryRecord("new-done", "latest", "Done", now - 5_000, 1))
        db.records().history(HistoryRecord("later-snooze", "latest", "Snooze", now + 10_000, 1))
      } finally { db.close() }
    }
    val page = request { engine.query(mapOf("view" to "completed"), null) } as Map<*, *>
    val rows = page["items"] as List<*>
    assertEquals(listOf("latest", "fallback-a", "fallback-b"), rows.map { (it as Map<*, *>)["id"] })
    assertEquals(now - 5_000, (rows[0] as Map<*, *>)["collectionAtMs"])
    assertEquals(now - 10_000, (rows[1] as Map<*, *>)["collectionAtMs"])
  }
  @Test fun familyAndCivilTimeQueriesLeaveRegistrationsAndGenerationsUnchanged() {
    seriesCommand()
    val before = protectedRows()
    val registered = os.registered.size
    request {
      engine.queryRepeatFamilies()
      engine.convertTime(mapOf("zoneId" to "America/Los_Angeles", "local" to "2027-03-14T02:30:00"))
      engine.convertTime(mapOf("zoneId" to "US/Pacific", "instantMs" to now))
      engine.timeZones(now.toDouble())
    }
    assertEquals(before, protectedRows())
    assertEquals(registered, os.registered.size)
  }
  @Test fun listCatalogRetainsHistoricalAndDeletedCollections() {
    request {
      val db = ContentDatabase.open(context)
      try {
        db.records().insert(ReminderRecord("active-list", "Active", now, now + 1_800_000, now, now, listName = "Active"))
        db.records().insert(ReminderRecord("completed-list", "Completed", now, now + 1_800_000, now, now, completed = true, listName = "History"))
        db.records().insert(ReminderRecord("deleted-list", "Deleted", now, now + 1_800_000, now, now, deleted = true, listName = "Trash only"))
        db.records().insert(ReminderRecord("duplicate-list", "Duplicate", now, now + 1_800_000, now, now, deleted = true, listName = "History"))
        db.records().insert(ReminderRecord("empty-list", "Unlisted", now, now + 1_800_000, now, now))
      } finally { db.close() }
    }
    assertEquals(listOf("Active", "History", "Trash only"), request { engine.lists() })
    val deleted = request { engine.query(mapOf("view" to "deleted", "listName" to "Trash only"), null) } as Map<*, *>
    assertEquals(1, deleted["total"])
  }
  private class FakeRegistrar : AlarmRegistrar {
    var fail = false
    var allowed = true
    val registered = mutableListOf<AlertRecord>()
    val active = mutableMapOf<String, AlertRecord>()
    override fun canSchedule() = allowed
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

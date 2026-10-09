package com.remilo.alarm.engine

import android.Manifest
import android.app.Application
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
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
class AlertExperienceTest {
  private lateinit var context: Context
  private lateinit var engine: AlarmEngine
  private var now = 1_800_000_000_000L
  private var failAt: String? = null
  private val failedIds = mutableSetOf<String>()
  private val registrations = mutableListOf<AlertRecord>()
  private val registrar = object : AlarmRegistrar {
    override fun canSchedule() = true
    override fun cancel(alert: AlertRecord) {}
    override fun register(alert: AlertRecord) {
      if (alert.occurrenceId in failedIds) throw IllegalStateException("Registration unavailable")
      registrations.add(alert)
    }
  }
  private fun newEngine() = AlarmEngine(context, registrar, { now }, { 10_000L }, bulkSnoozeCheckpoint = { stage ->
    if (stage == failAt) { failAt = null; throw IllegalStateException("Simulated process loss") }
  })
  @Before fun setup() {
    context = RuntimeEnvironment.getApplication()
    shadowOf(RuntimeEnvironment.getApplication()).grantPermissions(Manifest.permission.POST_NOTIFICATIONS)
    shadowOf(context.getSystemService(UserManager::class.java)).setUserUnlocked(true)
    context.deleteDatabase("remilo-content.db")
    context.createDeviceProtectedStorageContext().deleteDatabase("remilo-operational.db")
    engine = newEngine()
  }
  @After fun teardown() { engine.close() }
  private fun request(block: () -> Any?): Any? {
    val result = CompletableFuture<Any?>()
    engine.request(block, { result.complete(it) }, { result.completeExceptionally(IllegalStateException(it)) })
    return result.get(20, TimeUnit.SECONDS)
  }
  private fun apply(command: Map<String, Any?>) = request { engine.apply(command) } as Map<*, *>
  private fun create(operation: String, mode: String = "Alarm"): String {
    val result = apply(mapOf("kind" to "Create", "operationId" to operation, "title" to "Private $operation",
      "alarmAtMs" to now + 60_000, "mode" to mode))
    return (result["occurrence"] as Map<*, *>)["id"] as String
  }
  private fun receive(intent: Intent) {
    val done = CompletableFuture<Unit>()
    engine.receive(intent) { done.complete(Unit) }; done.get(20, TimeUnit.SECONDS)
  }
  private fun fire(id: String, generation: Long = 1) = receive(AlarmScheduler.intent(context, "fire", id, generation))
  private fun occurrence(id: String) = request { engine.occurrence(id) } as Map<*, *>
  private fun actions() = request { engine.capabilities()["activeSessionActions"] } as Map<*, *>
  private fun group(kind: String, operation: String, snapshot: Map<*, *> = actions()): Map<String, Any?> =
    mutableMapOf<String, Any?>("kind" to kind, "operationId" to operation, "expectedSessionId" to snapshot["sessionId"],
      "members" to snapshot["members"]).also { if (kind == "SnoozeAll") it["snoozeMinutes"] = snapshot["snoozeMinutes"] }
  private fun records(): List<AlertRecord> = request {
    val db = OperationalDatabase.open(context)
    try { db.records().all() } finally { db.close() }
  } as List<AlertRecord>
  private fun complete(id: String, op: String = "complete", generation: Long = 1) = apply(mapOf(
    "kind" to "CompleteDelivery", "operationId" to op, "occurrenceId" to id, "expectedGeneration" to generation))

  @Test fun postedNotificationHasBothNativeActionsAndDismissalLeavesItUnfinished() {
    val id = create("notification", "Notification"); now += 60_000; fire(id)
    assertNull(shadowOf(RuntimeEnvironment.getApplication()).nextStartedService)
    val manager = context.getSystemService(NotificationManager::class.java)
    val notification = manager.activeNotifications.single().notification
    assertEquals(listOf("Done", "Snooze · 10 min"), notification.actions.map { it.title.toString() })
    assertEquals(listOf("Done", "Snooze · 10 min"), notification.publicVersion.actions.map { it.title.toString() })
    assertNull(notification.fullScreenIntent)
    manager.cancel(id, 1)
    assertEquals(false, occurrence(id)["completed"])
    assertEquals("Notified", occurrence(id)["deliveryState"])
    assertEquals("Applied", complete(id)["status"])
    assertEquals(true, occurrence(id)["completed"])
    assertEquals(listOf("Done"), (occurrence(id)["history"] as List<*>).map { (it as Map<*, *>)["kind"] })
  }

  @Test fun notificationActionsWorkBeforeFirstUnlockAndCannotAffectANewerDelivery() {
    val id = create("boot-notification", "Notification")
    engine.close(); shadowOf(context.getSystemService(UserManager::class.java)).setUserUnlocked(false); engine = newEngine()
    now += 60_000; fire(id)
    val notification = context.getSystemService(NotificationManager::class.java).activeNotifications.single().notification
    assertEquals("Reminder", notification.extras.getCharSequence("android.title").toString())
    val done = shadowOf(notification.actions[0].actionIntent).savedIntent
    receive(shadowOf(notification.actions[1].actionIntent).savedIntent)
    assertEquals("Scheduled", records().single().state); assertEquals(2L, records().single().generation)
    receive(done)
    assertEquals("Scheduled", records().single().state)
    now += 600_000; fire(id, 2)
    val current = context.getSystemService(NotificationManager::class.java).activeNotifications.single().notification
    receive(shadowOf(current.actions[0].actionIntent).savedIntent)
    assertEquals("Completed", records().single().state)
    engine.close(); shadowOf(context.getSystemService(UserManager::class.java)).setUserUnlocked(true); engine = newEngine()
    assertEquals(true, occurrence(id)["completed"])
    assertEquals(1, (occurrence(id)["history"] as List<*>).count { (it as Map<*, *>)["kind"] == "Done" })
  }

  @Test fun doneAllCompletesExactlyDisplayedMembersAndRetainsLaterArrivalsAcrossRetry() {
    val a = create("a"); val b = create("b"); val later = create("later")
    now += 60_000; fire(a); fire(b)
    val command = group("DoneAll", "done-group")
    fire(later)
    assertEquals(2, apply(command)["count"])
    assertEquals(true, occurrence(a)["completed"]); assertEquals(true, occurrence(b)["completed"])
    assertEquals("Alerting", occurrence(later)["deliveryState"])
    complete(later, "later-done")
    engine.close(); engine = newEngine()
    assertEquals(2, apply(command)["count"])
    val changed = command + ("members" to listOf(mapOf("occurrenceId" to later, "expectedGeneration" to 1L)))
    assertEquals("OPERATION_REUSED", apply(changed)["errorCode"])
  }

  @Test fun staleCapturedMemberRejectsWholeDoneOrSnoozeGroupBeforeMutation() {
    val a = create("a"); val b = create("b"); now += 60_000; fire(a); fire(b)
    val done = group("DoneAll", "done-group"); val snooze = group("SnoozeAll", "snooze-group")
    complete(a, "complete-a")
    assertEquals("STALE_MEMBERS", apply(done)["errorCode"])
    assertEquals("STALE_MEMBERS", apply(snooze)["errorCode"])
    assertEquals("Alerting", occurrence(b)["deliveryState"]); assertEquals(false, occurrence(b)["completed"])
    assertEquals(1L, occurrence(b)["generation"])
  }

  @Test fun snoozeAllUsesOneTargetAndReportsMixedRegistrationResultsWithoutCompletion() {
    val a = create("a"); val b = create("b"); now += 60_000; fire(a); fire(b)
    val command = group("SnoozeAll", "snooze-group"); failedIds.add(b)
    val result = apply(command)
    assertEquals("Partial", result["status"])
    assertEquals(setOf("Scheduled", "Blocked"), (result["memberResults"] as List<*>).map { (it as Map<*, *>)["status"] }.toSet())
    val target = now + 600_000
    assertTrue(records().all { it.targetMs == target && it.generation == 2L })
    assertTrue(listOf(a, b).all { occurrence(it)["completed"] == false })
    assertNull(request { engine.capabilities()["activeSessionActions"] })
    now += 30_000; failedIds.clear()
    assertEquals(result, apply(command)); assertTrue(records().all { it.targetMs == target })
  }

  @Test fun bulkSnoozeResumesEveryDurableCrashBoundaryWithoutRetimingOrDuplicateHistory() {
    for (stage in listOf("protected-committed", "member-registered", "member-acknowledged", "settled")) {
      val a = create("a-$stage"); val b = create("b-$stage"); now += 60_000; fire(a); fire(b)
      val command = group("SnoozeAll", "group-$stage"); val target = now + 600_000
      failAt = stage
      try { apply(command); fail("Fault must interrupt acknowledgement") } catch (_: java.util.concurrent.ExecutionException) {}
      engine.close(); now += 5_000; engine = newEngine()
      assertEquals("Applied", apply(command)["status"])
      for (id in listOf(a, b)) {
        val current = occurrence(id)
        assertEquals(target, current["nextAlertMs"]); assertEquals(2L, current["generation"])
        assertEquals(1, (current["history"] as List<*>).count { (it as Map<*, *>)["kind"] == "Snooze" })
      }
    }
  }

  @Test fun resumedBulkCannotUndoANewerDoneOrScheduleAnElapsedTarget() {
    val a = create("a"); val b = create("b"); now += 60_000; fire(a); fire(b)
    val command = group("SnoozeAll", "group"); failAt = "protected-committed"
    try { apply(command); fail("Fault must interrupt acknowledgement") } catch (_: java.util.concurrent.ExecutionException) {}
    apply(mapOf("kind" to "Done", "operationId" to "manual-done", "occurrenceId" to a, "expectedRevision" to 1L))
    now += 600_001
    val result = apply(command)
    assertEquals("Partial", result["status"])
    assertEquals(setOf("Superseded", "Missed"), (result["memberResults"] as List<*>).map { (it as Map<*, *>)["status"] }.toSet())
    assertEquals(true, occurrence(a)["completed"]); assertEquals(false, occurrence(b)["completed"])
    assertEquals("Missed", occurrence(b)["deliveryState"])
  }

  @Test fun currentGlobalDurationChangesRejectOnlyUncommittedShownActions() {
    val a = create("a"); val b = create("b"); now += 60_000; fire(a); fire(b)
    val snapshot = actions(); val group = group("SnoozeAll", "group", snapshot)
    val oldRecord = records().first { it.occurrenceId == a }
    val oldIntent = AlarmScheduler.capturedActionIntent(context, "quicksnooze", oldRecord)
    apply(mapOf("kind" to "Settings", "operationId" to "new-duration", "expectedRevision" to 1L, "snoozeMinutes" to 15))
    assertEquals(15, actions()["snoozeMinutes"]); assertEquals(15, occurrence(a)["quickSnoozeMinutes"])
    assertEquals("STALE_SNOOZE", apply(group)["errorCode"])
    val single = mapOf("kind" to "Snooze", "operationId" to "single", "occurrenceId" to a,
      "expectedGeneration" to 1L, "expectedSnoozeMinutes" to 10)
    assertEquals("STALE_SNOOZE", apply(single)["errorCode"])
    val freshIntent = AlarmScheduler.capturedActionIntent(context, "quicksnooze", records().first { it.occurrenceId == a })
    assertNotEquals(oldIntent.data, freshIntent.data)
    val current = single + ("expectedSnoozeMinutes" to 15)
    assertEquals("Applied", apply(current)["status"])
    val target = now + 900_000
    apply(mapOf("kind" to "Settings", "operationId" to "newer-duration", "expectedRevision" to 2L, "snoozeMinutes" to 20))
    assertEquals("Applied", apply(current)["status"]); assertEquals(target, occurrence(a)["nextAlertMs"])
    assertEquals("OPERATION_REUSED", apply(current + ("expectedSnoozeMinutes" to 20))["errorCode"])
    receive(oldIntent); assertEquals(target, occurrence(a)["nextAlertMs"])
  }

  @Test fun directBootGroupUsesCurrentMirroredPreferenceAndSnapshotsExcludeLaterMember() {
    val a = create("a"); val b = create("b"); val c = create("c")
    apply(mapOf("kind" to "Settings", "operationId" to "duration", "expectedRevision" to 1L, "snoozeMinutes" to 15))
    engine.close(); shadowOf(context.getSystemService(UserManager::class.java)).setUserUnlocked(false); engine = newEngine()
    now += 60_000; fire(a); fire(b)
    val captured = records().filter { it.state == "Alerting" }
    val old = AlarmScheduler.capturedGroupIntent(context, "snoozeall", actions()["sessionId"] as String, captured)
    fire(c)
    val expanded = AlarmScheduler.capturedGroupIntent(context, "snoozeall", actions()["sessionId"] as String, records().filter { it.state == "Alerting" })
    assertNotEquals(old.data, expanded.data)
    receive(old)
    assertTrue(records().filter { it.occurrenceId in setOf(a, b) }.all { it.targetMs == now + 900_000 && it.state == "Scheduled" })
    assertEquals("Alerting", records().first { it.occurrenceId == c }.state)
    receive(old)
    assertEquals(2L, records().first { it.occurrenceId == a }.generation)
  }

  @Test fun directBootDoneAllRetainsExactlyOneCompletionPerCapturedMemberAfterUnlock() {
    val a = create("a"); val b = create("b")
    engine.close(); shadowOf(context.getSystemService(UserManager::class.java)).setUserUnlocked(false); engine = newEngine()
    now += 60_000; fire(a); fire(b)
    val command = group("DoneAll", "boot-done")
    assertEquals(2, apply(command)["count"])
    assertTrue(records().all { it.state == "Completed" })
    engine.close(); shadowOf(context.getSystemService(UserManager::class.java)).setUserUnlocked(true); engine = newEngine()
    assertEquals(2, apply(command)["count"])
    for (id in listOf(a, b)) {
      assertEquals(true, occurrence(id)["completed"])
      assertEquals(1, (occurrence(id)["history"] as List<*>).count { (it as Map<*, *>)["kind"] == "Done" })
    }
  }

  @Test fun snapshotCompletionRetainsFiniteRecurringFamilyAndLegacyStopRetry() {
    apply(mapOf("kind" to "CreateSeries", "operationId" to "repeat", "title" to "Repeat", "alarmAtMs" to now + 60_000,
      "recurrence" to mapOf("frequency" to "daily", "interval" to 1, "count" to 2, "zoneMode" to "floating")))
    val first = records().minBy { it.targetMs }; val future = records().maxBy { it.targetMs }
    now += 60_000; fire(first.occurrenceId)
    assertEquals("Applied", complete(first.occurrenceId)["status"])
    assertEquals(future, records().first { it.occurrenceId == future.occurrenceId })
    val legacy = create("legacy"); now += 60_000; fire(legacy)
    val stop = mapOf("kind" to "Stop", "operationId" to "legacy-stop", "occurrenceId" to legacy, "expectedGeneration" to 1L)
    assertEquals("Applied", apply(stop)["status"]); assertEquals("Applied", apply(stop)["status"])
    assertEquals(true, occurrence(legacy)["completed"])
    assertEquals("OPERATION_REUSED", apply(stop + ("kind" to "CompleteDelivery"))["errorCode"])
  }

  @Test fun postponedActionCanAcknowledgeExactRetryAfterItsTargetHasElapsed() {
    val id = create("postpone"); val target = now + 120_000
    val command = mapOf("kind" to "Postpone", "operationId" to "postpone-action", "occurrenceId" to id,
      "expectedGeneration" to 1L, "alarmAtMs" to target)
    assertEquals("Applied", apply(command)["status"])
    occurrence(id) // Acknowledge the protected journal into credential history.
    now = target + 1
    assertEquals(2L, apply(command)["generation"])
    assertEquals(target, occurrence(id)["nextAlertMs"])
    assertEquals("OPERATION_REUSED", apply(command + ("alarmAtMs" to target + 1))["errorCode"])
    assertEquals("OPERATION_REUSED", apply(command + ("expectedGeneration" to 2L))["errorCode"])
    assertEquals(1, (occurrence(id)["history"] as List<*>).count { (it as Map<*, *>)["kind"] == "Postpone" })
  }

  @Test fun acknowledgedSingleSnoozeReturnsItsOriginalGenerationWithoutUndoingLaterPostpone() {
    val id = create("single")
    val command = mapOf("kind" to "Snooze", "operationId" to "single-snooze", "occurrenceId" to id,
      "expectedGeneration" to 1L, "expectedSnoozeMinutes" to 10)
    assertEquals(2L, apply(command)["generation"]); occurrence(id)
    val later = now + 1_200_000
    apply(mapOf("kind" to "Postpone", "operationId" to "later", "occurrenceId" to id,
      "expectedGeneration" to 2L, "alarmAtMs" to later))
    assertEquals(2L, apply(command)["generation"])
    assertEquals(3L, occurrence(id)["generation"]); assertEquals(later, occurrence(id)["nextAlertMs"])
    assertEquals("OPERATION_REUSED", apply(command + ("expectedGeneration" to 2L))["errorCode"])
  }

  @Test fun blockedSingleActionRetriesStayTruthfulBeforeAndAfterHistoryAcknowledgement() {
    for (kind in listOf("Snooze", "Postpone")) {
      val id = create("blocked-$kind"); now += 60_000; fire(id)
      val command = mutableMapOf<String, Any?>("kind" to kind, "operationId" to "blocked-action-$kind",
        "occurrenceId" to id, "expectedGeneration" to 1L).also {
        if (kind == "Snooze") it["expectedSnoozeMinutes"] = 10 else it["alarmAtMs"] = now + 120_000
      }
      failedIds.add(id)
      shadowOf(context.getSystemService(UserManager::class.java)).setUserUnlocked(false)
      assertEquals("Blocked", apply(command)["status"])
      val target = records().first { it.occurrenceId == id }.targetMs
      // A lost response before unlock retries the protected ActionRecord receipt.
      assertEquals("Blocked", apply(command)["status"])
      assertEquals(2L, apply(command)["generation"])
      shadowOf(context.getSystemService(UserManager::class.java)).setUserUnlocked(true)
      // prepareContentActions acknowledges that record into CE history; its retry
      // must report the same scheduling failure without retiming or another action.
      assertEquals("Blocked", apply(command)["status"])
      assertEquals(target, occurrence(id)["nextAlertMs"])
      assertEquals(1, (occurrence(id)["history"] as List<*>).size)
      request {
        val db = OperationalDatabase.open(context)
        try { assertNull(db.records().action(command["operationId"] as String)) } finally { db.close() }
      }
      // A distinct later blocked generation belongs to its own command. The old
      // receipt still acknowledges generation two and cannot inherit that failure.
      val later = now + 1_800_000
      assertEquals("Blocked", apply(mapOf("kind" to "Postpone", "operationId" to "later-$kind",
        "occurrenceId" to id, "expectedGeneration" to 2L, "alarmAtMs" to later))["status"])
      assertEquals("Applied", apply(command)["status"])
      assertEquals(2L, apply(command)["generation"])
      assertEquals(3L, occurrence(id)["generation"]); assertEquals(later, occurrence(id)["nextAlertMs"])
    }
  }

  @Test fun creationOutboxRetryCannotRollBackTheCurrentProtectedGlobalDuration() {
    val id = create("creation")
    request {
      val db = ContentDatabase.open(context)
      try { db.records().pending(PendingSchedule("old-outbox", id, now + 60_000, 1, snoozeMinutes = 10)) }
      finally { db.close() }
    }
    apply(mapOf("kind" to "Settings", "operationId" to "duration", "expectedRevision" to 1L, "snoozeMinutes" to 15))
    assertEquals(id, create("creation"))
    assertEquals(15, records().single().snoozeMinutes)
    assertEquals(15, occurrence(id)["quickSnoozeMinutes"])
  }
}

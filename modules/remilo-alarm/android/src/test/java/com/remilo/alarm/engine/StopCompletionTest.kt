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
class StopCompletionTest {
  private lateinit var context: Context
  private lateinit var engine: AlarmEngine
  private var now = 1_800_000_000_000L
  private var failAt: String? = null
  private val registrar = object : AlarmRegistrar {
    override fun canSchedule() = true
    override fun register(alert: AlertRecord) {}
    override fun cancel(alert: AlertRecord) {}
  }
  private fun newEngine() = AlarmEngine(context, registrar, { now }, { 10_000L }, completionCheckpoint = { stage ->
    if (failAt == stage) { failAt = null; throw IllegalStateException("Simulated process loss") }
  })
  @Before fun setup() {
    context = RuntimeEnvironment.getApplication()
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
  private fun create(op: String): String {
    val result = request { engine.apply(mapOf("kind" to "Create", "operationId" to op,
      "title" to "Private probe", "alarmAtMs" to now + 60_000)) } as Map<*, *>
    return (result["occurrence"] as Map<*, *>)["id"] as String
  }
  private fun fire(id: String, generation: Long = 1) {
    val done = CompletableFuture<Unit>()
    engine.receive(AlarmScheduler.intent(context, "fire", id, generation)) { done.complete(Unit) }
    done.get(20, TimeUnit.SECONDS)
  }
  private fun stop(id: String, op: String = "stop", generation: Long = 1) = request {
    engine.apply(mapOf("kind" to "Stop", "operationId" to op, "occurrenceId" to id, "expectedGeneration" to generation))
  } as Map<*, *>
  private fun occurrence(id: String) = request { engine.occurrence(id) } as Map<*, *>
  private fun protected(block: (OperationalDao) -> Unit) { request {
    val db = OperationalDatabase.open(context)
    try { block(db.records()) } finally { db.close() }
  } }

  @Test fun stopRecordsOriginalTimestampOnceAndRetryNeverRecompletesReopenedOccurrence() {
    val id = create("create"); now += 60_000; fire(id)
    val stoppedAt = now
    assertEquals("Applied", stop(id)["status"])
    val done = occurrence(id)
    assertEquals(true, done["completed"]); assertEquals(2L, done["revision"])
    assertEquals(listOf(stoppedAt), (done["history"] as List<*>).map { (it as Map<*, *>)["atMs"] })
    request { engine.apply(mapOf("kind" to "Reopen", "operationId" to "reopen", "occurrenceId" to id, "expectedRevision" to 2L)) }
    now += 5_000
    assertEquals(2L, stop(id)["generation"])
    assertEquals(false, occurrence(id)["completed"])
    assertEquals(3L, occurrence(id)["revision"])
    assertEquals("OPERATION_REUSED", stop(id, generation = 3)["errorCode"])
  }

  @Test fun directBootCompletionDoesNotReadPrivateContentAndProjectsAfterUnlock() {
    val id = create("create")
    engine.close(); shadowOf(context.getSystemService(UserManager::class.java)).setUserUnlocked(false)
    engine = newEngine(); now += 60_000; fire(id)
    assertEquals("Applied", stop(id)["status"])
    protected { dao ->
      assertEquals("Completed", dao.find(id)!!.state)
      assertEquals(1, dao.completions().size); assertNull(dao.activeSession())
    }
    engine.close(); shadowOf(context.getSystemService(UserManager::class.java)).setUserUnlocked(true)
    engine = newEngine()
    val done = occurrence(id)
    assertEquals(true, done["completed"]); assertEquals("Completed", done["deliveryState"])
    protected { assertTrue(it.completions().isEmpty()) }
    assertEquals(1, (request { engine.query("completed", null) } as Map<*, *>)["total"])
  }

  @Test fun directBootCompletesUnmaterializedFinalRepeatSlotWithoutResurrectingIt() {
    request { engine.apply(mapOf("kind" to "CreateSeries", "operationId" to "boot-repeat", "title" to "Private repeat",
      "alarmAtMs" to now + 60_000, "recurrence" to mapOf("frequency" to "daily", "interval" to 1, "count" to 3, "zoneMode" to "floating"))) }
    engine.close(); shadowOf(context.getSystemService(UserManager::class.java)).setUserUnlocked(false)
    engine = newEngine()
    var lastId = ""
    repeat(3) { index ->
      val rows = mutableListOf<AlertRecord>()
      protected { dao -> rows.addAll(dao.all().filter { it.state == "Scheduled" }.sortedBy { it.targetMs }) }
      val next = rows.first(); lastId = next.occurrenceId; now = next.targetMs
      fire(next.occurrenceId, next.generation)
      assertEquals("Applied", stop(next.occurrenceId, "boot-stop-$index", next.generation)["status"])
    }
    protected { assertEquals(3, it.completions().size); assertTrue(it.all().all { row -> row.state == "Completed" }) }
    engine.close(); shadowOf(context.getSystemService(UserManager::class.java)).setUserUnlocked(true)
    engine = newEngine()
    val final = occurrence(lastId)
    assertEquals(true, final["completed"]); assertEquals(2L, final["revision"])
    assertEquals("Done", ((final["history"] as List<*>).single() as Map<*, *>)["kind"])
    assertEquals(now, ((final["history"] as List<*>).single() as Map<*, *>)["atMs"])
    assertEquals(3, (request { engine.query("completed", null) } as Map<*, *>)["total"])
    protected { assertTrue(it.completions().isEmpty()); assertEquals(3, it.all().size) }
  }

  @Test fun crashesAtEachCommitBoundaryKeepProtectedCompletionAndExactlyOneHistoryEvent() {
    for (stage in listOf("protected-committed", "content-before-commit", "content-committed")) {
      val id = create("create-$stage"); now += 60_000; fire(id)
      failAt = stage
      try { stop(id, "stop-$stage"); fail("Fault must interrupt acknowledgement") } catch (_: java.util.concurrent.ExecutionException) {}
      protected { assertEquals("Completed", it.find(id)!!.state); assertNull(it.activeSession()) }
      engine.close(); engine = newEngine()
      assertEquals("Applied", stop(id, "stop-$stage")["status"])
      val done = occurrence(id)
      assertEquals(true, done["completed"]); assertEquals(2L, done["revision"])
      assertEquals(1, (done["history"] as List<*>).count { (it as Map<*, *>)["kind"] == "Done" })
    }
  }

  @Test fun lostProtectedAcknowledgementAfterCeCommitCannotOverwriteLaterReopen() {
    val id = create("create"); now += 60_000; fire(id)
    failAt = "content-committed"
    try { stop(id); fail("Fault must interrupt acknowledgement") } catch (_: java.util.concurrent.ExecutionException) {}
    // Model CE Reopen committed while the already-applied completion journal remained.
    request {
      val db = ContentDatabase.open(context)
      try { val old = db.records().find(id)!!; db.records().update(old.copy(completed = false, revision = old.revision + 1)) }
      finally { db.close() }
    }
    assertEquals(false, occurrence(id)["completed"])
    assertEquals(3L, occurrence(id)["revision"])
    assertEquals("Applied", stop(id)["status"])
    assertEquals(false, occurrence(id)["completed"])
  }

  @Test fun stopAllRetryRetainsOriginalSnapshotAcrossRestartAndLaterArrival() {
    val first = create("first"); val second = create("second"); val later = create("later")
    now += 60_000; fire(first); fire(second)
    val session = (request { engine.capabilities() } as Map<*, *>)["activeSessionId"] as String
    val command = mapOf("kind" to "StopAll", "operationId" to "stop-all", "expectedSessionId" to session)
    assertEquals(2, (request { engine.apply(command) } as Map<*, *>)["count"])
    engine.close(); engine = newEngine(); fire(later)
    assertEquals(2, (request { engine.apply(command) } as Map<*, *>)["count"])
    assertEquals("Alerting", occurrence(later)["deliveryState"])
    assertEquals(true, occurrence(first)["completed"]); assertEquals(true, occurrence(second)["completed"])
    val current = (request { engine.capabilities() } as Map<*, *>)["activeSessionId"]
    assertEquals("OPERATION_REUSED", (request { engine.apply(command + ("expectedSessionId" to current)) } as Map<*, *>)["errorCode"])
  }

  @Test fun stopBeforeQueuedDoneFencesItsRevisionAndDoneFirstFencesStopGeneration() {
    val first = create("first"); val second = create("second"); now += 60_000; fire(first); fire(second)
    stop(first)
    assertEquals("STALE_REVISION", (request { engine.apply(mapOf("kind" to "Done", "operationId" to "stale-done",
      "occurrenceId" to first, "expectedRevision" to 1L)) } as Map<*, *>)["errorCode"])
    request { engine.apply(mapOf("kind" to "Done", "operationId" to "done-second", "occurrenceId" to second, "expectedRevision" to 1L)) }
    assertEquals("STALE_GENERATION", stop(second, "stale-stop")["errorCode"])
    assertEquals(true, occurrence(second)["completed"])
  }

  @Test fun snoozedFiniteRepeatStopCompletesCurrentSlotAndRetainsNextSlot() {
    val spec = mapOf("kind" to "CreateSeries", "operationId" to "repeat", "title" to "Recurring probe",
      "alarmAtMs" to now + 60_000, "recurrence" to mapOf("frequency" to "daily", "interval" to 1, "count" to 2, "zoneMode" to "floating"))
    request { engine.apply(spec) }
    val rows = mutableListOf<AlertRecord>()
    protected { rows.addAll(it.all().sortedBy { row -> row.targetMs }) }
    assertEquals(2, rows.size)
    now += 60_000; fire(rows[0].occurrenceId)
    request { engine.apply(mapOf("kind" to "Snooze", "operationId" to "snooze", "occurrenceId" to rows[0].occurrenceId, "expectedGeneration" to 1L)) }
    now += 600_000; fire(rows[0].occurrenceId, 2)
    stop(rows[0].occurrenceId, generation = 2)
    val completed = occurrence(rows[0].occurrenceId)
    assertEquals(true, completed["completed"]); assertEquals(false, completed["skipped"])
    assertEquals(rows[0].nominalSlot, completed["nominalSlot"])
    protected { dao -> assertEquals(rows[1], dao.find(rows[1].occurrenceId)); assertEquals(2, dao.all().size) }
  }
}

package com.remilo.alarm.engine

import android.app.Application
import android.content.Context
import android.os.UserManager
import com.remilo.alarm.data.*
import com.remilo.alarm.system.AlarmRegistrar
import com.remilo.alarm.system.AlarmScheduler
import org.json.JSONObject
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
import java.util.concurrent.ExecutionException
import java.util.concurrent.TimeUnit

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34], application = Application::class)
class PermanentDeletionTest {
  private lateinit var context: Context
  private lateinit var engine: AlarmEngine
  private var now = 1_800_000_000_000L
  private var failure: String? = null
  private val registrar = object : AlarmRegistrar {
    override fun canSchedule() = true
    override fun register(alert: AlertRecord) {}
    override fun cancel(alert: AlertRecord) {}
  }
  private fun newEngine() = AlarmEngine(context, registrar, { now }, purgeCheckpoint = { stage ->
    if (failure == stage) { failure = null; throw IllegalStateException("Simulated loss at $stage") }
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
    val reply = CompletableFuture<Any?>()
    engine.request(block, { reply.complete(it) }, { reply.completeExceptionally(IllegalStateException(it)) })
    return reply.get(20, TimeUnit.SECONDS)
  }
  private fun apply(command: Map<String, Any?>) = request { engine.apply(command) } as Map<*, *>
  private fun create(operation: String = "create", recurring: Boolean = false): String {
    val result = apply(mapOf("kind" to if (recurring) "CreateSeries" else "Create", "operationId" to operation,
      "title" to "Private $operation", "notes" to "Secret occurrence notes", "eventStartMs" to now + 60_000,
      "alarmAtMs" to now + 60_000, "mode" to "None", "zoneId" to "UTC") +
      if (recurring) mapOf("recurrence" to mapOf("frequency" to "daily", "zoneMode" to "pinned", "count" to 6)) else emptyMap())
    assertNotEquals("Rejected", result["status"])
    if (!recurring) return (result["occurrence"] as Map<*, *>)["id"] as String
    val page = request { engine.query(mapOf("segmentId" to result["segmentId"]), null) } as Map<*, *>
    return ((page["items"] as List<*>).first() as Map<*, *>)["id"] as String
  }
  private fun occurrence(id: String) = request { engine.occurrence(id) } as Map<*, *>?
  private fun command(id: String, kind: String, operation: String = kind, revision: Long? = null): Map<String, Any?> =
    mapOf("kind" to kind, "operationId" to operation, "occurrenceId" to id,
      "expectedRevision" to (revision ?: (occurrence(id)!!["revision"] as Number).toLong()))
  private fun trash(id: String) { assertEquals("Applied", apply(command(id, "Delete", "trash:$id"))["status"]) }
  private fun content(block: (ContentDao) -> Any?): Any? = request {
    val db = ContentDatabase.open(context)
    try { block(db.records()) } finally { db.close() }
  }
  private fun protected(block: (OperationalDao) -> Any?): Any? = request {
    val db = OperationalDatabase.open(context)
    try { block(db.records()) } finally { db.close() }
  }
  private fun recover() {
    val done = CompletableFuture<Unit>(); engine.recover { done.complete(Unit) }; done.get(20, TimeUnit.SECONDS)
  }
  private fun restart() { engine.close(); engine = newEngine(); request { Unit } }

  @Test fun onlyCurrentTrashedRevisionCanBePurged() {
    val id = create()
    assertEquals("Rejected", apply(command(id, "Purge", "not-trash"))["status"])
    assertNotNull(occurrence(id)); assertEquals(emptyList<PurgedOccurrence>(), content { it.purged() })
    trash(id)
    val captured = command(id, "Purge", "purge")
    apply(command(id, "UndoDelete", "restore"))
    assertEquals("STALE_REVISION", apply(captured)["errorCode"])
    assertEquals(false, occurrence(id)!!["deleted"])
  }
  @Test fun purgeRemovesContentActivityAndOutboxButKeepsOtherItemsAndExactReceipts() {
    val id = create(); val other = create("other"); trash(id)
    val captured = command(id, "Purge", "purge")
    assertEquals("Applied", apply(captured)["status"])
    assertNull(occurrence(id)); assertNotNull(occurrence(other))
    content { dao ->
      assertNull(dao.find(id)); assertTrue(dao.history(id).isEmpty())
      assertTrue(dao.pending().none { it.occurrenceId == id })
      assertEquals(PurgedOccurrence(id, null, null), dao.purged(id))
      assertEquals("Purge", dao.receipt("purge")!!.kind)
    }
    assertEquals("Applied", apply(captured)["status"])
    assertEquals("Rejected", apply(captured + ("occurrenceId" to other))["status"])
    assertEquals("Rejected", apply(captured + ("expectedRevision" to 123))["status"])
    assertEquals("NOT_FOUND", apply(command(id, "UndoDelete", "late-restore", 2))["errorCode"])
    restart(); recover(); assertNull(occurrence(id)); assertNotNull(occurrence(other))
    val done = CompletableFuture<Unit>()
    engine.receive(AlarmScheduler.intent(context, "fire", id, 1)) { done.complete(Unit) }; done.get(20, TimeUnit.SECONDS)
    assertNull(occurrence(id))
  }
  @Test fun interruptedTransactionRollsBackAndLostCommittedReplyRetriesWithoutNewMutation() {
    val id = create(); trash(id)
    val captured = command(id, "Purge", "purge")
    failure = "before-commit"
    assertTrue(assertThrows(ExecutionException::class.java) { apply(captured) }.cause is IllegalStateException)
    content { dao -> assertNotNull(dao.find(id)); assertNull(dao.purged(id)); assertNull(dao.receipt("purge")); assertFalse(dao.history(id).isEmpty()) }
    failure = "committed"
    assertTrue(assertThrows(ExecutionException::class.java) { apply(captured) }.cause is IllegalStateException)
    assertNull(occurrence(id)); restart()
    assertEquals("Applied", apply(captured)["status"])
    assertEquals(1, (content { it.purged() } as List<*>).size)
  }
  @Test fun recurringPurgeStaysGoneThroughRecoveryAndLeavesFuturePlanIntact() {
    val id = create(recurring = true); val segment = occurrence(id)!!["segmentId"] as String
    trash(id); apply(command(id, "Purge", "purge"))
    restart(); now += 3 * 86_400_000L; recover()
    assertNull(occurrence(id))
    val future = (request { engine.query("all", null) } as Map<*, *>)["items"] as List<Map<*, *>>
    assertTrue(future.any { it["segmentId"] == segment })
    assertNotNull(request { engine.getSeries(segment) })
    protected { dao -> dao.action(ActionRecord("late-history", id, "Done", now, 1)) }
    occurrence(id)
    assertTrue((content { it.history(id) } as List<*>).isEmpty())
    assertEquals(emptyList<ActionRecord>(), protected { it.actions() })
  }
  @Test fun versionFourBackupCarriesOnlyRecurringIdentityExclusionsAndRestoresThemBeforeDirectBoot() {
    val oneOff = create(); trash(oneOff); apply(command(oneOff, "Purge", "purge-one"))
    val id = create("series", recurring = true); val before = occurrence(id)!!
    trash(id); apply(command(id, "Purge", "purge-series"))
    val backup = request { engine.exportBackup() } as String
    val bundle = BackupCodec.decode(backup)
    assertEquals(4, JSONObject(backup).getInt("version"))
    assertEquals(listOf(PurgedOccurrence(id, before["segmentId"] as String, before["nominalSlot"] as String)), bundle.purged)
    assertTrue(bundle.records.none { it.id == id || it.id == oneOff })
    assertTrue(bundle.history.none { it.occurrenceId == id || it.occurrenceId == oneOff })
    assertFalse(backup.contains("Private create"))
    engine.close(); context.deleteDatabase("remilo-content.db")
    context.createDeviceProtectedStorageContext().deleteDatabase("remilo-operational.db"); engine = newEngine()
    assertEquals("Applied", request { engine.importBackup(backup, emptyList(), "import") }.let { (it as Map<*, *>)["status"] })
    assertNull(occurrence(id))
    assertEquals("Deleted", protected { it.find(id)!!.state })
    shadowOf(context.getSystemService(UserManager::class.java)).setUserUnlocked(false)
    now += 86_400_000L; restart(); recover()
    assertEquals("Deleted", protected { it.find(id)!!.state })
    shadowOf(context.getSystemService(UserManager::class.java)).setUserUnlocked(true); recover()
    assertNull(occurrence(id))
    assertEquals("Applied", request { engine.importBackup(backup, emptyList(), "import") }.let { (it as Map<*, *>)["status"] })
  }
  @Test fun oldBackupCannotResurrectLocalPurgeButExplicitCopyGetsANewIdentity() {
    val id = create(); val backup = request { engine.exportBackup() } as String
    val legacy = JSONObject(backup).put("version", 3).also { it.remove("purgedOccurrences") }.toString()
    trash(id); apply(command(id, "Purge", "purge"))
    val preview = request { engine.previewImport(legacy) } as Map<*, *>
    assertEquals(true, ((preview["items"] as List<*>).single() as Map<*, *>)["conflict"])
    request { engine.importBackup(legacy, emptyList(), "keep-local") }
    assertNull(occurrence(id))
    request { engine.importBackup(legacy, listOf(id), "copy") }
    val restored = ((request { engine.query("all", null) } as Map<*, *>)["items"] as List<*>).single() as Map<*, *>
    assertNotEquals(id, restored["id"]); assertNull(occurrence(id))
  }
  @Test fun committedImportRetryRepairsExclusionsBeforeReplenishmentAndDirectBoot() {
    val id = create(recurring = true); val segment = occurrence(id)!!["segmentId"] as String
    trash(id); apply(command(id, "Purge", "purge"))
    val backup = request { engine.exportBackup() } as String
    val bundle = BackupCodec.decode(backup)
    engine.close(); context.deleteDatabase("remilo-content.db")
    context.createDeviceProtectedStorageContext().deleteDatabase("remilo-operational.db"); engine = newEngine()
    // Persist the CE commit boundary of an import whose DP projection never ran.
    content { dao ->
      bundle.series.forEach { dao.series(it); dao.pendingSeries(PendingSeries("import:${it.id}", it.id)) }
      bundle.purged.forEach(dao::purge)
      dao.receipt(CreationReceipt("import", "import", "Import"))
    }
    assertNull(protected { it.plan(segment) }); assertNull(protected { it.find(id) })
    val result = request { engine.importBackup(backup, emptyList(), "import") } as Map<*, *>
    assertEquals("Applied", result["status"]); assertEquals(true, result["retry"])
    assertEquals("Deleted", protected { it.find(id)!!.state })
    assertEquals("Active", protected { it.plan(segment)!!.state })
    assertEquals(emptyList<PendingSeries>(), content { it.pendingSeries() })
    assertNull(occurrence(id))
    shadowOf(context.getSystemService(UserManager::class.java)).setUserUnlocked(false)
    now += 86_400_000L; restart(); recover()
    assertEquals("Deleted", protected { it.find(id)!!.state })
    shadowOf(context.getSystemService(UserManager::class.java)).setUserUnlocked(true); recover()
    assertNull(occurrence(id))
  }
  @Test fun explicitlyCopiedRepeatFamilyRemapsItsExclusionsAndPreservesBothFamilies() {
    val id = create(recurring = true); val segment = occurrence(id)!!["segmentId"] as String
    val family = (request { engine.getSeries(segment) } as Map<*, *>)["seriesId"] as String
    trash(id); apply(command(id, "Purge", "purge"))
    val backup = request { engine.exportBackup() } as String
    request { engine.importBackup(backup, listOf(family), "copy-family") }
    val exclusions = content { it.purged() } as List<PurgedOccurrence>
    assertEquals(2, exclusions.size); assertEquals(2, exclusions.map { it.segmentId }.distinct().size)
    exclusions.forEach { assertNull(occurrence(it.id)); assertEquals("Deleted", protected { dao -> dao.find(it.id)!!.state }) }
    assertEquals(2, (content { it.series() } as List<*>).size)
    restart(); recover(); exclusions.forEach { assertNull(occurrence(it.id)) }
  }
}

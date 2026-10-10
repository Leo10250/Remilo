package com.remilo.alarm.engine

import android.app.Application
import android.content.Context
import android.os.UserManager
import com.remilo.alarm.calendar.*
import com.remilo.alarm.data.*
import com.remilo.alarm.system.AlarmRegistrar
import org.json.JSONObject
import org.junit.*
import org.junit.Assert.*
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import java.util.concurrent.*
import java.util.UUID

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34], application = Application::class)
class CalendarIsolationTest {
  private lateinit var context: Context
  private lateinit var engine: AlarmEngine
  private var registrations = 0
  private val now = 1_800_000_000_000L
  @Before fun setup() {
    context = RuntimeEnvironment.getApplication(); shadowOf(context.getSystemService(UserManager::class.java)).setUserUnlocked(true)
    context.deleteDatabase("remilo-content.db"); context.createDeviceProtectedStorageContext().deleteDatabase("remilo-operational.db")
    engine = AlarmEngine(context, object : AlarmRegistrar {
      override fun canSchedule() = true
      override fun register(alert: AlertRecord) { registrations++ }
      override fun cancel(alert: AlertRecord) { registrations++ }
    }, { now })
  }
  @After fun teardown() { engine.close() }
  private fun <T> request(block: () -> T): T {
    val result = CompletableFuture<T>(); engine.request(block, { @Suppress("UNCHECKED_CAST") result.complete(it as T) }, { result.completeExceptionally(IllegalStateException(it)) })
    return result.get(10, TimeUnit.SECONDS)
  }
  private fun <T> calendar(block: (CalendarStore) -> T): T {
    val result = CompletableFuture<T>(); engine.calendarRequest(true, block, { result.complete(it) }, { result.completeExceptionally(CalendarFailure(it)) })
    return result.get(10, TimeUnit.SECONDS)
  }
  private fun create(): String = request {
    val result = engine.apply(mapOf("kind" to "Create", "operationId" to "local-create", "title" to "PRIVATE ALARM", "notes" to "PRIVATE NOTES", "eventStartMs" to now + 60_000, "mode" to "Alarm"))
    assertNotEquals("Rejected", result["status"]); (result["occurrence"] as Map<*, *>)["id"] as String
  }
  private fun capture(id: String): CalendarOperation = calendar { store ->
    store.connect(CalendarAccount("PRIVATE SUBJECT", "private@example.test"), 0)
    store.select(UUID.randomUUID().toString(), 1, "PRIVATE SUBJECT", OwnedCalendar("PRIVATE CALENDAR ID", "PRIVATE CALENDAR NAME", "UTC"))
    val preview = store.preview(id); val op = UUID.randomUUID().toString()
    store.capture(mapOf("operationId" to op, "occurrenceId" to id, "expectedRevision" to preview["reminderRevision"], "expectedConnectionRevision" to preview["connectionRevision"], "fingerprint" to preview["fingerprint"]))
    store.operation(op)!!
  }
  private fun operational(): List<AlertRecord> = request { OperationalDatabase.open(context).let { db -> try { db.records().all() } finally { db.close() } } }
  @Test fun publicationAndDisconnectDoNotChangeProtectedAlarmRowsOrRegistrations() {
    val id = create(); val before = operational(); val count = registrations; val job = capture(id)
    calendar { it.begin(job.operationId); it.permitInsert(job.operationId); it.confirm(job.operationId, JSONObject(job.payload)); it.disconnect(UUID.randomUUID().toString(), 2) }
    assertEquals(before, operational()); assertEquals(count, registrations)
    val dp = context.createDeviceProtectedStorageContext().getDatabasePath("remilo-operational.db").readBytes().toString(Charsets.ISO_8859_1)
    listOf("PRIVATE SUBJECT", "private@example.test", "PRIVATE CALENDAR", "PRIVATE NOTES", "transient-token").forEach { assertFalse(dp.contains(it)) }
  }
  @Test fun portableBackupKeepsFormatFourWithoutConnectionJobsOrBinding() {
    val id = create(); val job = capture(id); val backup = request { engine.exportBackup() }
    assertEquals(4, JSONObject(backup).getInt("version"))
    listOf("PRIVATE SUBJECT", "private@example.test", "PRIVATE CALENDAR", job.operationId, job.eventId, "calendar_operations", "accessToken").forEach { assertFalse(backup.contains(it)) }
    assertTrue(backup.contains("PRIVATE NOTES")) // Reminder content remains ordinary portable data.
  }
  @Test fun blockedTransportDoesNotDelayLocalDoneAndLateSuccessRemainsDurable() {
    val id = create(); val job = capture(id); val entered = CountDownLatch(1); val release = CountDownLatch(1)
    val access = object : CalendarStateAccess { override fun <T> access(write: Boolean, block: (CalendarStore) -> T): T = calendar(block) }
    val fake = object : CalendarTransport {
      override fun account(token: String) = CalendarAccount(job.subject, job.email)
      override fun calendars(token: String, cursor: String?) = CalendarPage(emptyList(), null)
      override fun calendar(token: String, id: String) = OwnedCalendar(id, "Test", "UTC")
      override fun event(token: String, calendarId: String, eventId: String): JSONObject? { entered.countDown(); check(release.await(10, TimeUnit.SECONDS)); return JSONObject(job.payload) }
      override fun insert(token: String, calendarId: String, payload: String): JSONObject = throw AssertionError("Must reconcile")
    }
    val io = Executors.newSingleThreadExecutor()
    try {
      val pending = io.submit { CalendarPublisher(access, fake).publish(calendar { it.begin(job.operationId) }!!, "fake-token") }
      assertTrue(entered.await(10, TimeUnit.SECONDS))
      val done = CompletableFuture<Any?>()
      engine.request({ val item = engine.occurrence(id)!!; engine.apply(mapOf("kind" to "Done", "operationId" to "done", "occurrenceId" to id, "expectedRevision" to item["revision"])) }, { done.complete(it) }, { done.completeExceptionally(IllegalStateException(it)) })
      assertEquals("Applied", (done.get(2, TimeUnit.SECONDS) as Map<*, *>)["status"])
      release.countDown(); pending.get(10, TimeUnit.SECONDS); assertEquals("Published", calendar { it.operation(job.operationId)!!.state })
    } finally { release.countDown(); io.shutdownNow() }
  }
  @Test fun directBootCannotInitializeCalendarOrCreateContentStorage() {
    shadowOf(context.getSystemService(UserManager::class.java)).setUserUnlocked(false)
    try { calendar { it.connection() }; fail("Calendar must require unlock") } catch (error: ExecutionException) { assertTrue(error.cause is CalendarFailure) }
    assertFalse(context.getDatabasePath("remilo-content.db").exists())
  }
}

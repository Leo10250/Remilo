package com.remilo.alarm.calendar

import android.app.Application
import android.content.Context
import android.os.UserManager
import com.remilo.alarm.data.*
import com.remilo.alarm.engine.AlarmEngine
import com.remilo.alarm.system.AlarmRegistrar
import org.json.*
import org.junit.*
import org.junit.Assert.*
import org.junit.runner.RunWith
import org.robolectric.*
import org.robolectric.annotation.Config
import java.time.Instant
import java.util.UUID
import java.util.concurrent.*

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34], application = Application::class)
class CalendarAutomaticTest {
  private lateinit var context: Context
  private lateinit var engine: AlarmEngine
  private var now = 1_800_000_000_000L
  private var elapsed = 0L
  private var opportunities = 0
  private var registrations = 0
  private var cancelled = 0
  private val calendar = OwnedCalendar("source", "Private calendar label", "UTC", hasDefaultReminders = false)
  private val events = mutableMapOf<String, JSONObject>()
  private val patches = mutableListOf<JSONObject>()
  private var loseReply = false
  private var applyPatch = true
  private var rejectPatch = false
  private var exhaustWriteBudget = false
  private var exhaustReadBudget = false
  private var pages: ((String?, String?) -> JSONObject)? = null
  private val queries = mutableListOf<Pair<String?, String?>>()
  private val access = object : CalendarAutomaticAccess {
    override fun <T> access(write: Boolean, block: (CalendarStore) -> T): T = calendar(block)
    override fun <T> links(write: Boolean, block: (CalendarLinkStore) -> T): T = calendar { block(it.links) }
    override fun local(operationId: String, connectionRevision: Long): Map<String, Any?> = native { engine.calendarLocal(operationId, connectionRevision) }
    override fun context(id: String): Map<*, *> = native { engine.calendarContext(id)!! }
    override fun preflight(previewId: String, selections: Map<String, String?>): String? = native { engine.calendarPreflight(previewId, selections) }
  }
  private val transport = object : CalendarTransport {
    override fun account(token: String) = CalendarAccount("subject", "private@example.test")
    override fun calendars(token: String, cursor: String?) = CalendarPage(listOf(calendar), null)
    override fun calendar(token: String, id: String) = calendar
    override fun event(token: String, calendarId: String, eventId: String): JSONObject? {
      if (exhaustReadBudget) throw CalendarFailure("BUDGET")
      return events[eventId]?.let { JSONObject(it.toString()) }
    }
    override fun instance(token: String, calendarId: String, masterId: String, originalStart: String): JSONObject {
      val id = "instance-" + CalendarMapper.hash(originalStart).take(16)
      events[id]?.let { return JSONObject(it.toString()) }
      val master = events[masterId]!!
      val result = JSONObject(master.toString()).also { it.remove("recurrence"); it.remove("extendedProperties") }
      val start = Instant.parse(originalStart)
      val duration = Instant.parse(master.getJSONObject("end").getString("dateTime")).toEpochMilli() - Instant.parse(master.getJSONObject("start").getString("dateTime")).toEpochMilli()
      return result.put("id", id).put("recurringEventId", masterId).put("originalStartTime", JSONObject().put("dateTime", originalStart))
        .put("start", JSONObject().put("dateTime", start.toString()).put("timeZone", "UTC"))
        .put("end", JSONObject().put("dateTime", start.plusMillis(duration).toString()).put("timeZone", "UTC"))
    }
    override fun insert(token: String, calendarId: String, payload: String): JSONObject = throw AssertionError("A linked event must not be recreated")
    override fun patch(token: String, calendarId: String, eventId: String, etag: String, payload: String): JSONObject {
      if (exhaustWriteBudget) throw CalendarFailure("BUDGET")
      patches.add(JSONObject(payload))
      val event = events[eventId]!!
      if (rejectPatch) { rejectPatch = false; event.put("etag", "unrelated-version").put("location", "Unrelated location"); throw CalendarFailure("STALE_REMOTE") }
      if (event.getString("etag") != etag) throw CalendarFailure("STALE_REMOTE")
      if (applyPatch) { val patch = JSONObject(payload); patch.keys().forEach { event.put(it, patch.get(it)) }; event.put("etag", "patch-${patches.size}") }
      if (loseReply) { loseReply = false; throw CalendarFailure("NETWORK") }
      return JSONObject(event.toString())
    }
    override fun syncEvents(token: String, calendarId: String, syncToken: String?, pageToken: String?): JSONObject {
      queries.add(syncToken to pageToken)
      return pages?.invoke(syncToken, pageToken) ?: JSONObject().put("items", JSONArray(events.values.toList())).put("nextSyncToken", "sync-${queries.size}")
    }
  }
  @Before fun setup() {
    context = RuntimeEnvironment.getApplication()
    Shadows.shadowOf(context.getSystemService(UserManager::class.java)).setUserUnlocked(true)
    context.deleteDatabase("remilo-content.db"); context.createDeviceProtectedStorageContext().deleteDatabase("remilo-operational.db")
    open(); calendar { it.connect(CalendarAccount("subject", "private@example.test"), 0) }
    events["event"] = event("event")
  }
  private fun event(id: String) = JSONObject().put("id", id).put("etag", "original").put("summary", "Original title").put("description", "Original notes")
    .put("start", JSONObject().put("dateTime", Instant.ofEpochMilli(now + 3_600_000).toString()).put("timeZone", "UTC"))
    .put("end", JSONObject().put("dateTime", Instant.ofEpochMilli(now + 5_400_000).toString()).put("timeZone", "UTC"))
  private fun open() {
    engine = AlarmEngine(context, object : AlarmRegistrar {
      override fun canSchedule() = true
      override fun register(alert: AlertRecord) { registrations++ }
      override fun cancel(alert: AlertRecord) { cancelled++ }
    }, { now }, { elapsed }, calendarOpportunity = { opportunities++ })
  }
  @After fun teardown() { engine.close() }
  private fun <T> native(block: () -> T): T {
    val future = CompletableFuture<T>()
    engine.request({ try { block() } catch (error: Exception) { future.completeExceptionally(error); null } },
      { if (!future.isDone) { @Suppress("UNCHECKED_CAST") future.complete(it as T) } }, { future.completeExceptionally(CalendarFailure(it)) })
    try { return future.get(10, TimeUnit.SECONDS) } catch (error: ExecutionException) { throw error.cause!! }
  }
  private fun <T> calendar(block: (CalendarStore) -> T): T {
    val future = CompletableFuture<T>()
    engine.calendarRequest(block = { store -> try { block(store) } catch (error: Exception) { future.completeExceptionally(error); throw error } },
      resolve = { future.complete(it) }, reject = { future.completeExceptionally(CalendarFailure(it)) })
    try { return future.get(10, TimeUnit.SECONDS) } catch (error: ExecutionException) { throw error.cause!! }
  }
  private fun imported(automatic: Boolean = true, id: String = "event", mode: String = "None"): CalendarLinkOperation {
    val preview = calendar { it.links.preview(calendar, events[id]!!, null, mapOf("mode" to mode, "automaticSync" to automatic), 0) }
    val command = mapOf("kind" to "ImportCalendarEvent", "operationId" to UUID.randomUUID().toString(), "previewId" to preview["previewId"])
    native { engine.calendarCapture(command) }
    val job = calendar { it.links.operation(command["operationId"] as String)!! }
    CalendarLinkRunner(access, transport).run(job.operationId, "synthetic")
    assertEquals("Confirmed", calendar { it.links.operation(job.operationId)!!.state })
    return job
  }
  private fun edit(id: String, values: Map<String, Any?>) {
    val item = native { engine.occurrence(id)!! }
    val result = native { engine.apply(values + mapOf("kind" to "Edit", "operationId" to UUID.randomUUID().toString(), "occurrenceId" to id, "expectedRevision" to item["revision"])) }
    assertNotEquals("Rejected", result["status"])
  }
  private fun run(id: String? = null) = CalendarAutomaticRunner(access, transport, { now }, { elapsed }).run("synthetic", true, id)
  @Test fun capturedActivationHasNoAutomaticPermissionUntilBothCopiesAgree() {
    val preview = calendar { it.links.preview(calendar, events["event"]!!, null, emptyMap(), 0) }
    assertEquals(true, (preview["choices"] as Map<*, *>)["automaticSync"])
    val command = mapOf("kind" to "ImportCalendarEvent", "operationId" to "activate-import", "previewId" to preview["previewId"])
    val captured = native { engine.calendarCapture(command) }
    val id = captured["occurrenceId"] as String
    assertEquals("Pending", calendar { it.sync.state(id).mode }); assertFalse(calendar { it.sync.eligible(id) })
    CalendarLinkRunner(access, transport).run("activate-import", "synthetic")
    assertEquals("Automatic", calendar { it.sync.state(id).mode }); assertTrue(calendar { it.sync.eligible(id) })
  }
  @Test fun optingOutKeepsManualPermissionAndIndividualActivationRequiresFreshPreview() {
    val job = imported(false); edit(job.occurrenceId, mapOf("notes" to "Native notes")); run()
    assertTrue(patches.isEmpty()); assertEquals("Manual", calendar { it.sync.state(job.occurrenceId).mode })
    val preview = CalendarAutomaticRunner(access, transport, { now }).preview("synthetic", job.occurrenceId, true)
    native { engine.calendarCapture(mapOf("kind" to "EnableAutomaticCalendarSync", "operationId" to "activate-manual", "previewId" to preview["previewId"], "selections" to preview["selections"])) }
    assertFalse(calendar { it.sync.eligible(job.occurrenceId) })
    CalendarLinkRunner(access, transport).run("activate-manual", "synthetic")
    assertTrue(calendar { it.sync.eligible(job.occurrenceId) }); assertEquals("Native notes", events["event"]!!.getString("description"))
  }
  @Test fun separateGroupsMergeAutomaticallyAndUnrelatedContentIsRetained() {
    val job = imported(); edit(job.occurrenceId, mapOf("notes" to "Authored notes"))
    events["event"]!!.put("summary", "Google title").put("etag", "google-version").put("updated", "2099-01-01T00:00:00Z").put("location", "Keep location")
    assertEquals(1, run().confirmed)
    val local = native { engine.occurrence(job.occurrenceId)!! }
    assertEquals("Google title", local["title"]); assertEquals("Authored notes", local["notes"])
    assertEquals("Keep location", events["event"]!!.getString("location")); assertEquals(setOf("description"), patches.single().keys().asSequence().toSet())
    assertEquals("Confirmed", calendar { it.sync.state(job.occurrenceId).status })
  }
  @Test fun automaticCaptureRevalidatesTheNativeComparisonRatherThanTrustingSelections() {
    val id = imported().occurrenceId; edit(id, mapOf("title" to "Local title"))
    events["event"]!!.put("summary", "Remote title")
    fun rejected(code: String) {
      val preview = calendar { it.links.preview(calendar, events["event"]!!, id, emptyMap(), 0) }
      try {
        calendar { it.links.capture(mapOf("kind" to "AutomaticCalendarTransfer", "operationId" to UUID.randomUUID().toString(), "previewId" to preview["previewId"],
          "selections" to mapOf("title" to "google", "notes" to "remilo", "schedule" to "remilo"))) }
        fail("Automatic capture must enforce native comparison")
      } catch (error: CalendarFailure) { assertEquals(code, error.code) }
    }
    rejected("RESOLUTION_REQUIRED")
    events["event"]!!.put("summary", "Original title"); rejected("INVALID_INPUT")
    assertTrue(patches.isEmpty()); assertEquals("Local title", native { engine.occurrence(id)!! }["title"])
  }
  @Test fun genuineConflictPersistsAcrossRestartWithoutOverwritingEitherCopy() {
    val job = imported(); edit(job.occurrenceId, mapOf("title" to "Local title"))
    events["event"]!!.put("summary", "Remote title").put("etag", "conflict-version")
    run(); val issue = calendar { it.sync.issues(null) }
    assertEquals(1, issue["count"]); assertTrue(patches.isEmpty())
    engine.close(); open(); run()
    assertEquals("Local title", native { engine.occurrence(job.occurrenceId)!!["title"] }); assertEquals("Remote title", events["event"]!!.getString("summary"))
    assertEquals(issue, calendar { it.sync.issues(null) })
  }
  @Test fun conditionalRejectionRecomparesAnUnrelatedEditWithoutManufacturingConflict() {
    val job = imported(); edit(job.occurrenceId, mapOf("notes" to "New notes")); rejectPatch = true
    run(); assertEquals("UpdatePending", calendar { it.sync.state(job.occurrenceId).status })
    run(); assertEquals("New notes", events["event"]!!.getString("description")); assertEquals("Unrelated location", events["event"]!!.getString("location"))
    assertEquals(0, calendar { it.sync.issues(null)["count"] })
  }
  @Test fun lostReplyConfirmsSameOperationAndKeepsNewerLocalEditsDirty() {
    val job = imported(); edit(job.occurrenceId, mapOf("notes" to "Sent notes")); loseReply = true
    run(); assertEquals("Unconfirmed", calendar { it.sync.state(job.occurrenceId).status }); assertEquals(1, patches.size)
    edit(job.occurrenceId, mapOf("title" to "Later local title")); assertTrue(run(job.occurrenceId).continuation)
    assertEquals(1, patches.size); assertEquals("Later local title", native { engine.occurrence(job.occurrenceId)!!["title"] })
    assertEquals("UpdatePending", calendar { it.sync.state(job.occurrenceId).status })
    run(); assertEquals(2, patches.size); assertEquals("Later local title", events["event"]!!.getString("summary"))
  }
  @Test fun unmatchedSentOutcomeNeverResendsBlindly() {
    val job = imported(); edit(job.occurrenceId, mapOf("notes" to "Unconfirmed notes")); applyPatch = false; loseReply = true
    run(); run(job.occurrenceId); engine.close(); open(); run(job.occurrenceId)
    assertEquals(1, patches.size); assertEquals("Unconfirmed", calendar { it.sync.state(job.occurrenceId).status })
  }
  @Test fun budgetExpiryBeforeHttpWriteRetainsTheSameOperationForDurableRetry() {
    val id = imported().occurrenceId; edit(id, mapOf("notes" to "Budgeted update"))
    exhaustWriteBudget = true; run()
    val state = calendar { it.sync.state(id) }; val job = calendar { it.links.operation(state.operationId)!! }
    assertEquals("UpdatePending", state.status); assertEquals(now + 60_000, state.retryAtMs)
    assertFalse(job.remoteAttempted); assertTrue(patches.isEmpty()); assertTrue(calendar { it.sync.actionableIssues().isEmpty() })
    exhaustWriteBudget = false; now += 60_001; run()
    assertEquals(1, patches.size); assertEquals("Confirmed", calendar { it.links.operation(job.operationId)!!.state })
    assertEquals("Budgeted update", events["event"]!!.getString("description"))
  }
  @Test fun failedInspectionCannotClearAnEarlierUnconfirmedSentMarker() {
    val id = imported().occurrenceId; edit(id, mapOf("notes" to "Unconfirmed update"))
    loseReply = true; applyPatch = false; run()
    val operation = calendar { it.sync.state(id).operationId }
    assertTrue(calendar { it.links.operation(operation)!!.remoteAttempted })
    exhaustReadBudget = true; run()
    assertTrue(calendar { it.links.operation(operation)!!.remoteAttempted }); assertEquals(1, patches.size)
    exhaustReadBudget = false; run()
    assertEquals(1, patches.size); assertEquals("Unconfirmed", calendar { it.sync.state(id).status })
  }
  @Test fun metadataTransferDoesNotRescheduleOrChangeAlarmGeneration() {
    val job = imported(mode = "Alarm"); val before = native { engine.occurrence(job.occurrenceId)!! }
    val registered = registrations; val cancelledBefore = cancelled
    events["event"]!!.put("summary", "Metadata only").put("etag", "metadata-version"); run()
    val after = native { engine.occurrence(job.occurrenceId)!! }
    assertEquals(before["generation"], after["generation"]); assertEquals(before["nextAlertMs"], after["nextAlertMs"])
    assertEquals(registered, registrations); assertEquals(cancelledBefore, cancelled)
  }
  private fun remoteTime(start: Long) {
    events["event"]!!.getJSONObject("start").put("dateTime", Instant.ofEpochMilli(start).toString())
    events["event"]!!.getJSONObject("end").put("dateTime", Instant.ofEpochMilli(start + 1_800_000).toString())
    events["event"]!!.put("etag", "time-$start")
  }
  @Test fun inboundTimeUpdatesLinkedTimingWhilePreservingAFuturePostponement() {
    val job = imported(mode = "Alarm"); val before = native { engine.occurrence(job.occurrenceId)!! }
    val postpone = now + 7_200_000
    assertEquals("Applied", native { engine.apply(mapOf("kind" to "Postpone", "operationId" to "postpone", "occurrenceId" to job.occurrenceId,
      "expectedGeneration" to before["generation"], "alarmAtMs" to postpone)) }["status"])
    remoteTime(now + 5_400_000); run()
    val after = native { engine.occurrence(job.occurrenceId)!! }
    assertEquals(now + 5_400_000, after["eventStartMs"]); assertEquals(now + 5_400_000, after["dueAtMs"])
    assertEquals(now + 5_400_000, after["alarmAtMs"]); assertEquals(postpone, after["nextAlertMs"])
    assertEquals("Confirmed", calendar { it.sync.state(job.occurrenceId).status })
  }
  @Test fun independentDueAndAlarmSurviveInboundTimeChanges() {
    val job = imported(mode = "Alarm")
    edit(job.occurrenceId, mapOf("dueLinked" to false, "alarmLinked" to false, "dueAtMs" to now + 4_200_000, "alarmAtMs" to now + 4_800_000))
    remoteTime(now + 5_400_000); run()
    val after = native { engine.occurrence(job.occurrenceId)!! }
    assertEquals(now + 5_400_000, after["eventStartMs"]); assertEquals(now + 4_200_000, after["dueAtMs"])
    assertEquals(now + 4_800_000, after["alarmAtMs"])
  }
  @Test fun elapsedScheduleRequiresReviewAndKeepsTheCurrentLocalTarget() {
    val job = imported(mode = "Alarm"); val before = native { engine.occurrence(job.occurrenceId)!! }
    remoteTime(now - 3_600_000); run()
    val after = native { engine.occurrence(job.occurrenceId)!! }
    assertEquals(before["eventStartMs"], after["eventStartMs"]); assertEquals(before["nextAlertMs"], after["nextAlertMs"])
    assertEquals("ElapsedAlert", calendar { it.sync.state(job.occurrenceId).pauseReason }); assertEquals(1, calendar { it.sync.issues(null)["count"] })
  }
  @Test fun ringingScheduleDefersWithoutTouchingTheSessionAndRecomparesAfterTimeout() {
    val job = imported(mode = "Alarm")
    native { OperationalDatabase.open(context).let { db -> try {
      val alert = db.records().find(job.occurrenceId)!!
      db.records().put(alert.copy(state = "Alerting", sessionId = "ringing"))
      db.records().session(SessionRecord("ringing", "Active", 20, 300_020))
    } finally { db.close() } } }
    val before = native { engine.occurrence(job.occurrenceId)!! }; remoteTime(now + 5_400_000); run()
    assertEquals("Deferred", calendar { it.sync.state(job.occurrenceId).status }); assertEquals(0, calendar { it.sync.issues(null)["count"] })
    assertEquals(before["generation"], native { engine.occurrence(job.occurrenceId)!!["generation"] })
    native { OperationalDatabase.open(context).let { db -> try { assertEquals(300_020L, db.records().session("ringing")!!.deadlineElapsedMs) } finally { db.close() } } }
    engine.audioEnded("ringing", "Timeout"); native { true }; run()
    assertEquals(now + 5_400_000, native { engine.occurrence(job.occurrenceId)!!["eventStartMs"] })
    assertFalse(native { engine.occurrence(job.occurrenceId)!!["completed"] } as Boolean)
  }
  @Test fun disconnectAndReconnectRequireFreshReviewWithoutRetargetingTheAssociation() {
    val job = imported(); calendar { it.disconnect("disconnect", it.connection().revision) }
    calendar { it.connect(CalendarAccount("subject", "private@example.test"), it.connection().revision) }
    edit(job.occurrenceId, mapOf("notes" to "After reconnect")); run()
    assertEquals("Original notes", events["event"]!!.getString("description")); assertFalse(calendar { it.sync.eligible(job.occurrenceId) })
    assertTrue(calendar { it.links.link(job.occurrenceId)!!.requiresReview }); assertEquals("source", calendar { it.links.link(job.occurrenceId)!!.calendarId })
  }
  @Test fun pageBudgetPersistsTheContinuationAndAWorkerCanResumeIt() {
    imported(); pages = { _, page -> JSONObject().put("items", JSONArray()).put("nextPageToken", "page-${page ?: "first"}") }
    val result = run(); assertEquals(10, result.pages); assertTrue(result.continuation)
    val cursor = calendar { it.incremental.cursor(calendar.id) }; assertTrue(cursor.paging); assertEquals("", cursor.syncToken)
    pages = { _, page -> assertEquals(cursor.pageToken, page); JSONObject().put("items", JSONArray()).put("nextSyncToken", "complete") }
    assertEquals(1, run().pages); assertEquals("complete", calendar { it.incremental.cursor(calendar.id).syncToken })
  }
  @Test fun recurringTimeTransferReplacesOldNormalSlotsAndInstanceCancellationPreservesDelivery() {
    events["event"]!!.put("recurrence", JSONArray().put("RRULE:FREQ=DAILY;COUNT=3"))
    val job = imported(mode = "Alarm"); remoteTime(now + 5_400_000); run()
    assertEquals("Confirmed", calendar { it.sync.state(job.occurrenceId).status })
    val rows = native { ContentDatabase.open(context).let { db -> try { db.records().all().filter { it.segmentId == job.occurrenceId } } finally { db.close() } } }
    val first = rows.first { it.eventStartMs == now + 5_400_000 }
    assertFalse(rows.any { !it.completed && !it.deleted && !it.skipped && it.eventStartMs == now + 3_600_000 && native { engine.occurrence(it.id)!!["deliveryState"] } == "Scheduled" })
    val before = native { engine.occurrence(first.id)!! }
    val cancelledInstance = transport.instance("synthetic", "source", "event", Instant.ofEpochMilli(first.eventStartMs).toString()).put("status", "cancelled")
    events[cancelledInstance.getString("id")] = cancelledInstance
    run(); assertEquals("Paused", calendar { it.sync.state(job.occurrenceId).status })
    val after = native { engine.occurrence(first.id)!! }
    assertEquals(before["nextAlertMs"], after["nextAlertMs"]); assertEquals(before["generation"], after["generation"])
    assertFalse(after["skipped"] as Boolean); assertFalse(after["deleted"] as Boolean)
    assertEquals(1, calendar { it.sync.issues(null)["count"] })
    assertEquals(listOf(first.nominalSlot), (calendar { it.sync.issues(null)["items"] } as List<*>).let { (it.single() as Map<*, *>)["affectedScopes"] })
    native { engine.apply(mapOf("kind" to "Delete", "operationId" to "retire-cancelled-slot", "occurrenceId" to first.id, "expectedRevision" to after["revision"])) }
    assertEquals(0, calendar { it.sync.issues(null)["count"] })
  }
  @Test fun deletedMasterSuspendsSyncAndRetainsTheCancellationNoticeWithoutStoppingLocalAlerts() {
    val job = imported(mode = "Alarm"); val before = native { engine.occurrence(job.occurrenceId)!! }
    events["event"]!!.put("status", "cancelled"); run()
    assertEquals("Deleted", calendar { it.links.link(job.occurrenceId)!!.availability })
    assertEquals("RemoteDeleted", calendar { it.sync.state(job.occurrenceId).pauseReason })
    assertEquals(before["nextAlertMs"], native { engine.occurrence(job.occurrenceId)!!["nextAlertMs"] }); assertEquals(0, patches.size)
  }
  @Test fun localFixedOffsetEditsRemainUsableWhenCalendarRequiresANamedZone() {
    val job = imported(mode = "Alarm"); edit(job.occurrenceId, mapOf("zoneId" to "+01:00"))
    assertEquals("+01:00", native { engine.occurrence(job.occurrenceId)!!["zoneId"] })
    run(); assertEquals("Paused", calendar { it.sync.state(job.occurrenceId).status }); assertEquals(0, patches.size)
  }
  @Test fun collectionCacheDiscardsUnrelatedEventsAndExpiredTokenNeverDeletesLocalAuthority() {
    val job = imported(); events["foreign"] = event("foreign").put("description", "Unrelated private description")
    run(); val before = native { engine.occurrence(job.occurrenceId)!! }
    assertEquals(listOf("event"), calendar { it.snapshots(job.occurrenceId).map { it.eventId } })
    val baseline = calendar { it.links.link(job.occurrenceId)!!.baseline }
    pages = { _, _ -> throw CalendarFailure("SYNC_TOKEN_EXPIRED") }; assertTrue(run().continuation)
    assertEquals(before, native { engine.occurrence(job.occurrenceId)!! }); assertEquals(baseline, calendar { it.links.link(job.occurrenceId)!!.baseline })
    assertTrue(calendar { it.snapshots(job.occurrenceId).isEmpty() })
  }
  @Test fun interruptedAndEmptyPaginationRetainsOriginalTokenUntilFinalDurablePage() {
    val job = imported(); run(); val original = calendar { it.incremental.cursor(calendar.id) }
    val begun = calendar { it.incremental.begin(original, it.connection().revision) }
    val first = calendar { it.incremental.page(begun, it.connection().revision, JSONObject().put("items", JSONArray()).put("nextPageToken", "page-two")) }
    assertEquals(original.syncToken, first.syncToken); assertEquals(original.syncToken, first.startingToken)
    engine.close(); open()
    assertEquals(first, calendar { it.incremental.cursor(calendar.id) })
    val final = calendar { it.incremental.page(first, it.connection().revision, JSONObject().put("items", JSONArray().put(events["event"])).put("nextSyncToken", "replacement")) }
    assertEquals("replacement", final.syncToken); assertFalse(final.paging); assertEquals("", final.startingToken)
    assertEquals("Automatic", calendar { it.sync.state(job.occurrenceId).mode })
  }
  @Test fun staleBulkPreviewCapturesNothingAndIdenticalRetryReusesChildren() {
    val first = imported(false); events["second"] = event("second"); val second = imported(false, "second")
    val runner = CalendarAutomaticRunner(access, transport, { now })
    val p1 = runner.preview("synthetic", first.occurrenceId, true); val p2 = runner.preview("synthetic", second.occurrenceId, true)
    edit(second.occurrenceId, mapOf("title" to "Edited after review"))
    val stale = mapOf("kind" to "ActivateCalendarLinks", "operationId" to "stale-bulk", "previewIds" to listOf(p1["previewId"], p2["previewId"]))
    try { native { engine.calendarCapture(stale) }; fail("Must reject the entire stale batch") } catch (error: CalendarFailure) { assertEquals("STALE_PREVIEW", error.code) }
    assertEquals("Manual", calendar { it.sync.state(first.occurrenceId).mode })
    val fresh = listOf(first, second).map { runner.preview("synthetic", it.occurrenceId, true)["previewId"] }
    val command = mapOf("kind" to "ActivateCalendarLinks", "operationId" to "fresh-bulk", "previewIds" to fresh)
    val captured = native { engine.calendarCapture(command) }; now += 700_000
    val retry = native { engine.calendarCapture(command) }
    assertEquals(captured["operations"], retry["operations"]); assertEquals(true, retry["retry"])
    assertFalse(calendar { it.sync.eligible(first.occurrenceId) }); assertFalse(calendar { it.sync.eligible(second.occurrenceId) })
  }
  @Test fun calendarActivityIsIdempotentAndNeverEntersPortableBackups() {
    val job = imported(); edit(job.occurrenceId, mapOf("notes" to "Calendar transfer notes")); run()
    val before = calendar { it.sync.activity(job.occurrenceId) }; run(); assertEquals(before, calendar { it.sync.activity(job.occurrenceId) })
    assertTrue(before.any { it["kind"] == "CalendarActivated" }); assertTrue(before.any { it["kind"] == "CalendarUpdatedGoogle" })
    val backup = native { engine.exportBackup() }
    assertFalse(backup.contains("CalendarActivated")); assertFalse(backup.contains("private@example.test")); assertFalse(backup.contains("Private calendar label"))
  }
  @Test fun reviewFingerprintSurvivesRestartDismissalAndNotificationPreferenceChanges() {
    val job = imported(); val id = job.occurrenceId
    Shadows.shadowOf(context as Application).grantPermissions(android.Manifest.permission.POST_NOTIFICATIONS)
    val manager = context.getSystemService(android.app.NotificationManager::class.java)
    calendar { it.sync.issue(id, "ChangesNeedReview", true, content = "meaningful proposal"); it.sync.notifications(CalendarReviewNotifications(context)) }
    assertEquals(1, manager.activeNotifications.size)
    manager.cancel(CalendarReviewNotifications.TAG, CalendarReviewNotifications.ID)
    engine.close(); open()
    calendar { it.sync.issue(id, "ChangesNeedReview", true, content = "meaningful proposal"); it.sync.notifications(CalendarReviewNotifications(context)) }
    assertTrue(manager.activeNotifications.isEmpty()); assertEquals(1, calendar { it.sync.actionableIssues().size })
    for (enabled in listOf(false, true)) {
      calendar { it.sync.preference(mapOf("operationId" to "notifications-$enabled", "enabled" to enabled, "expectedRevision" to it.sync.preferenceView()["revision"]))
        it.sync.notifications(CalendarReviewNotifications(context)) }
    }
    assertTrue(manager.activeNotifications.isEmpty())
    calendar { it.sync.issue(id, "ChangesNeedReview", true, content = "different proposal"); it.sync.notifications(CalendarReviewNotifications(context)) }
    assertEquals(1, manager.activeNotifications.size)
  }
}

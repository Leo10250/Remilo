package com.remilo.alarm.calendar

import android.app.Application
import android.content.Context
import android.os.UserManager
import com.remilo.alarm.engine.AlarmEngine
import com.remilo.alarm.data.*
import com.remilo.alarm.system.AlarmRegistrar
import org.json.JSONObject
import org.json.JSONArray
import org.junit.*
import org.junit.Assert.*
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import java.time.Instant
import java.util.UUID
import java.util.concurrent.*

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34], application = Application::class)
class CalendarLinkTest {
  private lateinit var context: Context
  private lateinit var engine: AlarmEngine
  private var allowed = true
  private var checkpoint: String? = null
  private val now = 1_800_000_000_000L
  private var event = JSONObject()
  private var patches = 0
  private var loseReply = false
  private var patchFailure: String? = null
  private var beforeEvent: (() -> Unit)? = null
  private var lookupResult: CalendarEventLookup? = null
  private val calendar = OwnedCalendar("source", "Private source", "UTC", hasDefaultReminders = false)
  private val access = object : CalendarLinkAccess {
    override fun <T> links(write: Boolean, block: (CalendarLinkStore) -> T): T = store(block)
    override fun local(operationId: String, connectionRevision: Long): Map<String, Any?> = native { engine.calendarLocal(operationId, connectionRevision) }
  }
  private val transport = object : CalendarTransport {
    override fun account(token: String) = CalendarAccount("subject", "owner@example.test")
    override fun calendars(token: String, cursor: String?) = CalendarPage(listOf(calendar), null)
    override fun calendar(token: String, id: String) = calendar
    override fun event(token: String, calendarId: String, eventId: String): JSONObject? {
      beforeEvent?.invoke()
      return JSONObject(event.toString())
    }
    override fun lookup(token: String, calendarId: String, eventId: String): CalendarEventLookup =
      lookupResult ?: CalendarEventLookup.Found(event(token, calendarId, eventId)!!)
    override fun insert(token: String, calendarId: String, payload: String): JSONObject = throw AssertionError("Import never inserts in Google")
    override fun patch(token: String, calendarId: String, eventId: String, etag: String, payload: String): JSONObject {
      patches++
      patchFailure?.let { throw CalendarFailure(it) }
      if (event.getString("etag") != etag) throw CalendarFailure("STALE_REMOTE")
      val patch = JSONObject(payload)
      patch.keys().forEach { event.put(it, patch.get(it)) }
      event.put("etag", "after-$patches")
      if (loseReply) { loseReply = false; throw CalendarFailure("NETWORK") }
      return JSONObject(event.toString())
    }
  }
  @Before fun setup() {
    context = RuntimeEnvironment.getApplication()
    shadowOf(context.getSystemService(UserManager::class.java)).setUserUnlocked(true)
    context.deleteDatabase("remilo-content.db")
    context.createDeviceProtectedStorageContext().deleteDatabase("remilo-operational.db")
    open()
    store { db -> ContentDatabase.open(context).let { content -> try {
      CalendarStore(content, { now }).connect(CalendarAccount("subject", "owner@example.test"), 0)
    } finally { content.close() } } }
    event = JSONObject().put("id", "personal-event").put("etag", "original").put("summary", "Personal")
      .put("description", "Private notes").put("location", "Retain location").put("colorId", "6")
      .put("start", JSONObject().put("dateTime", Instant.ofEpochMilli(now + 3_600_000).toString()).put("timeZone", "UTC"))
      .put("end", JSONObject().put("dateTime", Instant.ofEpochMilli(now + 5_400_000).toString()).put("timeZone", "UTC"))
      .put("reminders", JSONObject().put("useDefault", false).put("overrides", JSONArray().put(JSONObject().put("method", "popup").put("minutes", 10))))
  }
  private fun open() {
    engine = AlarmEngine(context, object : AlarmRegistrar {
      override fun canSchedule() = allowed
      override fun register(alert: AlertRecord) {}
      override fun cancel(alert: AlertRecord) {}
    }, { now }, calendarCheckpoint = { point -> if (checkpoint == point) { checkpoint = null; throw IllegalStateException("synthetic crash") } })
  }
  @After fun teardown() { engine.close() }
  private fun <T> native(block: () -> T): T {
    val future = CompletableFuture<T>()
    engine.request(block, { @Suppress("UNCHECKED_CAST") future.complete(it as T) }, { future.completeExceptionally(CalendarFailure(it)) })
    try { return future.get(10, TimeUnit.SECONDS) } catch (e: ExecutionException) { throw e.cause!! }
  }
  private fun <T> store(block: (CalendarLinkStore) -> T): T {
    val future = CompletableFuture<T>()
    engine.calendarRequest(true, { block(it.links) }, { future.complete(it) }, { future.completeExceptionally(CalendarFailure(it)) })
    try { return future.get(10, TimeUnit.SECONDS) } catch (e: ExecutionException) { throw e.cause!! }
  }
  private fun importCommand(mode: String = "None", suppress: Boolean = false): Map<String, Any?> {
    val preview = store { it.preview(calendar, event, null, mapOf("mode" to mode, "disableReminders" to suppress), 0) }
    return mapOf("kind" to "ImportCalendarEvent", "operationId" to UUID.randomUUID().toString(), "previewId" to preview["previewId"])
  }
  private fun capture(command: Map<String, Any?>): CalendarLinkOperation {
    store { it.capture(command) }
    return store { it.operation(command["operationId"] as String)!! }
  }
  private fun run(job: CalendarLinkOperation) { CalendarLinkRunner(access, transport).run(job.operationId, "synthetic") }
  private fun imported(): CalendarLinkOperation = capture(importCommand()).also(::run)
  private fun batchCommand(secondTitle: String = "Second", mode: String = "None"): Map<String, Any?> {
    val first = store { it.preview(calendar, event, null, emptyMap(), 0) }
    val second = JSONObject(event.toString()).put("id", "second-event").put("summary", secondTitle)
    val next = store { it.preview(calendar, second, null, emptyMap(), 0) }
    return mapOf("kind" to "ImportCalendarEvents", "operationId" to UUID.randomUUID().toString(), "items" to listOf(
      mapOf("previewId" to first["previewId"], "choices" to mapOf("mode" to mode)),
      mapOf("previewId" to next["previewId"], "choices" to mapOf("mode" to mode))))
  }
  private fun occurrence(id: String) = native { engine.occurrence(id)!! }
  private fun update(id: String, selection: Map<String, String> = mapOf("title" to "google", "notes" to "remilo", "schedule" to "google")): CalendarLinkOperation {
    val gen = (occurrence(id)["generation"] as Number).toLong()
    val preview = store { it.preview(calendar, event, id, emptyMap(), gen) }
    return capture(mapOf("kind" to "ApplyCalendarResolution", "operationId" to UUID.randomUUID().toString(),
      "previewId" to preview["previewId"], "selections" to selection))
  }
  private fun edit(id: String, fields: Map<String, Any?>) {
    val revision = occurrence(id)["revision"]
    native { engine.apply(fields + mapOf("kind" to "Edit", "operationId" to UUID.randomUUID().toString(), "occurrenceId" to id, "expectedRevision" to revision)) }
  }
  @Test fun confirmedCancellationKeepsExactAlarmSnoozeAndContentAcrossRestartAndFailedCheck() {
    val job = capture(importCommand("Alarm")); run(job); val id = job.occurrenceId
    val generation = occurrence(id)["generation"]
    native { engine.apply(mapOf("kind" to "Snooze", "operationId" to "snooze-before-check", "occurrenceId" to id,
      "expectedGeneration" to generation, "expectedSnoozeMinutes" to 10)) }
    val before = occurrence(id)
    val deleted = JSONObject().put("id", job.eventId).put("status", "cancelled")
    store { it.observe(it.guard(id), calendar, CalendarEventLookup.Found(deleted)) }
    assertEquals(before, occurrence(id)); assertEquals(0, patches)
    engine.close(); open()
    assertEquals("Deleted", store { it.link(id)!!.availability })
    store { it.observedFailure(id, "NETWORK", it.guard(id)) }
    assertEquals("Deleted", store { it.link(id)!!.availability }); assertEquals("NETWORK", store { it.link(id)!!.lastCheckErrorCode })
    assertEquals(before, occurrence(id))
  }
  @Test fun ambiguousMissingAndUnsupportedEventsNeverBecomeDeletionNotices() {
    val id = imported().occurrenceId; val before = occurrence(id)
    store { it.observe(it.guard(id), calendar, CalendarEventLookup.Missing) }
    assertEquals("Unavailable", store { it.link(id)!!.availability })
    val meeting = JSONObject(event.toString()).put("attendees", JSONArray().put(JSONObject().put("email", "guest@example.test")))
    store { it.observe(it.guard(id), calendar, CalendarEventLookup.Found(meeting)) }
    assertEquals("Unsupported", store { it.link(id)!!.availability }); assertEquals("MEETING_EVENT", store { it.link(id)!!.availabilityReason })
    assertEquals(before, occurrence(id))
  }
  @Test fun remoteRestorationRequiresFreshResolutionAndDoesNotAdvanceBaselineOnCheckOrPreview() {
    val id = imported().occurrenceId; val baseline = store { it.link(id)!!.baseline }
    store { it.observe(it.guard(id), calendar, CalendarEventLookup.Deleted) }
    event.put("summary", "Restored with a newer title")
    store { it.observe(it.guard(id), calendar, CalendarEventLookup.Found(event)) }
    assertEquals("Available", store { it.link(id)!!.availability }); assertTrue(store { it.link(id)!!.requiresReview })
    assertEquals(baseline, store { it.link(id)!!.baseline }); assertEquals("Personal", occurrence(id)["title"])
    val approved = update(id)
    assertEquals("Suspended", store { it.link(id)!!.state }); assertEquals(baseline, store { it.link(id)!!.baseline })
    run(approved)
    assertFalse(store { it.link(id)!!.requiresReview }); assertEquals("Linked", store { it.link(id)!!.state })
    assertEquals("Restored with a newer title", occurrence(id)["title"])
  }
  @Test fun terminalChecksRemainReadOnlyAndDoNotReopenOrSchedule() {
    val id = imported().occurrenceId
    for (kind in listOf("Done", "Delete", "UndoDelete")) {
      val revision = occurrence(id)["revision"]
      native { engine.apply(mapOf("kind" to kind, "operationId" to "terminal-$kind", "occurrenceId" to id, "expectedRevision" to revision)) }
      val before = occurrence(id)
      store { it.observe(it.guard(id), calendar, CalendarEventLookup.Found(event)) }
      assertEquals(before, occurrence(id)); assertEquals(true, store { it.view(it.link(id)!!)["readOnly"] })
    }
    assertTrue(store { it.link(id)!!.requiresReview }); assertEquals(0, patches)
  }
  @Test fun staleObservationsCannotCrossUnlinkTrashPurgeOrConnectionChanges() {
    for (action in listOf("Unlink", "Delete", "Purge", "Disconnect")) {
      event.put("id", "event-$action"); val id = imported().occurrenceId; val guard = store { it.guard(id) }
      when (action) {
        "Unlink" -> store { it.unlink(mapOf("operationId" to "unlink-$id", "occurrenceId" to id, "expectedLinkRevision" to guard.linkRevision)) }
        "Disconnect" -> native { val db = ContentDatabase.open(context); try { CalendarStore(db, { now }).disconnect("disconnect-$id", 1) } finally { db.close() } }
        else -> {
          native { engine.apply(mapOf("kind" to "Delete", "operationId" to "trash-$id", "occurrenceId" to id, "expectedRevision" to guard.recordRevision)) }
          if (action == "Purge") { val revision = occurrence(id)["revision"]; native { engine.apply(mapOf("kind" to "Purge", "operationId" to "purge-$id", "occurrenceId" to id, "expectedRevision" to revision)) } }
        }
      }
      try { store { it.observe(guard, calendar, CalendarEventLookup.Deleted) }; fail("Stale observation must be discarded") }
      catch (e: CalendarFailure) { assertTrue(e.code in setOf("STALE_PREVIEW", "STALE_CONNECTION", "INELIGIBLE")) }
      assertNotEquals("Deleted", store { it.link(id)!!.availability })
      if (action == "Purge") { assertEquals("", store { it.link(id)!!.accountEmail }); assertNull(store { it.link(id)!!.observedAtMs }) }
    }
  }
  @Test fun runnerRecordsDeletionBeforeMappingIncompleteTombstoneAndFencesUnsentWork() {
    val id = imported().occurrenceId; edit(id, mapOf("notes" to "Local notes")); val job = update(id)
    event = JSONObject().put("id", job.eventId).put("status", "cancelled")
    val before = occurrence(id); run(job)
    assertEquals("Deleted", store { it.link(id)!!.availability }); assertEquals(before, occurrence(id)); assertEquals(0, patches)
    assertEquals("Cancelled", store { it.operation(job.operationId)!!.state })
  }
  @Test fun runnerMissingResponseSuspendsWithoutDeletingOrApplyingLocalFields() {
    val id = imported().occurrenceId; event.put("summary", "Unseen Google title"); val job = update(id)
    val before = occurrence(id); lookupResult = CalendarEventLookup.Missing; run(job)
    assertEquals("Unavailable", store { it.link(id)!!.availability }); assertEquals(before, occurrence(id)); assertEquals(0, patches)
  }
  @Test fun deletionDuringConditionalPatchPreservesApprovedLocalPhaseAndRecordsCancellation() {
    val id = imported().occurrenceId; event.put("summary", "Google changed")
    // An approved outgoing field makes this operation include a PATCH.
    edit(id, mapOf("notes" to "Outgoing notes"))
    val fresh = update(id); patchFailure = "REMOTE_DELETED"; run(fresh)
    assertEquals("Deleted", store { it.link(id)!!.availability }); assertTrue(store { it.operation(fresh.operationId)!!.localApplied })
    assertEquals("Outgoing notes", occurrence(id)["notes"])
  }
  @Test fun sentOutcomeCanBeAcknowledgedAfterUnlinkWithoutReactivatingOrRewriting() {
    val id = imported().occurrenceId; edit(id, mapOf("notes" to "Sent notes")); val job = update(id)
    loseReply = true; run(job); assertEquals(1, patches)
    store { it.unlink(mapOf("operationId" to "unlink-sent", "occurrenceId" to id, "expectedLinkRevision" to it.link(id)!!.revision)) }
    assertEquals("ConfirmOutcome", store { it.view(it.operation(job.operationId)!!)["recoveryMode"] })
    run(job); assertEquals(1, patches); assertEquals("Confirmed", store { it.operation(job.operationId)!!.state })
    assertEquals("Detached", store { it.link(id)!!.state })
  }
  @Test fun completionThenReopenCannotReviveAnOlderUnconfirmedWrite() {
    val id = imported().occurrenceId; edit(id, mapOf("notes" to "Old approved notes")); val job = update(id)
    patchFailure = "NETWORK"; run(job); assertEquals(1, patches)
    val revision = occurrence(id)["revision"]
    native { engine.apply(mapOf("kind" to "Done", "operationId" to "done-under-write", "occurrenceId" to id, "expectedRevision" to revision)) }
    val doneRevision = occurrence(id)["revision"]
    native { engine.apply(mapOf("kind" to "Reopen", "operationId" to "reopen-under-write", "occurrenceId" to id, "expectedRevision" to doneRevision)) }
    patchFailure = null; run(job)
    assertEquals(1, patches); assertEquals("Private notes", event.getString("description")); assertTrue(store { it.link(id)!!.requiresReview })
  }
  @Test fun defaultAlarmAndKeepGoogleRemindersAreExplicitAndImportDoesNotChoosePublishingCalendar() {
    val preview = store { it.preview(calendar, event, null, emptyMap(), 0) }
    assertEquals("Alarm", (preview["choices"] as Map<*, *>)["mode"])
    assertEquals(false, (preview["choices"] as Map<*, *>)["disableReminders"])
    val job = capture(importCommand()); run(job)
    assertEquals("Confirmed", store { it.operation(job.operationId)!!.state })
    assertEquals(0, patches); assertEquals("NoAlert", occurrence(job.occurrenceId)["deliveryState"])
    assertEquals("", store { it.connection().calendarId })
  }
  @Test fun duplicateImportAndCapturedRetryKeepExactlyOneOccurrence() {
    val command = importCommand(); val job = capture(command); run(job)
    store { it.capture(command) }; run(job)
    assertEquals(1, native { engine.query(mapOf("view" to "all"), null)["total"] })
    try { importCommand(); fail("Already imported") } catch (e: CalendarFailure) { assertEquals("ALREADY_IMPORTED", e.code) }
    assertEquals(job.occurrenceId, store { it.source(job.remoteKey)!!.occurrenceId })
  }
  @Test fun suppressionLostReplyRecoversWithoutSecondPatchOrLocalCreate() {
    val job = capture(importCommand("Alarm", true)); loseReply = true; run(job)
    assertTrue(store { it.operation(job.operationId)!!.localApplied })
    assertEquals("Unconfirmed", store { it.operation(job.operationId)!!.state })
    run(job)
    assertEquals(1, patches); assertEquals("Confirmed", store { it.operation(job.operationId)!!.state })
    assertEquals("Retain location", event.getString("location")); assertEquals("6", event.getString("colorId"))
  }
  @Test fun noAlertStillAllowsSeparatelyConfirmedGoogleReminderSuppression() {
    val job = capture(importCommand("None", true)); run(job)
    val saved = store { it.operation(job.operationId)!! }
    assertEquals("Confirmed", saved.state); assertEquals("Applied", saved.localStatus)
    assertEquals("None", occurrence(job.occurrenceId)["mode"])
    assertEquals(1, patches)
    assertFalse(event.getJSONObject("reminders").getBoolean("useDefault"))
    assertEquals(0, event.getJSONObject("reminders").getJSONArray("overrides").length())
  }
  @Test fun batchCaptureSurvivesProcessDeathAndLostReplyWithoutAllocatingMoreChildren() {
    val command = batchCommand(); store { it.captureBatch(command) }
    val children = store { it.operations().map { row -> row["operationId"] } }
    assertEquals(2, children.size)
    assertEquals(0, native { engine.query(mapOf("view" to "all"), null)["total"] })
    engine.close(); open()
    store { it.captureBatch(command) }
    assertEquals(children, store { it.operations().map { row -> row["operationId"] } })
    val jobs = store { it.operations().map { row -> it.operation(row["operationId"] as String)!! } }
    for (job in jobs) { event.put("id", job.eventId).put("summary", JSONObject(job.remote).getString("title")); run(job) }
    assertEquals(2, native { engine.query(mapOf("view" to "all"), null)["total"] }); assertEquals(0, patches)
    store { it.captureBatch(command) }
    assertEquals(2, store { it.operations().size })
  }
  @Test fun batchValidationRollsBackEveryCapturedChildBeforeAnyAlarmOrRemoteWork() {
    val command = batchCommand("")
    try { store { it.captureBatch(command) }; fail("Missing title must reject the batch") }
    catch (e: CalendarFailure) { assertEquals("TITLE_REQUIRED", e.code) }
    assertTrue(store { it.operations().isEmpty() }); assertEquals(0, patches)
    assertEquals(0, native { engine.query(mapOf("view" to "all"), null)["total"] })
  }
  @Test fun duplicateSourcesInABatchCannotAllocateTwoRetainedOperations() {
    val preview = store { it.preview(calendar, event, null, emptyMap(), 0) }
    val item = mapOf("previewId" to preview["previewId"], "choices" to mapOf("mode" to "None"))
    try { store { it.captureBatch(mapOf("operationId" to "duplicate-batch", "items" to listOf(item, item))) }; fail("Duplicate source") }
    catch (e: CalendarFailure) { assertEquals("ALREADY_IMPORTED", e.code) }
    assertTrue(store { it.operations().isEmpty() })
  }
  @Test fun oneRemoteFailureInABatchDoesNotRollBackAnotherConfirmedChild() {
    val initial = JSONObject(event.toString()); val command = batchCommand()
    @Suppress("UNCHECKED_CAST") val items = command["items"] as List<Map<String, Any?>>
    val approved = command + mapOf("items" to items.map { it + mapOf("choices" to mapOf("mode" to "None", "disableReminders" to true)) })
    store { it.captureBatch(approved) }
    val jobs = store { it.operations().map { row -> it.operation(row["operationId"] as String)!! } }
    jobs.forEachIndexed { index, job ->
      event = JSONObject(initial.toString()).put("id", job.eventId).put("summary", JSONObject(job.remote).getString("title"))
      patchFailure = if (index == 0) "NETWORK" else null; run(job)
    }
    assertEquals(setOf("Unconfirmed", "Confirmed"), store { it.operations().map { row -> row["state"] }.toSet() })
    assertTrue(store { it.operations().all { row -> row["localApplied"] == true } })
    assertEquals(2, native { engine.query(mapOf("view" to "all"), null)["total"] })
    store { it.captureBatch(approved) }; assertEquals(2, store { it.operations().size })
  }
  @Test fun batchOperationIdCannotBeReusedWithDifferentConsentOrFields() {
    val command = batchCommand(); store { it.captureBatch(command) }
    @Suppress("UNCHECKED_CAST") val items = command["items"] as List<Map<String, Any?>>
    val changed = command + mapOf("items" to items.map { it + mapOf("choices" to mapOf("mode" to "None", "disableReminders" to true)) })
    try { store { it.captureBatch(changed) }; fail("Consent is immutable") }
    catch (e: CalendarFailure) { assertEquals("OPERATION_REUSED", e.code) }
    assertEquals(2, store { it.operations().size })
  }
  @Test fun batchKeepsDefaultAlarmLinkedAndRejectsElapsedAlertsUnlessNoAlertIsExplicit() {
    val command = batchCommand(mode = "Alarm"); store { it.captureBatch(command) }
    assertTrue(store { it.operations().all { row -> JSONObject(it.operation(row["operationId"] as String)!!.draft).getBoolean("alarmLinked") } })
    event.put("id", "elapsed").getJSONObject("start").put("dateTime", Instant.ofEpochMilli(now - 3600_000).toString())
    val p = store { it.preview(calendar, event, null, emptyMap(), 0) }
    val expired = mapOf("kind" to "ImportCalendarEvents", "operationId" to "elapsed-batch", "items" to listOf(mapOf("previewId" to p["previewId"], "choices" to mapOf("mode" to "Alarm"))))
    try { store { it.captureBatch(expired) }; fail("Elapsed alarm") } catch (e: CalendarFailure) { assertEquals("ELAPSED_ALERT", e.code) }
    store { it.captureBatch(expired + mapOf("items" to listOf(mapOf("previewId" to p["previewId"], "choices" to mapOf("mode" to "None"))))) }
    assertEquals(3, store { it.operations().size })
  }
  @Test fun sourceViewsExposePendingImportsOnlyForTheConnectedOriginalAccount() {
    val job = capture(importCommand())
    assertEquals(mapOf("calendarId" to "source", "eventId" to job.eventId), store { it.view(job)["source"] })
    store {
      val content = ContentDatabase.open(context)
      try { val state = CalendarStore(content, { now }); state.connect(CalendarAccount("other", "another@example.test"), state.connection().revision) }
      finally { content.close() }
    }
    assertNull(store { it.view(job)["source"] })
  }
  @Test fun blockedAlarmDoesNotDisableGoogleAndOnlyExplicitRetryResumes() {
    allowed = false
    val job = capture(importCommand("Alarm", true)); run(job)
    assertEquals("Blocked", store { it.operation(job.operationId)!!.state }); assertEquals(0, patches)
    assertTrue(event.getJSONObject("reminders").getJSONArray("overrides").length() > 0)
    allowed = true
    run(job)
    assertEquals("Confirmed", store { it.operation(job.operationId)!!.state }); assertEquals(1, patches)
  }
  @Test fun localCommitCrashRollsBackIdentityAndRetryUsesAllocatedId() {
    val job = capture(importCommand()); checkpoint = "beforeLocalCommit"; run(job)
    assertFalse(store { it.operation(job.operationId)!!.localApplied }); assertNull(store { it.record(job.occurrenceId) })
    run(job)
    assertNotNull(store { it.record(job.occurrenceId) }); assertEquals(1, native { engine.query(mapOf("view" to "all"), null)["total"] })
  }
  @Test fun crashAfterCommitBeforeProjectionDoesNotCreateAnotherReminder() {
    val job = capture(importCommand("Alarm")); checkpoint = "afterLocalCommit"; run(job)
    assertTrue(store { it.operation(job.operationId)!!.localApplied })
    engine.close(); open()
    run(job)
    assertEquals("Confirmed", store { it.operation(job.operationId)!!.state })
    assertEquals(1, native { engine.query(mapOf("view" to "all"), null)["total"] })
    assertEquals("Scheduled", occurrence(job.occurrenceId)["deliveryState"])
  }
  @Test fun mixedResolutionPreservesIndependentTimingAndRemoteProperties() {
    val original = imported(); val id = original.occurrenceId
    edit(id, mapOf("notes" to "Local notes", "dueLinked" to false, "alarmLinked" to false, "dueAtMs" to now + 12_000_000, "alarmAtMs" to now + 13_000_000))
    event.put("summary", "Google title").put("etag", "remote-edit")
    event.getJSONObject("start").put("dateTime", Instant.ofEpochMilli(now + 7_200_000).toString())
    event.getJSONObject("end").put("dateTime", Instant.ofEpochMilli(now + 9_000_000).toString())
    val job = update(id); run(job)
    val record = store { it.record(id)!! }
    assertEquals("Google title", record.title); assertEquals("Local notes", event.getString("description"))
    assertEquals(now + 12_000_000, record.dueAtMs); assertEquals(now + 13_000_000, record.definedAlarmAtMs)
    assertEquals("Retain location", event.getString("location")); assertEquals("6", event.getString("colorId"))
  }
  @Test fun postponedTargetSurvivesIncomingLinkedScheduleChange() {
    val job = capture(importCommand("Alarm")); run(job); val id = job.occurrenceId
    val before = occurrence(id); val postponed = now + 14_000_000
    native { engine.apply(mapOf("kind" to "Postpone", "operationId" to "postpone", "occurrenceId" to id, "expectedGeneration" to before["generation"], "alarmAtMs" to postponed)) }
    event.getJSONObject("start").put("dateTime", Instant.ofEpochMilli(now + 7_200_000).toString())
    event.getJSONObject("end").put("dateTime", Instant.ofEpochMilli(now + 9_000_000).toString())
    event.put("etag", "moved")
    run(update(id))
    assertEquals(postponed, occurrence(id)["nextAlertMs"])
    assertEquals(now + 7_200_000, occurrence(id)["alarmAtMs"])
  }
  @Test fun newerRemoteVersionBeforeLocalPhaseLeavesBothSidesUntouched() {
    val old = imported(); event.put("summary", "First edit").put("etag", "first")
    val update = update(old.occurrenceId)
    event.put("summary", "Second edit").put("etag", "second"); run(update)
    assertEquals("Personal", store { it.record(old.occurrenceId)!!.title })
    assertEquals("Conflict", store { it.operation(update.operationId)!!.state }); assertEquals(0, patches)
  }
  @Test fun conditionalPatchConflictRetainsConfirmedLocalPhase() {
    val old = imported(); edit(old.occurrenceId, mapOf("notes" to "Local"))
    event.put("summary", "Remote").put("etag", "changed")
    val update = update(old.occurrenceId); patchFailure = "STALE_REMOTE"; run(update)
    assertEquals("Remote", store { it.record(old.occurrenceId)!!.title })
    assertEquals("Private notes", event.getString("description"))
    assertEquals("Conflict", store { it.operation(update.operationId)!!.state })
    assertTrue(store { it.operation(update.operationId)!!.localApplied })
  }
  @Test fun staleLocalEditOrDoneRejectsInboundApplication() {
    val old = imported(); event.put("summary", "Remote").put("etag", "changed")
    val update = update(old.occurrenceId); edit(old.occurrenceId, mapOf("title" to "Newer local")); run(update)
    assertEquals("Newer local", store { it.record(old.occurrenceId)!!.title }); assertEquals(0, patches)
    val next = update(old.occurrenceId)
    val revision = occurrence(old.occurrenceId)["revision"]
    native { engine.apply(mapOf("kind" to "Done", "operationId" to "done", "occurrenceId" to old.occurrenceId, "expectedRevision" to revision)) }
    run(next)
    assertTrue(store { it.record(old.occurrenceId)!!.completed }); assertEquals(0, patches)
  }
  @Test fun unlinkRetainsIdentityAndCanBeExplicitlyRelinked() {
    val old = imported(); val link = store { it.link(old.occurrenceId)!! }
    val command = mapOf("operationId" to "unlink", "occurrenceId" to old.occurrenceId, "expectedLinkRevision" to link.revision)
    store { it.unlink(command); it.unlink(command) }
    assertEquals("Detached", store { it.link(old.occurrenceId)!!.state })
    try { importCommand(); fail("Must retain identity") } catch (e: CalendarFailure) { assertEquals("ALREADY_IMPORTED", e.code) }
    val generation = (occurrence(old.occurrenceId)["generation"] as Number).toLong()
    val p = store { it.preview(calendar, event, old.occurrenceId, emptyMap(), generation) }
    val next = capture(mapOf("kind" to "EnableCalendarLink", "operationId" to "relink", "previewId" to p["previewId"],
      "selections" to mapOf("title" to "remilo", "notes" to "remilo", "schedule" to "remilo")))
    run(next); assertEquals("Linked", store { it.link(old.occurrenceId)!!.state })
  }
  @Test fun purgeErasesSnapshotsAndLateReplyCannotRestorePrivateData() {
    val old = imported(); val id = old.occurrenceId
    val revision = occurrence(id)["revision"]
    native { engine.apply(mapOf("kind" to "Delete", "operationId" to "trash", "occurrenceId" to id, "expectedRevision" to revision)) }
    val deletedRevision = occurrence(id)["revision"]
    native { engine.apply(mapOf("kind" to "Purge", "operationId" to "purge", "occurrenceId" to id, "expectedRevision" to deletedRevision)) }
    store { it.complete(old.operationId, event) }
    val link = store { it.link(id)!! }; assertTrue(link.erased); assertEquals("", link.baseline)
    val op = store { it.operation(old.operationId)!! }
    assertEquals("", op.desired); assertEquals("", op.remote); assertEquals("", op.draft)
    assertEquals("", store { it.view(op)["title"] })
    assertTrue(store { it.source(old.remoteKey)!!.erased })
  }
  @Test fun localBackupHasReminderButNoRemoteIdentityOrCalendarSnapshots() {
    imported()
    val backup = native { engine.exportBackup() }
    assertTrue(backup.contains("Private notes"))
    listOf("owner@example.test", "personal-event", "calendar_links", "calendar_link_operations").forEach { assertFalse(backup.contains(it)) }
    val dp = context.createDeviceProtectedStorageContext().getDatabasePath("remilo-operational.db").readBytes().toString(Charsets.ISO_8859_1)
    listOf("Private notes", "owner@example.test", "personal-event").forEach { assertFalse(dp.contains(it)) }
  }
  @Test fun mapperRejectsEveryUnsupportedShapeAndPreservesFoldAndAllDayDates() {
    val changes = listOf("recurringEventId" to "parent", "recurrence" to JSONArray(), "attendees" to JSONArray().put(JSONObject()), "attendeesOmitted" to true,
      "locked" to true, "eventType" to "focusTime", "endTimeUnspecified" to true, "status" to "cancelled")
    changes.forEach { (key, value) -> assertNotNull(CalendarLinkMapper.reason(JSONObject(event.toString()).put(key, value), "UTC")) }
    assertEquals("MEETING_EVENT", CalendarLinkMapper.reason(JSONObject(event.toString()).put("attendees", "incomplete"), "UTC"))
    val allDay = JSONObject(event.toString()).put("start", JSONObject().put("date", "2026-11-01"))
      .put("end", JSONObject().put("date", "2026-11-02"))
    val fields = CalendarLinkMapper.fields(allDay, "America/Los_Angeles")
    assertEquals(25 * 3_600_000L, fields.getJSONObject("schedule").getLong("eventEndMs") - fields.getJSONObject("schedule").getLong("eventStartMs"))
    allDay.getJSONObject("end").put("date", "2026-11-03")
    assertEquals("MULTI_DAY_EVENT", CalendarLinkMapper.reason(allDay, "America/Los_Angeles"))
    for (offset in listOf("-07:00", "-08:00")) {
      val fold = JSONObject(event.toString())
      fold.getJSONObject("start").put("dateTime", "2026-11-01T01:30:00" + offset).put("timeZone", "America/Los_Angeles")
      fold.getJSONObject("end").put("dateTime", "2026-11-01T02:30:00-08:00").put("timeZone", "America/Los_Angeles")
      assertEquals(java.time.OffsetDateTime.parse("2026-11-01T01:30:00" + offset).toInstant().toEpochMilli(),
        CalendarLinkMapper.fields(fold, "UTC").getJSONObject("schedule").getLong("eventStartMs"))
    }
  }
  @Test fun fieldDefaultsCoverEveryThreeWayCaseWithoutPickingConflictWinner() {
    val base = CalendarLinkMapper.fields(event, "UTC")
    val local = JSONObject(base.toString()); val remote = JSONObject(base.toString())
    assertEquals("remilo", CalendarLinkMapper.defaults(local, remote, base)["title"])
    local.put("title", "Local"); assertEquals("remilo", CalendarLinkMapper.defaults(local, remote, base)["title"])
    local.put("title", base.getString("title")); remote.put("title", "Google")
    assertEquals("google", CalendarLinkMapper.defaults(local, remote, base)["title"])
    local.put("title", "Other"); assertNull(CalendarLinkMapper.defaults(local, remote, base)["title"])
    local.put("title", "Google"); assertEquals("remilo", CalendarLinkMapper.defaults(local, remote, base)["title"])
    assertNull(CalendarLinkMapper.defaults(JSONObject(base.toString()), remote, null)["title"])
  }
  @Test fun unresolvedImportReservesRemoteIdentityAndRejectsOperationReuse() {
    val first = importCommand(); capture(first)
    try { capture(importCommand()); fail("Unresolved import must reserve identity") }
    catch (error: CalendarFailure) { assertEquals("OPERATION_PENDING", error.code) }
    try { capture(first + mapOf("previewId" to "replacement")); fail("Input cannot be replaced") }
    catch (error: CalendarFailure) { assertEquals("OPERATION_REUSED", error.code) }
  }
  @Test fun rejectedImportCannotBeRevivedAfterAReplacementReviewCreatesTheReminder() {
    val rejected = capture(importCommand())
    event.put("summary", "Newer Google title").put("etag", "changed")
    run(rejected)
    assertEquals("Conflict", store { it.operation(rejected.operationId)!!.state })
    val fresh = capture(importCommand()); run(fresh)
    assertEquals("Confirmed", store { it.operation(fresh.operationId)!!.state })
    // Restore even the original precondition: the rejected operation still has no write permission.
    event.put("summary", "Personal").put("etag", "original")
    run(rejected)
    assertEquals("Conflict", store { it.operation(rejected.operationId)!!.state })
    assertFalse(store { it.operation(rejected.operationId)!!.localApplied })
    assertEquals(fresh.occurrenceId, store { it.source(fresh.remoteKey)!!.occurrenceId })
    assertEquals(0, patches)
  }
  @Test fun interruptedEnableCannotWriteAgainAfterUnlink() {
    val original = imported(); val id = original.occurrenceId
    store { it.unlink(mapOf("operationId" to "unlink-first", "occurrenceId" to id, "expectedLinkRevision" to it.link(id)!!.revision)) }
    edit(id, mapOf("notes" to "Approved local notes"))
    val generation = (occurrence(id)["generation"] as Number).toLong()
    val p = store { it.preview(calendar, event, id, emptyMap(), generation) }
    val job = capture(mapOf("kind" to "EnableCalendarLink", "operationId" to "enable-with-patch", "previewId" to p["previewId"],
      "selections" to mapOf("title" to "remilo", "notes" to "remilo", "schedule" to "remilo")))
    patchFailure = "NETWORK"; run(job); assertEquals(1, patches)
    store { it.unlink(mapOf("operationId" to "unlink-again", "occurrenceId" to id, "expectedLinkRevision" to it.link(id)!!.revision)) }
    store { it.observedFailure(id, "NETWORK") }
    assertEquals("Detached", store { it.link(id)!!.state })
    patchFailure = null; run(job)
    assertEquals(1, patches); assertEquals("Private notes", event.getString("description"))
    assertEquals("Detached", store { it.link(id)!!.state })
  }
  @Test fun trashThenRestoreDoesNotReviveAFencedRemotePatch() {
    val original = imported(); val id = original.occurrenceId
    edit(id, mapOf("notes" to "Approved local notes"))
    val job = update(id); patchFailure = "NETWORK"; run(job)
    val revision = occurrence(id)["revision"]
    native { engine.apply(mapOf("kind" to "Delete", "operationId" to "trash-under-write", "occurrenceId" to id, "expectedRevision" to revision)) }
    val deletedRevision = occurrence(id)["revision"]
    native { engine.apply(mapOf("kind" to "UndoDelete", "operationId" to "restore-under-write", "occurrenceId" to id, "expectedRevision" to deletedRevision)) }
    patchFailure = null; run(job)
    assertEquals(1, patches); assertEquals("Private notes", event.getString("description"))
    assertFalse(store { it.record(id)!!.deleted })
  }
  @Test fun disconnectAndReconnectDuringReadFencesOldInvocationUntilExplicitRetry() {
    val job = capture(importCommand())
    beforeEvent = {
      native { ContentDatabase.open(context).let { db -> try {
        val state = CalendarStore(db, { now })
        state.disconnect("disconnect-during-read", 1)
        state.connect(CalendarAccount("subject", "owner@example.test"), 2)
      } finally { db.close() } } }
      beforeEvent = null
    }
    run(job)
    assertNull(store { it.record(job.occurrenceId) })
    assertEquals("NeedsAccess", store { it.operation(job.operationId)!!.state })
    run(job)
    assertNotNull(store { it.record(job.occurrenceId) }); assertEquals(0, patches)
  }
  @Test fun confirmingEqualFieldsDoesNotRewriteReminderRevisionOrHistory() {
    val old = imported(); val record = store { it.record(old.occurrenceId)!! }
    run(update(old.occurrenceId))
    assertEquals(record.revision, store { it.record(old.occurrenceId)!!.revision })
    assertEquals(0, patches)
  }
  @Test fun blockedCalendarTransportCannotDelayLocalDoneOrResurrectIt() {
    val original = imported(); val update = update(original.occurrenceId)
    val entered = CountDownLatch(1); val release = CountDownLatch(1)
    beforeEvent = { entered.countDown(); check(release.await(10, TimeUnit.SECONDS)) }
    val io = Executors.newSingleThreadExecutor()
    try {
      val flight = io.submit { run(update) }
      assertTrue(entered.await(10, TimeUnit.SECONDS))
      val revision = occurrence(original.occurrenceId)["revision"]
      val done = CompletableFuture<Any?>()
      engine.request({ engine.apply(mapOf("kind" to "Done", "operationId" to "done-under-network-wait",
        "occurrenceId" to original.occurrenceId, "expectedRevision" to revision)) }, { done.complete(it) }, { done.completeExceptionally(CalendarFailure(it)) })
      assertEquals("Applied", (done.get(2, TimeUnit.SECONDS) as Map<*, *>)["status"])
      release.countDown(); flight.get(10, TimeUnit.SECONDS)
      assertTrue(store { it.record(original.occurrenceId)!!.completed })
      assertFalse(store { it.operation(update.operationId)!!.localApplied }); assertEquals(0, patches)
    } finally { release.countDown(); beforeEvent = null; io.shutdownNow() }
  }
  @Test fun disconnectFencesAnUnsentImportAndDoesNotCreateLocalContent() {
    val job = capture(importCommand())
    native { ContentDatabase.open(context).let { db -> try { CalendarStore(db, { now }).disconnect("disconnect", 1) } finally { db.close() } } }
    run(job)
    assertEquals("NeedsAccess", store { it.operation(job.operationId)!!.state })
    assertNull(store { it.record(job.occurrenceId) }); assertEquals(0, patches)
  }
  @Test fun expiredDefaultAlarmRejectsWithoutCreatingReminderOrSuppressingGoogle() {
    event.getJSONObject("start").put("dateTime", Instant.ofEpochMilli(now - 3_600_000).toString())
    event.getJSONObject("end").put("dateTime", Instant.ofEpochMilli(now - 1_800_000).toString())
    val job = capture(importCommand("Alarm", true)); run(job)
    assertNull(store { it.record(job.occurrenceId) }); assertEquals(0, patches)
    assertFalse(store { it.operation(job.operationId)!!.localApplied })
  }
  @Test fun singleDayImportUsesCalendarMidnightsEndOfDayDueAndNineAmAlert() {
    event.put("start", JSONObject().put("date", "2027-01-16")).put("end", JSONObject().put("date", "2027-01-17"))
    val job = capture(importCommand("Alarm")); run(job)
    val record = store { it.record(job.occurrenceId)!! }
    assertEquals(Instant.parse("2027-01-16T00:00:00Z").toEpochMilli(), record.eventStartMs)
    assertEquals(Instant.parse("2027-01-17T00:00:00Z").toEpochMilli(), record.dueAtMs)
    assertEquals(Instant.parse("2027-01-16T09:00:00Z").toEpochMilli(), record.definedAlarmAtMs)
    assertTrue(record.allDay)
  }
  @Test fun unsupportedOrMissingRemoteEventDoesNotRemoveLocalReminder() {
    val job = imported()
    event.put("status", "cancelled"); run(updateForCancelled(job))
    assertNotNull(store { it.record(job.occurrenceId) })
    assertEquals(0, patches)
  }
  private fun updateForCancelled(original: CalendarLinkOperation): CalendarLinkOperation {
    event.remove("status")
    val job = update(original.occurrenceId)
    event.put("status", "cancelled")
    return job
  }
}

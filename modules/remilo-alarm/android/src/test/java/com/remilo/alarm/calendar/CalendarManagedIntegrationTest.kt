package com.remilo.alarm.calendar

import android.Manifest
import android.app.Application
import android.app.Notification
import android.app.NotificationManager
import android.content.Context
import android.os.UserManager
import com.remilo.alarm.data.*
import com.remilo.alarm.engine.AlarmEngine
import com.remilo.alarm.system.AlarmRegistrar
import org.json.JSONArray
import org.json.JSONObject
import org.junit.*
import org.junit.Assert.*
import org.junit.runner.RunWith
import org.robolectric.*
import org.robolectric.annotation.Config
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import com.remilo.alarm.core.RecurrenceRule
import java.util.UUID
import java.util.concurrent.CompletableFuture
import java.util.concurrent.ExecutionException
import java.util.concurrent.TimeUnit

/** Exercises CE capture, the serialized engine, transport phases and the actual local projection together. */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34], application = Application::class)
class CalendarManagedIntegrationTest {
  private lateinit var context: Context
  private lateinit var engine: AlarmEngine
  private var now = 1_800_000_000_000L
  private var opportunities = 0
  private var registrations = 0
  private var canSchedule = true
  private var managedUnavailable = false
  private var loseInsertReply = false
  private var loseInsertAt: Int? = null
  private val source = OwnedCalendar("managed", "Remilo", "UTC", dataOwner = "owner@example.test")
  private val legacy = OwnedCalendar("legacy", "Other calendar", "UTC", dataOwner = "owner@example.test")
  private val remote = mutableMapOf<Pair<String, String>, JSONObject>()
  private val insertIds = mutableListOf<String>()
  private val patchIds = mutableListOf<String>()
  private val queriedCalendars = mutableListOf<String>()
  private val lookupIds = mutableListOf<String>()
  private val access = object : CalendarAutomaticAccess {
    override fun <T> access(write: Boolean, block: (CalendarStore) -> T): T = calendar(block)
    override fun <T> links(write: Boolean, block: (CalendarLinkStore) -> T): T = calendar { block(it.links) }
    override fun local(operationId: String, connectionRevision: Long): Map<String, Any?> = native { engine.calendarLocal(operationId, connectionRevision) }
    override fun context(id: String): Map<*, *> = native { engine.calendarContext(id)!! }
    override fun preflight(previewId: String, selections: Map<String, String?>): String? = native { engine.calendarPreflight(previewId, selections) }
  }
  private val transport = object : CalendarTransport {
    override fun account(token: String) = CalendarAccount("subject", "owner@example.test")
    override fun calendars(token: String, cursor: String?) = CalendarPage(listOf(source, legacy), null)
    override fun calendar(token: String, id: String): OwnedCalendar {
      if (id == source.id && managedUnavailable) throw CalendarFailure("NOT_FOUND")
      return if (id == source.id) source else legacy
    }
    override fun event(token: String, calendarId: String, eventId: String): JSONObject? {
      lookupIds.add(eventId)
      return remote[calendarId to eventId]?.let { JSONObject(it.toString()) }
    }
    override fun inspectRecurring(token: String, calendar: OwnedCalendar, event: JSONObject): JSONObject = CalendarRecurringReview(this, { now }).inspect(token, calendar, event)
    override fun instance(token: String, calendarId: String, masterId: String, originalStart: String): JSONObject? {
      remote.filterKeys { it.first == calendarId }.values.firstOrNull { it.optString("recurringEventId") == masterId &&
        it.optJSONObject("originalStartTime")?.let { original -> original.optString("dateTime", original.optString("date")) } == originalStart }
        ?.let { return JSONObject(it.toString()) }
      val master = remote[calendarId to masterId] ?: return null
      val result = JSONObject(master.toString()).also { it.remove("recurrence"); it.remove("extendedProperties") }
      val allDay = master.getJSONObject("start").has("date")
      val original = JSONObject().put(if (allDay) "date" else "dateTime", originalStart)
      if (allDay) {
        result.put("start", JSONObject().put("date", originalStart))
          .put("end", JSONObject().put("date", LocalDate.parse(originalStart).plusDays(1).toString()))
      } else {
        val length = Instant.parse(master.getJSONObject("end").getString("dateTime")).toEpochMilli() -
          Instant.parse(master.getJSONObject("start").getString("dateTime")).toEpochMilli()
        result.put("start", JSONObject().put("dateTime", originalStart).put("timeZone", "UTC"))
          .put("end", JSONObject().put("dateTime", Instant.parse(originalStart).plusMillis(length).toString()).put("timeZone", "UTC"))
      }
      return result.put("id", "instance-" + CalendarMapper.hash("$masterId:$originalStart").take(16))
        .put("recurringEventId", masterId).put("originalStartTime", original).also { remote[calendarId to it.getString("id")] = JSONObject(it.toString()) }
    }
    override fun insert(token: String, calendarId: String, payload: String): JSONObject {
      val event = JSONObject(payload).put("etag", "inserted-${insertIds.size}").put("htmlLink", "https://calendar.google.com/event?eid=synthetic")
      insertIds.add(event.getString("id")); remote[calendarId to event.getString("id")] = event
      if (loseInsertReply || loseInsertAt == insertIds.size) { loseInsertReply = false; loseInsertAt = null; throw CalendarFailure("NETWORK") }
      return JSONObject(event.toString())
    }
    override fun patch(token: String, calendarId: String, eventId: String, etag: String, payload: String): JSONObject {
      val event = remote[calendarId to eventId] ?: throw CalendarFailure("REMOTE_UNAVAILABLE")
      if (event.getString("etag") != etag) throw CalendarFailure("STALE_REMOTE")
      patchIds.add(eventId); JSONObject(payload).keys().forEach { event.put(it, JSONObject(payload).get(it)) }
      event.put("etag", "patched-${patchIds.size}"); return JSONObject(event.toString())
    }
    override fun syncEvents(token: String, calendarId: String, syncToken: String?, pageToken: String?): JSONObject {
      queriedCalendars.add(calendarId)
      return JSONObject().put("items", JSONArray(remote.filterKeys { it.first == calendarId }.values.toList()))
        .put("nextSyncToken", "token-${queriedCalendars.size}")
    }
  }

  @Before fun setup() {
    context = RuntimeEnvironment.getApplication()
    Shadows.shadowOf(context.getSystemService(UserManager::class.java)).setUserUnlocked(true)
    context.deleteDatabase("remilo-content.db")
    context.createDeviceProtectedStorageContext().deleteDatabase("remilo-operational.db")
    open()
    calendar { it.connect(CalendarAccount("subject", "owner@example.test"), 0) }
  }
  private fun open() {
    engine = AlarmEngine(context, object : AlarmRegistrar {
      override fun canSchedule() = canSchedule
      override fun register(alert: AlertRecord) { registrations++ }
      override fun cancel(alert: AlertRecord) {}
    }, { now }, { 0L }, calendarOpportunity = { opportunities++ })
  }
  @After fun close() { engine.close() }
  private fun operation() = UUID.randomUUID().toString()
  private fun <T> native(block: () -> T): T {
    val future = CompletableFuture<T>()
    engine.request({ try { block() } catch (error: Exception) { future.completeExceptionally(error); null } },
      { if (!future.isDone) { @Suppress("UNCHECKED_CAST") future.complete(it as T) } }, { future.completeExceptionally(CalendarFailure(it)) })
    try { return future.get(15, TimeUnit.SECONDS) } catch (error: ExecutionException) { throw error.cause!! }
  }
  private fun <T> calendar(block: (CalendarStore) -> T): T {
    val future = CompletableFuture<T>()
    engine.calendarRequest(block = { store -> try { block(store) } catch (error: Exception) { future.completeExceptionally(error); throw error } },
      resolve = { future.complete(it) }, reject = { future.completeExceptionally(CalendarFailure(it)) })
    try { return future.get(15, TimeUnit.SECONDS) } catch (error: ExecutionException) { throw error.cause!! }
  }
  private fun records(): List<ReminderRecord> = native { ContentDatabase.open(context).let { db -> try { db.records().all() } finally { db.close() } } }
  private fun activate(origin: String = "ExistingInstallation") = calendar { store ->
    // The engine's real onCreate marks a fresh database. Simulate the migration's durable origin explicitly.
    ContentDatabase.open(context).let { db -> try {
      db.openHelper.writableDatabase.execSQL("UPDATE calendar_installation_origin SET origin = ? WHERE id = 'installation'", arrayOf(origin))
    } finally { db.close() } }
    val preview = store.managed.previewSetup(emptyMap(), JSONArray().put(source.managedJson()), true, source.id)
    val id = operation()
    store.managed.captureSetup(mapOf("kind" to "ConfirmManagedCalendarSetup", "operationId" to id,
      "previewId" to preview["previewId"], "selectedCalendarId" to source.id))
    store.managed.acknowledgeCalendar(id, source); store.managed.completeSetup(id)
  }
  private fun createCommand(id: String = operation(), disposition: String? = null): Map<String, Any?> = mapOf(
    "kind" to "Create", "operationId" to id, "title" to "PRIVATE LOCAL TITLE", "notes" to "PRIVATE LOCAL NOTES",
    "mode" to "Alarm", "eventStartMs" to now + 3_600_000, "eventEndMs" to now + 5_400_000,
    "zoneId" to "UTC") + if (disposition == null) emptyMap() else mapOf("calendarDisposition" to disposition)
  private fun create(command: Map<String, Any?> = createCommand()): String {
    val result = native { engine.apply(command) }
    assertNotEquals("Rejected", result["status"])
    return (result["occurrence"] as Map<*, *>)["id"] as String
  }
  private fun event(id: String, start: Long = now + 3_600_000, end: Long = start + 1_800_000): JSONObject = JSONObject()
    .put("id", id).put("etag", "original-$id").put("summary", "PRIVATE GOOGLE TITLE").put("description", "PRIVATE GOOGLE NOTES")
    .put("start", JSONObject().put("dateTime", Instant.ofEpochMilli(start).toString()).put("timeZone", "UTC"))
    .put("end", JSONObject().put("dateTime", Instant.ofEpochMilli(end).toString()).put("timeZone", "UTC"))
    .put("reminders", JSONObject().put("useDefault", true))
  private fun observe(event: JSONObject): CalendarManagedCandidate {
    remote[source.id to event.getString("id")] = JSONObject(event.toString())
    return calendar { store ->
      val cursor = store.incremental.begin(store.incremental.cursor(source.id), store.connection().revision)
      store.incremental.page(cursor, store.connection().revision, JSONObject().put("items", JSONArray().put(event)).put("nextSyncToken", operation()),
        source.zoneId, source, true)
      store.managed.candidate(CalendarManagedStore.candidateId(CalendarLinkMapper.key("subject", source.id, event.getString("id"))))!!
    }
  }
  private fun transfer() = CalendarManagedTransfers(access, transport, {}, { now })
  private fun coordinator() = CalendarManagedCoordinator(access, transport, object : CalendarAuthorization {
    override fun token(email: String) = "synthetic"
    override fun clear(token: String) {}
    override fun revoke(email: String) {}
  }, { now })
  private fun edit(id: String, values: Map<String, Any?>) {
    val before = native { engine.occurrence(id)!! }
    val result = native { engine.apply(values + mapOf("kind" to "Edit", "operationId" to operation(), "occurrenceId" to id, "expectedRevision" to before["revision"])) }
    assertNotEquals("Rejected", result["status"])
  }
  private fun failure(code: String, block: () -> Unit) {
    try { block(); fail("Expected $code") } catch (error: CalendarFailure) { assertEquals(code, error.code) }
  }

  @Test fun localCreationCapturesOneDurableIntentAndAlarmIndependentlyOfNetwork() {
    activate(); val command = createCommand("same-create"); val id = create(command)
    assertEquals(id, create(command)); assertEquals(1, calendar { it.managed.pendingIntents().size })
    assertEquals("Scheduled", native { engine.occurrence(id)!!["deliveryState"] })
    assertTrue(insertIds.isEmpty()); assertTrue(opportunities > 0)
    engine.close(); open()
    assertEquals(id, create(command)); assertEquals(id, calendar { it.managed.pendingIntents().single().localId })
    assertEquals(1, records().size)
  }

  @Test fun invalidChoiceRollsBackCreationAndLocalOnlyNeverQueuesExport() {
    activate()
    val rejected = native { engine.apply(createCommand(disposition = "Untrusted choice")) }
    assertEquals("Rejected", rejected["status"]); assertTrue(records().isEmpty())
    val id = create(createCommand(disposition = "LocalOnly"))
    assertEquals("LocalOnly", calendar { it.managed.disposition(id)["state"] })
    assertTrue(calendar { it.managed.pendingIntents().isEmpty() }); assertEquals("Scheduled", native { engine.occurrence(id)!!["deliveryState"] })
  }

  @Test fun explicitManagedChoiceOverridesTheNewReminderDefaultWithoutBackfillingOthers() {
    activate()
    calendar { store ->
      val preview = store.managed.previewPolicyChange(mapOf("exportNewReminders" to false))
      store.managed.applyPolicy(mapOf("kind" to "ApplyManagedCalendarPolicy", "operationId" to operation(), "previewId" to preview["previewId"]))
    }
    val default = create()
    assertNull(calendar { it.managed.intent(default) })
    val explicit = create(createCommand(disposition = "Managed"))
    assertEquals(listOf(explicit), calendar { it.managed.pendingIntents().map { it.localId } })
    assertEquals("Managed", calendar { it.managed.disposition(explicit)["disposition"] })
  }

  @Test fun recurringCreationQueuesFamilyOnceAndMaterializationDoesNotQueueInstances() {
    activate()
    val command = createCommand("create-family") + mapOf("kind" to "CreateSeries",
      "recurrence" to mapOf("frequency" to "daily", "count" to 4, "zoneMode" to "pinned"))
    assertNotEquals("Rejected", native { engine.apply(command) }["status"])
    val family = calendar { it.managed.pendingIntents().single().localId }
    assertNotEquals("Rejected", native { engine.apply(command) }["status"])
    native { engine.query("all", null) }
    assertTrue(records().isNotEmpty()); assertTrue(records().all { it.segmentId == family })
    assertEquals(listOf(family), calendar { it.managed.pendingIntents().map { it.localId } })
  }

  @Test fun testAlarmAndBackupRestoreCannotBecomeNewManagedExports() {
    activate()
    native { engine.testAlarm("test-alarm") }
    val restored = ReminderRecord("restored-identity", "BACKUP TITLE", now + 7_200_000, now + 9_000_000, now + 7_200_000, now, zoneId = "UTC")
    val backup = BackupCodec.encode(listOf(restored), emptyMap(), emptyList(), now)
    assertEquals("Applied", native { engine.importBackup(backup, emptyList(), "restore") }["status"])
    assertTrue(calendar { it.managed.pendingIntents().isEmpty() })
    assertEquals(2, records().size)
    val testId = records().first { it.id != restored.id }.id
    assertEquals("LocalOnly", calendar { it.managed.disposition(testId)["state"] })
  }

  @Test fun anEmptyManagedCalendarStillHasAColdNativePollingOpportunity() {
    activate(); assertTrue(calendar { it.links.links().isEmpty() })
    engine.close(); open()
    val result = CalendarAutomaticRunner(access, transport, { now }, { 0L }).run("synthetic", true)
    assertEquals(1, result.pages); assertEquals(listOf(source.id), queriedCalendars)
    assertTrue(calendar { it.managed.binding().initialRecoveryComplete })
    assertEquals("Ready", calendar { it.managed.binding().phase })
  }

  @Test fun incomingFutureEventCreatesAlarmAndCommonBaselineWithoutAnOutboundEcho() {
    activate(); val candidate = observe(event("incoming"))
    assertEquals("Imported", transfer().importCandidate("synthetic", candidate, true))
    assertEquals("Alarm", native { engine.occurrence(candidate.localId)!!["mode"] })
    assertEquals("Scheduled", native { engine.occurrence(candidate.localId)!!["deliveryState"] })
    assertEquals("Automatic", calendar { it.sync.state(candidate.localId).mode })
    assertTrue(calendar { it.managed.pendingIntents().isEmpty() }); assertTrue(insertIds.isEmpty()); assertTrue(patchIds.isEmpty())
    assertTrue(remote[source.id to "incoming"]!!.getJSONObject("reminders").getBoolean("useDefault"))
    assertEquals(1, records().size)
    CalendarAutomaticRunner(access, transport, { now }, { 0L }).run("synthetic", true)
    assertEquals(1, records().size); assertTrue(insertIds.isEmpty())
  }

  @Test fun permissionBlockedIncomingAlarmRetainsAlarmModeAndGoogleReminderSettings() {
    activate()
    CalendarAutomaticRunner(access, transport, { now }, { 0L }).run("synthetic", true)
    calendar { store ->
      val preview = store.managed.previewPolicyChange(mapOf("disableGoogleReminders" to true))
      store.managed.applyPolicy(mapOf("kind" to "ApplyManagedCalendarPolicy", "operationId" to operation(), "previewId" to preview["previewId"]))
    }
    canSchedule = false; val candidate = observe(event("blocked"))
    assertEquals("Imported", transfer().importCandidate("synthetic", candidate, true))
    val local = native { engine.occurrence(candidate.localId)!! }
    assertEquals("Alarm", local["mode"]); assertEquals("Blocked", local["deliveryState"])
    assertTrue(patchIds.isEmpty()); assertTrue(remote[source.id to "blocked"]!!.getJSONObject("reminders").getBoolean("useDefault"))
  }

  @Test fun configuredAllDayAlertUsesTheCalendarZoneAndKeepsAuthoredTimingSeparate() {
    activate()
    CalendarAutomaticRunner(access, transport, { now }, { 0L }).run("synthetic", true)
    calendar { store ->
      val preview = store.managed.previewPolicyChange(mapOf("allDayAlarmMinutes" to 615))
      store.managed.applyPolicy(mapOf("kind" to "ApplyManagedCalendarPolicy", "operationId" to operation(), "previewId" to preview["previewId"]))
    }
    val date = Instant.ofEpochMilli(now).atZone(ZoneId.of(source.zoneId)).toLocalDate().plusDays(1)
    val candidate = observe(event("all-day").put("start", JSONObject().put("date", date.toString()))
      .put("end", JSONObject().put("date", date.plusDays(1).toString())))
    assertEquals("Imported", transfer().importCandidate("synthetic", candidate, true))
    val local = native { engine.occurrence(candidate.localId)!! }
    assertEquals(true, local["allDay"]); assertEquals(source.zoneId, local["zoneId"])
    assertEquals(date.atTime(10, 15).atZone(ZoneId.of(source.zoneId)).toInstant().toEpochMilli(), local["alarmAtMs"])
    assertEquals(date.plusDays(1).atStartOfDay(ZoneId.of(source.zoneId)).toInstant().toEpochMilli(), local["dueAtMs"])
    assertTrue(patchIds.isEmpty())
  }

  @Test fun ongoingElapsedAlertBecomesAReviewCandidateWithoutCreatingOrRinging() {
    activate(); val candidate = observe(event("ongoing", now - 60_000, now + 60_000))
    assertEquals("Review", transfer().importCandidate("synthetic", candidate, true))
    assertTrue(records().isEmpty()); assertEquals(0, registrations)
    assertEquals("ELAPSED_ALERT", calendar { it.managed.candidate(candidate.candidateId)!!.reason })
    assertEquals(1, calendar { it.managed.issues().size }); assertTrue(patchIds.isEmpty())
  }

  @Test fun freshInitialRecoveryIsQuietAndSubsequentIdentityUsesAlarm() {
    activate("FreshInstallation")
    val first = observe(event("recovered", now - 60_000, now + 60_000))
    assertEquals("None", first.mode); assertEquals("Imported", transfer().importCandidate("synthetic", first, true))
    assertEquals("None", native { engine.occurrence(first.localId)!!["mode"] }); assertEquals(0, registrations)
    engine.close(); open()
    val next = observe(event("new-after-recovery")); assertEquals("Alarm", next.mode)
    assertEquals("Imported", transfer().importCandidate("synthetic", next, true))
    assertEquals("Alarm", native { engine.occurrence(next.localId)!!["mode"] }); assertEquals(1, registrations)
    assertTrue(patchIds.isEmpty())
  }

  @Test fun freshNoAlertRecoveryNeverSuppressesGoogleEvenWhenTheNormalImportPolicyOptsIn() {
    activate("FreshInstallation")
    calendar { store ->
      val preview = store.managed.previewPolicyChange(mapOf("disableGoogleReminders" to true))
      store.managed.applyPolicy(mapOf("kind" to "ApplyManagedCalendarPolicy", "operationId" to operation(), "previewId" to preview["previewId"]))
    }
    val candidate = observe(event("quiet-recovery"))
    assertEquals("Imported", transfer().importCandidate("synthetic", candidate, true))
    assertEquals("None", native { engine.occurrence(candidate.localId)!!["mode"] })
    assertEquals(0, registrations); assertTrue(patchIds.isEmpty())
    assertTrue(remote[source.id to "quiet-recovery"]!!.getJSONObject("reminders").getBoolean("useDefault"))
  }

  @Test fun movedFutureExceptionImportsEvenWhenItsFiniteMasterHasNoOrdinaryFutureSlot() {
    activate()
    val original = now - 2 * 86_400_000L
    val master = event("finite-master", original).put("recurrence", JSONArray().put("RRULE:FREQ=DAILY;COUNT=1"))
    val moved = event("moved-instance").put("recurringEventId", "finite-master")
      .put("originalStartTime", JSONObject().put("dateTime", Instant.ofEpochMilli(original).toString()))
    remote[source.id to "finite-master"] = master; remote[source.id to "moved-instance"] = moved
    val candidate = calendar { store ->
      val cursor = store.incremental.begin(store.incremental.cursor(source.id), store.connection().revision)
      store.incremental.page(cursor, store.connection().revision, JSONObject().put("items", JSONArray().put(moved).put(master)).put("nextSyncToken", "finite-complete"),
        source.zoneId, source, true)
      store.managed.candidates().single()
    }
    assertEquals("Imported", transfer().importCandidate("synthetic", candidate, true))
    val local = records().single { it.exception && it.eventStartMs == now + 3_600_000 }
    assertEquals(candidate.localId, local.segmentId); assertEquals("Alarm", local.mode)
    assertEquals(Instant.ofEpochMilli(original).atZone(ZoneId.of(source.zoneId)).toLocalDateTime().toString(), local.nominalSlot)
    assertEquals("Scheduled", native { engine.occurrence(local.id)!!["deliveryState"] })
    assertTrue(insertIds.isEmpty()); assertTrue(patchIds.isEmpty())
    assertEquals("Automatic", calendar { it.sync.state(candidate.localId).mode })
  }

  @Test fun quietRecoveryRetainsAnOngoingOrdinaryRecurringOccurrenceWithoutMakingItAnException() {
    activate("FreshInstallation")
    val master = event("ongoing-quiet-family", now - 60_000, now + 60_000)
      .put("recurrence", JSONArray().put("RRULE:FREQ=DAILY;COUNT=1"))
    val candidate = observe(master)
    assertEquals("Imported", transfer().importCandidate("synthetic", candidate, true))
    val current = records().single()
    assertEquals(candidate.localId, current.segmentId); assertFalse(current.exception)
    assertEquals(now - 60_000, current.eventStartMs); assertEquals("None", current.mode)
    assertEquals("NoAlert", native { engine.occurrence(current.id)!!["deliveryState"] })
    assertEquals(0, registrations)
    engine.close(); open(); native { engine.query("all", null) }
    val retained = records().single()
    assertEquals(current.id, retained.id); assertFalse(retained.exception); assertFalse(retained.skipped)
    assertEquals(0, registrations)
  }

  @Test fun calendarRecoveryBeforeBackupRestoreKeepsCurrentCopyUnlessASeparateLocalCopyIsSelected() {
    activate("FreshInstallation")
    val originalId = "portable-original"
    val publishedId = CalendarMapper.eventId("subject", source.id, originalId)
    val candidate = observe(event(publishedId).put("extendedProperties", JSONObject().put("private", JSONObject().put("remiloPublication", publishedId))))
    assertEquals("Imported", transfer().importCandidate("synthetic", candidate, true))
    val original = ReminderRecord(originalId, "Original from backup", now + 3_600_000, now + 5_400_000, now + 3_600_000,
      now - 1, notes = "OLD BACKUP NOTES", zoneId = "UTC")
    val backup = BackupCodec.encode(listOf(original), mapOf(originalId to original.definedAlarmAtMs), emptyList(), now)
    val preview = native { engine.previewImport(backup) }
    val item = (preview["items"] as List<*>).single() as Map<*, *>
    assertEquals(true, item["conflict"]); assertEquals(true, item["calendarCollision"])
    assertEquals(listOf(candidate.localId), item["currentOccurrenceIds"])
    assertEquals(0, native { engine.importBackup(backup, emptyList(), operation()) }["added"])
    assertEquals(listOf(candidate.localId), records().map { it.id })
    val copyOperation = operation()
    assertEquals(1, native { engine.importBackup(backup, listOf(originalId), copyOperation) }["added"])
    val copy = records().single { it.id != candidate.localId }
    assertNotEquals(originalId, copy.id); assertEquals("OLD BACKUP NOTES", copy.notes)
    assertEquals("LocalOnly", calendar { it.managed.disposition(copy.id)["state"] })
    assertNull(calendar { it.links.link(copy.id) }); assertTrue(calendar { it.managed.pendingIntents().isEmpty() })
    assertEquals(true, native { engine.importBackup(backup, listOf(originalId), copyOperation) }["retry"])
    assertEquals(2, records().size)
    assertEquals("None", native { engine.occurrence(candidate.localId)!!["mode"] })
  }

  @Test fun derivedEventIdentityWithoutRetainedPublicationProofDoesNotInventABackupCollision() {
    activate("FreshInstallation")
    val originalId = "portable-without-proof"
    val candidate = observe(event(CalendarMapper.eventId("subject", source.id, originalId)))
    assertEquals("Imported", transfer().importCandidate("synthetic", candidate, true))
    val original = ReminderRecord(originalId, "PRIVATE GOOGLE TITLE", now + 3_600_000, now + 5_400_000, now + 3_600_000,
      now, notes = "PRIVATE GOOGLE NOTES", zoneId = "UTC")
    val backup = BackupCodec.encode(listOf(original), emptyMap(), emptyList(), now)
    val item = (native { engine.previewImport(backup) }["items"] as List<*>).single() as Map<*, *>
    assertEquals(false, item["conflict"]); assertEquals(false, item["calendarCollision"])
    assertTrue(calendar { it.backupCollisions(listOf(originalId)).isEmpty() })
  }

  @Test fun restoredFamilyDetectsAnExactPublishedSegmentAndExplicitCopiesStayLocalOnly() {
    activate("FreshInstallation")
    val oldFamily = "portable-family"; val oldSegment = "portable-segment"
    val published = CalendarMapper.eventId("subject", source.id, oldSegment)
    val start = now + 3_600_000
    val candidate = observe(event(published).put("recurrence", JSONArray().put("RRULE:FREQ=DAILY;COUNT=2"))
      .put("extendedProperties", JSONObject().put("private", JSONObject().put("remiloPublication", published))))
    assertEquals("Imported", transfer().importCandidate("synthetic", candidate, true))
    val template = ReminderRecord("portable-template", "Backup family", start, start + 1_800_000, start, now, zoneId = "UTC")
    val anchor = Instant.ofEpochMilli(start).atZone(ZoneId.of("UTC")).toLocalDateTime()
    val rule = RecurrenceRule(anchor, "daily", count = 2, zoneId = "UTC")
    val segment = SeriesRecord(oldSegment, oldFamily, JSONObject(BackupCodec.record(template)).toString(), RuleCodec.encode(rule), createdAtMs = now)
    val occurrenceId = UUID.nameUUIDFromBytes("remilo:$oldSegment:$anchor".toByteArray()).toString()
    val original = template.copy(id = occurrenceId, segmentId = oldSegment, nominalSlot = anchor.toString())
    val backup = BackupCodec.encode(listOf(original), mapOf(occurrenceId to start), emptyList(), now, listOf(segment))
    val item = (native { engine.previewImport(backup) }["items"] as List<*>).single() as Map<*, *>
    assertEquals(true, item["conflict"]); assertEquals(true, item["calendarCollision"])
    assertEquals(listOf(candidate.localId), item["currentOccurrenceIds"])
    assertEquals(0, native { engine.importBackup(backup, emptyList(), operation()) }["added"])
    val copyOperation = operation()
    assertEquals(1, native { engine.importBackup(backup, listOf(oldFamily), copyOperation) }["added"])
    val copySegment = UUID.nameUUIDFromBytes("$copyOperation:segment:$oldSegment".toByteArray()).toString()
    assertNotNull(native { engine.getSeries(copySegment) })
    assertEquals("LocalOnly", calendar { it.managed.disposition(copySegment)["state"] })
    assertTrue(calendar { it.managed.pendingIntents().isEmpty() }); assertNull(calendar { it.links.link(copySegment) })
    assertEquals(2, native { engine.queryRepeatFamilies().size })
  }

  @Test fun reviewedResumeIncludesHeldCandidatesAndOnlyImportsTheSelectionWhenAutomaticImportIsOff() {
    activate(); val selected = observe(event("resume-selected")); val unselected = observe(event("resume-held"))
    calendar { it.managed.pause(mapOf("kind" to "PauseManagedCalendar", "operationId" to operation(), "expectedRevision" to it.managed.binding().revision)) }
    calendar { store ->
      val policy = store.managed.previewPolicyChange(mapOf("automaticImport" to false))
      store.managed.applyPolicy(mapOf("kind" to "ApplyManagedCalendarPolicy", "operationId" to operation(), "previewId" to policy["previewId"]))
    }
    val preview = coordinator().resumePreview()
    val items = preview["items"] as List<*>
    assertEquals(2, items.size); assertTrue(items.all { (it as Map<*, *>)["ready"] == true })
    val result = calendar { it.captureManagedCommand(mapOf("kind" to "ResumeManagedCalendar", "operationId" to operation(),
      "previewId" to preview["previewId"], "selectedItemIds" to listOf("candidate:${selected.candidateId}"))) }
    assertEquals(1, (result["operations"] as List<*>).size)
    val captured = calendar { it.managed.candidate(selected.candidateId)!! }
    assertEquals("Captured", captured.state)
    assertEquals("Imported", transfer().importCandidate("synthetic", captured, false))
    assertEquals("Held", calendar { it.managed.candidate(unselected.candidateId)!!.state })
    assertEquals(listOf(selected.localId), records().map { it.id })
    assertFalse(calendar { it.managed.policy().automaticImport })
  }

  @Test fun compositeSetupReceiptSurvivesPreviewExpiryAndRejectsChangedSelection() {
    val preview = coordinator().setupPreview(emptyMap())
    val command = mapOf("kind" to "ConfirmManagedCalendarSetup", "operationId" to operation(),
      "previewId" to preview["previewId"], "selectedCalendarId" to source.id, "selectedItemIds" to emptyList<String>())
    val first = calendar { it.captureManagedCommand(command) }
    val epoch = calendar { it.managed.binding().authEpoch }
    now += 700_000
    val retry = calendar { it.captureManagedCommand(command) }
    assertEquals(first["operationId"], retry["operationId"]); assertEquals(epoch, calendar { it.managed.binding().authEpoch })
    failure("OPERATION_REUSED") { calendar { it.captureManagedCommand(command + mapOf("selectedItemIds" to listOf("existing:changed"))) } }
  }

  @Test fun compositeCandidateReceiptRejectsChangedResolutionAndRetriesWithoutItsExpiredPreview() {
    activate(); val candidate = observe(event("reviewed-candidate"))
    val preview = coordinator().candidatePreview(candidate.candidateId, emptyMap())
    val command = mapOf("kind" to "ImportManagedCalendarCandidate", "operationId" to operation(),
      "previewId" to preview["previewId"], "selections" to emptyMap<String, String>())
    val captured = calendar { it.captureManagedCommand(command) }
    now += 700_000
    assertEquals(captured["operationId"], calendar { it.captureManagedCommand(command) }["operationId"])
    failure("OPERATION_REUSED") { calendar { it.captureManagedCommand(command + mapOf("selections" to mapOf("title" to "google"))) } }
    assertEquals("Captured", calendar { it.managed.candidate(candidate.candidateId)!!.state })
    assertTrue(records().isEmpty())
  }

  @Test fun exceptionChangedAfterCaptureCannotBeImportedUsingTheEarlierAudit() {
    activate()
    val original = now - 2 * 86_400_000L
    val master = event("captured-master", original).put("recurrence", JSONArray().put("RRULE:FREQ=DAILY;COUNT=1"))
    val moved = event("captured-moved").put("recurringEventId", "captured-master")
      .put("originalStartTime", JSONObject().put("dateTime", Instant.ofEpochMilli(original).toString()))
    val candidate = observe(master)
    remote[source.id to "captured-moved"] = moved
    calendar { it.managed.cachePage("subject", source.id, it.incremental.cursor(source.id).generation, JSONArray().put(moved)) }
    val preview = coordinator().candidatePreview(candidate.candidateId, emptyMap())
    val operation = operation()
    calendar { it.captureManagedCommand(mapOf("kind" to "ImportManagedCalendarCandidate", "operationId" to operation, "previewId" to preview["previewId"])) }
    moved.put("etag", "independent-edit").put("summary", "CHANGED AFTER REVIEW")
    val captured = calendar { it.managed.candidate(candidate.candidateId)!! }
    assertEquals("Review", transfer().importCandidate("synthetic", captured, false))
    assertTrue(records().isEmpty()); assertEquals(0, registrations)
    assertEquals("Conflict", calendar { it.links.operation(operation)!!.state })
    assertEquals("STALE_REMOTE", calendar { it.managed.candidate(candidate.candidateId)!!.reason })
    assertTrue(insertIds.isEmpty()); assertTrue(patchIds.isEmpty())
  }

  @Test fun capturedExceptionVerificationResumesSixReadsAtATimeAcrossProcessRestart() {
    activate()
    val start = now + 86_400_000L
    val master = event("many-exceptions", start).put("recurrence", JSONArray().put("RRULE:FREQ=DAILY;COUNT=12"))
    val candidate = observe(master)
    val instances = (0 until 12).map { index ->
      val original = start + index * 86_400_000L
      event("exception-$index", original + 600_000).put("recurringEventId", master.getString("id"))
        .put("originalStartTime", JSONObject().put("dateTime", Instant.ofEpochMilli(original).toString()))
        .also { remote[source.id to it.getString("id")] = it }
    }
    calendar { it.managed.cachePage("subject", source.id, it.incremental.cursor(source.id).generation, JSONArray(instances)) }
    val preview = coordinator().candidatePreview(candidate.candidateId, emptyMap())
    val operation = operation()
    calendar { it.captureManagedCommand(mapOf("kind" to "ImportManagedCalendarCandidate", "operationId" to operation, "previewId" to preview["previewId"])) }
    lookupIds.clear()
    assertFalse(transfer().verifyCapturedImport("synthetic", operation))
    assertEquals(6, lookupIds.size)
    assertEquals(6, JSONObject(calendar { it.managed.candidate(candidate.candidateId)!!.audit }).getInt("capturedVerificationIndex"))
    assertTrue(records().isEmpty())
    engine.close(); open()
    assertTrue(transfer().verifyCapturedImport("synthetic", operation))
    assertEquals(12, lookupIds.size); assertEquals(12, lookupIds.distinct().size)
    assertEquals(12, JSONObject(calendar { it.managed.candidate(candidate.candidateId)!!.audit }).getInt("capturedVerificationIndex"))
    CalendarLinkRunner(access, transfer().capturedImportTransport(operation)).run(operation, "synthetic")
    assertEquals("Confirmed", calendar { it.links.operation(operation)!!.state })
    assertEquals(12, records().count { it.exception && it.segmentId == candidate.localId })
    assertTrue(insertIds.isEmpty()); assertTrue(patchIds.isEmpty())
  }

  @Test fun successfulManagedPublicationEstablishesLinkAndItsCollectionEchoCannotImportAnotherReminder() {
    activate(); val id = create(); val intent = calendar { it.managed.intent(id)!! }
    assertEquals("Published", transfer().publish("synthetic", intent, true))
    assertEquals(1, insertIds.size); assertEquals("Automatic", calendar { it.sync.state(id).mode })
    assertEquals("Confirmed", calendar { it.managed.intent(id)!!.state })
    assertFalse(remote[source.id to insertIds.single()]!!.getJSONObject("reminders").getBoolean("useDefault"))
    CalendarAutomaticRunner(access, transport, { now }, { 0L }).run("synthetic", true)
    assertEquals(1, records().size); assertTrue(calendar { it.managed.candidates().isEmpty() }); assertEquals(1, insertIds.size)
  }

  @Test fun lostInsertReplyReconcilesSameOperationAndLeavesNewerLocalContentDirty() {
    activate(); val id = create()
    val job = calendar { it.captureManagedPublication(id, "same-publication", source) }
    loseInsertReply = true
    CalendarPublisher(access, transport).publish(calendar { it.begin(job.operationId)!! }, "synthetic")
    assertEquals("Unconfirmed", calendar { it.operation(job.operationId)!!.state }); assertEquals(1, insertIds.size)
    edit(id, mapOf("notes" to "NEWER LOCAL NOTES"))
    CalendarPublisher(access, transport).publish(calendar { it.begin(job.operationId)!! }, "synthetic")
    assertEquals("Published", calendar { it.operation(job.operationId)!!.state })
    calendar { it.completeManagedPublication(job.operationId, remote[source.id to job.eventId]!!) }
    assertEquals(1, insertIds.size)
    assertEquals("NEWER LOCAL NOTES", native { engine.occurrence(id)!!["notes"] })
    assertEquals("UpdatePending", calendar { it.sync.state(id).status })
    assertEquals("PRIVATE LOCAL NOTES", JSONObject(calendar { it.links.link(id)!!.baseline }).getString("notes"))
    assertTrue(calendar { it.sync.state(id).dirtyRevision > 0 })
  }

  @Test fun partialFollowingPublicationCannotEnableAutomaticSyncUntilEveryResourceIsConfirmed() {
    activate()
    val initial = native { engine.apply(createCommand("family-for-publication") + mapOf("kind" to "CreateSeries",
      "recurrence" to mapOf("frequency" to "daily", "count" to 4, "zoneMode" to "pinned"))) }
    assertNotEquals("Rejected", initial["status"])
    val id = initial["segmentId"] as String
    val next = now + 3_600_000 + 86_400_000L
    val split = native { engine.apply(mapOf("kind" to "EditFollowing", "operationId" to operation(), "segmentId" to id,
      "expectedRevision" to engine.getSeries(id)!!["revision"],
      "nominalSlot" to Instant.ofEpochMilli(next).atZone(ZoneId.of(source.zoneId)).toLocalDateTime().toString(),
      "title" to "Following title", "eventStartMs" to next, "eventEndMs" to next + 1_800_000, "alarmAtMs" to next,
      "recurrence" to mapOf("frequency" to "daily", "count" to 3, "zoneMode" to "pinned"))) }
    assertNotEquals("Rejected", split["status"])
    val job = calendar { it.captureManagedPublication(id, "multi-resource-publication", source) }
    assertEquals(1, calendar { it.publicationJobs(job.operationId).size })
    loseInsertAt = 2
    CalendarPublisher(access, transport).publish(calendar { it.begin(job.operationId)!! }, "synthetic")
    assertEquals(2, insertIds.size); assertEquals("Unconfirmed", calendar { it.operation(job.operationId)!!.state })
    assertNull(calendar { it.links.link(id) }); assertFalse(calendar { it.sync.eligible(id) })
    engine.close(); open()
    CalendarPublisher(access, transport).publish(calendar { it.begin(job.operationId)!! }, "synthetic")
    assertEquals("Published", calendar { it.operation(job.operationId)!!.state })
    calendar { it.completeManagedPublication(job.operationId, remote[source.id to job.eventId]!!) }
    assertEquals(2, insertIds.size)
    assertTrue(calendar { it.publicationJobs(job.operationId).all { resource -> resource.confirmed } })
    assertEquals("Automatic", calendar { it.sync.state(id).mode })
    assertEquals(1, JSONObject(calendar { it.links.link(id)!!.baseline }).getJSONObject("schedule").getJSONArray("segments").length())
  }

  @Test fun pauseHoldsNewLocalWorkButDoesNotFenceOtherCalendarLinks() {
    activate()
    val managed = observe(event("managed-linked")); transfer().importCandidate("synthetic", managed, true)
    val otherEvent = event("legacy-linked"); remote[legacy.id to "legacy-linked"] = otherEvent
    val preview = calendar { it.links.preview(legacy, otherEvent, null, mapOf("mode" to "None", "automaticSync" to true), 0) }
    val op = operation()
    val captured = native { engine.calendarCapture(mapOf("kind" to "ImportCalendarEvent", "operationId" to op, "previewId" to preview["previewId"])) }
    val otherId = captured["occurrenceId"] as String
    CalendarLinkRunner(access, transport).run(op, "synthetic")
    calendar { it.managed.pause(mapOf("kind" to "PauseManagedCalendar", "operationId" to operation(), "expectedRevision" to it.managed.binding().revision)) }
    val held = create(); assertEquals("Held", calendar { it.managed.intent(held)!!.state })
    remote[source.id to "managed-linked"]!!.put("summary", "PAUSED GOOGLE TITLE").put("etag", "paused")
    otherEvent.put("summary", "OTHER GOOGLE TITLE").put("etag", "other-version")
    CalendarAutomaticRunner(access, transport, { now }, { 0L }).run("synthetic", true)
    assertEquals("PRIVATE GOOGLE TITLE", native { engine.occurrence(managed.localId)!!["title"] })
    assertEquals("OTHER GOOGLE TITLE", native { engine.occurrence(otherId)!!["title"] })
    assertTrue(insertIds.isEmpty())
  }

  @Test fun managedPrivateStateAndDispositionsNeverEnterDirectBootOrPortableBackup() {
    activate(); create(createCommand(disposition = "LocalOnly")); observe(event("private-candidate"))
    calendar { it.managed.issue("Setup", "setup-private-identity", "CREATION_UNCONFIRMED", true) }
    val backup = native { engine.exportBackup() }; assertEquals(5, JSONObject(backup).getInt("version"))
    val dp = context.createDeviceProtectedStorageContext().getDatabasePath("remilo-operational.db").readBytes().toString(Charsets.ISO_8859_1)
    listOf("owner@example.test", "private-candidate", "setup-private-identity", "LocalOnly", "managed_calendar", "PRIVATE GOOGLE NOTES").forEach {
      assertFalse("Calendar state must not enter portable backup: $it", backup.contains(it))
      assertFalse("Calendar state must not enter DP: $it", dp.contains(it))
    }
    assertTrue(backup.contains("PRIVATE LOCAL NOTES")); assertFalse(dp.contains("PRIVATE LOCAL NOTES"))
  }
  @Test fun unavailableManagedCalendarPausesOnlyItsScopeAndKeepsOtherSourcesWorking() {
    activate(); val managed = observe(event("retained-managed")); transfer().importCandidate("synthetic", managed, true)
    val other = event("unrelated-source"); remote[legacy.id to other.getString("id")] = other
    val preview = calendar { it.links.preview(legacy, other, null, mapOf("mode" to "None", "automaticSync" to true), 0) }
    val op = operation()
    val captured = native { engine.calendarCapture(mapOf("kind" to "ImportCalendarEvent", "operationId" to op, "previewId" to preview["previewId"])) }
    val otherId = captured["occurrenceId"] as String
    CalendarLinkRunner(access, transport).run(op, "synthetic")
    other.put("summary", "Other source update").put("etag", "updated-other")
    managedUnavailable = true
    CalendarAutomaticRunner(access, transport, { now }, { 0L }).run("synthetic", true)
    assertEquals("CalendarUnavailable", calendar { it.managed.binding().phase })
    assertFalse(calendar { it.sync.eligible(managed.localId) })
    assertEquals("Scheduled", native { engine.occurrence(managed.localId)!!["deliveryState"] })
    assertEquals("Other source update", native { engine.occurrence(otherId)!!["title"] })
    assertTrue(insertIds.isEmpty())
  }

  @Test fun mixedReviewTargetsHaveOnePersistentQuietSummaryAndDoNotRepostAfterDismissal() {
    activate(); val imported = observe(event("linked")); transfer().importCandidate("synthetic", imported, true)
    val candidate = observe(event("candidate"))
    Shadows.shadowOf(context as Application).grantPermissions(Manifest.permission.POST_NOTIFICATIONS)
    val manager = context.getSystemService(NotificationManager::class.java)
    calendar {
      it.sync.issue(imported.localId, "ChangesNeedReview", true, content = "local-remote-conflict")
      it.managed.candidateFailed(candidate.candidateId, "ELAPSED_ALERT", true)
      it.managed.issue("Setup", "setup-recovery", "CREATION_UNCONFIRMED", true)
      it.sync.notifications(CalendarReviewNotifications(context))
    }
    val issues = calendar { it.sync.issues(null) }
    assertEquals(3, issues["count"])
    assertEquals(setOf("Association", "Candidate", "Setup"), (issues["items"] as List<*>).map { (it as Map<*, *>)["kind"] }.toSet())
    assertEquals(3, calendar { it.sync.summary()["reviewCount"] })
    assertEquals(1, manager.activeNotifications.size)
    val notification = manager.activeNotifications.single().notification
    assertNull(notification.sound); assertNull(notification.vibrate); assertNull(notification.fullScreenIntent)
    assertFalse(notification.extras.getString(Notification.EXTRA_TEXT).orEmpty().contains("PRIVATE"))
    assertEquals("remilo://calendar-reviews", Shadows.shadowOf(notification.contentIntent).savedIntent.data.toString())
    manager.cancel(CalendarReviewNotifications.TAG, CalendarReviewNotifications.ID)
    engine.close(); open()
    calendar { it.sync.notifications(CalendarReviewNotifications(context)) }
    assertTrue(manager.activeNotifications.isEmpty()); assertEquals(3, calendar { it.sync.issues(null)["count"] })
    for (enabled in listOf(false, true)) calendar { it.sync.preference(mapOf("operationId" to operation(), "enabled" to enabled,
      "expectedRevision" to it.sync.preferenceView()["revision"])); it.sync.notifications(CalendarReviewNotifications(context)) }
    assertTrue(manager.activeNotifications.isEmpty())
    calendar { it.managed.issue("Setup", "setup-recovery", "CREATION_UNCONFIRMED", true, "changed-result"); it.sync.notifications(CalendarReviewNotifications(context)) }
    assertEquals(1, manager.activeNotifications.size)
  }
}

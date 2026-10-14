package com.remilo.alarm.calendar

import android.app.Application
import androidx.room.Room
import com.remilo.alarm.data.ContentDatabase
import org.json.JSONArray
import org.json.JSONObject
import org.junit.*
import org.junit.Assert.*
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import java.time.Instant
import java.util.UUID

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34], application = Application::class)
class CalendarManagedStoreTest {
  private lateinit var db: ContentDatabase
  private lateinit var store: CalendarManagedStore
  private var now = 1_800_000_000_000L
  private val calendar = OwnedCalendar("managed", "Remilo", "UTC", dataOwner = "owner@example.test")
  @Before fun open() {
    db = Room.inMemoryDatabaseBuilder(RuntimeEnvironment.getApplication(), ContentDatabase::class.java).allowMainThreadQueries().build()
    db.calendar().connection(CalendarConnection(revision = 1, connected = true, subject = "subject", email = "owner@example.test"))
    store = CalendarManagedStore(db) { now }
  }
  @After fun close() { db.close() }
  private fun operation() = UUID.randomUUID().toString()
  private fun activate(origin: String = "FreshInstallation") {
    db.managedCalendar().installation(CalendarInstallationOrigin(origin = origin))
    val preview = store.previewSetup(emptyMap(), JSONArray().put(calendar.managedJson()), true, calendar.id)
    val id = operation()
    store.captureSetup(mapOf("kind" to "ConfirmManagedCalendarSetup", "operationId" to id, "previewId" to preview["previewId"], "selectedCalendarId" to calendar.id))
    store.acknowledgeCalendar(id, calendar); store.completeSetup(id)
  }
  private fun event(id: String = "event", start: Long = now + 60_000) = JSONObject().put("id", id).put("etag", "v1")
    .put("summary", "Private reminder").put("description", "Private notes")
    .put("start", JSONObject().put("dateTime", Instant.ofEpochMilli(start).toString()).put("timeZone", "UTC"))
    .put("end", JSONObject().put("dateTime", Instant.ofEpochMilli(start + 60_000).toString()).put("timeZone", "UTC"))
  private fun command(kind: String, expected: Long = store.binding().revision) = mapOf("kind" to kind, "operationId" to operation(), "expectedRevision" to expected)
  private fun failure(code: String, block: () -> Unit) { try { block(); fail("Expected $code") } catch (error: CalendarFailure) { assertEquals(code, error.code) } }

  @Test fun freshOriginIsQuietForInitialRecoveryAndAlarmForSubsequentDiscovery() {
    activate()
    assertEquals("None", store.candidateObservation(event())!!.mode)
    store.collectionCompleted(CalendarSyncCursor("query", "subject", calendar.id, paging = false))
    assertEquals("Alarm", store.candidateObservation(event("later"))!!.mode)
    assertEquals("None", store.candidateObservation(event().put("summary", "Updated initial"))!!.mode)
    assertEquals(CalendarManagedStore.importLocalId(CalendarLinkMapper.key("subject", calendar.id, "event")), store.candidateObservation(event())!!.localId)
  }
  @Test fun existingOriginInitialImportsRetainAlarmAndUnconfirmedSetupGrantsNothing() {
    db.managedCalendar().installation(CalendarInstallationOrigin(origin = "ExistingInstallation"))
    val preview = store.previewSetup(emptyMap(), JSONArray().put(calendar.managedJson()), true, calendar.id)
    val id = operation()
    val cmd = mapOf("kind" to "ConfirmManagedCalendarSetup", "operationId" to id, "previewId" to preview["previewId"], "selectedCalendarId" to calendar.id)
    assertEquals(store.captureSetup(cmd), store.captureSetup(cmd))
    assertFalse(store.active()); assertTrue(store.enabledCalendarIds().isEmpty()); assertNull(store.candidateObservation(event()))
    store.acknowledgeCalendar(id, calendar); store.completeSetup(id)
    assertEquals("Alarm", store.candidateObservation(event())!!.mode)
  }
  @Test fun stalePreviewAndReusedReceiptCannotChangePermission() {
    activate(); val preview = store.previewPolicyChange(mapOf("exportNewReminders" to false))
    val pause = command("PauseManagedCalendar"); store.pause(pause)
    failure("STALE_PREVIEW") { store.applyPolicy(mapOf("kind" to "ApplyManagedCalendarPolicy", "operationId" to operation(), "previewId" to preview["previewId"])) }
    failure("OPERATION_REUSED") { store.disable(pause + mapOf("kind" to "DisableManagedCalendar")) }
    assertEquals("Paused", store.binding().mode)
  }
  @Test fun pauseHoldsNewExportsAndReviewedResumeReleasesOnlySelectedItems() {
    activate(); store.authored("first", 1); store.pause(command("PauseManagedCalendar")); store.authored("second", 1)
    store.updated("first", 4)
    assertEquals("Held", store.intent("first")!!.state); assertEquals(4L, store.intent("first")!!.localRevision)
    assertTrue(store.pendingIntents().isEmpty())
    val preview = store.previewResume()
    store.resume(mapOf("kind" to "ResumeManagedCalendar", "operationId" to operation(), "previewId" to preview["previewId"], "selectedItemIds" to listOf("export:first")))
    assertEquals("Pending", store.intent("first")!!.state); assertEquals("Held", store.intent("second")!!.state)
  }
  @Test fun disablingCancelsUnsentIntentAndCreatesNoRetroactiveExportPermission() {
    activate(); store.authored("before", 1); store.disable(command("DisableManagedCalendar")); store.authored("after", 1)
    assertEquals("Cancelled", store.intent("before")!!.state); assertNull(store.intent("after"))
    val preview = store.previewResume()
    store.resume(mapOf("kind" to "ResumeManagedCalendar", "operationId" to operation(), "previewId" to preview["previewId"]))
    assertTrue(store.pendingIntents().isEmpty())
  }
  @Test fun futurePolicyChangeDoesNotInvalidateCapturedImportOrExistingExport() {
    activate("ExistingInstallation")
    val candidate = store.candidateObservation(event())!!; val id = operation()
    store.captureImport(candidate.candidateId, id, candidate.revision)
    store.authored("local", 1); val pub = operation(); store.publicationCaptured("local", pub)
    val epoch = store.binding().authEpoch
    val preview = store.previewPolicyChange(mapOf("importMode" to "None", "exportNewReminders" to false))
    store.applyPolicy(mapOf("kind" to "ApplyManagedCalendarPolicy", "operationId" to operation(), "previewId" to preview["previewId"]))
    assertEquals(epoch, store.binding().authEpoch); store.guardOperation(id); store.guardPublication(pub)
    assertEquals("Alarm", store.candidate(candidate.candidateId)!!.mode)
    assertEquals("Alarm", JSONObject(store.candidate(candidate.candidateId)!!.policySnapshot).getString("importMode"))
    store.authored("new-local", 1); assertNull(store.intent("new-local"))
  }
  @Test fun explicitImportCanContinueWhilePausedButAutomaticCaptureCannot() {
    activate(); val candidate = store.candidateObservation(event())!!
    store.pause(command("PauseManagedCalendar"))
    failure("STALE_PREVIEW") { store.captureImport(candidate.candidateId, operation(), candidate.revision) }
    failure("STALE_PREVIEW") { store.captureImport(candidate.candidateId, operation(), candidate.revision, automatic = false) }
    val reviewed = store.candidate(candidate.candidateId)!!
    val id = operation(); store.captureImport(reviewed.candidateId, id, reviewed.revision, automatic = false)
    store.guardOperation(id); store.finishCandidate(id)
    assertEquals("Imported", store.candidate(candidate.candidateId)!!.state)
  }
  @Test fun uncertainCalendarCreationNeverReceivesAnotherPostPermit() {
    val preview = store.previewSetup(emptyMap(), JSONArray(), true, createCalendar = true)
    val id = operation(); store.captureSetup(mapOf("kind" to "ConfirmManagedCalendarSetup", "operationId" to id, "previewId" to preview["previewId"]))
    store.discoveryPage(id, CalendarPage(emptyList(), null)); assertNotNull(store.permitCreate(id))
    store.setupFailed(id, "NETWORK"); assertNull(store.permitCreate(id))
    store.resetDiscovery(id); store.discoveryPage(id, CalendarPage(emptyList(), null)); assertNull(store.permitCreate(id))
    assertEquals("CreationUnconfirmed", store.binding().phase)
  }
  @Test fun purgeErasesPrivateSnapshotsAndKeepsOnlyHashedSuppression() {
    activate(); val candidate = store.candidateObservation(event())!!
    store.cachePage("subject", calendar.id, 7, JSONArray().put(event()))
    store.purge(candidate.localId)
    assertNull(store.candidate(candidate.candidateId)); assertTrue(store.observations(calendar.id).isEmpty())
    assertTrue(store.suppressed(candidate.remoteKey)); assertNull(store.candidateObservation(event()))
    val suppression = db.managedCalendar().suppression(CalendarMapper.hash(candidate.remoteKey))!!
    assertEquals("", suppression.subject); assertEquals("", suppression.eventId); assertEquals("", suppression.localId)
    assertFalse(suppression.remoteKey.contains("event"))
  }
  @Test fun pageDiscardsEndedEventsButDurablyCapturesFutureCandidatesBeforeCompletion() {
    activate(); val cursor = CalendarSyncCursor("query", "subject", calendar.id, generation = 5)
    store.page(cursor, JSONArray().put(event("past", now - 300_000)).put(event("future")), calendar, true)
    assertEquals(listOf("future"), store.candidates().map { it.eventId }); assertEquals(5L, store.observations(calendar.id).single().generation)
    store.collectionCompleted(cursor.copy(paging = false)); assertTrue(store.binding().initialRecoveryComplete)
  }
  @Test fun auditCheckpointAndQuietRetrySurviveSavedProjection() {
    activate(); val candidate = store.candidateObservation(event())!!
    db.managedCalendar().candidate(candidate.copy(audit = "{\"etag\":\"v1\",\"confirmed\":[\"slot\"]}"))
    store.candidateFailed(candidate.candidateId, "NETWORK", true)
    assertTrue(store.candidates().isEmpty()); assertTrue(store.issues().isEmpty())
    assertEquals(now + 60_000, store.nextRetryMs())
    val restarted = CalendarManagedStore(db) { now }
    assertEquals("v1", JSONObject(restarted.candidate(candidate.candidateId)!!.audit).getString("etag"))
    now += 60_000; assertEquals(listOf(candidate.candidateId), restarted.candidates().map { it.candidateId })
  }
  @Test fun unrelatedLegacyPermissionsRemainEligibleWhenManagedScopeIsDisabled() {
    assertTrue(store.automaticAllowed("legacy", "other"))
    activate(); store.pause(command("PauseManagedCalendar"))
    assertFalse(store.automaticAllowed("subject", calendar.id)); assertTrue(store.automaticAllowed("subject", "other"))
  }
  @Test fun genuinelyNewCalendarOnFreshInstallUsesContinuingAlarmPolicy() {
    val preview = store.previewSetup(mapOf("calendarZone" to "UTC"), JSONArray(), true, createCalendar = true)
    assertEquals("Alarm", preview["initialMode"])
    val id = operation()
    store.captureSetup(mapOf("kind" to "ConfirmManagedCalendarSetup", "operationId" to id, "previewId" to preview["previewId"]))
    store.discoveryPage(id, CalendarPage(emptyList(), null)); store.permitCreate(id)
    store.acknowledgeCalendar(id, calendar.copy(description = CalendarManagedDiscovery.marker(id)))
    store.completeSetup(id)
    val candidate = store.candidateObservation(event())!!
    assertEquals("Alarm", candidate.mode)
    assertFalse(JSONObject(candidate.policySnapshot).getBoolean("initialRecovery"))
  }
  @Test fun setupRebuildsAnAssociationOnlyCursorWithoutDiscardingExistingAgreement() {
    val key = CalendarLinkMapper.key("subject", calendar.id, "sync-query-v1")
    db.sync().cursor(CalendarSyncCursor(key, "subject", calendar.id, generation = 8, syncToken = "old", startingToken = "old", pageToken = "next", paging = true))
    val prior = CalendarSyncState("existing", mode = "Automatic", baselineVersion = 3)
    db.sync().put(prior)
    activate()
    val cursor = db.sync().cursor(key)!!
    assertEquals(9L, cursor.generation); assertEquals(9L, store.binding().bootstrapGeneration)
    assertEquals("", cursor.syncToken); assertEquals("", cursor.startingToken); assertEquals("", cursor.pageToken); assertFalse(cursor.paging)
    assertEquals(prior, db.sync().state("existing"))
    store.collectionCompleted(cursor.copy(generation = 8))
    assertFalse(store.binding().initialRecoveryComplete)
    store.collectionCompleted(cursor.copy(generation = 9))
    assertTrue(store.binding().initialRecoveryComplete)
  }
  @Test fun initialCohortFreezesAllDayTimeAndQuietRecoveryAcrossPolicyChanges() {
    activate()
    val preview = store.previewPolicyChange(mapOf("allDayAlarmMinutes" to 600, "importMode" to "Notification"))
    store.applyPolicy(mapOf("kind" to "ApplyManagedCalendarPolicy", "operationId" to operation(), "previewId" to preview["previewId"]))
    val initial = store.candidateObservation(event())!!
    val captured = JSONObject(initial.policySnapshot)
    assertTrue(captured.getBoolean("initialCohort")); assertTrue(captured.getBoolean("initialRecovery"))
    assertEquals("None", captured.getString("importMode")); assertEquals(540, captured.getInt("allDayAlarmMinutes"))
    store.initialComplete(store.binding().bootstrapGeneration)
    val later = store.candidateObservation(event("later"))!!
    assertFalse(JSONObject(later.policySnapshot).getBoolean("initialRecovery"))
    assertEquals("Notification", later.mode); assertEquals(600, JSONObject(later.policySnapshot).getInt("allDayAlarmMinutes"))
    assertTrue(JSONObject(store.candidate(initial.candidateId)!!.policySnapshot).getBoolean("initialRecovery"))
  }
  @Test fun continuingUncapturedCandidatesUseNewDefaultsAndCapturedOnesRemainImmutable() {
    activate("ExistingInstallation"); store.initialComplete(store.binding().bootstrapGeneration)
    val captured = store.candidateObservation(event("captured"))!!
    val pending = store.candidateObservation(event("pending"))!!
    store.captureImport(captured.candidateId, operation(), captured.revision)
    val preview = store.previewPolicyChange(mapOf("importMode" to "Notification", "allDayAlarmMinutes" to 630))
    store.applyPolicy(mapOf("kind" to "ApplyManagedCalendarPolicy", "operationId" to operation(), "previewId" to preview["previewId"]))
    assertEquals("Alarm", store.candidate(captured.candidateId)!!.mode)
    assertEquals(540, JSONObject(store.candidate(captured.candidateId)!!.policySnapshot).getInt("allDayAlarmMinutes"))
    assertEquals("Notification", store.candidate(pending.candidateId)!!.mode)
    assertEquals(pending.revision + 1, store.candidate(pending.candidateId)!!.revision)
  }
  @Test fun timestampAndEtagChangesRefreshContextWithoutReopeningOrRenotifyingReview() {
    activate()
    val original = store.candidateObservation(event().put("remiloInstances", JSONArray().put(JSONObject().put("id", "child").put("etag", "child-v1"))))!!
    store.candidateFailed(original.candidateId, "ELAPSED_ALERT", true)
    val issue = db.managedCalendar().issues().single()
    db.managedCalendar().issue(issue.copy(notifiedFingerprint = issue.fingerprint))
    val updated = store.candidateObservation(event().put("etag", "v2").put("updated", "2099-01-01T00:00:00Z")
      .put("remiloInstances", JSONArray().put(JSONObject().put("id", "child").put("etag", "child-v2"))))!!
    assertEquals(original.fingerprint, updated.fingerprint); assertEquals(original.revision, updated.revision)
    assertEquals("Review", updated.state); assertEquals("ELAPSED_ALERT", updated.reason)
    assertEquals("v2", JSONObject(updated.event).getString("etag"))
    assertEquals(issue.fingerprint, db.managedCalendar().issues().single().notifiedFingerprint)
  }
  @Test fun resumedCollectionCannotReleaseUnselectedCandidateIntent() {
    activate()
    val first = store.candidateObservation(event("first"))!!
    val second = store.candidateObservation(event("second"))!!
    store.pause(command("PauseManagedCalendar"))
    assertTrue(store.pendingCandidates().isEmpty())
    val rows = JSONArray().put(JSONObject().put("itemId", "candidate:${first.candidateId}").put("candidateId", first.candidateId)
      .put("candidateRevision", store.candidate(first.candidateId)!!.revision).put("kind", "Import").put("ready", true))
    val preview = store.previewResume(rows)
    store.resume(mapOf("kind" to "ResumeManagedCalendar", "operationId" to operation(), "previewId" to preview["previewId"], "selectedItemIds" to listOf("candidate:${first.candidateId}")))
    assertEquals(listOf(first.candidateId), store.pendingCandidates().map { it.candidateId })
    store.candidateObservation(event("second").put("summary", "Edited while held"))
    assertEquals("Held", store.candidate(second.candidateId)!!.state)
  }
  @Test fun enabledAccessFailureCanBeReviewedAndDoesNotResumeByReconnectAlone() {
    activate(); store.authored("queued", 1); store.accessChanged("AUTH")
    assertEquals("Enabled", store.binding().mode); assertEquals("AccessRequired", store.binding().phase)
    assertFalse(store.active()); assertEquals("Held", store.intent("queued")!!.state)
    val preview = store.previewResume()
    store.resume(mapOf("kind" to "ResumeManagedCalendar", "operationId" to operation(), "previewId" to preview["previewId"], "selectedItemIds" to emptyList<String>()))
    assertTrue(store.active()); assertEquals("Held", store.intent("queued")!!.state)
  }
  @Test fun managedChoiceOverridesFuturePublicationDefaultWhileLocalOnlyNeverQueues() {
    activate()
    val preview = store.previewPolicyChange(mapOf("exportNewReminders" to false))
    store.applyPolicy(mapOf("kind" to "ApplyManagedCalendarPolicy", "operationId" to operation(), "previewId" to preview["previewId"]))
    store.authored("default", 1); store.authored("managed", 1, "Managed"); store.authored("local", 1, "LocalOnly")
    assertNull(store.intent("default")); assertEquals("Pending", store.intent("managed")!!.state); assertNull(store.intent("local"))
    store.pause(command("PauseManagedCalendar")); store.authored("held", 1, "Managed")
    assertEquals("Held", store.intent("held")!!.state)
  }
  @Test fun capturedSetupSelectionIsImmutableAndPurgeErasesItsPrivateItem() {
    val local = "existing"
    val items = JSONArray().put(JSONObject().put("itemId", "export:$local").put("occurrenceId", local).put("title", "Private selected title").put("ready", true))
      .put(JSONObject().put("itemId", "export:other").put("occurrenceId", "other").put("title", "Not selected").put("ready", true))
    val preview = store.previewSetup(emptyMap(), JSONArray().put(calendar.managedJson()), true, calendar.id, items = items)
    val id = operation()
    val command = mapOf("kind" to "ConfirmManagedCalendarSetup", "operationId" to id, "previewId" to preview["previewId"], "selectedItemIds" to listOf("export:$local"))
    val result = store.captureSetup(command)
    val captured = JSONArray(store.setupOperation(id)!!.reviewedItems)
    assertEquals(1, captured.length()); assertEquals("Private selected title", captured.getJSONObject(0).getString("title"))
    assertEquals(result, store.captureSetup(command))
    failure("OPERATION_REUSED") { store.captureSetup(command + mapOf("selectedItemIds" to listOf("export:other"))) }
    store.purge(local)
    assertEquals("[]", store.setupOperation(id)!!.reviewedItems)
  }
  @Test fun receiptCannotReuseALocalCreationOperationIdentity() {
    val id = operation()
    db.records().receipt(com.remilo.alarm.data.CreationReceipt(id, "local", "Create"))
    failure("OPERATION_REUSED") { store.pause(mapOf("kind" to "PauseManagedCalendar", "operationId" to id, "expectedRevision" to store.binding().revision)) }
  }
  @Test fun strictOwnerValidationCannotAuthorizeUnknownOrDifferentOwners() {
    val preview = store.previewSetup(emptyMap(), JSONArray().put(calendar.managedJson()), true, calendar.id)
    val id = operation(); store.captureSetup(mapOf("kind" to "ConfirmManagedCalendarSetup", "operationId" to id, "previewId" to preview["previewId"]))
    failure("OWNERSHIP_UNKNOWN") { store.acknowledgeCalendar(id, calendar.copy(dataOwner = "")) }
    failure("NOT_OWNER") { store.acknowledgeCalendar(id, calendar.copy(dataOwner = "other@example.test")) }
    failure("NOT_OWNER") { store.acknowledgeCalendar(id, calendar.copy(primary = true)) }
    assertFalse(store.active())
    store.acknowledgeCalendar(id, calendar.copy(dataOwner = "OWNER@EXAMPLE.TEST")); store.completeSetup(id)
    assertTrue(store.active())
  }
  @Test fun resumeRetainsCapturedPublicationIdentityAndCannotReleaseOtherLinks() {
    activate("ExistingInstallation")
    val local = com.remilo.alarm.data.ReminderRecord("publish", "Publish", now + 120_000, now + 180_000, now + 120_000, now,
      definedAlarmAtMs = now + 120_000, zoneId = "UTC")
    db.records().insert(local); store.authored(local.id, local.revision)
    val publication = operation()
    val owner = CalendarStore(db, { now }, { "UTC" })
    owner.captureManagedPublication(local.id, publication, calendar)
    val job = db.calendar().operation(publication)!!
    db.calendar().update(job.copy(attempted = true, state = "Published"))
    for (id in listOf("selected-link", "other-link")) {
      db.records().insert(local.copy(id = id))
      db.links().put(CalendarLink(id, CalendarLinkMapper.key("subject", calendar.id, id), "subject", calendar.id, id, "Remilo", "Imported"))
      db.sync().put(CalendarSyncState(id, mode = "Automatic", activationRevision = 4))
    }
    store.pause(command("PauseManagedCalendar"))
    assertEquals(5L, db.sync().state("selected-link")!!.activationRevision)
    val rows = JSONArray().put(JSONObject().put("itemId", "export:publish").put("occurrenceId", "publish").put("ready", true))
      .put(JSONObject().put("itemId", "association:selected-link").put("occurrenceId", "selected-link").put("ready", true))
    val preview = store.previewResume(rows)
    val command = mapOf("kind" to "ResumeManagedCalendar", "operationId" to operation(), "previewId" to preview["previewId"],
      "selectedItemIds" to listOf("export:publish", "association:selected-link"))
    val acknowledgement = store.resume(command)
    assertEquals(acknowledgement, store.resume(command))
    assertEquals(publication, store.intent("publish")!!.operationId); assertEquals("Captured", store.intent("publish")!!.state)
    store.guardPublication(publication)
    assertEquals("UpdatePending", db.sync().state("selected-link")!!.status)
    assertEquals("Paused", db.sync().state("other-link")!!.status)
  }
  @Test fun staleSelectedNativeRevisionRollsBackWholeResumeCapture() {
    activate(); store.authored("one", 1); store.pause(command("PauseManagedCalendar"))
    val row = JSONObject().put("itemId", "export:one").put("occurrenceId", "one").put("localRevision", 1).put("ready", true)
    val preview = store.previewResume(JSONArray().put(row)); val epoch = store.binding().authEpoch
    failure("STALE_PREVIEW") { store.resume(mapOf("kind" to "ResumeManagedCalendar", "operationId" to operation(), "previewId" to preview["previewId"], "selectedItemIds" to listOf("export:one"))) }
    assertEquals("Paused", store.binding().mode); assertEquals(epoch, store.binding().authEpoch); assertEquals("Held", store.intent("one")!!.state)
  }
  @Test fun localOnlyChoiceFromAnInstanceDetachesTheWholeRecurringFamily() {
    activate("ExistingInstallation")
    val family = "family"
    val anchor = Instant.ofEpochMilli(now + 120_000).atZone(java.time.ZoneId.of("UTC")).toLocalDateTime()
    val rule = com.remilo.alarm.core.RecurrenceRule(anchor = anchor, frequency = "daily", zoneId = "UTC")
    val template = com.remilo.alarm.data.ReminderRecord(family, "Family", now + 120_000, now + 180_000, now + 120_000, now,
      definedAlarmAtMs = now + 120_000, zoneId = "UTC")
    db.records().series(com.remilo.alarm.data.SeriesRecord(family, family, JSONObject(com.remilo.alarm.data.BackupCodec.record(template)).toString(),
      com.remilo.alarm.data.RuleCodec.encode(rule), createdAtMs = now))
    db.records().insert(template.copy(id = "instance", segmentId = family, nominalSlot = anchor.toString()))
    db.links().put(CalendarLink(family, CalendarLinkMapper.key("subject", calendar.id, "master"), "subject", calendar.id, "master", "Remilo", "Imported"))
    db.sync().put(CalendarSyncState(family, mode = "Automatic")); store.authored(family, 1)
    val command = mapOf("kind" to "SetCalendarReminderDisposition", "operationId" to operation(), "occurrenceId" to "instance", "expectedRevision" to 0, "disposition" to "LocalOnly")
    val result = store.setDisposition(command)
    assertEquals(result, store.setDisposition(command))
    assertEquals("LocalOnly", store.disposition("instance")["state"]); assertEquals("LocalOnly", store.disposition(family)["state"])
    assertEquals("Detached", db.links().link(family)!!.state); assertEquals("Cancelled", store.intent(family)!!.state)
    assertTrue(store.suppressed(CalendarLinkMapper.key("subject", calendar.id, "master")))
    failure("REVIEW_REQUIRED") { store.setDisposition(mapOf("kind" to "SetCalendarReminderDisposition", "operationId" to operation(), "occurrenceId" to "instance",
      "expectedRevision" to store.disposition("instance")["revision"], "disposition" to "Managed")) }
  }
  @Test fun importPreferenceReenableRebuildsCursorAndDoesNotRewriteCapturedRecovery() {
    activate()
    val candidate = store.candidateObservation(event())!!
    val importId = operation(); store.captureImport(candidate.candidateId, importId, candidate.revision)
    val key = CalendarLinkMapper.key("subject", calendar.id, "sync-query-v1")
    db.sync().cursor(db.sync().cursor(key)!!.copy(syncToken = "prior"))
    val off = store.previewPolicyChange(mapOf("automaticImport" to false))
    store.applyPolicy(mapOf("kind" to "ApplyManagedCalendarPolicy", "operationId" to operation(), "previewId" to off["previewId"]))
    assertNull(store.candidateObservation(event("while-off")))
    assertEquals(listOf(candidate.candidateId), store.pendingCandidates().map { it.candidateId })
    val generation = db.sync().cursor(key)!!.generation
    val on = store.previewPolicyChange(mapOf("automaticImport" to true, "importMode" to "Alarm"))
    store.applyPolicy(mapOf("kind" to "ApplyManagedCalendarPolicy", "operationId" to operation(), "previewId" to on["previewId"]))
    assertEquals(generation + 1, db.sync().cursor(key)!!.generation); assertEquals("", db.sync().cursor(key)!!.syncToken)
    assertEquals("None", store.candidate(candidate.candidateId)!!.mode)
    assertTrue(JSONObject(store.candidate(candidate.candidateId)!!.policySnapshot).getBoolean("initialRecovery"))
    store.guardOperation(importId)
  }
  @Test fun importedPublicationProofSurvivesSnapshotErasureAndCannotBeInventedLater() {
    activate()
    val raw = event("published").put("extendedProperties", JSONObject().put("private", JSONObject().put("remiloPublication", "published")))
    val candidate = store.candidateObservation(raw)!!; val id = operation()
    assertTrue(JSONObject(candidate.policySnapshot).getBoolean("publicationMarker"))
    store.captureImport(candidate.candidateId, id, candidate.revision); store.finishCandidate(id)
    assertEquals("", store.candidate(candidate.candidateId)!!.event)
    assertTrue(JSONObject(store.candidate(candidate.candidateId)!!.policySnapshot).getBoolean("publicationMarker"))
    val plain = store.candidateObservation(event("plain"))!!
    val markedLater = store.candidateObservation(event("plain").put("extendedProperties", JSONObject().put("private", JSONObject().put("remiloPublication", "plain"))))!!
    assertFalse(JSONObject(plain.policySnapshot).getBoolean("publicationMarker"))
    assertFalse(JSONObject(markedLater.policySnapshot).getBoolean("publicationMarker"))
  }
}

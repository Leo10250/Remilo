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
class CalendarStatusStoreTest {
  private lateinit var db: ContentDatabase
  private lateinit var status: CalendarStatusStore
  private lateinit var managed: CalendarManagedStore
  private val now = 1_800_000_000_000L
  private val calendar = OwnedCalendar("managed", "Remilo", "UTC", dataOwner = "owner@example.test")
  @Before fun open() {
    db = Room.inMemoryDatabaseBuilder(RuntimeEnvironment.getApplication(), ContentDatabase::class.java).allowMainThreadQueries().build()
    db.calendar().connection(CalendarConnection(revision = 1, connected = true, subject = "subject", email = "owner@example.test"))
    managed = CalendarManagedStore(db) { now }; status = CalendarStatusStore(db) { now }
  }
  @After fun close() { db.close() }
  private fun id() = UUID.randomUUID().toString()
  private fun setup(): String {
    val preview = managed.previewSetup(emptyMap(), JSONArray().put(calendar.managedJson()), true, calendar.id)
    val id = id()
    managed.captureSetup(mapOf("kind" to "ConfirmManagedCalendarSetup", "operationId" to id, "previewId" to preview["previewId"], "selectedCalendarId" to calendar.id))
    return id
  }
  @Test fun launchIsPendingAndCancellationSurvivesStoreRecreationWithoutChangingConnection() {
    val id = id(); val connection = db.calendar().connection()
    assertTrue(status.beginAuthorization(id, null)); assertFalse(status.beginAuthorization(id, null))
    assertEquals("AwaitingAuthorization", status.operation(id)!!["stage"])
    status.finishAuthorization(id, "Cancelled"); status.finishAuthorization(id, "Authorized")
    assertEquals("Cancelled", CalendarStatusStore(db) { now }.operation(id)!!["stage"])
    assertEquals(connection, db.calendar().connection())
    try { status.beginAuthorization(id, "other-operation"); fail() } catch (e: CalendarFailure) { assertEquals("OPERATION_REUSED", e.code) }
  }
  @Test fun sourceVerificationIsNotPausedMerelyBecausePermissionIsNotEffectiveYet() {
    val id = setup()
    assertEquals("CheckingCalendar", status.operation(id)!!["stage"])
    assertFalse(managed.active())
  }
  @Test fun finishedScanDoesNotClaimThatPendingCandidateImportsFinished() {
    val id = setup(); managed.acknowledgeCalendar(id, calendar); managed.completeSetup(id)
    val event = JSONObject().put("id", "future").put("etag", "v1").put("summary", "Private title")
      .put("start", JSONObject().put("dateTime", Instant.ofEpochMilli(now + 60_000).toString()).put("timeZone", "UTC"))
      .put("end", JSONObject().put("dateTime", Instant.ofEpochMilli(now + 120_000).toString()).put("timeZone", "UTC"))
    val candidate = managed.candidateObservation(event)!!
    assertEquals("CheckingEvents", status.operation(id)!!["stage"])
    managed.collectionCompleted(CalendarSyncCursor("query", "subject", calendar.id, paging = false))
    assertEquals("Ready", managed.binding().phase)
    assertEquals("AddingReminders", status.operation(id)!!["stage"])
    assertEquals(1, status.progress()["pending"])
    db.managedCalendar().candidate(candidate.copy(state = "Review", reason = "ElapsedAlert"))
    assertEquals("NeedsReview", status.operation(id)!!["stage"])
    assertEquals(1, status.progress()["review"])
    assertFalse(JSONObject(status.operation(id)!!).toString().contains("Private title"))
  }
  @Test fun accessRecoveryKeepsTheSameCapturedRequestAndUnknownCreationRequiresInspection() {
    val id = setup()
    managed.setupFailed(id, "NEEDS_ACCESS")
    assertEquals("NeedsAccess", status.operation(id)!!["stage"])
    assertEquals("Authorize", status.operation(id)!!["action"])
    managed.setupFailed(id, "CREATION_UNCONFIRMED")
    assertEquals("InspectCreation", status.operation(id)!!["action"])
    assertEquals(id, managed.binding().operationId)
  }
  @Test fun newBindingCannotExposeOldScopeProgress() {
    val id = setup()
    db.managedCalendar().binding(managed.binding().copy(authEpoch = managed.binding().authEpoch + 1))
    assertEquals("Cancelled", status.operation(id)!!["stage"])
    assertEquals(false, status.operation(id)!!["currentScope"])
  }
  @Test fun legacyResumeReceiptDoesNotInventSuccessfulBatchCompletion() {
    val id = id()
    db.managedCalendar().receipt(CalendarManagedReceipt(id, "ResumeManagedCalendar", "old-request", "{}"))
    assertEquals("NeedsReview", status.operation(id)!!["stage"])
    assertEquals(false, status.operation(id)!!["correlationComplete"])
  }
  @Test fun reconnectingOriginalAccountReturnsToReviewWithoutRestoringPermission() {
    val id = setup(); managed.acknowledgeCalendar(id, calendar); managed.completeSetup(id)
    managed.accessChanged("NEEDS_ACCESS")
    val epoch = managed.binding().authEpoch
    assertEquals("Connect", status.problem()!!["action"])
    CalendarStore(db, { now }).connect(CalendarAccount("subject", "owner@example.test", true), db.calendar().connection()!!.revision)
    assertEquals("Reviewing", managed.binding().phase)
    assertEquals(epoch, managed.binding().authEpoch)
    assertFalse(managed.active())
  }
  @Test fun currentManagedScopeProgressRemainsReadableAcrossReviewedPauseAndResume() {
    val id = setup(); managed.acknowledgeCalendar(id, calendar); managed.completeSetup(id)
    val saved = managed.binding()
    db.managedCalendar().binding(saved.copy(mode = "Paused", authEpoch = saved.authEpoch + 1))
    assertEquals("Paused", status.operation(id)!!["stage"])
    db.managedCalendar().binding(saved.copy(mode = "Enabled", authEpoch = saved.authEpoch + 2))
    assertEquals("CheckingEvents", status.operation(id)!!["stage"])
  }
  @Test fun laterDirtyEditsAreNotHiddenByImportProvenanceAndReviewsCountOnce() {
    val id = setup(); managed.acknowledgeCalendar(id, calendar); managed.completeSetup(id)
    val candidate = CalendarManagedCandidate("candidate", "remote", "subject", calendar.id, "event", "local", 1, "Alarm", "fingerprint", "", "Private title", state = "Imported", operationId = "old-import", observedAtMs = now)
    db.managedCalendar().candidate(candidate)
    db.links().put(CalendarLink("local", "remote", "subject", calendar.id, "event", "Remilo", "Imported"))
    db.sync().put(CalendarSyncState("local", mode = "Automatic", dirtyRevision = 2, operationId = "old-import", status = "UpdatePending"))
    assertEquals(1, status.progress()["pending"])
    db.managedCalendar().candidate(candidate.copy(state = "Review"))
    db.sync().put(CalendarSyncState("local", mode = "Automatic", status = "Review"))
    assertEquals(1, status.progress()["review"])
  }
}

package com.remilo.alarm.calendar

import android.app.Application
import androidx.room.Room
import com.remilo.alarm.data.*
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Before
import org.junit.After
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import java.time.Instant
import java.util.UUID

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34], application = Application::class)
class CalendarPublicationTest {
  private lateinit var db: ContentDatabase
  private lateinit var store: CalendarStore
  private lateinit var fake: FakeTransport
  private val clock = 1_800_000_000_000L
  private val record get() = db.records().find("one")!!
  private val access = object : CalendarStateAccess {
    override fun <T> access(write: Boolean, block: (CalendarStore) -> T): T = block(store)
  }
  @Before fun setup() {
    db = Room.inMemoryDatabaseBuilder(RuntimeEnvironment.getApplication(), ContentDatabase::class.java).allowMainThreadQueries().build()
    db.records().insert(ReminderRecord("one", "计划 ☀️", clock, clock + 1_800_000, clock + 3_600_000, clock - 1,
      notes = "Long private notes 中文\n".repeat(1000), definedAlarmAtMs = clock + 7_200_000, dueLinked = false, alarmLinked = false))
    store = CalendarStore(db, { clock }, { "America/Los_Angeles" })
    store.connect(CalendarAccount("subject", "tester@example.test"), 0)
    store.select(UUID.randomUUID().toString(), 1, "subject", OwnedCalendar("owned", "Test", "UTC"))
    fake = FakeTransport()
  }
  @After fun teardown() { db.close() }
  private fun command(op: String = UUID.randomUUID().toString()): Map<String, Any?> = store.preview("one").let {
    mapOf("operationId" to op, "occurrenceId" to "one", "expectedRevision" to it["reminderRevision"],
      "expectedConnectionRevision" to it["connectionRevision"], "fingerprint" to it["fingerprint"])
  }
  private fun capture(): CalendarOperation { val cmd = command(); store.capture(cmd); return store.operation(cmd["operationId"] as String)!! }
  private fun publish(job: CalendarOperation) { val started = store.begin(job.operationId); if (started != null) CalendarPublisher(access, fake).publish(started, "transient-token") }
  private fun failure(code: String, body: () -> Unit) {
    try { body(); fail("Expected $code") } catch (error: CalendarFailure) { assertEquals(code, error.code) }
  }
  @Test fun immutableCapturePinsZonePreservingIndependentInstantsAndLocalActions() {
    val before = record; val job = capture(); val after = record
    assertEquals("America/Los_Angeles", after.zoneId); assertEquals(before.revision + 1, after.revision)
    assertEquals(before.copy(zoneId = after.zoneId, revision = after.revision), after)
    val payload = JSONObject(job.payload)
    assertEquals(before.title, payload.getString("summary")); assertEquals(before.notes, payload.getString("description"))
    assertFalse(payload.getJSONObject("reminders").getBoolean("useDefault")); assertEquals(0, payload.getJSONObject("reminders").getJSONArray("overrides").length())
    assertEquals("private", payload.getString("visibility")); assertEquals("opaque", payload.getString("transparency")); assertFalse(payload.has("attendees"))
    assertFalse(payload.has("dueAtMs")); assertFalse(store.view(job).containsKey("payload"))
    assertEquals(before.eventStartMs, java.time.OffsetDateTime.parse(payload.getJSONObject("start").getString("dateTime")).toInstant().toEpochMilli())
  }
  @Test fun stableIdentityUsesCanonicalVersionedTupleAndAllowedHexAlphabet() {
    val id = CalendarMapper.eventId("a", "b", "c")
    assertTrue(id.matches(Regex("[0-9a-f]{32}"))); assertEquals(id, CalendarMapper.eventId("a", "b", "c"))
    assertNotEquals(id, CalendarMapper.eventId("a", "bc", "")); assertNotEquals(id, CalendarMapper.eventId("other", "b", "c"))
  }
  @Test fun ownedDiscoveryFiltersEveryEntryAndRetainsPaginationCursor() {
    val page = GoogleCalendarTransport().page(JSONObject("""{"items":[{"id":"reader","accessRole":"reader"},{"id":"writer","accessRole":"writer"},{"id":"deleted","accessRole":"owner","deleted":true},{"id":"owned","accessRole":"owner","summary":"Original","summaryOverride":"Display","timeZone":"UTC"}],"nextPageToken":"opaque-page"}"""))
    assertEquals(listOf("owned"), page.items.map { it.id }); assertEquals("Display", page.items.single().name); assertEquals("opaque-page", page.nextCursor)
    assertNull(GoogleCalendarTransport().page(JSONObject()).nextCursor)
  }
  @Test fun allDayUsesExclusiveDateAcrossDst() {
    val start = Instant.parse("2026-03-08T08:00:00Z").toEpochMilli()
    val end = Instant.parse("2026-03-09T07:00:00Z").toEpochMilli()
    val value = CalendarMapper.fields(record.copy(eventStartMs = start, eventEndMs = end, allDay = true), "America/Los_Angeles")
    assertEquals("2026-03-08", value.getJSONObject("start").getString("date")); assertEquals("2026-03-09", value.getJSONObject("end").getString("date"))
    assertFalse(value.getJSONObject("start").has("dateTime")); assertFalse(value.getJSONObject("end").has("timeZone"))
  }
  @Test fun timedMappingPreservesGapAndBothFoldInstants() {
    listOf("2026-03-08T10:30:00Z", "2026-11-01T08:30:00Z", "2026-11-01T09:30:00Z").forEach {
      val instant = Instant.parse(it); val mapped = CalendarMapper.fields(record.copy(eventStartMs = instant.toEpochMilli(), eventEndMs = instant.toEpochMilli() + 1_800_000), "America/Los_Angeles")
      assertEquals(instant, java.time.OffsetDateTime.parse(mapped.getJSONObject("start").getString("dateTime")).toInstant())
      assertEquals("America/Los_Angeles", mapped.getJSONObject("end").getString("timeZone"))
    }
  }
  @Test fun fixedOffsetCannotMasqueradeAsNamedZone() {
    failure("INVALID_ZONE") { CalendarMapper.fields(record, "+01:00") }
  }
  @Test fun staleReminderOrConnectionOrFloatingDeviceZoneRequiresNewPreview() {
    val old = command(); db.records().update(record.copy(revision = record.revision + 1)); failure("STALE_PREVIEW") { store.capture(old) }
    val next = command(); store.select(UUID.randomUUID().toString(), 2, "subject", OwnedCalendar("other", "Other", "UTC"))
    failure("STALE_PREVIEW") { store.capture(next) }
    val floating = command(); store = CalendarStore(db, { clock }, { "Asia/Tokyo" }); failure("STALE_PREVIEW") { store.capture(floating) }
    assertTrue(db.calendar().operations().isEmpty())
  }
  @Test fun terminalAndRecurringRecordsCannotStartPublication() {
    val original = record
    listOf(original.copy(deleted = true), original.copy(completed = true), original.copy(skipped = true), original.copy(segmentId = "repeat")).forEach {
      db.records().update(it); failure("INELIGIBLE") { store.preview("one") }
    }
  }
  @Test fun duplicateCommandReturnsCapturedJobAndRejectsReplacement() {
    val cmd = command(); store.capture(cmd); db.records().update(record.copy(title = "Edited", revision = record.revision + 1))
    store.capture(cmd); assertEquals(1, store.publications().size)
    failure("ALREADY_PUBLISHED") { store.preview("one") }
    failure("OPERATION_REUSED") { store.capture(cmd + ("fingerprint" to "replacement")) }
  }
  @Test fun processDeathBeforeSendingRetainsManualJobWithoutWrites() {
    val job = capture(); store = CalendarStore(db, { clock }); assertEquals("Waiting", store.operation(job.operationId)!!.state); assertEquals(0, fake.posts)
    store.begin(job.operationId); store = CalendarStore(db, { clock }); assertEquals("Unconfirmed", store.operation(job.operationId)!!.state); assertEquals(0, fake.posts)
  }
  @Test fun lostResponseReconcilesSameEventWithoutSecondInsert() {
    val job = capture(); fake.loseReply = true; publish(job); assertEquals("Unconfirmed", store.operation(job.operationId)!!.state)
    store = CalendarStore(db, { clock }); publish(job); assertEquals("Published", store.operation(job.operationId)!!.state); assertEquals(1, fake.posts)
  }
  @Test fun remoteCreationBeforeLocalAcknowledgementIsRecognizedWithoutOverwrite() {
    val job = capture(); fake.remote = JSONObject(job.payload).put("summary", "Remote edit"); publish(job)
    assertEquals("Published", store.operation(job.operationId)!!.state); assertEquals("Remote edit", fake.remote!!.getString("summary")); assertEquals(0, fake.posts)
  }
  @Test fun duplicateIdResponseReconcilesExactIdentity() {
    val job = capture(); fake.duplicate = true; publish(job); assertEquals("Published", store.operation(job.operationId)!!.state); assertEquals(1, fake.posts)
  }
  @Test fun foreignIdentityAndCancelledEventAreConflictsWithoutWrites() {
    val job = capture(); fake.remote = JSONObject().put("id", job.eventId); publish(job); assertEquals("Conflict", store.operation(job.operationId)!!.state); assertEquals(0, fake.posts)
    db.calendar().update(job); fake.remote = JSONObject(job.payload).put("status", "cancelled"); publish(job); assertEquals("Conflict", store.operation(job.operationId)!!.state)
  }
  @Test fun confirmedSuccessCannotBeDowngradedByLateFailure() {
    val job = capture(); publish(job); store.fail(job.operationId, "NETWORK"); assertEquals("Published", store.operation(job.operationId)!!.state); assertEquals("", store.operation(job.operationId)!!.payload)
  }
  @Test fun defaultChangeNeverRetargetsCapturedPayloadOrDestination() {
    val job = capture(); store.select(UUID.randomUUID().toString(), 2, "subject", OwnedCalendar("new", "New", "UTC")); publish(job)
    assertEquals("owned", fake.sentCalendar); assertEquals(job.eventId, fake.remote!!.getString("id"))
  }
  @Test fun switchedAccountStopsRecoveryUntilOriginalAccountIsAuthorized() {
    val job = capture(); store.connect(CalendarAccount("other", "other@example.test"), 2); publish(job)
    assertEquals("NeedsAccess", store.operation(job.operationId)!!.state); assertEquals(0, fake.posts)
    store.connect(CalendarAccount("subject", "tester@example.test"), 3); publish(job); assertEquals("Published", store.operation(job.operationId)!!.state)
  }
  @Test fun tokenAccountMismatchAndOwnershipLossNeverInsert() {
    val job = capture(); fake.subject = "foreign"; publish(job); assertEquals("NeedsAccess", store.operation(job.operationId)!!.state)
    fake.subject = "subject"; fake.role = "reader"; publish(job); assertEquals("Failed", store.operation(job.operationId)!!.state); assertEquals(0, fake.posts)
  }
  @Test fun trashCancelsUnsentJobAndPurgeErasesCapturedPrivateMetadata() {
    val job = capture(); store.removed("one", false); assertEquals("Cancelled", store.operation(job.operationId)!!.state); assertEquals("", store.operation(job.operationId)!!.payload)
    publish(job); assertEquals(0, fake.posts); store.removed("one", true)
    val minimal = store.operation(job.operationId)!!; assertEquals("", minimal.email); assertEquals("", minimal.zoneId); assertEquals("", minimal.calendarName); assertEquals(job.eventId, minimal.eventId)
  }
  @Test fun restoredUnsentReminderCanCaptureNewReviewWithSameRemoteIdentity() {
    val cancelled = capture(); store.removed("one", false)
    val replacement = capture(); assertEquals(cancelled.eventId, replacement.eventId)
    publish(replacement); assertEquals(1, fake.posts); assertEquals("Published", store.operation(replacement.operationId)!!.state)
  }
  @Test fun deletionAfterWriteRetainsReadOnlyReconciliationAndLateSuccess() {
    val job = capture(); fake.loseReply = true; publish(job); store.removed("one", true)
    publish(store.operation(job.operationId)!!); assertEquals("Published", store.operation(job.operationId)!!.state); assertEquals(1, fake.posts)
    assertEquals("", store.operation(job.operationId)!!.htmlLink); assertEquals("", store.operation(job.operationId)!!.etag)
  }
  @Test fun purgedRecoveryChoosesAnAccountWithoutRestoringErasedEmailOrRetargetingIdentity() {
    val job = capture(); store.begin(job.operationId); store.permitInsert(job.operationId); store.removed("one", true)
    assertEquals("tester@example.test", store.authorizationEmail(job.operationId))
    store.connect(CalendarAccount("foreign", "foreign@example.test"), 2)
    assertNull(store.authorizationEmail(job.operationId)); assertNull(store.authorizationEmail(null))
    assertEquals("subject", store.operation(job.operationId)!!.subject); assertEquals("", store.operation(job.operationId)!!.email)
  }
  @Test fun missingIdentityAfterPurgeCannotRecreateRemoteCopy() {
    val job = capture(); store.begin(job.operationId); store.permitInsert(job.operationId); store.removed("one", true); publish(job.copy(readOnly = true, payload = ""))
    assertEquals("Conflict", store.operation(job.operationId)!!.state); assertEquals(0, fake.posts)
  }
  @Test fun localEditReportsDifferenceAndLocalCompletionDoesNotChangeRemoteCopy() {
    val job = capture(); publish(job); val remote = fake.remote.toString()
    db.records().update(record.copy(title = "Changed", completed = true, revision = record.revision + 1))
    assertEquals(true, store.publication("one")!!["differs"]); publish(job); assertEquals(remote, fake.remote.toString())
  }
  @Test fun disconnectReceiptCannotRevokeNewlyConnectedAccountOnRetry() {
    val op = UUID.randomUUID().toString(); assertNotNull(store.disconnect(op, 2)); store.connect(CalendarAccount("new", "new@example.test"), 3)
    assertNull(store.disconnect(op, 2)); assertEquals("new", store.connection().subject)
  }
  @Test fun staleAccountCallbackDoesNotReplaceConfirmedConfiguration() {
    failure("STALE_CONNECTION") { store.connect(CalendarAccount("foreign", "foreign@example.test"), 0) }
    assertEquals("subject", store.connection().subject); assertEquals("owned", store.connection().calendarId)
  }
  @Test fun partialConsentRejectsWithoutChangingConfirmedAccountAndAcceptsEmailAlias() {
    val before = store.connection()
    failure("NEEDS_ACCESS") { CalendarConsent.requireGranted(listOf("openid", "email")) }
    assertEquals(before, store.connection())
    CalendarConsent.requireGranted(CalendarConsent.required.map { if (it == "email") "https://www.googleapis.com/auth/userinfo.email" else it })
  }
  @Test fun runnerBoundsTransientRetriesAndAuthorizationFailuresRemainRecoverable() {
    val job = capture(); fake.error = "RETRY"; val auth = FakeAuthorization()
    CalendarRunner(access, fake, auth).run(job.operationId); assertEquals(2, fake.reads); assertEquals("Unconfirmed", store.operation(job.operationId)!!.state)
    auth.error = "NEEDS_ACCESS"; CalendarRunner(access, fake, auth).run(job.operationId); assertEquals("NeedsAccess", store.operation(job.operationId)!!.state)
    auth.error = null; fake.error = "AUTH"; CalendarRunner(access, fake, auth).run(job.operationId); assertEquals(1, auth.cleared)
  }
  private class FakeAuthorization : CalendarAuthorization {
    var error: String? = null; var cleared = 0
    override fun token(email: String): String { error?.let { throw CalendarFailure(it) }; return "fake-transient-token" }
    override fun clear(token: String) { cleared++ }
    override fun revoke(email: String) {}
  }
  private class FakeTransport : CalendarTransport {
    var remote: JSONObject? = null; var posts = 0; var reads = 0; var subject = "subject"; var role = "owner"
    var loseReply = false; var duplicate = false; var error: String? = null; var sentCalendar = ""
    override fun account(token: String) = CalendarAccount(subject, "tester@example.test")
    override fun calendars(token: String, cursor: String?) = CalendarPage(emptyList(), null)
    override fun calendar(token: String, id: String) = OwnedCalendar(id, "Test", "UTC", role)
    override fun event(token: String, calendarId: String, eventId: String): JSONObject? { reads++; error?.let { throw CalendarFailure(it) }; return remote }
    override fun insert(token: String, calendarId: String, payload: String): JSONObject {
      posts++; sentCalendar = calendarId; remote = JSONObject(payload).put("htmlLink", "https://calendar.google.com/calendar/event?eid=fixture")
      if (duplicate) throw CalendarFailure("DUPLICATE")
      if (loseReply) throw CalendarFailure("NETWORK")
      return remote!!
    }
  }
}

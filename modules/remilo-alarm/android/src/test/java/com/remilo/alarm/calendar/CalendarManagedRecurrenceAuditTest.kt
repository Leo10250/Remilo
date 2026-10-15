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
import java.time.LocalDate
import java.time.OffsetDateTime

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34], application = Application::class)
class CalendarManagedRecurrenceAuditTest {
  private lateinit var db: ContentDatabase
  private lateinit var store: CalendarStore
  private var now = Instant.parse("2027-01-01T12:00:00Z").toEpochMilli()
  private var allDay = false
  private var wrongOrdinaryTime = false
  private var reads = 0
  private var onRead: (() -> Unit)? = null
  private val remote = mutableMapOf<String, JSONObject>()
  private val calendar = OwnedCalendar("source", "Remilo", "UTC", dataOwner = "verified@example.test")
  private val access = object : CalendarStateAccess {
    override fun <T> access(write: Boolean, block: (CalendarStore) -> T): T = block(store)
  }
  private val transport = object : CalendarTransport {
    override fun account(token: String) = CalendarAccount("subject", "verified@example.test")
    override fun calendars(token: String, cursor: String?) = throw AssertionError("Recurrence audit must not discover calendars")
    override fun calendar(token: String, id: String) = calendar
    override fun event(token: String, calendarId: String, eventId: String): JSONObject? {
      reads++; onRead?.invoke(); return remote[eventId]?.let { JSONObject(it.toString()) }
    }
    override fun instance(token: String, calendarId: String, masterId: String, originalStart: String): JSONObject {
      reads++; onRead?.invoke()
      val start = if (allDay) LocalDate.parse(originalStart).atStartOfDay(java.time.ZoneOffset.UTC).toInstant()
        else OffsetDateTime.parse(originalStart).toInstant()
      return instance("ordinary-${CalendarMapper.hash(originalStart).take(10)}", start,
        start.plusSeconds(if (wrongOrdinaryTime) 3_600 else 0))
    }
    override fun insert(token: String, calendarId: String, payload: String): JSONObject = throw AssertionError("Audit never writes Google")
    override fun syncEvents(token: String, calendarId: String, syncToken: String?, pageToken: String?): JSONObject = throw AssertionError("Audit never rescans collection")
  }
  @Before fun setup() {
    db = Room.inMemoryDatabaseBuilder(RuntimeEnvironment.getApplication(), ContentDatabase::class.java).allowMainThreadQueries().build()
    store = CalendarStore(db, { now }, { "UTC" }); store.connect(CalendarAccount("subject", "verified@example.test"), 0)
    store.managed.dao.binding(CalendarManagedBinding(authEpoch = 1, subject = "subject", calendarId = "source", calendarName = "Remilo",
      calendarZone = "UTC", mode = "Enabled", phase = "Ready", bootstrapGeneration = 1, initialRecoveryComplete = true))
    db.sync().cursor(CalendarSyncCursor(CalendarLinkMapper.key("subject", "source", "sync-query-v1"), "subject", "source", syncToken = "completed"))
  }
  @After fun close() { db.close() }
  private fun master(start: String = "2027-01-02T09:00:00Z", count: Int? = null): JSONObject {
    val instant = Instant.parse(start)
    return JSONObject().put("id", "master").put("etag", "master-version").put("status", "confirmed").put("summary", "Recurring work")
      .put("start", bound(instant)).put("end", bound(instant.plusSeconds(if (allDay) 86_400 else 1_800)))
      .put("recurrence", JSONArray().put("RRULE:FREQ=DAILY" + (count?.let { ";COUNT=$it" } ?: "")))
  }
  private fun bound(value: Instant) = if (allDay) JSONObject().put("date", value.atOffset(java.time.ZoneOffset.UTC).toLocalDate().toString())
    else JSONObject().put("dateTime", value.toString()).put("timeZone", "UTC")
  private fun instance(id: String, nominal: Instant, actual: Instant = nominal): JSONObject = JSONObject().put("id", id).put("etag", "instance-version")
    .put("status", "confirmed").put("summary", "Recurring work").put("recurringEventId", "master").put("originalStartTime", bound(nominal))
    .put("start", bound(actual)).put("end", bound(actual.plusSeconds(if (allDay) 86_400 else 1_800)))
  private fun observe(source: JSONObject, mode: String = "None"): CalendarManagedCandidate {
    val value = store.managed.candidateObservation(source)!!.copy(mode = mode)
    store.managed.dao.candidate(value); return value
  }
  private fun cache(value: JSONObject) {
    remote[value.getString("id")] = JSONObject(value.toString())
    store.managed.dao.cache(CalendarManagedCache("subject", "source", value.getString("id"), 1, value.toString(), now))
  }
  private fun inspect(candidate: CalendarManagedCandidate, source: JSONObject) = CalendarManagedRecurrenceAudit(access, transport, { now })
    .inspect("synthetic", candidate, calendar, source)
  private fun failure(code: String, block: () -> Unit) {
    try { block(); fail("Expected $code") } catch (error: CalendarFailure) { assertEquals(code, error.code) }
  }
  @Test fun sevenExceptionsCheckpointSixReadsAndResumeAfterRestartWithoutRescanningCollection() {
    val source = master(); val candidate = observe(source)
    for (day in 2..8) cache(instance("exception-$day", Instant.parse("2027-01-${day.toString().padStart(2, '0')}T09:00:00Z")))
    assertNull(inspect(candidate, source)); assertEquals(6, reads)
    assertEquals(6, JSONObject(store.managed.candidate(candidate.candidateId)!!.audit).getInt("nextCacheIndex"))
    store = CalendarStore(db, { now }, { "UTC" })
    val completed = inspect(candidate, source)!!
    assertEquals(7, completed.getJSONArray("remiloInstances").length()); assertEquals(10, reads)
    assertNotNull(inspect(candidate, source)); assertEquals(10, reads)
  }
  @Test fun finitePastMasterRetainsItsMovedFutureExceptionAndChecksOriginalCountMembership() {
    val source = master("2026-12-29T09:00:00Z", 2); val candidate = observe(source)
    cache(instance("moved", Instant.parse("2026-12-30T09:00:00Z"), Instant.parse("2027-01-03T15:00:00Z")))
    val completed = inspect(candidate, source)!!
    assertEquals("2026-12-30T09:00", completed.getJSONArray("remiloInstances").getJSONObject(0).getString("nominalSlot"))
    assertEquals(1, reads)
  }
  @Test fun exceptionOutsideFiniteCountCannotBeImportedEvenWhenMovedIntoTheFuture() {
    val source = master("2026-12-29T09:00:00Z", 2); val candidate = observe(source)
    cache(instance("foreign-slot", Instant.parse("2026-12-31T09:00:00Z"), Instant.parse("2027-01-03T15:00:00Z")))
    failure("INVALID_INSTANCE") { inspect(candidate, source) }; assertEquals(0, reads)
  }
  @Test fun exhaustedEndedFamilyWithoutFutureWorkIsExcludedWithoutGoogleInstanceReads() {
    val source = master("2026-12-29T09:00:00Z", 2)
    failure("NO_UPCOMING_WORK") { inspect(observe(source), source) }; assertEquals(0, reads)
  }
  @Test fun ongoingOrdinaryNoAlertOccurrenceIsAuditedAndReturnedWithoutBecomingAnException() {
    val source = master("2027-01-01T11:50:00Z", 1)
    val completed = inspect(observe(source), source)!!
    val row = completed.getJSONArray("remiloInstances").getJSONObject(0)
    assertFalse(row.getBoolean("exception")); assertFalse(row.getBoolean("cancelled"))
    assertEquals("2027-01-01T11:50", row.getString("nominalSlot")); assertEquals(1, reads)
  }
  @Test fun ongoingElapsedAlarmAndElapsedAllDayTargetRequireReviewWithoutChangingMode() {
    val source = master("2027-01-01T11:50:00Z", 1)
    val candidate = observe(source, "Alarm")
    failure("ELAPSED_ALERT") { inspect(candidate, source) }
    assertEquals("Alarm", store.managed.candidate(candidate.candidateId)!!.mode)
  }
  @Test fun configuredAllDayAlarmTimeIsUsedForOngoingEligibility() {
    allDay = true
    val source = master("2027-01-01T00:00:00Z", 1)
    val candidate = observe(source, "Alarm").copy(policySnapshot = JSONObject().put("allDayAlarmMinutes", 13 * 60).toString())
    store.managed.dao.candidate(candidate)
    assertNotNull(inspect(candidate, source))
  }
  @Test fun ordinaryExpansionMismatchRequiresReviewBeforeImportCapture() {
    wrongOrdinaryTime = true
    val source = master()
    failure("RECURRENCE_MISMATCH") { inspect(observe(source), source) }
    assertEquals(1, reads)
  }
  @Test fun authorityChangeDuringReadRejectsTheCheckpointAndCannotGrantAnImport() {
    val source = master(); val candidate = observe(source)
    onRead = { val old = store.managed.binding(); store.managed.dao.binding(old.copy(authEpoch = old.authEpoch + 1)); onRead = null }
    failure("STALE_PREVIEW") { inspect(candidate, source) }
    assertEquals("", store.managed.candidate(candidate.candidateId)!!.audit)
  }
  @Test fun incompleteOrExpiredGenerationNeverUsesOldCachedExceptions() {
    val source = master(); val candidate = observe(source)
    val old = store.incremental.cursor("source"); db.sync().cursor(old.copy(paging = true))
    assertNull(inspect(candidate, source)); assertEquals(0, reads)
  }
}

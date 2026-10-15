package com.remilo.alarm.calendar

import org.json.*
import org.junit.*
import org.junit.Assert.*
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34], application = android.app.Application::class)
class CalendarResourceRunnerTest {
  private fun event(id: String, title: String) = JSONObject().put("id", id).put("etag", "version").put("summary", title)
    .put("start", JSONObject().put("dateTime", "2027-01-04T09:00:00Z").put("timeZone", "UTC"))
    .put("end", JSONObject().put("dateTime", "2027-01-04T09:30:00Z").put("timeZone", "UTC"))
  private var remote = event("instance", "Old")
  private var patches = 0; private var lost = false; private var apply = true; private var permission = true
  private var job = CalendarResourceJob("parent", "slot", "family", "calendar", "instance", "version",
    CalendarLinkMapper.fields(event("instance", "New"), "UTC").toString(), "{\"summary\":\"New\"}")
  private val access = object : CalendarResourceAccess {
    override fun jobs(operationId: String) = listOf(job)
    override fun permit(job: CalendarResourceJob): CalendarResourceJob? = if (!permission) null else job.copy(attempted = true).also { this@CalendarResourceRunnerTest.job = it }
    override fun acknowledge(job: CalendarResourceJob, event: JSONObject) { this@CalendarResourceRunnerTest.job = this@CalendarResourceRunnerTest.job.copy(confirmed = true, outcome = "Confirmed") }
    override fun outcome(job: CalendarResourceJob, code: String) { this@CalendarResourceRunnerTest.job = this@CalendarResourceRunnerTest.job.copy(outcome = code, attempted = job.attempted) }
  }
  private val transport = object : CalendarTransport {
    override fun account(token: String) = CalendarAccount("subject", "test@example.test")
    override fun calendars(token: String, cursor: String?) = CalendarPage(emptyList(), null)
    override fun calendar(token: String, id: String) = OwnedCalendar(id, "Calendar", "UTC")
    override fun event(token: String, calendarId: String, eventId: String): JSONObject = JSONObject(remote.toString())
    override fun insert(token: String, calendarId: String, payload: String): JSONObject = throw AssertionError("An exception must patch its observed instance")
    override fun patch(token: String, calendarId: String, eventId: String, etag: String, payload: String): JSONObject {
      patches++; if (apply) remote.put("summary", JSONObject(payload).getString("summary")).put("etag", "new-version")
      if (lost) { lost = false; throw CalendarFailure("NETWORK") }; return JSONObject(remote.toString())
    }
  }
  @Test fun lostReplyInspectsSameInstanceAndNeverReplaysConfirmedPatch() {
    lost = true; val runner = CalendarResourceRunner(access, transport)
    assertFalse(runner.run("parent", "token", "UTC")); assertTrue(job.attempted); assertFalse(job.confirmed)
    assertTrue(runner.run("parent", "token", "UTC")); assertEquals(1, patches)
    assertTrue(runner.run("parent", "token", "UTC")); assertEquals(1, patches)
  }
  @Test fun unconfirmedUnmatchedOutcomeRequiresReviewRatherThanAnotherWrite() {
    lost = true; apply = false; val runner = CalendarResourceRunner(access, transport)
    assertFalse(runner.run("parent", "token", "UTC")); assertFalse(runner.run("parent", "token", "UTC"))
    assertEquals("UNCONFIRMED_RESOURCE", job.outcome); assertEquals(1, patches)
  }
  @Test fun lifecycleFenceAndCancellationNeverIssueAnInstanceWrite() {
    permission = false; assertFalse(CalendarResourceRunner(access, transport).run("parent", "token", "UTC")); assertEquals(0, patches)
    permission = true; remote.put("status", "cancelled")
    assertFalse(CalendarResourceRunner(access, transport).run("parent", "token", "UTC")); assertEquals("REMOTE_DELETED", job.outcome); assertEquals(0, patches)
  }
}

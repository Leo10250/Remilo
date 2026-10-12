package com.remilo.alarm.calendar

import org.json.JSONObject

interface CalendarLinkAccess {
  fun <T> links(write: Boolean = false, block: (CalendarLinkStore) -> T): T
  fun local(operationId: String, connectionRevision: Long): Map<String, Any?>
}

/** One approved operation; all network waits are outside the engine worker. */
class CalendarLinkRunner(private val state: CalendarLinkAccess, private val transport: CalendarTransport) {
  fun run(id: String, token: String, executionRevision: Long? = null) {
    try {
      var job = state.links { it.operation(id) } ?: throw CalendarFailure("NOT_FOUND")
      if (job.state in CalendarLinkStore.terminal || job.erased) return
      val connection = state.links { it.connection() }
      val revision = executionRevision ?: connection.revision
      if (!connection.connected || connection.subject != job.subject) throw CalendarFailure("NEEDS_ACCESS")
      if (connection.revision != revision) throw CalendarFailure("STALE_CONNECTION")
      if (transport.account(token).subject != job.subject) throw CalendarFailure("ACCOUNT_MISMATCH")
      val calendar = transport.calendar(token, job.calendarId)
      if (calendar.accessRole != "owner") throw CalendarFailure("NOT_OWNER")
      val event = transport.event(token, job.calendarId, job.eventId) ?: throw CalendarFailure("REMOTE_REMOVED")
      if (event.optString("id") != job.eventId) throw CalendarFailure("FOREIGN_IDENTITY")
      if (job.origin == "Published" && !CalendarMapper.matching(event, job.eventId)) throw CalendarFailure("FOREIGN_IDENTITY")
      val remote = CalendarLinkMapper.fields(event, calendar.zoneId)
      // A lost PATCH reply is acknowledged by the intended fields, never by etag alone.
      if (job.localApplied && job.remoteAttempted && matches(job, event, remote)) {
        state.links(true) { it.complete(id, event) }; return
      }
      if (event.optString("etag") != job.etag) throw CalendarFailure("STALE_REMOTE")
      if (!CalendarLinkMapper.equal(remote, JSONObject(job.remote))) throw CalendarFailure("STALE_REMOTE")
      state.links { it.check(job, revision) }
      state.local(id, revision)
      job = state.links { it.operation(id) } ?: throw CalendarFailure("NOT_FOUND")
      if (job.patch == "{}") { state.links(true) { it.complete(id, event) }; return }
      job = state.links(true) { it.permit(id, revision) }
      val result = transport.patch(token, job.calendarId, job.eventId, job.etag, job.patch)
      if (result.optString("id") != job.eventId || job.origin == "Published" && !CalendarMapper.matching(result, job.eventId))
        throw CalendarFailure("FOREIGN_IDENTITY")
      val fields = CalendarLinkMapper.fields(result, calendar.zoneId)
      if (!matches(job, result, fields)) throw CalendarFailure("STALE_REMOTE")
      state.links(true) { it.complete(id, result) }
    } catch (error: CalendarFailure) { state.links(true) { it.fail(id, error.code) } }
    catch (_: IllegalArgumentException) { state.links(true) { it.fail(id, "INVALID_INPUT") } }
    catch (_: Exception) { state.links(true) { it.fail(id, "NETWORK") } }
  }
  private fun matches(job: CalendarLinkOperation, event: JSONObject, fields: JSONObject): Boolean {
    val target = JSONObject(if (job.kind == "ImportCalendarEvent") job.remote else job.desired)
    return CalendarLinkMapper.equal(fields, target) && (!job.disableReminders ||
      event.optJSONObject("reminders")?.let { !it.optBoolean("useDefault", true) && (it.optJSONArray("overrides")?.length() ?: 0) == 0 } == true)
  }
}

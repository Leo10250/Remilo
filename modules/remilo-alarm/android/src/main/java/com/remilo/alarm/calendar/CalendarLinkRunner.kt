package com.remilo.alarm.calendar

import org.json.JSONObject

interface CalendarLinkAccess {
  fun <T> links(write: Boolean = false, block: (CalendarLinkStore) -> T): T
  fun local(operationId: String, connectionRevision: Long): Map<String, Any?>
}

/** One approved operation; all network waits are outside the engine worker. */
class CalendarLinkRunner(private val state: CalendarLinkAccess, private val transport: CalendarTransport, private val inspectRecurring: Boolean = false,
  private val background: Boolean = false) {
  fun run(id: String, token: String, executionRevision: Long? = null) {
    var observation: CalendarObservationGuard? = null
    var writing = false
    try {
      var job = state.links { it.operation(id) } ?: throw CalendarFailure("NOT_FOUND")
      if (job.state in CalendarLinkStore.terminal || job.erased) return
      observation = state.links { if (it.link(job.occurrenceId) != null) it.guard(job.occurrenceId) else null }
      val connection = state.links { it.connection() }
      val revision = executionRevision ?: connection.revision
      if (!connection.connected || connection.subject != job.subject) throw CalendarFailure("NEEDS_ACCESS")
      if (connection.revision != revision) throw CalendarFailure("STALE_CONNECTION")
      if (transport.account(token).subject != job.subject) throw CalendarFailure("ACCOUNT_MISMATCH")
      val calendar = transport.calendar(token, job.calendarId)
      if (calendar.accessRole != "owner") throw CalendarFailure("NOT_OWNER")
      val lookup = transport.lookup(token, job.calendarId, job.eventId)
      val rawEvent = when (lookup) {
        is CalendarEventLookup.Found -> lookup.event
        CalendarEventLookup.Missing -> throw CalendarFailure("REMOTE_UNAVAILABLE")
        CalendarEventLookup.Deleted -> throw CalendarFailure("REMOTE_DELETED")
      }
      var event = if (inspectRecurring && rawEvent.has("recurrence")) transport.inspectRecurring(token, calendar, rawEvent) else rawEvent
      event = state.links { it.normalizeEvent(job.occurrenceId, event) }
      if (inspectRecurring && event.has("recurrence")) {
        val children = state.links { it.resources(job.occurrenceId).filter { row -> row.resourceId != "master" && row.nominalSlot.isEmpty() } }
        val snapshots = children.map { child ->
          val found = (transport.lookup(token, child.calendarId, child.eventId) as? CalendarEventLookup.Found)?.event ?: throw CalendarFailure("REMOTE_UNAVAILABLE")
          if (!CalendarMapper.matching(found, child.eventId)) throw CalendarFailure("FOREIGN_IDENTITY")
          CalendarLinkMapper.fields(transport.inspectRecurring(token, calendar, found), calendar.zoneId)
        }.sortedBy { it.getJSONObject("schedule").getLong("eventStartMs") }
        event.put("remiloSegments", org.json.JSONArray(snapshots))
      }
      observation?.let { guard -> state.links(true) { it.observe(guard, calendar, CalendarEventLookup.Found(event), background) } }
      if (event.optString("id") != job.eventId) throw CalendarFailure("FOREIGN_IDENTITY")
      if (job.origin == "Published" && !CalendarMapper.matching(event, job.eventId)) throw CalendarFailure("FOREIGN_IDENTITY")
      val remote = CalendarLinkMapper.fields(event, calendar.zoneId)
      val resources = CalendarResourceRunner(object : CalendarResourceAccess {
        override fun jobs(operationId: String) = state.links { it.resourceJobs(operationId) }
        override fun permit(job: CalendarResourceJob) = state.links(true) { it.permitResource(job, revision) }
        override fun acknowledge(job: CalendarResourceJob, event: JSONObject) = state.links(true) { it.acknowledgeResource(job, event) }
        override fun outcome(job: CalendarResourceJob, code: String) = state.links(true) { it.resourceOutcome(job, code) }
        override fun bind(job: CalendarResourceJob, event: JSONObject, zone: String) = state.links(true) { it.bindResource(job, event, zone, revision) }
        override fun rebase(job: CalendarResourceJob, event: JSONObject) = state.links(true) { it.rebaseResource(job, event, revision) }
      }, transport)
      fun complete(result: JSONObject) {
        state.links(true) { it.acknowledgeMain(id, result) }
        if (!resources.run(id, token, calendar.zoneId)) {
          state.links(true) { store -> store.fail(id, store.resourceJobs(id).firstOrNull { !it.confirmed }?.outcome ?: "UNCONFIRMED_RESOURCE", background) }
          return
        }
        state.links(true) { it.complete(id, result) }
      }
      // A lost PATCH reply is acknowledged by the intended fields, never by etag alone.
      if (job.localApplied && job.remoteAttempted && matches(job, event, remote)) {
        complete(event); return
      }
      if (job.remoteAttempted) throw CalendarFailure("UNCONFIRMED_WRITE")
      if (job.patch.isBlank()) throw CalendarFailure("INELIGIBLE")
      if (event.optString("etag") != job.etag) throw CalendarFailure("STALE_REMOTE")
      if (!CalendarLinkMapper.equal(remote, JSONObject(job.remote))) throw CalendarFailure("STALE_REMOTE")
      state.links { it.check(job, revision) }
      state.local(id, revision)
      job = state.links { it.operation(id) } ?: throw CalendarFailure("NOT_FOUND")
      observation = state.links { it.guard(job.occurrenceId) }
      if (job.patch == "{}") { complete(event); return }
      job = state.links(true) { it.permit(id, revision) }
      writing = true
      val result = transport.patch(token, job.calendarId, job.eventId, job.etag, job.patch)
      if (result.optString("id") != job.eventId || job.origin == "Published" && !CalendarMapper.matching(result, job.eventId))
        throw CalendarFailure("FOREIGN_IDENTITY")
      val fields = CalendarLinkMapper.fields(result, calendar.zoneId)
      if (!matches(job, result, fields)) throw CalendarFailure("UNCONFIRMED_WRITE")
      complete(result)
    } catch (error: CalendarFailure) {
      observation?.let { guard ->
        try { state.links(true) { it.observedFailure(guard.id, error.code, guard, background) } }
        catch (_: CalendarFailure) { /* Lifecycle/connection changed: discard the stale observation. */ }
      }
      state.links(true) { it.fail(id, error.code, background, writing) }
    }
    catch (_: IllegalArgumentException) { state.links(true) { it.fail(id, "INVALID_INPUT", background) } }
    catch (_: Exception) { state.links(true) { it.fail(id, "NETWORK", background) } }
  }
  private fun matches(job: CalendarLinkOperation, event: JSONObject, fields: JSONObject): Boolean {
    val target = state.links { it.agreementTarget(job) }
    return CalendarLinkMapper.equal(CalendarLinkMapper.mainFields(fields), CalendarLinkMapper.mainFields(target)) && (!job.disableReminders ||
      event.optJSONObject("reminders")?.let { !it.optBoolean("useDefault", true) && (it.optJSONArray("overrides")?.length() ?: 0) == 0 } == true)
  }
}

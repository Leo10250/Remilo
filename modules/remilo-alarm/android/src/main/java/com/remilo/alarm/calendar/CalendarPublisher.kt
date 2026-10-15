package com.remilo.alarm.calendar

interface CalendarStateAccess {
  fun <T> access(write: Boolean = false, block: (CalendarStore) -> T): T
}

/** Runs only on the Calendar I/O executor; each state step returns to the single mutation owner. */
class CalendarPublisher(private val state: CalendarStateAccess, private val transport: CalendarTransport) {
  fun publish(job: CalendarOperation, token: String) {
    try {
      active(job)
      if (transport.account(token).subject != job.subject) throw CalendarFailure("ACCOUNT_MISMATCH")
      active(job)
      if (transport.calendar(token, job.calendarId).accessRole != "owner") throw CalendarFailure("NOT_OWNER")
      active(job)
      val existing = transport.event(token, job.calendarId, job.eventId)
      if (existing != null) { complete(job, token, existing); return }
      if (job.attempted && state.access { it.managed.intent(job.occurrenceId)?.operationId == job.operationId })
        throw CalendarFailure("UNCONFIRMED_RESOURCE")
      if (job.readOnly || job.payload.isBlank()) throw CalendarFailure("REMOTE_REMOVED")
      val permitted = state.access(true) { it.permitInsert(job.operationId) } ?: throw CalendarFailure("NEEDS_ACCESS")
      val result = try { transport.insert(token, permitted.calendarId, permitted.payload) }
      catch (error: CalendarFailure) {
        if (error.code != "DUPLICATE") throw error
        transport.event(token, permitted.calendarId, permitted.eventId) ?: throw CalendarFailure("RETRY")
      }
      complete(job, token, result)
    } catch (error: CalendarFailure) { state.access(true) { it.fail(job.operationId, error.code) } }
    catch (_: Exception) { state.access(true) { it.fail(job.operationId, "NETWORK") } }
  }
  private fun complete(job: CalendarOperation, token: String, event: org.json.JSONObject) {
    if (!CalendarMapper.matching(event, job.eventId) || event.optString("status") == "cancelled") {
      state.access(true) { it.confirm(job.operationId, event) }; return
    }
    if (state.access { it.managed.intent(job.occurrenceId)?.operationId == job.operationId } && job.payload.isNotBlank()) {
      val intended = CalendarLinkMapper.mainFields(CalendarLinkMapper.fields(org.json.JSONObject(job.payload), job.zoneId))
      val actual = CalendarLinkMapper.mainFields(CalendarLinkMapper.fields(event, job.zoneId))
      if (!CalendarLinkMapper.equal(intended, actual)) throw CalendarFailure("RESOURCE_CONFLICT")
    }
    val resources = CalendarResourceRunner(object : CalendarResourceAccess {
      override fun jobs(operationId: String) = state.access { it.publicationJobs(operationId) }
      override fun permit(job: CalendarResourceJob) = state.access(true) { it.permitResource(job) }
      override fun bind(job: CalendarResourceJob, event: org.json.JSONObject, zone: String) = state.access(true) { it.bindResource(job, event, zone) }
      override fun acknowledge(job: CalendarResourceJob, event: org.json.JSONObject) = state.access(true) { it.acknowledgeResource(job, event) }
      override fun outcome(job: CalendarResourceJob, code: String) = state.access(true) { it.resourceOutcome(job, code) }
    }, transport)
    if (resources.run(job.operationId, token, job.zoneId)) state.access(true) { it.confirm(job.operationId, event) }
    else state.access(true) { store -> store.fail(job.operationId, store.publicationJobs(job.operationId).firstOrNull { !it.confirmed }?.outcome ?: "UNCONFIRMED_RESOURCE") }
  }
  private fun active(job: CalendarOperation) {
    val connection = state.access { it.connection() }
    if (!connection.connected || connection.subject != job.subject) throw CalendarFailure("NEEDS_ACCESS")
  }
}

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
      if (existing != null) { state.access(true) { it.confirm(job.operationId, existing) }; return }
      if (job.readOnly || job.payload.isBlank()) throw CalendarFailure("REMOTE_REMOVED")
      val permitted = state.access(true) { it.permitInsert(job.operationId) } ?: throw CalendarFailure("NEEDS_ACCESS")
      val result = try { transport.insert(token, permitted.calendarId, permitted.payload) }
      catch (error: CalendarFailure) {
        if (error.code != "DUPLICATE") throw error
        transport.event(token, permitted.calendarId, permitted.eventId) ?: throw CalendarFailure("RETRY")
      }
      state.access(true) { it.confirm(job.operationId, result) }
    } catch (error: CalendarFailure) { state.access(true) { it.fail(job.operationId, error.code) } }
    catch (_: Exception) { state.access(true) { it.fail(job.operationId, "NETWORK") } }
  }
  private fun active(job: CalendarOperation) {
    val connection = state.access { it.connection() }
    if (!connection.connected || connection.subject != job.subject) throw CalendarFailure("NEEDS_ACCESS")
  }
}

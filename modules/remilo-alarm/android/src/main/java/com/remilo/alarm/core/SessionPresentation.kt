package com.remilo.alarm.core

/** Rejects callbacks from an old intent or an older refresh, including recreation. */
class SessionRefreshGuard {
  data class Ticket(val sessionId: String, val revision: Long)
  private var sessionId = ""
  private var revision = 0L
  fun select(id: String) { sessionId = id; revision++ }
  fun request() = Ticket(sessionId, ++revision)
  fun accepts(ticket: Ticket) = ticket.sessionId == sessionId && ticket.revision == revision
  companion object {
    // A loading/starting empty screen is not proof of termination.
    fun ended(state: String?) = state != null && state !in setOf("Starting", "Active")
  }
}

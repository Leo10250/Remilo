package com.remilo.alarm.core

/** Rejects callbacks from an old intent or an older refresh, including recreation. */
class SessionRefreshGuard {
  data class Ticket(val sessionId: String, val revision: Long)
  private var sessionId = ""
  private var revision = 0L
  /** An unresolved action owns this screen until its exact command is acknowledged. */
  fun select(id: String, pending: Boolean = false, busy: Boolean = false, unconfirmed: Boolean = false): Boolean {
    if (sessionId.isNotEmpty() && (pending || busy || unconfirmed)) return false
    sessionId = id; revision++
    return true
  }
  fun request() = Ticket(sessionId, ++revision)
  fun accepts(ticket: Ticket) = ticket.sessionId == sessionId && ticket.revision == revision
  companion object {
    // A loading/starting empty screen is not proof of termination.
    fun ended(state: String?) = state != null && state !in setOf("Starting", "Active")
    fun mayDismiss(state: String?, pending: Boolean, busy: Boolean, unconfirmed: Boolean) =
      ended(state) && !pending && !busy && !unconfirmed
  }
}

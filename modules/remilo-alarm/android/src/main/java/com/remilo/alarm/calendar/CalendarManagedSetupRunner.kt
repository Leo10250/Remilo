package com.remilo.alarm.calendar

data class CalendarManagedSetupRunSummary(val phase: String, val pages: Int, val continuation: Boolean)

/** Application-context Calendar I/O only. Every permission/cursor/result checkpoint returns to the engine worker. */
class CalendarManagedSetupRunner(private val state: CalendarStateAccess, private val transport: CalendarTransport,
  private val authorization: CalendarAuthorization, private val elapsedMs: () -> Long = { android.os.SystemClock.elapsedRealtime() }) {
  fun run(operationId: String, suppliedToken: String? = null, deadlineElapsedMs: Long = elapsedMs() + 120_000): CalendarManagedSetupRunSummary {
    var pages = 0
    var token: String? = null
    val deadline = deadlineElapsedMs
    try {
      val first = state.access { it.managed.setupOperation(operationId) } ?: throw CalendarFailure("NOT_FOUND")
      if (first.phase == "Confirmed") return CalendarManagedSetupRunSummary(first.phase, 0, false)
      active(operationId)
      if (elapsedMs() >= deadline) return CalendarManagedSetupRunSummary(first.phase, 0, true)
      val connection = state.access { it.connection() }
      token = suppliedToken ?: authorization.token(connection.email)
      val account = transport.account(token)
      if (account.subject != first.subject) throw CalendarFailure("ACCOUNT_MISMATCH")
      if (!account.emailVerified) throw CalendarFailure("OWNERSHIP_UNKNOWN")
      active(operationId)
      if (first.kind == "Select" || first.resultCalendarId.isNotBlank()) {
        val calendar = transport.calendar(token, first.resultCalendarId.ifBlank { first.calendarId })
        CalendarManagedDiscovery.requireEligible(calendar, account.email)
        if (first.kind == "Create" && calendar.description != first.marker) throw CalendarFailure("CREATION_UNCONFIRMED")
        complete(operationId, calendar)
        return CalendarManagedSetupRunSummary("Confirmed", 0, false)
      }
      // Every resumed completed scan is refreshed, including a delayed consent grant. Mid-page recovery retains its cursor.
      if (first.kind == "Create" && first.discoveryComplete) state.access(true) { it.managed.resetDiscovery(operationId) }
      var job = state.access { it.managed.setupOperation(operationId) }!!
      if (!job.discoveryComplete) {
        pages = CalendarManagedDiscovery.inspect(transport, token, job.discoveryCursor.takeIf(String::isNotBlank), deadline, elapsedMs) { page ->
          active(operationId)
          val relevant = CalendarPage(page.items.filter { CalendarManagedDiscovery.candidate(it, account.email) }, page.nextCursor)
          state.access(true) { it.managed.discoveryPage(operationId, relevant) }
        }
        job = state.access { it.managed.setupOperation(operationId) }!!
      }
      if (!job.discoveryComplete) return CalendarManagedSetupRunSummary(job.phase, pages, true)
      if (job.kind == "Discovery") return CalendarManagedSetupRunSummary("Reviewing", pages, false)
      val candidates = CalendarManagedDiscovery.candidates(job.candidates)
      if (job.attempted) {
        val matches = candidates.filter { it.description == job.marker }
        if (matches.size != 1) throw CalendarFailure("CREATION_UNCONFIRMED")
        CalendarManagedDiscovery.requireEligible(matches.single(), account.email)
        // Inspect the same discovered identity again; an editable marker cannot grant transfer permission.
        val calendar = transport.calendar(token, matches.single().id)
        CalendarManagedDiscovery.requireEligible(calendar, account.email)
        if (calendar.description != job.marker) throw CalendarFailure("CREATION_UNCONFIRMED")
        complete(operationId, calendar)
        return CalendarManagedSetupRunSummary("Confirmed", pages, false)
      }
      if (candidates.isNotEmpty()) throw CalendarFailure("CALENDAR_SELECTION_REQUIRED")
      if (elapsedMs() >= deadline) return CalendarManagedSetupRunSummary(job.phase, pages, true)
      // The extra creation scope is obtained only for an explicitly captured Create operation, never for discovery/adoption.
      val createToken = authorization.tokenForCalendarCreation(connection.email)
      if (elapsedMs() >= deadline) return CalendarManagedSetupRunSummary(job.phase, pages, true)
      token = createToken
      val createAccount = transport.account(createToken)
      if (createAccount.subject != job.subject || !createAccount.email.equals(account.email, ignoreCase = true)) throw CalendarFailure("ACCOUNT_MISMATCH")
      if (!createAccount.emailVerified) throw CalendarFailure("OWNERSHIP_UNKNOWN")
      active(operationId)
      if (elapsedMs() >= deadline) return CalendarManagedSetupRunSummary(job.phase, pages, true)
      val permitted = state.access(true) { it.managed.permitCreate(operationId) } ?: throw CalendarFailure("CREATION_UNCONFIRMED")
      val calendar = try { transport.createCalendar(createToken, CalendarManagedDiscovery.name, permitted.calendarZone, permitted.marker) }
        catch (error: CalendarFailure) {
          if (error.code in setOf("NOT_AVAILABLE", "BUDGET", "RETRY", "BAD_REQUEST", "AUTH", "FORBIDDEN")) state.access(true) { it.managed.creationRejected(operationId) }
          throw error
        }
      state.access(true) { it.managed.rememberCreated(operationId, calendar.id) }
      // calendars.insert returns a Calendar resource; ownership evidence belongs to CalendarList.
      val verified = try { transport.calendar(createToken, calendar.id).also { CalendarManagedDiscovery.requireEligible(it, account.email) } }
        catch (error: CalendarFailure) {
          if (error.code in setOf("NOT_FOUND", "OWNERSHIP_UNKNOWN")) throw CalendarFailure("CREATION_UNCONFIRMED")
          throw error
        }
      if (verified.description != permitted.marker) throw CalendarFailure("CREATION_UNCONFIRMED")
      complete(operationId, verified)
      return CalendarManagedSetupRunSummary("Confirmed", pages, false)
    } catch (error: Exception) {
      val code = (error as? CalendarFailure)?.code ?: "NETWORK"
      if (code == "AUTH" && token != null) try { authorization.clear(token) } catch (_: Exception) { /* No token persistence. */ }
      state.access(true) { it.managed.setupFailed(operationId, code) }
      val job = state.access { it.managed.setupOperation(operationId) }
      return CalendarManagedSetupRunSummary(job?.phase ?: "CalendarUnavailable", pages,
        job != null && !job.discoveryComplete && code !in setOf("AUTH", "NEEDS_ACCESS", "ACCOUNT_MISMATCH", "STALE_AUTHORIZATION"))
    }
  }
  private fun active(id: String) {
    if (!state.access { it.managed.operationActive(id) }) throw CalendarFailure("STALE_AUTHORIZATION")
  }
  private fun complete(id: String, calendar: OwnedCalendar) {
    active(id)
    state.access(true) { it.completeManagedSetup(id, calendar) }
  }
}

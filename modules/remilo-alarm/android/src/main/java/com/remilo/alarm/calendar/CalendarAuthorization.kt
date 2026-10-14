package com.remilo.alarm.calendar

import android.accounts.Account
import android.content.Context
import com.google.android.gms.auth.api.identity.ClearTokenRequest
import com.google.android.gms.auth.api.identity.Identity
import com.google.android.gms.auth.api.identity.RevokeAccessRequest
import com.google.android.gms.tasks.Tasks
import java.util.concurrent.TimeUnit
import com.google.android.gms.auth.api.identity.AuthorizationRequest
import com.google.android.gms.common.api.Scope

/** Injected authorization seam; access tokens never become durable publication data. */
interface CalendarAuthorization {
  fun token(email: String): String
  fun tokenForCalendarCreation(email: String): String = throw CalendarFailure("NEEDS_ACCESS")
  fun clear(token: String)
  fun revoke(email: String)
}
class GoogleCalendarAuthorization(private val context: Context) : CalendarAuthorization {
  override fun token(email: String): String = token(email, false)
  override fun tokenForCalendarCreation(email: String): String = token(email, true)
  private fun token(email: String, createCalendar: Boolean): String {
    if (email.isBlank()) throw CalendarFailure("NEEDS_ACCESS")
    val result = Tasks.await(Identity.getAuthorizationClient(context).authorize(request(email, createCalendar)), 30, TimeUnit.SECONDS)
    if (result.hasResolution()) throw CalendarFailure("NEEDS_ACCESS")
    CalendarConsent.requireGranted(result.grantedScopes, createCalendar)
    return result.accessToken ?: throw CalendarFailure("AUTH")
  }
  override fun clear(token: String) {
    Tasks.await(Identity.getAuthorizationClient(context).clearToken(ClearTokenRequest.builder().setToken(token).build()), 30, TimeUnit.SECONDS)
  }
  override fun revoke(email: String) {
    Tasks.await(Identity.getAuthorizationClient(context).revokeAccess(RevokeAccessRequest.builder()
      .setAccount(Account(email, "com.google")).setScopes(CalendarConsent.requiredFor(true).map(::Scope)).build()), 30, TimeUnit.SECONDS)
  }
  companion object {
    fun request(email: String? = null, createCalendar: Boolean = false): AuthorizationRequest = AuthorizationRequest.builder()
      .setRequestedScopes(CalendarConsent.requiredFor(createCalendar).map(::Scope))
      .also { if (email != null) it.setAccount(Account(email, "com.google")) else it.setPrompt(AuthorizationRequest.Prompt.SELECT_ACCOUNT) }.build()
  }
}

/** One explicit request permits at most two attempts; startup never invokes this runner. */
class CalendarRunner(private val state: CalendarStateAccess, private val transport: CalendarTransport,
  private val authorization: CalendarAuthorization) {
  fun run(id: String) {
    var token: String? = null
    try {
      val job = state.access(true) { it.begin(id) } ?: return
      val email = state.access { it.connection().takeIf { c -> c.subject == job.subject }?.email }?.takeIf { it.isNotBlank() } ?: job.email
      val accessToken = authorization.token(email)
      token = accessToken
      repeat(2) { attempt ->
        val next = if (attempt == 0) job else state.access(true) { it.begin(id) } ?: return
        CalendarPublisher(state, transport).publish(next, accessToken)
        val status = state.access { it.operation(id)?.state }
        if (status == "NeedsAccess") { try { authorization.clear(accessToken) } catch (_: Exception) { /* Transient cache cleanup. */ }; return }
        if (status != "Unconfirmed") return
        if (attempt == 0) Thread.sleep(1_000) // Bounded I/O backoff; never blocks the alarm mutation worker.
      }
    } catch (error: Exception) {
      val code = (error as? CalendarFailure)?.code ?: "AUTH"
      if (code == "AUTH" && token != null) try { authorization.clear(token) } catch (_: Exception) { /* Reauthorization remains available. */ }
      state.access(true) { it.fail(id, code) }
    }
  }
}

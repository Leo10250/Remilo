package com.remilo.alarm.calendar

import android.accounts.Account
import android.content.Context
import android.os.UserManager
import com.google.android.gms.auth.api.identity.*
import com.google.android.gms.common.api.Scope
import com.remilo.alarm.engine.AlarmEngine
import java.util.concurrent.CompletableFuture
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ExecutionException

/** Optional process-lifetime I/O adapter, created only from unlocked foreground requests. */
class CalendarRuntime private constructor(private val context: Context, private val engine: AlarmEngine) : CalendarStateAccess {
  private val io = Executors.newSingleThreadExecutor { task -> Thread(task, "Remilo-calendar-io") }
  private val transport = GoogleCalendarTransport()
  private val authorization = GoogleCalendarAuthorization(context)
  @Volatile var revoking = false
    private set
  private val running = ConcurrentHashMap.newKeySet<String>()
  override fun <T> access(write: Boolean, block: (CalendarStore) -> T): T {
    val result = CompletableFuture<T>()
    engine.calendarRequest(write, block, { result.complete(it) }, { result.completeExceptionally(CalendarFailure(it)) })
    try { return result.get(15, TimeUnit.SECONDS) }
    catch (error: ExecutionException) { throw (error.cause as? CalendarFailure ?: CalendarFailure("NOT_AVAILABLE")) }
  }
  private fun token(email: String): String {
    if (revoking) throw CalendarFailure("NEEDS_ACCESS")
    return authorization.token(email)
  }
  private fun <T> authorized(email: String, block: (String) -> T): T {
    val accessToken = token(email)
    try { return block(accessToken) }
    catch (error: CalendarFailure) {
      if (error.code == "AUTH") try { authorization.clear(accessToken) } catch (_: Exception) { /* Reauthorization remains visible. */ }
      throw error
    }
  }
  fun authenticated(token: String, expectedRevision: Long, publicationId: String?, done: (Boolean) -> Unit) {
    io.execute {
      try {
        val account = transport.account(token)
        if (publicationId == null) access(true) { it.connect(account, expectedRevision) }
        else {
          val job = access { it.operation(publicationId) } ?: throw CalendarFailure("NOT_FOUND")
          if (account.subject != job.subject) throw CalendarFailure("ACCOUNT_MISMATCH")
          access(true) { it.connect(account, expectedRevision) }
          val captured = access(true) { it.begin(publicationId) }
          if (captured != null) CalendarPublisher(this, transport).publish(captured, token)
          if (access { it.operation(publicationId)?.state } == "NeedsAccess") try { authorization.clear(token) } catch (_: Exception) { /* Retry obtains fresh access. */ }
        }
        done(true)
      } catch (error: Exception) {
        val code = (error as? CalendarFailure)?.code ?: "AUTH"
        if (code == "AUTH") try { authorization.clear(token) } catch (_: Exception) { /* No token persistence. */ }
        if (publicationId != null) access(true) { it.fail(publicationId, code) }
        else access(true) { it.connectionMessage("Google connection was not confirmed. Check setup and try Connect again.", expectedRevision) }
        done(false)
      }
    }
  }
  fun start(id: String) {
    if (!running.add(id)) return
    io.execute {
      try {
        if (revoking) throw CalendarFailure("NEEDS_ACCESS")
        CalendarRunner(this, transport, authorization).run(id)
      } catch (error: Exception) {
        val code = (error as? CalendarFailure)?.code ?: "AUTH"
        access(true) { it.fail(id, code) }
      } finally { running.remove(id) }
    }
  }
  fun list(cursor: String?, resolve: (Map<String, Any?>) -> Unit, reject: (String) -> Unit) {
    io.execute {
      try {
        val connection = access { it.connection() }
        if (!connection.connected) throw CalendarFailure("NEEDS_ACCESS")
        val page = authorized(connection.email) { token ->
          if (transport.account(token).subject != connection.subject) throw CalendarFailure("ACCOUNT_MISMATCH")
          transport.calendars(token, cursor)
        }
        resolve(mapOf("items" to page.items.map { it.view() }, "nextCursor" to page.nextCursor,
          "connectionRevision" to connection.revision))
      } catch (error: Exception) { reject((error as? CalendarFailure)?.code ?: "AUTH") }
    }
  }
  fun select(command: Map<String, Any?>, resolve: (Any?) -> Unit, reject: (String) -> Unit) {
    io.execute {
      try {
        access { it.selectionReceipt(command) }?.let { resolve(it); return@execute }
        val old = access { it.connection() }
        if (!old.connected) throw CalendarFailure("NEEDS_ACCESS")
        if (old.revision != CalendarStore.number(command, "expectedConnectionRevision")) throw CalendarFailure("STALE_CONNECTION")
        val calendar = authorized(old.email) { token ->
          if (transport.account(token).subject != old.subject) throw CalendarFailure("ACCOUNT_MISMATCH")
          transport.calendar(token, CalendarStore.string(command, "calendarId"))
        }
        resolve(access(true) { it.select(CalendarStore.string(command, "operationId"),
          CalendarStore.number(command, "expectedConnectionRevision"), old.subject, calendar) })
      } catch (error: Exception) { reject((error as? CalendarFailure)?.code ?: "NOT_AVAILABLE") }
    }
  }
  fun revoke(old: CalendarConnection) {
    revoking = true
    io.execute {
      var message = "Disconnected. Google access revoked; published events remain."
      try { authorization.revoke(old.email) }
      catch (_: Exception) { message = "Disconnected locally. Google access revocation was not confirmed. Reconnect then disconnect again, or remove access in your Google account." }
      try { access(true) { it.connectionMessage(message, old.revision + 1) } }
      finally { revoking = false }
    }
  }
  companion object {
    val scopes = CalendarConsent.required.map(::Scope)
    fun request(email: String? = null): AuthorizationRequest = AuthorizationRequest.builder().setRequestedScopes(scopes)
      .also { if (email != null) it.setAccount(Account(email, "com.google")) else it.setPrompt(AuthorizationRequest.Prompt.SELECT_ACCOUNT) }.build()
    @Volatile private var instance: CalendarRuntime? = null
    fun get(context: Context): CalendarRuntime {
      check(context.getSystemService(UserManager::class.java).isUserUnlocked)
      return instance ?: synchronized(this) { instance ?: CalendarRuntime(context.applicationContext,
        AlarmEngine.get(context.applicationContext)).also { instance = it } }
    }
  }
}

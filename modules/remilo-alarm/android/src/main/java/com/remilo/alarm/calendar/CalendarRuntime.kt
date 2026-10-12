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
class CalendarRuntime private constructor(private val context: Context, private val engine: AlarmEngine) : CalendarStateAccess, CalendarLinkAccess {
  private val io = Executors.newSingleThreadExecutor { task -> Thread(task, "Remilo-calendar-io") }
  private val transport = GoogleCalendarTransport()
  private val authorization = GoogleCalendarAuthorization(context)
  @Volatile var revoking = false
    private set
  private val running = ConcurrentHashMap.newKeySet<String>()
  private val cursors = linkedMapOf<String, Pair<String, String>>()
  override fun <T> links(write: Boolean, block: (CalendarLinkStore) -> T): T = access(write) { block(it.links) }
  override fun local(operationId: String, connectionRevision: Long): Map<String, Any?> {
    val result = CompletableFuture<Map<String, Any?>>()
    engine.request({ engine.calendarLocal(operationId, connectionRevision) }, { @Suppress("UNCHECKED_CAST") result.complete(it as Map<String, Any?>) },
      { result.completeExceptionally(CalendarFailure(it)) })
    try { return result.get(15, TimeUnit.SECONDS) }
    catch (error: ExecutionException) { throw (error.cause as? CalendarFailure ?: CalendarFailure("NOT_AVAILABLE")) }
  }
  private fun snapshot(id: String): Map<*, *> {
    val result = CompletableFuture<Map<*, *>>()
    engine.request({ engine.occurrence(id) }, { result.complete(it as? Map<*, *> ?: emptyMap<String, Any>()) },
      { result.completeExceptionally(CalendarFailure("NOT_FOUND")) })
    return result.get(15, TimeUnit.SECONDS)
  }
  fun linkRequest(action: String, input: Map<String, Any?>, resolve: (Any?) -> Unit, reject: (String) -> Unit) {
    io.execute {
      var observation: CalendarObservationGuard? = null
      try {
        (input["occurrenceId"] as? String)?.let { id -> observation = links { if (it.link(id) != null) it.guard(id) else null } }
        val connection = links { it.connection() }
        if (!connection.connected) throw CalendarFailure("NEEDS_ACCESS")
        val value = authorized(connection.email) { token ->
          if (transport.account(token).subject != connection.subject) throw CalendarFailure("ACCOUNT_MISMATCH")
          val id = input["occurrenceId"] as? String
          val old = id?.let { links { store -> store.link(it) } }
          val publication = if (id != null && old == null) access { it.publication(id) } else null
          val publicationJob = if (publication != null) access { it.operation(publication["operationId"] as String) } else null
          if (old != null && old.subject != connection.subject || publicationJob != null && publicationJob.subject != connection.subject) throw CalendarFailure("ACCOUNT_MISMATCH")
          val calendarId = old?.calendarId ?: publicationJob?.calendarId ?: CalendarStore.string(input, "calendarId")
          val calendar = transport.calendar(token, calendarId)
          if (calendar.accessRole != "owner") throw CalendarFailure("NOT_OWNER")
          if (action == "list") {
            val from = CalendarStore.string(input, "from"); val until = CalendarStore.string(input, "until")
            val range = CalendarLinkMapper.range(from, until)
            val queryKey = org.json.JSONArray(listOf(connection.revision, calendarId, from, until, range.first, range.second)).toString()
            val cursor = input["cursor"] as? String
            val pageToken = cursor?.let { cursors[it]?.takeIf { pair -> pair.first == queryKey }?.second ?: throw CalendarFailure("STALE_CURSOR") }
            val page = transport.events(token, calendarId, range.first, range.second, pageToken)
            val events = page.optJSONArray("items") ?: org.json.JSONArray()
            val items = (0 until events.length()).map { index ->
              val event = events.getJSONObject(index)
              val eventId = event.getString("id")
              val source = links { it.source(CalendarLinkMapper.key(connection.subject, calendarId, eventId)) }
              val reason = CalendarLinkMapper.reason(event, calendar.zoneId)
              val fields = if (reason == null) CalendarLinkMapper.fields(event, calendar.zoneId) else null
              mapOf("eventId" to eventId, "title" to event.optString("summary", "Untitled event"),
                "fields" to fields?.let(CalendarLinkMapper::map), "unsupportedReason" to reason,
                "occurrenceId" to source?.occurrenceId, "erased" to (source?.erased ?: false))
            }
            val next = page.optString("nextPageToken").takeIf(String::isNotBlank)?.let {
              val key = java.util.UUID.randomUUID().toString(); cursors[key] = queryKey to it
              while (cursors.size > 128) cursors.remove(cursors.keys.first()); key
            }
            links { if (it.connection().revision != connection.revision) throw CalendarFailure("STALE_CONNECTION") }
            mapOf("items" to items, "nextCursor" to next, "connectionRevision" to connection.revision, "calendarName" to calendar.name)
          } else {
            val eventId = old?.eventId ?: publicationJob?.eventId ?: CalendarStore.string(input, "eventId")
            if (id != null && old == null && publicationJob?.state != "Published") throw CalendarFailure("INELIGIBLE")
            val lookup = transport.lookup(token, calendarId, eventId)
            if (action == "check") {
              return@authorized links(true) { it.observe(observation ?: throw CalendarFailure("INELIGIBLE"), calendar, lookup) }
            }
            observation?.let { guard -> links(true) { it.observe(guard, calendar, lookup) } }
            val event = when (lookup) {
              is CalendarEventLookup.Found -> lookup.event
              CalendarEventLookup.Missing -> throw CalendarFailure("REMOTE_UNAVAILABLE")
              CalendarEventLookup.Deleted -> throw CalendarFailure("REMOTE_DELETED")
            }
            if (event.optString("id") != eventId) throw CalendarFailure("FOREIGN_IDENTITY")
            if (publicationJob != null && !CalendarMapper.matching(event, eventId)) throw CalendarFailure("FOREIGN_IDENTITY")
            @Suppress("UNCHECKED_CAST") val choices = input["choices"] as? Map<String, Any?> ?: emptyMap()
            val snapshot = id?.let(::snapshot)
            val gen = (snapshot?.get("generation") as? Number)?.toLong() ?: 0
            links(true) {
              if (it.connection().revision != connection.revision) throw CalendarFailure("STALE_CONNECTION")
              it.preview(calendar, event, id, choices, gen,
                if (snapshot?.get("alertAdjustment") != null) (snapshot["nextAlertMs"] as? Number)?.toLong() else null)
            }
          }
        }
        resolve(value)
      } catch (error: Exception) {
        val code = (error as? CalendarFailure)?.code ?: "INVALID_INPUT"
        observation?.let { guard ->
          try {
            val saved = links(true) { it.observedFailure(guard.id, code, guard) }
            if (action == "check" && saved != null) { resolve(saved); return@execute }
          } catch (stale: CalendarFailure) { reject(stale.code); return@execute }
        }
        reject(code)
      }
    }
  }
  fun startLink(id: String, retry: Boolean = false) {
    if (!running.add(id)) return
    io.execute {
      try {
        val job = links { it.operation(id) } ?: throw CalendarFailure("NOT_FOUND")
        if (job.state in CalendarLinkStore.terminal || job.erased) return@execute
        val connection = links { it.connection() }
        if (!connection.connected || connection.subject != job.subject) throw CalendarFailure("NEEDS_ACCESS")
        if (!retry && connection.revision != job.expectedConnectionRevision) throw CalendarFailure("STALE_CONNECTION")
        authorized(connection.email) { token ->
          CalendarLinkRunner(this, transport).run(id, token, connection.revision)
          if (links { it.operation(id)?.state } == "NeedsAccess") try { authorization.clear(token) } catch (_: Exception) { /* Visible recovery. */ }
        }
      } catch (error: Exception) { links(true) { it.fail(id, (error as? CalendarFailure)?.code ?: "NEEDS_ACCESS") } }
      finally { running.remove(id) }
    }
  }
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
          val linkJob = links { it.operation(publicationId) }
          if (linkJob != null) {
            if (account.subject != linkJob.subject) throw CalendarFailure("ACCOUNT_MISMATCH")
            access(true) { it.connect(account, expectedRevision) }
            CalendarLinkRunner(this, transport).run(publicationId, token, links { it.connection().revision })
            done(true); return@execute
          }
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
        if (publicationId != null) access(true) { if (it.links.operation(publicationId) != null) it.links.fail(publicationId, code) else it.fail(publicationId, code) }
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

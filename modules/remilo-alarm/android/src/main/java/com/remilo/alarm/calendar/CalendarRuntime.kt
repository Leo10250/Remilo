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
import org.json.JSONObject

/** Application-context I/O adapter shared by foreground actions and unlocked native workers. */
class CalendarRuntime private constructor(private val context: Context, private val engine: AlarmEngine) : CalendarAutomaticAccess {
  private val io = Executors.newSingleThreadExecutor { task -> Thread(task, "Remilo-calendar-io") }
  private val transport = GoogleCalendarTransport()
  private val authorization = GoogleCalendarAuthorization(context)
  @Volatile var revoking = false
    private set
  private val running = ConcurrentHashMap.newKeySet<String>()
  private val cursors = linkedMapOf<String, Pair<String, String>>()
  private val syncFlights = mutableMapOf<String, CompletableFuture<CalendarRunSummary>>()
  fun managedRequest(action: String, input: Map<String, Any?>, resolve: (Any?) -> Unit, reject: (String) -> Unit) {
    if (action == "recovered") {
      engine.request({ engine.calendarRecoveredPreview((input["ids"] as? List<*>)?.map { it as String } ?: emptyList()) }, resolve, reject)
      return
    }
    io.execute {
      try {
        transport.deadlineElapsedMs = android.os.SystemClock.elapsedRealtime() + 120_000
        val coordinator = CalendarManagedCoordinator(this, transport, authorization)
        resolve(when (action) {
          "setup" -> coordinator.setupPreview(input)
          "policy" -> access(true) { it.managed.previewPolicyChange(input) }
          "resume" -> coordinator.resumePreview()
          "candidate" -> { @Suppress("UNCHECKED_CAST") val choices = input["choices"] as? Map<String, Any?> ?: emptyMap()
            coordinator.candidatePreview(CalendarStore.string(input, "candidateId"), choices) }
          else -> throw CalendarFailure("INVALID_INPUT")
        })
      } catch (error: Exception) { reject((error as? CalendarFailure)?.code ?: "NETWORK") }
      finally { transport.deadlineElapsedMs = Long.MAX_VALUE }
    }
  }
  fun managedCommand(command: Map<String, Any?>, resolve: (Any?) -> Unit, reject: (String) -> Unit) {
    if (command["kind"] == "EnableRecoveredCalendarAlerts") {
      engine.request({ engine.calendarRecoveredCapture(command) }, resolve, reject); return
    }
    engine.calendarRequest(true, { it.captureManagedCommand(command) }, { result ->
      resolve(result)
      val operationId = CalendarStore.string(command, "operationId")
      when (command["kind"]) {
        "ConfirmManagedCalendarSetup", "RetryManagedCalendarOperation" -> startManaged(operationId)
        "ImportManagedCalendarCandidate" -> startLink(operationId, true)
        "ResumeManagedCalendar" -> {
          @Suppress("UNCHECKED_CAST") val jobs = result["operations"] as? List<String> ?: emptyList()
          jobs.forEach { startLink(it, true) }; synchronize(false)
        }
      }
      CalendarWork.reconcile(context, opportunity = true)
    }, reject)
  }
  fun startManaged(id: String, suppliedToken: String? = null) {
    if (!running.add("managed:$id")) return
    io.execute {
      try {
        transport.deadlineElapsedMs = android.os.SystemClock.elapsedRealtime() + 120_000
        val setup = access { it.managed.setupOperation(id) }
        if (setup != null) {
          CalendarManagedSetupRunner(this, transport, authorization).run(id, suppliedToken, transport.deadlineElapsedMs)
          if (access { it.managed.setupOperation(id)?.phase } == "Confirmed") access(true) { it.releaseManagedSetupChildren(id) }
        } else inspectManagedPublication(id, suppliedToken)
      } catch (error: Exception) { access(true) { it.managed.issue("Setup", id, (error as? CalendarFailure)?.code ?: "NETWORK", false) } }
      finally { transport.deadlineElapsedMs = Long.MAX_VALUE; running.remove("managed:$id"); CalendarWork.reconcile(context, opportunity = true) }
    }
  }
  fun managedAuthenticated(token: String, expectedRevision: Long, done: (Boolean) -> Unit) {
    io.execute {
      try {
        val connection = access { it.connection() }; val account = transport.account(token)
        if (!connection.connected || connection.revision != expectedRevision || connection.subject != account.subject || !account.emailVerified)
          throw CalendarFailure("STALE_CONNECTION")
        val id = access { it.managed.binding().operationId }
        if (id.isBlank()) throw CalendarFailure("NOT_FOUND")
        done(true); startManaged(id, token)
      } catch (_: Exception) { done(false) }
    }
  }
  private fun inspectManagedPublication(id: String, suppliedToken: String?) {
    val job = access { it.operation(id) } ?: throw CalendarFailure("NOT_FOUND")
    val connection = access { it.connection() }
    if (!connection.connected || connection.subject != job.subject) throw CalendarFailure("ACCOUNT_MISMATCH")
    val token = suppliedToken ?: authorization.token(connection.email)
    val calendar = transport.calendar(token, job.calendarId)
    CalendarManagedDiscovery.requireEligible(calendar, connection.email)
    val remote = (transport.lookup(token, job.calendarId, job.eventId) as? CalendarEventLookup.Found)?.event ?: throw CalendarFailure("UNCONFIRMED_RESOURCE")
    if (!CalendarMapper.matching(remote, job.eventId)) throw CalendarFailure("FOREIGN_IDENTITY")
    if (job.payload.isNotBlank() && !CalendarLinkMapper.equal(CalendarLinkMapper.mainFields(CalendarLinkMapper.fields(JSONObject(job.payload), job.zoneId)),
        CalendarLinkMapper.mainFields(CalendarLinkMapper.fields(remote, job.zoneId)))) throw CalendarFailure("RESOURCE_CONFLICT")
    for (child in access { it.publicationJobs(id) }) {
      if (child.confirmed || !child.attempted || child.eventId.isBlank()) continue
      val actual = (transport.lookup(token, child.calendarId, child.eventId) as? CalendarEventLookup.Found)?.event ?: throw CalendarFailure("UNCONFIRMED_RESOURCE")
      if (!CalendarLinkMapper.equal(CalendarLinkMapper.fields(JSONObject(actual.toString()).also { it.remove("recurringEventId") }, job.zoneId), JSONObject(child.desired)))
        throw CalendarFailure("RESOURCE_CONFLICT")
      access(true) { it.acknowledgeResource(child, actual) }
    }
    if (access { it.publicationJobs(id).all { it.confirmed } }) access(true) { it.confirm(id, remote) }
  }
  fun requestSync(command: Map<String, Any?>, resolve: (Any?) -> Unit, reject: (String) -> Unit) {
    engine.calendarRequest(true, { CalendarSyncRequests(it.database(), System::currentTimeMillis).capture(command) }, { result ->
      resolve(result)
      synchronize(false, requestId = CalendarStore.string(command, "operationId"))
    }, reject)
  }
  fun syncNow(id: String?): CompletableFuture<CalendarRunSummary> {
    val result = CompletableFuture<CalendarRunSummary>()
    val operationId = java.util.UUID.randomUUID().toString()
    val command = mapOf("operationId" to operationId, "scope" to if (id == null) mapOf("kind" to "AllAuthorized") else mapOf("kind" to "Association", "occurrenceId" to id))
    engine.calendarRequest(true, { CalendarSyncRequests(it.database(), System::currentTimeMillis).capture(command) }, {
      synchronize(false, requestId = operationId).whenComplete { summary, error -> if (error == null) result.complete(summary) else result.completeExceptionally(error) }
    }, { result.completeExceptionally(CalendarFailure(it)) })
    return result
  }
  @Synchronized fun synchronize(background: Boolean, id: String? = null, requestId: String? = null): CompletableFuture<CalendarRunSummary> {
    val key = requestId ?: id ?: "all"
    syncFlights[key]?.let { return it }
    val future = CompletableFuture<CalendarRunSummary>(); syncFlights[key] = future
    io.execute {
      var explicit: String? = requestId
      try {
        if (explicit == null && background) explicit = access { CalendarSyncRequests(it.database(), System::currentTimeMillis).nextReady() }
        val requested = explicit
        if (requested != null && !access(true) { CalendarSyncRequests(it.database(), System::currentTimeMillis).begin(requested) }) {
          future.complete(CalendarRunSummary(0, 0, 0, access { CalendarSyncRequests(it.database(), System::currentTimeMillis).pending().isNotEmpty() })); return@execute
        }
        val target = requested?.let { op -> access { CalendarSyncRequests(it.database(), System::currentTimeMillis).association(op) } } ?: id
        transport.cancelled = { future.isCancelled }
        transport.deadlineElapsedMs = android.os.SystemClock.elapsedRealtime() + 120_000
        val connection = access { it.connection() }
        val pendingSetup = access { store -> store.managed.binding().operationId.takeIf { key -> key.isNotBlank() && store.managed.operationActive(key) &&
          store.managed.setupOperation(key)!!.let { job -> job.phase !in setOf("AccessRequired", "OwnershipUnknown", "Reviewing") && job.retryAtMs <= System.currentTimeMillis() } } }
        val setupPages = if (pendingSetup != null) CalendarManagedSetupRunner(this, transport, authorization).run(pendingSetup, deadlineElapsedMs = transport.deadlineElapsedMs).pages else 0
        access(true) { store -> store.managed.binding().operationId.takeIf(String::isNotBlank)?.let(store::releaseManagedSetupChildren) }
        val result = authorized(connection.email) { token -> CalendarAutomaticRunner(this, transport).run(token, background, target, transport.deadlineElapsedMs, setupPages) }
        val counts = requested?.let { op -> access(true) {
          val requests = CalendarSyncRequests(it.database(), System::currentTimeMillis)
          requests.finish(op, result); requests.view(op)?.get("syncResult") as? Map<*, *>
        } }
        future.complete(if (counts != null) result.copy(checked = counts["checked"] as? Int, changed = counts["changed"] as? Int,
          continuation = result.continuation || counts["outcome"] == "Pending") else result)
      } catch (error: Exception) {
        val code = (error as? CalendarFailure)?.code ?: "NETWORK"
        explicit?.let { op -> access(true) { CalendarSyncRequests(it.database(), System::currentTimeMillis).finish(op, error = code) } }
        if (future.isCancelled) return@execute
        if (access { it.managed.binding().calendarId.isNotEmpty() }) access(true) { it.managed.failedAttempt() }
        if (code in setOf("AUTH", "NEEDS_ACCESS", "ACCOUNT_MISMATCH")) access(true) { store ->
          store.links.links().filter { it["syncMode"] == "Automatic" }.forEach { store.sync.issue(it["occurrenceId"] as String, code, background, "Paused") }
        }
        future.completeExceptionally(CalendarFailure(code))
      } finally {
        transport.cancelled = { false }
        transport.deadlineElapsedMs = Long.MAX_VALUE
        synchronized(this) { syncFlights.remove(key) }
        access { it.sync.notifications(CalendarReviewNotifications(context)) }
        CalendarWork.reconcile(context)
      }
    }
    return future
  }
  fun activation(ids: List<String>, resolve: (Any?) -> Unit, reject: (String) -> Unit) {
    io.execute {
      try {
        if (ids.isEmpty() || ids.size > 500 || ids.distinct().size != ids.size) throw CalendarFailure("INVALID_INPUT")
        val connection = access { it.connection() }
        val items = authorized(connection.email) { token ->
          if (transport.account(token).subject != connection.subject) throw CalendarFailure("ACCOUNT_MISMATCH")
          val runner = CalendarAutomaticRunner(this, transport)
          ids.map { id ->
            val saved = links { store -> mapOf("title" to store.record(id)?.title, "calendarName" to store.link(id)?.calendarName, "email" to store.link(id)?.accountEmail) }
            try {
            val preview = runner.preview(token, id, true)
            @Suppress("UNCHECKED_CAST") val selections = preview["selections"] as Map<String, String?>
            val reason = if (selections.values.any { it == null }) "ChangesNeedReview" else preflight(preview["previewId"] as String, selections)
            saved + mapOf("occurrenceId" to id, "preview" to preview, "excludedReason" to reason?.let { code -> access { it.sync.reason(code) } })
          }
            catch (error: CalendarFailure) { saved + mapOf("occurrenceId" to id, "preview" to null, "excludedReason" to access { it.sync.reason(error.code) }) } }
        }
        resolve(mapOf("items" to items))
      } catch (error: Exception) { reject((error as? CalendarFailure)?.code ?: "NETWORK") }
    }
  }
  override fun <T> links(write: Boolean, block: (CalendarLinkStore) -> T): T = access(write) { block(it.links) }
  override fun preflight(previewId: String, selections: Map<String, String?>): String? {
    val result = CompletableFuture<String?>()
    engine.request({ engine.calendarPreflight(previewId, selections) }, { result.complete(it as? String) }, { result.completeExceptionally(CalendarFailure(it)) })
    return result.get(15, TimeUnit.SECONDS)
  }
  override fun local(operationId: String, connectionRevision: Long): Map<String, Any?> {
    val result = CompletableFuture<Map<String, Any?>>()
    engine.request({
      if (transport.cancelled()) throw CalendarFailure("CANCELLED")
      engine.calendarLocal(operationId, connectionRevision)
    }, { @Suppress("UNCHECKED_CAST") result.complete(it as Map<String, Any?>) },
      { result.completeExceptionally(CalendarFailure(it)) })
    try { return result.get(15, TimeUnit.SECONDS) }
    catch (error: ExecutionException) { throw (error.cause as? CalendarFailure ?: CalendarFailure("NOT_AVAILABLE")) }
  }
  override fun context(id: String): Map<*, *> {
    val result = CompletableFuture<Map<*, *>>()
    engine.request({ engine.calendarContext(id) }, { result.complete(it as? Map<*, *> ?: emptyMap<String, Any>()) },
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
            val page = transport.recurringEvents(token, calendarId, range.first, range.second, pageToken)
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
            val rawLookup = transport.lookup(token, calendarId, eventId)
            val lookup = if (rawLookup is CalendarEventLookup.Found && rawLookup.event.has("recurrence"))
              CalendarEventLookup.Found(transport.inspectRecurring(token, calendar, rawLookup.event)) else rawLookup
            if (action == "check") {
              return@authorized links(true) { it.observe(observation ?: throw CalendarFailure("INELIGIBLE"), calendar, lookup) }
            }
            observation?.let { guard -> links(true) { it.observe(guard, calendar, lookup) } }
            val event = when (lookup) {
              is CalendarEventLookup.Found -> lookup.event
              CalendarEventLookup.Missing -> throw CalendarFailure("REMOTE_UNAVAILABLE")
              CalendarEventLookup.Deleted -> throw CalendarFailure("REMOTE_DELETED")
            }
            if (id != null && event.has("recurrence")) {
              val children = links { it.resources(id).filter { resource -> resource.resourceId != "master" && resource.nominalSlot.isEmpty() } }
              val fields = org.json.JSONArray(); val sources = org.json.JSONArray()
              children.sortedBy { it.segmentId }.forEach { resource ->
                val child = (transport.lookup(token, resource.calendarId, resource.eventId) as? CalendarEventLookup.Found)?.event ?: throw CalendarFailure("REMOTE_UNAVAILABLE")
                if (!CalendarMapper.matching(child, resource.eventId)) throw CalendarFailure("FOREIGN_IDENTITY")
                val inspectedChild = transport.inspectRecurring(token, calendar, child)
                val snapshot = CalendarLinkMapper.fields(inspectedChild, calendar.zoneId)
                fields.put(snapshot); sources.put(org.json.JSONObject().put("segmentId", resource.segmentId).put("eventId", resource.eventId).put("etag", child.getString("etag")).put("fields", snapshot)
                  .put("instances", inspectedChild.optJSONArray("remiloInstances") ?: org.json.JSONArray()))
              }
              val sorted = (0 until fields.length()).map { fields.getJSONObject(it) }.sortedBy { it.getJSONObject("schedule").getLong("eventStartMs") }
              event.put("remiloSegments", org.json.JSONArray(sorted)).put("remiloSegmentSources", sources)
            }
            if (event.optString("id") != eventId) throw CalendarFailure("FOREIGN_IDENTITY")
            if (publicationJob != null && !CalendarMapper.matching(event, eventId)) throw CalendarFailure("FOREIGN_IDENTITY")
            if (id != null && event.has("recurrence")) {
              val schedule = links { it.fields(id).getJSONObject("schedule") }
              val nativeInstances = schedule.optJSONArray("exceptions") ?: org.json.JSONArray()
              val inspected = event.optJSONArray("remiloInstances") ?: org.json.JSONArray()
              val known = (0 until inspected.length()).map { inspected.getJSONObject(it).getString("nominalSlot") }.toSet()
              for (index in 0 until nativeInstances.length()) {
                val nominal = nativeInstances.getJSONObject(index).getString("nominalSlot")
                if (nominal in known) continue
                val slot = java.time.LocalDateTime.parse(nominal)
                val original = if (schedule.getBoolean("allDay")) slot.toLocalDate().toString()
                  else slot.atZone(java.time.ZoneId.of(schedule.getString("zoneId"))).toInstant().toString()
                val instance = transport.instance(token, calendar.id, eventId, original) ?: throw CalendarFailure("INSTANCE_REQUIRES_REVIEW")
                if (instance.optString("recurringEventId") != eventId || CalendarRecurrence.originalSlot(instance, schedule.getString("zoneId")).toString() != nominal)
                  throw CalendarFailure("FOREIGN_IDENTITY")
                inspected.put(CalendarRecurringReview(transport).descriptor(instance, schedule.getString("zoneId"), false))
              }
              event.put("remiloInstances", inspected)
            }
            @Suppress("UNCHECKED_CAST") val choices = input["choices"] as? Map<String, Any?> ?: emptyMap()
            val snapshot = id?.let(::context)
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
        transport.deadlineElapsedMs = android.os.SystemClock.elapsedRealtime() + 120_000
        val job = links { it.operation(id) } ?: throw CalendarFailure("NOT_FOUND")
        if (job.state in CalendarLinkStore.terminal || job.erased) return@execute
        val connection = links { it.connection() }
        if (!connection.connected || connection.subject != job.subject) throw CalendarFailure("NEEDS_ACCESS")
        if (!retry && connection.revision != job.expectedConnectionRevision) throw CalendarFailure("STALE_CONNECTION")
        authorized(connection.email) { token ->
          val managedImport = job.kind == "ImportCalendarEvent" && access { it.managed.dao.candidates().any { candidate -> candidate.operationId == id } }
          if (managedImport) {
            val transfers = CalendarManagedTransfers(this, transport, { if (android.os.SystemClock.elapsedRealtime() >= transport.deadlineElapsedMs) throw CalendarFailure("BUDGET") })
            if (!transfers.verifyCapturedImport(token, id)) return@authorized
            CalendarLinkRunner(this, transfers.capturedImportTransport(id)).run(id, token, connection.revision)
          } else CalendarLinkRunner(this, transport, inspectRecurring = true).run(id, token, connection.revision)
          if (links { it.operation(id)?.state } == "NeedsAccess") try { authorization.clear(token) } catch (_: Exception) { /* Visible recovery. */ }
        }
      } catch (error: Exception) { links(true) { it.fail(id, (error as? CalendarFailure)?.code ?: "NEEDS_ACCESS") } }
      finally { transport.deadlineElapsedMs = Long.MAX_VALUE; running.remove(id); CalendarWork.reconcile(context, opportunity = true) }
    }
  }
  override fun <T> access(write: Boolean, block: (CalendarStore) -> T): T {
    val result = CompletableFuture<T>()
    engine.calendarRequest(write, { store ->
      if (write && transport.cancelled()) throw CalendarFailure("CANCELLED")
      block(store)
    }, { result.complete(it) }, { result.completeExceptionally(CalendarFailure(it)) })
    try { return result.get(15, TimeUnit.SECONDS) }
    catch (error: ExecutionException) { throw (error.cause as? CalendarFailure ?: CalendarFailure("NOT_AVAILABLE")) }
  }
  private fun token(email: String): String {
    if (transport.cancelled()) throw CalendarFailure("CANCELLED")
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
          val managed = access { it.managed.setupOperation(publicationId) }
          if (managed != null) {
            if (managed.subject != account.subject || !account.emailVerified) throw CalendarFailure("ACCOUNT_MISMATCH")
            access(true) { store ->
              if (!store.managed.operationActive(publicationId)) throw CalendarFailure("STALE_AUTHORIZATION")
              store.connect(account, expectedRevision)
              store.managed.reauthorize(publicationId, expectedRevision, store.connection().revision)
            }
            done(true); startManaged(publicationId, token); return@execute
          }
          val linkJob = links { it.operation(publicationId) }
          if (linkJob != null) {
            if (account.subject != linkJob.subject) throw CalendarFailure("ACCOUNT_MISMATCH")
            access(true) { it.connect(account, expectedRevision) }
            CalendarLinkRunner(this, transport, inspectRecurring = true).run(publicationId, token, links { it.connection().revision })
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
        if (publicationId != null) access(true) { if (it.managed.setupOperation(publicationId) != null) it.managed.setupFailed(publicationId, code) else if (it.links.operation(publicationId) != null) it.links.fail(publicationId, code) else it.fail(publicationId, code) }
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

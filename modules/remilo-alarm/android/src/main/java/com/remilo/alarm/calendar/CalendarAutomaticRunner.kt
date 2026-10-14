package com.remilo.alarm.calendar

import org.json.*
import java.time.*
import java.util.UUID

interface CalendarAutomaticAccess : CalendarStateAccess, CalendarLinkAccess {
  fun context(id: String): Map<*, *>
  fun preflight(previewId: String, selections: Map<String, String?>): String? = null
}
data class CalendarRunSummary(val pages: Int, val attempted: Int, val confirmed: Int, val continuation: Boolean,
  val imported: Int = 0, val published: Int = 0, val adopted: Int = 0, val deferred: Int = 0, val excluded: Int = 0, val review: Int = 0) {
  fun view() = mapOf("pages" to pages, "attempted" to attempted, "confirmed" to confirmed, "continuation" to continuation,
    "imported" to imported, "published" to published, "adopted" to adopted, "deferred" to deferred, "excluded" to excluded, "review" to review)
}

/** All I/O runs on Calendar's executor; short access() commits yield to alarm actions. */
class CalendarAutomaticRunner(private val state: CalendarAutomaticAccess, private val transport: CalendarTransport,
  private val now: () -> Long = System::currentTimeMillis, private val elapsed: () -> Long = android.os.SystemClock::elapsedRealtime) {
  private var deadline = Long.MAX_VALUE
  private var backgroundRun = false
  private fun budget() { if (elapsed() >= deadline) throw CalendarFailure("BUDGET") }
  fun run(token: String, background: Boolean, associationId: String? = null, deadlineElapsedMs: Long = elapsed() + 120_000,
    initialPages: Int = 0): CalendarRunSummary {
    deadline = deadlineElapsedMs
    backgroundRun = background
    val connection = state.access { it.connection() }
    if (!connection.connected) throw CalendarFailure("NEEDS_ACCESS")
    if (state.access { it.managed.active() }) state.access(true) { it.managed.attempted() }
    val account = transport.account(token)
    if (account.subject != connection.subject) throw CalendarFailure("ACCOUNT_MISMATCH")
    if (state.access { it.managed.active() } && !account.emailVerified) throw CalendarFailure("OWNERSHIP_UNKNOWN")
    var pages = initialPages; var attempted = 0; var confirmed = 0; var continuation = false
    var imported = 0; var published = 0; var adopted = 0; var deferred = 0; var excluded = 0; var review = 0
    val rebuilding = mutableSetOf<String>()
    val activationWork = state.access { it.sync.pending() }
    if (activationWork.size > 10) continuation = true
    for (operationId in activationWork.take(10)) {
      budget()
      val job = state.links { it.operation(operationId) } ?: continue
      if (state.access { it.sync.state(job.occurrenceId).mode } != "Pending") continue
      attempted++
      if (job.kind == "ImportCalendarEvent" && state.access { it.managed.dao.candidates().any { candidate -> candidate.operationId == operationId } }) {
        val transfers = CalendarManagedTransfers(state, transport, ::budget, now)
        if (!transfers.verifyCapturedImport(token, operationId, background)) { continuation = true; continue }
        CalendarLinkRunner(state, transfers.capturedImportTransport(operationId), background = backgroundRun).run(operationId, token, connection.revision)
        if (!job.localApplied && state.links { it.operation(operationId)?.localApplied } == true) imported++
        if (state.links { it.operation(operationId)?.state } == "Confirmed") confirmed++
        continue
      }
      val bounded = object : CalendarTransport by transport {
        override fun inspectRecurring(token: String, calendar: OwnedCalendar, event: JSONObject): JSONObject {
          // Pending activation permits recovery of its reviewed resources, not a new collection scan.
          val draft = JSONObject(job.draft)
          val children = draft.optJSONArray("calendarResources") ?: JSONArray()
          val selected = if (event.optString("id") == job.eventId) draft.optJSONArray("calendarInstances") else
            (0 until children.length()).map { children.getJSONObject(it) }.firstOrNull { it.optString("eventId") == event.optString("id") }?.optJSONArray("instances")
          val resources = JSONArray()
          for (index in 0 until (selected?.length() ?: 0)) {
            budget()
            val previous = selected!!.getJSONObject(index)
            val actual = (transport.lookup(token, job.calendarId, previous.getString("eventId")) as? CalendarEventLookup.Found)?.event ?: throw CalendarFailure("REMOTE_UNAVAILABLE")
            if (actual.optString("recurringEventId") != event.getString("id")) throw CalendarFailure("FOREIGN_IDENTITY")
            resources.put(CalendarRecurringReview(transport, now).descriptor(actual, calendar.zoneId, previous.optBoolean("exception", true)))
          }
          return JSONObject(event.toString()).put("remiloInstances", resources)
        }
        override fun syncEvents(token: String, calendarId: String, syncToken: String?, pageToken: String?): JSONObject {
          budget(); return transport.syncEvents(token, calendarId, syncToken, pageToken)
        }
        override fun instance(token: String, calendarId: String, masterId: String, originalStart: String): JSONObject? {
          budget(); return transport.instance(token, calendarId, masterId, originalStart)
        }
      }
      CalendarLinkRunner(state, bounded, inspectRecurring = true, background = backgroundRun).run(operationId, token, connection.revision)
      if (state.links { it.operation(operationId)?.state } == "Confirmed") {
        confirmed++
        if (job.kind == "EnableCalendarLink") adopted++
      }
    }
    val calendars = state.access { it.incremental.calendars() }
    for (calendarId in calendars) {
      if (pages >= 10 || elapsed() >= deadline) { continuation = true; break }
      val calendar = try { transport.calendar(token, calendarId) } catch (error: CalendarFailure) {
        if (!state.access { it.managed.binding().let { binding -> binding.subject == connection.subject && binding.calendarId == calendarId } } ||
          error.code in setOf("AUTH", "NEEDS_ACCESS", "ACCOUNT_MISMATCH", "BUDGET", "CANCELLED")) throw error
        if (error.code in setOf("NETWORK", "RETRY", "NOT_AVAILABLE")) {
          state.access(true) { it.managed.failedAttempt() }; continuation = true
        } else state.access(true) { it.managed.accessChanged(error.code); it.managed.issue("Setup", it.managed.binding().operationId, error.code, background) }
        continue
      }
      if (state.access { it.managed.permitsCalendar(connection.subject, calendarId) }) {
        try { state.access(true) { it.refreshManagedCalendar(calendar) } }
        catch (error: CalendarFailure) { state.access(true) { it.managed.accessChanged(error.code); it.managed.issue("Setup", it.managed.binding().operationId, error.code, background) }; continue }
      }
      if (calendar.accessRole != "owner") {
        state.access(true) { store -> store.links.links().filter { it["source"]?.let { source -> (source as? Map<*, *>)?.get("calendarId") } == calendarId }
          .forEach { store.sync.issue(it["occurrenceId"] as String, "NOT_OWNER", background, "Paused") } }
        continue
      }
      var cursor = state.access(true) { it.incremental.begin(it.incremental.cursor(calendarId), connection.revision) }
      do {
        if (pages >= 10 || elapsed() >= deadline) { continuation = true; break }
        try {
          val page = transport.syncEvents(token, calendarId, cursor.startingToken.takeIf(String::isNotBlank), cursor.pageToken.takeIf(String::isNotBlank))
          cursor = state.access(true) { it.incremental.page(cursor, connection.revision, page, calendar.zoneId, calendar, background) }; pages++
        } catch (error: CalendarFailure) {
          if (error.code != "SYNC_TOKEN_EXPIRED") throw error
          cursor = state.access(true) { it.incremental.expired(cursor, connection.revision) }
          rebuilding.add(calendarId)
          continuation = true; break
        }
      } while (cursor.paging)
    }
    if (associationId == null) {
      val transfers = CalendarManagedTransfers(state, transport, ::budget, now)
      val importWork = state.access { it.managed.candidates() }
      if (importWork.size > 10) continuation = true
      for (candidate in importWork.take(10)) {
        if (attempted >= 50 || elapsed() >= deadline) { continuation = true; break }
        attempted++
        when (transfers.importCandidate(token, candidate, background)) {
          "Imported" -> { imported++; confirmed++ }; "Excluded" -> excluded++; "Review" -> review++
          else -> { deferred++; continuation = true }
        }
        state.access(true) { store -> store.managed.candidate(candidate.candidateId)?.let { current ->
          store.managed.dao.candidate(current.copy(observedAtMs = now()))
        } }
      }
      val exportWork = state.access { it.managed.pendingIntents() }
      if (exportWork.size > 10) continuation = true
      for (intent in exportWork.take(10)) {
        if (attempted >= 50 || elapsed() >= deadline) { continuation = true; break }
        attempted++
        when (transfers.publish(token, intent, background)) {
          "Published" -> { published++; confirmed++ }; "Excluded" -> excluded++; "Review" -> review++
          else -> { deferred++; continuation = true }
        }
      }
    }
    val candidates = state.access { store -> store.links.links().map { it["occurrenceId"] as String }
      .filter { associationId == null || it == associationId }
      .filter { store.sync.eligible(it) || associationId == it && store.sync.state(it).mode != "Manual" && store.sync.state(it).status == "Unconfirmed" }
      .sortedWith(compareBy<String> { store.sync.state(it).attemptedAtMs ?: 0 }.thenBy { it }) }
    for (id in candidates) {
      if (attempted >= 50 || elapsed() >= deadline) { continuation = true; break }
      val saved = state.access { it.sync.state(id) }
      if (saved.retryAtMs > now()) { continuation = true; continue }
      val link = state.links { it.link(id) } ?: continue
      val observation = state.links { it.guard(id) }
      // Recurring comparisons wait for a complete consistent collection, including empty pages.
      val cursor = state.access { it.incremental.cursor(link.calendarId) }
      if (cursor.paging || link.calendarId in rebuilding) { continuation = true; continue }
      attempted++
      try {
        val oldJob = saved.operationId.takeIf(String::isNotBlank)?.let { op -> state.links { it.operation(op) } }
        if (oldJob != null && oldJob.state !in CalendarLinkStore.terminal) {
          CalendarLinkRunner(state, observingTransport(id), inspectRecurring = false, background = backgroundRun).run(oldJob.operationId, token, connection.revision)
          if (state.links { it.operation(oldJob.operationId)?.state } == "Confirmed") confirmed++
          continue
        }
        val preview = preview(token, id, activation = false)
        @Suppress("UNCHECKED_CAST") val selections = preview["selections"] as Map<String, String?>
        if (selections.values.any { it == null }) { state.access(true) { it.sync.issue(id, "ChangesNeedReview", background, content = preview["fingerprint"] as String) }; continue }
        val unsafe = state.preflight(preview["previewId"] as String, selections)
        if (unsafe != null) {
          if (unsafe == "RINGING_DEFERRED") state.access(true) { it.sync.defer(id) }
          else state.access(true) { it.sync.issue(id, unsafe, background, content = preview["fingerprint"] as String) }
          continue
        }
        if (preview["equal"] == true) {
          val guard = state.links { it.guard(id) }
          val calendar = transport.calendar(token, link.calendarId)
          val event = observed(token, link, calendar)
          state.access(true) { it.sync.agreement(id, guard, event) }; confirmed++; continue
        }
        val command = mapOf("kind" to "AutomaticCalendarTransfer", "operationId" to UUID.randomUUID().toString(), "previewId" to preview["previewId"], "selections" to selections)
        val job = state.links(true) { store -> store.capture(command); store.operation(command["operationId"] as String)!! }
        CalendarLinkRunner(state, observingTransport(id), inspectRecurring = false, background = backgroundRun).run(job.operationId, token, connection.revision)
        if (state.links { it.operation(job.operationId)?.state } == "Confirmed") confirmed++
      } catch (error: CalendarFailure) {
        if (error.code == "BUDGET") { continuation = true; break }
        if (error.code in setOf("STALE_PREVIEW", "STALE_CONNECTION", "STALE_REMOTE", "STALE_CURSOR")) { continuation = true; continue }
        if (error.code in setOf("NETWORK", "RETRY", "NOT_AVAILABLE")) { state.access(true) { it.sync.transient(id) }; continuation = true; continue }
        state.access(true) { store ->
          if (store.links.guard(id) == observation) {
            store.links.observedFailure(id, error.code, observation, background)
            store.sync.issue(id, error.code, background, "Paused")
          }
        }
      }
    }
    continuation = continuation || state.access { store -> store.sync.nextRetryMs() != null || store.incremental.calendars().any { store.incremental.cursor(it).paging } }
    continuation = continuation || state.access { it.managed.nextRetryMs() != null }
    return CalendarRunSummary(pages, attempted, confirmed, continuation, imported = imported, published = published, adopted = adopted,
      deferred = deferred, excluded = excluded, review = review).also { value -> state.access(true) { it.sync.saveRun(value) } }
  }
  fun preview(token: String, id: String, activation: Boolean): Map<String, Any?> {
    budget()
    val link = state.links { it.link(id) } ?: throw CalendarFailure("NOT_FOUND")
    if (activation && state.links { it.operations().any { job -> job["occurrenceId"] == id && job["state"] !in CalendarLinkStore.terminal } })
      throw CalendarFailure("OPERATION_PENDING")
    val guard = state.links { it.guard(id) }
    val connection = state.links { it.connection() }
    if (!connection.connected || connection.subject != link.subject) throw CalendarFailure("NEEDS_ACCESS")
    if (link.erased || link.state == "Detached" || link.requiresReview || link.availability !in setOf("Available", "Unknown")) throw CalendarFailure("INELIGIBLE")
    val calendar = transport.calendar(token, link.calendarId)
    if (calendar.accessRole != "owner") throw CalendarFailure("NOT_OWNER")
    val event = observed(token, link, calendar, activation)
    val context = state.context(id)
    return state.links(true) { store ->
      if (store.guard(id) != guard) throw CalendarFailure("STALE_PREVIEW")
      val local = store.fields(id); val remote = CalendarLinkMapper.fields(event, calendar.zoneId)
      val result = CalendarComparison.compare(local, remote, store.comparisonBaseline(id))
      val selections = listOf("title", "notes", "schedule").associateWith { if (it in result.conflicts) null else if (it in result.inbound) "google" else "remilo" }
      val preview = store.preview(calendar, event, id, mapOf("automaticSync" to true), (context["generation"] as? Number)?.toLong() ?: 0,
        (context["nextAlertMs"] as? Number)?.toLong().takeIf { context["alertAdjustment"] != null })
      preview + mapOf("selections" to selections, "automaticSync" to true, "activation" to activation, "equal" to CalendarLinkMapper.equal(local, remote),
        "transfers" to mapOf("inbound" to result.inbound.toList(), "outbound" to result.outbound.toList()),
        "fingerprint" to CalendarMapper.hash(JSONArray(listOf(local, remote)).toString()))
    }
  }
  private fun observingTransport(id: String): CalendarTransport = object : CalendarTransport by transport {
    override fun lookup(token: String, calendarId: String, eventId: String): CalendarEventLookup {
      budget()
      val link = state.links { it.link(id) } ?: throw CalendarFailure("INELIGIBLE")
      if (calendarId == link.calendarId && eventId == link.eventId) return CalendarEventLookup.Found(observed(token, link, transport.calendar(token, calendarId)))
      return transport.lookup(token, calendarId, eventId)
    }
    override fun patch(token: String, calendarId: String, eventId: String, etag: String, payload: String): JSONObject {
      budget(); return transport.patch(token, calendarId, eventId, etag, payload)
    }
    override fun insert(token: String, calendarId: String, payload: String): JSONObject { budget(); return transport.insert(token, calendarId, payload) }
  }
  private fun observed(token: String, link: CalendarLink, calendar: OwnedCalendar, review: Boolean = false): JSONObject {
    budget()
    val guard = state.links { it.guard(link.occurrenceId) }
    val source = when (val lookup = transport.lookup(token, link.calendarId, link.eventId)) {
      is CalendarEventLookup.Found -> lookup.event
      CalendarEventLookup.Deleted -> throw CalendarFailure("REMOTE_DELETED")
      CalendarEventLookup.Missing -> throw CalendarFailure("REMOTE_UNAVAILABLE")
    }
    if (source.optString("id") != link.eventId || link.origin == "Published" && !CalendarMapper.matching(source, link.eventId)) throw CalendarFailure("FOREIGN_IDENTITY")
    CalendarLinkMapper.reason(source, calendar.zoneId)?.let { code ->
      state.links(true) { it.observe(guard, calendar, CalendarEventLookup.Found(source), backgroundRun) }
      throw CalendarFailure(if (source.optString("status") == "cancelled") "REMOTE_DELETED" else code)
    }
    CalendarLinkMapper.fields(source, calendar.zoneId) // Validate before keeping any content.
    if (source.has("recurrence")) {
      inspectResource(token, link, calendar, source, state.links { it.fields(link.occurrenceId) }, review)
      val children = state.links { it.resources(link.occurrenceId).filter { it.resourceId != "master" && it.nominalSlot.isEmpty() } }
      val fields = JSONArray(); val sources = JSONArray()
      for (child in children) {
        budget()
        val event = (transport.lookup(token, child.calendarId, child.eventId) as? CalendarEventLookup.Found)?.event ?: throw CalendarFailure("REMOTE_UNAVAILABLE")
        if (!CalendarMapper.matching(event, child.eventId)) throw CalendarFailure("FOREIGN_IDENTITY")
        val native = state.links { store -> store.segments(link.occurrenceId).firstOrNull { it.id == child.segmentId }?.let(store::segmentFields) }
          ?: throw CalendarFailure("STALE_PREVIEW")
        inspectResource(token, link, calendar, event, native, review)
        val snapshot = CalendarLinkMapper.fields(event, calendar.zoneId)
        fields.put(snapshot); sources.put(JSONObject().put("segmentId", child.segmentId).put("eventId", child.eventId).put("etag", event.getString("etag"))
          .put("fields", snapshot).put("instances", event.optJSONArray("remiloInstances") ?: JSONArray()))
      }
      source.put("remiloSegments", JSONArray((0 until fields.length()).map { fields.getJSONObject(it) }.sortedBy { it.getJSONObject("schedule").getLong("eventStartMs") })).put("remiloSegmentSources", sources)
    }
    return state.links { it.normalizeEvent(link.occurrenceId, source) }
  }
  private fun inspectResource(token: String, link: CalendarLink, calendar: OwnedCalendar, source: JSONObject, native: JSONObject, review: Boolean) {
    val schedule = CalendarLinkMapper.fields(source, calendar.zoneId).getJSONObject("schedule")
    val zone = ZoneId.of(schedule.getString("zoneId")); val masterId = source.getString("id")
    val recurrence = schedule.optJSONArray("recurrence") ?: throw CalendarFailure("UNSUPPORTED_RECURRENCE")
    val rule = CalendarRecurrence.decode(recurrence, Instant.ofEpochMilli(schedule.getLong("eventStartMs")).atZone(zone).toLocalDateTime(),
      zone.id, schedule.getBoolean("allDay"), if (schedule.getBoolean("allDay")) 86_400_000 else schedule.getLong("eventEndMs") - schedule.getLong("eventStartMs"))
    fun excluded(nominal: String) = state.links { it.excludedSlot(link.occurrenceId, masterId, nominal) }
    val instances = linkedMapOf<String, JSONObject>()
    if (review) {
      budget()
      val inspected = transport.inspectRecurring(token, calendar, source).optJSONArray("remiloInstances") ?: JSONArray()
      for (index in 0 until inspected.length()) {
        val row = inspected.getJSONObject(index); val nominal = row.getString("nominalSlot")
        if (!excluded(nominal)) instances[nominal] = row
      }
    }
    // Purged or terminal slots are discarded before an identity lookup can retrieve their content.
    for (cached in state.access { it.snapshots(link.occurrenceId) }) {
      val snapshot = JSONObject(cached.event)
      if (snapshot.optString("recurringEventId") != masterId) continue
      val nominal = CalendarRecurrence.originalSlot(snapshot, zone.id).toString()
      val originalMs = LocalDateTime.parse(nominal).atZone(zone).toInstant().toEpochMilli()
      val actualMs = snapshot.optJSONObject("start")?.let { start -> if (start.has("date")) LocalDate.parse(start.getString("date")).atStartOfDay(zone).toInstant().toEpochMilli()
        else OffsetDateTime.parse(start.getString("dateTime")).toInstant().toEpochMilli() } ?: originalMs
      if (excluded(nominal) || maxOf(originalMs, actualMs) <= now() || nominal in instances) continue
      budget()
      val event = (transport.lookup(token, link.calendarId, cached.eventId) as? CalendarEventLookup.Found)?.event ?: throw CalendarFailure("REMOTE_UNAVAILABLE")
      if (event.optString("id") != cached.eventId || event.optString("recurringEventId") != masterId || CalendarRecurrence.originalSlot(event, zone.id).toString() != nominal) throw CalendarFailure("FOREIGN_IDENTITY")
      instances[nominal] = CalendarRecurringReview(transport, now).descriptor(event, zone.id)
    }
    val nativeExceptions = native.getJSONObject("schedule").optJSONArray("exceptions") ?: JSONArray()
    val requested = linkedSetOf<String>()
    for (index in 0 until nativeExceptions.length()) requested.add(nativeExceptions.getJSONObject(index).getString("nominalSlot"))
    val ordinary = com.remilo.alarm.core.Recurrence.future(rule, now(), zone, "None").take(3).associateBy { it.nominal.toString() }
    requested.addAll(ordinary.keys)
    for (nominal in requested) {
      if (nominal in instances || excluded(nominal)) continue
      budget()
      val slot = LocalDateTime.parse(nominal)
      val original = if (rule.allDay) slot.toLocalDate().toString() else slot.atZone(zone).toInstant().toString()
      val event = transport.instance(token, link.calendarId, masterId, original) ?: throw CalendarFailure("RECURRENCE_MISMATCH")
      if (event.optString("recurringEventId") != masterId || CalendarRecurrence.originalSlot(event, zone.id).toString() != nominal) throw CalendarFailure("FOREIGN_IDENTITY")
      val fields = if (event.optString("status") == "cancelled") null else CalendarLinkMapper.fields(JSONObject(event.toString()).also { it.remove("recurringEventId") }, zone.id)
      val expected = ordinary[nominal]
      val exception = expected == null || fields == null || fields.getJSONObject("schedule").getLong("eventStartMs") != expected.eventStartMs || fields.getJSONObject("schedule").getLong("eventEndMs") != expected.eventEndMs ||
        fields.getString("title") != source.optString("summary") || fields.getString("notes") != source.optString("description")
      instances[nominal] = CalendarRecurringReview(transport, now).descriptor(event, zone.id, exception)
    }
    for ((nominal, row) in instances) if (row.optBoolean("cancelled") && !excluded(nominal)) {
      val guard = state.links { it.guard(link.occurrenceId) }
      state.links(true) { it.instanceDeleted(guard, masterId, row.getString("eventId"), nominal, backgroundRun) }
      throw CalendarFailure("REMOTE_INSTANCE_DELETED")
    }
    source.put("remiloInstances", JSONArray(instances.toSortedMap().values.toList()))
  }

}

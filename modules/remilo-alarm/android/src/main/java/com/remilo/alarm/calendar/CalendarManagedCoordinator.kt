package com.remilo.alarm.calendar

import org.json.*
import java.time.ZoneId
import java.util.UUID

/** Foreground I/O adapter. Saved authority and previews are always produced on the engine worker. */
class CalendarManagedCoordinator(private val state: CalendarAutomaticAccess, private val transport: CalendarTransport,
  private val authorization: CalendarAuthorization, private val now: () -> Long = System::currentTimeMillis) {
  private fun token(): String {
    val connection = state.access { it.connection() }
    if (!connection.connected) throw CalendarFailure("NEEDS_ACCESS")
    val token = authorization.token(connection.email)
    val account = transport.account(token)
    if (account.subject != connection.subject) throw CalendarFailure("ACCOUNT_MISMATCH")
    if (!account.emailVerified) throw CalendarFailure("OWNERSHIP_UNKNOWN")
    return token
  }
  fun setupPreview(choices: Map<String, Any?>): Map<String, Any?> {
    val connection = state.access { it.connection() }; val token = token()
    val saved = state.access { it.managed.binding() }
    val candidates = JSONArray(); val warnings = JSONArray()
    if (saved.calendarId.isNotBlank() && saved.subject == connection.subject) try {
      val bound = transport.calendar(token, saved.calendarId)
      CalendarManagedDiscovery.requireEligible(bound, connection.email)
      candidates.put(bound.managedJson().put("recognition", "Bound"))
    } catch (error: CalendarFailure) {
      if (choices["replacement"] != true) throw CalendarFailure(if (error.code in setOf("AUTH", "NEEDS_ACCESS", "OWNERSHIP_UNKNOWN", "NOT_OWNER")) error.code else "REMOTE_UNAVAILABLE")
      warnings.put("The saved calendar is unavailable. A replacement requires this new review; existing links keep their original source.")
    }
    val discovery = state.access(true) { store ->
      store.managed.dao.operations().lastOrNull { it.kind == "Discovery" && it.connectionRevision == connection.revision && store.managed.operationActive(it.operationId) }
        ?: store.managed.beginDiscovery(UUID.randomUUID().toString(), connection.revision, ZoneId.systemDefault().id, "")
    }
    if (!discovery.discoveryComplete) CalendarManagedSetupRunner(state, transport, authorization).run(discovery.operationId, token)
    val inspected = state.access { it.managed.setupOperation(discovery.operationId) } ?: throw CalendarFailure("NOT_FOUND")
    if (!inspected.discoveryComplete) throw CalendarFailure("DISCOVERY_INCOMPLETE")
    val known = (0 until candidates.length()).map { candidates.getJSONObject(it).getString("id") }.toMutableSet()
    CalendarManagedDiscovery.candidates(inspected.candidates).forEach { calendar ->
      if (known.add(calendar.id)) candidates.put(calendar.managedJson().put("recognition", if (CalendarManagedDiscovery.markerOperation(calendar.description) != null) "Recognized" else "NameOnly"))
    }
    val selected = choices["selectedCalendarId"] as? String ?: (0 until candidates.length()).map(candidates::getJSONObject)
      .firstOrNull { it.optString("recognition") == "Bound" }?.getString("id")
      ?: if (candidates.length() == 1) candidates.getJSONObject(0).getString("id") else null
    val calendar = selected?.let { id -> (0 until candidates.length()).map(candidates::getJSONObject).firstOrNull { it.getString("id") == id } }
    if (calendar != null) CalendarManagedDiscovery.requireEligible(OwnedCalendar.managedJson(calendar), connection.email)
    val items = JSONArray()
    @Suppress("UNCHECKED_CAST") val requested = choices["adoptOccurrenceIds"] as? List<String> ?: emptyList()
    if (requested.size > 500 || requested.distinct().size != requested.size) throw CalendarFailure("INVALID_INPUT")
    requested.forEach { id ->
      val row = JSONObject().put("itemId", "existing:$id").put("occurrenceId", id).put("kind", "Publish")
        .put("title", state.links { it.record(id)?.title }.orEmpty()).put("ready", false)
      if (calendar == null) row.put("reason", "Complete calendar setup before reviewing this existing reminder.")
      else try {
        val destination = OwnedCalendar.managedJson(calendar)
        val publication = state.access { it.publication(id) }
        if (publication?.get("state") == "Published") {
          val job = state.access { it.operation(publication["operationId"] as String) }!!
          if (job.subject != connection.subject || job.calendarId != destination.id) throw CalendarFailure("ACCOUNT_MISMATCH")
          val raw = (transport.lookup(token, destination.id, job.eventId) as? CalendarEventLookup.Found)?.event ?: throw CalendarFailure("REMOTE_UNAVAILABLE")
          if (!CalendarMapper.matching(raw, job.eventId)) throw CalendarFailure("FOREIGN_IDENTITY")
          val inspectedEvent = inspectKnownFamily(token, destination, raw, id)
          val context = state.context(id)
          val preview = state.links(true) { it.preview(destination, inspectedEvent, id, mapOf("automaticSync" to true), (context["generation"] as? Number)?.toLong() ?: 0) }
          @Suppress("UNCHECKED_CAST") val choicesByGroup = preview["selections"] as? Map<String, String?> ?: emptyMap()
          if (choicesByGroup.values.any { it == null } || state.preflight(preview["previewId"] as String, choicesByGroup) != null) throw CalendarFailure("RESOLUTION_REQUIRED")
          row.put("kind", "Adopt").put("linkPreviewId", preview["previewId"]).put("selections", JSONObject(choicesByGroup)).put("ready", true)
        } else {
          val preview = state.access { it.preview(id, destination) }
          row.put("publicationPreview", JSONObject(preview)).put("ready", true)
        }
      } catch (error: CalendarFailure) { row.put("reason", state.access { it.sync.reason(error.code) }) }
      items.put(row)
    }
    val sample = calendar?.let { source -> sample(token, OwnedCalendar.managedJson(source)) }
    return state.access(true) { store ->
      val preview = store.managed.previewSetup(choices, candidates, selected != null || candidates.length() == 0, selected, candidates.length() == 0, items, warnings)
      // Read-only sample is context; it grants no per-event permission or durable import intent.
      preview + mapOf("sample" to sample)
    }
  }
  private fun sample(token: String, calendar: OwnedCalendar): Map<String, Any?> {
    val page = transport.syncEvents(token, calendar.id, null, null)
    val rows = page.optJSONArray("items") ?: JSONArray()
    val visible = mutableListOf<Map<String, Any?>>()
    for (index in 0 until rows.length()) {
      val event = rows.getJSONObject(index)
      if (event.optString("status") == "cancelled" || event.has("recurringEventId")) continue
      val reason = CalendarLinkMapper.reason(event, calendar.zoneId)
      val fields = runCatching { CalendarLinkMapper.fields(event, calendar.zoneId) }.getOrNull()
      if (!event.has("recurrence") && fields?.getJSONObject("schedule")?.getLong("eventEndMs")?.let { it <= now() } == true) continue
      if (visible.size < 5) visible.add(mapOf("title" to event.optString("summary").take(200).ifBlank { "Untitled Calendar event" },
        "description" to if (reason != null) "Needs individual review" else if (event.has("recurrence")) "Repeating event · native validation follows confirmation"
          else "Ongoing or upcoming event · alert timing is checked before import"))
    }
    return mapOf("inspectedCount" to rows.length(), "complete" to page.optString("nextPageToken").isBlank(), "items" to visible)
  }
  fun resumePreview(): Map<String, Any?> {
    val token = token(); val connection = state.access { it.connection() }; val binding = state.access { it.managed.binding() }
    val calendar = transport.calendar(token, binding.calendarId)
    CalendarManagedDiscovery.requireEligible(calendar, connection.email)
    val items = JSONArray()
    for (intent in state.access { it.managed.dao.exports() }.filter { it.subject == binding.subject && it.calendarId == binding.calendarId && it.state in setOf("Held", "Pending", "Review", "Captured") }) {
      val item = JSONObject().put("itemId", "export:${intent.localId}").put("kind", "Publish").put("occurrenceId", intent.localId)
        .put("title", state.links { it.record(intent.localId)?.title }.orEmpty()).put("ready", false)
      try {
        if (intent.operationId.isNotBlank()) {
          val job = state.access { it.operation(intent.operationId) } ?: throw CalendarFailure("NOT_FOUND")
          val remote = (transport.lookup(token, calendar.id, job.eventId) as? CalendarEventLookup.Found)?.event
          if (job.attempted && (remote == null || !CalendarMapper.matching(remote, job.eventId))) throw CalendarFailure("UNCONFIRMED_RESOURCE")
          if (state.access { it.publicationJobs(job.operationId).any { child -> child.attempted && !child.confirmed } }) throw CalendarFailure("UNCONFIRMED_RESOURCE")
          item.put("ready", true).put("operationId", job.operationId)
        } else { state.access { it.preview(intent.localId, calendar) }; item.put("ready", true) }
        val record = state.links { it.record(intent.localId) }
        if (record == null || record.completed || record.deleted || record.skipped) throw CalendarFailure("INELIGIBLE")
        item.put("localRevision", record.revision)
        if (record.eventEndMs <= now()) item.put("scope", "Past date; publishing preserves local alerts and unfinished work.")
      } catch (error: CalendarFailure) { item.put("ready", false).put("reason", state.access { it.sync.reason(error.code) }) }
      items.put(item)
    }
    for (candidate in state.access { it.managed.dao.candidates() }.filter { it.subject == binding.subject && it.calendarId == binding.calendarId && it.state in setOf("Held", "Pending", "Review") }) {
      val row = JSONObject().put("itemId", "candidate:${candidate.candidateId}").put("kind", "Import").put("candidateId", candidate.candidateId)
        .put("candidateRevision", candidate.revision).put("title", candidate.title).put("ready", false).put("alertMode", candidate.mode)
      try {
        if (candidate.operationId.isNotBlank()) throw CalendarFailure("OPERATION_PENDING")
        val preview = candidatePreview(candidate.candidateId, emptyMap())
        val guard = state.access { JSONObject(it.managed.reviewed(preview["previewId"] as String, "Candidate").payload) }
        if (!guard.optString("adoptionId").let { it.isBlank() || it == "null" }) throw CalendarFailure("ADOPTION_REQUIRED")
        @Suppress("UNCHECKED_CAST") val selections = preview["selections"] as? Map<String, String?> ?: emptyMap()
        if (selections.values.any { it == null } || state.preflight(guard.getString("linkPreviewId"), selections) != null) throw CalendarFailure("RESOLUTION_REQUIRED")
        row.put("ready", true).put("linkPreviewId", guard.getString("linkPreviewId"))
      } catch (error: CalendarFailure) { row.put("reason", state.access { it.sync.reason(error.code) }) }
      items.put(row)
    }
    for (link in state.links { it.links() }.filter { (it["source"] as? Map<*, *>)?.get("calendarId") == binding.calendarId && it["syncMode"] == "Automatic" }) {
      val id = link["occurrenceId"] as String
      val row = JSONObject().put("itemId", "association:$id").put("kind", "Transfer").put("occurrenceId", id)
        .put("title", state.links { it.record(id)?.title }.orEmpty()).put("ready", false)
        .put("linkRevision", state.links { it.link(id)?.revision }).put("localRevision", state.links { it.record(id)?.revision })
      try {
        val preview = CalendarAutomaticRunner(state, transport).preview(token, id, true)
        @Suppress("UNCHECKED_CAST") val selections = preview["selections"] as Map<String, String?>
        if (selections.values.any { it == null } || state.preflight(preview["previewId"] as String, selections) != null) throw CalendarFailure("RESOLUTION_REQUIRED")
        row.put("ready", true).put("linkPreviewId", preview["previewId"]).put("selections", JSONObject(selections))
      } catch (error: CalendarFailure) { row.put("reason", state.access { it.sync.reason(error.code) }) }
      items.put(row)
    }
    return state.access(true) { it.managed.previewResume(items) }
  }
  fun candidatePreview(id: String, choices: Map<String, Any?>): Map<String, Any?> {
    val candidate = state.access { it.managed.candidate(id) } ?: throw CalendarFailure("NOT_FOUND")
    val token = token(); val connection = state.access { it.connection() }
    if (candidate.subject != connection.subject) throw CalendarFailure("ACCOUNT_MISMATCH")
    val calendar = transport.calendar(token, candidate.calendarId)
    CalendarManagedDiscovery.requireEligible(calendar, connection.email)
    val event = (transport.lookup(token, calendar.id, candidate.eventId) as? CalendarEventLookup.Found)?.event ?: throw CalendarFailure("REMOTE_UNAVAILABLE")
    val adoption = state.access { it.managedAdoptionId(event, candidate.subject, candidate.calendarId) }
    val inspected = inspectKnownFamily(token, calendar, event, adoption)
    val context = adoption?.let { state.context(it) }
    return state.access(true) { store ->
      val policy = candidate.policySnapshot.takeIf(String::isNotBlank)?.let(::JSONObject) ?: JSONObject(store.managed.policyView())
      val link = store.links.preview(calendar, inspected, adoption, mapOf("mode" to candidate.mode, "automaticSync" to true,
        "allDayAlarmMinutes" to policy.optInt("allDayAlarmMinutes", 540),
        "disableReminders" to (candidate.mode != "None" && policy.optBoolean("disableGoogleReminders"))) + choices, (context?.get("generation") as? Number)?.toLong() ?: 0)
      val guard = store.managed.preview("Candidate", JSONObject().put("candidateId", id).put("candidateRevision", candidate.revision)
        .put("linkPreviewId", link["previewId"]).put("adoptionId", adoption ?: JSONObject.NULL).put("selections", link["selections"] ?: JSONObject()))
      link + mapOf("previewId" to guard["previewId"], "candidateId" to id, "candidateRevision" to candidate.revision)
    }
  }
  private fun inspectKnownFamily(token: String, calendar: OwnedCalendar, event: JSONObject, localId: String?): JSONObject {
    if (!event.has("recurrence")) return event
    val inspected = transport.inspectRecurring(token, calendar, event)
    if (localId == null) return inspected
    val children = state.links { it.resources(localId).filter { resource -> resource.resourceId != "master" && resource.nominalSlot.isEmpty() } }
    val fields = JSONArray(); val sources = JSONArray()
    for (resource in children.sortedBy { it.segmentId }) {
      val actual = (transport.lookup(token, resource.calendarId, resource.eventId) as? CalendarEventLookup.Found)?.event ?: throw CalendarFailure("REMOTE_UNAVAILABLE")
      if (!CalendarMapper.matching(actual, resource.eventId)) throw CalendarFailure("FOREIGN_IDENTITY")
      val child = transport.inspectRecurring(token, calendar, actual)
      val snapshot = CalendarLinkMapper.fields(child, calendar.zoneId)
      fields.put(snapshot); sources.put(JSONObject().put("segmentId", resource.segmentId).put("eventId", resource.eventId)
        .put("etag", actual.getString("etag")).put("fields", snapshot).put("instances", child.optJSONArray("remiloInstances") ?: JSONArray()))
    }
    return inspected.put("remiloSegments", JSONArray((0 until fields.length()).map(fields::getJSONObject)
      .sortedBy { it.getJSONObject("schedule").getLong("eventStartMs") })).put("remiloSegmentSources", sources)
  }
}

package com.remilo.alarm.calendar

import org.json.*
import java.time.*
import java.util.UUID

/** Managed candidates and publications are phases of the existing Calendar opportunity, not another worker. */
class CalendarManagedTransfers(private val state: CalendarAutomaticAccess, private val transport: CalendarTransport,
  private val budget: () -> Unit, private val now: () -> Long = System::currentTimeMillis) {
  fun importCandidate(token: String, candidate: CalendarManagedCandidate, background: Boolean): String {
    try {
      budget()
      val connection = state.access { it.connection() }
      val calendar = transport.calendar(token, candidate.calendarId)
      CalendarManagedDiscovery.requireEligible(calendar, connection.email)
      val cursor = state.access { it.incremental.cursor(calendar.id) }
      if (cursor.paging) return "Deferred"
      if (candidate.state == "Captured") {
        if (!verifyCapturedImport(token, candidate.operationId, background)) return "Deferred"
        CalendarLinkRunner(state, capturedImportTransport(candidate.operationId), background = background).run(candidate.operationId, token, connection.revision)
        return if (state.links { it.operation(candidate.operationId)?.localApplied } == true) "Imported" else "Deferred"
      }
      budget()
      val event = (transport.lookup(token, calendar.id, candidate.eventId) as? CalendarEventLookup.Found)?.event
        ?: throw CalendarFailure("REMOTE_UNAVAILABLE")
      if (event.optString("id") != candidate.eventId) throw CalendarFailure("FOREIGN_IDENTITY")
      if (event.optString("etag") != JSONObject(candidate.event).optString("etag")) {
        state.access(true) { it.managed.candidateObservation(event, background = background) }; return "Deferred"
      }
      val marker = event.optJSONObject("extendedProperties")?.optJSONObject("private")?.optString("remiloPublication").orEmpty()
      if (marker.isNotEmpty() && marker != candidate.eventId) throw CalendarFailure("FOREIGN_IDENTITY")
      val adoption = state.access { it.managedAdoptionId(event, candidate.subject, candidate.calendarId) }
      if (adoption != null) {
        val local = state.links { it.record(adoption) }
        if (local?.let { it.completed || it.deleted || it.skipped } == true) {
          state.access(true) { it.managed.suppress(candidate.remoteKey, "LocalTerminal", adoption) }; return "Excluded"
        }
        throw CalendarFailure("ADOPTION_REQUIRED")
      }
      if (state.links { it.source(candidate.remoteKey) } != null) {
        state.access(true) { it.managed.suppress(candidate.remoteKey, "Reserved") }; return "Excluded"
      }
      val inspected = if (event.has("recurrence")) CalendarManagedRecurrenceAudit(state, transport, now, budget)
        .inspect(token, candidate, calendar, event) ?: return "Deferred" else event
      val fields = CalendarLinkMapper.fields(inspected, calendar.zoneId)
      val schedule = fields.getJSONObject("schedule")
      val policy = candidate.policySnapshot.takeIf(String::isNotBlank)?.let(::JSONObject)
        ?: state.access { JSONObject(it.managed.policyView()) }
      val minutes = policy.optInt("allDayAlarmMinutes", 540)
      val alarm = if (schedule.getBoolean("allDay")) Instant.ofEpochMilli(schedule.getLong("eventStartMs"))
        .atZone(ZoneId.of(schedule.getString("zoneId"))).toLocalDate().atTime(minutes / 60, minutes % 60)
        .atZone(ZoneId.of(schedule.getString("zoneId"))).toInstant().toEpochMilli() else schedule.getLong("eventStartMs")
      if (!schedule.has("recurrence") && schedule.getLong("eventEndMs") <= now()) {
        state.access(true) { it.managed.dao.candidate(candidate.copy(state = "Excluded", event = "", reason = "Ended")) }; return "Excluded"
      }
      if (!schedule.has("recurrence") && candidate.mode != "None" && alarm <= now()) throw CalendarFailure("ELAPSED_ALERT")
      val operationId = UUID.randomUUID().toString()
      state.access(true) { store ->
        store.managed.beginImport(candidate.candidateId, operationId, candidate.revision)
        val preview = store.links.preview(calendar, inspected, null, mapOf("mode" to candidate.mode,
          "automaticSync" to true, "allDayAlarmMinutes" to minutes,
          "disableReminders" to (candidate.mode != "None" && policy.optBoolean("disableGoogleReminders"))), 0)
        store.captureManagedImport(candidate, operationId, preview["previewId"] as String)
      }
      if (!verifyCapturedImport(token, operationId, background)) return "Deferred"
      CalendarLinkRunner(state, capturedImportTransport(operationId), background = background).run(operationId, token, connection.revision)
      return if (state.links { it.operation(operationId)?.localApplied } == true) "Imported" else "Deferred"
    } catch (error: CalendarFailure) {
      if (error.code in setOf("BUDGET", "STALE_PREVIEW", "STALE_AUTHORIZATION", "STALE_CURSOR", "STALE_CONNECTION")) return "Deferred"
      if (error.code == "NO_UPCOMING_WORK") {
        state.access(true) { it.managed.dao.candidate(candidate.copy(state = "Excluded", event = "", reason = "Ended")) }; return "Excluded"
      }
      val saved = state.access { it.managed.candidate(candidate.candidateId) }
      // Captured verification owns its failure checkpoint; do not double the durable backoff.
      if (saved?.state == "Review" && saved.reason == error.code) return "Review"
      if (error.code in setOf("NETWORK", "RETRY", "NOT_AVAILABLE") && saved?.retryAtMs?.let { it > now() } == true) return "Deferred"
      state.access(true) { it.managed.candidateFailed(candidate.candidateId, error.code, background) }
      return if (error.code in setOf("NETWORK", "RETRY", "NOT_AVAILABLE")) "Deferred" else "Review"
    }
  }
  private data class CapturedVerification(val operationId: String, val candidateId: String, val key: String,
    val calendarId: String, val masterId: String, val zone: String, val descriptors: JSONArray, val nextIndex: Int)

  /** A foreground candidate confirmation uses the same bounded proof as a background import. */
  fun verifyCapturedImport(token: String, operationId: String, background: Boolean = false): Boolean {
    var frame: CapturedVerification? = null
    try {
      budget()
      val selected = state.access { verification(it, operationId) } ?: return true
      frame = selected
      if (selected.descriptors.length() > 503) throw CalendarFailure("RECURRENCE_REVIEW_LIMIT")
      var index = selected.nextIndex
      val end = minOf(selected.descriptors.length(), index + 6)
      while (index < end) {
        budget()
        state.access { requireVerification(it, selected) }
        val expected = selected.descriptors.getJSONObject(index)
        val eventId = expected.getString("eventId")
        val lookup = transport.lookup(token, selected.calendarId, eventId)
        when (lookup) {
          CalendarEventLookup.Missing -> throw CalendarFailure("REMOTE_UNAVAILABLE")
          CalendarEventLookup.Deleted -> if (!expected.optBoolean("cancelled")) throw CalendarFailure("REMOTE_DELETED")
          is CalendarEventLookup.Found -> {
            val actual = lookup.event
            if (actual.optString("id") != eventId || actual.optString("recurringEventId") != selected.masterId ||
              actual.has("recurrence") || CalendarRecurrence.originalSlot(actual, selected.zone).toString() != expected.getString("nominalSlot"))
              throw CalendarFailure("FOREIGN_IDENTITY")
            if (expected.optString("etag").isNotBlank() && actual.optString("etag") != expected.getString("etag")) throw CalendarFailure("STALE_REMOTE")
            val descriptor = CalendarRecurringReview(transport, now).descriptor(actual, selected.zone, expected.optBoolean("exception", true))
            if (descriptor.getBoolean("cancelled") != expected.optBoolean("cancelled") ||
              !expected.optBoolean("cancelled") && !CalendarLinkMapper.equal(descriptor.getJSONObject("fields"), expected.getJSONObject("fields")))
              throw CalendarFailure("STALE_REMOTE")
          }
        }
        budget()
        index++
        state.access(true) { store ->
          requireVerification(store, selected)
          val candidate = store.managed.candidate(selected.candidateId) ?: throw CalendarFailure("STALE_PREVIEW")
          val audit = candidate.audit.takeIf(String::isNotBlank)?.let(::JSONObject) ?: JSONObject()
          audit.put("capturedVerificationKey", selected.key).put("capturedVerificationIndex", index)
          store.managed.dao.candidate(candidate.copy(audit = audit.toString()))
        }
      }
      // Persist an empty proof as well, so the transport can fail closed on every path.
      if (selected.descriptors.length() == 0) state.access(true) { store ->
        requireVerification(store, selected)
        val candidate = store.managed.candidate(selected.candidateId) ?: throw CalendarFailure("STALE_PREVIEW")
        val audit = candidate.audit.takeIf(String::isNotBlank)?.let(::JSONObject) ?: JSONObject()
        store.managed.dao.candidate(candidate.copy(audit = audit.put("capturedVerificationKey", selected.key).put("capturedVerificationIndex", 0).toString()))
      }
      return index == selected.descriptors.length()
    } catch (error: CalendarFailure) {
      if (error.code !in setOf("BUDGET", "STALE_PREVIEW", "STALE_AUTHORIZATION", "STALE_CONNECTION", "STALE_CURSOR")) {
        frame?.let { current ->
          state.links(true) { it.fail(operationId, error.code, background) }
          state.access(true) { it.managed.candidateFailed(current.candidateId, error.code, background) }
        }
      }
      throw error
    }
  }

  private fun verification(store: CalendarStore, operationId: String): CapturedVerification? {
    val candidate = store.managed.dao.candidates().firstOrNull { it.operationId == operationId } ?: return null
    val job = store.links.operation(operationId) ?: throw CalendarFailure("NOT_FOUND")
    if (job.localApplied || job.kind != "ImportCalendarEvent" || !JSONObject(job.remote).getJSONObject("schedule").has("recurrence")) return null
    store.links.check(job, store.connection().revision)
    val descriptors = JSONObject(job.draft).optJSONArray("calendarInstances") ?: JSONArray()
    val eventIds = (0 until descriptors.length()).map { descriptors.getJSONObject(it).getString("eventId") }
    val nominals = (0 until descriptors.length()).map { descriptors.getJSONObject(it).getString("nominalSlot") }
    if (eventIds.distinct().size != eventIds.size || nominals.distinct().size != nominals.size) throw CalendarFailure("INVALID_INSTANCE")
    val cache = store.managed.dao.cache(candidate.subject, candidate.calendarId).filter { row -> row.eventId == candidate.eventId ||
      JSONObject(row.event).optString("recurringEventId") == candidate.eventId }.sortedBy { it.eventId }
    val fingerprint = CalendarMapper.hash(JSONArray(cache.map { row -> JSONArray(listOf(row.eventId, row.generation, row.event)) }).toString())
    val key = CalendarMapper.hash(JSONArray(listOf("managed-captured-verification-v1", operationId, candidate.revision, candidate.authEpoch,
      store.connection().revision, store.managed.binding().authEpoch, job.draft, job.remote, job.etag, fingerprint)).toString())
    val audit = candidate.audit.takeIf(String::isNotBlank)?.let(::JSONObject)
    val next = if (audit?.optString("capturedVerificationKey") == key) audit.optInt("capturedVerificationIndex").coerceIn(0, descriptors.length()) else 0
    val zone = JSONObject(job.remote).getJSONObject("schedule").getString("zoneId")
    return CapturedVerification(operationId, candidate.candidateId, key, candidate.calendarId, candidate.eventId, zone, descriptors, next)
  }
  private fun requireVerification(store: CalendarStore, expected: CapturedVerification) {
    val actual = verification(store, expected.operationId) ?: throw CalendarFailure("STALE_PREVIEW")
    if (actual.key != expected.key) throw CalendarFailure("STALE_PREVIEW")
  }

  /** Overlay only descriptors whose captured identity/version proof has completed. */
  fun capturedImportTransport(operationId: String): CalendarTransport = object : CalendarTransport by transport {
    override fun lookup(token: String, calendarId: String, eventId: String): CalendarEventLookup {
      budget()
      state.access { store -> verification(store, operationId)?.let { check ->
        val candidate = store.managed.candidate(check.candidateId) ?: throw CalendarFailure("STALE_PREVIEW")
        val audit = candidate.audit.takeIf(String::isNotBlank)?.let(::JSONObject)
        if (audit?.optString("capturedVerificationKey") != check.key || check.nextIndex != check.descriptors.length()) throw CalendarFailure("BUDGET")
      } }
      val found = transport.lookup(token, calendarId, eventId)
      val job = state.links { it.operation(operationId) } ?: return found
      if (found !is CalendarEventLookup.Found || eventId != job.eventId || calendarId != job.calendarId || !found.event.has("recurrence")) return found
      state.access { store -> verification(store, operationId)?.let { check ->
        if (check.nextIndex != check.descriptors.length()) throw CalendarFailure("STALE_PREVIEW")
      } }
      val instances = JSONObject(job.draft).optJSONArray("calendarInstances") ?: JSONArray()
      return CalendarEventLookup.Found(JSONObject(found.event.toString()).put("remiloInstances", instances))
    }
  }
  fun publish(token: String, intent: CalendarManagedExport, background: Boolean): String {
    var operationId = intent.operationId
    try {
      budget()
      val connection = state.access { it.connection() }
      val calendar = transport.calendar(token, intent.calendarId)
      CalendarManagedDiscovery.requireEligible(calendar, connection.email)
      val local = state.links { it.record(intent.localId) }
      if (local == null || local.deleted || local.completed || local.skipped) {
        state.access(true) { it.managed.retireIntent(intent.localId, "LocalTerminal") }; return "Excluded"
      }
      if (state.links { it.link(intent.localId) } != null) {
        state.access(true) { it.managed.retireIntent(intent.localId, "AlreadyLinked") }; return "Excluded"
      }
      if (intent.operationId.isNotEmpty() && state.access(true) { it.supersedeManagedPublication(intent.operationId) }) return "Deferred"
      val job = if (intent.state == "Captured") state.access { it.operation(intent.operationId) } ?: throw CalendarFailure("NOT_FOUND")
        else state.access(true) { it.captureManagedPublication(intent.localId, UUID.randomUUID().toString(), calendar) }
      operationId = job.operationId
      if (job.state != "Published") {
        val active = state.access(true) { it.begin(job.operationId) } ?: throw CalendarFailure("INELIGIBLE")
        CalendarPublisher(state, transport).publish(active, token)
      }
      val outcome = state.access { it.operation(job.operationId) } ?: return "Excluded"
      if (outcome.state == "Cancelled" || state.access { it.managed.intent(intent.localId)?.state } == "Cancelled") return "Excluded"
      if (outcome.state != "Published") {
        state.access(true) { it.managed.publicationFailed(intent.localId, if (outcome.attempted) "UNCONFIRMED_RESOURCE" else "RETRY", background, operationId) }
        return "Deferred"
      }
      budget()
      val event = (transport.lookup(token, calendar.id, job.eventId) as? CalendarEventLookup.Found)?.event ?: throw CalendarFailure("REMOTE_UNAVAILABLE")
      state.access(true) { it.completeManagedPublication(job.operationId, event) }
      return "Published"
    } catch (error: CalendarFailure) {
      if (error.code in setOf("BUDGET", "STALE_AUTHORIZATION", "STALE_PREVIEW")) return "Deferred"
      state.access(true) { it.managed.publicationFailed(intent.localId, error.code, background, operationId) }
      return if (error.code in setOf("NETWORK", "RETRY", "NOT_AVAILABLE")) "Deferred" else "Review"
    }
  }
}

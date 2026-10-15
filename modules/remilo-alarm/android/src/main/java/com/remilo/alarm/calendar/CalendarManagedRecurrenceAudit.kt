package com.remilo.alarm.calendar

import com.remilo.alarm.core.Recurrence
import com.remilo.alarm.core.RecurrenceRule
import com.remilo.alarm.core.ResolvedSlot
import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneId

/** Differential recurrence inspection uses the completed managed cache, never another full Calendar collection scan. */
class CalendarManagedRecurrenceAudit(private val state: CalendarStateAccess, private val transport: CalendarTransport,
  private val now: () -> Long = System::currentTimeMillis, private val budget: () -> Unit = {}) {
  private data class Snapshot(val generation: Long, val authEpoch: Long, val rows: List<CalendarManagedCache>, val fingerprint: String)
  fun inspect(token: String, candidate: CalendarManagedCandidate, calendar: OwnedCalendar, freshMaster: JSONObject): JSONObject? {
    budget()
    if (calendar.id != candidate.calendarId || freshMaster.optString("id") != candidate.eventId || freshMaster.optString("etag").isBlank())
      throw CalendarFailure("FOREIGN_IDENTITY")
    val fields = CalendarLinkMapper.fields(freshMaster, calendar.zoneId)
    val schedule = fields.getJSONObject("schedule")
    val recurrence = schedule.optJSONArray("recurrence") ?: return JSONObject(freshMaster.toString())
    val zone = ZoneId.of(schedule.getString("zoneId"))
    val rule = CalendarRecurrence.decode(recurrence, Instant.ofEpochMilli(schedule.getLong("eventStartMs")).atZone(zone).toLocalDateTime(),
      zone.id, schedule.getBoolean("allDay"), if (schedule.getBoolean("allDay")) 86_400_000 else schedule.getLong("eventEndMs") - schedule.getLong("eventStartMs"))
    val snapshot = state.access { store ->
      requireCandidate(store, candidate)
      CalendarManagedDiscovery.requireEligible(calendar, store.connection().email)
      val cursor = store.incremental.cursor(calendar.id)
      if (cursor.paging || cursor.syncToken.isBlank()) return@access null
      val rows = store.managed.instances(candidate.eventId).filter { it.generation == cursor.generation }
      Snapshot(cursor.generation, store.managed.binding().authEpoch, rows, cacheFingerprint(rows))
    } ?: return null
    val currentTime = now()
    val rows = snapshot.rows.map { JSONObject(it.event) }.filter { event -> futureException(event, rule, zone, currentTime) }
      .sortedBy { CalendarRecurrence.originalSlot(it, zone.id) }
    if (rows.size > 500) throw CalendarFailure("RECURRENCE_REVIEW_LIMIT")
    val nominals = rows.map { CalendarRecurrence.originalSlot(it, zone.id).toString() }
    if (nominals.distinct().size != nominals.size) throw CalendarFailure("INVALID_INSTANCE")
    val ordinary = Recurrence.future(rule, currentTime, zone, "None").filter { it.nominal.toString() !in nominals }.take(3).toList()
    val ongoing = Recurrence.future(rule, currentTime - rule.endOffsetMs - 2 * 86_400_000L, zone, "None")
      .takeWhile { it.eventStartMs <= currentTime }.filter { it.eventEndMs > currentTime && it.nominal.toString() !in nominals }.toList()
    val probes = (ongoing + ordinary).distinctBy { it.nominal }
    if (probes.size > 503) throw CalendarFailure("RECURRENCE_REVIEW_LIMIT")
    if (ordinary.isEmpty() && ongoing.isEmpty() && rows.none { it.optString("status") != "cancelled" && actualEnd(it, zone) > currentTime })
      throw CalendarFailure("NO_UPCOMING_WORK")
    val key = CalendarMapper.hash(JSONArray(listOf(freshMaster.getString("etag"), snapshot.generation, snapshot.authEpoch,
      snapshot.fingerprint, JSONArray(ordinary.map { it.nominal.toString() }),
      JSONArray(ongoing.map { it.nominal.toString() }), candidate.mode, candidate.policySnapshot)).toString())
    val saved = state.access { it.managed.candidate(candidate.candidateId) } ?: throw CalendarFailure("STALE_PREVIEW")
    val prior = saved.audit.takeIf(String::isNotBlank)?.let { runCatching { JSONObject(it) }.getOrNull() }
    val audit = if (prior?.optString("key") == key) prior else JSONObject().put("key", key).put("descriptors", JSONArray())
      .put("nextCacheIndex", 0).put("nextOrdinaryIndex", 0)
    var reads = 0
    val descriptor = CalendarRecurringReview(transport, now)
    while (audit.getInt("nextCacheIndex") < rows.size) {
      if (reads == 6) { checkpoint(candidate, snapshot, audit); return null }
      budget()
      val index = audit.getInt("nextCacheIndex"); val observed = rows[index]
      val nominal = CalendarRecurrence.originalSlot(observed, zone.id)
      val nominalMs = nominal.atZone(zone).toInstant().toEpochMilli()
      if (Recurrence.future(rule, nominalMs - 1, zone, "None").firstOrNull()?.nominal != nominal) throw CalendarFailure("INVALID_INSTANCE")
      val actual = when (val lookup = transport.lookup(token, calendar.id, observed.getString("id"))) {
        is CalendarEventLookup.Found -> lookup.event
        CalendarEventLookup.Deleted -> JSONObject(observed.toString()).put("status", "cancelled")
        CalendarEventLookup.Missing -> throw CalendarFailure("REMOTE_UNAVAILABLE")
      }
      reads++
      if (actual.optString("id") != observed.getString("id") || actual.optString("recurringEventId") != candidate.eventId ||
        CalendarRecurrence.originalSlot(actual, zone.id) != nominal || actual.has("recurrence")) throw CalendarFailure("INVALID_INSTANCE")
      // A changed exception invalidates the collection snapshot; wait for a new completed observation rather than mixing versions.
      if (actual.optString("etag") != observed.optString("etag") || actual.optString("status") != observed.optString("status"))
        throw CalendarFailure("STALE_REMOTE")
      audit.getJSONArray("descriptors").put(descriptor.descriptor(actual, zone.id))
      audit.put("nextCacheIndex", index + 1)
      checkpoint(candidate, snapshot, audit)
    }
    while (audit.getInt("nextOrdinaryIndex") < probes.size) {
      if (reads == 6) { checkpoint(candidate, snapshot, audit); return null }
      budget()
      val index = audit.getInt("nextOrdinaryIndex"); val slot = probes[index]
      val original = if (rule.allDay) slot.nominal.toLocalDate().toString() else Instant.ofEpochMilli(slot.eventStartMs).toString()
      val actual = transport.instance(token, calendar.id, candidate.eventId, original) ?: throw CalendarFailure("RECURRENCE_MISMATCH")
      reads++
      verifyOrdinary(actual, candidate.eventId, slot, zone.id)
      if (slot.eventStartMs <= currentTime) audit.getJSONArray("descriptors").put(descriptor.descriptor(actual, zone.id, exception = false))
      audit.put("nextOrdinaryIndex", index + 1)
      checkpoint(candidate, snapshot, audit)
    }
    val descriptors = audit.getJSONArray("descriptors")
    validateAlert(candidate, ordinary, ongoing, descriptors, zone, rule.allDay, currentTime)
    checkpoint(candidate, snapshot, audit)
    return JSONObject(freshMaster.toString()).put("remiloInstances", JSONArray(descriptors.toString()))
  }
  private fun futureException(event: JSONObject, rule: RecurrenceRule, zone: ZoneId, currentTime: Long): Boolean {
    val nominal = CalendarRecurrence.originalSlot(event, zone.id)
    val originalEnd = Recurrence.resolve(rule, nominal, zone).eventEndMs
    return maxOf(originalEnd, if (event.optString("status") == "cancelled") originalEnd else actualEnd(event, zone)) > currentTime
  }
  private fun actualEnd(event: JSONObject, zone: ZoneId): Long {
    val end = event.optJSONObject("end") ?: throw CalendarFailure("INVALID_INSTANCE")
    return if (end.has("date")) LocalDate.parse(end.getString("date")).atStartOfDay(zone).toInstant().toEpochMilli()
      else OffsetDateTime.parse(end.getString("dateTime")).toInstant().toEpochMilli()
  }
  private fun verifyOrdinary(event: JSONObject, masterId: String, slot: ResolvedSlot, zoneId: String) {
    if (event.optString("recurringEventId") != masterId || CalendarRecurrence.originalSlot(event, zoneId) != slot.nominal ||
      event.optString("status") == "cancelled" || event.optString("id").isBlank() || event.has("recurrence")) throw CalendarFailure("RECURRENCE_MISMATCH")
    val schedule = CalendarLinkMapper.fields(JSONObject(event.toString()).also { it.remove("recurringEventId") }, zoneId).getJSONObject("schedule")
    if (schedule.getLong("eventStartMs") != slot.eventStartMs || schedule.getLong("eventEndMs") != slot.eventEndMs ||
      schedule.getString("zoneId") != zoneId) throw CalendarFailure("RECURRENCE_MISMATCH")
  }
  private fun validateAlert(candidate: CalendarManagedCandidate, ordinary: List<ResolvedSlot>, ongoing: List<ResolvedSlot>,
    descriptors: JSONArray, zone: ZoneId, allDay: Boolean, currentTime: Long) {
    if (candidate.mode == "None") return
    val minutes = candidate.policySnapshot.takeIf(String::isNotBlank)?.let { JSONObject(it).optInt("allDayAlarmMinutes", 540) } ?: 540
    fun target(start: Long, allDay: Boolean) = if (allDay) Instant.ofEpochMilli(start).atZone(zone).toLocalDate().atStartOfDay()
      .plusMinutes(minutes.toLong()).atZone(zone).toInstant().toEpochMilli() else start
    if ((ordinary + ongoing).any { target(it.eventStartMs, allDay) <= currentTime }) throw CalendarFailure("ELAPSED_ALERT")
    for (index in 0 until descriptors.length()) {
      val value = descriptors.getJSONObject(index)
      if (value.optBoolean("cancelled")) continue
      val schedule = value.getJSONObject("fields").getJSONObject("schedule")
      if (target(schedule.getLong("eventStartMs"), schedule.getBoolean("allDay")) <= currentTime && schedule.getLong("eventEndMs") > currentTime)
        throw CalendarFailure("ELAPSED_ALERT")
    }
  }
  private fun requireCandidate(store: CalendarStore, expected: CalendarManagedCandidate) {
    val current = store.managed.candidate(expected.candidateId) ?: throw CalendarFailure("STALE_PREVIEW")
    if (current.revision != expected.revision || current.fingerprint != expected.fingerprint || current.remoteKey != expected.remoteKey ||
      current.state !in setOf("Pending", "Review") || !store.managed.permitsCalendar(current.subject, current.calendarId) || store.managed.suppressed(current.remoteKey))
      throw CalendarFailure("STALE_PREVIEW")
  }
  private fun checkpoint(candidate: CalendarManagedCandidate, snapshot: Snapshot, audit: JSONObject) = state.access(true) { store ->
    requireCandidate(store, candidate)
    val cursor = store.incremental.cursor(candidate.calendarId)
    if (cursor.generation != snapshot.generation || cursor.paging || store.managed.binding().authEpoch != snapshot.authEpoch)
      throw CalendarFailure("STALE_PREVIEW")
    if (cacheFingerprint(store.managed.instances(candidate.eventId).filter { it.generation == snapshot.generation }) != snapshot.fingerprint)
      throw CalendarFailure("STALE_PREVIEW")
    val current = store.managed.candidate(candidate.candidateId)!!
    store.managed.dao.candidate(current.copy(audit = audit.toString()))
  }
  private fun cacheFingerprint(rows: List<CalendarManagedCache>) = CalendarMapper.hash(JSONArray(rows.sortedBy { it.eventId }
    .map { JSONArray(listOf(it.eventId, it.generation, it.event)) }).toString())
}

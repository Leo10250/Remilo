package com.remilo.alarm.calendar

import com.remilo.alarm.data.ContentDatabase
import org.json.*

/** Page observations, comparison intents and continuation commit together on the engine worker. */
class CalendarIncrementalStore(private val db: ContentDatabase, private val now: () -> Long, private val links: CalendarLinkStore) {
  private val dao get() = db.sync()
  fun calendars(): List<String> {
    val connection = links.connection()
    val authorized = db.links().links().filter { link -> link.subject == connection.subject && !link.erased && link.state != "Detached" &&
      dao.state(link.occurrenceId)?.let { it.mode == "Automatic" && it.status != "Paused" } == true }
    val order = dao.cursors().associate { it.calendarId to it.checkedAtMs }
    val managed = CalendarManagedStore(db, now).enabledCalendarIds()
    return (authorized.map { it.calendarId } + managed).distinct().sortedWith(compareBy<String> { order[it] ?: 0L }.thenBy { it })
  }
  fun cursor(calendarId: String): CalendarSyncCursor {
    if (calendarId !in calendars()) throw CalendarFailure("INELIGIBLE")
    val subject = links.connection().subject
    val key = CalendarLinkMapper.key(subject, calendarId, "sync-query-v1")
    return dao.cursor(key) ?: CalendarSyncCursor(key, subject, calendarId)
  }
  fun begin(captured: CalendarSyncCursor, connectionRevision: Long): CalendarSyncCursor {
    validate(captured, connectionRevision)
    if (captured.paging) return captured
    return captured.copy(startingToken = captured.syncToken, pageToken = "", paging = true).also(dao::cursor)
  }
  fun page(captured: CalendarSyncCursor, connectionRevision: Long, page: JSONObject, calendarZone: String = "UTC",
    calendar: OwnedCalendar? = null, background: Boolean = false): CalendarSyncCursor {
    validate(captured, connectionRevision)
    val continuing = page.optString("nextPageToken")
    val replacement = page.optString("nextSyncToken")
    if (continuing.isEmpty() && replacement.isEmpty()) throw CalendarFailure("INVALID_SYNC_PAGE")
    val allowlist = db.links().links().filter { it.subject == captured.subject && it.calendarId == captured.calendarId &&
      !it.erased && it.state != "Detached" && dao.state(it.occurrenceId)?.mode == "Automatic" }
    val items = page.optJSONArray("items") ?: JSONArray()
    db.runInTransaction {
      if (calendar != null && CalendarManagedStore(db, now).permitsCalendar(captured.subject, captured.calendarId))
        CalendarManagedStore(db, now).page(captured, items, calendar, background)
      for (index in 0 until items.length()) {
        val event = items.getJSONObject(index); val id = event.optString("id")
        if (id.isEmpty()) continue
        val owners = allowlist.filter { link -> link.eventId == id || event.optString("recurringEventId") == link.eventId ||
          links.resources(link.occurrenceId).any { resource -> resource.eventId == id || event.optString("recurringEventId") == resource.eventId && resource.nominalSlot.isEmpty() } }
        // A collection response never grants adoption permission to unrelated events.
        owners.forEach { link ->
          if (event.has("originalStartTime")) {
            val zone = links.record(link.occurrenceId)?.zoneId ?: "UTC"
            val nominal = try { CalendarRecurrence.originalSlot(event, zone).toString() } catch (_: Exception) { "" }
            val segments = links.segments(link.occurrenceId).map { it.id }.toSet()
            if (db.records().purged().any { it.segmentId in segments && it.nominalSlot == nominal }) return@forEach
          }
          val retained = snapshot(event, calendarZone)
          dao.snapshot(CalendarSyncSnapshot(link.occurrenceId, id, captured.calendarId, captured.generation, retained.toString()))
          val state = dao.state(link.occurrenceId)!!
          dao.put(state.copy(status = if (state.status == "Confirmed") "UpdatePending" else state.status))
        }
      }
      val next = if (continuing.isNotEmpty()) captured.copy(pageToken = continuing, checkedAtMs = now())
        else captured.copy(syncToken = replacement, startingToken = "", pageToken = "", paging = false, checkedAtMs = now())
      dao.cursor(next)
      if (!next.paging && CalendarManagedStore(db, now).permitsCalendar(next.subject, next.calendarId))
        CalendarManagedStore(db, now).collectionCompleted(next)
    }
    return dao.cursor(captured.key)!!
  }
  fun expired(captured: CalendarSyncCursor, connectionRevision: Long): CalendarSyncCursor {
    validate(captured, connectionRevision)
    val rebuilt = captured.copy(generation = captured.generation + 1, syncToken = "", startingToken = "", pageToken = "", paging = false)
    db.runInTransaction { dao.clearCalendar(captured.calendarId); dao.cursor(rebuilt) }
    // Reminders, links, common baselines, operations and alarm plans are deliberately untouched.
    return rebuilt
  }
  private fun validate(captured: CalendarSyncCursor, connectionRevision: Long) {
    val connection = links.connection()
    if (!connection.connected || connection.revision != connectionRevision || connection.subject != captured.subject) throw CalendarFailure("STALE_CONNECTION")
    if (captured.calendarId !in calendars() || (dao.cursor(captured.key) ?: captured) != captured) throw CalendarFailure("STALE_CURSOR")
  }
  /** Only supported snapshots and typed availability survive the transient network response. */
  private fun snapshot(event: JSONObject, calendarZone: String): JSONObject {
    val retained = JSONObject()
    for (key in listOf("id", "etag", "status", "updated", "recurringEventId", "originalStartTime")) if (event.has(key)) retained.put(key, event.get(key))
    val plain = JSONObject(event.toString()).also { it.remove("recurringEventId") }
    val zone = event.optJSONObject("start")?.optString("timeZone").orEmpty().ifEmpty { calendarZone }
    val reason = if (event.optString("status") == "cancelled") "REMOTE_DELETED" else CalendarLinkMapper.reason(plain, zone)
    if (reason != null) retained.put("remiloAvailabilityReason", reason)
    else for (key in listOf("summary", "description", "start", "end", "recurrence", "extendedProperties", "htmlLink")) if (event.has(key)) {
      if (key == "extendedProperties") {
        val marker = event.optJSONObject(key)?.optJSONObject("private")?.optString("remiloPublication").orEmpty()
        if (marker.isNotEmpty()) retained.put(key, JSONObject().put("private", JSONObject().put("remiloPublication", marker)))
      } else retained.put(key, event.get(key))
    }
    return retained
  }
}

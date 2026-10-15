package com.remilo.alarm.calendar

import com.remilo.alarm.core.Recurrence
import java.time.*
import org.json.*

/** Explicit native review reads. Foreign event content is discarded; no UI or durable mutations. */
class CalendarRecurringReview(private val transport: CalendarTransport, private val now: () -> Long = System::currentTimeMillis,
  private val beforeRead: () -> Unit = {}) {
  fun inspect(token: String, calendar: OwnedCalendar, source: JSONObject): JSONObject {
    val fields = CalendarLinkMapper.fields(source, calendar.zoneId)
    val schedule = fields.getJSONObject("schedule")
    val recurrence = schedule.optJSONArray("recurrence") ?: return source
    val zone = ZoneId.of(schedule.getString("zoneId"))
    val rule = CalendarRecurrence.decode(recurrence, Instant.ofEpochMilli(schedule.getLong("eventStartMs")).atZone(zone).toLocalDateTime(),
      zone.id, schedule.getBoolean("allDay"), if (schedule.getBoolean("allDay")) 86_400_000 else schedule.getLong("eventEndMs") - schedule.getLong("eventStartMs"))
    val masterId = source.getString("id")
    val instances = linkedMapOf<String, JSONObject>()
    var cursor: String? = null; var pages = 0
    do {
      if (++pages > 100) throw CalendarFailure("RECURRENCE_REVIEW_LIMIT")
      beforeRead()
      val page = transport.syncEvents(token, calendar.id, null, cursor)
      val items = page.optJSONArray("items") ?: JSONArray()
      for (index in 0 until items.length()) {
        val event = items.getJSONObject(index)
        if (event.optString("id") == masterId && event.optString("etag") != source.optString("etag")) throw CalendarFailure("STALE_REMOTE")
        if (event.optString("recurringEventId") != masterId) continue
        val slot = CalendarRecurrence.originalSlot(event, zone.id)
        if (slot.atZone(zone).toInstant().toEpochMilli() <= now() &&
          event.optJSONObject("start")?.optString("dateTime")?.takeIf(String::isNotBlank)?.let { OffsetDateTime.parse(it).toInstant().toEpochMilli() <= now() } != false) continue
        val row = descriptor(event, zone.id)
        if (instances.put(slot.toString(), row) != null || instances.size > 500) throw CalendarFailure("RECURRENCE_REVIEW_LIMIT")
      }
      cursor = page.optString("nextPageToken").takeIf(String::isNotBlank)
    } while (cursor != null)
    // Compare the ordinary Calendar expansion with the native kernel, including DST/count rules.
    for (slot in Recurrence.future(rule, now(), zone, "None").take(3)) {
      if (instances.containsKey(slot.nominal.toString())) continue
      beforeRead()
      val original = if (rule.allDay) slot.nominal.toLocalDate().toString() else Instant.ofEpochMilli(slot.eventStartMs).toString()
      val actual = transport.instance(token, calendar.id, masterId, original) ?: throw CalendarFailure("RECURRENCE_MISMATCH")
      if (actual.optString("recurringEventId") != masterId || CalendarRecurrence.originalSlot(actual, zone.id) != slot.nominal ||
        actual.optString("status") == "cancelled") throw CalendarFailure("RECURRENCE_MISMATCH")
      val actualFields = CalendarLinkMapper.fields(JSONObject(actual.toString()).also { it.remove("recurringEventId") }, zone.id).getJSONObject("schedule")
      if (actualFields.getLong("eventStartMs") != slot.eventStartMs || actualFields.getLong("eventEndMs") != slot.eventEndMs) throw CalendarFailure("RECURRENCE_MISMATCH")
    }
    return JSONObject(source.toString()).put("remiloInstances", JSONArray(instances.toSortedMap().values.toList()))
  }
  fun descriptor(event: JSONObject, zone: String, exception: Boolean = true): JSONObject {
    val result = JSONObject().put("eventId", event.getString("id")).put("etag", event.optString("etag"))
      .put("nominalSlot", CalendarRecurrence.originalSlot(event, zone).toString()).put("cancelled", event.optString("status") == "cancelled").put("exception", exception)
    if (!result.getBoolean("cancelled")) {
      if (result.getString("etag").isBlank()) throw CalendarFailure("INVALID_INSTANCE")
      result.put("fields", CalendarLinkMapper.fields(JSONObject(event.toString()).also { it.remove("recurringEventId") }, zone))
    }
    return result
  }
}

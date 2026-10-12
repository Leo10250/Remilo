package com.remilo.alarm.calendar

import com.remilo.alarm.data.ReminderRecord
import org.json.JSONObject
import org.json.JSONArray
import java.time.*
import java.time.temporal.ChronoUnit

object CalendarLinkMapper {
  fun key(subject: String, calendar: String, event: String) =
    CalendarMapper.hash(JSONArray(listOf("remilo-link-v1", subject, calendar, event)).toString())
  fun reason(event: JSONObject, calendarZone: String): String? = try {
    fields(event, calendarZone); null
  } catch (error: CalendarFailure) { error.code }
    catch (_: Exception) { "INVALID_EVENT" }
  private fun reject(test: Boolean, code: String) { if (test) throw CalendarFailure(code) }
  fun fields(event: JSONObject, calendarZone: String): JSONObject {
    reject(event.optString("status") == "cancelled", "REMOTE_REMOVED")
    reject(event.has("recurrence") || event.has("recurringEventId"), "RECURRING_EVENT")
    reject(event.has("attendees") && (event.optJSONArray("attendees") == null || event.getJSONArray("attendees").length() > 0) ||
      event.optBoolean("attendeesOmitted"), "MEETING_EVENT")
    reject(event.optBoolean("locked") || event.optBoolean("privateCopy"), "LOCKED_EVENT")
    reject(event.optString("eventType", "default") != "default", "SPECIAL_EVENT")
    reject(event.optBoolean("endTimeUnspecified"), "UNSPECIFIED_END")
    val title = event.optString("summary").trim(); val notes = event.optString("description")
    reject(title.length > 200 || notes.length > 10_000, "CONTENT_LIMIT")
    val start = event.optJSONObject("start") ?: throw CalendarFailure("INVALID_EVENT")
    val end = event.optJSONObject("end") ?: throw CalendarFailure("INVALID_EVENT")
    val allDay = start.has("date") && end.has("date")
    reject(start.has("date") != end.has("date") || allDay && (start.has("dateTime") || end.has("dateTime")), "INVALID_EVENT")
    val startZone = start.optString("timeZone").ifEmpty { calendarZone }
    val zone = if (startZone in ZoneId.getAvailableZoneIds()) ZoneId.of(startZone) else throw CalendarFailure("INVALID_ZONE")
    val endZone = end.optString("timeZone").ifEmpty { zone.id }
    reject(endZone != zone.id, "INCOMPATIBLE_ZONES")
    val first: Long; val last: Long
    if (allDay) {
      val date = LocalDate.parse(start.getString("date")); val finish = LocalDate.parse(end.getString("date"))
      reject(finish != date.plusDays(1), "MULTI_DAY_EVENT")
      first = date.atStartOfDay(zone).toInstant().toEpochMilli()
      last = finish.atStartOfDay(zone).toInstant().toEpochMilli()
    } else {
      first = OffsetDateTime.parse(start.getString("dateTime")).toInstant().toEpochMilli()
      last = OffsetDateTime.parse(end.getString("dateTime")).toInstant().toEpochMilli()
    }
    reject(first < 0 || last <= first, "INVALID_EVENT")
    return JSONObject().put("title", title).put("notes", notes).put("schedule", JSONObject()
      .put("eventStartMs", first).put("eventEndMs", last).put("allDay", allDay).put("zoneId", zone.id))
  }
  fun fields(record: ReminderRecord): JSONObject = JSONObject().put("title", record.title).put("notes", record.notes)
    .put("schedule", JSONObject().put("eventStartMs", record.eventStartMs).put("eventEndMs", record.eventEndMs)
      .put("allDay", record.allDay).put("zoneId", record.zoneId))
  fun equal(a: Any?, b: Any?): Boolean = if (a is JSONObject && b is JSONObject)
    a.keys().asSequence().toSet() == b.keys().asSequence().toSet() && a.keys().asSequence().all { equal(a.opt(it), b.opt(it)) }
    else if (a is Number && b is Number) a.toDouble() == b.toDouble() else a == b
  fun defaults(local: JSONObject, remote: JSONObject, baseline: JSONObject?): Map<String, String?> =
    listOf("title", "notes", "schedule").associateWith { field ->
      val l = local.opt(field); val r = remote.opt(field); val b = baseline?.opt(field)
      when { equal(l, r) -> "remilo"; baseline == null -> null
        equal(l, b) -> "google"; equal(r, b) -> "remilo"; else -> null }
    }
  fun draft(fields: JSONObject): JSONObject = JSONObject(fields.getJSONObject("schedule").toString())
    .put("title", fields.getString("title")).put("notes", fields.getString("notes"))
  fun patch(remote: JSONObject, desired: JSONObject, suppress: Boolean): JSONObject {
    val result = JSONObject()
    if (!equal(remote.opt("title"), desired.opt("title"))) result.put("summary", desired.getString("title"))
    if (!equal(remote.opt("notes"), desired.opt("notes"))) result.put("description", desired.getString("notes"))
    if (!equal(remote.opt("schedule"), desired.opt("schedule"))) {
      val schedule = desired.getJSONObject("schedule"); val zone = ZoneId.of(schedule.getString("zoneId"))
      for ((key, field) in listOf("start" to "eventStartMs", "end" to "eventEndMs")) {
        val instant = Instant.ofEpochMilli(schedule.getLong(field))
        result.put(key, if (schedule.getBoolean("allDay")) JSONObject().put("date", instant.atZone(zone).toLocalDate().toString())
          else JSONObject().put("dateTime", instant.toString()).put("timeZone", zone.id))
      }
    }
    if (suppress) result.put("reminders", JSONObject().put("useDefault", false).put("overrides", JSONArray()))
    return result
  }
  fun reminders(event: JSONObject, defaults: Boolean): Boolean {
    val value = event.optJSONObject("reminders") ?: return defaults
    return if (value.optBoolean("useDefault", true)) defaults else (value.optJSONArray("overrides")?.length() ?: 0) > 0
  }
  fun range(from: String, until: String): Pair<String, String> {
    val start = LocalDate.parse(from); val end = LocalDate.parse(until)
    val days = ChronoUnit.DAYS.between(start, end)
    if (days !in 1..366) throw CalendarFailure("INVALID_RANGE")
    val zone = ZoneId.systemDefault()
    return start.atStartOfDay(zone).toInstant().toString() to end.atStartOfDay(zone).toInstant().toString()
  }
  fun map(value: JSONObject): Map<String, Any?> = value.keys().asSequence().associateWith { key ->
    val item = value.get(key); when (item) { is JSONObject -> map(item); JSONObject.NULL -> null; else -> item }
  }
}

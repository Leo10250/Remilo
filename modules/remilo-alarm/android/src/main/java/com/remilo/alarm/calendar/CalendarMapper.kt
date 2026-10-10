package com.remilo.alarm.calendar

import com.remilo.alarm.data.ReminderRecord
import org.json.JSONObject
import java.time.Instant
import java.time.ZoneId
import java.util.UUID
import java.security.MessageDigest

object CalendarMapper {
  fun eventId(subject: String, calendarId: String, occurrenceId: String): String =
    UUID.nameUUIDFromBytes(org.json.JSONArray(listOf("remilo-calendar-v1", subject, calendarId, occurrenceId))
      .toString().toByteArray(Charsets.UTF_8)).toString().replace("-", "")
  fun hash(value: String): String = MessageDigest.getInstance("SHA-256").digest(value.toByteArray(Charsets.UTF_8))
    .joinToString("") { "%02x".format(it.toInt() and 255) }
  fun fields(record: ReminderRecord, zone: String): JSONObject {
    if (zone !in ZoneId.getAvailableZoneIds()) throw CalendarFailure("INVALID_ZONE")
    val zoneId = ZoneId.of(zone)
    val start = Instant.ofEpochMilli(record.eventStartMs).atZone(zoneId)
    val end = Instant.ofEpochMilli(record.eventEndMs).atZone(zoneId)
    require(record.eventEndMs > record.eventStartMs)
    val first = if (record.allDay) JSONObject().put("date", start.toLocalDate().toString())
      else JSONObject().put("dateTime", start.toOffsetDateTime().toString()).put("timeZone", zone)
    val last = if (record.allDay) {
      require(end.toLocalDate().isAfter(start.toLocalDate()))
      JSONObject().put("date", end.toLocalDate().toString())
    } else JSONObject().put("dateTime", end.toOffsetDateTime().toString()).put("timeZone", zone)
    return JSONObject().put("summary", record.title).put("description", record.notes)
      .put("start", first).put("end", last).put("visibility", "private").put("transparency", "opaque")
      .put("reminders", JSONObject().put("useDefault", false).put("overrides", org.json.JSONArray()))
  }
  // JSONObject's key iteration is not a canonical serialization contract.
  fun fingerprint(record: ReminderRecord, zone: String): String = hash(org.json.JSONArray(listOf(
    record.title, record.notes, record.eventStartMs, record.eventEndMs, record.allDay, zone)).toString())
  fun payload(record: ReminderRecord, zone: String, id: String): String = fields(record, zone).put("id", id)
    .put("extendedProperties", JSONObject().put("private", JSONObject().put("remiloPublication", id)))
    .toString()
  fun matching(event: JSONObject, id: String): Boolean = event.optString("id") == id &&
    event.optJSONObject("extendedProperties")?.optJSONObject("private")?.optString("remiloPublication") == id
}

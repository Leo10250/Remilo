package com.remilo.alarm.calendar

import com.remilo.alarm.core.*
import com.remilo.alarm.data.*
import java.time.*
import org.json.*

/** P4-C resource mapping. Plans retain the existing family/segment/nominal identities. */
object CalendarSeriesMapping {
  data class Resource(val segmentId: String, val eventId: String, val payload: JSONObject)
  fun master(subject: String, calendarId: String, segment: SeriesRecord): Resource {
    val rule = CalendarRecurrence.canonical(RuleCodec.decode(segment.rule))
    val slot = Recurrence.resolve(rule, rule.anchor, ZoneId.of(rule.zoneId))
    val template = BackupCodec.decodeRecord(JSONObject(segment.template)).copy(eventStartMs = slot.eventStartMs, eventEndMs = slot.eventEndMs)
    val zone = rule.zoneId ?: throw CalendarFailure("PINNED_ZONE_REQUIRED")
    val id = CalendarMapper.eventId(subject, calendarId, segment.id)
    val payload = JSONObject(CalendarMapper.payload(template, zone, id)).put("recurrence", CalendarRecurrence.encode(rule))
    return Resource(segment.id, id, payload)
  }
  fun exception(eventId: String, masterId: String, record: ReminderRecord, rule: RecurrenceRule): JSONObject? {
    // Completion, Skip, Trash and delivery-only adjustments never become Google cancellation.
    if (!record.exception || record.completed || record.deleted || record.skipped) return null
    val nominal = record.nominalSlot?.let(LocalDateTime::parse) ?: throw CalendarFailure("INVALID_INSTANCE")
    val zone = rule.zoneId?.let(ZoneId::of) ?: throw CalendarFailure("PINNED_ZONE_REQUIRED")
    val slot = Recurrence.resolve(rule, nominal, zone)
    val original = if (rule.allDay) JSONObject().put("date", nominal.toLocalDate().toString()) else
      JSONObject().put("dateTime", Instant.ofEpochMilli(slot.eventStartMs).toString()).put("timeZone", zone.id)
    return CalendarMapper.fields(record, zone.id).put("id", eventId).put("recurringEventId", masterId).put("originalStartTime", original)
  }
  /** A following edit trims the existing master and allocates the native new segment's stable event. */
  fun split(subject: String, calendarId: String, old: SeriesRecord, following: SeriesRecord, boundary: LocalDateTime): Pair<Resource, Resource> {
    val prior = RuleCodec.decode(old.rule)
    if (following.seriesId != old.seriesId || boundary < prior.anchor) throw CalendarFailure("INVALID_SPLIT")
    val trimmed = old.copy(rule = RuleCodec.encode(prior.copy(endExclusive = boundary)))
    return master(subject, calendarId, trimmed) to master(subject, calendarId, following)
  }
  fun compatibleRule(rule: RecurrenceRule): JSONArray = CalendarRecurrence.encode(rule)
}

package com.remilo.alarm.calendar

import com.remilo.alarm.core.RecurrenceRule
import java.time.*
import java.time.format.DateTimeFormatter
import org.json.JSONArray

/** The Calendar subset is the existing civil recurrence kernel, never a second scheduler. */
object CalendarRecurrence {
  private val days = listOf("MO", "TU", "WE", "TH", "FR", "SA", "SU")
  private val utc = DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'").withZone(ZoneOffset.UTC)
  private val date = DateTimeFormatter.BASIC_ISO_DATE
  fun canonical(rule: RecurrenceRule): RecurrenceRule {
    val zone = rule.zoneId?.let(ZoneId::of) ?: throw CalendarFailure("PINNED_ZONE_REQUIRED")
    val first = com.remilo.alarm.core.Recurrence.future(rule, -1, zone, "None").firstOrNull() ?: throw CalendarFailure("UNSUPPORTED_RECURRENCE")
    return rule.copy(anchor = first.nominal)
  }
  fun encode(rule: RecurrenceRule): JSONArray {
    val zone = rule.zoneId?.let(ZoneId::of) ?: throw CalendarFailure("PINNED_ZONE_REQUIRED")
    val parts = linkedMapOf("FREQ" to when (rule.frequency) {
      "daily" -> "DAILY"; "weekly" -> "WEEKLY"; "yearly" -> "YEARLY"; else -> "MONTHLY"
    }, "INTERVAL" to rule.interval.toString())
    when (rule.frequency) {
      "weekly" -> parts["BYDAY"] = rule.weekdays.sorted().joinToString(",") { days[it - 1] }
      "monthlyDay" -> parts["BYMONTHDAY"] = rule.day.toString()
      "monthlyOrdinal" -> parts["BYDAY"] = "${rule.ordinal}${days[rule.weekday - 1]}"
      "lastWeekday" -> { parts["BYDAY"] = "MO,TU,WE,TH,FR"; parts["BYSETPOS"] = "-1" }
      "yearly" -> { parts["BYMONTH"] = rule.month.toString(); parts["BYMONTHDAY"] = rule.day.toString() }
    }
    parts["WKST"] = "MO"
    // A split boundary wins over the original ending; COUNT is retained only for an unsplit rule.
    val boundary = rule.endExclusive?.atZone(zone)?.toInstant()?.minusSeconds(1)
    val ending = rule.until?.plusDays(1)?.atStartOfDay(zone)?.toInstant()?.minusSeconds(1)
    val countEnding = if (boundary != null && rule.count != null) com.remilo.alarm.core.Recurrence.future(rule.copy(endExclusive = null),
      -1, zone, "None").lastOrNull()?.let { Instant.ofEpochMilli(it.eventStartMs) } else null
    val until = listOfNotNull(boundary, ending, countEnding).minOrNull()
    if (until != null) parts["UNTIL"] = if (rule.allDay) date.format(until.atZone(zone).toLocalDate()) else utc.format(until)
    else rule.count?.let { parts["COUNT"] = it.toString() }
    return JSONArray().put("RRULE:" + parts.entries.joinToString(";") { "${it.key}=${it.value}" })
  }
  fun decode(lines: JSONArray, anchor: LocalDateTime, zone: String, allDay: Boolean, durationMs: Long): RecurrenceRule {
    if (lines.length() != 1 || lines.opt(0) !is String) throw CalendarFailure("UNSUPPORTED_RECURRENCE")
    val line = lines.getString(0)
    if (!line.startsWith("RRULE:") || line.length > 4000) throw CalendarFailure("UNSUPPORTED_RECURRENCE")
    val parts = linkedMapOf<String, String>()
    line.removePrefix("RRULE:").split(';').forEach {
      val pair = it.split('=')
      if (pair.size != 2 || parts.put(pair[0], pair[1]) != null) throw CalendarFailure("UNSUPPORTED_RECURRENCE")
    }
    if (parts.keys.any { it !in setOf("FREQ", "INTERVAL", "BYDAY", "BYMONTHDAY", "BYMONTH", "BYSETPOS", "WKST", "COUNT", "UNTIL") } ||
      parts["WKST"] !in listOf(null, "MO") || parts.containsKey("COUNT") && parts.containsKey("UNTIL")) throw CalendarFailure("UNSUPPORTED_RECURRENCE")
    fun number(key: String, fallback: Int) = parts[key]?.toIntOrNull() ?: if (parts.containsKey(key)) throw CalendarFailure("UNSUPPORTED_RECURRENCE") else fallback
    var frequency: String; var weekdays = listOf(anchor.dayOfWeek.value); var ordinal = 1; var weekday = anchor.dayOfWeek.value
    val byday = parts["BYDAY"]
    val allowed = when (parts["FREQ"]) {
      "DAILY" -> { frequency = "daily"; emptySet() }
      "WEEKLY" -> {
        frequency = "weekly"
        weekdays = byday?.split(',')?.map { days.indexOf(it).takeIf { n -> n >= 0 }?.plus(1) ?: throw CalendarFailure("UNSUPPORTED_RECURRENCE") } ?: weekdays
        setOf("BYDAY")
      }
      "MONTHLY" -> {
        frequency = if (byday == "MO,TU,WE,TH,FR" && parts["BYSETPOS"] == "-1") "lastWeekday" else if (byday != null) "monthlyOrdinal" else "monthlyDay"
        if (frequency == "monthlyOrdinal") {
          val match = Regex("(-1|[1-5])(MO|TU|WE|TH|FR|SA|SU)").matchEntire(byday!!) ?: throw CalendarFailure("UNSUPPORTED_RECURRENCE")
          ordinal = match.groupValues[1].toInt(); weekday = days.indexOf(match.groupValues[2]) + 1
        }
        if (frequency == "monthlyDay") setOf("BYMONTHDAY") else if (frequency == "lastWeekday") setOf("BYDAY", "BYSETPOS") else setOf("BYDAY")
      }
      "YEARLY" -> { frequency = "yearly"; setOf("BYMONTH", "BYMONTHDAY") }
      else -> throw CalendarFailure("UNSUPPORTED_RECURRENCE")
    }
    if (parts.keys.any { it.startsWith("BY") && it !in allowed }) throw CalendarFailure("UNSUPPORTED_RECURRENCE")
    val until = parts["UNTIL"]?.let {
      try { if (allDay) LocalDate.parse(it, date) else Instant.from(utc.parse(it)).atZone(ZoneId.of(zone)).toLocalDate() }
      catch (_: DateTimeException) { throw CalendarFailure("UNSUPPORTED_RECURRENCE") }
    }
    val exclusive = parts["UNTIL"]?.takeUnless { allDay }?.let { Instant.from(utc.parse(it)).plusSeconds(1).atZone(ZoneId.of(zone)).toLocalDateTime() }
    return try { RecurrenceRule(anchor, frequency, number("INTERVAL", 1), weekdays, number("BYMONTHDAY", anchor.dayOfMonth),
      ordinal, weekday, number("BYMONTH", anchor.monthValue), parts["COUNT"]?.let { number("COUNT", 1) }, until, zone,
      endExclusive = exclusive, allDay = allDay, endOffsetMs = durationMs, dueOffsetMs = if (allDay) 86_400_000 else 0,
      alarmOffsetMs = if (allDay) 9 * 3_600_000 else 0).also { rule ->
        // DTSTART outside the pattern has different COUNT semantics in Google and the native kernel.
        if (com.remilo.alarm.core.Recurrence.future(rule, -1, ZoneId.of(zone), "None").firstOrNull()?.nominal != anchor)
          throw CalendarFailure("UNSUPPORTED_RECURRENCE")
      } }
    catch (_: IllegalArgumentException) { throw CalendarFailure("UNSUPPORTED_RECURRENCE") }
  }
  /** The original nominal slot remains the identity when Google moves an instance. */
  fun originalSlot(event: org.json.JSONObject, zone: String): LocalDateTime {
    val original = event.optJSONObject("originalStartTime") ?: throw CalendarFailure("INVALID_INSTANCE")
    return if (original.has("date")) LocalDate.parse(original.getString("date")).atStartOfDay()
      else OffsetDateTime.parse(original.getString("dateTime")).atZoneSameInstant(ZoneId.of(zone)).toLocalDateTime()
  }
  fun spec(rule: RecurrenceRule): Map<String, Any?> = mapOf("frequency" to rule.frequency, "interval" to rule.interval,
    "weekdays" to rule.weekdays, "day" to rule.day, "ordinal" to rule.ordinal, "weekday" to rule.weekday,
    "month" to rule.month, "count" to rule.count, "until" to rule.until?.toString(), "zoneMode" to "pinned")
}

package com.remilo.alarm.data

import com.remilo.alarm.core.RecurrenceRule
import org.json.JSONObject
import java.time.LocalDate
import java.time.LocalDateTime

/** Explicit allowlist: the protected rule never serializes the private template. */
object RuleCodec {
  fun map(rule: RecurrenceRule): Map<String, Any?> = mapOf("version" to 1,
    "anchor" to rule.anchor.toString(), "frequency" to rule.frequency, "interval" to rule.interval,
    "weekdays" to rule.weekdays, "day" to rule.day, "ordinal" to rule.ordinal,
    "weekday" to rule.weekday, "month" to rule.month, "count" to rule.count,
    "until" to rule.until?.toString(), "zoneId" to rule.zoneId,
    "endExclusive" to rule.endExclusive?.toString(), "allDay" to rule.allDay,
    "endOffsetMs" to rule.endOffsetMs, "dueOffsetMs" to rule.dueOffsetMs, "alarmOffsetMs" to rule.alarmOffsetMs)
  fun encode(rule: RecurrenceRule) = JSONObject(map(rule)).toString()
  fun decode(json: String): RecurrenceRule {
    require(json.length <= 4000)
    val obj = JSONObject(json)
    require(obj.getInt("version") == 1)
    fun integer(key: String): Long {
      val value = obj.get(key)
      require(value is Number && value.toDouble().isFinite() && value.toDouble() % 1 == 0.0 &&
        value.toDouble() in -31_622_400_000.0..31_622_400_000.0)
      return value.toLong()
    }
    fun small(key: String): Int = integer(key).also { require(it in -100_000L..100_000L) }.toInt()
    val days = obj.getJSONArray("weekdays")
    return RecurrenceRule(LocalDateTime.parse(obj.getString("anchor")), obj.getString("frequency"),
      small("interval"), (0 until days.length()).map {
        val value = days.get(it); require(value is Number && value.toDouble() % 1 == 0.0 && value.toDouble() in 1.0..7.0); value.toInt()
      }, small("day"), small("ordinal"), small("weekday"), small("month"),
      if (obj.isNull("count")) null else small("count"),
      if (obj.isNull("until")) null else LocalDate.parse(obj.getString("until")),
      if (obj.isNull("zoneId")) null else obj.getString("zoneId"),
      if (obj.isNull("endExclusive")) null else LocalDateTime.parse(obj.getString("endExclusive")),
      obj.getBoolean("allDay"), integer("endOffsetMs"), integer("dueOffsetMs"), integer("alarmOffsetMs"))
  }
}

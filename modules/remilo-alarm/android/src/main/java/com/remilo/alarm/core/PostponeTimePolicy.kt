package com.remilo.alarm.core

import java.time.Instant
import java.time.ZoneId

/** Pure read-only selection policy shared by app and native alarm presentation. */
object PostponeTimePolicy {
  fun resolve(input: Map<String, Any?>): Map<String, Any> {
    val zoneId = input["zoneId"] as? String ?: throw IllegalArgumentException("Choose a valid time zone.")
    val reference = integer(input["referenceAtMs"], 0, 8_640_000_000_000_000L)
    // Also rejects unsupported reference dates and invalid zones for every kind.
    CivilTime.fromInstant(zoneId, reference)
    val resolved = when (input["kind"]) {
      "Relative" -> {
        val minutes = integer(input["minutes"], 1, 1440)
        require(minutes in setOf(15L, 30L, 60L, 1440L)) { "Choose a postpone option." }
        CivilTime.fromInstant(zoneId, reference + minutes * 60_000L)
      }
      "Tomorrow" -> {
        val minutes = integer(input["minutesOfDay"], 0, 1439).toInt()
        val date = Instant.ofEpochMilli(reference).atZone(ZoneId.of(zoneId)).toLocalDate().plusDays(1)
        CivilTime.fromLocal(zoneId, date.atTime(minutes / 60, minutes % 60).toString())
      }
      "Custom" -> CivilTime.fromLocal(zoneId, input["local"] as? String
        ?: throw IllegalArgumentException("Choose a supported local time."))
      else -> throw IllegalArgumentException("Choose a postpone option.")
    }
    require((resolved["instantMs"] as Long) > reference) { "Choose an alert time in the future." }
    return resolved
  }

  private fun integer(value: Any?, minimum: Long, maximum: Long): Long {
    val number = (value as? Number)?.toDouble()
      ?: throw IllegalArgumentException("Choose a valid postpone time.")
    require(number.isFinite() && number >= minimum && number <= maximum && number % 1.0 == 0.0) {
      "Choose a valid postpone time."
    }
    return number.toLong()
  }
}

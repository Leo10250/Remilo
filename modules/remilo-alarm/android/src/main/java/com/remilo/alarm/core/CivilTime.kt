package com.remilo.alarm.core

import java.time.DateTimeException
import java.time.Instant
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/** Read-only conversion using the same gap/fold policy as recurrence authoring. */
object CivilTime {
  private val seconds = DateTimeFormatter.ofPattern("uuuu-MM-dd'T'HH:mm:ss")
  fun fromInstant(zoneId: String, instantMs: Long): Map<String, Any> = valid {
    val time = Instant.ofEpochMilli(instantMs).atZone(ZoneId.of(zoneId))
    require(time.year in 1970..9999) { "Choose a supported date." }
    mapOf("zoneId" to zoneId, "instantMs" to instantMs, "local" to seconds.format(time),
      "offsetSeconds" to time.offset.totalSeconds, "adjustment" to "none")
  }
  fun fromLocal(zoneId: String, local: String): Map<String, Any> = valid {
    val nominal = LocalDateTime.parse(local)
    require(nominal.year in 1970..9999 && nominal.nano == 0) { "Choose a supported local time." }
    val zone = ZoneId.of(zoneId)
    val offsets = zone.rules.getValidOffsets(nominal)
    val time = nominal.atZone(zone)
    val adjustment = when { offsets.isEmpty() -> "gapForward"; offsets.size > 1 -> "earlierFold"; else -> "none" }
    mapOf("zoneId" to zoneId, "instantMs" to time.toInstant().toEpochMilli(), "local" to seconds.format(time),
      "offsetSeconds" to time.offset.totalSeconds, "adjustment" to adjustment)
  }
  private fun <T> valid(body: () -> T): T = try { body() }
    catch (_: DateTimeException) { throw IllegalArgumentException("Choose a valid time zone and date.") }
}

package com.remilo.alarm.core

import java.time.*

/** A date is a work boundary, not an overdue deadline or a delivery outcome. */
object RoutinePolicy {
  const val PROFILE = "RoutineQuiet"
  fun date(at: Long, zone: ZoneId): LocalDate = Instant.ofEpochMilli(at).atZone(zone).toLocalDate()
  fun end(date: LocalDate, zone: ZoneId): Long = date.plusDays(1).atStartOfDay(zone).toInstant().toEpochMilli()
  fun open(date: String, ended: Boolean, at: Long, zone: ZoneId): Boolean =
    !ended && LocalDate.parse(date) == date(at, zone)
  fun delivery(at: Long, target: Long, expiresAt: Long, expected: Long, actual: Long, eligible: Boolean): Boolean =
    expected == actual && eligible && at >= target && at < expiresAt
}

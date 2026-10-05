package com.remilo.alarm.core

import java.time.Instant
import java.time.ZoneId

/** Presentation grouping never derives overdue from a delivery target/state. */
object Agenda {
  fun group(eventMs: Long, dueMs: Long, completed: Boolean, skipped: Boolean, nowMs: Long, zone: ZoneId): String {
    if (completed || skipped) return "completed"
    if (dueMs < nowMs) return "overdue"
    val date = Instant.ofEpochMilli(eventMs).atZone(zone).toLocalDate()
    return if (date < Instant.ofEpochMilli(nowMs).atZone(zone).toLocalDate()) "earlier" else date.toString()
  }
  fun rank(group: String) = when (group) { "overdue" -> 0; "earlier" -> 1; "completed" -> 3; else -> 2 }
  fun summary(rule: RecurrenceRule): String = when (rule.frequency) {
    "daily" -> if (rule.interval == 1) "Daily" else "Every " + rule.interval + " days"
    "weekly" -> (if (rule.interval == 1) "" else "Every " + rule.interval + " weeks · ") +
      rule.weekdays.joinToString(", ") { listOf("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")[it - 1] }
    "monthlyDay" -> "Day " + rule.day + (if (rule.interval == 1) " each month" else " every " + rule.interval + " months")
    "monthlyOrdinal" -> (if (rule.ordinal == -1) "Last" else listOf("", "First", "Second", "Third", "Fourth", "Fifth")[rule.ordinal]) +
      " " + listOf("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")[rule.weekday - 1] +
      if (rule.interval == 1) " each month" else " every " + rule.interval + " months"
    "lastWeekday" -> "Last weekday" + if (rule.interval == 1) " each month" else " every " + rule.interval + " months"
    else -> if (rule.interval == 1) "Yearly" else "Every " + rule.interval + " years"
  }
}

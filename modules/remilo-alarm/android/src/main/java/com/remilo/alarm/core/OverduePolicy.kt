package com.remilo.alarm.core

import java.time.Instant
import java.time.ZoneId

/** Authored schedule authority, independent of next delivery, delivery outcome and event Due. */
object OverduePolicy {
  fun reference(mode: String, eventStartMs: Long, definedAlarmAtMs: Long?, allDay: Boolean, zone: ZoneId): Long =
    when {
      mode != "None" -> definedAlarmAtMs ?: eventStartMs
      !allDay -> eventStartMs
      else -> Instant.ofEpochMilli(eventStartMs).atZone(zone).toLocalDate().plusDays(1)
        .atStartOfDay(zone).toInstant().toEpochMilli()
    }

  fun isOverdue(referenceMs: Long, completed: Boolean, skipped: Boolean, deleted: Boolean, nowMs: Long): Boolean =
    !completed && !skipped && !deleted && referenceMs < nowMs
}

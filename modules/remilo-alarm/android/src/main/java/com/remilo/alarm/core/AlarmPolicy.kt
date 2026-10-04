package com.remilo.alarm.core

/** Pure policies: no Android, storage, Expo, or wall-clock reads. */
object AlarmPolicy {
  const val SESSION_MILLIS = 5 * 60 * 1000L
  const val SNOOZE_MILLIS = 10 * 60 * 1000L
  const val MAX_LATENESS_MILLIS = 5 * 60 * 1000L
  enum class Delivery { EARLY, RING, MISSED, STALE, BLOCKED }
  fun delivery(now: Long, target: Long, expectedGeneration: Long, actualGeneration: Long,
               eligible: Boolean, authorized: Boolean): Delivery = when {
    expectedGeneration != actualGeneration || !eligible -> Delivery.STALE
    now < target -> Delivery.EARLY
    now - target > MAX_LATENESS_MILLIS -> Delivery.MISSED
    !authorized -> Delivery.BLOCKED
    else -> Delivery.RING
  }
  fun remaining(startElapsed: Long, nowElapsed: Long): Long =
    (SESSION_MILLIS - (nowElapsed - startElapsed).coerceAtLeast(0)).coerceAtLeast(0)
}

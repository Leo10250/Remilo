package com.remilo.alarm.core

/** Ordinary postponement/completion controls never acquire Routine progress semantics. */
object AlarmPresentationPolicy {
  fun canPostpone(profiles: List<String>): Boolean = profiles.isNotEmpty() && profiles.none { it == RoutinePolicy.PROFILE }
  fun canShowOrdinaryBulk(profiles: List<String>): Boolean = profiles.size > 1 && canPostpone(profiles)
}

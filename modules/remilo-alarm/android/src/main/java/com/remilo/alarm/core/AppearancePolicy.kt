package com.remilo.alarm.core

import java.time.Instant
import java.time.ZoneId

/** Global presentation only. This policy never observes reminder content or schedules work. */
object AppearancePolicy {
  val selections = setOf("automatic", "sunrise", "sky", "evening", "night")
  val brightnesses = setOf("system", "light", "dark")
  val atmospheres = selections - "automatic"
  data class Resolved(val atmosphere: String, val brightness: String)

  fun selection(value: String?) = value?.takeIf { it in selections } ?: "automatic"
  fun brightness(value: String?) = value?.takeIf { it in brightnesses } ?: "system"
  fun resolve(selection: String?, brightness: String?, instantMs: Long, zone: ZoneId, systemDark: Boolean): Resolved {
    val selected = this.selection(selection)
    val hour = Instant.ofEpochMilli(instantMs).atZone(zone).hour
    val scene = if (selected != "automatic") selected else when (hour) {
      in 6 until 10 -> "sunrise"
      in 10 until 17 -> "sky"
      in 17 until 21 -> "evening"
      else -> "night"
    }
    val resolvedBrightness = when (this.brightness(brightness)) {
      "light" -> "light"
      "dark" -> "dark"
      else -> if (systemDark) "dark" else "light"
    }
    return Resolved(scene, resolvedBrightness)
  }

  /** Malformed captured presentation is an emergency path, never a reason to block controls. */
  fun captured(atmosphere: String?, brightness: String?): Resolved =
    if (atmosphere in atmospheres && brightness in setOf("light", "dark")) Resolved(atmosphere!!, brightness!!)
    else Resolved("night", "dark")
}

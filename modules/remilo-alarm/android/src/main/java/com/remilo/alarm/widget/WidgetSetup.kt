package com.remilo.alarm.widget

import android.content.Context
import com.remilo.alarm.presentation.L10n

/** Defaults belong to the setup draft, never to a saved widget's projection. */
internal object WidgetSetup {
  fun routineSelection(mode: String, selected: String?, plans: List<Map<String, Any?>>): String? =
    selected ?: if (mode == "Routine") plans.firstOrNull()?.get("id") as? String else null

  /** Inert, localized presentation data. Never saved as a plan, reminder or configuration. */
  fun example(context: Context, mode: String, base: WidgetSnapshot, withRoutine: Boolean = mode == "Routine", preset: String = "General"): WidgetSnapshot {
    fun text(value: String) = L10n.text(context, value)
    if (mode == "Today" && !withRoutine) return base.copy(configuration = WidgetConfiguration("Today"), session = null,
      reminders = listOf(mapOf("id" to "example", "title" to text("Water plants"), "mode" to "None",
        "eventStartMs" to java.time.LocalDate.parse(base.date).atTime(9,0).atZone(java.time.ZoneId.systemDefault()).toInstant().toEpochMilli())),
      total = 1, doneToken = null, undoToken = null, retryToken = null, locked = false, configured = true, failed = false, notice = null)
    val sample = previewSnapshot()
    @Suppress("UNCHECKED_CAST") val steps = sample.session!!["steps"] as List<Map<String, Any?>>
    return sample.copy(configuration = WidgetConfiguration(mode, "preview"), date = base.date, appearance = base.appearance,
      reminders = if(mode == "Today") example(context,"Today",base,false).reminders else emptyList(), total = if(mode == "Today")1 else 0,
      session = sample.session + mapOf(
      "title" to text(if(preset == "General") "Morning routine" else "Core & intervals"), "date" to base.date, "presentationPreset" to preset,
      "steps" to steps.mapIndexed { index, step -> step + mapOf(
        "name" to text(if(preset == "General") listOf("Drink water","Read","Plan the day","Get ready")[index] else step["name"] as String),
        "target" to text(if(preset == "General") if(index == 1) "10 minutes" else "" else step["target"] as String)) }))
  }
}

package com.remilo.alarm.widget

import android.content.Context
import com.remilo.alarm.presentation.L10n

/** Defaults belong to the setup draft, never to a saved widget's projection. */
internal object WidgetSetup {
  fun routineSelection(mode: String, selected: String?, plans: List<Map<String, Any?>>): String? =
    selected ?: if (mode == "Routine") plans.firstOrNull()?.get("id") as? String else null

  fun needsExample(snapshot: WidgetSnapshot?, mode: String, selected: String?): Boolean =
    if (mode == "Routine") selected == null else selected == null && snapshot?.reminders.orEmpty().isEmpty()

  /** Inert, localized presentation data. Never saved as a plan, reminder or configuration. */
  fun example(context: Context, mode: String, base: WidgetSnapshot): WidgetSnapshot {
    fun text(value: String) = L10n.text(context, value)
    if (mode == "Today") return base.copy(configuration = WidgetConfiguration("Today"), session = null,
      reminders = listOf(mapOf("id" to "example", "title" to text("Water plants"), "mode" to "None",
        "eventStartMs" to java.time.LocalDate.parse(base.date).atTime(9,0).atZone(java.time.ZoneId.systemDefault()).toInstant().toEpochMilli())),
      total = 1, doneToken = null, undoToken = null, retryToken = null)
    val sample = previewSnapshot()
    @Suppress("UNCHECKED_CAST") val steps = sample.session!!["steps"] as List<Map<String, Any?>>
    return sample.copy(configuration = WidgetConfiguration("Routine", "preview"), date = base.date, appearance = base.appearance, session = sample.session + mapOf(
      "title" to text("Core & intervals"), "date" to base.date,
      "steps" to steps.map { it + mapOf("name" to text(it["name"] as String), "target" to text(it["target"] as String)) }))
  }
}

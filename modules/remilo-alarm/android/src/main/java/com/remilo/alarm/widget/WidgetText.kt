package com.remilo.alarm.widget

import android.content.Context
import com.remilo.alarm.presentation.L10n
import com.remilo.alarm.system.PresentationLanguage
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import java.util.Date

internal object WidgetText {
  fun weekday(context: Context, value: String): String = runCatching { LocalDate.parse(value).format(DateTimeFormatter.ofPattern("EEEE",
    PresentationLanguage.context(context).resources.configuration.locales[0])) }.getOrDefault("")
  fun date(context: Context, value: String): String = runCatching { LocalDate.parse(value).format(DateTimeFormatter.ofLocalizedDate(FormatStyle.FULL)
    .withLocale(PresentationLanguage.context(context).resources.configuration.locales[0])) }.getOrDefault("")
  fun reminder(context: Context, row: Map<String, Any?>): String {
    val localized = PresentationLanguage.context(context)
    fun time(value: Any?): String = (value as? Number)?.toLong()?.let { android.text.format.DateFormat.getTimeFormat(context).format(Date(it)) }.orEmpty()
    fun dated(value: Any?): String = (value as? Number)?.toLong()?.let {
      java.text.DateFormat.getDateInstance(java.text.DateFormat.MEDIUM, localized.resources.configuration.locales[0]).format(Date(it)) + " · " + time(value)
    }.orEmpty()
    val original = if (row["overdue"] == true) dated(row["overdueAtMs"]) else time(row["alarmAtMs"] ?: row["eventStartMs"])
    val next = dated(row["nextAlertMs"])
    val label = if (row["overdue"] == true) L10n.text(localized, "Overdue") + " · " + original else original
    return if (row["overdue"] == true && row["mode"] != "None" && next.isNotEmpty() && row["nextAlertMs"] != row["overdueAtMs"])
      label + " · " + L10n.text(localized, "Next alert: $next") else label
  }
}

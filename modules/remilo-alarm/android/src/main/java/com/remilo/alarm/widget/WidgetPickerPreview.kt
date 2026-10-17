package com.remilo.alarm.widget

import android.appwidget.AppWidgetProviderInfo
import android.content.Context
import androidx.glance.appwidget.GlanceAppWidgetManager

/** Generated previews are cached by Android, independently of placed widgets.
 * Publish only presentation/sample changes and respect Android's limited quota. */
internal object WidgetPickerPreview {
  suspend fun update(context: Context) {
    if(android.os.Build.VERSION.SDK_INT < 35 || !WidgetWork.unlocked(context)) return
    runCatching {
      val appearance = widgetRequest(context) { it.widgetSnapshot(-1,false).appearance }
      val key = "direct-1:${appearance.atmosphere}:${appearance.brightness}:${com.remilo.alarm.system.PresentationLanguage.language}:${context.resources.configuration.fontScale}:${java.time.LocalDate.now()}"
      val preferences = context.getSharedPreferences("remilo-widget-picker-preview",Context.MODE_PRIVATE)
      val now = System.currentTimeMillis()
      if(preferences.getString("published",null) == key || now - preferences.getLong("attempt",0) in 0 until 30 * 60_000L) return
      preferences.edit().putLong("attempt",now).apply()
      if(GlanceAppWidgetManager(context).setWidgetPreviews(RemiloWidgetReceiver::class,
          androidx.collection.intSetOf(AppWidgetProviderInfo.WIDGET_CATEGORY_HOME_SCREEN)) == GlanceAppWidgetManager.SET_WIDGET_PREVIEWS_RESULT_SUCCESS)
        preferences.edit().putString("published",key).apply()
    }
  }
}

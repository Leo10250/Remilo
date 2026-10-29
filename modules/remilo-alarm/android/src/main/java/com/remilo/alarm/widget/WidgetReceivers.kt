package com.remilo.alarm.widget

import android.appwidget.AppWidgetManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Bundle
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import com.remilo.alarm.engine.AlarmEngine

class RemiloWidgetReceiver : GlanceAppWidgetReceiver() {
  override val glanceAppWidget = RemiloWidget()
  override fun onReceive(context: Context, intent: Intent) {
    if (!WidgetWork.unlocked(context)) { WidgetWork.generic(context); return }
    super.onReceive(context, intent)
    WidgetWork.request(context)
  }
  override fun onDeleted(context: Context, appWidgetIds: IntArray) {
    super.onDeleted(context, appWidgetIds)
    val engine = AlarmEngine.get(context)
    engine.request({ appWidgetIds.forEach(engine::removeWidget) }, {}, {})
    // Always run cleanup, including when the final instance has disappeared.
    androidx.work.WorkManager.getInstance(context).enqueue(androidx.work.OneTimeWorkRequest.Builder(WidgetRefreshWorker::class.java).build())
  }
  override fun onRestored(context: Context, oldWidgetIds: IntArray, newWidgetIds: IntArray) {
    val engine = AlarmEngine.get(context)
    engine.request({ oldWidgetIds.zip(newWidgetIds.toList()).forEach { (old, new) -> engine.restoreWidget(old, new) } }, { WidgetWork.request(context) }, {})
    super.onRestored(context, oldWidgetIds, newWidgetIds)
  }
}

class WidgetPinReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val token = intent.getStringExtra("token") ?: return
    val number = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID)
    if (!WidgetWork.unlocked(context) || !WidgetWork.supported(context, number)) return
    val pending = goAsync(); val engine = AlarmEngine.get(context)
    engine.request({ engine.finishWidgetPin(token, number) }, { WidgetWork.request(context); pending.finish() }, { pending.finish() })
  }
}

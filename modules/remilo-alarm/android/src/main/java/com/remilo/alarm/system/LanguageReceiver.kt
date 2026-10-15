package com.remilo.alarm.system

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.remilo.alarm.engine.AlarmEngine

/** Locale changes refresh presentation only; never Calendar work or scheduling. */
class LanguageReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != Intent.ACTION_LOCALE_CHANGED) return
    val pending = goAsync()
    try { AlarmEngine.get(context).presentationChanged { pending.finish() } }
    catch (_: Exception) { pending.finish() }
  }
}

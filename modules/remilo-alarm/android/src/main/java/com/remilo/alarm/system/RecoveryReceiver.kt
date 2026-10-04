package com.remilo.alarm.system

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.remilo.alarm.engine.AlarmEngine

class RecoveryReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action !in ACTIONS) return
    Log.i("Remilo", "Recovery received: ${intent.action}")
    val pending = goAsync()
    try { AlarmEngine.get(context).recover { pending.finish() } }
    catch (_: Exception) { pending.finish() }
  }
  companion object {
    private val ACTIONS = setOf(Intent.ACTION_LOCKED_BOOT_COMPLETED, Intent.ACTION_BOOT_COMPLETED,
      Intent.ACTION_USER_UNLOCKED, Intent.ACTION_MY_PACKAGE_REPLACED, Intent.ACTION_TIME_CHANGED,
      Intent.ACTION_TIMEZONE_CHANGED, "android.app.action.SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED")
  }
}

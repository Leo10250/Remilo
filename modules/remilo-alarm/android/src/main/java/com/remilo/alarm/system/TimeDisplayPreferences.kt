package com.remilo.alarm.system

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.database.ContentObserver
import android.os.Handler
import android.os.Looper
import android.provider.Settings

/** Bridge observation of the native-owned presentation snapshot; no scheduling. */
object TimeDisplayPreferences {
  fun read(context: Context): Map<String, Any> = com.remilo.alarm.engine.AlarmEngine.get(context).presentationSnapshot()

  fun observe(context: Context, changed: () -> Unit): AutoCloseable {
    val owner = context.applicationContext
    val observer = object : ContentObserver(Handler(Looper.getMainLooper())) {
      override fun onChange(selfChange: Boolean) { changed() }
    }
    val receiver = object : BroadcastReceiver() {
      override fun onReceive(context: Context?, intent: Intent?) { changed() }
    }
    owner.contentResolver.registerContentObserver(Settings.System.getUriFor(Settings.System.TIME_12_24), false, observer)
    try { owner.registerReceiver(receiver, IntentFilter(Intent.ACTION_LOCALE_CHANGED), Context.RECEIVER_NOT_EXPORTED) }
    catch (error: Exception) { owner.contentResolver.unregisterContentObserver(observer); throw error }
    return AutoCloseable { owner.contentResolver.unregisterContentObserver(observer); owner.unregisterReceiver(receiver) }
  }
}

package com.remilo.alarm.system

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.database.ContentObserver
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.text.format.DateFormat

/** Device presentation only. No engine, private content, storage, or scheduling. */
object TimeDisplayPreferences {
  fun read(context: Context): Map<String, Any> = mapOf(
    "uses24HourClock" to DateFormat.is24HourFormat(context),
    "localeTag" to context.resources.configuration.locales[0].toLanguageTag())

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

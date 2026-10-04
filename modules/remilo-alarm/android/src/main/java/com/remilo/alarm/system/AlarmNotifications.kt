package com.remilo.alarm.system

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import com.remilo.alarm.data.AlertRecord

/** Silent channels: only the native service owns alarm audio. */
class AlarmNotifications(private val context: Context) {
  private val manager = context.getSystemService(NotificationManager::class.java)
  init {
    manager.createNotificationChannel(NotificationChannel(RINGING_CHANNEL, "Ringing alarms",
      NotificationManager.IMPORTANCE_HIGH).apply { setSound(null, null); enableVibration(false) })
    manager.createNotificationChannel(NotificationChannel(ATTENTION_CHANNEL, "Unresolved reminders",
      NotificationManager.IMPORTANCE_LOW).apply { setSound(null, null); enableVibration(false) })
  }
  fun ringing(sessionId: String, members: List<Pair<AlertRecord, String>> = emptyList()): Notification {
    val open = PendingIntent.getActivity(context, 0,
      Intent(context, AlarmActivity::class.java).setData(Uri.parse("remilo-alarm://session/$sessionId"))
        .putExtra("sessionId", sessionId), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    val builder = Notification.Builder(context, RINGING_CHANNEL)
      .setSmallIcon(android.R.drawable.ic_lock_idle_alarm).setContentTitle("Remilo alarm")
      .setContentText(if (members.size == 1) members.first().second else "${members.size.coerceAtLeast(1)} reminders")
      .setCategory(Notification.CATEGORY_ALARM).setOngoing(true).setOnlyAlertOnce(true)
      .setVisibility(Notification.VISIBILITY_PRIVATE).setContentIntent(open)
    if (manager.canUseFullScreenIntent()) builder.setFullScreenIntent(open, true)
    if (members.size == 1) {
      val record = members.first().first
      builder.addAction(Notification.Action.Builder(null, "Stop", AlarmScheduler.action(context, "stop", record)).build())
      builder.addAction(Notification.Action.Builder(null, "Snooze 10 min", AlarmScheduler.action(context, "snooze", record)).build())
    }
    return builder.build()
  }
  fun update(sessionId: String, members: List<Pair<AlertRecord, String>>) {
    if (allowed()) manager.notify(FOREGROUND_ID, ringing(sessionId, members))
  }
  fun unresolved(record: AlertRecord) {
    if (!allowed()) return
    manager.notify(record.occurrenceId, 1, Notification.Builder(context, ATTENTION_CHANNEL)
      .setSmallIcon(android.R.drawable.ic_lock_idle_alarm).setContentTitle("Reminder needs attention")
      .setContentText("${record.state} · unfinished").setOnlyAlertOnce(true)
      .setVisibility(Notification.VISIBILITY_PRIVATE)
      .addAction(Notification.Action.Builder(null, "Snooze 10 min", AlarmScheduler.action(context, "snooze", record)).build())
      .build())
  }
  fun clearAttention(id: String) = manager.cancel(id, 1)
  private fun allowed() = context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
  companion object {
    const val RINGING_CHANNEL = "remilo-ringing-v1"
    const val ATTENTION_CHANNEL = "remilo-attention-v1"
    const val FOREGROUND_ID = 100
  }
}

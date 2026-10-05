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
import android.media.AudioAttributes
import android.media.RingtoneManager
import com.remilo.alarm.data.AlertRecord
import com.remilo.alarm.R

/** Silent channels: only the native service owns alarm audio. */
class AlarmNotifications(private val context: Context) {
  private val manager = context.getSystemService(NotificationManager::class.java)
  init {
    manager.createNotificationChannel(NotificationChannel(RINGING_CHANNEL, "Ringing alarms",
      NotificationManager.IMPORTANCE_HIGH).apply { setSound(null, null); enableVibration(false) })
    manager.createNotificationChannel(NotificationChannel(ATTENTION_CHANNEL, "Unresolved reminders",
      NotificationManager.IMPORTANCE_LOW).apply { setSound(null, null); enableVibration(false) })
    manager.createNotificationChannel(NotificationChannel(NOTIFICATION_CHANNEL, "Notification reminders",
      NotificationManager.IMPORTANCE_DEFAULT).apply {
      setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION),
        AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION).build())
    })
  }
  fun ringing(sessionId: String, members: List<Pair<AlertRecord, String>>): Notification {
    require(members.isNotEmpty()) { "Ringing notifications need actionable members" }
    val open = PendingIntent.getActivity(context, 0,
      Intent(context, AlarmActivity::class.java).setData(Uri.parse("remilo-alarm://session/$sessionId"))
        .putExtra("sessionId", sessionId), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    val builder = Notification.Builder(context, RINGING_CHANNEL)
      .setSmallIcon(R.drawable.ic_remilo_notification).setContentTitle(if (members.size == 1) members.first().second else "${members.size} reminders ringing")
      .setContentText("Remilo · alarm ringing")
      .setCategory(Notification.CATEGORY_ALARM).setOngoing(true).setOnlyAlertOnce(true)
      .setVisibility(Notification.VISIBILITY_PRIVATE).setContentIntent(open)
    if (manager.canUseFullScreenIntent()) builder.setFullScreenIntent(open, true)
    if (members.size == 1) {
      val record = members.first().first
      builder.addAction(Notification.Action.Builder(null, "Stop", AlarmScheduler.action(context, "stop", record)).build())
      builder.addAction(Notification.Action.Builder(null, "Snooze ${record.snoozeMinutes} min", AlarmScheduler.action(context, "snooze", record)).build())
    } else {
      builder.addAction(Notification.Action.Builder(null, "Stop all", AlarmScheduler.stopAll(context, sessionId)).build())
    }
    return builder.build()
  }
  fun update(sessionId: String, members: List<Pair<AlertRecord, String>>) {
    if (allowed()) manager.notify(FOREGROUND_ID, ringing(sessionId, members))
  }
  fun unresolved(record: AlertRecord) {
    if (!allowed()) return
    manager.notify(record.occurrenceId, 1, Notification.Builder(context, ATTENTION_CHANNEL)
      .setSmallIcon(R.drawable.ic_remilo_notification).setContentTitle("Unfinished reminder")
      .setContentText(when (record.state) { "Stopped" -> "Alarm stopped"; "TimedOut" -> "Alarm ended after five minutes";
        "Missed" -> "Alarm missed"; "Interrupted" -> "Alarm interrupted"; else -> "Alarm could not ring" }).setOnlyAlertOnce(true)
      .setVisibility(Notification.VISIBILITY_PRIVATE)
      .setContentIntent(openReminder(record.occurrenceId))
      .addAction(Notification.Action.Builder(null, "Snooze ${record.snoozeMinutes} min", AlarmScheduler.action(context, "snooze", record)).build())
      .build())
  }
  fun regular(record: AlertRecord, title: String) {
    if (!allowed()) return
    manager.notify(record.occurrenceId, 1, Notification.Builder(context, NOTIFICATION_CHANNEL)
      .setSmallIcon(R.drawable.ic_remilo_notification).setContentTitle(title)
      .setContentText("Reminder due · tap to review").setCategory(Notification.CATEGORY_REMINDER)
      .setVisibility(Notification.VISIBILITY_PRIVATE).setContentIntent(openReminder(record.occurrenceId))
      .addAction(Notification.Action.Builder(null, "Snooze ${record.snoozeMinutes} min", AlarmScheduler.action(context, "snooze", record)).build())
      .build())
  }
  private fun openReminder(id: String): PendingIntent = PendingIntent.getActivity(context, 0,
    Intent(Intent.ACTION_VIEW, Uri.Builder().scheme("remilo").authority("reminder").appendPath(id).build())
      .setPackage(context.packageName).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
    PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
  fun clearAttention(id: String) = manager.cancel(id, 1)
  private fun allowed() = context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
  companion object {
    const val RINGING_CHANNEL = "remilo-ringing-v1"
    const val ATTENTION_CHANNEL = "remilo-attention-v1"
    const val NOTIFICATION_CHANNEL = "remilo-notification-v1"
    const val FOREGROUND_ID = 100
  }
}

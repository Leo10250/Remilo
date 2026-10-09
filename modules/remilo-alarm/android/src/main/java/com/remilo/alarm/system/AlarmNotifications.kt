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
import com.remilo.alarm.core.AppearancePolicy
import com.remilo.alarm.presentation.AtmosphereTokens
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
  fun ringing(sessionId: String, members: List<Pair<AlertRecord, String>>, appearance: AppearancePolicy.Resolved): Notification {
    return ringingVariant(sessionId, members, appearance, false)
  }
  private fun ringingVariant(sessionId: String, members: List<Pair<AlertRecord, String>>, appearance: AppearancePolicy.Resolved, public: Boolean): Notification {
    require(members.isNotEmpty()) { "Ringing notifications need actionable members" }
    val open = PendingIntent.getActivity(context, 0,
      Intent(context, AlarmActivity::class.java).setData(Uri.parse("remilo-alarm://session/$sessionId"))
        .putExtra("sessionId", sessionId).putExtra("atmosphere", appearance.atmosphere)
        .putExtra("brightness", appearance.brightness), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    val builder = Notification.Builder(context, RINGING_CHANNEL)
      .setSmallIcon(R.drawable.ic_remilo_notification).setContentTitle(if (members.size == 1) if (public) "Reminder" else members.first().second else "${members.size} reminders ringing")
      .setContentText("Remilo · alarm ringing")
      .setColor(AtmosphereTokens.colors(appearance.atmosphere, appearance.brightness).primary.toInt())
      .setCategory(Notification.CATEGORY_ALARM).setOngoing(true).setOnlyAlertOnce(true)
      .setVisibility(if (public) Notification.VISIBILITY_PUBLIC else Notification.VISIBILITY_PRIVATE).setContentIntent(open)
    if (manager.canUseFullScreenIntent()) builder.setFullScreenIntent(open, true)
    if (members.size == 1) {
      val record = members.first().first
      builder.addAction(Notification.Action.Builder(null, "Done", AlarmScheduler.capturedAction(context, "done", record)).build())
      builder.addAction(Notification.Action.Builder(null, "Snooze · ${record.snoozeMinutes} min", AlarmScheduler.capturedAction(context, "quicksnooze", record)).build())
    } else {
      val records = members.map { it.first }
      builder.addAction(Notification.Action.Builder(null, "Done all (${members.size})", AlarmScheduler.capturedGroup(context, "doneall", sessionId, records)).build())
      builder.addAction(Notification.Action.Builder(null, "Snooze all · ${records.first().snoozeMinutes} min", AlarmScheduler.capturedGroup(context, "snoozeall", sessionId, records)).build())
    }
    if (!public) builder.setPublicVersion(ringingVariant(sessionId, members, appearance, true))
    return builder.build()
  }
  fun update(sessionId: String, members: List<Pair<AlertRecord, String>>, appearance: AppearancePolicy.Resolved) {
    if (allowed()) manager.notify(FOREGROUND_ID, ringing(sessionId, members, appearance))
  }
  fun unresolved(record: AlertRecord) {
    if (!allowed()) return
    manager.notify(record.occurrenceId, 1, Notification.Builder(context, ATTENTION_CHANNEL)
      .setSmallIcon(R.drawable.ic_remilo_notification).setContentTitle("Unfinished reminder")
      .setContentText(when (record.state) { "Stopped" -> "Alarm stopped"; "TimedOut" -> "Alarm ended after five minutes";
        "Missed" -> if (record.mode == "Notification") "Notification delivery missed" else "Alarm missed";
        "Interrupted" -> "Alarm interrupted"; else -> if (record.mode == "Notification") "Notification could not be scheduled" else "Alarm could not ring" }).setOnlyAlertOnce(true)
      .setVisibility(Notification.VISIBILITY_PRIVATE)
      .setContentIntent(openReminder(record.occurrenceId))
      .addAction(Notification.Action.Builder(null, "Snooze · ${record.snoozeMinutes} min", AlarmScheduler.capturedAction(context, "quicksnooze", record)).build())
      .build())
  }
  fun regular(record: AlertRecord, title: String, appearance: AppearancePolicy.Resolved, onlyAlertOnce: Boolean = false) {
    if (!allowed()) return
    val public = Notification.Builder(context, NOTIFICATION_CHANNEL)
      .setColor(AtmosphereTokens.colors(appearance.atmosphere, appearance.brightness).primary.toInt())
      .setSmallIcon(R.drawable.ic_remilo_notification).setContentTitle("Reminder")
      .setContentText("Reminder · tap to review").setCategory(Notification.CATEGORY_REMINDER).setOnlyAlertOnce(onlyAlertOnce)
      .setVisibility(Notification.VISIBILITY_PUBLIC).setContentIntent(openReminder(record.occurrenceId))
      .addAction(Notification.Action.Builder(null, "Done", AlarmScheduler.capturedAction(context, "done", record)).build())
      .addAction(Notification.Action.Builder(null, "Snooze · ${record.snoozeMinutes} min", AlarmScheduler.capturedAction(context, "quicksnooze", record)).build()).build()
    manager.notify(record.occurrenceId, 1, Notification.Builder(context, NOTIFICATION_CHANNEL)
      .setColor(AtmosphereTokens.colors(appearance.atmosphere, appearance.brightness).primary.toInt())
      .setSmallIcon(R.drawable.ic_remilo_notification).setContentTitle(title)
      .setContentText("Reminder · tap to review").setCategory(Notification.CATEGORY_REMINDER).setOnlyAlertOnce(onlyAlertOnce)
      .setVisibility(Notification.VISIBILITY_PRIVATE).setPublicVersion(public).setContentIntent(openReminder(record.occurrenceId))
      .addAction(Notification.Action.Builder(null, "Done", AlarmScheduler.capturedAction(context, "done", record)).build())
      .addAction(Notification.Action.Builder(null, "Snooze · ${record.snoozeMinutes} min", AlarmScheduler.capturedAction(context, "quicksnooze", record)).build())
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

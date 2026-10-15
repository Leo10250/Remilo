package com.remilo.alarm.calendar

import android.Manifest
import android.app.*
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import com.remilo.alarm.R

/** Generic summary only. Dismissal has no relationship to the durable review queue. */
class CalendarReviewNotifications(private val context: Context) {
  private val manager get() = context.getSystemService(NotificationManager::class.java)
  fun allowed(): Boolean = context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED &&
    manager.areNotificationsEnabled() && manager.getNotificationChannel(CHANNEL)?.importance != NotificationManager.IMPORTANCE_NONE
  fun active() = manager.activeNotifications.any { it.tag == TAG && it.id == ID }
  fun present(count: Int, newlyDiscovered: Boolean) {
    if (count == 0 || !allowed()) { manager.cancel(TAG, ID); return }
    if (!newlyDiscovered && !active()) return
    if (manager.getNotificationChannel(CHANNEL) == null) manager.createNotificationChannel(NotificationChannel(CHANNEL, "Calendar review", NotificationManager.IMPORTANCE_LOW).apply {
      setSound(null, null); enableVibration(false); lockscreenVisibility = Notification.VISIBILITY_PRIVATE
    })
    val open = PendingIntent.getActivity(context, 0, Intent(Intent.ACTION_VIEW, Uri.parse("remilo://calendar-reviews"))
      .setPackage(context.packageName).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    val public = Notification.Builder(context, CHANNEL).setSmallIcon(R.drawable.ic_remilo_notification)
      .setContentTitle("Calendar review").setContentText("Open Remilo to review Calendar changes.").build()
    manager.notify(TAG, ID, Notification.Builder(context, CHANNEL).setSmallIcon(R.drawable.ic_remilo_notification)
      .setContentTitle("Calendar changes need review").setContentText("$count unfinished reminder${if (count == 1) "" else "s"} need review.")
      .setContentIntent(open).setVisibility(Notification.VISIBILITY_PRIVATE).setPublicVersion(public)
      .setGroup("remilo-calendar-review").setGroupSummary(true).setOnlyAlertOnce(true).setAutoCancel(true).build())
  }
  companion object { const val CHANNEL = "remilo-calendar-review-v1"; const val TAG = "calendar-review"; const val ID = 600 }
}

package com.remilo.alarm.calendar

import com.remilo.alarm.presentation.NativeMessages

import com.remilo.alarm.presentation.L10n


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
  private fun channel() = manager.createNotificationChannel(NotificationChannel(CHANNEL, L10n.text(NativeMessages.m_4e680674ef4c()), NotificationManager.IMPORTANCE_LOW).apply {
    description = L10n.text(NativeMessages.m_d1dea647eb34())
    setSound(null, null); enableVibration(false); lockscreenVisibility = Notification.VISIBILITY_PRIVATE
  })
  fun refreshPresentation() {
    if (manager.getNotificationChannel(CHANNEL) != null) channel()
    val posted = manager.activeNotifications.firstOrNull { it.tag == TAG && it.id == ID } ?: return
    val count = posted.notification.extras.getInt("remilo.reviewCount", -1)
    val public = Notification.Builder(context, CHANNEL).setSmallIcon(R.drawable.ic_remilo_notification)
      .setContentTitle(L10n.text(NativeMessages.m_4e680674ef4c())).setContentText(L10n.text(NativeMessages.m_156ba358f110())).build()
    manager.notify(TAG, ID, Notification.Builder.recoverBuilder(context, posted.notification)
      .setContentTitle(L10n.text(NativeMessages.m_de41ed657181()))
      .setContentText(if (count >= 0) L10n.text(NativeMessages.calendar_review_notification(count)) else L10n.text(NativeMessages.m_156ba358f110()))
      .setPublicVersion(public).setOnlyAlertOnce(true).build())
  }
  fun allowed(): Boolean = context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED &&
    manager.areNotificationsEnabled() && manager.getNotificationChannel(CHANNEL)?.importance != NotificationManager.IMPORTANCE_NONE
  fun active() = manager.activeNotifications.any { it.tag == TAG && it.id == ID }
  fun present(count: Int, newlyDiscovered: Boolean) {
    if (count == 0 || !allowed()) { manager.cancel(TAG, ID); return }
    if (!newlyDiscovered && !active()) return
    channel()
    val open = PendingIntent.getActivity(context, 0, Intent(Intent.ACTION_VIEW, Uri.parse("remilo://calendar-reviews"))
      .setPackage(context.packageName).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    val public = Notification.Builder(context, CHANNEL).setSmallIcon(R.drawable.ic_remilo_notification)
      .setContentTitle(L10n.text(NativeMessages.m_4e680674ef4c())).setContentText(L10n.text(NativeMessages.m_156ba358f110())).build()
    manager.notify(TAG, ID, Notification.Builder(context, CHANNEL).setSmallIcon(R.drawable.ic_remilo_notification)
      .setContentTitle(L10n.text(NativeMessages.m_de41ed657181())).setContentText(L10n.text(NativeMessages.calendar_review_notification(count)))
      .setContentIntent(open).setVisibility(Notification.VISIBILITY_PRIVATE).setPublicVersion(public)
      .addExtras(android.os.Bundle().apply { putInt("remilo.reviewCount", count) })
      .setGroup("remilo-calendar-review").setGroupSummary(true).setOnlyAlertOnce(true).setAutoCancel(true).build())
  }
  companion object { const val CHANNEL = "remilo-calendar-review-v1"; const val TAG = "calendar-review"; const val ID = 600 }
}

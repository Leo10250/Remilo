package com.remilo.alarm.calendar

import android.Manifest
import android.app.*
import android.content.Context
import org.junit.*
import org.junit.Assert.*
import org.junit.runner.RunWith
import org.robolectric.*
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34], application = Application::class)
class CalendarReviewNotificationsTest {
  private val app: Application get() = RuntimeEnvironment.getApplication()
  private val manager get() = app.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
  @Before fun setup() { Shadows.shadowOf(app).grantPermissions(Manifest.permission.POST_NOTIFICATIONS) }
  @Test fun summaryIsQuietGenericAndHasNoAlarmOrFullScreenBehavior() {
    CalendarReviewNotifications(app).present(3, true)
    val channel = manager.getNotificationChannel(CalendarReviewNotifications.CHANNEL)
    assertEquals(NotificationManager.IMPORTANCE_LOW, channel.importance); assertNull(channel.sound); assertFalse(channel.shouldVibrate())
    val notification = manager.activeNotifications.single().notification
    assertNull(notification.fullScreenIntent); assertNull(notification.sound); assertNull(notification.vibrate)
    assertEquals("Calendar changes need review", notification.extras.getString(Notification.EXTRA_TITLE))
    assertEquals("Open Remilo to review Calendar changes.", notification.publicVersion.extras.getString(Notification.EXTRA_TEXT))
    val intent = Shadows.shadowOf(notification.contentIntent).savedIntent
    assertEquals("remilo://calendar-reviews", intent.data.toString()); assertTrue(intent.extras == null || intent.extras!!.isEmpty)
  }
  @Test fun dismissalDoesNotRepostAndResolvingRemovesTheSummary() {
    val notifications = CalendarReviewNotifications(app)
    notifications.present(2, true); manager.cancel(CalendarReviewNotifications.TAG, CalendarReviewNotifications.ID)
    notifications.present(2, false); assertTrue(manager.activeNotifications.isEmpty())
    notifications.present(1, true); assertEquals(1, manager.activeNotifications.size)
    notifications.present(0, false); assertTrue(manager.activeNotifications.isEmpty())
  }
  @Test fun permissionDenialAndUserChannelChangesAreRespected() {
    val notifications = CalendarReviewNotifications(app)
    Shadows.shadowOf(app).denyPermissions(Manifest.permission.POST_NOTIFICATIONS)
    notifications.present(1, true); assertTrue(manager.activeNotifications.isEmpty())
    Shadows.shadowOf(app).grantPermissions(Manifest.permission.POST_NOTIFICATIONS)
    manager.createNotificationChannel(NotificationChannel(CalendarReviewNotifications.CHANNEL, "User choice", NotificationManager.IMPORTANCE_NONE))
    notifications.present(1, true); assertTrue(manager.activeNotifications.isEmpty())
    assertEquals(NotificationManager.IMPORTANCE_NONE, manager.getNotificationChannel(CalendarReviewNotifications.CHANNEL).importance)
  }
}

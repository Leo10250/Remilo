package com.remilo.alarm.system

import android.Manifest
import android.app.Application
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import com.remilo.alarm.core.AppearancePolicy
import com.remilo.alarm.core.RoutinePolicy
import com.remilo.alarm.data.AlertRecord
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34], application = Application::class)
class NotificationPostponeIntentTest {
  private val context: Context get() = RuntimeEnvironment.getApplication()
  private val appearance = AppearancePolicy.captured("sky", "light")
  private fun record(id: String = "ordinary", generation: Long = 7) =
    AlertRecord(id, 1000, generation, "Alerting", sessionId = "session")

  @Before fun setup() {
    shadowOf(context as Application).grantPermissions(Manifest.permission.POST_NOTIFICATIONS)
    PresentationLanguage.update(context, "en")
  }

  private fun request(handle: PendingIntent): JSONObject {
    assertTrue(handle.isImmutable)
    assertTrue(shadowOf(handle).isActivity)
    val intent = shadowOf(handle).savedIntent
    assertEquals(Intent.ACTION_VIEW, intent.action)
    assertEquals(context.packageName + ".MainActivity", intent.component!!.className)
    assertEquals(context.packageName, intent.component!!.packageName)
    val uri = intent.data!!
    assertEquals("remilo", uri.scheme); assertEquals("/", uri.path)
    assertTrue(uri.authority.isNullOrEmpty())
    assertEquals(setOf("postponeRequest"), uri.queryParameterNames)
    assertFalse(uri.toString().contains("Private title"))
    assertFalse(uri.toString().contains("private-notes"))
    return JSONObject(uri.getQueryParameter("postponeRequest")!!)
  }

  @Test fun ordinaryRingingPrivateAndPublicActionsOpenHomeWithSameCapturedRequest() {
    val notification = AlarmNotifications(context).ringing("session", listOf(record() to "Private title"), appearance)
    assertEquals(listOf("Mark as done", "Postpone"), notification.actions.map { it.title.toString() })
    assertEquals(listOf("Mark as done", "Postpone"), notification.publicVersion.actions.map { it.title.toString() })
    val action = notification.actions[1].actionIntent
    assertEquals(action, notification.publicVersion.actions[1].actionIntent)
    val capture = request(action)
    assertEquals(setOf("kind", "occurrenceId", "expectedGeneration"), capture.keys().asSequence().toSet())
    assertEquals("Single", capture.getString("kind")); assertEquals("ordinary", capture.getString("occurrenceId"))
    assertEquals(7L, capture.getLong("expectedGeneration"))
    assertTrue(shadowOf(notification.actions[0].actionIntent).isBroadcast)
    assertEquals(AlarmNotifications.RINGING_CHANNEL, notification.channelId)
    assertEquals(AlarmActivity::class.java.name, shadowOf(notification.contentIntent).savedIntent.component!!.className)
  }

  @Test fun notificationModeHasDirectPostponeWithoutAlarmAudioOrFullScreen() {
    val record = record().copy(mode = "Notification", state = "Notified")
    AlarmNotifications(context).regular(record, "Private title", appearance)
    val notification = context.getSystemService(NotificationManager::class.java).activeNotifications.single().notification
    assertEquals(listOf("Mark as done", "Postpone"), notification.actions.map { it.title.toString() })
    assertEquals(notification.actions[1].actionIntent, notification.publicVersion.actions[1].actionIntent)
    request(notification.actions[1].actionIntent)
    assertNull(notification.fullScreenIntent)
    assertEquals(AlarmNotifications.NOTIFICATION_CHANNEL, notification.channelId)
    assertNull(shadowOf(context as Application).nextStartedService)
  }

  @Test fun groupRequestFreezesOnlyShownMembersAndPostingNewGenerationDoesNotRewriteOldIntent() {
    val first = record("a/with?reserved&字", 1)
    val second = record("b", 2)
    val notification = AlarmNotifications(context).ringing("session", listOf(second to "Private title", first to "private-notes"), appearance)
    assertEquals(listOf("Mark all as done (2)", "Postpone all"), notification.actions.map { it.title.toString() })
    val old = notification.actions[1].actionIntent
    val capture = request(old)
    assertEquals(setOf("kind", "expectedSessionId", "members"), capture.keys().asSequence().toSet())
    assertEquals("Group", capture.getString("kind")); assertEquals("session", capture.getString("expectedSessionId"))
    val members = capture.getJSONArray("members")
    assertEquals(2, members.length())
    assertEquals(first.occurrenceId, members.getJSONObject(0).getString("occurrenceId"))
    assertEquals(1L, members.getJSONObject(0).getLong("expectedGeneration"))
    assertEquals("b", members.getJSONObject(1).getString("occurrenceId"))
    val later = AlarmNotifications(context).ringing("session", listOf(first.copy(generation = 3) to "Private title", second to "private-notes", record("later", 1) to "Later"), appearance)
    assertNotEquals(old, later.actions[1].actionIntent)
    assertEquals(2, request(old).getJSONArray("members").length())
    assertEquals(1L, request(old).getJSONArray("members").getJSONObject(0).getLong("expectedGeneration"))
  }

  @Test fun attentionNotificationReplacesQuickSnoozeWithCapturedPostponeOnly() {
    AlarmNotifications(context).unresolved(record().copy(state = "TimedOut", sessionId = null))
    val notification = context.getSystemService(NotificationManager::class.java).activeNotifications.single().notification
    assertEquals(listOf("Postpone"), notification.actions.map { it.title.toString() })
    assertEquals("Single", request(notification.actions.single().actionIntent).getString("kind"))
    assertEquals(AlarmNotifications.ATTENTION_CHANNEL, notification.channelId)
  }

  @Test fun routineAndMixedNotificationsRetainExistingControlsAndCannotUseOrdinaryPostpone() {
    val routine = record("routine", 1).copy(profile = RoutinePolicy.PROFILE, expiresAtMs = 1_000_000)
    val notification = AlarmNotifications(context).ringing("session", listOf(routine to "Routine title"), appearance, atMs = 1000)
    assertEquals(listOf("Start routine", "Snooze · 10 min", "Dismiss alarm"), notification.actions.map { it.title.toString() })
    val mixed = AlarmNotifications(context).ringing("session", listOf(routine to "Routine title", record() to "Private title"), appearance, atMs = 1000)
    assertTrue(mixed.actions.isNullOrEmpty()); assertTrue(mixed.publicVersion.actions.isNullOrEmpty())
    assertThrows(IllegalArgumentException::class.java) { NotificationPostponeIntent.single(context, routine) }
    assertThrows(IllegalArgumentException::class.java) { NotificationPostponeIntent.group(context, "session", listOf(record(), routine)) }
    assertEquals("com.remilo.alarm.routinesnooze", shadowOf(notification.actions[1].actionIntent).savedIntent.action)
  }
}

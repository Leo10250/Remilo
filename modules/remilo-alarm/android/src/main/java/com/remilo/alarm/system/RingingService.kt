package com.remilo.alarm.system

import android.app.Service
import android.app.Notification
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import com.remilo.alarm.engine.AlarmEngine

class RingingService : Service() {
  private val main = Handler(Looper.getMainLooper())
  private var sessionId: String? = null
  private var audio: AlarmAudio? = null
  private lateinit var notifications: AlarmNotifications
  override fun onCreate() { super.onCreate(); notifications = AlarmNotifications(this); active = this }
  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val id = intent?.getStringExtra("sessionId") ?: run { stopSelf(); return START_NOT_STICKY }
    try {
      // The engine supplies a complete snapshot before dispatch. Posting an empty
      // placeholder first can leave the initial heads-up surface without controls.
      val initial = requireNotNull(intent.getParcelableExtra(INITIAL_NOTIFICATION, Notification::class.java))
      startForeground(AlarmNotifications.FOREGROUND_ID, initial,
        ServiceInfo.FOREGROUND_SERVICE_TYPE_SYSTEM_EXEMPTED)
    } catch (_: Exception) {
      AlarmEngine.get(this).audioEnded(id, "Blocked")
      stopSelf(); return START_NOT_STICKY
    }
    if (sessionId != id) { audio?.stop("TimedOut"); audio = null; sessionId = id }
    refreshMembers(id)
    return START_NOT_STICKY
  }
  private fun refreshMembers(id: String) {
    AlarmEngine.get(this).sessionMembers(id) { members -> main.post {
      if (sessionId != id) return@post
      if (members.isEmpty()) {
        audio?.stop(); audio = null
        stopForeground(STOP_FOREGROUND_REMOVE); stopSelf()
      } else {
        notifications.update(id, members)
        if (audio == null) {
          audio = AlarmAudio(this, { elapsed -> AlarmEngine.get(this).audioStarted(id, elapsed) }, { reason ->
            AlarmEngine.get(this).audioEnded(id, reason)
            main.post { if (sessionId == id) { stopForeground(STOP_FOREGROUND_REMOVE); stopSelf() } }
          }).also { it.start() }
        }
      }
    } }
  }
  override fun onDestroy() {
    if (active === this) active = null
    audio?.stop("Interrupted")
    super.onDestroy()
  }
  override fun onBind(intent: Intent?): IBinder? = null
  companion object {
    const val INITIAL_NOTIFICATION = "initialNotification"
    @Volatile private var active: RingingService? = null
    fun refresh(@Suppress("UNUSED_PARAMETER") context: Context, sessionId: String) {
      active?.let { service -> service.main.post { service.refreshMembers(sessionId) } }
    }
  }
}

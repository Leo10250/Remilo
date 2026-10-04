package com.remilo.alarm.system

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.PowerManager
import com.remilo.alarm.engine.AlarmEngine

class AlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val pending = goAsync()
    val lock = context.getSystemService(PowerManager::class.java)
      .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Remilo:handoff")
    lock.acquire(9_000)
    val finish = { if (lock.isHeld) lock.release(); pending.finish() }
    try { AlarmEngine.get(context).receive(intent, finish) }
    catch (_: Exception) { finish() }
  }
}

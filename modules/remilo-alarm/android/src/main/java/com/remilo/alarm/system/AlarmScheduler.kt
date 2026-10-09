package com.remilo.alarm.system
import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.ComponentName
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import com.remilo.alarm.data.AlertRecord
import com.remilo.alarm.core.DeliverySnapshot

class AlarmScheduler(private val context: Context) : AlarmRegistrar {
  private val alarms = context.getSystemService(AlarmManager::class.java)
  override fun canSchedule(): Boolean = alarms.canScheduleExactAlarms()
  override fun register(alert: AlertRecord) {
    if (alert.mode == "Notification") {
      // Notification mode explicitly permits approximate delivery; it is never
      // a fallback for an Alarm whose exact access was denied.
      if (canSchedule()) alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, alert.targetMs, delivery(alert))
      else alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, alert.targetMs, delivery(alert))
      return
    }
    check(canSchedule()) { "Exact alarm access is missing" }
    // The UI is deliberately not Direct Boot aware. Default launcher lookup hides
    // it before unlock, but merely creating this show-alarm handle must still work.
    val launch = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
      .setPackage(context.packageName)
    val resolved = context.packageManager.resolveActivity(launch,
      PackageManager.MATCH_DIRECT_BOOT_AWARE or PackageManager.MATCH_DIRECT_BOOT_UNAWARE)
      ?: error("Product launcher is missing")
    launch.component = ComponentName(resolved.activityInfo.packageName, resolved.activityInfo.name)
    launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    val show = PendingIntent.getActivity(context, 0, launch,
      PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    alarms.setAlarmClock(AlarmManager.AlarmClockInfo(alert.targetMs, show), delivery(alert))
  }
  override fun cancel(alert: AlertRecord) { alarms.cancel(delivery(alert)) }
  private fun delivery(alert: AlertRecord): PendingIntent = PendingIntent.getBroadcast(
    context, 0, intent(context, "fire", alert.occurrenceId, alert.generation),
    PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
  companion object {
    fun capturedActionIntent(context: Context, purpose: String, alert: AlertRecord): Intent =
      intent(context, purpose, alert.occurrenceId, alert.generation).apply {
        // Settings change without advancing delivery generations. Keep old shown durations immutable.
        if (purpose == "quicksnooze") {
          data = data!!.buildUpon().appendPath(alert.snoozeMinutes.toString()).build()
          putExtra("snoozeMinutes", alert.snoozeMinutes)
        }
      }
    fun capturedAction(context: Context, purpose: String, alert: AlertRecord): PendingIntent =
      PendingIntent.getBroadcast(context, 0, capturedActionIntent(context, purpose, alert),
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    fun capturedGroupIntent(context: Context, purpose: String, sessionId: String, members: List<AlertRecord>): Intent {
      val captured = members.map { DeliverySnapshot.Member(it.occurrenceId, it.generation) }
      val minutes = if (purpose == "snoozeall") members.first().snoozeMinutes else null
      val key = DeliverySnapshot.key(captured, minutes)
      return Intent(context, AlarmReceiver::class.java).setAction("com.remilo.alarm.$purpose")
        .setData(Uri.Builder().scheme("remilo-alarm").authority(purpose).appendPath(sessionId).appendPath(key).build())
        .putExtra("sessionId", sessionId).putExtra("memberIds", members.map { it.occurrenceId }.toTypedArray())
        .putExtra("memberGenerations", members.map { it.generation }.toLongArray()).apply {
          if (minutes != null) putExtra("snoozeMinutes", minutes)
        }
    }
    fun capturedGroup(context: Context, purpose: String, sessionId: String, members: List<AlertRecord>): PendingIntent =
      PendingIntent.getBroadcast(context, 0, capturedGroupIntent(context, purpose, sessionId, members),
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    fun stopAllIntent(context: Context, sessionId: String): Intent = Intent(context, AlarmReceiver::class.java)
      .setAction("com.remilo.alarm.stopall").setData(Uri.Builder().scheme("remilo-alarm").authority("stopall").appendPath(sessionId).build())
      .putExtra("sessionId", sessionId)
    fun stopAll(context: Context, sessionId: String): PendingIntent = PendingIntent.getBroadcast(context, 0,
      stopAllIntent(context, sessionId), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    fun intent(context: Context, purpose: String, id: String, generation: Long): Intent =
      Intent(context, AlarmReceiver::class.java).apply {
        action = "com.remilo.alarm.$purpose"
        data = Uri.Builder().scheme("remilo-alarm").authority(purpose).appendPath(id)
          .appendPath(generation.toString()).build()
        putExtra("occurrenceId", id)
        putExtra("generation", generation)
      }
    fun action(context: Context, purpose: String, alert: AlertRecord): PendingIntent =
      PendingIntent.getBroadcast(context, 0, intent(context, purpose, alert.occurrenceId, alert.generation),
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
  }
}

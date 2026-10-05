package com.remilo.alarm.system
import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.ComponentName
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import com.remilo.alarm.data.AlertRecord

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

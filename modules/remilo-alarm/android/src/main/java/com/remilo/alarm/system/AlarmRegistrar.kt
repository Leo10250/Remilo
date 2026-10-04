package com.remilo.alarm.system
import com.remilo.alarm.data.AlertRecord

/** OS boundary used for deterministic registration-failure tests. */
interface AlarmRegistrar {
  fun canSchedule(): Boolean
  fun register(alert: AlertRecord)
  fun cancel(alert: AlertRecord)
}

package com.remilo.alarm.data

import org.json.JSONArray
import org.json.JSONObject
import java.time.ZoneId
class BackupLimitException : IllegalArgumentException()

/** Portable data only. No generations, sessions, handles, credentials or device IDs. */
object BackupCodec {
  data class Bundle(val records: List<ReminderRecord>, val nextAlerts: Map<String, Long?>,
    val history: List<HistoryRecord>)
  fun record(record: ReminderRecord): Map<String, Any?> = mapOf(
    "id" to record.id, "title" to record.title, "notes" to record.notes, "listName" to record.listName,
    "eventStartMs" to record.eventStartMs, "eventEndMs" to record.eventEndMs, "dueAtMs" to record.dueAtMs,
    "alarmAtMs" to (record.definedAlarmAtMs ?: record.eventStartMs), "createdAtMs" to record.createdAtMs,
    "completed" to record.completed, "mode" to record.mode, "allDay" to record.allDay,
    "zoneId" to record.zoneId.ifEmpty { ZoneId.systemDefault().id }, "dueLinked" to record.dueLinked,
    "alarmLinked" to record.alarmLinked, "sound" to record.sound, "vibration" to record.vibration)
  fun encode(records: List<ReminderRecord>, nextAlerts: Map<String, Long?>, history: List<HistoryRecord>, now: Long): String {
    if (records.size > 10_000 || history.size > 100_000) throw BackupLimitException()
    val json = JSONObject(mapOf("format" to "Remilo", "version" to 1, "exportedAtMs" to now,
      "reminders" to records.map { record(it) + ("nextAlertMs" to nextAlerts[it.id]) },
      "history" to history.map { mapOf("id" to it.operationId, "reminderId" to it.occurrenceId,
        "kind" to it.kind, "atMs" to it.occurredAtMs, "targetMs" to it.targetMs) })).toString(2)
    if (json.toByteArray(Charsets.UTF_8).size > 10_000_000) throw BackupLimitException()
    return json
  }
  private fun text(obj: JSONObject, key: String, max: Int, optional: Boolean = false): String {
    val value = if (optional && !obj.has(key)) "" else obj.get(key)
    require(value is String && value.length <= max) { "Invalid backup text field: $key" }
    return value
  }
  private fun time(obj: JSONObject, key: String): Long {
    val number = obj.get(key)
    require(number is Number) { "Invalid backup time field: $key" }
    val value = number.toDouble()
    require(value.isFinite() && value >= 0 && value <= 8_640_000_000_000_000L && value % 1 == 0.0) { "Invalid backup time field: $key" }
    return value.toLong()
  }
  private fun boolean(obj: JSONObject, key: String): Boolean {
    val value = obj.get(key)
    require(value is Boolean) { "Invalid backup option: $key" }
    return value
  }
  fun decode(json: String): Bundle {
    require(json.toByteArray(Charsets.UTF_8).size <= 10_000_000) { "Backup exceeds 10 MB." }
    val root = JSONObject(json)
    require(root.optString("format") == "Remilo" && root.opt("version") == 1) { "Unsupported backup format/version." }
    val items = root.getJSONArray("reminders")
    require(items.length() <= 10_000) { "Backup contains too many reminders." }
    val nextAlerts = mutableMapOf<String, Long?>()
    val records = (0 until items.length()).map { index ->
      val obj = items.getJSONObject(index)
      val id = text(obj, "id", 200)
      require(id.isNotBlank() && !nextAlerts.containsKey(id)) { "Duplicate or empty reminder identity." }
      val title = text(obj, "title", 200)
      require(title.isNotBlank()) { "Empty reminder title." }
      val mode = text(obj, "mode", 20)
      require(mode in setOf("Alarm", "Notification", "None")) { "Unsupported alert mode." }
      val sound = text(obj, "sound", 20)
      require(sound in setOf("remilo", "system")) { "Unsupported sound." }
      val zone = ZoneId.of(text(obj, "zoneId", 100)).id
      val start = time(obj, "eventStartMs")
      val end = time(obj, "eventEndMs")
      require(end > start) { "Event end must follow its start." }
      nextAlerts[id] = if (!obj.has("nextAlertMs") || obj.isNull("nextAlertMs")) null else time(obj, "nextAlertMs")
      ReminderRecord(id, title, start, end, time(obj, "dueAtMs"), time(obj, "createdAtMs"),
        boolean(obj, "completed"), 1, text(obj, "notes", 10_000, true), text(obj, "listName", 60, true),
        mode, time(obj, "alarmAtMs"), boolean(obj, "allDay"), zone,
        boolean(obj, "dueLinked"), boolean(obj, "alarmLinked"), false, sound, boolean(obj, "vibration"))
    }
    val ids = records.map { it.id }.toSet()
    val historyItems = root.optJSONArray("history") ?: JSONArray()
    require(historyItems.length() <= 100_000) { "Backup contains too much history." }
    val historyIds = mutableSetOf<String>()
    val history = (0 until historyItems.length()).map { index ->
      val obj = historyItems.getJSONObject(index)
      val id = text(obj, "id", 200)
      val reminderId = text(obj, "reminderId", 200)
      require(id.isNotBlank() && historyIds.add(id) && reminderId in ids) { "Invalid history identity." }
      val kind = text(obj, "kind", 50)
      require(kind.isNotBlank()) { "Invalid history action." }
      HistoryRecord(id, reminderId, kind, time(obj, "atMs"), 0,
        if (!obj.has("targetMs") || obj.isNull("targetMs")) null else time(obj, "targetMs"))
    }
    return Bundle(records, nextAlerts, history)
  }
}

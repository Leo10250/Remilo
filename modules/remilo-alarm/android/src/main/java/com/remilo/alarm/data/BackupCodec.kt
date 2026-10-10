package com.remilo.alarm.data

import org.json.JSONArray
import org.json.JSONObject
import java.time.ZoneId
class BackupLimitException : IllegalArgumentException()

/** Portable data only. No generations, sessions, handles, credentials or device IDs. */
object BackupCodec {
  data class Bundle(val records: List<ReminderRecord>, val nextAlerts: Map<String, Long?>,
    val history: List<HistoryRecord>, val series: List<SeriesRecord> = emptyList(), val lists: List<ListRecord> = emptyList(),
    val purged: List<PurgedOccurrence> = emptyList())
  fun record(record: ReminderRecord): Map<String, Any?> = mapOf(
    "id" to record.id, "title" to record.title, "notes" to record.notes, "listName" to record.listName, "listId" to record.listId,
    "eventStartMs" to record.eventStartMs, "eventEndMs" to record.eventEndMs, "dueAtMs" to record.dueAtMs,
    "alarmAtMs" to (record.definedAlarmAtMs ?: record.eventStartMs), "createdAtMs" to record.createdAtMs,
    "completed" to record.completed, "mode" to record.mode, "allDay" to record.allDay,
    "zoneId" to record.zoneId.ifEmpty { ZoneId.systemDefault().id }, "dueLinked" to record.dueLinked,
    "alarmLinked" to record.alarmLinked, "sound" to record.sound, "vibration" to record.vibration,
    "segmentId" to record.segmentId, "nominalSlot" to record.nominalSlot,
    "exception" to record.exception, "skipped" to record.skipped, "deleted" to record.deleted)
  fun encode(records: List<ReminderRecord>, nextAlerts: Map<String, Long?>, history: List<HistoryRecord>, now: Long,
    series: List<SeriesRecord> = emptyList(), lists: List<ListRecord> = emptyList(), purged: List<PurgedOccurrence> = emptyList()): String {
    if (records.size > 10_000 || history.size > 100_000 || series.size > 10_000 || lists.size > 10_000 || purged.size > 10_000) throw BackupLimitException()
    val json = JSONObject(mapOf("format" to "Remilo", "version" to 4, "exportedAtMs" to now,
      "purgedOccurrences" to purged.map { mapOf("id" to it.id, "segmentId" to it.segmentId, "nominalSlot" to it.nominalSlot) },
      "lists" to lists.map { mapOf("id" to it.id, "name" to it.name, "createdAtMs" to it.createdAtMs) },
      "series" to series.map { mapOf("id" to it.id, "seriesId" to it.seriesId, "template" to JSONObject(it.template),
        "rule" to JSONObject(it.rule), "state" to it.state, "createdAtMs" to it.createdAtMs) },
      "reminders" to records.map { record(it) + ("nextAlertMs" to nextAlerts[it.id]) },
      "history" to history.map { mapOf("id" to java.util.UUID.nameUUIDFromBytes(it.operationId.toByteArray()).toString(), "reminderId" to it.occurrenceId,
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
  /** Also reads owned series templates without routing them through a legacy backup version. */
  fun decodeRecord(obj: JSONObject, version: Int = 3): ReminderRecord {
    val id = text(obj, "id", 200)
    require(id.isNotBlank()) { "Empty reminder identity." }
    val title = text(obj, "title", 200)
    require(title.isNotBlank()) { "Empty reminder title." }
    val mode = text(obj, "mode", 20)
    require(mode in setOf("Alarm", "Notification", "None")) { "Unsupported alert mode." }
    val sound = text(obj, "sound", 20)
    require(sound in setOf("remilo", "system")) { "Unsupported sound." }
    val zone = ZoneId.of(text(obj, "zoneId", 100)).id
    val start = time(obj, "eventStartMs"); val end = time(obj, "eventEndMs")
    require(end > start) { "Event end must follow its start." }
    val listId = if (version < 3 || !obj.has("listId") || obj.isNull("listId")) null else text(obj, "listId", 200).also { require(it.isNotBlank()) }
    return ReminderRecord(id, title, start, end, time(obj, "dueAtMs"), time(obj, "createdAtMs"),
      boolean(obj, "completed"), 1, text(obj, "notes", 10_000, true), text(obj, "listName", 60, true),
      mode, time(obj, "alarmAtMs"), boolean(obj, "allDay"), zone,
      boolean(obj, "dueLinked"), boolean(obj, "alarmLinked"), version >= 2 && obj.has("deleted") && boolean(obj, "deleted"),
      sound, boolean(obj, "vibration"),
      if (version == 1 || !obj.has("segmentId") || obj.isNull("segmentId")) null else text(obj, "segmentId", 200),
      if (version == 1 || !obj.has("nominalSlot") || obj.isNull("nominalSlot")) null else text(obj, "nominalSlot", 100),
      version >= 2 && obj.has("exception") && boolean(obj, "exception"), version >= 2 && obj.has("skipped") && boolean(obj, "skipped"), listId)
  }
  fun decode(json: String): Bundle {
    require(json.toByteArray(Charsets.UTF_8).size <= 10_000_000) { "Backup exceeds 10 MB." }
    val root = JSONObject(json)
    require(root.optString("format") == "Remilo" && root.opt("version") in setOf(1, 2, 3, 4)) { "Unsupported backup format/version." }
    val version = root.getInt("version")
    val listItems = if (version >= 3) root.getJSONArray("lists") else JSONArray()
    require(listItems.length() <= 10_000) { "Backup contains too many lists." }
    val listIds = mutableSetOf<String>(); val listNames = mutableSetOf<String>()
    val lists = (0 until listItems.length()).map { index ->
      val obj = listItems.getJSONObject(index)
      val id = text(obj, "id", 200); val name = text(obj, "name", 60); val key = ListNames.key(name)
      require(id.isNotBlank() && name.isNotEmpty() && listIds.add(id) && listNames.add(name)) { "Invalid or duplicate list." }
      ListRecord(id, name, key, createdAtMs = time(obj, "createdAtMs"))
    }.toMutableList()
    fun membership(record: ReminderRecord): ReminderRecord {
      if (version >= 3) {
        val list = record.listId?.let { id -> lists.find { it.id == id } ?: throw IllegalArgumentException("Unknown backup list.") }
        return record.copy(listName = list?.name.orEmpty())
      }
      val name = record.listName
      if (name.isEmpty()) return record.copy(listId = null, listName = "")
      val key = ListNames.key(name)
      val list = lists.find { it.name == name } ?: ListRecord(ListNames.legacyId(name), name, key, createdAtMs = record.createdAtMs).also { lists.add(it) }
      return record.copy(listId = list.id, listName = list.name)
    }
    val segments = root.optJSONArray("series") ?: JSONArray()
    require(segments.length() <= 10_000)
    val segmentIds = mutableSetOf<String>()
    val series = (0 until segments.length()).map { index ->
      val obj = segments.getJSONObject(index)
      val id = text(obj, "id", 200); val seriesId = text(obj, "seriesId", 200)
      require(id.isNotBlank() && seriesId.isNotBlank() && segmentIds.add(id))
      val state = text(obj, "state", 20)
      require(state in setOf("Active", "Paused", "Archived"))
      val rule = RuleCodec.decode(obj.getJSONObject("rule").toString())
      // Decode templates through the same strict one-off field validation.
      val template = membership(decodeRecord(obj.getJSONObject("template"), version))
      require(template.segmentId == null)
      SeriesRecord(id, seriesId, JSONObject(record(template)).toString(), RuleCodec.encode(rule), state = state,
        createdAtMs = time(obj, "createdAtMs"))
    }
    val items = root.getJSONArray("reminders")
    require(items.length() <= 10_000) { "Backup contains too many reminders." }
    val nextAlerts = mutableMapOf<String, Long?>()
    val records = (0 until items.length()).map { index ->
      val obj = items.getJSONObject(index)
      val id = text(obj, "id", 200)
      require(id.isNotBlank() && !nextAlerts.containsKey(id)) { "Duplicate or empty reminder identity." }
      nextAlerts[id] = if (!obj.has("nextAlertMs") || obj.isNull("nextAlertMs")) null else time(obj, "nextAlertMs")
      membership(decodeRecord(obj, version))
    }
    records.filter { it.segmentId != null }.forEach { record ->
      require(record.segmentId in segmentIds && record.nominalSlot != null)
      val nominal = java.time.LocalDateTime.parse(record.nominalSlot)
      val segment = series.first { it.id == record.segmentId }
      val rule = RuleCodec.decode(segment.rule)
      require(nominal >= rule.anchor)
      require(record.id == java.util.UUID.nameUUIDFromBytes("remilo:${record.segmentId}:${record.nominalSlot}".toByteArray()).toString())
    }
    require(records.none { it.segmentId == null && it.nominalSlot != null })
    val ids = records.map { it.id }.toSet()
    val exclusions = if (version >= 4) root.getJSONArray("purgedOccurrences") else JSONArray()
    require(exclusions.length() <= 10_000) { "Backup contains too many exclusions." }
    val exclusionIds = mutableSetOf<String>()
    val purged = (0 until exclusions.length()).map { index ->
      val obj = exclusions.getJSONObject(index)
      val id = text(obj, "id", 200); val segmentId = text(obj, "segmentId", 200)
      val nominalSlot = text(obj, "nominalSlot", 100)
      require(id.isNotBlank() && exclusionIds.add(id) && id !in ids && segmentId in segmentIds) { "Invalid exclusion identity." }
      val nominal = java.time.LocalDateTime.parse(nominalSlot)
      require(nominal >= RuleCodec.decode(series.first { it.id == segmentId }.rule).anchor)
      require(id == java.util.UUID.nameUUIDFromBytes("remilo:$segmentId:$nominalSlot".toByteArray()).toString())
      PurgedOccurrence(id, segmentId, nominalSlot)
    }
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
    return Bundle(records, nextAlerts, history, series, lists, purged)
  }
}

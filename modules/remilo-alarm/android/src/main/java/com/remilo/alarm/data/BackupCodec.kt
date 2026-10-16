package com.remilo.alarm.data

import org.json.JSONArray
import org.json.JSONObject
import java.time.ZoneId
class BackupLimitException : IllegalArgumentException()

/** Portable content, including dated routine progress. No operational sessions, generations, handles or credentials. */
object BackupCodec {
  data class Bundle(val records: List<ReminderRecord>, val nextAlerts: Map<String, Long?>,
    val history: List<HistoryRecord>, val series: List<SeriesRecord> = emptyList(), val lists: List<ListRecord> = emptyList(),
    val purged: List<PurgedOccurrence> = emptyList(), val routines: List<RoutinePlan> = emptyList(),
    val routineVersions: List<RoutineVersion> = emptyList(), val routineSessions: List<RoutineSession> = emptyList())
  fun record(record: ReminderRecord): Map<String, Any?> = mapOf(
    "id" to record.id, "title" to record.title, "notes" to record.notes, "listName" to record.listName, "listId" to record.listId,
    "eventStartMs" to record.eventStartMs, "eventEndMs" to record.eventEndMs, "dueAtMs" to record.dueAtMs,
    "alarmAtMs" to (record.definedAlarmAtMs ?: record.eventStartMs), "createdAtMs" to record.createdAtMs,
    "completed" to record.completed, "mode" to record.mode, "allDay" to record.allDay,
    "zoneId" to record.zoneId.ifEmpty { ZoneId.systemDefault().id }, "dueLinked" to record.dueLinked,
    "alarmLinked" to record.alarmLinked, "sound" to record.sound, "vibration" to record.vibration,
    "segmentId" to record.segmentId, "nominalSlot" to record.nominalSlot,
    "exception" to record.exception, "skipped" to record.skipped, "deleted" to record.deleted, "routineId" to record.routineId)
  fun encode(records: List<ReminderRecord>, nextAlerts: Map<String, Long?>, history: List<HistoryRecord>, now: Long,
    series: List<SeriesRecord> = emptyList(), lists: List<ListRecord> = emptyList(), purged: List<PurgedOccurrence> = emptyList(),
    routines: List<RoutinePlan> = emptyList(), routineVersions: List<RoutineVersion> = emptyList(), routineSessions: List<RoutineSession> = emptyList()): String {
    if (records.size > 10_000 || history.size > 100_000 || series.size > 10_000 || lists.size > 10_000 || purged.size > 10_000 ||
      routines.size > 10_000 || routineVersions.size > 10_000 || routineSessions.size > 10_000) throw BackupLimitException()
    val json = JSONObject(mapOf("format" to "Remilo", "version" to 5, "exportedAtMs" to now,
      "routines" to routines.map { mapOf("id" to it.id, "startsOn" to it.startsOn, "state" to it.state, "pauses" to JSONArray(it.pauses)) },
      "routineVersions" to routineVersions.map { mapOf("routineId" to it.routineId, "effectiveDate" to it.effectiveDate, "title" to it.title,
        "minutes" to it.minutes, "mode" to it.mode, "listId" to it.listId, "days" to JSONArray(it.days)) },
      "routineSessions" to routineSessions.map { mapOf("occurrenceId" to it.occurrenceId, "routineId" to it.routineId, "date" to it.date,
        "versionDate" to it.versionDate, "steps" to JSONArray(it.steps), "done" to JSONArray(it.done), "ended" to it.ended,
        "changes" to JSONArray(it.changes)) },
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
  fun decodeRecord(obj: JSONObject, version: Int = 5): ReminderRecord {
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
      version >= 2 && obj.has("exception") && boolean(obj, "exception"), version >= 2 && obj.has("skipped") && boolean(obj, "skipped"), listId,
      if (version < 5 || !obj.has("routineId") || obj.isNull("routineId")) null else text(obj, "routineId", 200).also { require(it.isNotBlank()) })
  }
  fun decode(json: String): Bundle {
    require(json.toByteArray(Charsets.UTF_8).size <= 10_000_000) { "Backup exceeds 10 MB." }
    val root = JSONObject(json)
    require(root.optString("format") == "Remilo" && root.opt("version") in setOf(1, 2, 3, 4, 5)) { "Unsupported backup format/version." }
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
    val plans = if (version >= 5) root.getJSONArray("routines") else JSONArray()
    val versions = if (version >= 5) root.getJSONArray("routineVersions") else JSONArray()
    val sessions = if (version >= 5) root.getJSONArray("routineSessions") else JSONArray()
    require(plans.length() <= 10_000 && versions.length() <= 10_000 && sessions.length() <= 10_000)
    fun date(o: JSONObject, key: String) = text(o, key, 10).also { require(java.time.LocalDate.parse(it).toString() == it) }
    val routineIds = mutableSetOf<String>()
    val routines = (0 until plans.length()).map { i -> val o = plans.getJSONObject(i)
      val id = text(o, "id", 200); require(id.isNotBlank() && routineIds.add(id) && series.any { it.seriesId == id })
      val state = text(o, "state", 20); require(state in setOf("Active", "Paused"))
      val pauses = o.getJSONArray("pauses"); require(pauses.length() <= 10_000)
      // Wall-clock corrections can make actual action times run backwards.
      for (p in 0 until pauses.length()) { val pause = pauses.getJSONObject(p); time(pause, "from")
        if (!pause.isNull("until")) time(pause, "until") }
      RoutinePlan(id, startsOn = date(o, "startsOn"), state = state, pauses = pauses.toString())
    }
    fun steps(a: JSONArray): Set<String> {
      require(a.length() <= 100); val found = mutableSetOf<String>()
      for (i in 0 until a.length()) { val s = a.getJSONObject(i); val id = text(s, "id", 200)
        require(id.isNotBlank() && found.add(id) && text(s, "name", 200).isNotBlank())
        text(s, "target", 1000); text(s, "notes", 10_000)
        require(text(s, "illustration", 80, true).matches(Regex("[a-z0-9-]*"))) }
      return found
    }
    val versionIds = mutableSetOf<Pair<String,String>>()
    val routineVersions = (0 until versions.length()).map { i -> val o = versions.getJSONObject(i)
      val id = text(o, "routineId", 200); val effective = date(o, "effectiveDate")
      require(id in routineIds && versionIds.add(id to effective) && effective >= routines.first { it.id == id }.startsOn)
      val title = text(o, "title", 200); require(title.isNotBlank())
      val minutes = time(o, "minutes"); require(minutes in 0..1439)
      val mode = text(o, "mode", 20); require(mode in setOf("Notification", "None"))
      val list = if (o.isNull("listId")) null else text(o, "listId", 200).also { require(it in listIds) }
      val days = o.getJSONArray("days"); require(days.length() == 7); val exerciseIds = mutableSetOf<String>(); var active = false
      for (d in 0..6) { val day = days.getJSONObject(d); val type = text(day, "type", 20); require(type in setOf("Rest", "Exercises"))
        val ids = steps(day.getJSONArray("exercises")); require(if (type == "Rest") ids.isEmpty() else ids.isNotEmpty())
        require(ids.all { exerciseIds.add(it) }); if (type == "Exercises") active = true }
      require(active)
      RoutineVersion(id, effective, title, minutes.toInt(), mode, list, days.toString())
    }
    routines.forEach { p -> require(versionIds.contains(p.id to p.startsOn)) }
    series.forEach { s -> val template = decodeRecord(JSONObject(s.template))
      require(template.routineId == null || template.routineId == s.seriesId && s.seriesId in routineIds && template.mode != "Alarm")
      require(s.seriesId !in routineIds || template.routineId == s.seriesId) }
    records.forEach { r -> require(r.routineId == null || r.segmentId != null && r.routineId in routineIds &&
      decodeRecord(JSONObject(series.first { it.id == r.segmentId }.template)).routineId == r.routineId && r.mode != "Alarm") }
    records.filter { it.segmentId != null }.forEach { r -> require(decodeRecord(JSONObject(series.first { it.id == r.segmentId }.template)).routineId == r.routineId) }
    val sessionIds = mutableSetOf<String>(); val datedIds = mutableSetOf<Pair<String,String>>()
    val routineSessions = (0 until sessions.length()).map { i -> val o = sessions.getJSONObject(i)
      val occurrence = text(o, "occurrenceId", 200); val id = text(o, "routineId", 200); val day = date(o, "date"); val v = date(o, "versionDate")
      val r = records.firstOrNull { it.id == occurrence } ?: error("Unknown routine session.")
      require(r.routineId == id && sessionIds.add(occurrence) && datedIds.add(id to day) && r.nominalSlot!!.substringBefore('T') == day)
      require(versionIds.contains(id to v) && routineVersions.filter { it.routineId == id && it.effectiveDate <= day }.maxOf { it.effectiveDate } == v)
      val snapshot = o.getJSONArray("steps"); val stepIds = steps(snapshot); require(stepIds.isNotEmpty())
      val expectedSteps = JSONArray(routineVersions.first { it.routineId == id && it.effectiveDate == v }.days)
        .getJSONObject(java.time.LocalDate.parse(day).dayOfWeek.value - 1).getJSONArray("exercises")
      require(snapshot.toString() == expectedSteps.toString())
      val done = o.getJSONArray("done"); val checks = (0 until done.length()).map { done.getString(it) }
      require(checks.distinct().size == checks.size && checks.all { it in stepIds } && r.completed == (checks.size == stepIds.size && !r.skipped))
      val changes = o.getJSONArray("changes"); require(changes.length() <= 100_000); val changeIds = mutableSetOf<String>()
      for (c in 0 until changes.length()) { val change = changes.getJSONObject(c)
        require(changeIds.add(text(change,"id",200)) && text(change,"kind",50) in setOf("SetRoutineExercise","CorrectRoutineExercise","SkipRoutineDay","UndoSkipRoutineDay"))
        time(change,"atMs"); if (!change.isNull("stepId")) { require(text(change,"stepId",200) in stepIds); boolean(change,"completed") } }
      RoutineSession(occurrence,id,day,v,snapshot.toString(),done.toString(),boolean(o,"ended"),changes = changes.toString())
    }
    return Bundle(records, nextAlerts, history, series, lists, purged, routines, routineVersions, routineSessions)
  }
}

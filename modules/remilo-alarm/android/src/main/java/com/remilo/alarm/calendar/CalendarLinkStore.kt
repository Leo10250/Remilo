package com.remilo.alarm.calendar

import com.remilo.alarm.data.*
import org.json.JSONObject
import org.json.JSONArray
import java.time.*
import java.util.UUID

/** CE only, always called on the existing engine worker. No network or React ownership. */
class CalendarLinkStore(private val db: ContentDatabase, private val now: () -> Long) {
  private val dao = db.links()
  private val previews = linkedMapOf<String, Pair<Long, CalendarLinkPreview>>()
  init { dao.operations().filter { it.state == "Sending" }.forEach {
    dao.update(it.copy(state = "Unconfirmed", message = "Interrupted. Retry the same operation to check its saved outcome."))
  } }
  fun connection() = db.calendar().connection() ?: CalendarConnection()
  fun link(id: String) = dao.link(id)
  fun record(id: String) = db.records().find(id)
  fun operation(id: String) = dao.operation(id)
  private fun sourceView(subject: String, calendarId: String, eventId: String, current: CalendarConnection): Map<String, String>? =
    current.takeIf { it.connected && it.subject == subject }?.let { mapOf("calendarId" to calendarId, "eventId" to eventId) }
  fun source(key: String): CalendarLink? = dao.remote(key) ?: db.calendar().operations().firstOrNull {
    (it.attempted || it.state == "Published") && CalendarLinkMapper.key(it.subject, it.calendarId, it.eventId) == key
  }?.let { CalendarLink(it.occurrenceId, key, it.subject, it.calendarId, it.eventId, it.calendarName, "Published",
    erased = it.readOnly && it.zoneId.isBlank()) }
  fun links() = connection().let { current -> dao.links().map { link ->
    val record = record(link.occurrenceId)
    mapOf("occurrenceId" to link.occurrenceId, "revision" to link.revision, "calendarName" to link.calendarName,
      "state" to link.state, "checkedAtMs" to link.checkedAtMs, "message" to link.message,
      "htmlLink" to link.htmlLink, "source" to sourceView(link.subject, link.calendarId, link.eventId, current),
      "readOnly" to (link.erased || record == null || record.deleted || record.completed || record.skipped),
      "differs" to (record != null && link.baseline.isNotBlank() && !CalendarLinkMapper.equal(CalendarLinkMapper.fields(record), JSONObject(link.baseline))))
  } }
  fun operations() = connection().let { current -> dao.operations().map { view(it, current) } }
  fun view(job: CalendarLinkOperation): Map<String, Any?> = view(job, connection())
  private fun view(job: CalendarLinkOperation, current: CalendarConnection): Map<String, Any?> = mapOf("operationId" to job.operationId,
    "occurrenceId" to job.occurrenceId, "kind" to job.kind, "calendarName" to job.calendarName,
    "title" to if (job.erased) "" else (record(job.occurrenceId)?.title ?: job.draft.takeIf(String::isNotBlank)?.let { JSONObject(it).optString("title") }.orEmpty()),
    "state" to job.state, "message" to job.message, "localApplied" to job.localApplied,
    "localStatus" to job.localStatus, "remoteAttempted" to job.remoteAttempted,
    "readOnly" to job.erased, "source" to sourceView(job.subject, job.calendarId, job.eventId, current),
    "localResult" to if (job.localApplied) mapOf("status" to job.localStatus) else null)
  fun active(record: ReminderRecord?) {
    if (record == null) throw CalendarFailure("NOT_FOUND")
    if (record.completed || record.deleted || record.skipped || record.segmentId != null) throw CalendarFailure("INELIGIBLE")
  }
  fun preview(calendar: OwnedCalendar, event: JSONObject, id: String?, choices: Map<String, Any?>,
    generation: Long, preservedAlertMs: Long? = null): Map<String, Any?> {
    val connection = connection()
    if (!connection.connected) throw CalendarFailure("NEEDS_ACCESS")
    val remote = CalendarLinkMapper.fields(event, calendar.zoneId)
    val eventId = event.getString("id")
    if (eventId.isBlank() || event.optString("etag").isBlank()) throw CalendarFailure("INVALID_EVENT")
    val old = id?.let(::link)
    val record = id?.let(::record)
    if (id != null) active(record)
    val key = CalendarLinkMapper.key(connection.subject, calendar.id, eventId)
    if (id == null && source(key) != null) throw CalendarFailure("ALREADY_IMPORTED")
    if (old?.erased == true) throw CalendarFailure("INELIGIBLE")
    if (old != null && old.remoteKey != key) throw CalendarFailure("ACCOUNT_MISMATCH")
    val settings = db.records().settings() ?: SettingsRecord()
    val options = JSONObject()
    if (id == null) {
      val mode = choices["mode"] as? String ?: "Alarm"
      if (mode !in setOf("Alarm", "Notification", "None")) throw CalendarFailure("INVALID_INPUT")
      if (choices.containsKey("disableReminders") && choices["disableReminders"] !is Boolean) throw CalendarFailure("INVALID_INPUT")
      val schedule = remote.getJSONObject("schedule")
      val alarm = if (schedule.getBoolean("allDay")) Instant.ofEpochMilli(schedule.getLong("eventStartMs"))
        .atZone(ZoneId.of(schedule.getString("zoneId"))).toLocalDate().atTime(9, 0)
        .atZone(ZoneId.of(schedule.getString("zoneId"))).toInstant().toEpochMilli() else schedule.getLong("eventStartMs")
      options.put("mode", mode).put("alarmAtMs", choices["alarmAtMs"]?.let { CalendarStore.number(choices, "alarmAtMs") } ?: alarm)
        .put("dueAtMs", if (schedule.getBoolean("allDay")) schedule.getLong("eventEndMs") else schedule.getLong("eventStartMs"))
        .put("dueLinked", true).put("alarmLinked", choices["alarmAtMs"] == null)
        .put("sound", settings.sound).put("vibration", settings.vibration)
        .put("listId", choices["listId"] ?: JSONObject.NULL)
        .put("disableReminders", choices["disableReminders"] as? Boolean ?: false)
      val title = (choices["title"] as? String ?: remote.getString("title")).trim()
      if (title.length > 200) throw CalendarFailure("CONTENT_LIMIT")
      options.put("title", title)
    }
    val preview = CalendarLinkPreview(UUID.randomUUID().toString(), connection.revision, connection.subject,
      calendar, eventId, event.getString("etag"), remote.toString(), id ?: "", record?.let { CalendarLinkMapper.fields(it).toString() } ?: "",
      old?.baseline.orEmpty(), record?.revision ?: 0, generation, old?.revision ?: 0,
      old?.origin ?: if (id == null) "Imported" else "Published", options.toString(),
      event.optString("htmlLink").takeIf { it.startsWith("https://calendar.google.com/") || it.startsWith("https://www.google.com/calendar/") }.orEmpty(),
      CalendarLinkMapper.reminders(event, calendar.hasDefaultReminders), preservedAlertMs)
    previews[preview.id] = now() to preview
    while (previews.size > 1024) previews.remove(previews.keys.first())
    if (old != null) dao.put(old.copy(checkedAtMs = now(), state = if (old.state == "Detached") "Detached" else "Linked", message = "Checked just now. Changes require review."))
    return previewView(preview)
  }
  private fun previewView(p: CalendarLinkPreview): Map<String, Any?> {
    val remote = JSONObject(p.remote); val local = p.local.takeIf { it.isNotBlank() }?.let(::JSONObject)
    val record = p.occurrenceId.takeIf(String::isNotBlank)?.let(::record)
    fun timing(fields: JSONObject): Map<String, Any?>? {
      if (record == null || local == null) return null
      val schedule = fields.getJSONObject("schedule")
      if (CalendarLinkMapper.equal(schedule, local.getJSONObject("schedule"))) return mapOf("mode" to record.mode,
        "dueAtMs" to record.dueAtMs, "alarmAtMs" to (record.definedAlarmAtMs ?: record.eventStartMs))
      val start = schedule.getLong("eventStartMs")
      val due = if (!record.dueLinked) record.dueAtMs else if (schedule.getBoolean("allDay")) schedule.getLong("eventEndMs")
        else record.dueAtMs + start - record.eventStartMs
      val alarm = if (!record.alarmLinked) record.definedAlarmAtMs ?: record.eventStartMs else if (schedule.getBoolean("allDay"))
        Instant.ofEpochMilli(start).atZone(ZoneId.of(schedule.getString("zoneId"))).toLocalDate().atTime(9, 0)
          .atZone(ZoneId.of(schedule.getString("zoneId"))).toInstant().toEpochMilli()
        else (record.definedAlarmAtMs ?: record.eventStartMs) + due - record.dueAtMs
      return mapOf("mode" to record.mode, "dueAtMs" to due, "alarmAtMs" to alarm)
    }
    return mapOf("previewId" to p.id, "occurrenceId" to p.occurrenceId, "calendarName" to p.calendar.name,
      "email" to connection().email, "remote" to CalendarLinkMapper.map(remote),
      "local" to local?.let(CalendarLinkMapper::map),
      "baseline" to p.baseline.takeIf { it.isNotBlank() }?.let { CalendarLinkMapper.map(JSONObject(it)) },
      "selections" to local?.let { CalendarLinkMapper.defaults(it, remote, p.baseline.takeIf(String::isNotBlank)?.let(::JSONObject)) },
      "choices" to CalendarLinkMapper.map(JSONObject(p.choices)), "googleReminders" to p.googleReminders,
      "checkedAtMs" to now(), "nextAlertMs" to p.preservedAlertMs,
      "timings" to if (local == null) null else mapOf("remilo" to timing(local), "google" to timing(remote)))
  }
  fun capture(command: Map<String, Any?>): Map<String, Any?> {
    val op = CalendarStore.string(command, "operationId")
    val kind = CalendarStore.string(command, "kind")
    val previewId = CalendarStore.string(command, "previewId")
    @Suppress("UNCHECKED_CAST") val selection = command["selections"] as? Map<String, String> ?: emptyMap()
    val requestKey = JSONArray(listOf(kind, previewId, selection["title"], selection["notes"], selection["schedule"])).toString()
    dao.operation(op)?.let { if (it.requestKey != requestKey) throw CalendarFailure("OPERATION_REUSED"); return view(it) }
    if (db.records().receipt(op) != null || db.calendar().operation(op) != null) throw CalendarFailure("OPERATION_REUSED")
    val cached = previews[previewId] ?: throw CalendarFailure("STALE_PREVIEW")
    if (now() - cached.first > 600_000) throw CalendarFailure("STALE_PREVIEW")
    val p = cached.second
    if (connection().revision != p.connectionRevision || !connection().connected || connection().subject != p.subject) throw CalendarFailure("STALE_CONNECTION")
    val imported = kind == "ImportCalendarEvent"
    if (kind !in setOf("ImportCalendarEvent", "EnableCalendarLink", "ApplyCalendarResolution") || imported != p.occurrenceId.isEmpty()) throw CalendarFailure("INVALID_INPUT")
    if (!imported) {
      val record = record(p.occurrenceId); active(record)
      if (kind == "ApplyCalendarResolution" && (link(p.occurrenceId) == null || link(p.occurrenceId)?.state == "Detached")) throw CalendarFailure("INELIGIBLE")
      if (record!!.revision != p.revision || (link(p.occurrenceId)?.revision ?: 0) != p.linkRevision) throw CalendarFailure("STALE_PREVIEW")
    }
    val key = CalendarLinkMapper.key(p.subject, p.calendar.id, p.eventId)
    if (imported && source(key) != null) throw CalendarFailure("ALREADY_IMPORTED")
    if (dao.unresolved(key, terminal.toList())) throw CalendarFailure("OPERATION_PENDING")
    val remote = JSONObject(p.remote)
    val desired = JSONObject(p.remote)
    if (!imported) {
      val local = JSONObject(p.local)
      for (field in listOf("title", "notes", "schedule")) {
        val side = selection[field] ?: throw CalendarFailure("RESOLUTION_REQUIRED")
        if (side !in setOf("remilo", "google")) throw CalendarFailure("INVALID_INPUT")
        desired.put(field, if (side == "remilo") local.get(field) else remote.get(field))
      }
    }
    val options = JSONObject(p.choices)
    if (imported) desired.put("title", options.getString("title"))
    if (desired.getString("title").isBlank()) throw CalendarFailure("TITLE_REQUIRED")
    val draft = CalendarLinkMapper.draft(desired)
    if (imported) for (field in listOf("mode", "alarmAtMs", "dueAtMs", "dueLinked", "alarmLinked", "sound", "vibration", "listId")) draft.put(field, options.get(field))
    val suppress = imported && options.optBoolean("disableReminders")
    val patch = if (imported) CalendarLinkMapper.patch(remote, remote, suppress) else CalendarLinkMapper.patch(remote, desired, false)
    val job = CalendarLinkOperation(op, p.occurrenceId.ifEmpty { UUID.randomUUID().toString() }, key, kind, requestKey,
      p.subject, p.calendar.id, p.eventId, p.calendar.name, p.origin, p.revision, p.generation, p.linkRevision,
      p.connectionRevision, p.etag, p.remote, desired.toString(), draft.toString(), patch.toString(), suppress, htmlLink = p.htmlLink)
    dao.insert(job)
    return view(job)
  }
  /** Capture all child jobs and one immutable receipt before any I/O is dispatched. */
  fun captureBatch(command: Map<String, Any?>): Map<String, Any?> {
    val id = CalendarStore.string(command, "operationId")
    val items = command["items"] as? List<*> ?: throw CalendarFailure("INVALID_INPUT")
    if (items.isEmpty() || items.size > 500) throw CalendarFailure("IMPORT_LIMIT")
    val approved = items.map { item ->
      @Suppress("UNCHECKED_CAST") val value = item as? Map<String, Any?> ?: throw CalendarFailure("INVALID_INPUT")
      @Suppress("UNCHECKED_CAST") val choices = value["choices"] as? Map<String, Any?> ?: throw CalendarFailure("INVALID_INPUT")
      if (choices.keys.any { it !in setOf("mode", "title", "alarmAtMs", "listId", "disableReminders") }) throw CalendarFailure("INVALID_INPUT")
      CalendarStore.string(value, "previewId") to choices
    }
    val key = CalendarMapper.hash(JSONArray(approved.map { (previewId, choices) ->
      JSONArray(listOf(previewId, JSONArray(listOf("mode", "title", "alarmAtMs", "listId", "disableReminders").map {
        JSONArray(listOf(it, choices.containsKey(it), choices[it] ?: JSONObject.NULL))
      })))
    }).toString())
    db.records().receipt(id)?.let { receipt ->
      if (receipt.kind != "CalendarImportBatch") throw CalendarFailure("OPERATION_REUSED")
      val saved = JSONArray(receipt.sourceId ?: throw CalendarFailure("NOT_FOUND"))
      if (saved.getString(0) != key) throw CalendarFailure("OPERATION_REUSED")
      val children = saved.getJSONArray(1)
      return mapOf("operationId" to id, "retry" to true, "operations" to (0 until children.length()).map {
        operation(children.getString(it))?.let(::view) ?: throw CalendarFailure("NOT_FOUND")
      })
    }
    if (operation(id) != null || db.calendar().operation(id) != null) throw CalendarFailure("OPERATION_REUSED")
    val captured = mutableListOf<String>()
    val sources = mutableSetOf<String>()
    var sourceCalendar: String? = null
    db.runInTransaction {
      for ((previewId, choices) in approved) {
        val cached = previews[previewId] ?: throw CalendarFailure("STALE_PREVIEW")
        if (now() - cached.first > 600_000) throw CalendarFailure("STALE_PREVIEW")
        val p = cached.second
        if (p.occurrenceId.isNotEmpty()) throw CalendarFailure("INVALID_INPUT")
        if (sourceCalendar != null && sourceCalendar != p.calendar.id) throw CalendarFailure("INVALID_INPUT")
        sourceCalendar = p.calendar.id
        if (!sources.add(CalendarLinkMapper.key(p.subject, p.calendar.id, p.eventId))) throw CalendarFailure("ALREADY_IMPORTED")
        val options = JSONObject(p.choices)
        for ((field, value) in choices) when (field) {
          "mode" -> {
            if (value !is String || value !in setOf("Alarm", "Notification", "None")) throw CalendarFailure("INVALID_INPUT")
            options.put(field, value)
          }
          "title" -> {
            if (value !is String) throw CalendarFailure("INVALID_INPUT")
            if (value.trim().length > 200) throw CalendarFailure("CONTENT_LIMIT")
            options.put(field, value.trim())
          }
          "alarmAtMs" -> {
            val time = CalendarStore.number(choices, field)
            if (time < 0) throw CalendarFailure("INVALID_INPUT")
            options.put(field, time).put("alarmLinked", false)
          }
          "listId" -> {
            if (value != null && (value !is String || db.records().list(value) == null)) throw CalendarFailure("INVALID_INPUT")
            options.put(field, value ?: JSONObject.NULL)
          }
          "disableReminders" -> {
            if (value !is Boolean) throw CalendarFailure("INVALID_INPUT")
            options.put(field, value)
          }
        }
        if (options.getString("title").isBlank()) throw CalendarFailure("TITLE_REQUIRED")
        if (options.getString("mode") != "None" && options.getLong("alarmAtMs") <= now()) throw CalendarFailure("ELAPSED_ALERT")
        val derived = p.copy(id = UUID.randomUUID().toString(), choices = options.toString())
        previews[derived.id] = now() to derived
        val child = UUID.randomUUID().toString()
        try { capture(mapOf("kind" to "ImportCalendarEvent", "operationId" to child, "previewId" to derived.id)) }
        finally { previews.remove(derived.id) }
        captured.add(child)
      }
      db.records().receipt(CreationReceipt(id, "", "CalendarImportBatch", JSONArray(listOf(key, JSONArray(captured))).toString()))
    }
    return mapOf("operationId" to id, "operations" to captured.map { view(operation(it)!!) })
  }
  fun check(job: CalendarLinkOperation, executionRevision: Long? = null) {
    val connection = connection()
    if (!connection.connected || connection.subject != job.subject) throw CalendarFailure("NEEDS_ACCESS")
    if (executionRevision != null && connection.revision != executionRevision) throw CalendarFailure("STALE_CONNECTION")
    if (job.erased) throw CalendarFailure("INELIGIBLE")
    if (job.state in terminal) throw CalendarFailure("INELIGIBLE")
    if (job.patch.isBlank()) throw CalendarFailure("INELIGIBLE")
    if (!job.localApplied && job.kind == "ImportCalendarEvent" && source(job.remoteKey) != null) throw CalendarFailure("ALREADY_IMPORTED")
    val link = link(job.occurrenceId)
    if (link?.state == "Detached" && (job.kind != "EnableCalendarLink" || job.localApplied) || link?.erased == true) throw CalendarFailure("INELIGIBLE")
    if (!job.localApplied && (link?.revision ?: 0) != job.expectedLinkRevision) throw CalendarFailure("STALE_PREVIEW")
    if (!job.localApplied && job.kind != "ImportCalendarEvent") {
      active(record(job.occurrenceId))
      if (record(job.occurrenceId)!!.revision != job.expectedRevision) throw CalendarFailure("STALE_PREVIEW")
    }
    if (job.localApplied) active(record(job.occurrenceId))
  }
  /** Participates in the engine's reminder/receipt/pending-schedule transaction. */
  fun localCommitted(id: String) {
    val job = operation(id) ?: throw CalendarFailure("NOT_FOUND")
    val old = link(job.occurrenceId)
    dao.put(CalendarLink(job.occurrenceId, job.remoteKey, job.subject, job.calendarId, job.eventId,
      job.calendarName, job.origin, (old?.revision ?: 0) + 1,
      old?.baseline ?: job.remote, job.etag, "Linked", now(), "Local changes saved; checking Google outcome.", job.htmlLink))
    dao.update(job.copy(localApplied = true, localStatus = "Pending", state = "Waiting", message = "Local change committed; scheduling outcome pending."))
  }
  fun localStatus(id: String, status: String) { operation(id)?.let { dao.update(it.copy(localStatus = status)) } }
  fun permit(id: String, executionRevision: Long? = null): CalendarLinkOperation {
    val job = operation(id) ?: throw CalendarFailure("NOT_FOUND")
    check(job, executionRevision)
    if (!job.localApplied) throw CalendarFailure("NOT_AVAILABLE")
    if (job.disableReminders && job.localStatus in setOf("Blocked", "Pending")) throw CalendarFailure("ALERT_BLOCKED")
    return job.copy(state = "Sending", remoteAttempted = true).also(dao::update)
  }
  fun complete(id: String, event: JSONObject) {
    val job = operation(id) ?: return
    if (job.state in setOf("Confirmed", "Cancelled") || job.erased) return
    val old = link(job.occurrenceId) ?: return
    if (old.erased) return
    if (event.optString("id") != job.eventId) { fail(id, "FOREIGN_IDENTITY"); return }
    val fields = CalendarLinkMapper.fields(event, JSONObject(job.desired).getJSONObject("schedule").getString("zoneId"))
    db.runInTransaction {
      dao.update(job.copy(state = "Confirmed", message = "Local changes confirmed. Google outcome confirmed.", remote = "", desired = "", draft = "", patch = ""))
      if (old.state != "Detached") dao.put(old.copy(revision = old.revision + 1, baseline = fields.toString(), etag = event.optString("etag"),
        checkedAtMs = now(), message = "Confirmed. Check for changes when needed.", htmlLink = event.optString("htmlLink")
          .takeIf { it.startsWith("https://calendar.google.com/") || it.startsWith("https://www.google.com/calendar/") }.orEmpty()))
    }
  }
  fun fail(id: String, code: String) {
    val job = operation(id) ?: return
    if (job.state in setOf("Confirmed", "Cancelled") || job.erased) return
    val state = when (code) {
      "AUTH", "NEEDS_ACCESS", "ACCOUNT_MISMATCH", "STALE_CONNECTION" -> "NeedsAccess"
      "NETWORK", "RETRY", "NOT_AVAILABLE", "STORAGE_ERROR" -> "Unconfirmed"
      "ALERT_BLOCKED" -> "Blocked"
      "STALE_REMOTE", "STALE_PREVIEW", "INELIGIBLE", "REMOTE_REMOVED", "NOT_FOUND" -> "Conflict"
      else -> "Failed"
    }
    dao.update(job.copy(state = state, message = (if (job.localApplied) "Local changes saved. " else "Local change not applied. ") + when (state) {
      "NeedsAccess" -> "Authorize the original Google account and retry this operation."
      "Blocked" -> "Google reminders remain. Resolve Remilo alert readiness, then retry explicitly."
      "Conflict" -> "The reminder or Google event changed. Review again; no replacement event is created."
      "Unconfirmed" -> if (job.localApplied && job.kind == "ImportCalendarEvent" && job.disableReminders)
        "Imported; Google reminder change unconfirmed. Retry the same operation."
        else "Google outcome unconfirmed. Retry the same operation."
      else -> "Request rejected ($code). Correct the issue and review again."
    }))
  }
  fun observedFailure(id: String, code: String) { link(id)?.let {
    dao.put(it.copy(checkedAtMs = now(), state = if (it.state == "Detached") "Detached" else if (code in setOf("AUTH", "NEEDS_ACCESS", "ACCOUNT_MISMATCH")) "NeedsAccess" else "Suspended",
      message = "Check could not confirm a supported event ($code). Your local reminder is retained."))
  } }
  fun unlink(command: Map<String, Any?>): Map<String, Any?> {
    val id = CalendarStore.string(command, "occurrenceId"); val op = CalendarStore.string(command, "operationId")
    val expected = CalendarStore.number(command, "expectedLinkRevision")
    val key = JSONArray(listOf(id, expected)).toString()
    db.records().receipt(op)?.let {
      if (it.kind != "CalendarUnlink" || it.sourceId != key) throw CalendarFailure("OPERATION_REUSED")
      return mapOf("unlinked" to true)
    }
    if (operation(op) != null || db.calendar().operation(op) != null) throw CalendarFailure("OPERATION_REUSED")
    val old = link(id) ?: throw CalendarFailure("NOT_FOUND")
    if (old.revision != expected) throw CalendarFailure("STALE_PREVIEW")
    db.runInTransaction {
      dao.put(old.copy(revision = old.revision + 1, state = "Detached", message = "Unlinked. Local reminder and Google event retained."))
      dao.operations().filter { it.occurrenceId == id && it.state !in terminal }.forEach {
        dao.update(it.copy(state = if (it.remoteAttempted) it.state else "Cancelled", patch = "", draft = "",
          message = if (it.remoteAttempted) "Unlinked. Retry only checks the previously sent outcome; no further writes." else "Unsent changes cancelled by unlink."))
      }
      db.records().receipt(CreationReceipt(op, id, "CalendarUnlink", key))
    }
    return mapOf("unlinked" to true)
  }
  fun removed(id: String, purge: Boolean) {
    link(id)?.let { dao.put(it.copy(revision = it.revision + 1, state = if (it.state == "Detached") "Detached" else "Suspended",
      baseline = if (purge) "" else it.baseline, calendarName = if (purge) "" else it.calendarName,
      htmlLink = if (purge) "" else it.htmlLink, etag = if (purge) "" else it.etag,
      erased = purge || it.erased, message = "Local reminder removed. Google event retained.")) }
    dao.operations().filter { it.occurrenceId == id }.forEach {
      dao.update(it.copy(erased = purge || it.erased, remote = if (purge) "" else it.remote,
        desired = if (purge) "" else it.desired, draft = "", patch = "",
        calendarName = if (purge) "" else it.calendarName, htmlLink = if (purge) "" else it.htmlLink,
        state = if (!it.remoteAttempted && it.state !in terminal) "Cancelled" else it.state,
        message = "Local reminder removed. No further Calendar writes."))
    }
  }
  companion object { val terminal = setOf("Confirmed", "Cancelled", "Conflict", "Failed") }
}

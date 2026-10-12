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
  fun source(key: String): CalendarLink? = dao.remote(key) ?: db.calendar().operations().firstOrNull {
    (it.attempted || it.state == "Published") && CalendarLinkMapper.key(it.subject, it.calendarId, it.eventId) == key
  }?.let { CalendarLink(it.occurrenceId, key, it.subject, it.calendarId, it.eventId, it.calendarName, "Published",
    erased = it.readOnly && it.zoneId.isBlank()) }
  fun links() = dao.links().map { link ->
    val record = record(link.occurrenceId)
    mapOf("occurrenceId" to link.occurrenceId, "revision" to link.revision, "calendarName" to link.calendarName,
      "state" to link.state, "checkedAtMs" to link.checkedAtMs, "message" to link.message,
      "htmlLink" to link.htmlLink, "readOnly" to (link.erased || record == null || record.deleted || record.completed || record.skipped),
      "differs" to (record != null && link.baseline.isNotBlank() && !CalendarLinkMapper.equal(CalendarLinkMapper.fields(record), JSONObject(link.baseline))))
  }
  fun operations() = dao.operations().map(::view)
  fun view(job: CalendarLinkOperation): Map<String, Any?> = mapOf("operationId" to job.operationId,
    "occurrenceId" to job.occurrenceId, "kind" to job.kind, "calendarName" to job.calendarName,
    "state" to job.state, "message" to job.message, "localApplied" to job.localApplied,
    "localStatus" to job.localStatus, "remoteAttempted" to job.remoteAttempted,
    "readOnly" to job.erased, "localResult" to if (job.localApplied) mapOf("status" to job.localStatus) else null)
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
      if (choices.containsKey("disableReminders") && choices["disableReminders"] !is Boolean ||
        mode == "None" && choices["disableReminders"] == true) throw CalendarFailure("INVALID_INPUT")
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
    while (previews.size > 128) previews.remove(previews.keys.first())
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
    if (dao.operations().any { it.remoteKey == key && it.state !in terminal }) throw CalendarFailure("OPERATION_PENDING")
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
    val suppress = imported && options.optBoolean("disableReminders") && options.optString("mode") != "None"
    val patch = if (imported) CalendarLinkMapper.patch(remote, remote, suppress) else CalendarLinkMapper.patch(remote, desired, false)
    val job = CalendarLinkOperation(op, p.occurrenceId.ifEmpty { UUID.randomUUID().toString() }, key, kind, requestKey,
      p.subject, p.calendar.id, p.eventId, p.calendar.name, p.origin, p.revision, p.generation, p.linkRevision,
      p.connectionRevision, p.etag, p.remote, desired.toString(), draft.toString(), patch.toString(), suppress, htmlLink = p.htmlLink)
    dao.insert(job)
    return view(job)
  }
  fun check(job: CalendarLinkOperation, executionRevision: Long? = null) {
    val connection = connection()
    if (!connection.connected || connection.subject != job.subject) throw CalendarFailure("NEEDS_ACCESS")
    if (executionRevision != null && connection.revision != executionRevision) throw CalendarFailure("STALE_CONNECTION")
    if (job.erased) throw CalendarFailure("INELIGIBLE")
    if (job.patch.isBlank()) throw CalendarFailure("INELIGIBLE")
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
      "Unconfirmed" -> "Google outcome unconfirmed. Retry the same operation."
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

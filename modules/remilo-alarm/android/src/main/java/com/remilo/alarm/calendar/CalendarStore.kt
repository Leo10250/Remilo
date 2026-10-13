package com.remilo.alarm.calendar

import com.remilo.alarm.data.ContentDatabase
import com.remilo.alarm.data.CreationReceipt
import com.remilo.alarm.data.ReminderRecord
import org.json.JSONObject
import java.time.ZoneId
import com.remilo.alarm.data.*
import org.json.JSONArray

/** Called exclusively by AlarmEngine's serialized worker. Contains no network or Activity APIs. */
class CalendarStore(private val db: ContentDatabase, private val now: () -> Long,
  private val deviceZone: () -> String = { ZoneId.systemDefault().id }) {
  private val dao = db.calendar()
  val links = CalendarLinkStore(db, now)
  val sync = CalendarSyncStore(db, now, links)
  val incremental = CalendarIncrementalStore(db, now, links)
  fun snapshots(id: String) = db.sync().snapshots(id)
  init {
    dao.operations().filter { it.state == "Publishing" }.forEach {
      dao.update(it.copy(state = "Unconfirmed", message = "Publication was interrupted. Retry the same publication to confirm it."))
    }
  }
  fun connection() = dao.connection() ?: CalendarConnection()
  fun connectionView(): Map<String, Any> = connection().let { mapOf("revision" to it.revision,
    "connected" to it.connected, "email" to it.email, "calendarId" to it.calendarId,
    "calendarName" to it.calendarName, "message" to it.message) }
  fun operation(id: String) = dao.operation(id)
  fun authorizationEmail(id: String?): String? {
    if (id == null) return null // Connect/change-account explicitly opens account selection.
    val job = operation(id)
    if (job == null) {
      val linkJob = links.operation(id) ?: throw CalendarFailure("NOT_FOUND")
      return connection().takeIf { it.subject == linkJob.subject }?.email?.takeIf { it.isNotBlank() }
    }
    return connection().takeIf { it.subject == job.subject }?.email?.takeIf { it.isNotBlank() }
      ?: job.email.takeIf { it.isNotBlank() } // Purged jobs can select an account; UserInfo still verifies sub.
  }
  fun publication(id: String): Map<String, Any?>? = dao.binding(id)?.let { dao.operation(it.operationId) }?.let(::view)
  private fun publicationRecord(id: String): ReminderRecord? = links.record(id)?.let { record ->
    val segment = links.currentSeries(id) ?: return@let record
    val rule = com.remilo.alarm.data.RuleCodec.decode(segment.rule)
    val zone = java.time.ZoneId.of(rule.zoneId ?: deviceZone())
    val canonical = CalendarRecurrence.canonical(rule.copy(zoneId = zone.id))
    val slot = com.remilo.alarm.core.Recurrence.resolve(canonical, canonical.anchor, zone)
    record.copy(eventStartMs = slot.eventStartMs, eventEndMs = slot.eventEndMs, dueAtMs = slot.dueAtMs,
      definedAlarmAtMs = slot.alarmAtMs, zoneId = zone.id)
  }
  private fun publicationSegments(id: String, zone: String): List<SeriesRecord> = links.segments(id).map { segment ->
    val rule = CalendarRecurrence.canonical(RuleCodec.decode(segment.rule).let { it.copy(zoneId = it.zoneId ?: zone) })
    val slot = com.remilo.alarm.core.Recurrence.resolve(rule, rule.anchor, ZoneId.of(rule.zoneId))
    val template = BackupCodec.decodeRecord(JSONObject(segment.template)).copy(zoneId = slot.zoneId,
      eventStartMs = slot.eventStartMs, eventEndMs = slot.eventEndMs)
    segment.copy(rule = RuleCodec.encode(rule), template = JSONObject(BackupCodec.record(template)).toString())
  }
  private fun publicationFingerprint(id: String, record: ReminderRecord, zone: String): String {
    val segments = publicationSegments(id, zone)
    return if (segments.isEmpty()) CalendarMapper.fingerprint(record, zone) else CalendarMapper.hash(JSONArray(segments.map(links::segmentFields)).toString())
  }
  fun publications() = dao.operations().map(::view)
  fun view(job: CalendarOperation): Map<String, Any?> {
    val record = publicationRecord(job.occurrenceId)
    val differs = record != null && job.fingerprint.isNotEmpty() && publicationFingerprint(job.occurrenceId, record, record.zoneId.ifEmpty { job.zoneId }) != job.fingerprint
    return mapOf("operationId" to job.operationId, "occurrenceId" to job.occurrenceId,
      "calendarName" to job.calendarName, "email" to job.email, "state" to job.state,
      "message" to job.message, "htmlLink" to job.htmlLink, "publishedAtMs" to job.publishedAtMs,
      "differs" to differs, "readOnly" to (job.readOnly || record == null || record.completed || record.deleted || record.skipped))
  }
  fun connect(account: CalendarAccount, expectedRevision: Long) {
    require(account.subject.isNotBlank() && account.email.isNotBlank())
    val old = connection()
    if (old.revision != expectedRevision) throw CalendarFailure("STALE_CONNECTION")
    if (old.subject.isNotEmpty() && (old.subject != account.subject || !old.connected)) links.accessChanged("ACCOUNT_MISMATCH")
    dao.connection(old.copy(revision = old.revision + 1, connected = true, subject = account.subject,
      email = account.email, calendarId = if (old.subject == account.subject) old.calendarId else "",
      calendarName = if (old.subject == account.subject) old.calendarName else "",
      calendarZone = if (old.subject == account.subject) old.calendarZone else "",
      message = if (old.subject == account.subject && old.calendarId.isNotBlank()) "Ready to publish. Each task needs your confirmation."
        else "Google account connected. Choose a publishing calendar to finish setup."))
  }
  fun connectionMessage(message: String, expectedRevision: Long) {
    val old = connection()
    if (old.revision == expectedRevision) dao.connection(old.copy(message = message))
  }
  fun select(operationId: String, expected: Long, subject: String, calendar: OwnedCalendar): Map<String, Any> {
    val key = org.json.JSONArray(listOf(expected, calendar.id)).toString()
    receipt(operationId, "CalendarSelect", key)?.let { return connectionView() }
    val old = connection()
    if (!old.connected || old.subject != subject || old.revision != expected) throw CalendarFailure("STALE_CONNECTION")
    if (calendar.accessRole != "owner") throw CalendarFailure("NOT_OWNER")
    db.runInTransaction {
      dao.connection(old.copy(revision = old.revision + 1, calendarId = calendar.id,
        calendarName = calendar.name, calendarZone = calendar.zoneId, message = "Calendar selected. Nothing was published."))
      db.records().receipt(CreationReceipt(operationId, "calendar", "CalendarSelect", key))
    }
    return connectionView()
  }
  fun selectionReceipt(command: Map<String, Any?>): Map<String, Any>? {
    val key = org.json.JSONArray(listOf(number(command, "expectedConnectionRevision"), string(command, "calendarId"))).toString()
    return receipt(string(command, "operationId"), "CalendarSelect", key)?.let { connectionView() }
  }
  fun disconnect(operationId: String, expected: Long): CalendarConnection? {
    val old = connection()
    receipt(operationId, "CalendarDisconnect", expected.toString())?.let { return null }
    if (old.revision != expected) throw CalendarFailure("STALE_CONNECTION")
    db.runInTransaction {
      links.accessChanged("NEEDS_ACCESS")
      dao.connection(old.copy(revision = old.revision + 1, connected = false,
        message = "Disconnected locally. Previously published events remain. Revoking Google access…"))
      db.records().receipt(CreationReceipt(operationId, "calendar", "CalendarDisconnect", expected.toString()))
    }
    return old
  }
  private fun receipt(id: String, kind: String, key: String): CreationReceipt? {
    if (dao.operation(id) != null) throw CalendarFailure("OPERATION_REUSED")
    return db.records().receipt(id)?.also {
      if (it.kind != kind || it.sourceId != key) throw CalendarFailure("OPERATION_REUSED")
    }
  }
  fun preview(id: String): Map<String, Any> {
    val record = publicationRecord(id) ?: throw CalendarFailure("NOT_FOUND")
    if (record.deleted || record.completed || record.skipped || record.segmentId != null) throw CalendarFailure("INELIGIBLE")
    if (dao.binding(id) != null) throw CalendarFailure("ALREADY_PUBLISHED")
    if (links.link(id) != null) throw CalendarFailure("ALREADY_IMPORTED")
    val connection = connection()
    if (!connection.connected || connection.calendarId.isBlank()) throw CalendarFailure("NEEDS_CONNECTION")
    val zone = record.zoneId.ifEmpty(deviceZone)
    CalendarMapper.fields(record, zone) // Reject incompatible dates before committing any job.
    val segment = links.currentSeries(id)
    val recurrence = segment?.let { CalendarRecurrence.encode(com.remilo.alarm.data.RuleCodec.decode(it.rule).copy(zoneId = zone)) }
    return mapOf("occurrenceId" to id, "reminderRevision" to record.revision,
      "connectionRevision" to connection.revision, "fingerprint" to publicationFingerprint(id, record, zone),
      "zoneId" to zone, "pinsZone" to (record.zoneId.isBlank() || links.segments(id).any { RuleCodec.decode(it.rule).zoneId == null }), "title" to record.title, "notes" to record.notes,
      "eventStartMs" to record.eventStartMs, "eventEndMs" to record.eventEndMs, "allDay" to record.allDay,
      "email" to connection.email, "calendarName" to connection.calendarName, "recurrence" to (recurrence?.let { (0 until it.length()).map(it::getString) } ?: emptyList<String>()))
  }
  fun capture(command: Map<String, Any?>): Map<String, Any?> {
    val op = string(command, "operationId"); val id = string(command, "occurrenceId")
    val expected = number(command, "expectedRevision"); val connectionRevision = number(command, "expectedConnectionRevision")
    val fingerprint = string(command, "fingerprint")
    val key = org.json.JSONArray(listOf(id, expected, connectionRevision, fingerprint)).toString()
    dao.operation(op)?.let { if (it.requestKey != key) throw CalendarFailure("OPERATION_REUSED"); return view(it) }
    if (db.records().receipt(op) != null) throw CalendarFailure("OPERATION_REUSED")
    val preview = preview(id)
    if (preview["reminderRevision"] != expected || preview["connectionRevision"] != connectionRevision ||
      preview["fingerprint"] != fingerprint) throw CalendarFailure("STALE_PREVIEW")
    val connection = connection(); val record = publicationRecord(id)!!; val zone = preview["zoneId"] as String
    val eventId = CalendarMapper.eventId(connection.subject, connection.calendarId, id)
    val payload = org.json.JSONObject(CalendarMapper.payload(record, zone, eventId))
    val segments = publicationSegments(id, zone)
    segments.firstOrNull()?.let { payload.put("recurrence", CalendarRecurrence.encode(RuleCodec.decode(it.rule))) }
    val job = CalendarOperation(op, id, key, expected, connectionRevision, connection.subject, connection.email,
      connection.calendarId, connection.calendarName, zone, eventId, fingerprint, payload.toString())
    db.runInTransaction {
      val family = links.segments(id)
      if (family.isNotEmpty()) {
        family.filter { RuleCodec.decode(it.rule).zoneId == null }.forEach { segment ->
          val template = BackupCodec.decodeRecord(JSONObject(segment.template)).copy(zoneId = zone)
          db.records().series(segment.copy(rule = RuleCodec.encode(RuleCodec.decode(segment.rule).copy(zoneId = zone)),
            template = JSONObject(BackupCodec.record(template)).toString(), revision = segment.revision + 1))
          db.records().pendingSeries(PendingSeries("$op:${segment.id}", segment.id))
        }
      } else if (record.zoneId.isBlank()) db.records().update(record.copy(zoneId = zone, revision = record.revision + 1))
      dao.insert(job); dao.binding(CalendarBinding(id, op))
      segments.forEachIndexed { index, segment ->
        val master = CalendarSeriesMapping.master(connection.subject, connection.calendarId, segment)
        val masterId = if (index == 0) eventId else master.eventId
        db.calendarResources().put(CalendarResource(id, if (index == 0) "master" else "segment:${segment.id}", connection.calendarId, masterId, segment.id))
        if (index > 0) {
          val desired = CalendarLinkMapper.mainFields(links.segmentFields(segment))
          db.calendarResources().insert(CalendarResourceJob(op, "a:segment:${segment.id}", id, connection.calendarId,
            masterId, "", desired.toString(), master.payload.toString(), insert = true))
        }
        val exceptions = links.segmentFields(segment).getJSONObject("schedule").getJSONArray("exceptions")
        for (i in 0 until exceptions.length()) {
          val exception = exceptions.getJSONObject(i); val nominal = exception.getString("nominalSlot")
          val rule = RuleCodec.decode(segment.rule)
          val original = if (rule.allDay) java.time.LocalDateTime.parse(nominal).toLocalDate().toString() else
            java.time.LocalDateTime.parse(nominal).atZone(ZoneId.of(rule.zoneId)).toInstant().toString()
          val keyPart = "z:slot:${segment.id}:$nominal"
          db.calendarResources().put(CalendarResource(id, keyPart, connection.calendarId, "", segment.id, nominal))
          db.calendarResources().insert(CalendarResourceJob(op, keyPart, id, connection.calendarId, "", "",
            exception.getJSONObject("fields").toString(), "", lookupMaster = masterId, originalStart = original))
        }
      }
    }
    return view(job)
  }
  fun begin(id: String): CalendarOperation? {
    val job = dao.operation(id) ?: throw CalendarFailure("NOT_FOUND")
    if (job.state in setOf("Published", "Conflict", "Cancelled")) return null
    val connection = connection()
    if (!connection.connected || connection.subject != job.subject) {
      fail(id, "NEEDS_ACCESS"); return null
    }
    val next = job.copy(state = "Publishing", message = "Confirming the captured Calendar publication…")
    dao.update(next); return next
  }
  /** Last worker check before POST; deleting/purging/disconnecting can stop an unsent write. */
  fun permitInsert(id: String): CalendarOperation? {
    val job = dao.operation(id) ?: return null
    val connection = connection()
    val record = publicationRecord(job.occurrenceId)
    if (job.state != "Publishing" || job.readOnly || !connection.connected || connection.subject != job.subject ||
      record == null || record.deleted || record.completed || record.skipped) return null
    return job.copy(attempted = true).also(dao::update)
  }
  fun confirm(id: String, event: JSONObject) {
    val job = dao.operation(id) ?: return
    if (job.state == "Published") return
    if (!CalendarMapper.matching(event, job.eventId) || event.optString("status") == "cancelled") {
      dao.update(job.copy(state = "Conflict", message = "The Calendar identity conflicts or was removed in Google. No event was overwritten.")); return
    }
    val erased = job.readOnly && job.zoneId.isBlank()
    val link = if (erased) "" else event.optString("htmlLink").takeIf { it.startsWith("https://calendar.google.com/") || it.startsWith("https://www.google.com/calendar/") }.orEmpty()
    dao.update(job.copy(state = "Published", payload = "", message = "Published copy confirmed. Later edits are not synchronized.",
      htmlLink = link, etag = if (erased) "" else event.optString("etag"), publishedAtMs = now()))
  }
  fun publicationJobs(id: String) = db.calendarResources().jobs(id)
  fun permitResource(captured: CalendarResourceJob): CalendarResourceJob? {
    val parent = operation(captured.operationId) ?: return null
    val record = publicationRecord(parent.occurrenceId) ?: return null
    val connection = connection()
    if (parent.state != "Publishing" || parent.readOnly || !connection.connected || connection.subject != parent.subject ||
      record.deleted || record.completed || record.skipped) return null
    val job = publicationJobs(parent.operationId).firstOrNull { it.resourceId == captured.resourceId } ?: return null
    if (job != captured || job.erased || job.attempted || job.confirmed) return null
    return job.copy(attempted = true).also(db.calendarResources()::update)
  }
  fun bindResource(captured: CalendarResourceJob, event: JSONObject, zone: String): CalendarResourceJob? {
    val parent = operation(captured.operationId) ?: return null
    if (parent.readOnly || parent.state != "Publishing") return null
    val job = publicationJobs(parent.operationId).firstOrNull { it.resourceId == captured.resourceId } ?: return null
    if (job != captured || job.erased || job.attempted || job.eventId.isNotEmpty()) return null
    val fields = CalendarLinkMapper.fields(JSONObject(event.toString()).also { it.remove("recurringEventId") }, zone)
    return job.copy(eventId = event.getString("id"), etag = event.getString("etag"), remote = fields.toString(),
      payload = CalendarLinkMapper.patch(fields, JSONObject(job.desired), true).toString()).also(db.calendarResources()::update)
  }
  fun acknowledgeResource(job: CalendarResourceJob, event: JSONObject) {
    val current = publicationJobs(job.operationId).firstOrNull { it.resourceId == job.resourceId } ?: return
    if (current.erased || current.confirmed) return
    val parent = operation(job.operationId) ?: return
    db.runInTransaction {
      db.calendarResources().update(current.copy(confirmed = true, outcome = "Confirmed"))
      db.calendarResources().resources(parent.occurrenceId).firstOrNull { it.resourceId == job.resourceId || it.eventId == job.eventId }?.let {
        db.calendarResources().put(it.copy(eventId = event.getString("id"), etag = event.getString("etag"), fields = job.desired, availability = "Available"))
      }
    }
  }
  fun resourceOutcome(job: CalendarResourceJob, code: String) {
    publicationJobs(job.operationId).firstOrNull { it.resourceId == job.resourceId }?.takeUnless { it.erased || it.confirmed }?.let {
      db.calendarResources().update(it.copy(outcome = code, attempted = it.attempted && job.attempted))
    }
  }
  fun fail(id: String, code: String) {
    val job = dao.operation(id) ?: return
    if (job.state in setOf("Published", "Conflict", "Cancelled")) return
    val state = if (code == "REMOTE_REMOVED") "Conflict" else if (code in setOf("AUTH", "NEEDS_ACCESS", "ACCOUNT_MISMATCH")) "NeedsAccess" else if (code in setOf("NETWORK", "RETRY", "NOT_FOUND", "UNCONFIRMED_RESOURCE", "STALE_REMOTE")) "Unconfirmed" else "Failed"
    val message = when (code) {
      "AUTH", "NEEDS_ACCESS" -> "Authorize the original Google account and retry this publication."
      "ACCOUNT_MISMATCH" -> "This publication belongs to another Google account. Reconnect its original account."
      "NOT_OWNER" -> "You no longer own the selected calendar. No new event was sent."
      "FORBIDDEN" -> "Google denied access to this destination. Review its permissions before retrying."
      "BAD_REQUEST" -> "Google rejected the saved event details (HTTP 400). If retrying still fails, report this error."
      "INVALID_EVENT" -> "The saved event times could not be prepared for Google Calendar. Report this error before retrying."
      "REMOTE_REMOVED" -> "The previously sent Calendar identity is missing or cancelled. No replacement event was created."
      "NETWORK", "RETRY" -> "Publication is not confirmed. Retry the same publication; its content and destination are retained."
      else -> "Calendar could not confirm this publication. Retry the same publication or review Google access."
    }
    dao.update(job.copy(state = state, message = message))
  }
  fun removed(id: String, purge: Boolean) {
    if (purge) db.records().find(id)?.segmentId?.let { segmentId ->
      val family = db.records().series(segmentId)?.seriesId
      dao.operations().filter { links.currentSeries(it.occurrenceId)?.seriesId == family }.forEach {
        dao.update(it.copy(payload = "", fingerprint = "", readOnly = true))
        db.calendarResources().clearFields(it.occurrenceId); db.calendarResources().erase(it.occurrenceId)
      }
    }
    if (purge) { db.calendarResources().clearFields(id); db.calendarResources().erase(id) }
    links.removed(id, purge)
    dao.operationsFor(id).forEach { job ->
      val cancelled = !job.attempted && job.state != "Published"
      dao.update(job.copy(payload = if (purge || cancelled) "" else job.payload, readOnly = true,
        email = if (purge) "" else job.email, calendarName = if (purge) "" else job.calendarName,
        zoneId = if (purge) "" else job.zoneId, fingerprint = if (purge) "" else job.fingerprint,
        htmlLink = if (purge) "" else job.htmlLink,
        etag = if (purge) "" else job.etag,
        state = if (cancelled) "Cancelled" else job.state,
        message = if (cancelled) "Unsent publication cancelled. No Calendar event was created."
          else "Local reminder removed. A previously sent Calendar copy remains; recovery only checks its identity."))
      if (cancelled && dao.binding(id)?.operationId == job.operationId) dao.unbind(id)
    }
  }
  companion object {
    fun string(command: Map<String, Any?>, field: String): String = (command[field] as? String)?.takeIf { it.isNotBlank() && it.length <= 1024 }
      ?: throw CalendarFailure("INVALID_INPUT")
    fun number(command: Map<String, Any?>, field: String): Long {
      val value = (command[field] as? Number)?.toDouble() ?: throw CalendarFailure("INVALID_INPUT")
      if (!value.isFinite() || value < 0 || value % 1 != 0.0 || value > 9_007_199_254_740_991.0) throw CalendarFailure("INVALID_INPUT")
      return value.toLong()
    }
  }
}

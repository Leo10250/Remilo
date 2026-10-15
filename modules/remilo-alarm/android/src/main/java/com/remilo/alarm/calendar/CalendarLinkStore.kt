package com.remilo.alarm.calendar

import com.remilo.alarm.data.*
import org.json.JSONObject
import org.json.JSONArray
import java.time.*
import java.util.UUID

/** CE only, always called on the existing engine worker. No network or React ownership. */
class CalendarLinkStore(private val db: ContentDatabase, private val now: () -> Long, recoverInterrupted: Boolean = true) {
  private val dao = db.links()
  private val sync get() = CalendarSyncStore(db, now, this)
  private val previews = linkedMapOf<String, Pair<Long, CalendarLinkPreview>>()
  init { if (recoverInterrupted) dao.operations().filter { it.state == "Sending" }.forEach {
    dao.update(it.copy(state = "Unconfirmed", message = "Interrupted. Retry the same operation to check its saved outcome.").localizedMessage())
  } }
  fun connection() = db.calendar().connection() ?: CalendarConnection()
  fun link(id: String) = dao.link(id)
  fun currentSeries(id: String): SeriesRecord? = db.records().series(id)?.let { original ->
    db.records().series().filter { it.seriesId == original.seriesId && it.state != "Archived" }
      .minWithOrNull(compareBy<SeriesRecord> { RuleCodec.decode(it.rule).anchor }.thenByDescending { it.createdAtMs }.thenBy { it.id }) ?: original
  }
  fun segments(id: String): List<SeriesRecord> = currentSeries(id)?.let { first -> db.records().series().filter {
    it.seriesId == first.seriesId && it.state != "Archived"
  }.sortedWith(compareBy<SeriesRecord> { RuleCodec.decode(it.rule).anchor }.thenBy { it.id }) } ?: emptyList()
  fun resources(id: String) = db.calendarResources().resources(id)
  fun excludedSlot(id: String, masterId: String, nominal: String): Boolean {
    val segment = if (link(id)?.eventId == masterId) currentSeries(id) else resources(id).firstOrNull { it.eventId == masterId && it.nominalSlot.isEmpty() }?.segmentId?.let { db.records().series(it) }
    val segmentId = segment?.id ?: return false
    return db.records().all().any { it.segmentId == segmentId && it.nominalSlot == nominal && (it.completed || it.deleted || it.skipped) } ||
      db.records().purged().any { it.segmentId == segmentId && it.nominalSlot == nominal }
  }
  /** Terminal local instances leave Calendar untouched and leave the family's comparison scope. */
  fun normalizeEvent(id: String, event: JSONObject): JSONObject {
    currentSeries(id) ?: return event
    val original = event.optJSONArray("remiloInstances") ?: JSONArray()
    return JSONObject(event.toString()).put("remiloInstances", JSONArray((0 until original.length()).map { original.getJSONObject(it) }
      .filter { !excludedSlot(id, event.optString("id"), it.getString("nominalSlot")) }))
  }
  fun record(id: String): ReminderRecord? = db.records().find(id) ?: currentSeries(id)?.let { segment ->
    val family = db.records().series().filter { it.seriesId == segment.seriesId }
    BackupCodec.decodeRecord(JSONObject(segment.template)).copy(id = id, segmentId = null,
      revision = family.sumOf { it.revision } + db.records().all().filter { row -> row.exception && row.segmentId in family.map { it.id } }.sumOf { it.revision }, deleted = segment.state == "Archived")
  }
  fun fields(id: String): JSONObject {
    currentSeries(id)?.let { return segmentFields(it).also { result -> result.getJSONObject("schedule").put("segments", JSONArray(segments(id).drop(1).map(::segmentFields))) } }
    return CalendarLinkMapper.fields(record(id) ?: throw CalendarFailure("NOT_FOUND"))
  }
  fun segmentFields(segment: SeriesRecord): JSONObject {
    val rule = CalendarRecurrence.canonical(RuleCodec.decode(segment.rule))
    val slot = com.remilo.alarm.core.Recurrence.resolve(rule, rule.anchor, ZoneId.of(rule.zoneId))
    return CalendarLinkMapper.fields(BackupCodec.decodeRecord(JSONObject(segment.template)).copy(eventStartMs = slot.eventStartMs, eventEndMs = slot.eventEndMs, zoneId = slot.zoneId)).also {
    it.getJSONObject("schedule").put("recurrence", CalendarRecurrence.encode(RuleCodec.decode(segment.rule))).put("exceptions", JSONArray(db.records().all().filter { row ->
      row.segmentId == segment.id && row.exception && row.nominalSlot != null && !row.completed && !row.deleted && !row.skipped &&
        (row.eventStartMs > now() || (row.definedAlarmAtMs ?: 0) > now()) && !CalendarLinkMapper.equal(CalendarLinkMapper.fields(row), normalFields(segment, row.nominalSlot!!))
    }.sortedBy { row -> row.nominalSlot }.map { row -> JSONObject().put("nominalSlot", row.nominalSlot).put("fields", CalendarLinkMapper.fields(row)) })).put("segments", JSONArray())
    }
  }
  private fun normalFields(segment: SeriesRecord, nominal: String): JSONObject {
    val slot = com.remilo.alarm.core.Recurrence.resolve(RuleCodec.decode(segment.rule), LocalDateTime.parse(nominal), ZoneId.systemDefault())
    return CalendarLinkMapper.fields(BackupCodec.decodeRecord(JSONObject(segment.template)).copy(eventStartMs = slot.eventStartMs,
      eventEndMs = slot.eventEndMs, zoneId = slot.zoneId))
  }
  fun operation(id: String) = dao.operation(id)
  /** An ephemeral provenance overlay prevents our acknowledged partial Schedule from looking like
   * an independent Google edit. It never advances the durable common Schedule checkpoint. */
  fun comparisonBaseline(id: String): JSONObject? {
    val common = link(id)?.baseline?.takeIf(String::isNotBlank)?.let(::JSONObject) ?: return null
    val job = dao.operations().firstOrNull { it.occurrenceId == id && it.mainConfirmed && !it.erased && it.state != "Confirmed" && it.remote.isNotBlank() &&
      db.sync().guard(it.operationId)?.baselineVersion == sync.state(id).baselineVersion } ?: return common
    val expected = JSONObject(job.remote)
    val desired = JSONObject(job.desired)
    val schedule = expected.getJSONObject("schedule")
    val main = CalendarLinkMapper.mainFields(desired).getJSONObject("schedule")
    main.keys().forEach { schedule.put(it, main.get(it)) }
    fun overlay(fields: JSONObject, target: JSONObject, nominal: String) {
      val exceptions = fields.getJSONObject("schedule").optJSONArray("exceptions") ?: JSONArray()
      val rows = (0 until exceptions.length()).map { exceptions.getJSONObject(it) }.filter { it.getString("nominalSlot") != nominal }.toMutableList()
      rows.add(JSONObject().put("nominalSlot", nominal).put("fields", target))
      fields.getJSONObject("schedule").put("exceptions", JSONArray(rows.sortedBy { it.getString("nominalSlot") }))
    }
    val children = schedule.optJSONArray("segments") ?: JSONArray()
    for (childJob in resourceJobs(job.operationId).filter { it.confirmed && !it.erased }) {
      val identity = resources(id).firstOrNull { it.eventId == childJob.eventId } ?: continue
      val target = JSONObject(childJob.desired)
      if (identity.nominalSlot.isEmpty()) {
        val previous = children.let { list -> (0 until list.length()).map { list.getJSONObject(it) } }.firstOrNull {
          childJob.remote.isNotEmpty() && CalendarLinkMapper.equal(CalendarLinkMapper.mainFields(it), CalendarLinkMapper.mainFields(JSONObject(childJob.remote))) }
        if (previous == null) children.put(target) else {
          val oldSchedule = previous.getJSONObject("schedule"); val nextSchedule = target.getJSONObject("schedule")
          nextSchedule.keys().forEach { oldSchedule.put(it, nextSchedule.get(it)) }
          previous.put("title", target.get("title")).put("notes", target.get("notes"))
        }
      } else if (identity.segmentId == currentSeries(id)?.id) overlay(expected, target, identity.nominalSlot)
      else {
        val master = resources(id).firstOrNull { it.segmentId == identity.segmentId && it.nominalSlot.isEmpty() }
        val masterJob = resourceJobs(job.operationId).firstOrNull { it.eventId == master?.eventId }
        (0 until children.length()).map { children.getJSONObject(it) }.firstOrNull { masterJob != null &&
          CalendarLinkMapper.equal(CalendarLinkMapper.mainFields(it), CalendarLinkMapper.mainFields(JSONObject(masterJob.desired))) }?.let { overlay(it, target, identity.nominalSlot) }
      }
    }
    schedule.put("segments", JSONArray((0 until children.length()).map { children.getJSONObject(it) }.sortedBy { it.getJSONObject("schedule").getLong("eventStartMs") }))
    common.put("schedule", schedule)
    return common
  }
  fun proposed(previewId: String, selections: Map<String, String?>): Pair<CalendarLinkPreview, JSONObject> {
    val cached = previews[previewId] ?: throw CalendarFailure("STALE_PREVIEW")
    if (now() - cached.first > 600_000) throw CalendarFailure("STALE_PREVIEW")
    val preview = cached.second
    val desired = JSONObject(preview.remote)
    if (preview.occurrenceId.isNotEmpty()) {
      val local = JSONObject(preview.local)
      for (field in listOf("title", "notes", "schedule")) {
        val selected = selections[field] ?: throw CalendarFailure("RESOLUTION_REQUIRED")
        if (selected !in setOf("remilo", "google")) throw CalendarFailure("INVALID_INPUT")
        desired.put(field, if (selected == "remilo") local.get(field) else desired.get(field))
      }
    }
    return preview to desired
  }
  fun validateGeneration(command: Map<String, Any?>, generation: (String) -> Long) {
    if (operation(CalendarStore.string(command, "operationId")) != null) return
    val cached = previews[CalendarStore.string(command, "previewId")] ?: throw CalendarFailure("STALE_PREVIEW")
    val preview = cached.second
    if (preview.occurrenceId.isNotEmpty() && preview.generation != generation(preview.occurrenceId)) throw CalendarFailure("STALE_PREVIEW")
  }
  fun captureActivationBatch(command: Map<String, Any?>, generation: (String) -> Long,
    preflight: (String, Map<String, String?>) -> String? = { _, _ -> null }): Map<String, Any?> {
    val id = CalendarStore.string(command, "operationId")
    val previews = command["previewIds"] as? List<*> ?: throw CalendarFailure("INVALID_INPUT")
    if (previews.isEmpty() || previews.size > 500 || previews.any { it !is String } || previews.distinct().size != previews.size) throw CalendarFailure("INVALID_INPUT")
    val key = CalendarMapper.hash(JSONArray(previews).toString())
    db.records().receipt(id)?.let { receipt ->
      if (receipt.kind != "CalendarActivationBatch") throw CalendarFailure("OPERATION_REUSED")
      val saved = JSONArray(receipt.sourceId)
      if (saved.getString(0) != key) throw CalendarFailure("OPERATION_REUSED")
      val children = saved.getJSONArray(1)
      return mapOf("operationId" to id, "retry" to true, "operations" to (0 until children.length()).map { view(operation(children.getString(it)) ?: throw CalendarFailure("NOT_FOUND")) })
    }
    val captured = mutableListOf<String>()
    db.runInTransaction {
      previews.forEach { previewId ->
        val cached = this.previews[previewId as String] ?: throw CalendarFailure("STALE_PREVIEW")
        val preview = cached.second
        if (preview.occurrenceId.isEmpty()) throw CalendarFailure("INVALID_INPUT")
        val choices = CalendarLinkMapper.defaults(JSONObject(preview.local), JSONObject(preview.remote), preview.baseline.takeIf(String::isNotBlank)?.let(::JSONObject))
        if (choices.values.any { it == null }) throw CalendarFailure("RESOLUTION_REQUIRED")
        preflight(previewId, choices)?.let { throw CalendarFailure(it) }
        val child = java.util.UUID.nameUUIDFromBytes("$id:$previewId".toByteArray()).toString()
        val input = mapOf("operationId" to child, "kind" to "EnableAutomaticCalendarSync", "previewId" to previewId, "selections" to choices)
        validateGeneration(input, generation); capture(input); captured.add(child)
      }
      db.records().receipt(CreationReceipt(id, "calendar", "CalendarActivationBatch", JSONArray(listOf(key, JSONArray(captured))).toString()))
    }
    return mapOf("operationId" to id, "operations" to captured.map { view(operation(it)!!) })
  }
  fun agreementTarget(job: CalendarLinkOperation) = JSONObject(if (job.kind == "ImportCalendarEvent" && sync.state(job.occurrenceId).mode == "Manual") job.remote else job.desired)
  fun resourceJobs(id: String) = db.calendarResources().jobs(id)
  fun bindResource(captured: CalendarResourceJob, event: JSONObject, zone: String, revision: Long): CalendarResourceJob? {
    val parent = operation(captured.operationId) ?: return null
    check(parent, revision)
    sync.guard(parent, beforeLocal = false, beforeSend = true)
    val current = resourceJobs(parent.operationId).firstOrNull { it.resourceId == captured.resourceId } ?: return null
    if (current != captured || current.erased || current.attempted || current.eventId.isNotEmpty()) return null
    val fields = CalendarLinkMapper.fields(JSONObject(event.toString()).also { it.remove("recurringEventId") }, zone)
    val job = current.copy(eventId = event.getString("id"), etag = event.getString("etag"), remote = fields.toString(), payload = CalendarLinkMapper.patch(fields, JSONObject(current.desired), false).toString())
    db.runInTransaction {
      db.calendarResources().update(job)
      resources(parent.occurrenceId).firstOrNull { it.resourceId == job.resourceId }?.let { db.calendarResources().put(it.copy(eventId = job.eventId, etag = job.etag, fields = fields.toString())) }
    }
    return job
  }
  fun permitResource(captured: CalendarResourceJob, revision: Long): CalendarResourceJob? {
    val parent = operation(captured.operationId) ?: return null
    check(parent, revision)
    sync.guard(parent, beforeLocal = false, beforeSend = true)
    if (!parent.localApplied) throw CalendarFailure("NOT_AVAILABLE")
    val job = resourceJobs(parent.operationId).firstOrNull { it.resourceId == captured.resourceId } ?: return null
    if (job.erased || job.confirmed || job.attempted || job != captured) return null
    db.calendarResources().resources(parent.occurrenceId).firstOrNull { it.resourceId == job.resourceId }?.let { source ->
      if (source.nominalSlot.isNotBlank()) db.records().all().firstOrNull { it.segmentId == source.segmentId && it.nominalSlot == source.nominalSlot }?.let {
        if (it.completed || it.deleted || it.skipped) throw CalendarFailure("INELIGIBLE")
      }
    }
    return job.copy(attempted = true).also(db.calendarResources()::update)
  }
  fun rebaseResource(captured: CalendarResourceJob, event: JSONObject, revision: Long): CalendarResourceJob? {
    val parent = operation(captured.operationId) ?: return null
    check(parent, revision); sync.guard(parent, beforeLocal = false, beforeSend = true)
    val current = resourceJobs(parent.operationId).firstOrNull { it.resourceId == captured.resourceId } ?: return null
    if (current != captured || current.erased || current.attempted || current.confirmed || event.optString("id") != current.eventId) return null
    return current.copy(etag = event.getString("etag")).also(db.calendarResources()::update)
  }
  fun acknowledgeResource(captured: CalendarResourceJob, event: JSONObject) {
    val job = resourceJobs(captured.operationId).firstOrNull { it.resourceId == captured.resourceId } ?: return
    if (job.erased || event.optString("id") != job.eventId) return
    db.calendarResources().update(job.copy(confirmed = true, outcome = "Confirmed"))
    db.calendarResources().resources(job.associationId).firstOrNull { it.resourceId == job.resourceId }?.let {
      db.calendarResources().put(it.copy(etag = event.optString("etag"), fields = job.desired, availability = "Available"))
    }
  }
  fun resourceOutcome(captured: CalendarResourceJob, code: String) {
    val job = resourceJobs(captured.operationId).firstOrNull { it.resourceId == captured.resourceId } ?: return
    if (job.erased || job.confirmed) return
    // A definitive rejection proves no child write; lost replies retain the sent marker.
    db.calendarResources().update(job.copy(outcome = code,
      attempted = job.attempted && captured.attempted))
  }
  private fun sourceView(subject: String, calendarId: String, eventId: String, current: CalendarConnection): Map<String, String>? =
    current.takeIf { it.connected && it.subject == subject }?.let { mapOf("calendarId" to calendarId, "eventId" to eventId) }
  fun source(key: String): CalendarLink? = dao.remote(key) ?: dao.links().firstOrNull { link -> resources(link.occurrenceId).any {
    it.eventId.isNotEmpty() && CalendarLinkMapper.key(link.subject, it.calendarId, it.eventId) == key } } ?: db.calendar().operations().firstOrNull {
    (it.attempted || it.state == "Published") && CalendarLinkMapper.key(it.subject, it.calendarId, it.eventId) == key
      || resourceJobs(it.operationId).any { child -> (child.attempted || child.confirmed) && child.eventId.isNotEmpty() && CalendarLinkMapper.key(it.subject, child.calendarId, child.eventId) == key }
  }?.let { CalendarLink(it.occurrenceId, key, it.subject, it.calendarId, it.eventId, it.calendarName, "Published",
    erased = it.readOnly && it.zoneId.isBlank()) }
  fun links() = connection().let { current -> dao.links().map { view(it, current) } }
  fun view(link: CalendarLink): Map<String, Any?> = view(link, connection())
  private fun view(link: CalendarLink, current: CalendarConnection): Map<String, Any?> {
    val record = record(link.occurrenceId)
    return mapOf("occurrenceId" to link.occurrenceId, "revision" to link.revision, "calendarName" to link.calendarName,
      "state" to link.state, "checkedAtMs" to link.checkedAtMs, "message" to com.remilo.alarm.presentation.L10n.stored(link.messageKey, link.messageArgs, link.message),
      "accountEmail" to link.accountEmail, "availability" to link.availability, "availabilityReason" to link.availabilityReason,
      "observedAtMs" to link.observedAtMs, "lastCheckAttemptAtMs" to link.lastCheckAttemptAtMs,
      "lastCheckErrorCode" to link.lastCheckErrorCode, "remoteDiffers" to link.remoteDiffers, "requiresReview" to link.requiresReview,
      "htmlLink" to link.htmlLink, "source" to sourceView(link.subject, link.calendarId, link.eventId, current),
      "seriesId" to currentSeries(link.occurrenceId)?.seriesId,
      "cancelledInstances" to resources(link.occurrenceId).filter { it.availability == "Deleted" && it.nominalSlot.isNotEmpty() }.map { mapOf("segmentId" to it.segmentId, "nominalSlot" to it.nominalSlot) },
      "readOnly" to (link.erased || record == null || record.deleted || record.completed || record.skipped),
      "differs" to (record != null && link.baseline.isNotBlank() && runCatching { !CalendarLinkMapper.equal(fields(link.occurrenceId), JSONObject(link.baseline)) }.getOrDefault(true))) + sync.view(link.occurrenceId)
  }
  fun instanceDeleted(guard: CalendarObservationGuard, masterId: String, eventId: String, nominal: String, background: Boolean) {
    val old = guarded(guard)
    if (excludedSlot(old.occurrenceId, masterId, nominal)) return
    val segment = if (masterId == old.eventId) currentSeries(old.occurrenceId)?.id else resources(old.occurrenceId).firstOrNull { it.eventId == masterId && it.nominalSlot.isEmpty() }?.segmentId
    if (segment == null) throw CalendarFailure("FOREIGN_IDENTITY")
    db.runInTransaction {
      db.calendarResources().put(CalendarResource(old.occurrenceId, "cancelled:$segment:$nominal", old.calendarId, eventId, segment, nominal, availability = "Deleted"))
      dao.put(old.copy(revision = old.revision + 1, state = "Suspended", requiresReview = true, availabilityReason = "INSTANCE_CANCELLED"))
      fenceOperations(old.occurrenceId, "A Google occurrence was cancelled. Local delivery is kept; fresh review is required.")
      sync.fenced(old.occurrenceId, false, "RemoteDeleted")
      sync.issue(old.occurrenceId, "REMOTE_DELETED", background, "Paused", "$masterId:$nominal")
    }
  }
  fun operations() = connection().let { current -> dao.operations().map { view(it, current) } }
  fun view(job: CalendarLinkOperation): Map<String, Any?> = view(job, connection())
  private fun view(job: CalendarLinkOperation, current: CalendarConnection): Map<String, Any?> = mapOf("operationId" to job.operationId,
    "occurrenceId" to job.occurrenceId, "kind" to job.kind, "calendarName" to job.calendarName,
    "title" to if (job.erased) "" else (record(job.occurrenceId)?.title ?: job.draft.takeIf(String::isNotBlank)?.let { JSONObject(it).optString("title") }.orEmpty()),
    "state" to job.state, "message" to if (job.state == "Failed") com.remilo.alarm.presentation.L10n.text(if (job.localApplied) "Local changes saved. The Calendar request could not be completed. Review again." else "Local change not applied. The Calendar request could not be completed. Review again.") else com.remilo.alarm.presentation.L10n.stored(job.messageKey, job.messageArgs, job.message), "localApplied" to job.localApplied,
    "recoveryMode" to when {
      job.erased -> "None"
      job.remoteAttempted && (job.patch.isBlank() || record(job.occurrenceId)?.let { it.completed || it.deleted || it.skipped } == true) && job.state !in terminal -> "ConfirmOutcome"
      job.state in setOf("Waiting", "Unconfirmed", "NeedsAccess", "Blocked") -> "Retry"
      job.state in setOf("Conflict", "Failed") && record(job.occurrenceId)?.let { !it.deleted && !it.completed && !it.skipped } == true -> "ReviewAgain"
      else -> "None"
    },
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
    val normalized = if (id == null) event else normalizeEvent(id, event)
    val remote = CalendarLinkMapper.fields(normalized, calendar.zoneId)
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
    event.optString("updated").takeIf { it.length <= 100 }?.let { options.put("googleUpdated", it) }
    options.put("automaticSync", choices["automaticSync"] as? Boolean ?: if (id == null || old == null || old.state == "Detached") true else sync.state(id).mode != "Manual")
    normalized.optJSONArray("remiloInstances")?.let { options.put("instances", it) }
    event.optJSONArray("remiloSegmentSources")?.let { options.put("resources", it) }
    if (id == null) {
      val mode = choices["mode"] as? String ?: "Alarm"
      if (mode !in setOf("Alarm", "Notification", "None")) throw CalendarFailure("INVALID_INPUT")
      if (choices.containsKey("disableReminders") && choices["disableReminders"] !is Boolean) throw CalendarFailure("INVALID_INPUT")
      val schedule = remote.getJSONObject("schedule")
      val minutes = (choices["allDayAlarmMinutes"] as? Number)?.toInt() ?: 540
      if (minutes !in 0..1439) throw CalendarFailure("INVALID_INPUT")
      val alarm = if (schedule.getBoolean("allDay")) Instant.ofEpochMilli(schedule.getLong("eventStartMs"))
        .atZone(ZoneId.of(schedule.getString("zoneId"))).toLocalDate().atTime(minutes / 60, minutes % 60)
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
      calendar, eventId, event.getString("etag"), remote.toString(), id ?: "", record?.let { fields(id!!).toString() } ?: "",
      old?.baseline.orEmpty(), record?.revision ?: 0, generation, old?.revision ?: 0,
      old?.origin ?: if (id == null) "Imported" else "Published", options.toString(),
      event.optString("htmlLink").takeIf { it.startsWith("https://calendar.google.com/") || it.startsWith("https://www.google.com/calendar/") }.orEmpty(),
      CalendarLinkMapper.reminders(event, calendar.hasDefaultReminders), preservedAlertMs)
    previews[preview.id] = now() to preview
    while (previews.size > 1024) previews.remove(previews.keys.first())
    if (old != null) observe(guard(id!!), calendar, CalendarEventLookup.Found(event))
    return previewView(preview)
  }
  private fun previewView(p: CalendarLinkPreview): Map<String, Any?> {
    val remote = JSONObject(p.remote); val local = p.local.takeIf { it.isNotBlank() }?.let(::JSONObject)
    val schedule = remote.getJSONObject("schedule")
    val recurrence = schedule.optJSONArray("recurrence")?.let { CalendarRecurrence.decode(it,
      Instant.ofEpochMilli(schedule.getLong("eventStartMs")).atZone(ZoneId.of(schedule.getString("zoneId"))).toLocalDateTime(),
      schedule.getString("zoneId"), schedule.getBoolean("allDay"), if (schedule.getBoolean("allDay")) 86_400_000 else schedule.getLong("eventEndMs") - schedule.getLong("eventStartMs")) }
    val upcoming = recurrence?.let {
      val mode = JSONObject(p.choices).optString("mode", record(p.occurrenceId)?.mode ?: "Alarm")
      val parts = listOf(remote) + (schedule.optJSONArray("segments") ?: JSONArray()).let { rows ->
        (0 until rows.length()).map(rows::getJSONObject) }
      parts.flatMap { part ->
        val timing = part.getJSONObject("schedule"); val zone = ZoneId.of(timing.getString("zoneId"))
        val rule = CalendarRecurrence.decode(timing.getJSONArray("recurrence"),
          Instant.ofEpochMilli(timing.getLong("eventStartMs")).atZone(zone).toLocalDateTime(), zone.id,
          timing.getBoolean("allDay"), if (timing.getBoolean("allDay")) 86_400_000 else timing.getLong("eventEndMs") - timing.getLong("eventStartMs"))
        val exceptions = (timing.optJSONArray("exceptions") ?: JSONArray()).let { rows -> (0 until rows.length()).map(rows::getJSONObject) }
        val exceptionSlots = exceptions.map { row -> row.getString("nominalSlot") }.toSet()
        val ordinary = com.remilo.alarm.core.Recurrence.future(rule, now(), zone, mode).filter { slot -> slot.nominal.toString() !in exceptionSlots }
          .take(3).map { slot -> mapOf("eventStartMs" to slot.eventStartMs, "alarmAtMs" to slot.alarmAtMs) }.toList()
        val moved = exceptions.filter { row -> !row.optBoolean("cancelled") }.map { row -> row.getJSONObject("fields").getJSONObject("schedule") }
          .filter { fields -> fields.getLong("eventStartMs") > now() }.map { fields ->
            val start = fields.getLong("eventStartMs")
            val alarm = if (fields.getBoolean("allDay")) Instant.ofEpochMilli(start).atZone(ZoneId.of(fields.getString("zoneId")))
              .toLocalDate().atTime(9, 0).atZone(ZoneId.of(fields.getString("zoneId"))).toInstant().toEpochMilli() else start
            mapOf("eventStartMs" to start, "alarmAtMs" to alarm)
          }
        ordinary + moved
      }.sortedBy { row -> row.getValue("eventStartMs") }.take(3)
    }
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
        Instant.ofEpochMilli(start).atZone(ZoneId.of(schedule.getString("zoneId"))).toLocalDate().atTime(
          Instant.ofEpochMilli(record.definedAlarmAtMs ?: record.eventStartMs).atZone(ZoneId.of(record.zoneId)).toLocalTime())
          .atZone(ZoneId.of(schedule.getString("zoneId"))).toInstant().toEpochMilli()
        else (record.definedAlarmAtMs ?: record.eventStartMs) + due - record.dueAtMs
      return mapOf("mode" to record.mode, "dueAtMs" to due, "alarmAtMs" to alarm)
    }
    return mapOf("previewId" to p.id, "occurrenceId" to p.occurrenceId, "calendarName" to p.calendar.name,
      "email" to connection().email, "remote" to CalendarLinkMapper.map(remote),
      "local" to local?.let(CalendarLinkMapper::map),
      "baseline" to p.baseline.takeIf { it.isNotBlank() }?.let { CalendarLinkMapper.map(JSONObject(it)) },
      "selections" to local?.let { CalendarLinkMapper.defaults(it, remote, p.baseline.takeIf(String::isNotBlank)?.let(::JSONObject)) },
      "choices" to CalendarLinkMapper.map(JSONObject(p.choices)).filterKeys { it != "instances" && it != "resources" }, "googleReminders" to p.googleReminders,
      "checkedAtMs" to now(), "nextAlertMs" to (p.preservedAlertMs ?: upcoming?.firstOrNull()?.get("alarmAtMs")),
      "recurrence" to recurrence?.let(CalendarRecurrence::spec), "upcoming" to upcoming,
      "timings" to if (local == null) null else mapOf("remilo" to timing(local), "google" to timing(remote)))
  }
  fun capture(command: Map<String, Any?>, allocatedId: String? = null): Map<String, Any?> {
    val op = CalendarStore.string(command, "operationId")
    val kind = CalendarStore.string(command, "kind")
    val previewId = CalendarStore.string(command, "previewId")
    @Suppress("UNCHECKED_CAST") val selection = command["selections"] as? Map<String, String> ?: emptyMap()
    if (command.containsKey("automaticSync") && command["automaticSync"] !is Boolean) throw CalendarFailure("INVALID_INPUT")
    val requestKey = JSONArray(listOf(kind, previewId, selection["title"], selection["notes"], selection["schedule"], command["automaticSync"] ?: JSONObject.NULL)).toString()
    dao.operation(op)?.let { if (it.requestKey != requestKey) throw CalendarFailure("OPERATION_REUSED"); return view(it) }
    if (db.records().receipt(op) != null || db.calendar().operation(op) != null) throw CalendarFailure("OPERATION_REUSED")
    val cached = previews[previewId] ?: throw CalendarFailure("STALE_PREVIEW")
    if (now() - cached.first > 600_000) throw CalendarFailure("STALE_PREVIEW")
    val p = cached.second
    if (connection().revision != p.connectionRevision || !connection().connected || connection().subject != p.subject) throw CalendarFailure("STALE_CONNECTION")
    val imported = kind == "ImportCalendarEvent"
    if (kind !in setOf("ImportCalendarEvent", "EnableCalendarLink", "ApplyCalendarResolution", "EnableAutomaticCalendarSync", "AutomaticCalendarTransfer") || imported != p.occurrenceId.isEmpty()) throw CalendarFailure("INVALID_INPUT")
    if (!imported) {
      val record = record(p.occurrenceId); active(record)
      if (kind == "ApplyCalendarResolution" && (link(p.occurrenceId) == null || link(p.occurrenceId)?.state == "Detached")) throw CalendarFailure("INELIGIBLE")
      if (record!!.revision != p.revision || (link(p.occurrenceId)?.revision ?: 0) != p.linkRevision) throw CalendarFailure("STALE_PREVIEW")
    }
    val key = CalendarLinkMapper.key(p.subject, p.calendar.id, p.eventId)
    if (imported && source(key) != null) throw CalendarFailure("ALREADY_IMPORTED")
    val unresolved = dao.operations().filter { it.remoteKey == key && it.state !in terminal }
    val resolvingUnknown = kind in setOf("ApplyCalendarResolution", "EnableCalendarLink") && unresolved.all { it.state == "Unconfirmed" || it.patch.isBlank() }
    if (unresolved.isNotEmpty() && !resolvingUnknown) throw CalendarFailure("OPERATION_PENDING")
    val remote = JSONObject(p.remote)
    val desired = JSONObject(p.remote)
    if (!imported) {
      val local = JSONObject(p.local)
      for (field in listOf("title", "notes", "schedule")) {
        val side = selection[field] ?: throw CalendarFailure("RESOLUTION_REQUIRED")
        if (side !in setOf("remilo", "google")) throw CalendarFailure("INVALID_INPUT")
        desired.put(field, if (side == "remilo") local.get(field) else remote.get(field))
      }
      if (kind == "AutomaticCalendarTransfer") {
        val comparison = CalendarComparison.compare(local, remote, comparisonBaseline(p.occurrenceId))
        if (comparison.conflicts.isNotEmpty()) throw CalendarFailure("RESOLUTION_REQUIRED")
        if (!CalendarLinkMapper.equal(desired, comparison.desired)) throw CalendarFailure("INVALID_INPUT")
      }
    }
    val options = JSONObject(p.choices)
    val automaticSync = if (kind == "EnableAutomaticCalendarSync" || kind == "AutomaticCalendarTransfer") true else command["automaticSync"] as? Boolean ?: options.optBoolean("automaticSync", false)
    if (imported) desired.put("title", options.getString("title"))
    if (desired.getString("title").isBlank()) throw CalendarFailure("TITLE_REQUIRED")
    val draft = CalendarLinkMapper.draft(desired)
    draft.put("googleUpdated", options.optString("googleUpdated"))
    options.optJSONArray("instances")?.let { draft.put("calendarInstances", it) }
    options.optJSONArray("resources")?.let { draft.put("calendarResources", it) }
    if (imported) for (field in listOf("mode", "alarmAtMs", "dueAtMs", "dueLinked", "alarmLinked", "sound", "vibration", "listId")) draft.put(field, options.get(field))
    val suppress = imported && options.optBoolean("disableReminders")
    val patch = if (imported && !automaticSync) CalendarLinkMapper.patch(remote, remote, suppress) else CalendarLinkMapper.patch(remote, desired, suppress)
    val job = CalendarLinkOperation(op, p.occurrenceId.ifEmpty { allocatedId ?: UUID.randomUUID().toString() }, key, kind, requestKey,
      p.subject, p.calendar.id, p.eventId, p.calendar.name, p.origin, p.revision, p.generation, p.linkRevision,
      p.connectionRevision, p.etag, p.remote, desired.toString(), draft.toString(), patch.toString(), suppress, htmlLink = p.htmlLink)
    db.runInTransaction {
      if (resolvingUnknown) unresolved.forEach { dao.update(it.copy(state = "Cancelled", patch = "", draft = "",
        message = "A fresh confirmed review superseded this update. No further writes are permitted.").localizedMessage()) }
      dao.insert(job)
      captureResources(job, options)
      sync.capture(job, automaticSync, kind == "AutomaticCalendarTransfer")
    }
    return view(job)
  }
  private fun captureResources(job: CalendarLinkOperation, options: JSONObject) {
    val schedule = JSONObject(job.desired).getJSONObject("schedule")
    val desired = schedule.optJSONArray("exceptions") ?: return
    val instances = options.optJSONArray("instances") ?: JSONArray()
    val segment = currentSeries(job.occurrenceId)?.id ?: job.occurrenceId
    db.calendarResources().put(CalendarResource(job.occurrenceId, "master", job.calendarId, job.eventId, segment,
      etag = job.etag, fields = job.remote, availability = "Available"))
    val extra = schedule.optJSONArray("segments") ?: JSONArray()
    val sources = options.optJSONArray("resources") ?: JSONArray()
    val native = segments(job.occurrenceId).drop(1)
    for (index in 0 until extra.length()) {
      val targetFields = extra.getJSONObject(index)
      val segmentRecord = native.getOrNull(index) ?: throw CalendarFailure("SPLIT_REQUIRES_REVIEW")
      val source = (0 until sources.length()).map { sources.getJSONObject(it) }.firstOrNull { it.optString("segmentId") == segmentRecord.id }
      val resourceId = "segment:${segmentRecord.id}"
      val eventId = source?.getString("eventId") ?: CalendarSeriesMapping.master(job.subject, job.calendarId, segmentRecord).eventId
      val prior = source?.getJSONObject("fields")
      val payload = if (prior == null) CalendarSeriesMapping.master(job.subject, job.calendarId, segmentRecord).payload else CalendarLinkMapper.patch(prior, targetFields, false)
      db.calendarResources().put(CalendarResource(job.occurrenceId, resourceId, job.calendarId, eventId, segmentRecord.id,
        etag = source?.optString("etag").orEmpty(), fields = prior?.toString().orEmpty()))
      val wire = JSONObject(targetFields.toString()).also { it.getJSONObject("schedule").put("exceptions", JSONArray()) }
      if (prior == null || payload.length() > 0) db.calendarResources().insert(CalendarResourceJob(job.operationId, resourceId, job.occurrenceId,
        job.calendarId, eventId, source?.optString("etag").orEmpty(), wire.toString(), payload.toString(), insert = prior == null,
        remote = prior?.let { JSONObject(it.toString()).also { value -> value.getJSONObject("schedule").put("exceptions", JSONArray()) }.toString() }.orEmpty()))
      val instanceTargets = targetFields.getJSONObject("schedule").optJSONArray("exceptions") ?: JSONArray()
      for (instanceIndex in 0 until instanceTargets.length()) {
        val instance = instanceTargets.getJSONObject(instanceIndex); val nominal = instance.getString("nominalSlot")
        val instanceId = "slot:${segmentRecord.id}:$nominal" // Ordered after segment-master checkpoints.
        val instant = LocalDateTime.parse(nominal).atZone(ZoneId.of(targetFields.getJSONObject("schedule").getString("zoneId"))).toInstant().toString()
        val original = if (targetFields.getJSONObject("schedule").getBoolean("allDay")) LocalDateTime.parse(nominal).toLocalDate().toString() else instant
        db.calendarResources().put(CalendarResource(job.occurrenceId, instanceId, job.calendarId, "", segmentRecord.id, nominal))
        db.calendarResources().insert(CalendarResourceJob(job.operationId, instanceId, job.occurrenceId, job.calendarId, "", "",
          instance.getJSONObject("fields").toString(), "", lookupMaster = eventId, originalStart = original))
      }
    }
    val rows = (0 until instances.length()).map { instances.getJSONObject(it) }.associateBy { it.getString("nominalSlot") }
    val target = (0 until desired.length()).map { desired.getJSONObject(it) }.associateBy { it.getString("nominalSlot") }.toMutableMap()
    // Selecting the native Schedule also restores a remotely edited instance to its native ordinary slot.
    if (job.kind != "ImportCalendarEvent" && currentSeries(job.occurrenceId) != null &&
      !CalendarLinkMapper.equal(JSONObject(job.remote).get("schedule"), JSONObject(job.desired).get("schedule"))) {
      rows.values.filter { it.optBoolean("exception", true) && !it.optBoolean("cancelled") }.forEach { row ->
        target.putIfAbsent(row.getString("nominalSlot"), JSONObject().put("nominalSlot", row.getString("nominalSlot"))
          .put("fields", normalFields(currentSeries(job.occurrenceId)!!, row.getString("nominalSlot"))))
      }
    }
    for ((nominal, item) in target) {
      val source = rows[nominal] ?: throw CalendarFailure("INSTANCE_REQUIRES_REVIEW")
      if (source.optBoolean("cancelled")) throw CalendarFailure("REMOTE_DELETED")
      val resourceId = "instance:$nominal"
      db.calendarResources().put(CalendarResource(job.occurrenceId, resourceId, job.calendarId, source.getString("eventId"), segment,
        nominal, source.getString("etag"), source.getJSONObject("fields").toString(), "Available"))
      val remote = source.getJSONObject("fields"); val expected = item.getJSONObject("fields")
      val patch = CalendarLinkMapper.patch(remote, expected, false)
      if (patch.length() > 0) db.calendarResources().insert(CalendarResourceJob(job.operationId, resourceId, job.occurrenceId,
        job.calendarId, source.getString("eventId"), source.getString("etag"), expected.toString(), patch.toString(), remote = remote.toString()))
    }
  }
  /** Capture all child jobs and one immutable receipt before any I/O is dispatched. */
  fun captureBatch(command: Map<String, Any?>): Map<String, Any?> {
    val id = CalendarStore.string(command, "operationId")
    val items = command["items"] as? List<*> ?: throw CalendarFailure("INVALID_INPUT")
    if (items.isEmpty() || items.size > 500) throw CalendarFailure("IMPORT_LIMIT")
    val approved = items.map { item ->
      @Suppress("UNCHECKED_CAST") val value = item as? Map<String, Any?> ?: throw CalendarFailure("INVALID_INPUT")
      @Suppress("UNCHECKED_CAST") val choices = value["choices"] as? Map<String, Any?> ?: throw CalendarFailure("INVALID_INPUT")
      if (choices.keys.any { it !in setOf("mode", "title", "alarmAtMs", "listId", "disableReminders", "automaticSync") }) throw CalendarFailure("INVALID_INPUT")
      CalendarStore.string(value, "previewId") to choices
    }
    val key = CalendarMapper.hash(JSONArray(approved.map { (previewId, choices) ->
      JSONArray(listOf(previewId, JSONArray(listOf("mode", "title", "alarmAtMs", "listId", "disableReminders", "automaticSync").map {
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
          "disableReminders", "automaticSync" -> {
            if (value !is Boolean) throw CalendarFailure("INVALID_INPUT")
            options.put(field, value)
          }
        }
        if (options.getString("title").isBlank()) throw CalendarFailure("TITLE_REQUIRED")
        if (!JSONObject(p.remote).getJSONObject("schedule").has("recurrence") && options.getString("mode") != "None" && options.getLong("alarmAtMs") <= now()) throw CalendarFailure("ELAPSED_ALERT")
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
    CalendarManagedStore(db, now).guardOperation(job.operationId)
    sync.guard(job, beforeLocal = !job.localApplied, beforeSend = false)
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
      old?.baseline.orEmpty(), job.etag, if (old?.requiresReview == true) "Suspended" else "Linked", now(), "Local changes saved; checking Google outcome.", job.htmlLink,
      accountEmail = old?.accountEmail?.takeIf(String::isNotBlank) ?: connection().email,
      availability = "Available", observedAtMs = now(), lastCheckAttemptAtMs = now(),
      remoteDiffers = old?.baseline?.takeIf(String::isNotBlank)?.let { !CalendarLinkMapper.equal(JSONObject(job.remote), JSONObject(it)) } ?: false,
      requiresReview = old?.requiresReview ?: false))
    dao.update(job.copy(localApplied = true, localStatus = "Pending", state = "Waiting", message = "Local change committed; scheduling outcome pending.").localizedMessage())
    CalendarManagedStore(db, now).finishCandidate(id)
  }
  fun localStatus(id: String, status: String) { operation(id)?.let { dao.update(it.copy(localStatus = status)) } }
  fun permit(id: String, executionRevision: Long? = null): CalendarLinkOperation {
    val job = operation(id) ?: throw CalendarFailure("NOT_FOUND")
    check(job, executionRevision)
    sync.guard(job, beforeLocal = false, beforeSend = true)
    if (!job.localApplied) throw CalendarFailure("NOT_AVAILABLE")
    if (job.disableReminders && job.localStatus in setOf("Blocked", "Pending")) throw CalendarFailure("ALERT_BLOCKED")
    return job.copy(state = "Sending", remoteAttempted = true).also(dao::update)
  }
  fun acknowledgeMain(id: String, event: JSONObject) {
    val job = operation(id) ?: return
    val old = link(job.occurrenceId) ?: return
    if (job.erased || old.erased || old.state == "Detached" || old.requiresReview || !job.localApplied || job.patch.isBlank()) return
    if (record(job.occurrenceId)?.let { it.deleted || it.completed || it.skipped } != false) return
    val observed = CalendarLinkMapper.fields(event, record(job.occurrenceId)!!.zoneId)
    val desired = JSONObject(job.desired)
    val baseline = old.baseline.takeIf(String::isNotBlank)?.let(::JSONObject) ?: JSONObject()
    for (group in listOf("title", "notes")) if (CalendarLinkMapper.equal(desired.opt(group), observed.opt(group))) baseline.put(group, desired.get(group))
    if (resourceJobs(id).all { it.confirmed } && CalendarLinkMapper.equal(CalendarLinkMapper.mainFields(desired).get("schedule"), CalendarLinkMapper.mainFields(observed).get("schedule")))
      baseline.put("schedule", desired.get("schedule"))
    db.runInTransaction {
      dao.put(old.copy(baseline = baseline.toString(), etag = event.optString("etag")))
      dao.update(job.copy(mainConfirmed = true))
      sync.confirmedGroups(job, baseline, listOf("title", "notes"))
    }
  }
  fun complete(id: String, event: JSONObject) {
    val job = operation(id) ?: return
    if (job.state in setOf("Confirmed", "Cancelled") || job.erased) return
    val old = link(job.occurrenceId) ?: return
    if (old.erased) return
    if (event.optString("id") != job.eventId) { fail(id, "FOREIGN_IDENTITY"); return }
    val fields = agreementTarget(job)
    db.runInTransaction {
      dao.update(job.copy(state = "Confirmed", message = "Local changes confirmed. Google outcome confirmed.", remote = "", desired = "", draft = "", patch = "").localizedMessage())
      // A sent acknowledgement is truthful even after local removal; it cannot reactivate the link.
      val active = record(job.occurrenceId)?.let { !it.deleted && !it.completed && !it.skipped } == true
      if (old.state != "Detached" && active && job.patch.isNotBlank()) dao.put(old.copy(revision = old.revision + 1, baseline = fields.toString(), etag = event.optString("etag"),
        state = "Linked", availability = "Available", availabilityReason = "", requiresReview = false, remoteDiffers = false,
        observedAtMs = now(), lastCheckAttemptAtMs = now(), lastCheckErrorCode = "",
        checkedAtMs = now(), message = "Confirmed. Check for changes when needed.", htmlLink = event.optString("htmlLink")
          .takeIf { it.startsWith("https://calendar.google.com/") || it.startsWith("https://www.google.com/calendar/") }.orEmpty()).localizedMessage())
      sync.confirmed(job, fields, event.optString("updated"))
    }
  }
  fun fail(id: String, code: String, background: Boolean = false, writing: Boolean = false) {
    val job = operation(id) ?: return
    if (job.state in setOf("Confirmed", "Cancelled") || job.erased) return
    val state = when (code) {
      "AUTH", "NEEDS_ACCESS", "ACCOUNT_MISMATCH", "STALE_CONNECTION", "STALE_AUTHORIZATION" -> "NeedsAccess"
      "NETWORK", "RETRY", "NOT_AVAILABLE", "BUDGET", "STORAGE_ERROR", "UNCONFIRMED_WRITE", "UNCONFIRMED_RESOURCE", "RINGING_DEFERRED" -> "Unconfirmed"
      "ALERT_BLOCKED" -> "Blocked"
      "STALE_REMOTE", "STALE_PREVIEW", "INELIGIBLE", "REMOTE_REMOVED", "REMOTE_DELETED", "REMOTE_UNAVAILABLE", "NOT_FOUND" -> "Conflict"
      else -> "Failed"
    }
    val failed = job.copy(state = state, remoteAttempted = if (writing && !job.mainConfirmed && code in setOf("AUTH", "FORBIDDEN", "RETRY", "BAD_REQUEST", "STALE_REMOTE", "BUDGET", "NOT_AVAILABLE")) false else job.remoteAttempted,
      message = (if (job.localApplied) "Local changes saved. " else "Local change not applied. ") + when (state) {
      "NeedsAccess" -> "Authorize the original Google account and retry this operation."
      "Blocked" -> "Google reminders remain. Resolve Remilo alert readiness, then retry explicitly."
      "Conflict" -> "The reminder or Google event changed. Review again; no replacement event is created."
      "Unconfirmed" -> if (job.localApplied && job.kind == "ImportCalendarEvent" && job.disableReminders)
        "Imported; Google reminder change unconfirmed. Retry the same operation."
        else "Google outcome unconfirmed. Retry the same operation."
      else -> "Request could not be completed. Correct the issue and review again."
    }).localizedMessage()
    dao.update(failed)
    sync.failed(failed, code, background)
  }
  fun guard(id: String): CalendarObservationGuard {
    val link = link(id) ?: throw CalendarFailure("NOT_FOUND")
    val record = record(id) ?: throw CalendarFailure("NOT_FOUND")
    if (link.erased) throw CalendarFailure("INELIGIBLE")
    return CalendarObservationGuard(id, link.remoteKey, link.revision, record.revision, connection().revision)
  }
  private fun guarded(guard: CalendarObservationGuard): CalendarLink {
    val old = link(guard.id) ?: throw CalendarFailure("NOT_FOUND")
    if (old.erased || record(guard.id) == null) throw CalendarFailure("INELIGIBLE")
    if (old.remoteKey != guard.remoteKey || old.revision != guard.linkRevision || record(guard.id)!!.revision != guard.recordRevision)
      throw CalendarFailure("STALE_PREVIEW")
    if (connection().revision != guard.connectionRevision) throw CalendarFailure("STALE_CONNECTION")
    return old
  }
  fun observe(guard: CalendarObservationGuard, calendar: OwnedCalendar?, lookup: CalendarEventLookup, background: Boolean = false): Map<String, Any?> {
    val old = guarded(guard)
    if (!connection().connected || connection().subject != old.subject) throw CalendarFailure("STALE_CONNECTION")
    val event = (lookup as? CalendarEventLookup.Found)?.event
    val code = when {
      lookup == CalendarEventLookup.Deleted -> "REMOTE_DELETED"
      lookup == CalendarEventLookup.Missing -> "NOT_FOUND"
      event?.optString("id") != old.eventId -> "FOREIGN_IDENTITY"
      event!!.optString("status") == "cancelled" -> "REMOTE_DELETED"
      old.origin == "Published" && !CalendarMapper.matching(event, old.eventId) -> "FOREIGN_IDENTITY"
      else -> CalendarLinkMapper.reason(event, calendar!!.zoneId)
    }
    val availability = when (code) { null -> "Available"; "REMOTE_DELETED" -> "Deleted"; "NOT_FOUND", "FOREIGN_IDENTITY" -> "Unavailable"; else -> "Unsupported" }
    return saveObservation(old, availability, code.orEmpty(), event?.takeIf { availability == "Available" }?.let { CalendarLinkMapper.fields(it, calendar!!.zoneId) }, background)
  }
  private fun saveObservation(old: CalendarLink, availability: String, reason: String, fields: JSONObject? = null, background: Boolean = false): Map<String, Any?> {
    val suspended = availability != "Available"
    val fence = suspended && old.state != "Detached" && !old.requiresReview
    db.runInTransaction {
      dao.put(old.copy(accountEmail = old.accountEmail.ifBlank { connection().takeIf { it.subject == old.subject }?.email.orEmpty() },
        availability = availability, availabilityReason = reason, observedAtMs = now(), lastCheckAttemptAtMs = now(), checkedAtMs = now(), lastCheckErrorCode = "",
        remoteDiffers = fields?.let { old.baseline.takeIf(String::isNotBlank)?.let { baseline -> !CalendarLinkMapper.equal(it, JSONObject(baseline)) } },
        requiresReview = old.requiresReview || suspended, revision = old.revision + if (fence) 1 else 0,
        state = if (old.state == "Detached") "Detached" else if (old.requiresReview || suspended) "Suspended" else "Linked",
        message = if (suspended) "Calendar updates suspended. Your Remilo reminder is unchanged." else "Checked. Changes require review.").localizedMessage())
      if (suspended && old.state != "Detached") fenceOperations(old.occurrenceId, "Calendar event unavailable. No further writes from this operation.")
      if (suspended && old.state != "Detached") sync.issue(old.occurrenceId, reason, background, "Paused")
    }
    return view(link(old.occurrenceId)!!)
  }
  private fun fenceOperations(id: String, message: String) {
    dao.operations().filter { it.occurrenceId == id && it.state !in terminal }.forEach {
      dao.update(it.copy(state = if (it.remoteAttempted) it.state else "Cancelled", patch = "", draft = "", message = message).localizedMessage())
    }
  }
  fun observedFailure(id: String, code: String, guard: CalendarObservationGuard? = null, background: Boolean = false): Map<String, Any?>? {
    val old = if (guard == null) link(id)?.takeUnless { it.erased } ?: return null else guarded(guard)
    val safe = if (code in observationCodes) code else "API_ERROR"
    if (safe in setOf("NOT_FOUND", "REMOTE_UNAVAILABLE", "NOT_OWNER", "FORBIDDEN", "FOREIGN_IDENTITY"))
      return saveObservation(old, "Unavailable", safe, background = background)
    if (safe == "REMOTE_DELETED") return saveObservation(old, "Deleted", safe, background = background)
    dao.put(old.copy(lastCheckAttemptAtMs = now(), checkedAtMs = now(), lastCheckErrorCode = safe,
      state = if (old.state == "Detached") "Detached" else if (safe in setOf("AUTH", "NEEDS_ACCESS", "ACCOUNT_MISMATCH")) "NeedsAccess" else old.state,
      message = "The latest check could not finish. Your Remilo reminder is unchanged.").localizedMessage())
    return view(link(id)!!)
  }
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
      if (old.erased) throw CalendarFailure("INELIGIBLE")
      dao.put(old.copy(revision = old.revision + 1, state = "Detached", message = "Unlinked. Your reminder is kept; Google Calendar was not changed.").localizedMessage())
      dao.operations().filter { it.occurrenceId == id && it.state !in terminal }.forEach {
        dao.update(it.copy(state = if (it.remoteAttempted) it.state else "Cancelled", patch = "", draft = "",
          message = if (it.remoteAttempted) "Unlinked. Retry only checks the previously sent outcome; no further writes." else "Unsent changes cancelled by unlink.").localizedMessage())
      }
      db.records().receipt(CreationReceipt(op, id, "CalendarUnlink", key))
      sync.fenced(id, false, "Unlinked")
      CalendarManagedStore(db, now).suppress(old.remoteKey, "Unlinked", id)
      CalendarManagedStore(db, now).retireIntent(id, "Unlinked")
      sync.activity(op + ":unlink", id, "Unlinked", "")
    }
    return mapOf("unlinked" to true)
  }
  fun removed(id: String, purge: Boolean) {
    CalendarManagedStore(db, now).removed(id, purge)
    retireInstanceNotice(id)
    if (purge) db.records().find(id)?.segmentId?.let { segmentId ->
      val family = db.records().series(segmentId)?.seriesId
      dao.links().filter { currentSeries(it.occurrenceId)?.seriesId == family }.forEach { parent ->
        // A family operation can contain private instance payloads. Erase the whole captured payload;
        // keep only already-confirmed Title/Notes agreement and rebuild the allowlisted remote cache.
        val baseline = parent.baseline.takeIf(String::isNotBlank)?.let(::JSONObject) ?: JSONObject()
        baseline.remove("schedule")
        dao.put(parent.copy(revision = parent.revision + 1, baseline = baseline.toString()))
        dao.operations().filter { it.occurrenceId == parent.occurrenceId }.forEach { dao.update(it.copy(erased = true, remote = "", desired = "", draft = "", patch = "")) }
        db.calendarResources().clearFields(parent.occurrenceId); db.calendarResources().erase(parent.occurrenceId)
        sync.purgedInstance(parent.occurrenceId, parent.calendarId)
        previews.entries.removeAll { it.value.second.occurrenceId == parent.occurrenceId }
      }
    }
    sync.fenced(id, purge, "LocalRemoved")
    if (purge) { db.calendarResources().purge(id); db.calendarResources().erase(id) }
    link(id)?.let { dao.put(it.copy(revision = it.revision + 1, state = if (it.state == "Detached") "Detached" else "Suspended",
      baseline = if (purge) "" else it.baseline, calendarName = if (purge) "" else it.calendarName,
      htmlLink = if (purge) "" else it.htmlLink, etag = if (purge) "" else it.etag,
      accountEmail = if (purge) "" else it.accountEmail, availability = if (purge) "Unknown" else it.availability,
      availabilityReason = if (purge) "" else it.availabilityReason, observedAtMs = if (purge) null else it.observedAtMs,
      lastCheckAttemptAtMs = if (purge) null else it.lastCheckAttemptAtMs, lastCheckErrorCode = if (purge) "" else it.lastCheckErrorCode,
      checkedAtMs = if (purge) null else it.checkedAtMs, remoteDiffers = if (purge) null else it.remoteDiffers, requiresReview = true,
      erased = purge || it.erased, message = "Local reminder removed. Google Calendar was not changed.").localizedMessage()) }
    dao.operations().filter { it.occurrenceId == id }.forEach {
      dao.update(it.copy(erased = purge || it.erased, remote = if (purge) "" else it.remote,
        desired = if (purge) "" else it.desired, draft = "", patch = "",
        calendarName = if (purge) "" else it.calendarName, htmlLink = if (purge) "" else it.htmlLink,
        state = if (!it.remoteAttempted && it.state !in terminal) "Cancelled" else it.state,
        message = "Local reminder removed. No further Calendar writes.").localizedMessage())
    }
  }
  fun terminal(id: String) {
    CalendarManagedStore(db, now).terminal(id)
    retireInstanceNotice(id)
    sync.fenced(id, false, "LocalTerminal")
    link(id)?.takeUnless { it.erased }?.let { dao.put(it.copy(revision = it.revision + 1,
      requiresReview = true, state = if (it.state == "Detached") "Detached" else "Suspended")) }
    fenceOperations(id, "Local work is terminal. Only a previously sent outcome may be checked; no further writes.")
  }
  private fun retireInstanceNotice(id: String) {
    val segment = db.records().find(id)?.segmentId ?: return
    val family = db.records().series(segment)?.seriesId ?: return
    dao.links().filter { currentSeries(it.occurrenceId)?.seriesId == family && it.availabilityReason == "INSTANCE_CANCELLED" }.forEach { old ->
      val cancelled = resources(old.occurrenceId).filter { it.availability == "Deleted" && it.nominalSlot.isNotEmpty() }
      if (cancelled.any { source -> db.records().all().any { it.segmentId == source.segmentId && it.nominalSlot == source.nominalSlot && !it.completed && !it.deleted && !it.skipped } }) return@forEach
      dao.put(old.copy(revision = old.revision + 1, state = "Linked", requiresReview = false, availabilityReason = ""))
      sync.retireInstanceIssue(old.occurrenceId)
    }
  }
  fun restored(id: String) {
    val family = db.records().find(id)?.segmentId?.let { db.records().series(it)?.seriesId }
    dao.links().filter { it.occurrenceId == id || family != null && currentSeries(it.occurrenceId)?.seriesId == family }.forEach { old ->
      if (old.erased || old.state == "Detached") return@forEach
      dao.put(old.copy(revision = old.revision + 1, state = "Suspended", requiresReview = true))
      fenceOperations(old.occurrenceId, "Restored local work needs fresh Calendar review.")
      sync.fenced(old.occurrenceId, false, "ReviewRequired"); sync.issue(old.occurrenceId, "ReviewRequired", false, "Paused")
    }
  }
  fun accessChanged(reason: String) {
    dao.operations().filter { it.state !in terminal && !it.remoteAttempted && !it.localApplied && sync.state(it.occurrenceId).mode == "Pending" }.forEach {
      dao.update(it.copy(state = "Cancelled", patch = "", draft = "", message = "Access changed before activation. Review the event again.").localizedMessage())
      sync.fenced(it.occurrenceId, false, "AccessRequired")
    }
    dao.links().filter { !it.erased && it.state != "Detached" }.forEach { old ->
      dao.put(old.copy(revision = old.revision + 1, state = "Suspended", requiresReview = true))
      fenceOperations(old.occurrenceId, "Google access changed. Fresh review is required before writes resume.")
      sync.fenced(old.occurrenceId, false, "AccessRequired")
      sync.issue(old.occurrenceId, reason, false, "Paused")
    }
  }
  companion object {
    val terminal = setOf("Confirmed", "Cancelled", "Conflict", "Failed")
    private val observationCodes = setOf("AUTH", "NEEDS_ACCESS", "ACCOUNT_MISMATCH", "NETWORK", "RETRY", "NOT_AVAILABLE", "STORAGE_ERROR", "NOT_FOUND", "REMOTE_DELETED", "REMOTE_UNAVAILABLE", "NOT_OWNER", "FORBIDDEN", "FOREIGN_IDENTITY", "API_ERROR")
  }
}

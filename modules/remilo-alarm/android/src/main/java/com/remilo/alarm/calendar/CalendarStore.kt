package com.remilo.alarm.calendar

import com.remilo.alarm.data.ContentDatabase
import com.remilo.alarm.data.CreationReceipt
import com.remilo.alarm.data.ReminderRecord
import org.json.JSONObject
import java.time.ZoneId
import com.remilo.alarm.data.*
import org.json.JSONArray
import java.util.UUID

/** Called exclusively by AlarmEngine's serialized worker. Contains no network or Activity APIs. */
class CalendarStore(private val db: ContentDatabase, private val now: () -> Long,
  private val deviceZone: () -> String = { ZoneId.systemDefault().id }) {
  private val dao = db.calendar()
  val links = CalendarLinkStore(db, now)
  val sync = CalendarSyncStore(db, now, links)
  val incremental = CalendarIncrementalStore(db, now, links)
  val managed = CalendarManagedStore(db, now)
  internal fun database() = db
  fun snapshots(id: String) = db.sync().snapshots(id)
  fun captureManagedImport(candidate: CalendarManagedCandidate, operationId: String, previewId: String, automatic: Boolean = true): Map<String, Any?> =
    db.runInTransaction<Map<String, Any?>> {
      managed.captureImport(candidate.candidateId, operationId, candidate.revision, automatic)
      links.capture(mapOf("kind" to "ImportCalendarEvent", "operationId" to operationId, "previewId" to previewId, "automaticSync" to true), candidate.localId)
    }
  fun captureManagedCommand(command: Map<String, Any?>): Map<String, Any?> {
    val id = string(command, "operationId")
    return when (command["kind"]) {
      "ConfirmManagedCalendarSetup" -> db.runInTransaction<Map<String, Any?>> {
        managed.capturedReceipt(command)?.let { return@runInTransaction it }
        val result = managed.captureSetup(command)
        val job = managed.setupOperation(id)!!
        val items = JSONArray(job.reviewedItems)
        for (index in 0 until items.length()) {
          val item = items.getJSONObject(index)
          if (item.optString("kind") != "Adopt") continue
          val child = UUID.nameUUIDFromBytes("$id:${item.getString("itemId")}".toByteArray(Charsets.UTF_8)).toString()
          links.capture(mapOf("kind" to "EnableCalendarLink", "operationId" to child, "previewId" to item.getString("linkPreviewId"),
            "selections" to CalendarLinkMapper.map(item.getJSONObject("selections")), "automaticSync" to true))
        }
        result
      }
      "ApplyManagedCalendarPolicy" -> managed.applyPolicy(command)
      "PauseManagedCalendar" -> managed.pause(command)
      "DisableManagedCalendar" -> managed.disable(command)
      "SetCalendarReminderDisposition" -> managed.setDisposition(command)
      "IgnoreManagedCalendarCandidate" -> managed.ignoreCandidate(command)
      "ResumeManagedCalendar" -> db.runInTransaction<Map<String, Any?>> {
        val oldReceipt = managed.dao.receipt(id)
        if (oldReceipt != null) return@runInTransaction managed.resume(command)
        val preview = managed.reviewed(string(command, "previewId"), "Resume")
        val payload = JSONObject(preview.payload); val selected = command["selectedItemIds"] as? List<*> ?: emptyList<String>()
        val items = payload.getJSONArray("items")
        for (index in 0 until items.length()) {
          val item = items.getJSONObject(index)
          if (item.optString("itemId") !in selected) continue
          if (item.has("localRevision") && links.record(item.getString("occurrenceId"))?.revision != item.getLong("localRevision")) throw CalendarFailure("STALE_PREVIEW")
          if (item.has("linkRevision") && links.link(item.getString("occurrenceId"))?.revision != item.getLong("linkRevision")) throw CalendarFailure("STALE_PREVIEW")
          if (item.has("candidateRevision") && managed.candidate(item.getString("candidateId"))?.revision != item.getLong("candidateRevision")) throw CalendarFailure("STALE_PREVIEW")
        }
        val result = managed.resume(command)
        val operations = mutableListOf<String>()
        for (index in 0 until items.length()) {
          val item = items.getJSONObject(index)
          if (item.optString("itemId") !in selected || item.optString("kind") !in setOf("Transfer", "Import")) continue
          val child = UUID.nameUUIDFromBytes("$id:${item.getString("itemId")}".toByteArray(Charsets.UTF_8)).toString()
          if (item.optString("kind") == "Import") {
            val candidate = managed.candidate(item.getString("candidateId")) ?: throw CalendarFailure("STALE_PREVIEW")
            captureManagedImport(candidate, child, item.getString("linkPreviewId"))
          } else links.capture(mapOf("kind" to "EnableAutomaticCalendarSync", "operationId" to child, "previewId" to item.getString("linkPreviewId"),
            "selections" to CalendarLinkMapper.map(item.getJSONObject("selections"))))
          operations.add(child)
        }
        val merged = result + mapOf("operations" to operations)
        managed.dao.receipt(id)?.let { managed.dao.replaceReceipt(it.copy(result = JSONObject(merged).toString())) }
        merged
      }
      "ImportManagedCalendarCandidate" -> db.runInTransaction<Map<String, Any?>> {
        managed.capturedReceipt(command)?.let { return@runInTransaction it }
        val preview = managed.reviewed(string(command, "previewId"), "Candidate")
        val payload = JSONObject(preview.payload)
        val candidate = managed.candidate(payload.getString("candidateId")) ?: throw CalendarFailure("NOT_FOUND")
        if (candidate.revision != payload.getLong("candidateRevision")) throw CalendarFailure("STALE_PREVIEW")
        val adoption = payload.optString("adoptionId").takeUnless { it == "null" }.orEmpty()
        val result = if (adoption.isBlank()) captureManagedImport(candidate, id, payload.getString("linkPreviewId"), automatic = false)
          else {
            @Suppress("UNCHECKED_CAST") val selections = command["selections"] as? Map<String, String?>
              ?: CalendarLinkMapper.map(payload.getJSONObject("selections")).mapValues { it.value as? String }
            if (selections.values.any { it == null }) throw CalendarFailure("RESOLUTION_REQUIRED")
            managed.captureImport(candidate.candidateId, id, candidate.revision, automatic = false)
            links.capture(mapOf("kind" to "EnableCalendarLink", "operationId" to id, "previewId" to payload.getString("linkPreviewId"), "selections" to selections, "automaticSync" to true))
          }
        managed.recordReceipt(command, result)
      }
      "RetryManagedCalendarOperation" -> managed.setupOperation(id)?.let { mapOf("captured" to true, "operationId" to id, "phase" to it.phase) }
        ?: operation(id)?.let { view(it) } ?: throw CalendarFailure("NOT_FOUND")
      else -> throw CalendarFailure("INVALID_INPUT")
    }
  }
  fun releaseManagedSetupChildren(operationId: String) {
    val job = managed.setupOperation(operationId) ?: return
    val binding = managed.binding()
    if (job.phase != "Confirmed" || !managed.active() || binding.operationId != operationId ||
      binding.subject != job.subject || binding.calendarId != job.resultCalendarId || binding.authEpoch != job.authEpoch) return
    val items = JSONArray(job.reviewedItems)
    for (index in 0 until items.length()) {
      val item = items.getJSONObject(index); val id = item.optString("occurrenceId")
      if (item.optString("kind") != "Publish" || id.isBlank() || managed.intent(id) != null) continue
      val reviewed = item.optJSONObject("publicationPreview") ?: continue
      val current = runCatching { preview(id, OwnedCalendar(job.resultCalendarId, job.calendarName, job.calendarZone)) }.getOrNull()
      if (current == null || current["fingerprint"] != reviewed.optString("fingerprint") || current["reminderRevision"] != reviewed.optLong("reminderRevision"))
        managed.issue("Export", id, "STALE_PREVIEW", false)
      else managed.authored(id, links.record(id)?.revision ?: 0, "Managed")
    }
  }
  fun completeManagedSetup(operationId: String, calendar: OwnedCalendar) = db.runInTransaction {
    managed.acknowledgeCalendar(operationId, calendar)
    managed.completeSetup(operationId)
    releaseManagedSetupChildren(operationId)
  }
  fun refreshManagedCalendar(calendar: OwnedCalendar) {
    val saved = managed.binding()
    if (saved.subject != connection().subject || saved.calendarId != calendar.id) return
    CalendarManagedDiscovery.requireEligible(calendar, connection().email)
    managed.dao.binding(saved.copy(calendarName = calendar.name, calendarZone = calendar.zoneId))
  }
  fun managedAdoptionId(event: JSONObject, subject: String, calendarId: String): String? {
    val eventId = event.optString("id")
    if (!CalendarMapper.matching(event, eventId)) return null
    val ids = db.records().all().filter { it.segmentId == null }.map { it.id } + db.records().series().flatMap { listOf(it.id, it.seriesId) }
    return ids.distinct().firstOrNull { CalendarMapper.eventId(subject, calendarId, it) == eventId }
  }
  /** Exact publication identities only. Content similarity never turns a backup into an overwrite. */
  fun backupCollisions(originalIds: Collection<String>): Map<String, List<String>> {
    val requested = originalIds.toSet()
    if (requested.isEmpty()) return emptyMap()
    val retained = (db.records().all().map { it.id } + db.records().series().map { it.id }).toSet()
    val proofs = managed.dao.candidates().filter { candidate -> candidate.state == "Imported" &&
      candidate.policySnapshot.takeIf(String::isNotBlank)?.let { runCatching { JSONObject(it).optBoolean("publicationMarker") }.getOrDefault(false) } == true }
      .associateBy { it.remoteKey }
    val identities = mutableMapOf<Pair<String, String>, MutableMap<String, MutableSet<String>>>()
    db.links().links().filter { !it.erased && it.occurrenceId in retained }.forEach { link ->
      val proof = proofs[link.remoteKey]
      if (link.origin != "Published" && (proof == null || proof.localId != link.occurrenceId || proof.subject != link.subject ||
        proof.calendarId != link.calendarId || proof.eventId != link.eventId)) return@forEach
      val resources = identities.getOrPut(link.subject to link.calendarId) { mutableMapOf() }
      resources.getOrPut(link.eventId) { mutableSetOf() }.add(link.occurrenceId)
      if (link.origin == "Published") links.resources(link.occurrenceId).filter { it.nominalSlot.isEmpty() && it.eventId.isNotBlank() }
        .forEach { resource -> identities.getOrPut(link.subject to resource.calendarId) { mutableMapOf() }
          .getOrPut(resource.eventId) { mutableSetOf() }.add(link.occurrenceId) }
    }
    val matches = mutableMapOf<String, MutableSet<String>>()
    identities.forEach { (source, events) -> requested.forEach { id ->
      events[CalendarMapper.eventId(source.first, source.second, id)]?.let { targets -> matches.getOrPut(id) { mutableSetOf() }.addAll(targets) }
    } }
    return matches.mapValues { (_, targets) -> targets.sorted() }
  }
  fun captureManagedPublication(localId: String, operationId: String, calendar: OwnedCalendar): CalendarOperation {
    val intent = managed.intent(localId) ?: throw CalendarFailure("NOT_FOUND")
    if (intent.calendarId != calendar.id || intent.subject != connection().subject) throw CalendarFailure("STALE_AUTHORIZATION")
    CalendarManagedDiscovery.requireEligible(calendar, connection().email)
    val ready = preview(localId, calendar)
    if (ready["allDay"] == true && ready["zoneId"] != calendar.zoneId) throw CalendarFailure("INCOMPATIBLE_ZONES")
    return db.runInTransaction<CalendarOperation> {
      capture(mapOf("operationId" to operationId, "occurrenceId" to localId, "expectedRevision" to ready["reminderRevision"],
        "expectedConnectionRevision" to ready["connectionRevision"], "fingerprint" to ready["fingerprint"]), calendar)
      managed.publicationCaptured(localId, operationId)
      operation(operationId)!!
    }
  }
  fun supersedeManagedPublication(operationId: String): Boolean {
    val job = operation(operationId) ?: return false
    if (managed.intent(job.occurrenceId)?.operationId != operationId || job.attempted || publicationJobs(operationId).any { it.attempted }) return false
    val record = publicationRecord(job.occurrenceId) ?: return false
    if (publicationFingerprint(job.occurrenceId, record, record.zoneId.ifEmpty { job.zoneId }) == job.fingerprint) return false
    db.runInTransaction {
      dao.update(job.copy(state = "Cancelled", payload = "", message = "Unsent publication superseded by a newer local edit.").localizedMessage())
      dao.unbind(job.occurrenceId); db.calendarResources().purge(job.occurrenceId); db.calendarResources().erase(job.occurrenceId)
      managed.intent(job.occurrenceId)?.let { managed.dao.export(it.copy(state = "Pending", operationId = "", localRevision = record.revision)) }
    }
    return true
  }
  fun completeManagedPublication(operationId: String, event: JSONObject) {
    val job = operation(operationId) ?: return
    if (job.state != "Published" || publicationJobs(operationId).any { !it.confirmed }) return
    managed.guardPublication(operationId)
    val record = links.record(job.occurrenceId) ?: throw CalendarFailure("NOT_FOUND")
    if (record.deleted || record.completed || record.skipped) throw CalendarFailure("INELIGIBLE")
    if (!CalendarMapper.matching(event, job.eventId)) throw CalendarFailure("FOREIGN_IDENTITY")
    val resources = db.calendarResources().resources(job.occurrenceId)
    val fields = resources.firstOrNull { it.resourceId == "master" }?.fields?.takeIf(String::isNotBlank)?.let(::JSONObject)
      ?: throw CalendarFailure("UNCONFIRMED_RESOURCE")
    val children = publicationJobs(operationId)
    if (fields.getJSONObject("schedule").has("recurrence")) {
      fun exceptions(segment: String): JSONArray = JSONArray(resources.filter { it.segmentId == segment && it.nominalSlot.isNotEmpty() }.mapNotNull { resource ->
        children.firstOrNull { it.resourceId == "z:slot:$segment:${resource.nominalSlot}" && it.associationId == job.occurrenceId }?.let {
          JSONObject().put("nominalSlot", resource.nominalSlot).put("fields", JSONObject(it.desired))
        }
      })
      val master = resources.firstOrNull { it.resourceId == "master" }
      fields.getJSONObject("schedule").put("exceptions", exceptions(master?.segmentId ?: job.occurrenceId))
      val segments = children.filter { it.resourceId.startsWith("a:segment:") }.map { child -> JSONObject(child.desired).also {
        it.getJSONObject("schedule").put("exceptions", exceptions(child.resourceId.removePrefix("a:segment:"))).put("segments", JSONArray())
      } }.sortedBy { it.getJSONObject("schedule").getLong("eventStartMs") }
      fields.getJSONObject("schedule").put("segments", JSONArray(segments))
    }
    val key = CalendarLinkMapper.key(job.subject, job.calendarId, job.eventId)
    db.runInTransaction {
      if (links.link(job.occurrenceId) != null) throw CalendarFailure("ALREADY_IMPORTED")
      db.links().put(CalendarLink(job.occurrenceId, key, job.subject, job.calendarId, job.eventId, job.calendarName, "Published",
        baseline = fields.toString(), etag = event.getString("etag"), checkedAtMs = now(), htmlLink = job.htmlLink,
        accountEmail = connection().email, availability = "Available", observedAtMs = now(), remoteDiffers = false))
      val dirty = !CalendarLinkMapper.equal(links.fields(job.occurrenceId), fields)
      db.sync().put(CalendarSyncState(job.occurrenceId, mode = "Automatic", activationRevision = 1, baselineVersion = 1,
        dirtyRevision = if (dirty) record.revision else 0, successfulAtMs = now(), attemptedAtMs = now(),
        remoteUpdated = event.optString("updated"), status = if (dirty) "UpdatePending" else "Confirmed"))
      managed.publicationConfirmed(operationId)
      sync.activity(operationId + ":managed-publication", job.occurrenceId, "Activated", "")
    }
  }
  init {
    dao.operations().filter { it.state == "Publishing" }.forEach {
      dao.update(it.copy(state = "Unconfirmed", message = "Publication was interrupted. Retry the same publication to confirm it.").localizedMessage())
    }
  }
  fun connection() = dao.connection() ?: CalendarConnection()
  fun connectionView(): Map<String, Any> = connection().let { mapOf("revision" to it.revision,
    "connected" to it.connected, "email" to it.email, "calendarId" to it.calendarId,
    "calendarName" to it.calendarName, "message" to com.remilo.alarm.presentation.L10n.stored(it.messageKey, it.messageArgs, it.message)) }
  fun operation(id: String) = dao.operation(id)
  fun authorizationEmail(id: String?): String? {
    if (id == null) return null // Connect/change-account explicitly opens account selection.
    val job = operation(id)
    if (job == null) {
      managed.setupOperation(id)?.let { return connection().takeIf { current -> current.subject == it.subject }?.email?.takeIf(String::isNotBlank) }
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
      "message" to com.remilo.alarm.presentation.L10n.stored(job.messageKey, job.messageArgs, job.message), "htmlLink" to job.htmlLink, "publishedAtMs" to job.publishedAtMs,
      "differs" to differs, "readOnly" to (job.readOnly || record == null || record.completed || record.deleted || record.skipped))
  }
  fun connect(account: CalendarAccount, expectedRevision: Long) {
    require(account.subject.isNotBlank() && account.email.isNotBlank())
    val old = connection()
    if (old.revision != expectedRevision) throw CalendarFailure("STALE_CONNECTION")
    if (old.subject.isNotEmpty() && (old.subject != account.subject || !old.connected)) links.accessChanged("ACCOUNT_MISMATCH")
    if (old.subject.isNotEmpty() && (old.subject != account.subject || !old.connected)) managed.accessChanged("ACCOUNT_MISMATCH")
    dao.connection(old.copy(revision = old.revision + 1, connected = true, subject = account.subject,
      email = account.email, calendarId = if (old.subject == account.subject) old.calendarId else "",
      calendarName = if (old.subject == account.subject) old.calendarName else "",
      calendarZone = if (old.subject == account.subject) old.calendarZone else "",
      message = if (old.subject == account.subject && old.calendarId.isNotBlank()) "Ready to publish. Each task needs your confirmation."
        else "Google account connected. Review Calendar setup to continue.").localizedMessage())
    managed.accessReviewed(account.subject)
  }
  fun connectionMessage(message: String, expectedRevision: Long) {
    val old = connection()
    if (old.revision == expectedRevision) dao.connection(old.copy(message = message).localizedMessage())
  }
  fun select(operationId: String, expected: Long, subject: String, calendar: OwnedCalendar): Map<String, Any> {
    val key = org.json.JSONArray(listOf(expected, calendar.id)).toString()
    receipt(operationId, "CalendarSelect", key)?.let { return connectionView() }
    val old = connection()
    if (!old.connected || old.subject != subject || old.revision != expected) throw CalendarFailure("STALE_CONNECTION")
    if (calendar.accessRole != "owner") throw CalendarFailure("NOT_OWNER")
    db.runInTransaction {
      dao.connection(old.copy(revision = old.revision + 1, calendarId = calendar.id,
        calendarName = calendar.name, calendarZone = calendar.zoneId, message = "Calendar selected. Nothing was published.").localizedMessage())
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
      managed.accessChanged("NEEDS_ACCESS")
      dao.connection(old.copy(revision = old.revision + 1, connected = false,
        message = "Disconnected locally. Previously published events remain. Revoking Google access…").localizedMessage())
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
  fun preview(id: String, destination: OwnedCalendar? = null): Map<String, Any> {
    val record = publicationRecord(id) ?: throw CalendarFailure("NOT_FOUND")
    if (record.deleted || record.completed || record.skipped || record.segmentId != null) throw CalendarFailure("INELIGIBLE")
    if (dao.binding(id) != null) throw CalendarFailure("ALREADY_PUBLISHED")
    if (links.link(id) != null) throw CalendarFailure("ALREADY_IMPORTED")
    val connection = connection()
    if (!connection.connected || destination == null && connection.calendarId.isBlank()) throw CalendarFailure("NEEDS_CONNECTION")
    val zone = record.zoneId.ifEmpty(deviceZone)
    CalendarMapper.fields(record, zone) // Reject incompatible dates before committing any job.
    val segment = links.currentSeries(id)
    val recurrence = segment?.let { CalendarRecurrence.encode(com.remilo.alarm.data.RuleCodec.decode(it.rule).copy(zoneId = zone)) }
    return mapOf("occurrenceId" to id, "reminderRevision" to record.revision,
      "connectionRevision" to connection.revision, "fingerprint" to publicationFingerprint(id, record, zone),
      "zoneId" to zone, "pinsZone" to (record.zoneId.isBlank() || links.segments(id).any { RuleCodec.decode(it.rule).zoneId == null }), "title" to record.title, "notes" to record.notes,
      "eventStartMs" to record.eventStartMs, "eventEndMs" to record.eventEndMs, "allDay" to record.allDay,
      "email" to connection.email, "calendarName" to (destination?.name ?: connection.calendarName), "recurrence" to (recurrence?.let { (0 until it.length()).map(it::getString) } ?: emptyList<String>()))
  }
  fun capture(command: Map<String, Any?>, destination: OwnedCalendar? = null): Map<String, Any?> {
    val op = string(command, "operationId"); val id = string(command, "occurrenceId")
    val expected = number(command, "expectedRevision"); val connectionRevision = number(command, "expectedConnectionRevision")
    val fingerprint = string(command, "fingerprint")
    val key = org.json.JSONArray(listOf(id, expected, connectionRevision, fingerprint)).toString()
    dao.operation(op)?.let { if (it.requestKey != key) throw CalendarFailure("OPERATION_REUSED"); return view(it) }
    if (db.records().receipt(op) != null) throw CalendarFailure("OPERATION_REUSED")
    val preview = preview(id, destination)
    if (preview["reminderRevision"] != expected || preview["connectionRevision"] != connectionRevision ||
      preview["fingerprint"] != fingerprint) throw CalendarFailure("STALE_PREVIEW")
    val connection = connection(); val record = publicationRecord(id)!!; val zone = preview["zoneId"] as String
    val calendarId = destination?.id ?: connection.calendarId
    val calendarName = destination?.name ?: connection.calendarName
    val eventId = CalendarMapper.eventId(connection.subject, calendarId, id)
    val payload = org.json.JSONObject(CalendarMapper.payload(record, zone, eventId))
    val segments = publicationSegments(id, zone)
    segments.firstOrNull()?.let { payload.put("recurrence", CalendarRecurrence.encode(RuleCodec.decode(it.rule))) }
    val job = CalendarOperation(op, id, key, expected, connectionRevision, connection.subject, connection.email,
      calendarId, calendarName, zone, eventId, fingerprint, payload.toString())
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
        val master = CalendarSeriesMapping.master(connection.subject, calendarId, segment)
        val masterId = if (index == 0) eventId else master.eventId
        db.calendarResources().put(CalendarResource(id, if (index == 0) "master" else "segment:${segment.id}", calendarId, masterId, segment.id))
        if (index > 0) {
          val desired = CalendarLinkMapper.mainFields(links.segmentFields(segment))
          db.calendarResources().insert(CalendarResourceJob(op, "a:segment:${segment.id}", id, calendarId,
            masterId, "", desired.toString(), master.payload.toString(), insert = true))
        }
        val exceptions = links.segmentFields(segment).getJSONObject("schedule").getJSONArray("exceptions")
        for (i in 0 until exceptions.length()) {
          val exception = exceptions.getJSONObject(i); val nominal = exception.getString("nominalSlot")
          val rule = RuleCodec.decode(segment.rule)
          val original = if (rule.allDay) java.time.LocalDateTime.parse(nominal).toLocalDate().toString() else
            java.time.LocalDateTime.parse(nominal).atZone(ZoneId.of(rule.zoneId)).toInstant().toString()
          val keyPart = "z:slot:${segment.id}:$nominal"
          db.calendarResources().put(CalendarResource(id, keyPart, calendarId, "", segment.id, nominal))
          db.calendarResources().insert(CalendarResourceJob(op, keyPart, id, calendarId, "", "",
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
    val next = job.copy(state = "Publishing", message = "Confirming the captured Calendar publication…").localizedMessage()
    dao.update(next); return next
  }
  /** Last worker check before POST; deleting/purging/disconnecting can stop an unsent write. */
  fun permitInsert(id: String): CalendarOperation? {
    val job = dao.operation(id) ?: return null
    val connection = connection()
    val record = publicationRecord(job.occurrenceId)
    managed.guardPublication(id)
    if (job.state != "Publishing" || job.readOnly || !connection.connected || connection.subject != job.subject ||
      record == null || record.deleted || record.completed || record.skipped) return null
    return job.copy(attempted = true).also(dao::update)
  }
  fun confirm(id: String, event: JSONObject) {
    val job = dao.operation(id) ?: return
    if (job.state == "Published") return
    if (!CalendarMapper.matching(event, job.eventId) || event.optString("status") == "cancelled") {
      dao.update(job.copy(state = "Conflict", message = "The Calendar identity conflicts or was removed in Google. No event was overwritten.").localizedMessage()); return
    }
    val erased = job.readOnly && job.zoneId.isBlank()
    if (!erased && managed.intent(job.occurrenceId)?.operationId == id) {
      val existing = db.calendarResources().resources(job.occurrenceId).firstOrNull { it.resourceId == "master" }
      db.calendarResources().put((existing ?: CalendarResource(job.occurrenceId, "master", job.calendarId, job.eventId, "")).copy(
        etag = event.optString("etag"), fields = CalendarLinkMapper.fields(event, job.zoneId).toString(), availability = "Available"))
    }
    val link = if (erased) "" else event.optString("htmlLink").takeIf { it.startsWith("https://calendar.google.com/") || it.startsWith("https://www.google.com/calendar/") }.orEmpty()
    dao.update(job.copy(state = "Published", payload = "", message = "Published copy confirmed. Later edits are not synchronized.",
      htmlLink = link, etag = if (erased) "" else event.optString("etag"), publishedAtMs = now()).localizedMessage())
  }
  fun publicationJobs(id: String) = db.calendarResources().jobs(id)
  fun permitResource(captured: CalendarResourceJob): CalendarResourceJob? {
    managed.guardPublication(captured.operationId)
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
    dao.update(job.copy(state = state, message = message).localizedMessage())
  }
  fun removed(id: String, purge: Boolean) {
    if (purge) CalendarSyncRequests(db, now).purge(id)
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
          else "Local reminder removed. A previously sent Calendar copy remains; recovery only checks its identity.").localizedMessage())
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

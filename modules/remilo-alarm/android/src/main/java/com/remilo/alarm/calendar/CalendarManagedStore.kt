package com.remilo.alarm.calendar

import com.remilo.alarm.data.ContentDatabase
import org.json.JSONArray
import org.json.JSONObject
import java.time.ZoneId
import java.util.UUID

/** All methods run on the serialized engine worker. No authorization or network calls occur here. */
class CalendarManagedStore(private val db: ContentDatabase, private val now: () -> Long) {
  val dao get() = db.managedCalendar()
  fun installation() = dao.installation() ?: CalendarInstallationOrigin(installationId = "")
  fun binding() = dao.binding() ?: CalendarManagedBinding()
  fun policy() = dao.policy() ?: CalendarManagedPolicy()
  private fun connection() = db.calendar().connection() ?: CalendarConnection()
  fun policyView(value: CalendarManagedPolicy = policy()): Map<String, Any> = mapOf("revision" to value.revision,
    "automaticImport" to value.automaticImport, "exportNewReminders" to value.exportNewReminders,
    "importMode" to value.importMode, "allDayAlarmMinutes" to value.allDayAlarmMinutes,
    "disableGoogleReminders" to value.disableGoogleReminders)
  fun view(): Map<String, Any?> {
    val saved = binding()
    val linkedIds = db.links().links().filter { it.subject == saved.subject && it.calendarId == saved.calendarId }.map { it.occurrenceId }.toSet()
    val states = db.sync().states().filter { it.associationId in linkedIds }
    return mapOf("revision" to saved.revision, "authEpoch" to saved.authEpoch, "mode" to saved.mode,
      "phase" to saved.phase, "subject" to saved.subject, "calendarId" to saved.calendarId,
      "calendarName" to saved.calendarName, "calendarZone" to saved.calendarZone, "policy" to policyView(),
      "initialMode" to saved.initialMode, "bootstrapGeneration" to saved.bootstrapGeneration,
      "initialRecoveryComplete" to saved.initialRecoveryComplete, "lastObservedAtMs" to saved.lastObservedAtMs,
      "successfulAtMs" to states.mapNotNull { it.successfulAtMs }.maxOrNull(), "attemptedAtMs" to saved.attemptedAtMs, "failedAtMs" to saved.failedAtMs,
      "pendingChangeCount" to states.count { it.status == "UpdatePending" || it.dirtyRevision > 0 },
      "recoveryCount" to dao.candidates().count { it.state == "Imported" && it.subject == saved.subject && it.calendarId == saved.calendarId &&
        runCatching { JSONObject(it.policySnapshot).optBoolean("initialRecovery") && CalendarLinkStore(db, now, recoverInterrupted = false).record(it.localId)?.mode == "None" }.getOrDefault(false) },
      "operationId" to saved.operationId, "message" to com.remilo.alarm.presentation.L10n.stored(saved.messageKey, saved.messageArgs, saved.message),
      "progress" to CalendarStatusStore(db, now).progress(), "problem" to CalendarStatusStore(db, now).problem(),
      "candidateCount" to dao.candidates().count { it.subject == saved.subject && it.calendarId == saved.calendarId && it.state in setOf("Pending", "Review", "Captured", "Held") },
      "pendingExportCount" to dao.exports().count { it.subject == saved.subject && it.calendarId == saved.calendarId && it.state in setOf("Pending", "Captured") },
      "heldExportCount" to dao.exports().count { it.subject == saved.subject && it.calendarId == saved.calendarId && it.state == "Held" }, "reviewCount" to dao.issues().size)
  }
  fun attempted() { dao.binding(binding().copy(attemptedAtMs = now())) }
  fun failedAttempt() { dao.binding(binding().copy(failedAtMs = now())) }
  fun enabledCalendarIds(): List<String> = binding().takeIf { active(it) }?.calendarId?.takeIf(String::isNotBlank)?.let(::listOf) ?: emptyList()
  fun active(value: CalendarManagedBinding = binding()): Boolean {
    val connected = connection()
    return value.mode == "Enabled" && value.phase in setOf("InitialImport", "Ready") && value.calendarId.isNotBlank() &&
      connected.connected && connected.subject == value.subject
  }
  fun permitsCalendar(subject: String, calendarId: String): Boolean = active() && binding().subject == subject && binding().calendarId == calendarId
  fun setupOperation(id: String) = dao.operation(id)
  fun operationActive(id: String): Boolean {
    val job = setupOperation(id) ?: return false
    val saved = binding(); val connected = connection()
    return connected.connected && connected.subject == job.subject && connected.revision == job.connectionRevision &&
      (if (job.kind == "Discovery") saved.revision == job.bindingRevision else saved.operationId == job.operationId) &&
      saved.authEpoch == job.authEpoch && job.phase !in setOf("Confirmed", "Cancelled", "Fenced")
  }
  private fun requireOperation(id: String): CalendarManagedSetupOperation {
    val job = setupOperation(id) ?: throw CalendarFailure("NOT_FOUND")
    if (!operationActive(id)) throw CalendarFailure("STALE_AUTHORIZATION")
    return job
  }
  fun beginDiscovery(operationId: String, connectionRevision: Long, zone: String, marker: String): CalendarManagedSetupOperation {
    requireUuid(operationId)
    setupOperation(operationId)?.let {
      if (it.kind != "Discovery" || it.connectionRevision != connectionRevision || it.calendarZone != zone || it.marker != marker) throw CalendarFailure("OPERATION_REUSED")
      return it
    }
    ensureOperationUnused(operationId)
    val connected = connection(); val saved = binding()
    if (!connected.connected || connected.revision != connectionRevision) throw CalendarFailure("STALE_CONNECTION")
    if (zone !in ZoneId.getAvailableZoneIds()) throw CalendarFailure("INVALID_ZONE")
    val job = CalendarManagedSetupOperation(operationId, "discovery:$connectionRevision", "Discovery", connected.subject,
      connectionRevision, saved.revision, saved.authEpoch, JSONObject(policyView()).toString(), "", "Remilo", zone, marker, createdAtMs = now())
    dao.insert(job); return job
  }
  fun discoveryPage(id: String, page: CalendarPage): CalendarManagedSetupOperation {
    val job = requireOperation(id)
    val rows = JSONArray(job.candidates)
    val known = (0 until rows.length()).map { rows.getJSONObject(it).getString("id") }.toMutableSet()
    page.items.forEach { calendar -> if (known.add(calendar.id)) rows.put(calendar.managedJson()) }
    val updated = job.copy(candidates = rows.toString(), discoveryCursor = page.nextCursor.orEmpty(), discoveryComplete = page.nextCursor == null)
    dao.update(updated); return updated
  }
  /** Native discovery may enrich descriptors without exposing mutable network payloads to JavaScript. */
  fun discoveryPage(id: String, candidates: JSONArray, nextCursor: String?): CalendarManagedSetupOperation {
    val job = requireOperation(id); val rows = JSONArray(job.candidates)
    val known = (0 until rows.length()).map { rows.getJSONObject(it).getString("id") }.toMutableSet()
    for (i in 0 until candidates.length()) { val row = candidates.getJSONObject(i); if (known.add(row.getString("id"))) rows.put(JSONObject(row.toString())) }
    return job.copy(candidates = rows.toString(), discoveryCursor = nextCursor.orEmpty(), discoveryComplete = nextCursor == null).also(dao::update)
  }
  fun previewSetup(choices: Map<String, Any?>, candidates: JSONArray, complete: Boolean, selectedCalendarId: String? = null,
    createCalendar: Boolean = false, items: JSONArray = JSONArray(), warnings: JSONArray = JSONArray()): Map<String, Any?> {
    val connected = connection()
    if (!connected.connected) throw CalendarFailure("NEEDS_ACCESS")
    val proposed = parsePolicy(choices["policy"] as? Map<String, Any?> ?: emptyMap())
    val selection = selectedCalendarId ?: (choices["selectedCalendarId"] as? String)
    if (selection != null && !(0 until candidates.length()).any { candidates.getJSONObject(it).optString("id") == selection }) throw CalendarFailure("STALE_PREVIEW")
    val saved = binding()
    val payload = JSONObject().put("policy", JSONObject(policyView(proposed))).put("calendarCandidates", candidates)
      .put("selectedCalendarId", selection.orEmpty()).put("createCalendar", createCalendar).put("complete", complete)
      .put("initialMode", if (!createCalendar && installation().origin != "ExistingInstallation" && !saved.initialRecoveryComplete) "None" else proposed.importMode)
      .put("initialRecovery", !createCalendar && installation().origin != "ExistingInstallation" && !saved.initialRecoveryComplete)
      .put("calendarName", "Remilo").put("calendarZone", choices["calendarZone"] as? String ?: ZoneId.systemDefault().id)
      .put("items", items).put("warnings", warnings)
    return preview("Setup", payload)
  }
  fun previewResume(items: JSONArray = JSONArray(), warnings: JSONArray = JSONArray()): Map<String, Any?> {
    val saved = binding()
    if (saved.calendarId.isBlank() || saved.mode == "Enabled" && saved.phase in setOf("InitialImport", "Ready")) throw CalendarFailure("INELIGIBLE")
    val reviewedItems = if (items.length() > 0) items else JSONArray(dao.exports().filter { it.state == "Held" && it.subject == saved.subject && it.calendarId == saved.calendarId }.map {
      JSONObject().put("itemId", "export:${it.localId}").put("kind", "Publish").put("occurrenceId", it.localId)
        .put("title", db.records().find(it.localId)?.title ?: "Reminder").put("ready", true)
    })
    return preview("Resume", JSONObject().put("items", reviewedItems).put("warnings", warnings).put("complete", true).put("policy", JSONObject(policyView())))
  }
  fun previewPolicyChange(choices: Map<String, Any?>): Map<String, Any?> {
    if (choices["expectedRevision"] != null && number(choices, "expectedRevision") != policy().revision) throw CalendarFailure("STALE_PREVIEW")
    val proposed = parsePolicy(choices["policy"] as? Map<String, Any?> ?: choices)
    return preview("Policy", JSONObject().put("policy", JSONObject(policyView(proposed))).put("items", JSONArray()).put("warnings", JSONArray()).put("complete", true))
  }
  fun preview(kind: String, payload: JSONObject): Map<String, Any?> {
    val connected = connection(); val saved = binding()
    if (!connected.connected) throw CalendarFailure("NEEDS_ACCESS")
    if (!payload.has("policy")) payload.put("policy", JSONObject(policyView()))
    if (!payload.has("initialMode")) payload.put("initialMode", saved.initialMode)
    if (!payload.has("calendarCandidates")) payload.put("calendarCandidates", JSONArray())
    if (!payload.has("selectedCalendarId")) payload.put("selectedCalendarId", saved.calendarId)
    if (!payload.has("createCalendar")) payload.put("createCalendar", false)
    if (!payload.has("items")) payload.put("items", JSONArray())
    if (!payload.has("warnings")) payload.put("warnings", JSONArray())
    if (!payload.has("complete")) payload.put("complete", true)
    dao.expirePreviews(now())
    val value = CalendarManagedPreview(UUID.randomUUID().toString(), kind, connected.revision, saved.revision, saved.authEpoch,
      CalendarMapper.hash(payload.toString()), payload.toString(), now(), now() + 600_000)
    dao.preview(value); return previewView(value)
  }
  fun previewView(value: CalendarManagedPreview): Map<String, Any?> = CalendarLinkMapper.map(JSONObject(value.payload)) + mapOf(
    "previewId" to value.previewId, "kind" to value.kind, "expectedRevision" to value.bindingRevision,
    "expectedConnectionRevision" to value.connectionRevision, "expiresAtMs" to value.expiresAtMs)
  fun reviewed(previewId: String, kind: String): CalendarManagedPreview {
    val value = dao.preview(previewId) ?: throw CalendarFailure("STALE_PREVIEW")
    val connected = connection(); val saved = binding()
    if (value.kind != kind || value.expiresAtMs < now() || connected.revision != value.connectionRevision || !connected.connected ||
      saved.revision != value.bindingRevision || saved.authEpoch != value.authEpoch) throw CalendarFailure("STALE_PREVIEW")
    return value
  }
  private fun requestKey(command: Map<String, Any?>): String {
    val immutable = JSONObject(command).also { it.remove("operationId") }
    if (command.containsKey("selectedItemIds")) immutable.put("selectedItemIds",
      JSONArray((command["selectedItemIds"] as? List<*>)?.map { it.toString() }?.sorted() ?: emptyList<String>()))
    return canonical(immutable).toString()
  }
  private fun receipt(command: Map<String, Any?>): Map<String, Any?>? {
    val id = CalendarStore.string(command, "operationId"); requireUuid(id)
    val existing = dao.receipt(id) ?: run { ensureOperationUnused(id); return null }
    if (existing.requestKey != requestKey(command) || existing.kind != command["kind"]) throw CalendarFailure("OPERATION_REUSED")
    return CalendarLinkMapper.map(JSONObject(existing.result))
  }
  /** Composite captures use the same immutable request identity as the individual managed commands. */
  fun capturedReceipt(command: Map<String, Any?>): Map<String, Any?>? = receipt(command)
  fun recordReceipt(command: Map<String, Any?>, result: Map<String, Any?>): Map<String, Any?> = acknowledge(command, result)
  private fun acknowledge(command: Map<String, Any?>, result: Map<String, Any?>): Map<String, Any?> {
    val id = CalendarStore.string(command, "operationId")
    val selected = (command["selectedItemIds"] as? List<*>)?.map(Any?::toString)?.toSet() ?: emptySet()
    val preview = (command["previewId"] as? String)?.let(dao::preview)?.let { JSONObject(it.payload).optJSONArray("items") } ?: JSONArray()
    val refs = JSONArray()
    for (index in 0 until preview.length()) {
      val item = preview.getJSONObject(index)
      if (item.optString("itemId") in selected) refs.put(JSONObject().put("kind", item.optString("kind"))
        .put("localId", item.optString("occurrenceId")).put("candidateId", item.optString("candidateId")))
    }
    val serialized = JSONObject(result).put("selectionRefs", refs).put("scopeEpoch", binding().authEpoch).toString()
    dao.receipt(CalendarManagedReceipt(id, CalendarStore.string(command, "kind"), requestKey(command), serialized))
    return CalendarLinkMapper.map(JSONObject(serialized))
  }
  fun captureSetup(command: Map<String, Any?>): Map<String, Any?> {
    receipt(command)?.let { return it }
    val op = CalendarStore.string(command, "operationId")
    val reviewed = reviewed(CalendarStore.string(command, "previewId"), "Setup")
    val payload = JSONObject(reviewed.payload)
    if (!payload.optBoolean("complete")) throw CalendarFailure("DISCOVERY_INCOMPLETE")
    val selected = payload.optString("selectedCalendarId").takeUnless { it == "null" }.orEmpty()
    val supplied = command["selectedCalendarId"] as? String
    if (supplied != null && supplied != selected) throw CalendarFailure("STALE_PREVIEW")
    val create = payload.getBoolean("createCalendar")
    if (create == selected.isNotBlank()) throw CalendarFailure("SELECTION_REQUIRED")
    validateSelection(payload, command)
    val selectedItems = (command["selectedItemIds"] as? List<*>)?.map { it.toString() }?.toSet() ?: emptySet()
    val items = payload.optJSONArray("items") ?: JSONArray()
    val reviewedItems = JSONArray((0 until items.length()).map(items::getJSONObject).filter { it.optString("itemId") in selectedItems })
    val connected = connection(); val saved = binding(); val next = saved.copy(revision = saved.revision + 1,
      authEpoch = saved.authEpoch + 1, subject = connected.subject, mode = "Disabled", phase = "PreparingCalendar", operationId = op,
      initialMode = if (create) payload.getJSONObject("policy").getString("importMode") else payload.getString("initialMode"), message = "Calendar setup is captured.").localizedMessage()
    val proposed = policyFromJson(payload.getJSONObject("policy")).copy(revision = policy().revision + 1)
    val calendars = payload.getJSONArray("calendarCandidates")
    val calendar = (0 until calendars.length()).map(calendars::getJSONObject).firstOrNull { it.optString("id") == selected }
    val zone = calendar?.optString("zoneId")?.takeIf(String::isNotBlank) ?: payload.getString("calendarZone")
    if (zone !in ZoneId.getAvailableZoneIds()) throw CalendarFailure("INVALID_ZONE")
    val job = CalendarManagedSetupOperation(op, requestKey(command), if (create) "Create" else "Select", connected.subject,
      connected.revision, next.revision, next.authEpoch, JSONObject(policyView(proposed))
        .put("initialRecovery", !create && payload.optBoolean("initialRecovery")).toString(), selected,
      calendar?.optString("name") ?: "Remilo", zone, CalendarManagedDiscovery.marker(op),
      phase = "PreparingCalendar", createdAtMs = now(), reviewedItems = reviewedItems.toString())
    return db.runInTransaction<Map<String, Any?>> {
      ensureOperationUnused(op)
      if (saved.calendarId.isNotBlank() && (saved.subject != connected.subject || saved.calendarId != selected)) fencePreviousScope(saved)
      else if (saved.calendarId.isNotBlank()) fenceAssociations(saved, "ManagedSetupReview")
      dao.binding(next); dao.policy(proposed); dao.insert(job)
      acknowledge(command, mapOf("captured" to true, "operationId" to op, "phase" to next.phase))
    }
  }
  private fun fencePreviousScope(previous: CalendarManagedBinding) {
    db.links().links().filter { it.subject == previous.subject && it.calendarId == previous.calendarId && !it.erased && it.state != "Detached" }.forEach { link ->
      db.links().put(link.copy(revision = link.revision + 1, state = "Suspended", requiresReview = true,
        message = "The managed Calendar source changed. Fresh review is required.").localizedMessage())
      db.sync().state(link.occurrenceId)?.let { state -> db.sync().put(state.copy(activationRevision = state.activationRevision + 1,
        status = "Paused", pauseReason = "ReviewRequired")) }
      db.links().operations().filter { it.occurrenceId == link.occurrenceId && it.state !in CalendarLinkStore.terminal }.forEach { operation ->
        db.links().update(operation.copy(patch = if (operation.remoteAttempted) operation.patch else "",
          draft = if (operation.remoteAttempted) operation.draft else "", state = if (operation.remoteAttempted) operation.state else "Cancelled",
          message = "The managed source changed. Only a previously sent outcome may be checked.").localizedMessage())
      }
    }
    dao.exports().filter { it.subject == previous.subject && it.calendarId == previous.calendarId && it.state !in setOf("Confirmed", "Cancelled") }
      .forEach { dao.export(it.copy(state = "Held", reason = "SourceChanged")) }
  }
  fun permitCreate(id: String): CalendarManagedSetupOperation? {
    val job = requireOperation(id)
    if (job.kind != "Create" || !job.discoveryComplete || job.attempted) return null
    return job.copy(attempted = true, phase = "PreparingCalendar").also(dao::update)
  }
  fun resetDiscovery(id: String): CalendarManagedSetupOperation {
    val job = requireOperation(id)
    if (!job.discoveryComplete) return job
    return job.copy(discoveryCursor = "", candidates = "[]", discoveryComplete = false).also(dao::update)
  }
  fun rememberCreated(id: String, calendarId: String) {
    val job = requireOperation(id)
    if (calendarId.isBlank() || !job.attempted || job.kind != "Create") throw CalendarFailure("INVALID_INPUT")
    dao.update(job.copy(resultCalendarId = calendarId))
  }
  fun creationRejected(id: String) {
    val job = requireOperation(id)
    if (job.resultCalendarId.isNotEmpty()) throw CalendarFailure("CREATION_UNCONFIRMED")
    dao.update(job.copy(attempted = false))
  }
  /** A same-account foreground consent result can refresh access without granting a new feature scope. */
  fun reauthorize(id: String, expectedConnectionRevision: Long, newConnectionRevision: Long): CalendarManagedSetupOperation {
    val job = setupOperation(id) ?: throw CalendarFailure("NOT_FOUND")
    val connected = connection(); val saved = binding()
    if (job.connectionRevision != expectedConnectionRevision || connected.revision != newConnectionRevision || !connected.connected ||
      connected.subject != job.subject || saved.subject != job.subject ||
      (if (job.kind == "Discovery") saved.revision != job.bindingRevision else saved.operationId != job.operationId) || saved.authEpoch != job.authEpoch ||
      job.phase in setOf("Fenced", "Cancelled", "Confirmed")) throw CalendarFailure("STALE_AUTHORIZATION")
    val phase = if (job.kind == "Discovery") "Reviewing" else if (job.attempted) "CreationUnconfirmed" else "PreparingCalendar"
    val next = job.copy(connectionRevision = newConnectionRevision, phase = phase, message = "").localizedMessage()
    db.runInTransaction { dao.update(next); if (job.kind != "Discovery") dao.binding(saved.copy(phase = phase, message = "").localizedMessage()) }
    return next
  }
  fun acknowledgeCalendar(id: String, calendar: OwnedCalendar): CalendarManagedSetupOperation {
    val job = requireOperation(id)
    if (job.kind == "Discovery") throw CalendarFailure("INELIGIBLE")
    CalendarManagedDiscovery.requireEligible(calendar, connection().email)
    if (job.kind == "Select" && calendar.id != job.calendarId) throw CalendarFailure("FOREIGN_IDENTITY")
    return job.copy(resultCalendarId = calendar.id, calendarName = calendar.name, calendarZone = calendar.zoneId, phase = "CalendarReady").also(dao::update)
  }
  fun completeSetup(id: String): Map<String, Any?> {
    val existing = setupOperation(id) ?: throw CalendarFailure("NOT_FOUND")
    if (existing.phase == "Confirmed") return view()
    val job = requireOperation(id)
    if (job.resultCalendarId.isBlank() || job.phase != "CalendarReady") throw CalendarFailure("UNCONFIRMED_CALENDAR")
    db.runInTransaction {
      val saved = binding()
      val key = CalendarLinkMapper.key(job.subject, job.resultCalendarId, "sync-query-v1")
      val previousCursor = db.sync().cursor(key)
      val generation = (previousCursor?.generation ?: 0) + 1
      // An association-only P4-D cache cannot prove that the managed collection was inspected.
      db.sync().cursor(CalendarSyncCursor(key, job.subject, job.resultCalendarId, generation = generation))
      dao.clearCache(job.subject, job.resultCalendarId)
      dao.binding(saved.copy(mode = "Enabled", phase = "InitialImport", calendarId = job.resultCalendarId,
        calendarName = job.calendarName, calendarZone = job.calendarZone, bootstrapGeneration = generation,
        initialMode = if (job.kind == "Create") JSONObject(job.policy).getString("importMode") else saved.initialMode,
        initialRecoveryComplete = false, message = "Importing ongoing and upcoming events.").localizedMessage())
      dao.update(job.copy(phase = "Confirmed")); dao.resolve("setup")
    }
    return view()
  }
  fun setupFailed(id: String, code: String) {
    val job = setupOperation(id) ?: return
    if (!operationActive(id)) return
    val phase = when (code) { "NEEDS_ACCESS", "AUTH" -> "AccessRequired"; "NOT_OWNER", "OWNERSHIP_UNKNOWN" -> "OwnershipUnknown"
      "CALENDAR_SELECTION_REQUIRED", "STALE_PREVIEW" -> "Reviewing"; "CREATION_UNCONFIRMED" -> "CreationUnconfirmed"
      "REMOTE_DELETED", "REMOTE_UNAVAILABLE" -> "CalendarUnavailable"; else -> if (job.attempted) "CreationUnconfirmed" else "PreparingCalendar" }
    db.runInTransaction {
      val retry = code in setOf("NETWORK", "RETRY", "NOT_AVAILABLE", "BUDGET", "CREATION_UNCONFIRMED")
      dao.update(job.copy(phase = phase, message = code, failures = if (retry) job.failures + 1 else job.failures,
        retryAtMs = if (retry) now() + minOf(3_600_000L, 60_000L * (1L shl minOf(job.failures, 6))) else 0).localizedMessage())
      if (job.kind != "Discovery") {
        dao.binding(binding().copy(phase = phase, message = "Calendar setup needs review.", failedAtMs = now()).localizedMessage())
        if (phase != "PreparingCalendar") issue("Setup", id, code, false)
      }
    }
  }
  fun initialComplete(generation: Long) {
    val saved = binding()
    if (!active(saved) || generation != saved.bootstrapGeneration) throw CalendarFailure("STALE_AUTHORIZATION")
    dao.binding(saved.copy(phase = "Ready", initialRecoveryComplete = true, lastObservedAtMs = now(), message = "").localizedMessage())
  }
  fun pause(command: Map<String, Any?>): Map<String, Any?> = changeMode(command, "Paused")
  fun disable(command: Map<String, Any?>): Map<String, Any?> = changeMode(command, "Disabled")
  private fun changeMode(command: Map<String, Any?>, mode: String): Map<String, Any?> {
    receipt(command)?.let { return it }
    val saved = binding()
    if (number(command, "expectedRevision") != saved.revision) throw CalendarFailure("STALE_PREVIEW")
    return db.runInTransaction<Map<String, Any?>> {
      val next = saved.copy(revision = saved.revision + 1, authEpoch = saved.authEpoch + 1, mode = mode,
        message = if (mode == "Paused") "Automatic Calendar work is paused." else "Managed Calendar sync is disabled.").localizedMessage()
      dao.binding(next); fenceHeld(next, mode); dao.clearPreviews()
      acknowledge(command, mapOf("captured" to true, "revision" to next.revision, "mode" to mode))
    }
  }
  private fun fenceHeld(next: CalendarManagedBinding, mode: String) {
    dao.exports().filter { it.subject == next.subject && it.calendarId == next.calendarId && it.state in setOf("Pending", "Held", "Captured", "Review") }.forEach { dao.export(it.copy(
      state = if (mode == "Paused") "Held" else "Cancelled", authEpoch = next.authEpoch, reason = mode)) }
    dao.candidates().filter { it.subject == next.subject && it.calendarId == next.calendarId && it.state in setOf("Pending", "Held", "Captured") }.forEach {
      dao.candidate(it.copy(state = if (mode == "Paused") "Held" else "Review", reason = mode,
        revision = if (it.operationId.isBlank()) it.revision + 1 else it.revision))
    }
    fenceAssociations(next, if (mode == "Paused") "ManagedPaused" else "ManagedDisabled")
    dao.operations().filter { it.phase !in setOf("Confirmed", "Cancelled", "Fenced") }.forEach { dao.update(it.copy(phase = "Fenced")) }
  }
  private fun fenceAssociations(scope: CalendarManagedBinding, reason: String) {
    db.links().links().filter { it.subject == scope.subject && it.calendarId == scope.calendarId }.forEach { link ->
      val state = db.sync().state(link.occurrenceId) ?: return@forEach
      if (state.mode == "Manual") return@forEach
      val operation = state.operationId.takeIf(String::isNotBlank)?.let { db.links().operation(it) }
      if (operation != null && !operation.remoteAttempted && !operation.localApplied)
        db.links().update(operation.copy(state = "Cancelled", patch = "", draft = ""))
      val unresolved = state.status in setOf("Review", "Unconfirmed")
      db.sync().put(state.copy(activationRevision = state.activationRevision + 1,
        status = if (unresolved) state.status else "Paused", pauseReason = if (unresolved) state.pauseReason else reason,
        operationId = if (operation == null || !operation.remoteAttempted && !operation.localApplied) "" else state.operationId))
    }
  }
  fun resume(command: Map<String, Any?>): Map<String, Any?> {
    receipt(command)?.let { return it }
    val value = reviewed(CalendarStore.string(command, "previewId"), "Resume"); val payload = JSONObject(value.payload)
    validateSelection(payload, command)
    val saved = binding()
    if (saved.calendarId.isBlank()) throw CalendarFailure("INELIGIBLE")
    return db.runInTransaction<Map<String, Any?>> {
      val next = saved.copy(revision = saved.revision + 1, authEpoch = saved.authEpoch + 1, mode = "Enabled",
        phase = if (saved.initialRecoveryComplete) "Ready" else "InitialImport", message = "").localizedMessage()
      dao.binding(next)
      val selected = (command["selectedItemIds"] as? List<*>)?.map(Any?::toString)?.toSet() ?: emptySet()
      val items = payload.optJSONArray("items") ?: JSONArray()
      val selectedLocal = (0 until items.length()).map(items::getJSONObject).filter { it.optString("itemId") in selected }
        .map { it.optString("occurrenceId") }.toSet()
      dao.exports().filter { it.state == "Held" && it.subject == next.subject && it.calendarId == next.calendarId && it.localId in selectedLocal }
        .forEach { intent ->
          val job = intent.operationId.takeIf(String::isNotBlank)?.let { db.calendar().operation(it) }
          val sent = job?.attempted == true || intent.operationId.isNotEmpty() && db.calendarResources().jobs(intent.operationId).any { it.attempted }
          dao.export(intent.copy(state = if (job != null) "Captured" else "Pending", authEpoch = next.authEpoch,
            operationId = if (job != null || sent) intent.operationId else "", reason = "", retryAtMs = 0))
        }
      dao.candidates().filter { it.subject == next.subject && it.calendarId == next.calendarId && it.state in setOf("Held", "Pending", "Review", "Captured") }
        .forEach { candidate ->
          if ("candidate:${candidate.candidateId}" in selected) dao.candidate(candidate.copy(
            state = if (candidate.operationId.isBlank()) "Pending" else "Captured", authEpoch = next.authEpoch, reason = "", retryAtMs = 0))
          else if (candidate.state != "Review") dao.candidate(candidate.copy(state = "Held"))
        }
      db.links().links().filter { it.subject == next.subject && it.calendarId == next.calendarId }.forEach { link ->
        val state = db.sync().state(link.occurrenceId) ?: return@forEach
        if ("association:${link.occurrenceId}" !in selected || state.mode != "Automatic") return@forEach
        if (link.erased || link.state != "Linked" || link.requiresReview || state.status in setOf("Review", "Unconfirmed")) throw CalendarFailure("STALE_PREVIEW")
        val previous = state.operationId.takeIf(String::isNotBlank)?.let { db.links().operation(it) }
        if (previous != null && previous.remoteAttempted && (!previous.mainConfirmed || db.calendarResources().jobs(previous.operationId).any { it.attempted && !it.confirmed })) throw CalendarFailure("STALE_PREVIEW")
        if (previous != null) db.links().update(previous.copy(state = "Cancelled", patch = "", draft = ""))
        db.sync().put(state.copy(activationRevision = state.activationRevision + 1, status = "UpdatePending", pauseReason = "", operationId = "", retryAtMs = 0))
      }
      dao.resolve("setup")
      acknowledge(command, mapOf("captured" to true, "revision" to next.revision, "mode" to next.mode))
    }
  }
  fun applyPolicy(command: Map<String, Any?>): Map<String, Any?> {
    receipt(command)?.let { return it }
    val payload = JSONObject(reviewed(CalendarStore.string(command, "previewId"), "Policy").payload)
    val proposed = policyFromJson(payload.getJSONObject("policy"))
    return db.runInTransaction<Map<String, Any?>> {
      val previousPolicy = policy()
      val next = binding().copy(revision = binding().revision + 1)
      val updatedPolicy = proposed.copy(revision = previousPolicy.revision + 1)
      dao.binding(next); dao.policy(updatedPolicy); dao.clearPreviews()
      dao.candidates().filter { it.state in setOf("Pending", "Review", "Held") && it.operationId.isBlank() &&
        it.subject == next.subject && it.calendarId == next.calendarId &&
        !runCatching { JSONObject(it.policySnapshot).optBoolean("initialCohort") }.getOrDefault(false) }.forEach { candidate ->
        dao.candidate(candidate.copy(mode = updatedPolicy.importMode, revision = candidate.revision + 1, policyRevision = updatedPolicy.revision,
          policySnapshot = JSONObject(policyView(updatedPolicy)).put("initialCohort", false).put("initialRecovery", false).toString()))
      }
      dao.candidates().filter { it.subject == next.subject && it.calendarId == next.calendarId && it.operationId.isBlank() }.forEach { candidate ->
        if (!updatedPolicy.automaticImport && candidate.state == "Pending") dao.candidate(candidate.copy(state = "Held", reason = "ImportDisabled"))
        else if (updatedPolicy.automaticImport && candidate.state == "Held" && candidate.reason == "ImportDisabled") dao.candidate(candidate.copy(state = "Pending", reason = ""))
      }
      if (!previousPolicy.automaticImport && updatedPolicy.automaticImport && next.calendarId.isNotBlank()) {
        val key = CalendarLinkMapper.key(next.subject, next.calendarId, "sync-query-v1")
        val oldCursor = db.sync().cursor(key)
        db.sync().cursor(CalendarSyncCursor(key, next.subject, next.calendarId, generation = (oldCursor?.generation ?: 0) + 1))
        dao.clearCache(next.subject, next.calendarId)
      }
      acknowledge(command, mapOf("captured" to true, "revision" to next.revision, "policy" to policyView()))
    }
  }
  fun accessChanged(reason: String) {
    val saved = binding()
    if (saved.subject.isEmpty()) return
    val next = saved.copy(revision = saved.revision + 1, authEpoch = saved.authEpoch + 1,
      phase = when (reason) { "NOT_OWNER", "OWNERSHIP_UNKNOWN" -> "OwnershipUnknown"
        "NOT_FOUND", "REMOTE_UNAVAILABLE", "REMOTE_DELETED" -> "CalendarUnavailable"; else -> "AccessRequired" }, message = "Calendar access needs review.").localizedMessage()
    db.runInTransaction {
      dao.binding(next); dao.clearPreviews(); fenceHeld(next, "Paused")
      issue("Setup", saved.operationId.ifEmpty { "connection" }, reason, false)
    }
  }
  /** Confirming account access never restores transfer permission; a bound scope returns to review. */
  fun accessReviewed(subject: String) {
    val saved = binding()
    if (saved.subject == subject && saved.calendarId.isNotBlank() && saved.phase == "AccessRequired")
      dao.binding(saved.copy(phase = "Reviewing", message = "Review current Calendar work before resuming.").localizedMessage())
  }
  fun cachePage(subject: String, calendarId: String, generation: Long, events: JSONArray) {
    if (!permitsCalendar(subject, calendarId)) throw CalendarFailure("STALE_AUTHORIZATION")
    db.runInTransaction { for (index in 0 until events.length()) {
      val event = events.getJSONObject(index); val id = event.optString("id")
      if (id.isNotBlank() && !suppressed(CalendarLinkMapper.key(subject, calendarId, id)) && !purgedInstance(event, subject, calendarId)) dao.cache(CalendarManagedCache(subject, calendarId, id, generation,
        retainedEvent(event, binding().calendarZone).toString(), now()))
    }; dao.binding(binding().copy(lastObservedAtMs = now())) }
  }
  fun page(cursor: CalendarSyncCursor, events: JSONArray, calendar: OwnedCalendar, background: Boolean) {
    if (!permitsCalendar(cursor.subject, cursor.calendarId)) return
    CalendarManagedDiscovery.requireEligible(calendar, connection().email)
    if (calendar.id != cursor.calendarId) throw CalendarFailure("FOREIGN_IDENTITY")
    if (!policy().automaticImport) return
    val retained = JSONArray()
    for (index in 0 until events.length()) {
      val event = events.getJSONObject(index); val eventId = event.optString("id")
      if (eventId.isBlank()) continue
      val key = CalendarLinkMapper.key(cursor.subject, cursor.calendarId, eventId)
      if (suppressed(key)) continue
      val parent = event.optString("recurringEventId")
      if (parent.isNotEmpty()) {
        val parentKey = CalendarLinkMapper.key(cursor.subject, cursor.calendarId, parent)
        if (!suppressed(parentKey) && !purgedInstance(event, cursor.subject, cursor.calendarId) && futureException(event, calendar.zoneId)) retained.put(event)
        continue
      }
      if (CalendarLinkStore(db, now, recoverInterrupted = false).source(key) != null) {
        retainPublicationProof(key, event)
        continue
      }
      if (event.optString("status") == "cancelled") {
        dao.candidateByKey(key)?.let { value -> suppress(key, "RemoteDeleted", value.localId) }
        continue
      }
      val reason = CalendarLinkMapper.reason(event, calendar.zoneId)
      if (!event.has("recurrence") && (reason == null && !upcoming(event, calendar.zoneId) || reason != null && !rawOngoing(event, calendar.zoneId))) continue
      retained.put(event); candidateObservation(event, reason.orEmpty(), background)
    }
    cachePage(cursor.subject, cursor.calendarId, cursor.generation, retained)
  }
  fun collectionCompleted(cursor: CalendarSyncCursor) {
    if (cursor.paging || !permitsCalendar(cursor.subject, cursor.calendarId) || cursor.generation < binding().bootstrapGeneration) return
    if (!binding().initialRecoveryComplete) initialComplete(binding().bootstrapGeneration)
    else dao.binding(binding().copy(lastObservedAtMs = now()))
  }
  fun observations(calendarId: String): List<CalendarManagedCache> = dao.cache(binding().subject, calendarId)
  fun instances(rootId: String): List<CalendarManagedCache> = observations(binding().calendarId).filter { row ->
    runCatching { JSONObject(row.event).optString("recurringEventId") == rootId }.getOrDefault(false) }
  fun candidates(limit: Int = 50): List<CalendarManagedCandidate> = pendingCandidates().take(limit.coerceIn(1, 50))
  fun automaticAllowed(subject: String, calendarId: String): Boolean = binding().let { saved ->
    saved.subject != subject || saved.calendarId != calendarId || active(saved) }
  fun hasWork(): Boolean = active() || binding().phase in setOf("PreparingCalendar", "CreationUnconfirmed") ||
    binding().mode == "Enabled" && (pendingCandidates().isNotEmpty() || pendingIntents().isNotEmpty())
  fun nextRetryMs(): Long? {
    val setup = binding().operationId.takeIf(String::isNotBlank)?.let(::setupOperation)
      ?.takeIf { operationActive(it.operationId) && it.retryAtMs > 0 }?.retryAtMs
    val transfers = if (!active()) emptyList() else dao.candidates().filter { it.state in setOf("Pending", "Captured") && it.subject == binding().subject && it.calendarId == binding().calendarId }.map { maxOf(now(), it.retryAtMs) } +
      dao.exports().filter { it.state in setOf("Pending", "Captured") && it.subject == binding().subject && it.calendarId == binding().calendarId }.map { maxOf(now(), it.retryAtMs) }
    return (transfers + listOfNotNull(setup)).minOrNull()
  }
  private fun rawOngoing(event: JSONObject, zone: String): Boolean {
    return try {
    val end = event.optJSONObject("end") ?: return false
    val ending = if (end.has("dateTime")) java.time.OffsetDateTime.parse(end.getString("dateTime")).toInstant()
      else java.time.LocalDate.parse(end.getString("date")).atStartOfDay(ZoneId.of(zone)).toInstant()
    ending.toEpochMilli() > now()
    } catch (_: Exception) { true }
  }
  private fun futureException(event: JSONObject, zone: String): Boolean {
    // Cancellation payloads contain identity only; the master may arrive on a later page.
    if (event.optString("status") == "cancelled") return true
    val nominalMs = runCatching { CalendarRecurrence.originalSlot(event, zone).atZone(ZoneId.of(zone)).toInstant().toEpochMilli() }.getOrNull()
      ?: return true
    val master = dao.cached(binding().subject, binding().calendarId, event.optString("recurringEventId"))
      ?.let { runCatching { JSONObject(it.event) }.getOrNull() }
    val duration = master?.let { runCatching {
      val schedule = CalendarLinkMapper.fields(it, zone).getJSONObject("schedule")
      if (schedule.getBoolean("allDay")) 86_400_000L else schedule.getLong("eventEndMs") - schedule.getLong("eventStartMs")
    }.getOrNull() } ?: 366L * 86_400_000
    return nominalMs + duration + 2 * 86_400_000L > now() || rawOngoing(event, zone)
  }
  private fun upcoming(event: JSONObject, zone: String): Boolean {
    val fields = CalendarLinkMapper.fields(event, zone).getJSONObject("schedule")
    val recurring = fields.optJSONArray("recurrence")
    if (recurring == null) return fields.getLong("eventEndMs") > now()
    val start = java.time.Instant.ofEpochMilli(fields.getLong("eventStartMs")).atZone(ZoneId.of(fields.getString("zoneId"))).toLocalDateTime()
    val rule = CalendarRecurrence.decode(recurring, start, fields.getString("zoneId"), fields.getBoolean("allDay"),
      if (fields.getBoolean("allDay")) 86_400_000 else fields.getLong("eventEndMs") - fields.getLong("eventStartMs"))
    return com.remilo.alarm.core.Recurrence.future(rule, now(), ZoneId.of(rule.zoneId), "None").any() || fields.getLong("eventEndMs") > now()
  }
  fun candidate(id: String) = dao.candidate(id)
  fun candidateObservation(event: JSONObject, reason: String = "", background: Boolean = false): CalendarManagedCandidate? {
    val saved = binding(); val configured = policy()
    if (!active(saved) || !configured.automaticImport) return null
    val eventId = event.optString("id"); if (eventId.isBlank()) throw CalendarFailure("INVALID_EVENT")
    val key = CalendarLinkMapper.key(saved.subject, saved.calendarId, eventId)
    if (suppressed(key)) return null
    val old = dao.candidateByKey(key)
    if (old?.state in setOf("Captured", "Imported", "Suppressed")) return old
    val stable = candidateId(key); val fields = CalendarLinkMapper.reason(event, saved.calendarZone)?.let { reason.ifEmpty { it } }.orEmpty()
    val actualReason = reason.ifEmpty { fields }
    val retained = retainedEvent(event, saved.calendarZone, actualReason)
    val snapshot = meaningful(retained)
    val fingerprint = CalendarMapper.hash(canonical(snapshot).toString())
    if (old != null && old.fingerprint == fingerprint) {
      // Metadata context can advance without reopening a dismissed/failed review or invalidating content guards.
      val proof = old.policySnapshot.takeIf(String::isNotBlank)?.let(::JSONObject)
      if (proof?.optBoolean("publicationMarker") == true && !publicationMarker(event)) proof.put("publicationMarker", false)
      return old.copy(event = retained.toString(), policySnapshot = proof?.toString() ?: old.policySnapshot, observedAtMs = now()).also(dao::candidate)
    }
    val initial = !saved.initialRecoveryComplete
    val capturedPolicy = if (initial) dao.operation(saved.operationId)?.policy?.takeIf(String::isNotBlank)?.let(::JSONObject)
      ?: JSONObject(policyView(configured)) else JSONObject(policyView(configured))
    val snapshotPolicy = old?.policySnapshot?.takeIf(String::isNotBlank)?.let(::JSONObject)
      ?: capturedPolicy.put("initialCohort", initial).put("initialRecovery", initial && capturedPolicy.optBoolean("initialRecovery"))
        .put("importMode", if (initial) saved.initialMode else configured.importMode)
    snapshotPolicy.put("publicationMarker", (old == null || snapshotPolicy.optBoolean("publicationMarker")) && publicationMarker(event))
    val held = old?.state == "Held"
    val value = CalendarManagedCandidate(stable, key, saved.subject, saved.calendarId, eventId, importLocalId(key), saved.bootstrapGeneration,
      snapshotPolicy.getString("importMode"), fingerprint, retained.toString(), event.optString("summary", "Untitled event").take(200),
      revision = (old?.revision ?: 0) + 1, state = if (actualReason.isNotEmpty()) "Review" else if (held) "Held" else "Pending", reason = actualReason,
      authEpoch = saved.authEpoch, policyRevision = snapshotPolicy.optLong("revision", configured.revision),
      policySnapshot = snapshotPolicy.toString(), observedAtMs = now())
    db.runInTransaction {
      dao.candidate(value)
      if (actualReason.isNotEmpty()) issue("Candidate", stable, actualReason, background, fingerprint) else dao.resolve("candidate:$stable")
    }
    return value
  }
  fun candidateIds(): List<String> = dao.candidates().filter { it.state in setOf("Pending", "Review", "Captured", "Held") &&
    it.subject == binding().subject && it.calendarId == binding().calendarId }.map { it.candidateId }
  fun pendingCandidates(): List<CalendarManagedCandidate> = if (!active()) emptyList() else dao.candidates().filter { it.state in setOf("Pending", "Captured") &&
    (policy().automaticImport || it.state == "Captured") && it.subject == binding().subject && it.calendarId == binding().calendarId && it.retryAtMs <= now() }
  fun beginImport(candidateId: String, operationId: String, expectedCandidateRevision: Long, automatic: Boolean = true): CalendarManagedCandidate {
    val candidate = candidate(candidateId) ?: throw CalendarFailure("NOT_FOUND")
    if (candidate.state in setOf("Captured", "Imported") && candidate.operationId == operationId) { guardOperation(operationId); return candidate }
    if (candidate.operationId.isNotBlank() && candidate.operationId != operationId) {
      val prior = db.links().operation(candidate.operationId)
      if (prior != null && prior.state !in CalendarLinkStore.terminal) throw CalendarFailure("OPERATION_PENDING")
    }
    val permitted = if (automatic) permitsCalendar(candidate.subject, candidate.calendarId) else connection().connected && connection().subject == candidate.subject
    if (candidate.revision != expectedCandidateRevision || candidate.state !in setOf("Pending", "Review", "Held") || !permitted || suppressed(candidate.remoteKey)) throw CalendarFailure("STALE_PREVIEW")
    if (automatic && candidate.state == "Held") throw CalendarFailure("STALE_AUTHORIZATION")
    return candidate
  }
  fun captureImport(candidateId: String, operationId: String, expectedCandidateRevision: Long, automatic: Boolean = true): CalendarManagedCandidate {
    requireUuid(operationId)
    val value = beginImport(candidateId, operationId, expectedCandidateRevision, automatic)
    if (value.state == "Captured") return value
    ensureOperationUnused(operationId)
    return value.copy(state = "Captured", operationId = operationId, authEpoch = binding().authEpoch, policyRevision = policy().revision,
      policySnapshot = value.policySnapshot.ifBlank { JSONObject(policyView()).toString() }, automatic = automatic).also(dao::candidate)
  }
  fun guardOperation(operationId: String) {
    val parent = dao.operations().firstOrNull { job ->
      val items = JSONArray(job.reviewedItems)
      (0 until items.length()).map(items::getJSONObject).any { item -> item.optString("kind") == "Adopt" &&
        UUID.nameUUIDFromBytes("${job.operationId}:${item.optString("itemId")}".toByteArray(Charsets.UTF_8)).toString() == operationId }
    }
    if (parent != null && (parent.phase != "Confirmed" || !active() || binding().operationId != parent.operationId ||
      binding().subject != parent.subject || binding().calendarId != parent.resultCalendarId || binding().authEpoch != parent.authEpoch))
      throw CalendarFailure("STALE_AUTHORIZATION")
    val candidate = dao.candidates().firstOrNull { it.operationId == operationId } ?: return
    val permitted = if (candidate.automatic) permitsCalendar(candidate.subject, candidate.calendarId) && candidate.authEpoch == binding().authEpoch
      else connection().connected && connection().subject == candidate.subject
    if (!permitted || candidate.state !in setOf("Captured", "Imported") || suppressed(candidate.remoteKey)) throw CalendarFailure("STALE_AUTHORIZATION")
  }
  fun finishCandidate(operationId: String) {
    val candidate = dao.candidates().firstOrNull { it.operationId == operationId } ?: return
    db.runInTransaction {
      guardOperation(operationId); dao.candidate(candidate.copy(state = "Imported", event = "", audit = "")); dao.resolve("candidate:${candidate.candidateId}")
      CalendarSyncRequests(db, now).checkpoint(candidate.localId, imported = true)
    }
  }
  fun candidateFailed(candidateId: String, reason: String, background: Boolean) {
    val value = candidate(candidateId) ?: return
    if (value.state in setOf("Suppressed", "Imported")) return
    val sent = value.operationId.takeIf(String::isNotBlank)?.let { db.links().operation(it) }?.let { it.remoteAttempted && !it.mainConfirmed } == true
    if (reason in setOf("NETWORK", "RETRY", "BUDGET", "NOT_AVAILABLE") && !sent) {
      dao.candidate(value.copy(state = if (value.operationId.isBlank()) "Pending" else "Captured", reason = "", failures = value.failures + 1,
        retryAtMs = now() + minOf(3_600_000L, 60_000L * (1L shl minOf(value.failures, 6)))))
    } else db.runInTransaction { dao.candidate(value.copy(state = "Review", reason = reason)); issue("Candidate", candidateId, reason, background, value.fingerprint) }
  }
  fun ignoreCandidate(command: Map<String, Any?>): Map<String, Any?> {
    receipt(command)?.let { return it }
    val value = candidate(CalendarStore.string(command, "candidateId")) ?: throw CalendarFailure("NOT_FOUND")
    if (value.revision != number(command, "expectedRevision")) throw CalendarFailure("STALE_PREVIEW")
    return db.runInTransaction<Map<String, Any?>> { suppress(value.remoteKey, "Ignored", value.localId); acknowledge(command, mapOf("ignored" to true)) }
  }
  fun intent(id: String) = dao.export(id)
  fun pendingIntents(): List<CalendarManagedExport> = if (!active()) emptyList() else dao.exports().filter {
    it.subject == binding().subject && it.calendarId == binding().calendarId && it.state in setOf("Pending", "Captured") && it.retryAtMs <= now() }
  fun authored(id: String, revision: Long, choice: String = "Default") {
    if (choice !in setOf("Default", "Managed", "LocalOnly")) throw CalendarFailure("INVALID_INPUT")
    if (choice == "LocalOnly") { dao.disposition(CalendarManagedDisposition(id, (dao.disposition(id)?.revision ?: 0) + 1, "LocalOnly")); retireIntent(id, "LocalOnly"); return }
    if (choice == "Managed") dao.disposition(CalendarManagedDisposition(id, (dao.disposition(id)?.revision ?: 0) + 1, "Managed"))
    val saved = binding()
    if (saved.calendarId.isBlank() || saved.mode == "Disabled" || choice == "Default" && !policy().exportNewReminders || dao.disposition(id)?.disposition == "LocalOnly") return
    val old = dao.export(id)
    if (old?.state in setOf("Confirmed", "Captured")) return
    dao.export(CalendarManagedExport(id, saved.subject, saved.calendarId, revision, saved.authEpoch,
      state = if (saved.mode == "Paused" || !active(saved)) "Held" else "Pending", createdAtMs = old?.createdAtMs ?: now()))
  }
  fun updated(id: String, revision: Long) {
    val existing = intent(id) ?: return
    if (existing.state in setOf("Pending", "Held")) dao.export(existing.copy(localRevision = revision))
  }
  fun terminal(id: String) {
    retireIntent(id, "LocalTerminal")
    dao.candidates().filter { it.localId == id }.forEach { suppress(it.remoteKey, "LocalTerminal", id) }
    db.links().link(id)?.let { suppress(it.remoteKey, "LocalTerminal", id) }
  }
  fun removed(id: String, purge: Boolean) { if (purge) purge(id) else { terminal(id); dao.clearPreviews() } }
  fun localOnly(id: String) {
    val logical = familyIdentity(id)
    dao.disposition(CalendarManagedDisposition(logical, (dao.disposition(logical)?.revision ?: 0) + 1, "LocalOnly"))
    familyIdentities(id).forEach { local ->
      retireIntent(local, "LocalOnly")
      dao.candidates().filter { it.localId == local }.forEach { suppress(it.remoteKey, "LocalOnly", local) }
      db.links().link(local)?.let { suppress(it.remoteKey, "LocalOnly", local) }
    }
  }
  fun publicationCaptured(localId: String, operationId: String) {
    val value = intent(localId) ?: throw CalendarFailure("NOT_FOUND")
    if (!permitsCalendar(value.subject, value.calendarId) || value.authEpoch != binding().authEpoch || value.state !in setOf("Pending", "Captured")) throw CalendarFailure("STALE_AUTHORIZATION")
    if (value.state == "Captured" && value.operationId != operationId) throw CalendarFailure("OPERATION_PENDING")
    dao.export(value.copy(state = "Captured", operationId = operationId))
  }
  fun guardPublication(operationId: String) {
    val value = dao.exports().firstOrNull { it.operationId == operationId } ?: return
    if (!permitsCalendar(value.subject, value.calendarId) || value.authEpoch != binding().authEpoch || value.state != "Captured" || dao.disposition(value.localId)?.disposition == "LocalOnly") throw CalendarFailure("STALE_AUTHORIZATION")
  }
  fun publicationConfirmed(operationId: String) {
    val value = dao.exports().firstOrNull { it.operationId == operationId } ?: return
    guardPublication(operationId); dao.export(value.copy(state = "Confirmed")); dao.resolve("export:${value.localId}")
    CalendarSyncRequests(db, now).checkpoint(value.localId, published = true)
  }
  fun publicationFailed(localId: String, reason: String, background: Boolean) {
    val value = intent(localId) ?: return
    val sent = value.operationId.takeIf(String::isNotBlank)?.let { db.calendar().operation(it) }?.attempted == true
    if (reason in setOf("NETWORK", "RETRY", "BUDGET", "NOT_AVAILABLE") && !sent) dao.export(value.copy(failures = value.failures + 1,
      retryAtMs = now() + minOf(3_600_000L, 60_000L * (1L shl minOf(value.failures, 6)))))
    else db.runInTransaction { dao.export(value.copy(state = "Review", reason = reason)); issue("Export", localId, reason, background) }
  }
  fun retireIntent(id: String, reason: String) { intent(id)?.let { dao.export(it.copy(state = "Cancelled", reason = reason)) }; dao.resolve("export:$id") }
  fun disposition(id: String): Map<String, Any?> {
    val logical = familyIdentity(id)
    val saved = dao.disposition(logical); val intent = intent(logical)
    val link = db.links().links().firstOrNull { it.occurrenceId in familyIdentities(id) }
    val state = when { saved?.disposition == "LocalOnly" -> "LocalOnly"; link?.state == "Linked" -> "Linked"
      intent?.state == "Held" -> "Held"; intent?.state == "Captured" -> "Publishing"; intent?.state == "Pending" -> "WaitingToPublish"
      binding().calendarId.isBlank() -> "Unconfigured"; else -> "Ineligible" }
    return mapOf("occurrenceId" to id, "revision" to (saved?.revision ?: 0), "disposition" to (saved?.disposition ?: "Default"),
      "state" to state, "calendarName" to binding().calendarName, "message" to (intent?.reason ?: ""))
  }
  fun setDisposition(command: Map<String, Any?>): Map<String, Any?> {
    receipt(command)?.let { return it }
    val requested = CalendarStore.string(command, "occurrenceId")
    if (db.records().find(requested) == null && db.records().series(requested) == null) throw CalendarFailure("NOT_FOUND")
    val id = familyIdentity(requested); val ids = familyIdentities(requested); val old = dao.disposition(id)
    if ((old?.revision ?: 0) != number(command, "expectedRevision")) throw CalendarFailure("STALE_PREVIEW")
    val choice = CalendarStore.string(command, "disposition")
    if (choice !in setOf("Managed", "LocalOnly")) throw CalendarFailure("INVALID_INPUT")
    if (choice == "Managed" && (old?.disposition == "LocalOnly" || ids.any { db.links().link(it) != null } || intent(id) == null)) throw CalendarFailure("REVIEW_REQUIRED")
    return db.runInTransaction<Map<String, Any?>> {
      if (choice == "LocalOnly") {
        localOnly(requested)
        db.links().links().filter { it.occurrenceId in ids && !it.erased && it.state != "Detached" }.forEach { link ->
          val child = UUID.nameUUIDFromBytes((CalendarStore.string(command, "operationId") + ":unlink:" + link.occurrenceId).toByteArray(Charsets.UTF_8)).toString()
          CalendarLinkStore(db, now, recoverInterrupted = false).unlink(mapOf("operationId" to child, "occurrenceId" to link.occurrenceId, "expectedLinkRevision" to link.revision))
        }
      } else dao.disposition(CalendarManagedDisposition(id, (old?.revision ?: 0) + 1, choice))
      acknowledge(command, disposition(requested))
    }
  }
  private fun familyIdentity(id: String): String = db.records().series(id)?.seriesId
    ?: db.records().find(id)?.segmentId?.let { db.records().series(it)?.seriesId } ?: id
  private fun familyIdentities(id: String): Set<String> {
    val logical = familyIdentity(id)
    val segments = db.records().series().filter { it.seriesId == logical }.map { it.id }.toSet()
    return if (segments.isEmpty()) setOf(id) else segments + logical + db.records().all().filter { it.segmentId in segments }.map { it.id }
  }
  fun suppressed(key: String) = dao.suppression(CalendarMapper.hash(key)) != null || dao.suppression(key) != null
  fun suppress(remoteKey: String, reason: String, localId: String = "", nominalSlot: String = "") {
    val candidate = dao.candidateByKey(remoteKey)
    val link = db.links().remote(remoteKey)
    val subject = candidate?.subject ?: link?.subject ?: binding().subject
    val calendarId = candidate?.calendarId ?: link?.calendarId ?: binding().calendarId
    val eventId = candidate?.eventId ?: link?.eventId.orEmpty()
    val purged = reason == "Purged"
    dao.suppression(CalendarManagedSuppression(CalendarMapper.hash(remoteKey), if (purged) "" else subject,
      if (purged) "" else calendarId, if (purged) "" else eventId, if (purged) "" else localId, reason, if (purged) "" else nominalSlot, now()))
    candidate?.let {
      dao.candidate(it.copy(state = "Suppressed", event = "", audit = "", title = "", reason = reason))
      dao.resolve("candidate:${it.candidateId}")
      dao.removeCache(it.subject, it.calendarId, it.eventId)
      dao.cache(it.subject, it.calendarId).filter { row -> runCatching { JSONObject(row.event).optString("recurringEventId") == it.eventId }.getOrDefault(false) }
        .forEach { row -> dao.removeCache(row.subject, row.calendarId, row.eventId) }
    }
  }
  fun purge(id: String) {
    retireIntent(id, "Purged")
    dao.removeExport(id); dao.removeDisposition(id)
    val removed = db.records().find(id)
    removed?.segmentId?.let { segment ->
      val family = db.records().series(segment)?.seriesId
      val segmentIds = db.records().series().filter { it.seriesId == family }.map { it.id }.toSet()
      val parents = db.links().links().filter { it.occurrenceId in segmentIds }
      parents.forEach { parent ->
        val resources = db.calendarResources().resources(parent.occurrenceId)
        resources.filter { it.segmentId == segment && it.nominalSlot == removed.nominalSlot && it.eventId.isNotBlank() }.forEach { resource ->
          suppress(CalendarLinkMapper.key(parent.subject, resource.calendarId, resource.eventId), "Purged")
        }
        dao.candidates().filter { it.localId == parent.occurrenceId }.forEach { candidate ->
          dao.resolve("candidate:${candidate.candidateId}")
          dao.candidate(candidate.copy(event = "", audit = "", title = ""))
        }
        dao.clearCache(parent.subject, parent.calendarId)
      }
    }
    dao.candidates().filter { it.localId == id }.forEach { suppress(it.remoteKey, "Purged", id); dao.removeCache(it.subject, it.calendarId, it.eventId); dao.removeCandidate(it.candidateId) }
    db.links().link(id)?.let { suppress(it.remoteKey, "Purged", id) }
    dao.operations().filter { it.reviewedItems != "[]" }.forEach { operation ->
      val rows = JSONArray(operation.reviewedItems)
      val retained = (0 until rows.length()).map(rows::getJSONObject).filter { it.optString("occurrenceId") != id }
      if (retained.size != rows.length()) dao.update(operation.copy(reviewedItems = JSONArray(retained).toString()))
    }
    dao.resolve("export:$id"); db.sync().purgeActivity(id)
    dao.clearPreviews()
  }
  private fun purgedInstance(event: JSONObject, subject: String, calendarId: String): Boolean {
    if (!event.has("originalStartTime")) return false
    val master = event.optString("recurringEventId")
    val links = CalendarLinkStore(db, now, recoverInterrupted = false)
    val source = links.source(CalendarLinkMapper.key(subject, calendarId, master)) ?: return false
    val segments = links.segments(source.occurrenceId).map { it.id }.toSet()
    val resource = db.calendarResources().resources(source.occurrenceId).firstOrNull { it.eventId == master && it.nominalSlot.isEmpty() }
    val zone = resource?.segmentId?.let { db.records().series(it) }?.let { com.remilo.alarm.data.RuleCodec.decode(it.rule).zoneId }
      ?: links.record(source.occurrenceId)?.zoneId ?: binding().calendarZone
    val nominal = runCatching { CalendarRecurrence.originalSlot(event, zone).toString() }.getOrNull() ?: return false
    return db.records().purged().any { it.segmentId in segments && it.nominalSlot == nominal }
  }
  fun issue(targetKind: String, targetId: String, reason: String, background: Boolean, content: String = "") {
    val id = when (targetKind) { "Setup" -> "setup"; "Candidate" -> "candidate:$targetId"; else -> "export:$targetId" }
    val fingerprint = CalendarMapper.hash(JSONArray(listOf(targetKind, targetId, reason, content)).toString())
    val old = dao.issue(id)
    if (old?.fingerprint == fingerprint) return
    dao.issue(CalendarManagedIssue(id, targetKind, targetId, reason, fingerprint, now(), background, old?.notifiedFingerprint.orEmpty()))
  }
  fun issues(): List<Map<String, Any?>> = dao.issues().map { issue -> mapOf("issueId" to issue.issueId,
    "targetKind" to issue.targetKind, "candidateId" to issue.targetId.takeIf { issue.targetKind == "Candidate" },
    "operationId" to issue.targetId.takeIf { issue.targetKind == "Setup" }, "occurrenceId" to issue.targetId.takeIf { issue.targetKind == "Export" },
    "reason" to issue.reason, "title" to candidate(issue.targetId)?.title, "discoveredAtMs" to issue.discoveredAtMs) }
  private fun validateSelection(payload: JSONObject, command: Map<String, Any?>) {
    val items = payload.optJSONArray("items") ?: JSONArray()
    val selected = command["selectedItemIds"] as? List<*> ?: emptyList<String>()
    if (selected.distinct().size != selected.size || selected.size > 500) throw CalendarFailure("INVALID_INPUT")
    selected.forEach { id ->
      val item = (0 until items.length()).map(items::getJSONObject).firstOrNull { it.optString("itemId") == id && it.optBoolean("ready") }
        ?: throw CalendarFailure("STALE_PREVIEW")
      val local = item.optString("occurrenceId")
      if (item.has("localRevision") && CalendarLinkStore(db, now, recoverInterrupted = false).record(local)?.revision != item.getLong("localRevision")) throw CalendarFailure("STALE_PREVIEW")
      if (item.has("candidateRevision")) {
        val candidateId = item.optString("candidateId").ifEmpty { item.optString("itemId").removePrefix("candidate:") }
        if (candidate(candidateId)?.revision != item.getLong("candidateRevision")) throw CalendarFailure("STALE_PREVIEW")
      }
      if (item.has("linkRevision") && db.links().link(local)?.revision != item.getLong("linkRevision")) throw CalendarFailure("STALE_PREVIEW")
    }
  }
  private fun ensureOperationUnused(id: String) {
    if (dao.operation(id) != null || db.calendar().operation(id) != null || db.links().operation(id) != null || db.records().receipt(id) != null) throw CalendarFailure("OPERATION_REUSED")
  }
  private fun parsePolicy(choices: Map<String, Any?>): CalendarManagedPolicy {
    val old = policy()
    fun option(key: String, fallback: Boolean): Boolean = if (!choices.containsKey(key)) fallback else choices[key] as? Boolean ?: throw CalendarFailure("INVALID_INPUT")
    val mode = choices["importMode"] as? String ?: old.importMode
    if (mode !in setOf("Alarm", "Notification", "None")) throw CalendarFailure("INVALID_INPUT")
    val minuteValue = if (choices.containsKey("allDayAlarmMinutes")) number(choices, "allDayAlarmMinutes") else old.allDayAlarmMinutes.toLong()
    if (minuteValue !in 0..1439) throw CalendarFailure("INVALID_INPUT")
    val minutes = minuteValue.toInt()
    return old.copy(automaticImport = option("automaticImport", old.automaticImport), exportNewReminders = option("exportNewReminders", old.exportNewReminders),
      importMode = mode, allDayAlarmMinutes = minutes, disableGoogleReminders = option("disableGoogleReminders", old.disableGoogleReminders))
  }
  private fun policyFromJson(value: JSONObject) = parsePolicy(CalendarLinkMapper.map(value))
  private fun canonical(value: Any?): Any? = when (value) {
    is JSONObject -> JSONObject().also { result -> value.keys().asSequence().toList().sorted().forEach { result.put(it, canonical(value.get(it))) } }
    is JSONArray -> JSONArray().also { result -> for (i in 0 until value.length()) result.put(canonical(value.get(i))) }
    else -> value
  }
  private fun meaningful(value: Any?): Any? = when (value) {
    is JSONObject -> JSONObject().also { result -> value.keys().asSequence().filterNot { it in setOf("etag", "updated", "htmlLink") }
      .forEach { result.put(it, meaningful(value.get(it))) } }
    is JSONArray -> JSONArray().also { result -> for (i in 0 until value.length()) result.put(meaningful(value.get(i))) }
    else -> value
  }
  private fun publicationMarker(event: JSONObject): Boolean = event.optString("id").isNotBlank() &&
    event.optJSONObject("extendedProperties")?.optJSONObject("private")?.optString("remiloPublication") == event.optString("id")
  private fun retainPublicationProof(remoteKey: String, event: JSONObject) {
    val candidate = dao.candidateByKey(remoteKey) ?: return
    val snapshot = candidate.policySnapshot.takeIf(String::isNotBlank)?.let(::JSONObject) ?: return
    if (snapshot.optBoolean("publicationMarker") && !publicationMarker(event))
      dao.candidate(candidate.copy(policySnapshot = snapshot.put("publicationMarker", false).toString()))
  }
  private fun retainedEvent(event: JSONObject, zone: String, knownReason: String? = null): JSONObject {
    val plain = JSONObject(event.toString()).also { it.remove("recurringEventId") }
    val reason = knownReason ?: CalendarLinkMapper.reason(plain, zone)
    val kept = JSONObject()
    for (key in listOf("id", "etag", "status", "updated", "recurringEventId", "originalStartTime", "start", "end", "recurrence", "htmlLink", "eventType", "locked", "privateCopy", "endTimeUnspecified"))
      if (event.has(key)) kept.put(key, event.get(key))
    if (event.has("summary")) kept.put("summary", event.optString("summary").take(200))
    if (reason.isNullOrEmpty()) {
      for (key in listOf("description", "remiloInstances", "remiloSegments", "remiloSegmentSources")) if (event.has(key)) kept.put(key, event.get(key))
      event.optJSONObject("extendedProperties")?.optJSONObject("private")?.let { properties ->
        val markers = JSONObject()
        properties.keys().asSequence().filter { it.startsWith("remilo") }.forEach { key ->
          val value = properties.optString(key); if (value.length <= 1024) markers.put(key, value)
        }
        if (markers.length() > 0) kept.put("extendedProperties", JSONObject().put("private", markers))
      }
    } else {
      kept.put("remiloAvailabilityReason", reason)
      if (plain.optJSONArray("attendees")?.length()?.let { it > 0 } == true || plain.optBoolean("attendeesOmitted")) kept.put("attendeesOmitted", true)
    }
    return kept
  }
  private fun number(command: Map<String, Any?>, key: String): Long = CalendarStore.number(command, key)
  private fun requireUuid(id: String) {
    if (runCatching { UUID.fromString(id).toString() == id }.getOrDefault(false).not()) throw CalendarFailure("INVALID_INPUT")
  }
  companion object {
    fun candidateId(remoteKey: String): String = UUID.nameUUIDFromBytes("remilo-managed-candidate-v1:$remoteKey".toByteArray(Charsets.UTF_8)).toString()
    fun importLocalId(remoteKey: String): String = UUID.nameUUIDFromBytes("remilo-managed-import-v1:$remoteKey".toByteArray(Charsets.UTF_8)).toString()
  }
}

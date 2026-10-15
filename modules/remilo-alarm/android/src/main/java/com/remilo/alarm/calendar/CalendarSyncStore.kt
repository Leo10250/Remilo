package com.remilo.alarm.calendar

import com.remilo.alarm.data.*
import org.json.*

/** Serialized native policy; this class never performs network or scheduling work. */
class CalendarSyncStore(private val db: ContentDatabase, private val now: () -> Long, private val links: CalendarLinkStore) {
  private val dao get() = db.sync()
  fun state(id: String) = dao.state(id) ?: CalendarSyncState(id)
  fun view(id: String): Map<String, Any?> {
    val value = state(id)
    return mapOf("syncMode" to value.mode, "syncStatus" to value.status, "activationRevision" to value.activationRevision,
      "baselineVersion" to value.baselineVersion, "authoredAtMs" to value.authoredAtMs, "successfulAtMs" to value.successfulAtMs,
      "attemptedAtMs" to value.attemptedAtMs, "googleUpdated" to value.remoteUpdated, "pauseReason" to value.pauseReason,
      "syncRequestId" to CalendarSyncRequests(db, now).latest(id))
  }
  fun summary(): Map<String, Any?> = mapOf("reviewCount" to reviewCounts().getValue("total"), "automaticCount" to dao.states().count { eligible(it.associationId) },
    "reviewCounts" to reviewCounts(), "syncRequestId" to CalendarSyncRequests(db, now).latest(),
    "attention" to attention(),
    "pendingCount" to dao.states().count { it.mode != "Manual" && it.status == "UpdatePending" },
    "notifications" to preferenceView(), "connected" to links.connection().connected,
    "lastRun" to dao.run()?.let { mapOf("pages" to it.pages, "attempted" to it.attempted, "confirmed" to it.confirmed, "continuation" to it.continuation, "atMs" to it.atMs,
      "imported" to it.imported, "published" to it.published, "adopted" to it.adopted, "deferred" to it.deferred, "excluded" to it.excluded, "review" to it.review) })
  fun saveRun(value: CalendarRunSummary) = dao.run(CalendarSavedRun(pages = value.pages, attempted = value.attempted, confirmed = value.confirmed, continuation = value.continuation, atMs = now(),
    imported = value.imported, published = value.published, adopted = value.adopted, deferred = value.deferred, excluded = value.excluded, review = value.review))
  fun pending(): List<String> = dao.states().filter { it.mode != "Manual" && it.operationId.isNotEmpty() && it.status == "UpdatePending" && it.retryAtMs <= now() }
    .map { it.operationId }
  fun defer(id: String) { val value = state(id); dao.put(value.copy(status = "Deferred", pauseReason = "Ringing", retryAtMs = now() + 60_000)) }
  fun wakeDeferred(ringing: (String) -> Boolean) {
    dao.states().filter { it.status == "Deferred" && !ringing(it.associationId) }.forEach { dao.put(it.copy(status = "UpdatePending", pauseReason = "", retryAtMs = 0)) }
  }
  fun nextRetryMs(): Long? = dao.states().filter { it.mode != "Manual" && it.status in setOf("UpdatePending", "Deferred") }
    .minOfOrNull { maxOf(now(), it.retryAtMs) }
  fun transient(id: String) {
    val value = state(id)
    if (value.mode == "Manual" || value.status in setOf("Paused", "Review", "Unconfirmed")) return
    dao.put(value.copy(status = "UpdatePending", failures = value.failures + 1, attemptedAtMs = now(),
      retryAtMs = now() + minOf(3_600_000L, 60_000L * (1L shl minOf(value.failures, 6)))))
  }
  fun eligible(id: String): Boolean {
    val value = state(id); val link = links.link(id) ?: return false; val record = links.record(id) ?: return false
    val connection = links.connection()
    return value.mode == "Automatic" && value.status !in setOf("Review", "Unconfirmed", "Paused") && connection.connected &&
      CalendarManagedStore(db, now).automaticAllowed(link.subject, link.calendarId) &&
      connection.subject == link.subject && link.state == "Linked" && !link.requiresReview && !link.erased && !record.deleted && !record.completed && !record.skipped
  }
  fun authored(id: String) {
    CalendarManagedStore(db, now).updated(id, links.record(id)?.revision ?: 0)
    val family = db.records().series(id)?.seriesId ?: db.records().find(id)?.segmentId?.let { segment -> db.records().series(segment)?.seriesId }
    val affected = db.links().links().filter { it.occurrenceId == id || family != null && links.currentSeries(it.occurrenceId)?.seriesId == family }
    affected.forEach { link ->
      val value = state(link.occurrenceId)
      dao.put(value.copy(dirtyRevision = links.record(link.occurrenceId)?.revision ?: value.dirtyRevision + 1,
        authoredAtMs = now(), status = if (value.mode == "Automatic" && value.status == "Confirmed") "UpdatePending" else value.status))
    }
  }
  /** Captured in the same CE transaction as the existing immutable operation. */
  fun capture(job: CalendarLinkOperation, automaticSync: Boolean, automatic: Boolean = false) {
    val previous = state(job.occurrenceId)
    if (automatic && !eligible(job.occurrenceId)) throw CalendarFailure("INELIGIBLE")
    val revision = if (automatic) previous.activationRevision else previous.activationRevision + 1
    val fingerprint = if (job.kind == "ImportCalendarEvent") "" else CalendarMapper.hash(links.fields(job.occurrenceId).toString())
    dao.guard(CalendarSyncGuard(job.operationId, job.occurrenceId, revision, previous.baselineVersion,
      job.expectedConnectionRevision, job.expectedRevision, fingerprint, links.link(job.occurrenceId)?.baseline.orEmpty(), automatic, previous.mode, previous.status,
      if (job.kind == "ImportCalendarEvent") "" else links.fields(job.occurrenceId).toString()))
    dao.put(previous.copy(mode = if (automatic) previous.mode else if (automaticSync) "Pending" else "Manual",
      activationRevision = revision, operationId = job.operationId, status = "UpdatePending", pauseReason = "", attemptedAtMs = now(), remoteUpdated = JSONObject(job.draft).optString("googleUpdated")))
  }
  fun guard(job: CalendarLinkOperation, beforeLocal: Boolean, beforeSend: Boolean) {
    val guard = dao.guard(job.operationId) ?: return // Historical manual jobs retain their original recovery policy.
    val value = state(job.occurrenceId)
    if (!guard.automatic && value.mode == "Manual") return
    if (value.activationRevision != guard.activationRevision || value.operationId != job.operationId ||
      links.connection().revision != guard.connectionRevision || value.baselineVersion != guard.baselineVersion) throw CalendarFailure("STALE_AUTHORIZATION")
    if (!guard.automatic) return
    if (!eligible(job.occurrenceId)) throw CalendarFailure("INELIGIBLE")
    if (beforeLocal && links.record(job.occurrenceId)?.revision != guard.localRevision) throw CalendarFailure("STALE_PREVIEW")
    if (beforeSend && !CalendarLinkMapper.equal(links.fields(job.occurrenceId), JSONObject(job.desired))) throw CalendarFailure("STALE_PREVIEW")
  }
  fun confirmed(job: CalendarLinkOperation, baseline: JSONObject, updated: String = "") {
    val guard = dao.guard(job.operationId) ?: return
    val old = state(job.occurrenceId); val link = links.link(job.occurrenceId) ?: return
    // A delayed sent outcome can be recorded, but cannot restore revoked permission.
    if (old.activationRevision != guard.activationRevision || old.operationId != job.operationId || link.state != "Linked" ||
      link.requiresReview || job.patch.isBlank() || old.mode != "Manual" && links.connection().revision != guard.connectionRevision) return
    val activate = old.mode == "Pending"
    val dirty = !CalendarLinkMapper.equal(links.fields(job.occurrenceId), baseline)
    dao.put(old.copy(mode = if (activate) "Automatic" else old.mode, baselineVersion = old.baselineVersion + 1,
      successfulAtMs = now(), operationId = "", status = if (dirty && old.mode != "Manual") "UpdatePending" else "Confirmed",
      dirtyRevision = if (dirty) links.record(job.occurrenceId)?.revision ?: old.dirtyRevision else 0, retryAtMs = 0, failures = 0, pauseReason = "", remoteUpdated = updated))
    dao.resolve(job.occurrenceId)
    if (activate) activity(job.operationId + ":activation", job.occurrenceId, if (guard.previousMode == "Automatic") "Resumed" else "Activated", "")
    confirmedGroups(job, baseline, listOf("title", "notes", "schedule"))
  }
  fun confirmedGroups(job: CalendarLinkOperation, baseline: JSONObject, groups: List<String>) {
    val guard = dao.guard(job.operationId) ?: return
    val link = links.link(job.occurrenceId) ?: return
    if (job.erased || link.erased || link.state == "Detached") return
    val prior = JSONObject(job.remote); val desired = baseline
    val outbound = groups.filter { desired.has(it) && !CalendarLinkMapper.equal(prior.opt(it), desired.opt(it)) }
    val original = guard.localFields.takeIf(String::isNotBlank)?.let(::JSONObject)
    val changed = groups.filter { desired.has(it) && original != null && !CalendarLinkMapper.equal(original.opt(it), desired.opt(it)) }
    CalendarSyncRequests(db, now).checkpoint(job.occurrenceId, changed = (changed + outbound).isNotEmpty())
    outbound.forEach { activity(job.operationId + ":outbound:$it", job.occurrenceId, "UpdatedGoogle", it) }
    changed.forEach { activity(job.operationId + ":inbound:$it", job.occurrenceId, "UpdatedRemilo", it) }
    if (!guard.automatic && guard.previousStatus in setOf("Review", "Paused", "Unconfirmed") && (changed + outbound).isNotEmpty()) activity(job.operationId + ":resolution", job.occurrenceId, "Resolved", (changed + outbound).distinct().joinToString(","))
  }
  fun agreement(id: String, guard: CalendarObservationGuard, remote: JSONObject) {
    if (links.guard(id) != guard || !eligible(id)) throw CalendarFailure("STALE_PREVIEW")
    val fields = CalendarLinkMapper.fields(remote, remote.getJSONObject("start").optString("timeZone", links.record(id)!!.zoneId))
    if (!CalendarLinkMapper.equal(links.fields(id), fields)) throw CalendarFailure("STALE_PREVIEW")
    val value = state(id); val link = links.link(id)!!
    db.runInTransaction {
      db.links().put(link.copy(baseline = fields.toString(), etag = remote.getString("etag"), remoteDiffers = false))
      dao.put(value.copy(baselineVersion = value.baselineVersion + 1, successfulAtMs = now(), attemptedAtMs = now(), dirtyRevision = 0,
        status = "Confirmed", retryAtMs = 0, failures = 0, remoteUpdated = remote.optString("updated")))
      CalendarSyncRequests(db, now).checkpoint(id)
    }
  }
  fun failed(job: CalendarLinkOperation, code: String, background: Boolean) {
    if (dao.guard(job.operationId) == null) return
    val value = state(job.occurrenceId)
    if (value.operationId != job.operationId) return
    val uncertain = job.remoteAttempted && !job.mainConfirmed || links.resourceJobs(job.operationId).any { it.attempted && !it.confirmed }
    when {
      code == "RINGING_DEFERRED" -> {
        if (!job.remoteAttempted) db.links().update(job.copy(state = "Cancelled", patch = "", draft = ""))
        dao.put(value.copy(status = "Deferred", pauseReason = "Ringing", operationId = "", retryAtMs = now() + 60_000))
      }
      uncertain -> issue(job.occurrenceId, "UnconfirmedWrite", background, "Unconfirmed")
      code in setOf("NETWORK", "RETRY", "NOT_AVAILABLE", "STORAGE_ERROR", "BUDGET") -> dao.put(value.copy(status = "UpdatePending", failures = value.failures + 1,
        attemptedAtMs = now(), retryAtMs = now() + minOf(3_600_000L, 60_000L * (1L shl minOf(value.failures, 6)))))
      code in setOf("STALE_PREVIEW", "STALE_REMOTE") -> {
        if (dao.guard(job.operationId)?.automatic == true) {
          if (job.mainConfirmed && code == "STALE_REMOTE") {
            db.links().update(job.copy(state = "Waiting")); dao.put(value.copy(status = "UpdatePending", retryAtMs = now() + 60_000)); return
          }
          if (!job.remoteAttempted || job.mainConfirmed) db.links().update(job.copy(state = "Cancelled", patch = "", draft = ""))
          dao.put(value.copy(status = "UpdatePending", operationId = "", retryAtMs = 0))
        } else issue(job.occurrenceId, "ChangesNeedReview", background)
      }
      else -> issue(job.occurrenceId, code, background, if (code in setOf("AUTH", "NEEDS_ACCESS", "NOT_OWNER", "FORBIDDEN", "REMOTE_DELETED", "REMOTE_UNAVAILABLE")) "Paused" else "Review")
    }
  }
  fun issue(id: String, reason: String, background: Boolean, status: String = "Review", content: String = "") {
    val link = links.link(id) ?: return
    if (link.erased || link.state == "Detached") return
    val safeReason = reason(reason)
    val fingerprint = CalendarMapper.hash(JSONArray(listOf(link.remoteKey, safeReason, content)).toString())
    val previous = dao.issue(id); val value = state(id)
    db.runInTransaction {
      dao.issue(CalendarReviewIssue(id, safeReason, fingerprint, previous?.discoveredAtMs ?: now(), if (previous?.fingerprint == fingerprint) previous.background else background,
        if (!background) fingerprint else previous?.notifiedFingerprint.orEmpty()))
      dao.put(value.copy(status = status, pauseReason = safeReason, attemptedAtMs = now()))
      if (value.status != "Paused" && status == "Paused") activity("$fingerprint:pause", id, "Suspended", "")
    }
  }
  fun fenced(id: String, purge: Boolean, reason: String) {
    val value = state(id)
    if (purge) { dao.purgeCache(id); dao.purgeGuards(id); dao.purgeActivity(id); dao.purgeState(id) }
    else dao.put(value.copy(activationRevision = value.activationRevision + 1, status = "Paused", pauseReason = reason, operationId = ""))
    dao.resolve(id)
  }
  fun purgedInstance(id: String, calendarId: String) {
    val value = state(id)
    dao.purgeCache(id); dao.purgeGuards(id); dao.purgeActivity(id); dao.resolve(id)
    dao.put(value.copy(activationRevision = value.activationRevision + 1, baselineVersion = value.baselineVersion + 1,
      operationId = "", status = "UpdatePending", pauseReason = ""))
    dao.cursors().filter { it.calendarId == calendarId }.forEach { dao.cursor(it.copy(generation = it.generation + 1, syncToken = "", startingToken = "", pageToken = "", paging = false)) }
  }
  fun retireInstanceIssue(id: String) {
    val value = state(id)
    dao.resolve(id); dao.put(value.copy(activationRevision = value.activationRevision + 1, operationId = "", status = "UpdatePending", pauseReason = "", retryAtMs = 0))
  }
  fun activity(checkpoint: String, id: String, kind: String, groups: String) = dao.activity(CalendarActivity(checkpoint, id, kind, groups, now()))
  fun activity(id: String): List<Map<String, Any?>> = dao.activity(id).map { mapOf("kind" to ("Calendar" + it.kind), "atMs" to it.occurredAtMs, "targetMs" to null,
    "groups" to it.groups.split(',').filter(String::isNotBlank)) }
  fun actionableIssues() = dao.issues().filter { issue -> links.link(issue.associationId)?.let { !it.erased && it.state != "Detached" } == true &&
    links.record(issue.associationId)?.let { !it.deleted && !it.completed && !it.skipped } == true }
  fun attention(): Map<String, Any> {
    val reasons = actionableIssues().map { it.reason } + db.managedCalendar().issues().map { it.reason }
    val blocking = reasons.count { it in setOf("AccessRequired", "AccountChanged", "AUTH", "NEEDS_ACCESS", "ACCOUNT_MISMATCH", "STORAGE_ERROR") }
    return mapOf("blocking" to blocking, "tone" to if (blocking > 0) "danger" else "warning")
  }
  fun issues(cursor: String?): Map<String, Any?> {
    val association = actionableIssues().distinctBy { links.currentSeries(it.associationId)?.seriesId ?: it.associationId }.map { issue -> mapOf<String, Any?>(
      "kind" to "Association", "issueId" to ("association:" + issue.associationId), "revision" to (links.link(issue.associationId)?.revision ?: 0),
      "fingerprint" to issue.fingerprint, "occurrenceId" to issue.associationId, "reason" to issue.reason,
      "title" to links.record(issue.associationId)?.title, "seriesId" to links.currentSeries(issue.associationId)?.seriesId,
      "affectedScopes" to links.resources(issue.associationId).filter { it.availability == "Deleted" && it.nominalSlot.isNotEmpty() }.map { it.nominalSlot },
      "discoveredAtMs" to issue.discoveredAtMs) }
    val managed = CalendarManagedStore(db, now)
    val additions = db.managedCalendar().issues().map { issue ->
      val candidate = managed.candidate(issue.targetId)
      mapOf<String, Any?>("kind" to (if (issue.targetKind == "Export") "Association" else issue.targetKind), "issueId" to issue.issueId,
        "revision" to (candidate?.revision ?: managed.binding().revision), "fingerprint" to issue.fingerprint,
        "candidateId" to issue.targetId.takeIf { issue.targetKind == "Candidate" },
        "occurrenceId" to issue.targetId.takeIf { issue.targetKind == "Export" },
        "operationId" to issue.targetId.takeIf { issue.targetKind == "Setup" }, "reason" to reason(issue.reason),
        "title" to (candidate?.title ?: issue.targetId.takeIf { issue.targetKind == "Export" }?.let { links.record(it)?.title } ?: "Calendar setup needs review"),
        "calendarName" to (candidate?.calendarId?.let { managed.binding().calendarName } ?: managed.binding().calendarName),
        "seriesId" to issue.targetId.takeIf { issue.targetKind == "Export" }?.let { links.currentSeries(it)?.seriesId },
        "discoveredAtMs" to issue.discoveredAtMs)
    }
    val items = (association + additions).sortedWith(compareBy<Map<String, Any?>> { (it["discoveredAtMs"] as Number).toLong() }.thenBy { it["issueId"] as String })
    val version = CalendarMapper.hash(JSONArray(items.map { it["fingerprint"] }).toString())
    val start = if (cursor == null) 0 else cursor.substringAfter(':').toIntOrNull()?.takeIf { cursor.substringBefore(':') == version && it in 0..items.size } ?: throw CalendarFailure("STALE_CURSOR")
    val page = items.drop(start).take(50)
    return mapOf("items" to page, "nextCursor" to (start + page.size).takeIf { it < items.size }?.let { "$version:$it" }, "count" to items.size, "counts" to reviewCounts())
  }
  private fun reviewCounts(): Map<String, Int> {
    val extra = db.managedCalendar().issues()
    val reminders = (actionableIssues().map { it.associationId } + extra.filter { it.targetKind == "Export" }.map { it.targetId })
      .distinctBy { links.currentSeries(it)?.seriesId ?: it }.size
    val candidates = extra.count { it.targetKind == "Candidate" }; val setup = extra.count { it.targetKind == "Setup" }
    return mapOf("reminders" to reminders, "candidates" to candidates, "setup" to setup, "total" to reminders + candidates + setup)
  }
  fun preferenceView() = (dao.preference() ?: CalendarReviewPreferences()).let { mapOf("revision" to it.revision, "enabled" to it.enabled) }
  fun notifications(presenter: CalendarReviewNotifications) {
    val issues = actionableIssues()
    val managed = db.managedCalendar().issues()
    val enabled = (dao.preference() ?: CalendarReviewPreferences()).enabled && presenter.allowed()
    val newlyDiscovered = enabled && (issues.any { it.background && it.notifiedFingerprint != it.fingerprint } || managed.any { it.background && it.notifiedFingerprint != it.fingerprint })
    // Persist delivery intent first, so a restart cannot repost an unchanged issue.
    if (newlyDiscovered) db.runInTransaction {
      issues.filter { it.background }.forEach { dao.issue(it.copy(notifiedFingerprint = it.fingerprint)) }
      managed.filter { it.background }.forEach { db.managedCalendar().issue(it.copy(notifiedFingerprint = it.fingerprint)) }
    }
    presenter.present(if (enabled) reviewCounts().getValue("total") else 0, newlyDiscovered)
  }
  fun preference(command: Map<String, Any?>): Map<String, Any?> {
    val id = CalendarStore.string(command, "operationId"); val old = dao.preference() ?: CalendarReviewPreferences()
    val enabled = command["enabled"] as? Boolean ?: throw CalendarFailure("INVALID_INPUT")
    db.records().receipt(id)?.let { if (it.kind != "CalendarNotifications" || it.sourceId != enabled.toString()) throw CalendarFailure("OPERATION_REUSED"); return preferenceView() }
    if (old.revision != CalendarStore.number(command, "expectedRevision")) throw CalendarFailure("STALE_REVISION")
    db.runInTransaction {
      dao.preference(old.copy(revision = old.revision + 1, enabled = enabled, operationId = id))
      // Existing issues become seen when toggling; enabling never reposts them.
      dao.issues().forEach { dao.issue(it.copy(notifiedFingerprint = it.fingerprint)) }
      db.managedCalendar().issues().forEach { db.managedCalendar().issue(it.copy(notifiedFingerprint = it.fingerprint)) }
      db.records().receipt(CreationReceipt(id, "calendar", "CalendarNotifications", enabled.toString()))
    }
    return preferenceView()
  }
  fun reason(code: String): String = when (code) {
    "ChangesNeedReview", "UnconfirmedWrite", "Ringing", "LocalTerminal", "LocalRemoved", "Unlinked", "ReviewRequired" -> code
    "RESOURCE_CONFLICT" -> "ChangesNeedReview"
    "UNCONFIRMED_RESOURCE", "CREATION_UNCONFIRMED" -> "UnconfirmedWrite"
    "ADOPTION_REQUIRED", "SELECTION_REQUIRED" -> "ReviewRequired"
    "OWNERSHIP_UNKNOWN" -> "NotOwner"
    "ELAPSED_ALERT" -> "ElapsedAlert"
    "AUTH", "NEEDS_ACCESS", "STALE_CONNECTION" -> "AccessRequired"
    "ACCOUNT_MISMATCH" -> "AccountChanged"
    "NOT_OWNER", "FORBIDDEN" -> "NotOwner"
    "REMOTE_DELETED", "REMOTE_REMOVED" -> "RemoteDeleted"
    "REMOTE_UNAVAILABLE", "NOT_FOUND", "FOREIGN_IDENTITY" -> "RemoteUnavailable"
    "STALE_AUTHORIZATION" -> "StaleAuthorization"
    "TITLE_REQUIRED", "CONTENT_LIMIT" -> "ContentRequired"
    "OPERATION_PENDING", "INELIGIBLE" -> "ReviewRequired"
    "INVALID_INPUT", "INVALID_EVENT", "INVALID_ZONE", "INCOMPATIBLE_ZONES" -> "InvalidTiming"
    else -> "Unsupported"
  }
}

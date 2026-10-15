package com.remilo.alarm.calendar

import com.remilo.alarm.data.ContentDatabase
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

/** Saved projections only. All access uses the engine worker; reads never dispatch work. */
class CalendarStatusStore(private val db: ContentDatabase, private val now: () -> Long) {
  private val managed get() = db.managedCalendar()
  private fun outcomeId(id: String) = UUID.nameUUIDFromBytes("$id:authorization-outcome".toByteArray(Charsets.UTF_8)).toString()
  fun beginAuthorization(id: String, target: String?): Boolean {
    runCatching { UUID.fromString(id) }.getOrElse { throw CalendarFailure("INVALID_INPUT") }
    val key = target.orEmpty()
    managed.receipt(id)?.let {
      if (it.kind != "CalendarAuthorization" || it.requestKey != key) throw CalendarFailure("OPERATION_REUSED")
      return false
    }
    if (db.records().receipt(id) != null || db.calendar().operation(id) != null || db.links().operation(id) != null || managed.operation(id) != null)
      throw CalendarFailure("OPERATION_REUSED")
    managed.receipt(CalendarManagedReceipt(id, "CalendarAuthorization", key,
      JSONObject().put("connectionRevision", db.calendar().connection()?.revision ?: 0).put("createdAtMs", now()).toString()))
    return true
  }
  fun finishAuthorization(id: String, stage: String) {
    if (managed.receipt(id)?.kind != "CalendarAuthorization" || stage !in setOf("Authorized", "Cancelled", "Failed")) return
    val resultId = outcomeId(id)
    if (managed.receipt(resultId) == null) managed.receipt(CalendarManagedReceipt(resultId, "CalendarAuthorizationOutcome", id,
      JSONObject().put("stage", stage).toString()))
  }
  fun progress(): Map<String, Any> {
    val binding = managed.binding() ?: CalendarManagedBinding()
    val candidates = managed.candidates().filter { it.subject == binding.subject && it.calendarId == binding.calendarId && it.state != "Suppressed" }
    val exports = managed.exports().filter { it.subject == binding.subject && it.calendarId == binding.calendarId }
    val links = db.links().links().filter { !it.erased && it.subject == binding.subject && it.calendarId == binding.calendarId }
    val states = links.mapNotNull { db.sync().state(it.occurrenceId) }
    val pendingCandidates = candidates.count { it.state in setOf("Pending", "Captured") }
    val pendingExports = exports.count { it.state in setOf("Pending", "Captured") }
    // A candidate's link job also appears among associations. Count it once.
    val candidateJobs = candidates.filter { it.state in setOf("Pending", "Captured") }.map { it.operationId }.filter(String::isNotBlank).toSet()
    val pendingChanges = states.count { (it.status == "UpdatePending" || it.dirtyRevision > 0) && it.operationId !in candidateJobs }
    val records = links.mapNotNull { CalendarLinkStore(db, now, recoverInterrupted = false).record(it.occurrenceId) }
    val localJobs = db.links().operations().filter { !it.erased && it.localApplied }.distinctBy { it.occurrenceId }.associateBy { it.occurrenceId }
    val reviewIds = candidates.filter { it.state == "Review" }.map { it.localId.ifBlank { it.candidateId } }.toSet() +
      exports.filter { it.state == "Review" }.map { it.localId } + states.filter { it.status in setOf("Review", "Unconfirmed") }.map { it.associationId }
    return mapOf("scanComplete" to binding.initialRecoveryComplete, "imported" to candidates.count { it.state == "Imported" },
      "pending" to (pendingCandidates + pendingExports + pendingChanges),
      "held" to (candidates.count { it.state == "Held" } + exports.count { it.state == "Held" }),
      "review" to reviewIds.size,
      "localBlocked" to records.count { it.mode != "None" && localJobs[it.id]?.localStatus == "Blocked" },
      "localPending" to records.count { it.mode != "None" && localJobs[it.id]?.localStatus == "Pending" })
  }
  fun problem(): Map<String, String>? {
    val binding = managed.binding() ?: return null
    if (binding.phase !in setOf("AccessRequired", "OwnershipUnknown", "CalendarUnavailable", "CreationUnconfirmed", "Reviewing")) return null
    val job = managed.operation(binding.operationId)
    val reason = job?.message?.takeIf { it in safeReasons } ?: managed.issues().lastOrNull { it.targetKind == "Setup" }?.reason?.takeIf { it in safeReasons }
      ?: when (binding.phase) { "AccessRequired" -> "NEEDS_ACCESS"; "OwnershipUnknown" -> "OWNERSHIP_UNKNOWN"; "CalendarUnavailable" -> "REMOTE_UNAVAILABLE"; "CreationUnconfirmed" -> "CREATION_UNCONFIRMED"; else -> "REVIEW_REQUIRED" }
    val resumableSetup = job != null && job.phase !in setOf("Confirmed", "Fenced", "Cancelled") && job.authEpoch == binding.authEpoch
    return mapOf("reason" to reason, "action" to if (binding.phase == "Reviewing") "ReviewSetup" else action(reason, resumableSetup))
  }
  fun operation(id: String): Map<String, Any?>? {
    CalendarSyncRequests(db, now).view(id)?.let { return it }
    val receipt = managed.receipt(id)
    if (receipt?.kind == "CalendarAuthorization") {
      val stage = managed.receipt(outcomeId(id))?.let { JSONObject(it.result).optString("stage") } ?: "AwaitingAuthorization"
      return result(id, "Authorization", stage, if (stage == "Failed") "NEEDS_ACCESS" else "", if (stage == "Failed") "Connect" else "None")
    }
    val setup = managed.operation(id)
    if (setup != null && setup.kind != "Discovery") {
      val binding = managed.binding()
      val sameConfirmedSource = setup.phase == "Confirmed" && setup.resultCalendarId == binding?.calendarId
      val current = binding?.operationId == id && binding.subject == setup.subject && (binding.authEpoch == setup.authEpoch || sameConfirmedSource)
      if (!current || setup.phase in setOf("Fenced", "Cancelled")) return result(id, "Setup", "Cancelled", "STALE_AUTHORIZATION", "None", current = false)
      val progress = progress()
      val problem = problem()
      val stage = when {
        problem != null -> when (binding!!.phase) { "AccessRequired" -> "NeedsAccess"; "CreationUnconfirmed" -> "Unconfirmed"; else -> "NeedsReview" }
        setup.phase != "Confirmed" -> if (setup.resultCalendarId.isNotBlank() || setup.kind == "Select") "CheckingCalendar" else if (setup.attempted) "CreatingCalendar" else "PreparingCalendar"
        binding!!.mode != "Enabled" -> "Paused"
        progress["scanComplete"] != true -> "CheckingEvents"
        (progress["pending"] as Int) > 0 -> "AddingReminders"
        (progress["review"] as Int) > 0 -> "NeedsReview"
        else -> "Confirmed"
      }
      return result(id, "Setup", stage, problem?.get("reason").orEmpty(), problem?.get("action") ?: if (stage == "NeedsReview") "ReviewItems" else "None",
        confirmed = progress["imported"] as Int, pending = progress["pending"] as Int, review = progress["review"] as Int, held = progress["held"] as Int) + mapOf("progress" to progress)
    }
    val activation = db.records().receipt(id)?.takeIf { it.kind == "CalendarActivationBatch" }
    val childIds = if (activation != null) JSONArray(activation.sourceId).getJSONArray(1) else receipt?.let { JSONObject(it.result).optJSONArray("operations") } ?: JSONArray()
    val children = (0 until childIds.length()).map { childIds.getString(it) }
    val jobs = children.mapNotNull { db.links().operation(it) }.filter { !it.erased }
    if (receipt == null && activation == null && jobs.isEmpty()) return null
    val confirmed = jobs.count { it.state == "Confirmed" }
    val review = jobs.count { it.state in setOf("Conflict", "Blocked", "Failed", "NeedsAccess", "Unconfirmed") }
    val pending = jobs.count { it.state in setOf("Waiting", "Sending") }
    val refs = receipt?.let { JSONObject(it.result).optJSONArray("selectionRefs") } ?: JSONArray()
    val exports = (0 until refs.length()).map { refs.getJSONObject(it) }.filter { it.optString("kind") == "Publish" }
      .mapNotNull { managed.export(it.optString("localId")) }
    val scope = managed.binding()
    val payload = receipt?.let { JSONObject(it.result) }
    if (activation == null && receipt?.kind == "ResumeManagedCalendar" && payload?.has("selectionRefs") != true)
      return result(id, receipt.kind, "NeedsReview", "REVIEW_REQUIRED", "ReviewSetup") + mapOf("correlationComplete" to false)
    val current = payload == null || !payload.has("scopeEpoch") || payload.optLong("scopeEpoch") == scope?.authEpoch
    val waiting = if (current) exports.count { it.state in setOf("Pending", "Captured") } else 0
    val held = if (current) exports.count { it.state == "Held" } else 0
    val problems = review + if (current) exports.count { it.state == "Review" } else 0
    val expectedExports = (0 until refs.length()).count { refs.getJSONObject(it).optString("kind") == "Publish" }
    val stage = when { !current -> "Cancelled"; pending + waiting > 0 -> "Waiting"; problems > 0 -> "NeedsReview"; held > 0 -> "Paused"; children.size != jobs.size || exports.size != expectedExports -> "Cancelled"; else -> "Confirmed" }
    return result(id, if (activation != null) "Activation" else receipt!!.kind, stage, "", if (problems > 0) "ReviewItems" else "None",
      confirmed + if (current) exports.count { it.state == "Confirmed" } else 0, pending + waiting, problems, held, jobs.map { it.operationId }, current)
  }
  private fun result(id: String, kind: String, stage: String, reason: String, action: String, confirmed: Int = 0, pending: Int = 0,
    review: Int = 0, held: Int = 0, children: List<String> = emptyList(), current: Boolean = true): Map<String, Any?> =
    mapOf("operationId" to id, "kind" to kind, "stage" to stage, "reason" to reason, "action" to action, "confirmed" to confirmed,
      "pending" to pending, "review" to review, "held" to held, "children" to children, "currentScope" to current)
  private fun action(reason: String, captured: Boolean) = when (reason) {
    "CREATION_UNCONFIRMED" -> "InspectCreation"
    "AUTH", "NEEDS_ACCESS", "ACCOUNT_MISMATCH" -> if (captured) "Authorize" else "Connect"
    else -> "ReviewSetup"
  }
  companion object { private val safeReasons = setOf("AUTH", "NEEDS_ACCESS", "ACCOUNT_MISMATCH", "OWNERSHIP_UNKNOWN", "NOT_OWNER", "REMOTE_UNAVAILABLE", "REMOTE_DELETED", "CREATION_UNCONFIRMED", "CALENDAR_SELECTION_REQUIRED", "STALE_PREVIEW", "NETWORK", "REVIEW_REQUIRED") }
}

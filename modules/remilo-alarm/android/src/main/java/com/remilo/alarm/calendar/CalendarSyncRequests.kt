package com.remilo.alarm.calendar

import com.remilo.alarm.data.ContentDatabase
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

/** Request receipts describe an opportunity, never permission. Called only on the engine worker. */
class CalendarSyncRequests(private val db: ContentDatabase, private val now: () -> Long) {
  private val dao get() = db.managedCalendar()
  private fun stateId(id: String) = UUID.nameUUIDFromBytes("$id:sync-progress".toByteArray()).toString()
  private fun root(id: String) = dao.receipt(id)?.takeIf { it.kind == "CalendarSyncRequest" }
  private fun data(id: String) = dao.receipt(stateId(id))?.let { JSONObject(it.result) } ?: JSONObject().put("stage", "Waiting")
  private fun save(id: String, value: JSONObject) {
    val row = CalendarManagedReceipt(stateId(id), "CalendarSyncProgress", id, value.toString())
    if (dao.receipt(row.operationId) == null) dao.receipt(row) else dao.replaceReceipt(row)
  }
  fun capture(command: Map<String, Any?>): Map<String, Any?> {
    val id = CalendarStore.string(command, "operationId")
    runCatching { UUID.fromString(id) }.getOrElse { throw CalendarFailure("INVALID_INPUT") }
    val scope = command["scope"] as? Map<*, *> ?: throw CalendarFailure("INVALID_INPUT")
    val kind = scope["kind"] as? String ?: throw CalendarFailure("INVALID_INPUT")
    if (kind !in setOf("AllAuthorized", "Association")) throw CalendarFailure("INVALID_INPUT")
    val association = if (kind == "Association") scope["occurrenceId"] as? String ?: throw CalendarFailure("INVALID_INPUT") else ""
    val key = CalendarMapper.hash(JSONObject().put("kind", kind).put("occurrenceId", association).toString())
    root(id)?.let { if (it.requestKey != key) throw CalendarFailure("OPERATION_REUSED"); return mapOf("operationId" to id) }
    if (dao.receipt(id) != null || dao.operation(id) != null || db.calendar().operation(id) != null || db.links().operation(id) != null || db.records().receipt(id) != null)
      throw CalendarFailure("OPERATION_REUSED")
    val connection = db.calendar().connection() ?: CalendarConnection()
    val binding = dao.binding() ?: CalendarManagedBinding()
    if (association.isNotBlank() && db.links().link(association)?.let { !it.erased } != true) throw CalendarFailure("NOT_FOUND")
    val value = JSONObject().put("kind", kind).put("occurrenceId", association).put("createdAtMs", now())
      .put("subject", connection.subject).put("connectionRevision", connection.revision).put("authEpoch", binding.authEpoch)
      .put("activationRevision", db.sync().state(association)?.activationRevision ?: 0L)
    dao.receipt(CalendarManagedReceipt(id, "CalendarSyncRequest", key, value.toString()))
    save(id, JSONObject().put("stage", "Waiting"))
    return mapOf("operationId" to id)
  }
  private fun current(value: JSONObject): Boolean {
    if (value.optBoolean("erased")) return false
    val connection = db.calendar().connection() ?: return false
    if (value.optLong("connectionRevision") != connection.revision || value.optString("subject") != connection.subject || value.optLong("authEpoch") != (dao.binding()?.authEpoch ?: 0L)) return false
    val id = value.optString("occurrenceId")
    if (id.isEmpty()) return true
    val link = db.links().link(id) ?: return false
    val record = CalendarLinkStore(db, now, recoverInterrupted = false).record(id) ?: return false
    return !link.erased && link.state != "Detached" && !record.deleted && !record.completed && !record.skipped &&
      value.optLong("activationRevision") == (db.sync().state(id)?.activationRevision ?: 0L)
  }
  fun pending(): List<String> = dao.receipts("CalendarSyncRequest").filter { data(it.operationId).optString("stage") in setOf("Waiting", "CheckingEvents") }
    .map { it.operationId }
  fun nextReady(): String? = pending().firstOrNull { data(it).optLong("retryAtMs") <= now() }
  fun nextRetryMs(): Long? = pending().minOfOrNull { data(it).optLong("retryAtMs", now()) }
  fun association(id: String): String? = root(id)?.let { JSONObject(it.result).optString("occurrenceId").takeIf(String::isNotBlank) }
  fun latest(association: String? = null): String? = dao.receipts("CalendarSyncRequest").filter {
    val value = JSONObject(it.result); current(value) && value.optString("occurrenceId") == association.orEmpty()
  }.lastOrNull()?.operationId
  fun begin(id: String): Boolean {
    val value = root(id)?.let { JSONObject(it.result) } ?: return false
    if (!current(value)) { finish(id, error = "STALE_AUTHORIZATION"); return false }
    val state = data(id)
    if (state.optString("stage") !in setOf("Waiting", "CheckingEvents")) return false
    val association = value.optString("occurrenceId")
    val binding = dao.binding() ?: CalendarManagedBinding()
    val scoped = states(value)
    val paused = if (association.isNotEmpty()) db.links().link(association)?.let { !CalendarManagedStore(db, now).automaticAllowed(it.subject, it.calendarId) && db.sync().state(association)?.status != "Unconfirmed" } == true
      else binding.mode == "Paused" && scoped.none { CalendarSyncStore(db, now, CalendarLinkStore(db, now, recoverInterrupted = false)).eligible(it.associationId) }
    if (paused || association.isNotEmpty() && db.sync().state(association)?.mode == "Manual") { finish(id); return false }
    state.put("stage", "CheckingEvents").put("outcome", "Checking").put("startedAtMs", state.optLong("startedAtMs", now())); state.remove("finishedAtMs"); save(id, state)
    return true
  }
  /** Sets are written with the confirmed checkpoint, including agreement with no content change. */
  fun checkpoint(association: String, changed: Boolean = false, imported: Boolean = false, published: Boolean = false) {
    val family = CalendarLinkStore(db, now, recoverInterrupted = false).currentSeries(association)?.seriesId ?: association
    dao.receipts("CalendarSyncRequest").forEach { row ->
      val value = JSONObject(row.result); val state = data(row.operationId)
      if (state.optString("stage") != "CheckingEvents" || !current(value) || value.optString("occurrenceId").let { it.isNotEmpty() && it != association }) return@forEach
      fun add(key: String) { val set = state.optJSONArray(key) ?: JSONArray(); if ((0 until set.length()).none { set.getString(it) == family }) set.put(family); state.put(key, set) }
      add("checked"); if (changed) add("changed"); if (imported) add("imported"); if (published) add("published"); save(row.operationId, state)
    }
  }
  private fun scopeIssues(value: JSONObject): List<String> {
    val id = value.optString("occurrenceId")
    return if (id.isNotEmpty()) db.sync().issues().filter { it.associationId == id }.map { it.reason }
      else CalendarSyncStore(db, now, CalendarLinkStore(db, now, recoverInterrupted = false)).actionableIssues().map { it.reason } + dao.issues().map { it.reason }
  }
  private fun states(value: JSONObject): List<CalendarSyncState> {
    val association = value.optString("occurrenceId")
    val links = CalendarLinkStore(db, now, recoverInterrupted = false)
    return db.sync().states().filter { state ->
      (if (association.isNotEmpty()) state.associationId == association else state.mode != "Manual") &&
        db.links().link(state.associationId)?.let { !it.erased && it.state != "Detached" } == true &&
        links.record(state.associationId)?.let { !it.deleted && !it.completed && !it.skipped } == true
    }
  }
  fun finish(id: String, run: CalendarRunSummary? = null, error: String = "") {
    val root = root(id) ?: return; val value = JSONObject(root.result); val state = data(id)
    if (state.optString("stage") !in setOf("Waiting", "CheckingEvents")) return
    val association = value.optString("occurrenceId")
    val binding = dao.binding() ?: CalendarManagedBinding()
    val sync = CalendarSyncStore(db, now, CalendarLinkStore(db, now, recoverInterrupted = false))
    val states = states(value)
    val issues = scopeIssues(value)
    val uncertain = states.any { it.status == "Unconfirmed" } || issues.any { it in setOf("UnconfirmedWrite", "CREATION_UNCONFIRMED", "CreationUnconfirmed") }
    val access = error in setOf("AUTH", "NEEDS_ACCESS", "ACCOUNT_MISMATCH") || issues.any { it in setOf("AccessRequired", "AccountChanged", "AUTH", "NEEDS_ACCESS", "ACCOUNT_MISMATCH") }
    val progress = if (association.isEmpty()) CalendarStatusStore(db, now).progress() else emptyMap()
    val pending = maxOf(states.count { it.status in setOf("UpdatePending", "Deferred") || it.dirtyRevision > 0 }, progress["pending"] as? Int ?: 0)
    val held = progress["held"] as? Int ?: 0
    val paused = if (association.isNotEmpty()) db.links().link(association)?.let { !CalendarManagedStore(db, now).automaticAllowed(it.subject, it.calendarId) } == true
      else binding.mode == "Paused" && states.none { sync.eligible(it.associationId) }
    val checked = state.optJSONArray("checked")?.length() ?: 0
    val changed = state.optJSONArray("changed")?.length() ?: 0
    val complete = run != null && !run.continuation && (checked > 0 || association.isEmpty() && run.collectionPages > 0)
    val outcome = when {
      !current(value) -> "ScopeChanged"
      access -> "AccessRequired"
      uncertain -> "Unconfirmed"
      paused -> "Paused"
      error.isNotEmpty() && error !in setOf("BUDGET", "CANCELLED") -> if (error in setOf("NETWORK", "RETRY", "NOT_AVAILABLE")) "Pending" else "Failed"
      issues.isNotEmpty() || states.any { it.status in setOf("Review", "Paused") } -> "NeedsReview"
      held > 0 && pending == 0 && run?.continuation != true -> "Paused"
      error in setOf("BUDGET", "CANCELLED") || run?.continuation == true || pending > 0 -> "Pending"
      complete && (changed > 0 || (state.optJSONArray("imported")?.length() ?: 0) + (state.optJSONArray("published")?.length() ?: 0) > 0) -> "Synced"
      complete -> "NoChanges"
      else -> "NotChecked"
    }
    val stage = when (outcome) { "ScopeChanged" -> "Cancelled"; "AccessRequired" -> "NeedsAccess"; "Unconfirmed" -> "Unconfirmed"; "Paused" -> "Paused"; "NeedsReview" -> "NeedsReview"; "Failed" -> "Failed"; "Pending" -> "Waiting"; else -> "Confirmed" }
    state.put("stage", stage).put("outcome", outcome).put("finishedAtMs", now()).put("reason", error.takeIf { it in setOf("AUTH", "NEEDS_ACCESS", "ACCOUNT_MISMATCH", "NETWORK", "RETRY", "STORAGE_ERROR") }.orEmpty())
      .put("remaining", maxOf(pending, if (run?.continuation == true || error in setOf("BUDGET", "CANCELLED")) 1 else 0)).put("held", held).put("review", issues.size)
    if (outcome == "Pending") {
      val failures = if (error in setOf("NETWORK", "RETRY", "NOT_AVAILABLE")) state.optInt("failures") + 1 else 1
      state.put("failures", failures).put("retryAtMs", now() + minOf(3_600_000L, 60_000L * (1L shl minOf(6, failures - 1))))
    }
    save(id, state)
  }
  fun view(id: String): Map<String, Any?>? {
    val root = root(id) ?: return null; val value = JSONObject(root.result); val state = data(id); val valid = current(value)
    val stored = state.optString("outcome", "Checking")
    val liveStates = if (valid) states(value) else emptyList()
    val outcome = if (!valid) "ScopeChanged" else if (stored in setOf("NoChanges", "Synced")) when {
      liveStates.any { it.status == "Unconfirmed" } -> "Unconfirmed"
      scopeIssues(value).isNotEmpty() || liveStates.any { it.status in setOf("Review", "Paused") } -> "NeedsReview"
      liveStates.any { it.dirtyRevision > 0 || it.status in setOf("UpdatePending", "Deferred") } -> "Pending"
      else -> stored
    } else stored
    val stage = if (valid) state.optString("stage", "Waiting") else "Cancelled"
    val action = when(outcome) { "AccessRequired" -> "Connect"; "NeedsReview", "Unconfirmed" -> "ReviewItems"; "Failed", "NotChecked", "Pending" -> "Retry"; else -> "None" }
    val counts = listOf("checked", "changed", "imported", "published").associateWith { if (valid) state.optJSONArray(it)?.length() ?: 0 else 0 }
    val scope = if (value.optBoolean("erased")) null else mapOf("kind" to value.optString("kind"), "occurrenceId" to value.optString("occurrenceId"))
    return mapOf("operationId" to id, "kind" to "Sync", "stage" to stage, "reason" to state.optString("reason"), "action" to action,
      "confirmed" to counts.getValue("checked"), "pending" to if (valid) state.optInt("remaining") else 0, "review" to if (valid) state.optInt("review") else 0,
      "held" to if (valid) state.optInt("held") else 0, "children" to emptyList<String>(), "currentScope" to valid,
      "syncResult" to (counts + mapOf("scope" to scope, "outcome" to outcome, "startedAtMs" to if (state.has("startedAtMs")) state.getLong("startedAtMs") else null,
        "finishedAtMs" to if (state.has("finishedAtMs")) state.getLong("finishedAtMs") else null)))
  }
  fun purge(association: String) {
    val family = CalendarLinkStore(db, now, recoverInterrupted = false).currentSeries(association)?.seriesId ?: association
    dao.receipts("CalendarSyncRequest").forEach { row ->
      val value = JSONObject(row.result); val state = data(row.operationId)
      if (value.optString("occurrenceId") == association || listOf("checked", "changed", "imported", "published").any { key -> state.optJSONArray(key)?.toString()?.contains(JSONObject.quote(family)) == true }) {
        value.remove("occurrenceId"); value.put("erased", true); dao.replaceReceipt(row.copy(result = value.toString()))
        save(row.operationId, JSONObject().put("stage", "Cancelled").put("outcome", "ScopeChanged"))
      }
    }
  }
}

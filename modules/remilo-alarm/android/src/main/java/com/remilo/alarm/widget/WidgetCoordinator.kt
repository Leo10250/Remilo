package com.remilo.alarm.widget

import android.content.Context
import com.remilo.alarm.core.AppearancePolicy
import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant
import java.time.ZoneId
import java.util.UUID

/** Projects existing native sessions; owns no exercise state and never schedules reminder delivery. */
internal class WidgetCoordinator(context: Context, private val now: () -> Long,
  private val appearance: () -> AppearancePolicy.Resolved,
  private val routine: (String) -> Map<String, Any?>?, private val reminders: () -> Map<String, Any?>,
  private val liveRoutine: (String) -> Boolean, private val apply: (Map<String, Any?>) -> Map<String, Any?>,
  private val committed: (String) -> Boolean) {
  val state = WidgetState(context)
  fun validate(mode: String, id: String?) {
    require(mode in setOf("Today", "Routine"))
    require(mode != "Routine" || id != null)
    require(id == null || liveRoutine(id))
  }
  fun configure(id: Int, mode: String, routineId: String?, expected: Long): WidgetConfiguration {
    validate(mode, routineId); return state.save(id, mode, routineId, expected)
  }
  private fun command(action: JSONObject): Map<String, Any?> = action.getJSONObject("command").let { obj ->
    obj.keys().asSequence().associateWith { key -> obj.get(key).let { value -> when {
      value == JSONObject.NULL -> null; key == "expectedRevision" -> (value as Number).toLong(); else -> value } } }
  }
  /** Completion identities only; the native session remains the source of checks and eligibility. */
  private fun history(saved: JSONObject): List<JSONObject> {
    saved.optJSONArray("undoHistory")?.let { list -> return (0 until list.length()).map { list.getJSONObject(it) } }
    // Upgrade an installed one-step widget without manufacturing earlier Undo targets.
    val last = saved.optJSONObject("last") ?: return emptyList()
    val action = saved.optJSONObject("actions")?.optJSONObject(last.getString("token")) ?: return emptyList()
    return listOf(completion(last.getString("token"), action))
  }
  private fun completion(token: String, action: JSONObject): JSONObject {
    val input = action.getJSONObject("command")
    return JSONObject().put("token", token).put("stepId", input.getString("stepId"))
      .put("date", input.getString("date")).put("occurrenceId", input.getString("occurrenceId"))
      .put("configurationRevision", action.getLong("configurationRevision"))
  }
  private fun saveHistory(saved: JSONObject, entries: List<JSONObject>) {
    saved.put("undoHistory", JSONArray(entries)); saved.remove("last")
  }
  private fun finish(id: Int, saved: JSONObject, token: String, action: JSONObject) {
    val entries = history(saved)
    val input = action.getJSONObject("command")
    if (input.getBoolean("completed")) saveHistory(saved, entries.filter { it.getString("token") != token } + completion(token, action))
    else {
      val target = action.optString("undoOf").takeIf { it.isNotEmpty() }
        ?: entries.lastOrNull { it.getString("stepId") == input.getString("stepId") &&
          it.getString("occurrenceId") == input.getString("occurrenceId") && it.getString("date") == input.getString("date") }?.getString("token")
      saveHistory(saved, entries.filter { it.getString("token") != target })
    }
    saved.remove("pending"); saved.remove("notice"); state.write(id, saved)
  }
  fun act(id: Int, token: String): Map<String, Any?> {
    val saved = state.read(id) ?: return rejected()
    val action = saved.optJSONObject("actions")?.optJSONObject(token) ?: return rejected()
    val input = command(action)
    // The original receipt wins even if a later configuration/date/revision has changed.
    if (committed(input["operationId"] as String)) return (apply(input) + ("widgetReplay" to true)).also {
      if (saved.optString("pending") == token) finish(id, saved, token, action)
    }
    if (action.getLong("configurationRevision") != saved.getLong("revision") ||
      saved.optString("pending").let { it.isNotEmpty() && it != token }) return rejected()
    saved.put("pending", token); state.write(id, saved)
    val result = apply(input) // An exception retains the exact pending descriptor for Retry.
    if (result["status"] == "Applied") finish(id, saved, token, action)
    else { saved.remove("pending"); saved.put("notice", "This view changed. Review the refreshed routine."); state.write(id, saved) }
    return result + ("widgetReplay" to false)
  }
  private fun rejected() = mapOf("status" to "Rejected", "errorCode" to "STALE_WIDGET")
  /** A successful explicit refresh acknowledges feedback, never an uncertain command. */
  fun acknowledgeRefresh(id: Int) {
    val saved = state.read(id) ?: return
    if(saved.has("notice")) { saved.remove("notice"); state.write(id,saved) }
  }
  @Suppress("UNCHECKED_CAST")
  fun snapshot(id: Int, draft: WidgetConfiguration? = null): WidgetSnapshot {
    val saved = if (draft == null) state.read(id) else null
    val config = draft ?: state.configuration(saved)
    val date = Instant.ofEpochMilli(now()).atZone(ZoneId.systemDefault()).toLocalDate().toString()
    val session = config.routineId?.takeIf(liveRoutine)?.let(routine)
    val list = if (config.mode == "Today") reminders() else emptyMap()
    val pending = saved?.optString("pending")?.takeIf { it.isNotEmpty() }
    val actions = saved?.optJSONObject("actions") ?: JSONObject()
    if (pending != null) actions.optJSONObject(pending)?.let {
      if (committed(it.getJSONObject("command").getString("operationId"))) finish(id, saved, pending, it)
      else if (it.getJSONObject("command").getString("date") != date) {
        saved.remove("pending"); saved.put("notice", "This view changed. Review the refreshed routine."); state.write(id,saved)
      }
    }
    val waiting = saved?.optString("pending")?.takeIf { it.isNotEmpty() }
    val waitingCommand = waiting?.let { actions.optJSONObject(it)?.getJSONObject("command") }
    val steps = session?.get("steps") as? List<Map<String, Any?>> ?: emptyList()
    val eligible = saved != null && waiting == null && session?.get("occurrenceId") != null && session["ended"] != true &&
      session["deleted"] != true && session["skipped"] != true && session["date"] == date
    val changes = session?.get("changes") as? List<Map<String, Any?>> ?: emptyList()
    val entries = saved?.let(::history).orEmpty().filter { entry ->
      entry.getLong("configurationRevision") == config.revision && entry.getString("date") == date && session?.get("date") == date &&
        entry.getString("occurrenceId") == session?.get("occurrenceId") && session?.get("ended") != true && session?.get("deleted") != true &&
        steps.any { it["id"] == entry.getString("stepId") && it["completed"] == true } &&
        changes.lastOrNull { it["stepId"] == entry.getString("stepId") }?.let {
          it["id"] == "widget:${entry.getString("token")}" && it["completed"] == true
        } == true
    }
    fun descriptor(step: Map<String, Any?>?, completed: Boolean, undoOf: String? = null): String? {
      if (!eligible || step == null) return null
      val input = mapOf("kind" to "SetRoutineExercise", "occurrenceId" to session!!["occurrenceId"], "date" to date,
        "stepId" to step["id"], "completed" to completed, "expectedRevision" to session["revision"])
      actions.keys().asSequence().firstOrNull { key -> val a = actions.getJSONObject(key)
        a.optLong("configurationRevision") == config.revision && command(a) - "operationId" == input &&
          a.optString("undoOf").takeIf { it.isNotEmpty() } == undoOf }?.let { return it }
      val token = UUID.randomUUID().toString()
      actions.put(token, JSONObject().put("configurationRevision", config.revision).put("undoOf", undoOf)
        .put("command", JSONObject(input + ("operationId" to "widget:$token"))))
      return token
    }
    val done = descriptor(steps.firstOrNull { it["completed"] != true }, true)
    val undoStep = entries.lastOrNull()?.let { previous -> steps.firstOrNull { it["id"] == previous.getString("stepId") } }
    val undo = descriptor(undoStep, false, entries.lastOrNull()?.getString("token"))
    if (saved != null) {
      saveHistory(saved, entries)
      // Retain every eligible completion (at most the session's 100 steps), plus bounded stale receipt retries.
      val keep = (listOfNotNull(done, undo, waiting) + entries.map { it.getString("token") }).toSet()
      actions.keys().asSequence().toList().filter { it !in keep }.dropLast(56).forEach(actions::remove)
      saved.put("actions", actions); state.write(id, saved)
    }
    val previewDone = draft != null && session?.get("occurrenceId") != null && session["ended"] != true && session["skipped"] != true &&
      session["deleted"] != true && steps.any { it["completed"] != true }
    return WidgetSnapshot(id, config, date, appearance(), session, (list["items"] as? List<Map<String, Any?>>).orEmpty().take(20),
      (list["total"] as? Number)?.toInt() ?: 0, done ?: "preview".takeIf { previewDone }, undo, undoStep?.get("name") as? String, waiting,
      saved?.optString("notice")?.takeIf { it.isNotEmpty() }, configured = saved != null || draft != null,
      retryIsUndo = waitingCommand?.getBoolean("completed") == false,
      retryName = steps.firstOrNull { it["id"] == waitingCommand?.getString("stepId") }?.get("name") as? String)
  }
}

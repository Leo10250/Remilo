package com.remilo.alarm.engine

import android.content.Context
import com.remilo.alarm.core.*
import com.remilo.alarm.data.*
import com.remilo.alarm.system.*
import org.json.JSONArray
import org.json.JSONObject
import java.time.*
import java.util.UUID

/** Owned exclusively by AlarmEngine's serialized worker. No second timer or state owner. */
internal class RoutineCoordinator(private val context: Context, private val database: () -> ContentDatabase,
  private val operational: OperationalDatabase, private val series: SeriesCoordinator,
  private val scheduler: AlarmRegistrar, private val now: () -> Long,
  private val register: (AlertRecord) -> AlertRecord, private val checkpoint: (String) -> Unit = {},
  private val deliveryChanged: (String) -> Unit = {}) {
  private val db get() = database()
  private val dao get() = db.routines()
  private val alerts get() = operational.records()
  private fun zone() = ZoneId.systemDefault()
  private fun today() = RoutinePolicy.date(now(), zone())
  private fun checkedDate(value: Any?): LocalDate = (value as? String)?.takeIf { it.length == 10 }
    ?.let { runCatching { LocalDate.parse(it) }.getOrNull() } ?: throw IllegalArgumentException("Choose today or a future start date.")
  private fun id(seed: String) = UUID.nameUUIDFromBytes(seed.toByteArray()).toString()
  private fun json(value: Any?): Any? = when (value) {
    JSONObject.NULL -> null
    is JSONObject -> value.keys().asSequence().associateWith { json(value.get(it)) }
    is JSONArray -> (0 until value.length()).map { json(value.get(it)) }
    else -> value
  }
  @Suppress("UNCHECKED_CAST") private fun map(value: String) = json(JSONObject(value)) as Map<String, Any?>
  @Suppress("UNCHECKED_CAST") private fun rows(value: String) = json(JSONArray(value)) as List<Map<String, Any?>>
  private fun strings(value: String): Set<String> = JSONArray(value).let { a -> (0 until a.length()).map { a.getString(it) }.toSet() }
  private fun fingerprint(value: Any?): String = when (value) {
    is Map<*, *> -> value.entries.sortedBy { it.key.toString() }.joinToString(",", "{", "}") { JSONObject.quote(it.key.toString()) + ":" + fingerprint(it.value) }
    is List<*> -> value.joinToString(",", "[", "]") { fingerprint(it) }
    null -> "null"
    is String -> JSONObject.quote(value)
    else -> value.toString()
  }
  private fun version(id: String, date: String) = dao.versions(id).filter { it.effectiveDate <= date }.maxByOrNull { it.revision }
  private fun nominalDate(record: ReminderRecord) = record.nominalSlot!!.substringBefore('T')
  private fun completed(session: RoutineSession) = rows(session.steps).isNotEmpty() && strings(session.done).size == rows(session.steps).size
  private fun rest(version: RoutineVersion, date: LocalDate) = rows(version.days)[date.dayOfWeek.value - 1]["type"] == "Rest"
  @Suppress("UNCHECKED_CAST") private fun exercises(version: RoutineVersion, date: LocalDate) =
    rows(version.days)[date.dayOfWeek.value - 1]["exercises"] as List<Map<String, Any?>>
  private fun pausedAt(plan: RoutinePlan, at: Long): Boolean = rows(plan.pauses).any {
    at >= (it["from"] as Number).toLong() && (it["until"] == null || at < (it["until"] as Number).toLong())
  }
  fun isRoutine(record: ReminderRecord) = record.routineId != null
  fun trashed(id: String?) = id != null && (dao.plan(id)?.state == "Trashed" || dao.purged(id) != null)
  fun visible(record: ReminderRecord): Boolean {
    if (!isRoutine(record)) return true
    if (trashed(record.routineId)) return false
    if (alerts.find(record.id)?.state == "Replaced") return false
    val date = nominalDate(record)
    if (dao.dated(record.routineId!!, date)?.occurrenceId?.let { it != record.id } == true) return false
    val session = dao.session(record.id)
    if (session != null && rows(session.steps).isEmpty()) return false
    return date >= today().toString() && session?.ended != true &&
      (date == today().toString() && session != null || dao.plan(record.routineId!!)?.state == "Active")
  }
  private fun recordVersion(record: ReminderRecord): RoutineVersion? = dao.session(record.id)?.let { saved ->
    dao.versions(saved.routineId).firstOrNull { it.revision == saved.versionRevision }
  } ?: record.routineId?.let { version(it,nominalDate(record)) }
  fun recurrence(record: ReminderRecord): RecurrenceRule? = recordVersion(record)?.let { series.rule(template(it),rule(it)) }
  fun anchor(record: ReminderRecord): Long = recordVersion(record)?.let { v ->
    LocalDate.parse(nominalDate(record)).atTime(v.minutes / 60,v.minutes % 60).atZone(zone()).toInstant().toEpochMilli()
  } ?: LocalDateTime.parse(record.nominalSlot).atZone(zone()).toInstant().toEpochMilli()
  fun projection(record: ReminderRecord): Map<String, Any?>? {
    val planId = record.routineId ?: return null
    val date = nominalDate(record)
    val saved = dao.session(record.id)
    val v = saved?.let { dao.versions(planId).firstOrNull { v -> v.revision == it.versionRevision } } ?: version(planId, date) ?: return null
    val steps = saved?.let { rows(it.steps) } ?: exercises(v, LocalDate.parse(date))
    val done = saved?.let { strings(it.done) }.orEmpty()
    val ended = saved?.ended == true || alerts.find(record.id)?.dayEnded == true || date < today().toString()
    return mapOf("routineId" to planId, "date" to date, "revision" to (saved?.revision ?: 0),
      "ended" to ended, "endsAtMs" to RoutinePolicy.end(LocalDate.parse(date), zone()), "completedCount" to done.size, "totalCount" to steps.size,
      "skipped" to record.skipped, "completed" to record.completed,
      "notes" to v.notes, "mode" to v.mode, "minutes" to v.minutes, "sound" to v.sound, "vibration" to v.vibration,
      "authoringMode" to v.authoringMode, "presentationPreset" to v.presentationPreset,
      "state" to when { steps.isEmpty() -> "Rest"; record.skipped -> "Skipped"; record.completed -> "Completed"; ended -> if (done.isEmpty()) "NotCompleted" else "PartiallyCompleted"; done.isEmpty() -> "Ready"; else -> "InProgress" },
      "changes" to saved?.let { rows(it.changes) }.orEmpty(),
      "steps" to steps.map { it + ("completed" to (it["id"] in done)) })
  }
  fun plans(): List<Map<String, Any?>> = dao.plans().filter { it.state != "Trashed" }.map { planView(it) }
  fun trashRows(): List<Pair<ReminderRecord, Map<String, Any?>>> = dao.plans().filter { it.state == "Trashed" }.map { plan ->
    val v = dao.versions(plan.id).maxBy { it.revision }
    template(v).copy(id = plan.id, routineId = null, deleted = true, revision = plan.revision, createdAtMs = plan.trashedAtMs) to
      (planView(plan) + ("recordedDays" to dao.sessions().count { it.routineId == plan.id }) + ("trashedAtMs" to plan.trashedAtMs))
  }
  fun preview(input: Map<String, Any?>): Map<String, Any?> {
    val owner = (input["routineId"] as? String)?.let { dao.plan(it) ?: throw IllegalArgumentException("Choose a routine day.") }
    val date = if (owner != null) maxOf(today(), LocalDate.parse(owner.startsOn)).toString()
      else if (input["startsOn"] == null) today().toString() else checkedDate(input["startsOn"]).toString()
    val v = checkedVersion(input + ("title" to ((input["title"] as? String)?.takeIf { it.isNotBlank() } ?: "Routine")), "preview", date)
    val r = series.rule(template(v), rule(v))
    return mapOf("nextAlertMs" to if (v.mode == "None") null else Recurrence.future(r, now(), zone(), v.mode).firstOrNull()?.alarmAtMs,
      "today" to today().toString(), "effectiveDate" to date)
  }
  fun planView(plan: RoutinePlan): Map<String, Any?> {
    val v = dao.versions(plan.id).maxBy { it.revision }
    return mapOf("id" to plan.id, "revision" to plan.revision, "state" to plan.state,
      "startsOn" to plan.startsOn, "effectiveDate" to v.effectiveDate, "title" to v.title,
      "minutes" to v.minutes, "mode" to v.mode, "listId" to v.listId, "days" to rows(v.days),
      "notes" to v.notes, "sound" to v.sound, "vibration" to v.vibration,
      "authoringMode" to v.authoringMode, "presentationPreset" to v.presentationPreset)
  }
  fun session(id: String, date: String?): Map<String, Any?>? {
    val plan = dao.plan(id) ?: return null
    if (plan.state == "Trashed") return null
    val day = date?.let(LocalDate::parse) ?: today()
    val saved = dao.dated(id, day.toString())
    if (saved != null) return db.records().find(saved.occurrenceId)?.let {
      mapOf("occurrenceId" to it.id, "title" to it.title, "deleted" to it.deleted) + projection(it)!!
    }
    val v = version(id, day.toString()) ?: return null
    val steps = if (rest(v, day)) emptyList() else exercises(v, day).map { it + ("completed" to false) }
    return mapOf("routineId" to id, "date" to day.toString(), "title" to v.title,
      "state" to if (rest(v, day)) "Rest" else if (plan.state == "Paused") "Paused" else "Upcoming",
      "notes" to v.notes, "mode" to v.mode, "minutes" to v.minutes, "sound" to v.sound, "vibration" to v.vibration,
      "authoringMode" to v.authoringMode, "presentationPreset" to v.presentationPreset,
      "ended" to (day < today()), "steps" to steps, "completedCount" to 0, "totalCount" to steps.size)
  }
  fun history(id: String, cursor: String?): Map<String, Any?> {
    if (trashed(id)) return mapOf("items" to emptyList<Any>(), "total" to 0, "nextCursor" to null)
    val all = dao.sessions().filter { it.routineId == id && (it.ended || db.records().find(it.occurrenceId)?.let { r -> r.completed || r.skipped } == true) }
      .mapNotNull { saved -> db.records().find(saved.occurrenceId)?.takeIf { !it.deleted }?.let { r ->
        mapOf("occurrenceId" to r.id, "title" to r.title, "deleted" to false) + projection(r)!! } }
    val offset = cursor?.toIntOrNull()?.coerceAtLeast(0) ?: 0
    return mapOf("items" to all.drop(offset).take(50), "total" to all.size,
      "nextCursor" to if (offset + 50 < all.size) (offset + 50).toString() else null)
  }
  private fun checkedText(value: Any?, max: Int, required: Boolean = false): String {
    require(value == null || value is String) { "Enter valid routine text." }
    val text = (value as? String).orEmpty()
    require(text.length <= max && (!required || text.isNotBlank())) { "Enter the required routine name or step." }
    return if (required) text.trim() else text
  }
  @Suppress("UNCHECKED_CAST") private fun checkedVersion(command: Map<String, Any?>, id: String, date: String, revision: Long = 1): RoutineVersion {
    val title = checkedText(command["title"], 200, true)
    val previous = dao.versions(id).maxByOrNull { it.revision }
    require(command["authoringMode"] == null || command["authoringMode"] is String) { "Choose valid routine fields and step arrangement." }
    require(command["presentationPreset"] == null || command["presentationPreset"] is String) { "Choose valid routine fields and step arrangement." }
    val authoringMode = command["authoringMode"] as? String ?: previous?.authoringMode ?: "ByWeekday"
    val presentationPreset = command["presentationPreset"] as? String ?: previous?.presentationPreset ?: "Exercise"
    val number = command["minutes"] as? Number ?: error("Choose a routine time.")
    require(number.toDouble().isFinite() && number.toDouble() % 1 == 0.0 && number.toInt() in 0..1439) { "Choose a routine time." }
    val mode = command["mode"] as? String ?: "Notification"
    require(mode in setOf("Alarm", "Notification", "None")) { "Choose Alarm, Notification or No alert." }
    val notes = checkedText(command["notes"], 10_000)
    val sound = command["sound"] as? String ?: "remilo"
    require(sound in setOf("remilo", "system")) { "Choose Remilo tone or the system alarm tone." }
    require(command["vibration"] == null || command["vibration"] is Boolean) { "Choose a vibration setting." }
    val vibration = command["vibration"] as? Boolean ?: false
    val list = command["listId"] as? String
    require(list == null || db.records().list(list) != null) { "This list no longer exists." }
    val days = command["days"] as? List<*> ?: error("Choose seven routine days.")
    require(days.size == 7) { "Choose seven routine days." }
    val ids = mutableSetOf<String>()
    val validated = days.map { raw ->
      val day = raw as? Map<String, Any?> ?: error("Choose a routine day.")
      require(day["type"] in setOf("Rest", "Exercises")) { "Choose a scheduled day or an unscheduled day." }
      val steps = day["exercises"] as? List<*> ?: emptyList<Any>()
      require(steps.size <= 100 && (day["type"] != "Exercises" || steps.isNotEmpty())) { "Add a step on every scheduled day." }
      mapOf("type" to day["type"], "exercises" to if (day["type"] == "Rest") emptyList<Any>() else steps.map { rawStep ->
        val step = rawStep as? Map<String, Any?> ?: error("Choose a step.")
        val stepId = checkedText(step["id"], 200, true)
        require(ids.add(stepId)) { "Step identities must be unique." }
        val illustration = checkedText(step["illustration"], 80)
        val image = checkedText(step["customImageId"], 64)
        require(image.isEmpty() || image.matches(Regex("[a-f0-9]{64}")) && dao.image(image) != null && ExerciseImages(context).file(image).isFile) { "Choose an available step photo." }
        require(image.isEmpty() || illustration.isEmpty()) { "Choose one step image." }
        require(illustration.isEmpty() || illustration.matches(Regex("[a-z0-9-]+"))) { "Choose an approved illustration reference." }
        val target = checkedText(step["target"],1000)
        val structured = com.remilo.alarm.core.ExerciseTargets.checked(step["exerciseTarget"],target)
        mapOf("id" to stepId, "name" to checkedText(step["name"], 200, true), "target" to target,
          "notes" to checkedText(step["notes"], 10_000), "illustration" to illustration, "customImageId" to image) +
          checkedText(step["sharedStepId"], 200).takeIf { it.isNotEmpty() }?.let { mapOf("sharedStepId" to it) }.orEmpty() +
          structured?.let { mapOf("exerciseTarget" to it) }.orEmpty()
      })
    }
    require(validated.any { it["type"] == "Exercises" }) { "Choose at least one scheduled day, or pause the routine." }
    com.remilo.alarm.core.RoutineAuthoring.validate(JSONArray(validated), authoringMode, presentationPreset)
    return RoutineVersion(id, date, title, number.toInt(), mode, list, JSONArray(validated).toString(), notes, sound, vibration, revision, authoringMode, presentationPreset)
  }
  private fun template(v: RoutineVersion): ReminderRecord {
    val start = LocalDate.parse(v.effectiveDate).atTime(v.minutes / 60, v.minutes % 60).atZone(zone()).toInstant().toEpochMilli()
    return ReminderRecord("template", v.title, start, start + 1_800_000, start, now(),
      mode = v.mode, notes = v.notes, sound = v.sound, definedAlarmAtMs = start, zoneId = zone().id, vibration = v.vibration, listId = v.listId, routineId = v.routineId)
  }
  private fun rule(v: RoutineVersion): Map<String, Any?> = mapOf("frequency" to "weekly", "interval" to 1,
    "weekdays" to rows(v.days).mapIndexedNotNull { i, d -> if (d["type"] == "Exercises") i + 1 else null }, "zoneMode" to "floating")
  private fun response(planId: String): Map<String, Any?> = mapOf("status" to when {
    alerts.all().any { a -> a.segmentId in db.records().series().filter { it.seriesId == planId }.map { it.id } && a.state == "Blocked" } -> "Blocked"
    else -> "Applied" }, "routine" to planView(dao.plan(planId)!!), "segmentId" to planId)

  fun command(command: Map<String, Any?>): Map<String, Any?> {
    val operation = command["operationId"] as String
    val kind = command["kind"] as String
    val fingerprint = fingerprint(command)
    dao.operation(operation)?.let { saved ->
      require(saved.fingerprint == fingerprint) { "This operation was already used. Refresh and try again." }
      if (!saved.applied) settle(saved)
      return map(dao.operation(operation)!!.result)
    }
    require(db.records().receipt(operation) == null) { "This operation was already used. Refresh and try again." }
    if (kind in setOf("TrashRoutine", "RestoreRoutine", "PurgeRoutine")) {
      val plan = dao.plan(command["routineId"] as? String ?: "") ?: return rejected("NOT_FOUND")
      if ((command["expectedRevision"] as? Number)?.toDouble() != plan.revision.toDouble()) return rejected("STALE_REVISION")
      if ((kind == "TrashRoutine") == (plan.state == "Trashed")) return rejected("NOT_ELIGIBLE")
      val payload = JSONObject().put("family", plan.id).put("kind", kind).put("atMs", now()).put("revision", plan.revision + 1)
      val pending = RoutineOperation(operation, fingerprint, null, payload.toString())
      dao.operation(pending); checkpoint("family-captured"); settle(pending)
      reconcile(); return map(dao.operation(operation)!!.result)
    }
    if (kind == "CreateRoutine") {
      val date = checkedDate(command["startsOn"])
      require(date >= today()) { "Choose today or a future start date." }
      val planId = id("remilo-routine:$operation")
      val v = checkedVersion(command, planId, date.toString())
      series.create("routine-series:$operation", template(v), rule(v), allocatedId = planId, checkpoint = {
        dao.plan(RoutinePlan(planId, startsOn = date.toString())); dao.version(v)
        db.records().receipt(CreationReceipt(operation, planId, kind))
        dao.operation(RoutineOperation(operation, fingerprint, null, "{}", true, JSONObject(response(planId)).toString()))
      })
      reconcile(); return response(planId).also { dao.operation(dao.operation(operation)!!.copy(result = JSONObject(it).toString())) }
    }
    if (kind in setOf("EditRoutine", "PauseRoutine", "ResumeRoutine")) {
      val plan = dao.plan(command["routineId"] as? String ?: "") ?: return rejected("NOT_FOUND")
      if (plan.state == "Trashed") return rejected("IN_TRASH")
      if ((command["expectedRevision"] as? Number)?.toDouble() != plan.revision.toDouble()) return rejected("STALE_REVISION")
      val segments = db.records().series().filter { it.seriesId == plan.id && it.state != "Archived" }
      if (kind == "EditRoutine") {
        val date = maxOf(today(), LocalDate.parse(plan.startsOn))
        checkedVersion(command, plan.id, date.toString(), plan.revision + 1)
        val payload = JSONObject().put("edit", JSONObject(command)).put("date", date.toString()).put("atMs", now())
        val pending = RoutineOperation(operation, fingerprint, null, payload.toString())
        dao.operation(pending); checkpoint("edit-captured"); settleEdit(pending)
      } else {
        val segment = segments.maxByOrNull { it.createdAtMs } ?: return rejected("NOT_FOUND")
        if(kind == "PauseRoutine") dao.dated(plan.id,today().toString())?.takeIf { !it.ended }?.let { saved ->
          alerts.find(saved.occurrenceId)?.let { alert ->
            alerts.put(alert.copy(state = "Paused",generation = alert.generation + 1,sessionId = null))
            try { scheduler.cancel(alert) } catch (_: Exception) { }
            AlarmNotifications(context).clearAttention(alert.occurrenceId); alert.sessionId?.let(deliveryChanged)
          }
        }
        val intervals = JSONArray(plan.pauses)
        if (kind == "PauseRoutine" && plan.state != "Paused") intervals.put(JSONObject().put("from", now()).put("until", JSONObject.NULL))
        if (kind == "ResumeRoutine" && plan.state == "Paused" && intervals.length() > 0) intervals.getJSONObject(intervals.length() - 1).put("until", now())
        series.mutate("routine-series:$operation", mapOf("kind" to if (kind == "PauseRoutine") "PauseSeries" else "ResumeSeries",
          "segmentId" to segment.id, "expectedRevision" to segment.revision), checkpoint = {
          dao.plan(plan.copy(state = if (kind == "PauseRoutine") "Paused" else "Active", revision = plan.revision + 1, pauses = intervals.toString()))
          db.records().receipt(CreationReceipt(operation, plan.id, kind))
          dao.operation(RoutineOperation(operation, fingerprint, null, "{}", true, JSONObject(response(plan.id)).toString()))
        })
      }
      reconcile(); return response(plan.id).also { dao.operation(dao.operation(operation)!!.copy(result = JSONObject(it).toString())) }
    }
    val record = db.records().find(command["occurrenceId"] as? String ?: "") ?: return rejected("NOT_FOUND")
    val session = dao.session(record.id) ?: return rejected("NOT_FOUND")
    if (record.deleted || trashed(record.routineId)) return rejected("IN_TRASH")
    if (rows(session.steps).isEmpty()) return rejected("NOT_ELIGIBLE")
    if (command["date"] != session.date) return rejected("STALE_DATE")
    val actionAt = now()
    val historical = kind == "CorrectRoutineExercise"
    if (!historical && !RoutinePolicy.open(session.date, session.ended, actionAt, zone())) return rejected("DAY_ENDED")
    if (historical && !session.ended) return rejected("DAY_NOT_ENDED")
    if ((command["expectedRevision"] as? Number)?.toDouble() != session.revision.toDouble()) return rejected("STALE_REVISION")
    var skipped = record.skipped
    val done = strings(session.done).toMutableSet()
    if (kind in setOf("SetRoutineExercise", "CorrectRoutineExercise")) {
      require(!record.skipped || historical) { "Undo Skip today before changing steps." }
      val stepId = command["stepId"] as? String ?: error("Choose a step.")
      require(rows(session.steps).any { it["id"] == stepId }) { "Choose a step from this session." }
      require(command["completed"] is Boolean) { "Choose the step completion state." }
      if (command["completed"] == true) done.add(stepId) else done.remove(stepId)
    } else if (kind == "SkipRoutineDay") { if (record.completed) return rejected("NOT_ELIGIBLE"); skipped = true }
    else if (kind == "UndoSkipRoutineDay") skipped = false
    else return rejected("UNSUPPORTED_COMMAND")
    val payload = JSONObject().put("done", JSONArray(done.toList())).put("skipped", skipped)
      .put("atMs", actionAt).put("kind", kind).put("stepId", command["stepId"] ?: JSONObject.NULL)
      .put("revision", session.revision + 1).put("recordRevision", record.revision + 1)
      .put("generation", (alerts.find(record.id)?.generation ?: 0) + 1)
    val pending = RoutineOperation(operation, fingerprint, record.id, payload.toString())
    dao.operation(pending); checkpoint("captured")
    settle(pending)
    return map(dao.operation(operation)!!.result)
  }
  private fun rejected(code: String): Map<String, Any?> = mapOf("status" to "Rejected", "errorCode" to code,
    "errorMessage" to when (code) {
      "DAY_ENDED" -> "This day has ended. Corrections update history only."
      "DAY_NOT_ENDED" -> "Use today's exercise controls while this day is open."
      "STALE_DATE" -> "This routine date changed. Open the dated session again."
      else -> null
    })
  private fun settle(operation: RoutineOperation) {
    if (JSONObject(operation.payload).has("edit")) { settleEdit(operation); return }
    if (JSONObject(operation.payload).has("family")) { settleFamily(operation); return }
    val id = operation.occurrenceId ?: return
    val record = db.records().find(id) ?: run { dao.purgeOperations(id); return }
    val session = dao.session(id) ?: return
    val payload = JSONObject(operation.payload)
    val changes = JSONArray(session.changes).put(JSONObject().put("id", operation.operationId)
      .put("kind", payload.getString("kind")).put("stepId", payload.opt("stepId"))
      .put("completed", if (payload.isNull("stepId")) JSONObject.NULL else strings(payload.getJSONArray("done").toString()).contains(payload.getString("stepId")))
      .put("atMs", payload.getLong("atMs")))
    val updated = session.copy(done = payload.getJSONArray("done").toString(), revision = payload.getLong("revision"), changes = changes.toString())
    val skipped = payload.getBoolean("skipped")
    val finished = completed(updated) && !skipped
    val changesDelivery = finished != record.completed || skipped != record.skipped
    val alert = alerts.find(id)
    if (changesDelivery && alert != null && alert.generation < payload.getLong("generation")) {
      alerts.put(alert.copy(generation = payload.getLong("generation"), state = "Changing", previousState = alert.state, sessionId = null))
      try { scheduler.cancel(alert) } catch (_: Exception) { /* fenced */ }
      AlarmNotifications(context).clearAttention(id)
    }
    if (changesDelivery) alert?.sessionId?.let(deliveryChanged)
    checkpoint("fenced")
    db.runInTransaction {
      dao.session(updated)
      db.records().update(record.copy(completed = finished, skipped = skipped, revision = payload.getLong("recordRevision")))
      db.records().history(HistoryRecord(operation.operationId, id, payload.getString("kind"), payload.getLong("atMs"), payload.getLong("generation")))
      if (finished && !record.completed) db.records().history(HistoryRecord(operation.operationId + ":aggregate", id, "Done", payload.getLong("atMs"), payload.getLong("generation")))
      if (skipped && !record.skipped) db.records().history(HistoryRecord(operation.operationId + ":skip", id, "Skip", payload.getLong("atMs"), payload.getLong("generation")))
      val response = mapOf("status" to "Applied", "routineSession" to (mapOf("occurrenceId" to id, "title" to record.title, "deleted" to record.deleted) + projection(db.records().find(id)!!)!!))
      dao.operation(operation.copy(applied = true, result = JSONObject(response).toString()))
      checkpoint("before-commit")
    }
    checkpoint("committed")
    syncDelivery(db.records().find(id)!!, updated)
  }
  /** Saved edits update the open civil day in the same CE commit as the plan.
   * The original occurrence/nominal identity survives; elapsed prompts never replay. */
  private fun settleEdit(operation: RoutineOperation) {
    val payload = JSONObject(operation.payload)
    val input = map(payload.getJSONObject("edit").toString())
    val plan = dao.plan(input["routineId"] as String) ?: return
    val date = LocalDate.parse(payload.getString("date"))
    val v = checkedVersion(input, plan.id, date.toString(), plan.revision + 1)
    val saved = dao.dated(plan.id,date.toString())?.takeIf { !it.ended && date == today() }
    saved?.let { session -> alerts.find(session.occurrenceId)?.let { alert ->
      if (alert.state != "Changing") {
        val target = date.atTime(v.minutes / 60,v.minutes % 60).atZone(zone()).toInstant().toEpochMilli()
        alerts.put(alert.copy(state = "Changing", previousState = alert.state, generation = alert.generation + 1, sessionId = null,
          targetMs = target, mode = v.mode, sound = v.sound, vibration = v.vibration, exception = true))
        try { scheduler.cancel(alert) } catch (_: Exception) { }
        AlarmNotifications(context).clearAttention(alert.occurrenceId)
        alert.sessionId?.let(deliveryChanged)
      }
    } }
    checkpoint("edit-fenced")
    series.replaceRoutine("routine-series:${operation.operationId}", plan.id, template(v), rule(v), date.atStartOfDay(), checkpoint = {
      dao.version(v); dao.plan(plan.copy(revision = plan.revision + 1))
      saved?.let { session -> db.records().find(session.occurrenceId)?.let { record ->
        val nextSteps = if(rest(v,date)) emptyList() else exercises(v,date)
        val retained = strings(session.done).intersect(nextSteps.map { it["id"] as String }.toSet())
        val changes = JSONArray(session.changes).put(JSONObject().put("id",operation.operationId).put("kind","EditRoutine")
          .put("stepId",JSONObject.NULL).put("atMs",payload.getLong("atMs")))
        dao.session(session.copy(versionDate = v.effectiveDate, versionRevision = v.revision, steps = JSONArray(nextSteps).toString(),
          done = JSONArray(retained.toList()).toString(), revision = session.revision + 1, changes = changes.toString()))
        val target = date.atTime(v.minutes / 60,v.minutes % 60).atZone(zone()).toInstant().toEpochMilli()
        db.records().update(record.copy(title = v.title, notes = v.notes, mode = v.mode, sound = v.sound, vibration = v.vibration,
          listId = v.listId, zoneId = zone().id, eventStartMs = target, eventEndMs = target + 1_800_000, dueAtMs = target, definedAlarmAtMs = target,
          exception = true, completed = nextSteps.isNotEmpty() && retained.size == nextSteps.size && !record.skipped, revision = record.revision + 1))
      } }
      db.records().receipt(CreationReceipt(operation.operationId,plan.id,"EditRoutine"))
      dao.operation(operation.copy(applied = true,result = JSONObject(response(plan.id)).toString()))
      checkpoint("edit-before-commit")
    })
    checkpoint("edit-committed")
  }
  private fun syncDelivery(record: ReminderRecord, session: RoutineSession) {
    var alert = alerts.find(record.id) ?: return
    val oldSession = alert.sessionId
    if (!alert.dayStarted) { alert = alert.copy(dayStarted = true); alerts.put(alert) }
    if (session.ended && !alert.dayEnded) { alert = alert.copy(dayEnded = true); alerts.put(alert) }
    val terminal = when { record.deleted || trashed(record.routineId) -> "Deleted"; rows(session.steps).isEmpty() -> if(session.ended) "Expired" else "Paused"; record.skipped -> "Skipped"; record.completed -> "Completed"; session.ended -> "Expired"; else -> null }
    if (terminal != null) {
      if (alert.state != terminal) {
        alerts.put(alert.copy(state = terminal, generation = alert.generation + 1, previousState = null, sessionId = null))
        try { scheduler.cancel(alert) } catch (_: Exception) { /* fenced */ }
      }
      AlarmNotifications(context).clearAttention(record.id)
    } else if (dao.plan(session.routineId)?.state == "Paused" && alert.state != "Paused") {
      alerts.put(alert.copy(state = "Paused", generation = alert.generation + 1, previousState = null, sessionId = null))
      try { scheduler.cancel(alert) } catch (_: Exception) { }
      AlarmNotifications(context).clearAttention(record.id)
    } else if (alert.state in setOf("Changing", "Completed", "Skipped", "Expired", "Deleted", "Replaced", "Paused") && dao.plan(session.routineId)?.state == "Active") {
      register(alert.copy(state = "Pending", generation = alert.generation + 1, previousState = null))
    }
    if (oldSession != null && alerts.find(record.id)?.sessionId != oldSession) deliveryChanged(oldSession)
  }
  private fun ensureSession(record: ReminderRecord) {
    if (dao.session(record.id) != null || db.records().purged(record.id) != null) return
    val planId = record.routineId ?: return
    val date = nominalDate(record)
    if (dao.dated(planId, date) != null) {
      // A later segment can reuse a civil date after clock travel. The original
      // snapshot owns that date permanently; a new occurrence cannot reopen it.
      alerts.find(record.id)?.let { alert ->
        val terminal = if (alert.state in setOf("Deleted", "Replaced")) alert.state else "Expired"
        if (!alert.dayEnded || alert.state != terminal || alert.sessionId != null) {
          alerts.put(alert.copy(state = terminal, dayEnded = true, generation = alert.generation + 1, sessionId = null))
          try { scheduler.cancel(alert) } catch (_: Exception) { }
          alert.sessionId?.let(deliveryChanged)
        }
        AlarmNotifications(context).clearAttention(record.id)
      }
      return
    }
    if (date > today().toString() || alerts.find(record.id)?.state == "Replaced") return
    val plan = dao.plan(planId) ?: return
    if (plan.state == "Trashed" || rows(plan.trashIntervals).any { interval ->
        val dateStart = LocalDate.parse(date).atStartOfDay(zone()).toInstant().toEpochMilli()
        val dateEnd = RoutinePolicy.end(LocalDate.parse(date), zone())
        (interval["from"] as Number).toLong() <= dateStart && (interval["until"] == null || (interval["until"] as Number).toLong() >= dateEnd)
      }) return
    val v = version(planId, date) ?: return
    if (date == today().toString() && plan.state == "Paused" || date < today().toString() && pausedAt(plan, record.definedAlarmAtMs!!)) return
    val day = LocalDate.parse(date)
    if (rest(v, day)) return
    dao.session(RoutineSession(record.id, planId, date, v.effectiveDate, JSONArray(exercises(v, day)).toString(), ended = day < today() || alerts.find(record.id)?.dayEnded == true, versionRevision = v.revision))
  }
  fun recoverOperations() { dao.pending().forEach { settle(it) } }
  fun reconcile() {
    recoverOperations()
    // The two future alarm registrations do not guarantee a slot for an elapsed
    // notification today. Resolve that date explicitly, using the same identity.
    for (plan in dao.plans().filter { it.state == "Active" && it.startsOn <= today().toString() }) {
      if (dao.dated(plan.id, today().toString()) == null) {
        val segment = db.records().series().filter { it.seriesId == plan.id && it.state != "Archived" }.firstOrNull { segment ->
          val r = RuleCodec.decode(segment.rule)
          val nominal = today().atTime(r.anchor.toLocalTime())
          nominal >= r.anchor && (r.endExclusive == null || nominal < r.endExclusive) && today().dayOfWeek.value in r.weekdays
        }
        if (segment != null) {
          val rule = RuleCodec.decode(segment.rule)
          val nominal = today().atTime(rule.anchor.toLocalTime()).toString()
          val record = series.calendarOccurrence(segment.id, nominal)
          if (db.records().purged(record.id) == null) {
            if (db.records().find(record.id) == null) db.records().insert(record)
            if (alerts.find(record.id) == null) register(AlertRecord(record.id, record.definedAlarmAtMs!!, 1, "Pending", mode = record.mode,
              segmentId = segment.id, nominalSlot = nominal, resolvedZone = zone().id, profile = RoutinePolicy.PROFILE,
              expiresAtMs = RoutinePolicy.end(today(), zone())))
          }
        }
      }
    }
    db.records().all().filter { it.routineId != null }.forEach { ensureSession(it) }
    dao.sessions().forEach { saved ->
      val ended = saved.ended || saved.date != today().toString() || alerts.find(saved.occurrenceId)?.dayEnded == true
      val session = if (ended != saved.ended) saved.copy(ended = ended, revision = saved.revision + 1).also { dao.session(it) } else saved
      if (!session.ended && session.date == today().toString()) alerts.find(session.occurrenceId)?.let { alert ->
        val expiry = RoutinePolicy.end(today(), zone())
        if (alert.expiresAtMs != expiry && alert.state != "Expired") alerts.put(alert.copy(expiresAtMs = expiry))
      }
      db.records().find(session.occurrenceId)?.let { syncDelivery(it, session) }
    }
  }
  fun purge(id: String) { dao.purgeSession(id); dao.purgeOperations(id) }
  private fun settleFamily(operation: RoutineOperation) {
    val payload = JSONObject(operation.payload); val id = payload.getString("family"); val kind = payload.getString("kind")
    val plan = dao.plan(id) ?: return
    val segments = db.records().series().filter { it.seriesId == id }
    // Publish a content-free DP fence before changing private family ownership.
    segments.forEach { segment -> alerts.plan(segment.id)?.let { alerts.plan(it.copy(state = "Paused")) } }
    val deliveries = alerts.all().filter { a -> a.segmentId in segments.map { it.id } }
    deliveries.forEach { alert ->
      alerts.put(alert.copy(state = "Deleted", generation = alert.generation + 1, sessionId = null, previousState = null))
      try { scheduler.cancel(alert) } catch (_: Exception) { /* generation already fenced */ }
      AlarmNotifications(context).clearAttention(alert.occurrenceId)
      alert.sessionId?.let(deliveryChanged)
    }
    checkpoint("family-fenced")
    db.runInTransaction {
      if (kind == "PurgeRoutine") {
        db.records().all().filter { it.routineId == id }.forEach { record ->
          if (db.records().purged(record.id) == null) db.records().purge(PurgedOccurrence(record.id, record.segmentId, record.nominalSlot))
          db.records().purgePending(record.id); db.records().purgeHistory(record.id); db.records().purgeReminder(record.id); purge(record.id)
        }
        dao.purge(PurgedRoutine(id)); dao.removeVersions(id); dao.removePlan(id); db.records().purgeSeriesFamily(id)
      } else {
        // Ownership transitions fence cached app/widget commands even when a
        // Restore returns to the same date with identical exercise checkmarks.
        db.records().all().filter { it.routineId == id }.forEach { db.records().update(it.copy(revision = it.revision + 1)) }
        dao.sessions().filter { it.routineId == id }.forEach { dao.session(it.copy(revision = it.revision + 1)) }
        val intervals = JSONArray(plan.trashIntervals)
        if (kind == "TrashRoutine") intervals.put(JSONObject().put("from", payload.getLong("atMs")).put("until", JSONObject.NULL))
        else if (intervals.length() > 0) intervals.getJSONObject(intervals.length() - 1).put("until", payload.getLong("atMs"))
        val state = if (kind == "TrashRoutine") "Trashed" else plan.priorState
        dao.plan(plan.copy(state = state, priorState = if (kind == "TrashRoutine") plan.state else plan.priorState,
          revision = payload.getLong("revision"), trashedAtMs = if (kind == "TrashRoutine") payload.getLong("atMs") else 0, trashIntervals = intervals.toString()))
        segments.forEach { segment ->
          val segmentState = if (segment.state == "Archived") "Archived" else if (state == "Active") "Active" else "Paused"
          db.records().series(segment.copy(state = segmentState, revision = segment.revision + 1))
          db.records().pendingSeries(PendingSeries("${operation.operationId}:${segment.id}", segment.id))
        }
      }
      val result = mapOf("status" to "Applied", "routine" to dao.plan(id)?.let(::planView))
      dao.operation(operation.copy(applied = true, result = JSONObject(result).toString()))
      db.records().receipt(CreationReceipt(operation.operationId, id, kind))
      checkpoint("family-before-commit")
    }
    checkpoint("family-committed"); series.recover()
  }
  fun removeList(id: String) {
    val affected = dao.versions().filter { it.listId == id }
    dao.clearVersionList(id)
    affected.map { it.routineId }.distinct().forEach { planId -> dao.plan(planId)?.let { dao.plan(it.copy(revision = it.revision + 1)) } }
  }
}

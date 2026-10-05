package com.remilo.alarm.engine

import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.os.SystemClock
import android.os.UserManager
import android.util.Log
import com.remilo.alarm.core.AlarmPolicy
import com.remilo.alarm.data.*
import com.remilo.alarm.system.*
import java.util.UUID
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.time.Instant
import java.time.ZoneId

/** The process-lifetime serialized owner. This class has no Expo/React imports. */
class AlarmEngine internal constructor(private val context: Context,
  private val scheduler: AlarmRegistrar = AlarmScheduler(context),
  private val now: () -> Long = System::currentTimeMillis,
  private val elapsed: () -> Long = SystemClock::elapsedRealtime) {
  private val worker = Executors.newSingleThreadExecutor { task -> Thread(task, "Remilo-state") }
  private val operational = OperationalDatabase.open(context)
  private val alerts = operational.records()
  private var content: ContentDatabase? = null
  private val listeners = CopyOnWriteArrayList<() -> Unit>()
  private var previewAudio: AlarmAudio? = null
  private class InputError(val field: String, message: String) : IllegalArgumentException(message)
  private fun validate(valid: Boolean, field: String, message: String) {
    if (!valid) throw InputError(field, message)
  }

  init {
    AlarmNotifications(context)
    submit {
      // A surviving row from a prior process is evidence of interruption, not a
      // request to restart playback. Monotonic values never cross process recovery.
      alerts.activeSession()?.let { endSession(it.id, "Interrupted") }
    }
  }

  private fun unlocked() = context.getSystemService(UserManager::class.java).isUserUnlocked
  private fun content(): ContentDatabase {
    check(unlocked()) { "User must unlock first" }
    return content ?: ContentDatabase.open(context).also { content = it }
  }
  private fun submit(finished: () -> Unit = {}, task: () -> Unit) {
    worker.execute {
      try { task() } catch (error: Exception) {
        Log.e("Remilo", "Native operation failed: ${error.javaClass.simpleName}")
      } finally { finished() }
    }
  }
  private fun changed() { listeners.forEach { try { it() } catch (_: Exception) { /* detached bridge */ } } }
  fun observe(listener: () -> Unit): AutoCloseable {
    listeners.add(listener)
    return AutoCloseable { listeners.remove(listener) }
  }
  fun request(block: () -> Any?, resolve: (Any?) -> Unit, reject: (String) -> Unit) {
    submit {
      try { resolve(block()) } catch (_: BackupLimitException) { reject("BACKUP_TOO_LARGE") }
      catch (_: IllegalArgumentException) { reject("INVALID_INPUT") }
      catch (_: IllegalStateException) { reject("NOT_AVAILABLE") }
      catch (_: Exception) { reject("STORAGE_ERROR") }
    }
  }

  fun capabilities(): Map<String, Any> {
    val manager = context.getSystemService(NotificationManager::class.java)
    val channel = manager.getNotificationChannel(AlarmNotifications.RINGING_CHANNEL)
    val notificationChannel = manager.getNotificationChannel(AlarmNotifications.NOTIFICATION_CHANNEL)
    return mapOf("exactAlarms" to scheduler.canSchedule(),
      "notifications" to manager.areNotificationsEnabled(),
      "channelEnabled" to (channel == null || channel.importance != NotificationManager.IMPORTANCE_NONE),
      "notificationChannelEnabled" to (notificationChannel == null || notificationChannel.importance != NotificationManager.IMPORTANCE_NONE),
      "fullScreen" to manager.canUseFullScreenIntent(), "unlocked" to unlocked(),
      "activeSessionId" to (alerts.activeSession()?.id ?: ""),
      "observedAtMs" to now())
  }

  private fun ready(mode: String = "Alarm"): Boolean {
    val capabilities = capabilities()
    return (mode != "Alarm" || capabilities["exactAlarms"] == true) && capabilities["notifications"] == true &&
      capabilities[if (mode == "Notification") "notificationChannelEnabled" else "channelEnabled"] == true
  }
  fun query(filter: String, cursor: String?): Map<String, Any?> = query(mapOf("view" to filter), cursor)
  fun query(filter: Map<String, Any?>, cursor: String?): Map<String, Any?> {
    val db = content()
    replayHistory(db)
    val day = Instant.ofEpochMilli(now()).atZone(ZoneId.systemDefault()).toLocalDate()
    val start = day.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
    val end = day.plusDays(1).atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
    val search = (filter["search"] as? String)?.trim().orEmpty()
    val records = db.records().all().filter { record ->
      val alert = alerts.find(record.id)
      val selected = when (filter["view"]) {
        "deleted" -> record.deleted
        "history" -> !record.deleted && record.completed
        "attention" -> !record.deleted && !record.completed && (record.dueAtMs < now() ||
          alert?.state in setOf("Missed", "Stopped", "TimedOut", "Interrupted", "Blocked", "Failed", "Notified", "Changing"))
        "today" -> !record.deleted && !record.completed && (record.dueAtMs in start until end ||
          alert?.targetMs?.let { it in start until end } == true)
        "upcoming" -> !record.deleted && !record.completed && (record.dueAtMs >= end ||
          alert?.targetMs?.let { it >= end } == true)
        else -> !record.deleted && !record.completed
      }
      selected && (search.isEmpty() || record.title.contains(search, true) || record.notes.contains(search, true)) &&
        ((filter["listName"] as? String).isNullOrEmpty() || record.listName == filter["listName"])
    }
    val offset = cursor?.toIntOrNull()?.coerceAtLeast(0) ?: 0
    val page = records.drop(offset).take(50)
    return mapOf("items" to page.map { view(it) },
      "nextCursor" to if (offset + page.size < records.size) (offset + page.size).toString() else null)
  }
  fun occurrence(id: String): Map<String, Any?>? {
    val db = content()
    replayHistory(db)
    return db.records().find(id)?.let { view(it) + ("history" to db.records().history(id).map { history ->
      mapOf("kind" to history.kind, "atMs" to history.occurredAtMs, "targetMs" to history.targetMs)
    }) }
  }
  private fun view(record: ReminderRecord): Map<String, Any?> {
    val alert = alerts.find(record.id)
    return mapOf("id" to record.id, "title" to record.title, "eventStartMs" to record.eventStartMs,
      "eventEndMs" to record.eventEndMs, "dueAtMs" to record.dueAtMs, "completed" to record.completed,
      "revision" to record.revision, "nextAlertMs" to alert?.targetMs,
      "generation" to (alert?.generation ?: 0L), "deliveryState" to (alert?.state ?: "Pending"),
      "notes" to record.notes, "listName" to record.listName, "mode" to record.mode,
      "alarmAtMs" to (record.definedAlarmAtMs ?: record.eventStartMs), "allDay" to record.allDay,
      "zoneId" to record.zoneId.ifEmpty { ZoneId.systemDefault().id }, "dueLinked" to record.dueLinked,
      "alarmLinked" to record.alarmLinked, "deleted" to record.deleted, "sound" to record.sound,
      "vibration" to record.vibration, "overdue" to (!record.completed && record.dueAtMs < now()))
  }
  private fun epoch(value: Any?, field: String): Long {
    val number = (value as? Number)?.toDouble() ?: throw InputError(field, "Choose a valid date and time.")
    validate(number.isFinite() && number >= 0 && number <= 8_640_000_000_000_000L && number % 1.0 == 0.0,
      field, "Choose a valid date and time.")
    return number.toLong()
  }
  fun preview(draft: Map<String, Any?>): Map<String, Any> {
    val record = draft(draft + ("title" to (draft["title"] ?: "Preview")), "preview")
    return mapOf("alarmAtMs" to record.definedAlarmAtMs!!, "eventStartMs" to record.eventStartMs,
      "eventEndMs" to record.eventEndMs, "dueAtMs" to record.dueAtMs,
      "warnings" to if (record.mode != "None" && record.definedAlarmAtMs <= now())
        listOf("The alert is in the past. Choose a future time before saving.") else emptyList<String>())
  }
  private fun text(command: Map<String, Any?>, field: String, fallback: String, maximum: Int): String {
    val value = if (command.containsKey(field)) command[field] as? String
      ?: throw InputError(field, "Enter valid text.") else fallback
    validate(value.length <= maximum, field, "Use at most $maximum characters.")
    return value
  }
  private fun flag(command: Map<String, Any?>, field: String, fallback: Boolean): Boolean =
    if (command.containsKey(field)) command[field] as? Boolean
      ?: throw InputError(field, "Choose a valid option.") else fallback
  private fun integer(value: Any?, field: String, minimum: Int, maximum: Int): Int {
    val number = (value as? Number)?.toDouble() ?: throw InputError(field, "Enter a whole number.")
    validate(number.isFinite() && number % 1 == 0.0 && number in minimum.toDouble()..maximum.toDouble(),
      field, "Choose a whole number from $minimum to $maximum.")
    return number.toInt()
  }
  private fun draft(command: Map<String, Any?>, id: String, old: ReminderRecord? = null): ReminderRecord {
    val settings = content().records().settings() ?: SettingsRecord()
    val title = text(command, "title", old?.title ?: "", 200).trim()
    validate(title.isNotEmpty(), "title", "Enter a title of 1–200 characters.")
    val mode = text(command, "mode", old?.mode ?: "Alarm", 20)
    validate(mode in setOf("Alarm", "Notification", "None"), "mode", "Choose an alert mode.")
    val zoneName = text(command, "zoneId", old?.zoneId?.ifEmpty { ZoneId.systemDefault().id } ?: ZoneId.systemDefault().id, 100)
    val zone = try { ZoneId.of(zoneName) } catch (_: Exception) { throw InputError("zoneId", "Choose a valid time zone.") }
    val allDay = flag(command, "allDay", old?.allDay ?: false)
    val dueLinked = flag(command, "dueLinked", old?.dueLinked ?: true)
    val alarmLinked = flag(command, "alarmLinked", old?.alarmLinked ?: true)
    val explicitAlarm = if (command.containsKey("alarmAtMs")) epoch(command["alarmAtMs"], "alarmAtMs") else null
    val rawStart = epoch(command["eventStartMs"] ?: old?.eventStartMs ?: explicitAlarm ?: now() + 600_000, "eventStartMs")
    val day = Instant.ofEpochMilli(rawStart).atZone(zone).toLocalDate()
    val start = if (allDay) day.atStartOfDay(zone).toInstant().toEpochMilli() else rawStart
    val end = if (allDay) day.plusDays(1).atStartOfDay(zone).toInstant().toEpochMilli()
      else epoch(command["eventEndMs"] ?: old?.let { it.eventEndMs + start - it.eventStartMs } ?: start + 1_800_000, "eventEndMs")
    validate(end > start, "eventEndMs", "Event end must follow event start.")
    val defaultDue = if (allDay && dueLinked) end else old?.let { if (dueLinked) it.dueAtMs + start - it.eventStartMs else it.dueAtMs } ?: start
    val due = epoch(command["dueAtMs"] ?: defaultDue, "dueAtMs")
    val defaultAlarm = if (allDay && alarmLinked) day.atTime(9, 0).atZone(zone).toInstant().toEpochMilli()
      else old?.let { (it.definedAlarmAtMs ?: it.eventStartMs) + if (alarmLinked) due - it.dueAtMs else 0 } ?: due
    val alarm = explicitAlarm ?: epoch(defaultAlarm, "alarmAtMs")
    val sound = text(command, "sound", old?.sound ?: settings.sound, 20)
    validate(sound in setOf("remilo", "system"), "sound", "Choose Remilo tone or the system alarm tone.")
    return ReminderRecord(id, title, start, end, due, old?.createdAtMs ?: now(), old?.completed ?: false,
      (old?.revision ?: 0) + 1, text(command, "notes", old?.notes ?: "", 10_000),
      text(command, "listName", old?.listName ?: "", 60).trim(), mode, alarm, allDay, zone.id,
      dueLinked, alarmLinked, old?.deleted ?: false, sound, flag(command, "vibration", old?.vibration ?: settings.vibration))
  }
  private fun projection(operation: String, record: ReminderRecord, generation: Long): PendingSchedule =
    PendingSchedule(operation, record.id, record.definedAlarmAtMs ?: record.eventStartMs, generation,
      record.mode, record.sound, record.vibration, (content().records().settings() ?: SettingsRecord()).snoozeMinutes,
      !record.completed && !record.deleted)
  private fun modify(operation: String, command: Map<String, Any?>): Map<String, Any?> {
    val db = content()
    val kind = command["kind"] as String
    val id = text(command, "occurrenceId", "", 200)
    db.records().receipt(operation)?.let {
      validate(it.kind == kind && it.occurrenceId == id, "operationId", "This operation was already used. Refresh and try again.")
      applyPending(db); return result(id)
    }
    val old = db.records().find(id) ?: return mapOf("status" to "Rejected", "errorCode" to "NOT_FOUND")
    val expected = epoch(command["expectedRevision"], "expectedRevision")
    if (old.revision != expected) return mapOf("status" to "Rejected", "errorCode" to "STALE_REVISION",
      "errorField" to "expectedRevision", "errorMessage" to "This reminder changed. Refresh before editing.")
    val record = when (kind) {
      "Edit" -> draft(command, id, old).also {
        val changedTime = it.definedAlarmAtMs != (old.definedAlarmAtMs ?: old.eventStartMs) || it.mode != old.mode
        validate(!changedTime || it.mode == "None" || it.completed || it.definedAlarmAtMs!! > now(), "alarmAtMs", "Choose an alarm time in the future.")
      }
      "Done" -> old.copy(completed = true, revision = old.revision + 1)
      "Reopen" -> old.copy(completed = false, revision = old.revision + 1)
      "Delete" -> old.copy(deleted = true, revision = old.revision + 1)
      "UndoDelete" -> old.copy(deleted = false, revision = old.revision + 1)
      else -> error("Unsupported content command")
    }
    val previous = alerts.find(id)
    val changedDefinition = record.definedAlarmAtMs != (old.definedAlarmAtMs ?: old.eventStartMs) || record.mode != old.mode
    val affectsDelivery = kind != "Edit" || changedDefinition || record.sound != old.sound || record.vibration != old.vibration
    if (!affectsDelivery) {
      db.runInTransaction {
        db.records().update(record)
        db.records().receipt(CreationReceipt(operation, id, kind))
        db.records().history(HistoryRecord(operation, id, kind, now(), previous?.generation ?: 0))
      }
      previous?.sessionId?.let { RingingService.refresh(context, it) }
      changed(); return result(id)
    }
    val generation = maxOf(previous?.generation ?: 0, db.records().pending().filter { it.occurrenceId == id }.maxOfOrNull { it.generation } ?: 0) + 1
    // Fence first. If the CE commit is interrupted, Changing is recovered from
    // the last committed definition, never from an obsolete outbox or callback.
    alerts.put((previous ?: AlertRecord(id, record.definedAlarmAtMs!!, 0, "Pending"))
      .copy(generation = generation, state = "Changing", sessionId = null, previousState = previous?.state))
    previous?.let {
      try { scheduler.cancel(it) } catch (_: Exception) { /* stale generation remains fenced */ }
      it.sessionId?.let { session -> RingingService.refresh(context, session) }
    }
    db.runInTransaction {
      db.records().update(record)
      db.records().pending(projection(operation, record, generation).copy(
        targetMs = if (changedDefinition) record.definedAlarmAtMs!! else previous?.targetMs ?: record.definedAlarmAtMs!!))
      db.records().receipt(CreationReceipt(operation, id, kind))
      db.records().history(HistoryRecord(operation, id, kind, now(), generation, record.definedAlarmAtMs))
    }
    AlarmNotifications(context).clearAttention(id)
    applyPending(db); changed()
    return result(id)
  }
  fun settings(): Map<String, Any> {
    val settings = content().records().settings() ?: SettingsRecord()
    return mapOf("revision" to settings.revision, "snoozeMinutes" to settings.snoozeMinutes,
      "tomorrowMorning" to settings.tomorrowMorning, "tomorrowAfternoon" to settings.tomorrowAfternoon,
      "tomorrowEvening" to settings.tomorrowEvening, "sound" to settings.sound,
      "vibration" to settings.vibration, "theme" to settings.theme)
  }
  fun lists(): List<String> = content().records().all().filter { !it.deleted }.map { it.listName }
    .filter { it.isNotEmpty() }.distinct().sorted()
  private fun updateSettings(operation: String, command: Map<String, Any?>): Map<String, Any?> {
    val db = content()
    val old = db.records().settings() ?: SettingsRecord()
    if (old.lastOperationId == operation) return mapOf("status" to "Applied")
    if (epoch(command["expectedRevision"], "expectedRevision") != old.revision)
      return mapOf("status" to "Rejected", "errorCode" to "STALE_REVISION", "errorMessage" to "Refresh settings and try again.")
    val sound = text(command, "sound", old.sound, 20)
    val theme = text(command, "theme", old.theme, 20)
    validate(sound in setOf("remilo", "system"), "sound", "Choose a valid sound.")
    validate(theme in setOf("system", "light", "dark"), "theme", "Choose a valid appearance.")
    val next = old.copy(revision = old.revision + 1,
      snoozeMinutes = integer(command["snoozeMinutes"] ?: old.snoozeMinutes, "snoozeMinutes", 1, 1440),
      tomorrowMorning = integer(command["tomorrowMorning"] ?: old.tomorrowMorning, "tomorrowMorning", 0, 1439),
      tomorrowAfternoon = integer(command["tomorrowAfternoon"] ?: old.tomorrowAfternoon, "tomorrowAfternoon", 0, 1439),
      tomorrowEvening = integer(command["tomorrowEvening"] ?: old.tomorrowEvening, "tomorrowEvening", 0, 1439),
      sound = sound, vibration = flag(command, "vibration", old.vibration), theme = theme, lastOperationId = operation)
    db.records().settings(next)
    alerts.all().forEach { alerts.put(it.copy(snoozeMinutes = next.snoozeMinutes)) }
    alerts.activeSession()?.let { RingingService.refresh(context, it.id) }
    changed(); return mapOf("status" to "Applied")
  }
  fun diagnostics(): Map<String, Any> = mapOf("observedAtMs" to now(), "capabilities" to capabilities(),
    "contentSchema" to 2, "operationalSchema" to 2,
    "states" to alerts.all().groupingBy { it.state }.eachCount(),
    "pendingOperations" to content().records().pending().size)
  fun exportBackup(): String {
    val db = content()
    replayHistory(db)
    val records = db.records().all().filter { !it.deleted }
    val targets = records.associate { record -> record.id to alerts.find(record.id)?.let { alert ->
      if (!record.completed && alert.state in setOf("Scheduled", "Pending", "Blocked")) alert.targetMs else null
    } }
    return BackupCodec.encode(records, targets, records.flatMap { db.records().history(it.id) }, now())
  }
  fun previewImport(json: String): Map<String, Any> {
    val bundle = BackupCodec.decode(json)
    val dao = content().records()
    return mapOf("count" to bundle.records.size, "items" to bundle.records.map {
      mapOf("id" to it.id, "title" to it.title, "conflict" to (dao.find(it.id) != null),
        "futureAlert" to (!it.completed && it.mode != "None" && (bundle.nextAlerts[it.id] ?: it.definedAlarmAtMs!!) > now()))
    })
  }
  fun importBackup(json: String, copyIds: List<String>, operation: String): Map<String, Any?> {
    validate(operation.isNotBlank() && operation.length <= 200, "operationId", "Try this import again.")
    val db = content()
    val bundle = BackupCodec.decode(json) // Entire file is validated before writing anything.
    if (db.records().receipt(operation) != null) {
      validate(db.records().receipt(operation)!!.kind == "Import", "operationId", "This operation was already used.")
      applyPending(db); return mapOf("status" to "Applied", "retry" to true)
    }
    validate(copyIds.all { id -> bundle.records.any { it.id == id } }, "copyIds", "Choose conflicts from this backup.")
    val accepted = bundle.records.filter { db.records().find(it.id) == null || it.id in copyIds }
    val mapped = accepted.associate { record -> record.id to
      if (db.records().find(record.id) == null) record.id else UUID.nameUUIDFromBytes("$operation:${record.id}".toByteArray()).toString() }
    db.runInTransaction {
      accepted.forEach { source ->
        val id = mapped.getValue(source.id)
        val record = source.copy(id = id, title = if (id == source.id) source.title else "${source.title.take(193)} (copy)")
        db.records().insert(record)
        db.records().pending(projection("$operation:$id", record, 1).copy(
          targetMs = bundle.nextAlerts[source.id] ?: record.definedAlarmAtMs!!,
          eligible = !record.completed && (record.mode == "None" || bundle.nextAlerts[source.id] != null)))
      }
      bundle.history.filter { it.occurrenceId in mapped }.forEach { history ->
        db.records().history(history.copy(operationId = UUID.nameUUIDFromBytes("$operation:${history.operationId}".toByteArray()).toString(),
          occurrenceId = mapped.getValue(history.occurrenceId)))
      }
      db.records().receipt(CreationReceipt(operation, "import", "Import"))
    }
    applyPending(db); changed()
    val blocked = mapped.values.count { alerts.find(it)?.state == "Blocked" }
    return mapOf("status" to if (blocked > 0) "Blocked" else "Applied", "added" to accepted.size,
      "preserved" to bundle.records.size - accepted.size, "blocked" to blocked)
  }
  fun previewSound(sound: String): Map<String, Any> {
    validate(sound in setOf("remilo", "system"), "sound", "Choose a valid sound.")
    if (alerts.activeSession() != null) return mapOf("status" to "Rejected", "errorMessage" to "An alarm is already ringing.")
    previewAudio?.stop()
    previewAudio = AlarmAudio(context, {}, {}, sound = sound, durationMillis = 5_000).also { it.start() }
    return mapOf("status" to "Applied")
  }
  fun apply(command: Map<String, Any?>): Map<String, Any?> {
    return try { applyValidated(command) } catch (error: InputError) {
      mapOf("status" to "Rejected", "errorCode" to "INVALID_INPUT", "errorField" to error.field,
        "errorMessage" to error.message)
    }
  }
  private fun applyValidated(command: Map<String, Any?>): Map<String, Any?> {
    val operationId = command["operationId"] as? String
      ?: throw InputError("operationId", "Try this action again.")
    validate(operationId.isNotBlank() && operationId.length <= 200, "operationId", "Try this action again.")
    return when (command["kind"]) {
      "Create" -> create(operationId, command)
      "Edit", "Done", "Reopen", "Delete", "UndoDelete" -> modify(operationId, command)
      "Settings" -> updateSettings(operationId, command)
      "StopAll" -> {
        val session = alerts.activeSession()
        if (session == null || session.id != command["expectedSessionId"])
          return mapOf("status" to "Rejected", "errorCode" to "STALE_SESSION", "errorMessage" to "That alarm session has ended.")
        val members = alerts.members(session.id)
        members.forEach { applyAction(it.occurrenceId, it.generation, "Stop", "$operationId:${it.occurrenceId}") }
        mapOf("status" to "Applied", "count" to members.size)
      }
      "Stop", "Snooze", "Postpone" -> {
        val id = command["occurrenceId"] as? String
          ?: throw InputError("occurrenceId", "Choose an existing reminder.")
        validate(id.isNotBlank() && id.length <= 200, "occurrenceId", "Choose an existing reminder.")
        val number = (command["expectedGeneration"] as? Number)?.toDouble()
          ?: throw InputError("expectedGeneration", "Refresh this reminder and try again.")
        validate(number.isFinite() && number >= 1 && number <= 9_007_199_254_740_991L && number % 1.0 == 0.0,
          "expectedGeneration", "Refresh this reminder and try again.")
        val generation = number.toLong()
        val at = if (command["kind"] == "Postpone") epoch(command["alarmAtMs"], "alarmAtMs") else null
        if (at != null) validate(at > now(), "alarmAtMs", "Choose an alert time in the future.")
        applyAction(id, generation, command["kind"] as String, operationId, at)
      }
      else -> mapOf("status" to "Rejected", "errorCode" to "UNSUPPORTED_COMMAND", "errorField" to "kind")
    }
  }
  fun testAlarm(): Map<String, Any?> = create(UUID.randomUUID().toString(), mapOf(
    "title" to "Remilo test alarm", "alarmAtMs" to now() + 15_000L))
  private fun create(operationId: String, command: Map<String, Any?>): Map<String, Any?> {
    val db = content()
    db.records().receipt(operationId)?.let {
      validate(it.kind == "Create", "operationId", "This operation was already used. Refresh and try again.")
      applyPending(db)
      return result(it.occurrenceId)
    }
    val id = UUID.randomUUID().toString()
    val record = draft(command, id)
    validate(record.mode == "None" || record.definedAlarmAtMs!! > now(), "alarmAtMs", "Choose an alarm time in the future.")
    db.runInTransaction {
      db.records().insert(record)
      db.records().pending(projection(operationId, record, 1))
      db.records().receipt(CreationReceipt(operationId, id))
    }
    applyPending(db)
    changed()
    return result(id)
  }
  private fun result(id: String): Map<String, Any?> {
    val alert = alerts.find(id)
    val status = when (alert?.state) { "Scheduled" -> "Scheduled"; "Blocked" -> "Blocked";
      "Pending", "Changing", null -> "Pending"; else -> "Applied" }
    return mapOf("status" to status, "occurrence" to occurrence(id))
  }
  private fun register(alert: AlertRecord): AlertRecord {
    val state = when {
      alert.mode == "None" -> "NoAlert"
      alert.targetMs <= now() -> "Missed"
      !ready(alert.mode) -> "Blocked"
      else -> try { scheduler.register(alert); "Scheduled" } catch (error: Exception) {
        Log.w("Remilo", "Alarm registration failed: ${error.javaClass.simpleName}")
        "Blocked"
      }
    }
    return alert.copy(state = state, sessionId = null).also { alerts.put(it) }
  }
  private fun applyPending(db: ContentDatabase) {
    for (pending in db.records().pending()) {
      val existing = alerts.find(pending.occurrenceId)
      // A native action may have advanced state while the content store was unavailable.
      // This outbox is never permitted to undo it.
      if (existing != null && (existing.generation > pending.generation ||
          (existing.generation == pending.generation && existing.state !in setOf("Pending", "Scheduled", "Blocked", "Changing")))) {
        db.records().acknowledge(pending.operationId)
        continue
      }
      val desired = AlertRecord(pending.occurrenceId, pending.targetMs, pending.generation,
        if (pending.eligible) "Pending" else when {
          db.records().find(pending.occurrenceId)?.completed == true -> "Completed"
          db.records().find(pending.occurrenceId)?.deleted == true -> "Deleted"
          else -> "Missed"
        },
        mode = pending.mode, sound = pending.sound, vibration = pending.vibration, snoozeMinutes = pending.snoozeMinutes)
      alerts.put(desired)
      if (!pending.eligible || register(desired).state != "Blocked") db.records().acknowledge(pending.operationId)
    }
  }
  private fun replayHistory(db: ContentDatabase) {
    for (action in alerts.actions()) {
      db.records().history(HistoryRecord(action.operationId, action.occurrenceId, action.kind,
        action.occurredAtMs, action.generation, action.targetMs))
      alerts.acknowledge(action.operationId) // history insert is idempotent; no operational replay
    }
  }
  private fun actionRecord(id: String, kind: String, generation: Long, operationId: String = UUID.randomUUID().toString(), targetMs: Long? = null) =
    ActionRecord(operationId, id, kind, now(), generation, targetMs)

  private fun applyAction(id: String, expected: Long, kind: String, operationId: String, targetMs: Long? = null): Map<String, Any?> {
    val old = alerts.find(id) ?: return mapOf("status" to "Rejected", "errorCode" to "NOT_FOUND")
    val receipt = alerts.action(operationId)
    if (receipt != null) {
      if (receipt.occurrenceId != id || receipt.kind != kind) return mapOf("status" to "Rejected", "errorCode" to "OPERATION_REUSED")
      return mapOf("status" to "Applied", "generation" to old.generation)
    }
    if (unlocked()) content().records().history(id).find { it.operationId == operationId }?.let {
      return mapOf("status" to if (it.kind == kind) "Applied" else "Rejected", "generation" to old.generation)
    }
    if (old.generation != expected) return mapOf("status" to "Rejected", "errorCode" to "STALE_GENERATION",
      "errorField" to "expectedGeneration", "generation" to old.generation)
    if (old.state in setOf("Completed", "Deleted", "Changing") || old.mode == "None")
      return mapOf("status" to "Rejected", "errorCode" to "NOT_ELIGIBLE", "errorMessage" to "This reminder has no eligible alert. Refresh it first.")
    if (kind == "Stop" && old.state != "Alerting") return mapOf("status" to "Rejected", "errorCode" to "NOT_RINGING")
    val next = old.copy(generation = old.generation + 1, sessionId = null,
      targetMs = when (kind) { "Snooze" -> now() + old.snoozeMinutes * 60_000L;
        "Postpone" -> requireNotNull(targetMs); else -> old.targetMs },
      state = if (kind in setOf("Snooze", "Postpone")) "Pending" else "Stopped")
    operational.runInTransaction {
      alerts.put(next)
      alerts.action(actionRecord(id, kind, next.generation, operationId, next.targetMs))
    }
    try { scheduler.cancel(old) } catch (_: Exception) { /* generation already fences the old callback */ }
    val updated = if (kind in setOf("Snooze", "Postpone")) register(next) else next
    old.sessionId?.let { RingingService.refresh(context, it) }
    if (kind == "Stop") AlarmNotifications(context).unresolved(updated)
    else AlarmNotifications(context).clearAttention(id)
    changed()
    return mapOf("status" to if (updated.state == "Blocked") "Blocked" else "Applied", "generation" to updated.generation)
  }

  fun receive(intent: Intent, finished: () -> Unit) = submit(finished) {
    val id = intent.getStringExtra("occurrenceId") ?: return@submit
    val generation = intent.getLongExtra("generation", -1)
    when (intent.action?.substringAfterLast('.')) {
      "fire" -> deliver(id, generation)
      "stop", "snooze" -> applyAction(id, generation,
        if (intent.action!!.endsWith("stop")) "Stop" else "Snooze", "${intent.action}:$id:$generation")
    }
  }
  private fun deliver(id: String, generation: Long) {
    val alert = alerts.find(id) ?: return
    when (AlarmPolicy.delivery(now(), alert.targetMs, generation, alert.generation,
      alert.state in setOf("Scheduled", "Pending"), ready(alert.mode))) {
      AlarmPolicy.Delivery.STALE -> return
      AlarmPolicy.Delivery.EARLY -> { register(alert); return }
      AlarmPolicy.Delivery.MISSED -> { alerts.put(alert.copy(state = "Missed")); changed(); return }
      AlarmPolicy.Delivery.BLOCKED -> { alerts.put(alert.copy(state = "Blocked")); changed(); return }
      AlarmPolicy.Delivery.RING -> Unit
    }
    if (alert.mode == "Notification") {
      alerts.put(alert.copy(state = "Notified"))
      val title = if (unlocked()) content().records().find(id)?.title ?: "Reminder" else "Reminder"
      AlarmNotifications(context).regular(alert, title)
      changed(); return
    }
    previewAudio?.stop(); previewAudio = null
    var session = alerts.activeSession()
    if (session != null && session.deadlineElapsedMs > 0 && session.deadlineElapsedMs <= elapsed()) {
      endSession(session.id, "TimedOut")
      session = null
    }
    if (session == null) session = SessionRecord(UUID.randomUUID().toString(), "Starting", sound = alert.sound, vibration = alert.vibration)
    val active = session
    operational.runInTransaction {
      alerts.session(active)
      alerts.put(alert.copy(state = "Alerting", sessionId = active.id))
    }
    try {
      val initial = AlarmNotifications(context).ringing(active.id, memberViews(active.id))
      context.startForegroundService(Intent(context, RingingService::class.java)
        .putExtra("sessionId", active.id).putExtra("sound", active.sound).putExtra("vibration", active.vibration)
        .putExtra(RingingService.INITIAL_NOTIFICATION, initial))
    } catch (_: Exception) { endSession(active.id, "Blocked") }
    changed()
  }
  fun audioStarted(sessionId: String, elapsed: Long) = submit {
    val session = alerts.session(sessionId) ?: return@submit
    if (session.state == "Starting") {
      alerts.session(session.copy(state = "Active",
        startedElapsedMs = elapsed, deadlineElapsedMs = elapsed + AlarmPolicy.SESSION_MILLIS))
      Log.i("Remilo", "Session Active: elapsed=$elapsed deadline=${elapsed + AlarmPolicy.SESSION_MILLIS}")
    }
  }
  fun audioEnded(sessionId: String, reason: String) = submit { endSession(sessionId, reason) }
  private fun endSession(sessionId: String, reason: String) {
    val session = alerts.session(sessionId) ?: return
    if (session.state !in setOf("Active", "Starting")) return
    Log.i("Remilo", "Session $reason: elapsed=${elapsed()}")
    val members = alerts.members(sessionId)
    operational.runInTransaction {
      alerts.session(session.copy(state = reason))
      members.forEach {
        alerts.put(it.copy(state = reason, sessionId = null, generation = it.generation + 1))
        alerts.action(actionRecord(it.occurrenceId, reason, it.generation + 1))
      }
    }
    members.forEach { AlarmNotifications(context).unresolved(alerts.find(it.occurrenceId)!!) }
    changed()
  }
  fun sessionMembers(sessionId: String, callback: (List<Pair<AlertRecord, String>>) -> Unit) = submit {
    callback(memberViews(sessionId))
  }
  private fun memberViews(sessionId: String) = alerts.members(sessionId).map { it to
    if (unlocked()) (content().records().find(it.occurrenceId)?.title ?: "Reminder") else "Reminder" }
  fun recover(finished: () -> Unit = {}) = submit(finished) {
    if (unlocked()) {
      val db = content()
      applyPending(db)
      alerts.all().filter { it.state == "Changing" }.forEach { alert ->
        db.records().find(alert.occurrenceId)?.let { record ->
          val eligible = !record.completed && !record.deleted && (alert.previousState == null ||
            alert.previousState in setOf("Scheduled", "Pending", "Blocked", "NoAlert"))
          db.records().pending(projection("recover:${alert.occurrenceId}:${alert.generation}", record, alert.generation)
            .copy(targetMs = alert.targetMs, eligible = eligible))
        }
      }
      applyPending(db); replayHistory(db)
      val snooze = (db.records().settings() ?: SettingsRecord()).snoozeMinutes
      alerts.all().filter { it.snoozeMinutes != snooze }.forEach { alerts.put(it.copy(snoozeMinutes = snooze)) }
    }
    alerts.all().filter { it.state in setOf("Scheduled", "Pending", "Blocked") }.forEach { register(it) }
    val caps = capabilities()
    Log.i("Remilo", "Recovery finished: unlocked=${caps["unlocked"]} exact=${caps["exactAlarms"]} notifications=${caps["notifications"]} channel=${caps["channelEnabled"]}")
    changed()
  }

  internal fun close() {
    previewAudio?.stop(); previewAudio = null
    worker.submit { content?.close(); operational.close() }.get(10, TimeUnit.SECONDS)
    worker.shutdown()
  }

  companion object {
    @Volatile private var instance: AlarmEngine? = null
    fun get(context: Context): AlarmEngine = instance ?: synchronized(this) {
      instance ?: AlarmEngine(context.applicationContext).also { instance = it }
    }
  }
}

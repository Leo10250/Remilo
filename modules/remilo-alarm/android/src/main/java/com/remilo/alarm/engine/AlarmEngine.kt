package com.remilo.alarm.engine

import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.os.SystemClock
import android.os.UserManager
import android.util.Log
import com.remilo.alarm.core.AlarmPolicy
import com.remilo.alarm.core.AppearancePolicy
import com.remilo.alarm.core.CivilTime
import com.remilo.alarm.core.Recurrence
import com.remilo.alarm.core.DeliverySnapshot
import com.remilo.alarm.core.OverduePolicy
import com.remilo.alarm.data.*
import com.remilo.alarm.system.*
import java.util.UUID
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.Executors
import java.util.concurrent.RejectedExecutionException
import java.util.concurrent.TimeUnit
import java.time.Instant
import java.time.ZoneId

/** The process-lifetime serialized owner. This class has no Expo/React imports. */
class AlarmEngine internal constructor(private val context: Context,
  private val scheduler: AlarmRegistrar = AlarmScheduler(context),
  private val now: () -> Long = System::currentTimeMillis,
  private val elapsed: () -> Long = SystemClock::elapsedRealtime,
  private val appearanceZone: () -> ZoneId = ZoneId::systemDefault,
  private val systemDark: () -> Boolean = { (context.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES },
  private val beforeAppearanceWrite: () -> Unit = {},
  private val completionCheckpoint: (String) -> Unit = {},
  private val bulkSnoozeCheckpoint: (String) -> Unit = {}) {
  private val worker = Executors.newSingleThreadExecutor { task -> Thread(task, "Remilo-state") }
  private val operational = OperationalDatabase.open(context)
  private val alerts = operational.records()
  private var content: ContentDatabase? = null
  private val listeners = CopyOnWriteArrayList<() -> Unit>()
  private val previewListeners = CopyOnWriteArrayList<(Map<String, Any>) -> Unit>()
  private val preview = SoundPreviewController(context, { task -> submit(task = task) }, { snapshot ->
    previewListeners.forEach { try { it(snapshot) } catch (_: Exception) { /* detached bridge */ } }
  })
  private val series = SeriesCoordinator(context, ::content, operational, scheduler, now, ::register)
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
      alerts.pendingBulkSnoozes().forEach { resumeBulkSnooze(it) }
      if (unlocked()) try { mirrorAppearance(prepareContentActions().records().settings() ?: SettingsRecord()) }
      catch (_: Exception) { /* Presentation recovery must not block autonomous delivery. */ }
    }
  }

  private fun unlocked() = context.getSystemService(UserManager::class.java).isUserUnlocked
  private fun content(): ContentDatabase {
    check(unlocked()) { "User must unlock first" }
    return content ?: ContentDatabase.open(context).also { content = it }
  }
  /** Called on the existing worker before CE reads and revision validation. */
  private fun prepareContentActions(): ContentDatabase {
    val db = content()
    series.materialize()
    for (completion in alerts.completions()) {
      db.runInTransaction {
        // The history key proves CE commit, including a lost DP acknowledgement.
        // A later Reopen must never be overwritten by replay of that commit.
        val committed = db.records().historyOperation(completion.operationId)
        if (committed == null) {
          val record = checkNotNull(db.records().find(completion.occurrenceId)) { "Completion content not materialized" }
          db.records().update(record.copy(completed = true, revision = record.revision + 1))
          db.records().history(HistoryRecord(completion.operationId, record.id, "Done",
            completion.occurredAtMs, completion.generation))
          completionCheckpoint("content-before-commit")
        } else check(committed.kind == "Done" && committed.occurrenceId == completion.occurrenceId &&
          committed.generation == completion.generation) { "Completion operation was reused" }
      }
      completionCheckpoint("content-committed")
      alerts.acknowledgeCompletion(completion.operationId)
    }
    replayHistory(db)
    return db
  }
  private fun submit(finished: () -> Unit = {}, task: () -> Unit) {
    try {
      worker.execute {
        try { task() } catch (error: Exception) {
          Log.e("Remilo", "Native operation failed: ${error.javaClass.simpleName}")
        } finally { finished() }
      }
    } catch (_: RejectedExecutionException) { finished() /* detached native callback after close */ }
  }
  private fun changed() { listeners.forEach { try { it() } catch (_: Exception) { /* detached bridge */ } } }
  fun observe(listener: () -> Unit): AutoCloseable {
    listeners.add(listener)
    return AutoCloseable { listeners.remove(listener) }
  }
  fun observeSoundPreview(listener: (Map<String, Any>) -> Unit): AutoCloseable {
    previewListeners.add(listener)
    return AutoCloseable { previewListeners.remove(listener) }
  }
  fun request(block: () -> Any?, resolve: (Any?) -> Unit, reject: (String) -> Unit) {
    submit {
      try { resolve(block()) } catch (_: BackupLimitException) { reject("BACKUP_TOO_LARGE") }
      catch (_: IllegalArgumentException) { reject("INVALID_INPUT") }
      catch (_: IllegalStateException) { reject("NOT_AVAILABLE") }
      catch (_: Exception) { reject("STORAGE_ERROR") }
    }
  }

  fun capabilities(): Map<String, Any?> {
    val manager = context.getSystemService(NotificationManager::class.java)
    val channel = manager.getNotificationChannel(AlarmNotifications.RINGING_CHANNEL)
    val notificationChannel = manager.getNotificationChannel(AlarmNotifications.NOTIFICATION_CHANNEL)
    val active = alerts.activeSession()
    val members = active?.let { alerts.members(it.id) }.orEmpty()
    return mapOf("exactAlarms" to scheduler.canSchedule(),
      "notifications" to manager.areNotificationsEnabled(),
      "channelEnabled" to (channel == null || channel.importance != NotificationManager.IMPORTANCE_NONE),
      "notificationChannelEnabled" to (notificationChannel == null || notificationChannel.importance != NotificationManager.IMPORTANCE_NONE),
      "fullScreen" to manager.canUseFullScreenIntent(), "unlocked" to unlocked(),
      "activeSessionId" to (active?.id ?: ""),
      "activeSessionActions" to if (active != null && members.isNotEmpty()) mapOf(
        "sessionId" to active.id, "members" to DeliverySnapshot.maps(members.map { DeliverySnapshot.Member(it.occurrenceId, it.generation) }),
        "snoozeMinutes" to members.first().snoozeMinutes) else null,
      "observedAtMs" to now())
  }

  private fun ready(mode: String = "Alarm"): Boolean {
    val capabilities = capabilities()
    return (mode != "Alarm" || capabilities["exactAlarms"] == true) && capabilities["notifications"] == true &&
      capabilities[if (mode == "Notification") "notificationChannelEnabled" else "channelEnabled"] == true
  }
  fun query(filter: String, cursor: String?): Map<String, Any?> = query(mapOf("view" to filter), cursor)
  fun query(filter: Map<String, Any?>, cursor: String?): Map<String, Any?> {
    val db = prepareContentActions()
    val queryNow = now()
    val zone = ZoneId.systemDefault()
    val day = Instant.ofEpochMilli(queryNow).atZone(zone).toLocalDate()
    val start = day.atStartOfDay(zone).toInstant().toEpochMilli()
    val end = day.plusDays(1).atStartOfDay(zone).toInstant().toEpochMilli()
    val search = (filter["search"] as? String)?.trim().orEmpty()
    val familySegments = (filter["seriesId"] as? String)?.takeIf { it.isNotEmpty() }?.let { family ->
      db.records().series().filter { it.seriesId == family }.map { it.id }.toSet()
    }
    fun matches(record: ReminderRecord) =
      (search.isEmpty() || record.title.contains(search, true) || record.notes.contains(search, true)) &&
        ((filter["segmentId"] as? String).isNullOrEmpty() || record.segmentId == filter["segmentId"]) &&
        (familySegments == null || record.segmentId in familySegments) &&
        (if (filter.containsKey("listId")) record.listId == filter["listId"]
          else (filter["listName"] as? String).isNullOrEmpty() ||
            (record.listId?.let { db.records().list(it)?.name } ?: record.listName) == filter["listName"]) &&
        (filter["deliveryIssuesOnly"] != true || (record.mode != "None" && alerts.find(record.id)?.state in
          setOf("Missed", "TimedOut", "Interrupted", "Blocked", "Failed"))) &&
        (filter["overdueOnly"] != true || overdue(record, queryNow))
    val records = db.records().all().filter { record ->
      val alert = alerts.find(record.id)
      val selected = when (filter["view"]) {
        "deleted" -> record.deleted
        "history" -> !record.deleted && (record.completed || record.skipped)
        "completed" -> !record.deleted && (record.completed || (filter["includeSkipped"] == true && record.skipped))
        "overdue" -> overdue(record, queryNow)
        "attention" -> !record.deleted && !record.completed && !record.skipped && (overdue(record, queryNow) ||
          alert?.state in setOf("Missed", "Stopped", "TimedOut", "Interrupted", "Blocked", "Failed", "Notified", "Changing"))
        "today" -> !record.deleted && !record.completed && !record.skipped && agendaAt(record, alert) in start until end
        "upcoming" -> !record.deleted && !record.completed && !record.skipped && agendaAt(record, alert) >= end
        else -> !record.deleted && !record.completed && !record.skipped
      }
      selected && matches(record)
    }
    val historical = filter["view"] in setOf("completed", "history", "deleted")
    val collectionTimes = if (historical) {
      val activity = db.records().collectionHistory().groupBy { it.occurrenceId to it.kind }
        .mapValues { (_, entries) -> entries.maxOf { it.occurredAtMs } }
      records.associate { it.id to (activity[it.id to collectionKind(it)] ?: it.eventStartMs) }
    } else emptyMap()
    val ordered = if (filter["view"] in setOf("agenda", "overdue", "today", "upcoming", "attention")) records.sortedWith(
      compareBy<ReminderRecord> { com.remilo.alarm.core.Agenda.rank(com.remilo.alarm.core.Agenda.group(
        agendaAt(it), overdueAt(it), it.completed, it.skipped, queryNow, zone)) }
        .thenBy { if (overdue(it, queryNow)) overdueAt(it) else agendaAt(it) }.thenBy { it.id })
      else if (historical) records.sortedWith(
        compareByDescending<ReminderRecord> { collectionTimes.getValue(it.id) }.thenByDescending { it.eventStartMs }.thenBy { it.id })
      else records.sortedWith(compareBy<ReminderRecord> { it.eventStartMs }.thenBy { it.id })
    val offset = cursor?.toIntOrNull()?.coerceAtLeast(0) ?: 0
    val page = ordered.drop(offset).take(50)
    val groups = ordered.groupingBy { com.remilo.alarm.core.Agenda.group(agendaAt(it), overdueAt(it),
      it.completed, it.skipped, queryNow, zone) }.eachCount()
    val completedCount = db.records().all().count { !it.deleted && it.completed && matches(it) }
    return mapOf("items" to page.map { view(it, queryNow, zone) },
      "nextCursor" to if (offset + page.size < ordered.size) (offset + page.size).toString() else null,
      "total" to ordered.size, "groups" to groups, "completedCount" to completedCount)
  }
  fun occurrence(id: String): Map<String, Any?>? {
    val db = prepareContentActions()
    return db.records().find(id)?.let { view(it) + ("history" to db.records().history(id).map { history ->
      mapOf("kind" to history.kind, "atMs" to history.occurredAtMs, "targetMs" to history.targetMs)
    }) }
  }
  private fun collectionKind(record: ReminderRecord): String? =
    when { record.deleted -> "Delete"; record.completed -> "Done"; record.skipped -> "Skip"; else -> null }
  private fun collectionTime(record: ReminderRecord): Long {
    val kind = collectionKind(record)
    return kind?.let { content().records().history(record.id).filter { it.kind == kind }.maxOfOrNull { it.occurredAtMs } }
      ?: record.eventStartMs
  }
  private fun agendaAt(record: ReminderRecord, alert: AlertRecord? = alerts.find(record.id)): Long =
    if (record.mode == "None") record.eventStartMs else alert?.targetMs ?: record.definedAlarmAtMs ?: record.eventStartMs
  private fun overdueAt(record: ReminderRecord): Long = OverduePolicy.reference(record.mode, record.eventStartMs,
    record.definedAlarmAtMs, record.allDay, ZoneId.of(record.zoneId.ifEmpty { ZoneId.systemDefault().id }))
  private fun overdue(record: ReminderRecord, at: Long): Boolean =
    OverduePolicy.isOverdue(overdueAt(record), record.completed, record.skipped, record.deleted, at)
  private fun view(record: ReminderRecord, queryNow: Long = now(), zone: ZoneId = ZoneId.systemDefault()): Map<String, Any?> {
    val alert = alerts.find(record.id)
    val adjustment = if (alert?.state == "Scheduled") content().records().history(record.id)
      .lastOrNull { it.targetMs == alert.targetMs && it.kind in setOf("Snooze", "Postpone") }?.kind else null
    val segment = record.segmentId?.let { content().records().series(it) }
    val rule = segment?.let { RuleCodec.decode(it.rule) }
    val repeat = rule?.let { com.remilo.alarm.core.Agenda.summary(it) }
    val repeatRule = rule?.let { RuleCodec.map(it).filterKeys { key -> key in setOf("frequency", "interval", "weekdays", "day", "ordinal", "weekday", "month", "count", "until") } +
      mapOf("zoneMode" to if (it.zoneId == null) "floating" else "pinned") }
    return mapOf("id" to record.id, "title" to record.title, "eventStartMs" to record.eventStartMs,
      "eventEndMs" to record.eventEndMs, "dueAtMs" to record.dueAtMs, "agendaAtMs" to agendaAt(record, alert), "completed" to record.completed,
      "revision" to record.revision, "nextAlertMs" to alert?.targetMs,
      "generation" to (alert?.generation ?: 0L), "deliveryState" to (alert?.state ?: "Pending"),
      "notes" to record.notes, "listId" to record.listId,
      "listName" to record.listId?.let { content().records().list(it)?.name }.orEmpty(), "mode" to record.mode,
      "alarmAtMs" to (record.definedAlarmAtMs ?: record.eventStartMs), "allDay" to record.allDay,
      "zoneId" to record.zoneId.ifEmpty { ZoneId.systemDefault().id }, "dueLinked" to record.dueLinked,
      "alarmLinked" to record.alarmLinked, "deleted" to record.deleted, "sound" to record.sound,
      "vibration" to record.vibration, "overdue" to overdue(record, queryNow), "overdueAtMs" to overdueAt(record),
      "quickSnoozeMinutes" to (alert?.snoozeMinutes ?: (content().records().settings() ?: SettingsRecord()).snoozeMinutes),
      "segmentId" to record.segmentId, "nominalSlot" to record.nominalSlot, "exception" to record.exception, "skipped" to record.skipped,
      "seriesState" to segment?.state, "repeatSummary" to repeat, "repeatRule" to repeatRule,
      "alertAdjustment" to when (adjustment) { "Snooze" -> "Snoozed"; "Postpone" -> "Postponed"; else -> null },
      "agendaGroup" to com.remilo.alarm.core.Agenda.group(agendaAt(record, alert), overdueAt(record), record.completed,
        record.skipped, queryNow, zone)) +
      if (record.completed || record.deleted || record.skipped) mapOf("collectionAtMs" to collectionTime(record)) else emptyMap()
  }
  private fun epoch(value: Any?, field: String): Long {
    val number = (value as? Number)?.toDouble() ?: throw InputError(field, "Choose a valid date and time.")
    validate(number.isFinite() && number >= 0 && number <= 8_640_000_000_000_000L && number % 1.0 == 0.0,
      field, "Choose a valid date and time.")
    return number.toLong()
  }
  fun preview(draft: Map<String, Any?>): Map<String, Any> {
    prepareContentActions()
    val record = draft(draft + ("title" to (draft["title"] ?: "Preview")), "preview")
    val recurrence = draft["recurrence"] as? Map<String, Any?>
    val upcoming = recurrence?.let { series.preview(record, it) }
    return mapOf("alarmAtMs" to record.definedAlarmAtMs!!, "eventStartMs" to record.eventStartMs,
      "eventEndMs" to record.eventEndMs, "dueAtMs" to record.dueAtMs,
      "upcoming" to (upcoming ?: emptyList<Map<String, Any?>>()),
      "warnings" to when {
        upcoming != null && upcoming.isEmpty() -> listOf("No future occurrences. Change the repeat rule or its ending.")
        upcoming != null -> if (upcoming.any { it["adjusted"] == true }) listOf("A daylight-saving gap shifts the affected time forward.") else emptyList<String>()
        record.mode != "None" && record.definedAlarmAtMs <= now() -> listOf("The alert is in the past. Choose a future time before saving.")
        else -> emptyList<String>() })
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
    val listId = if (!command.containsKey("listId")) old?.listId else command["listId"]?.let {
      validate(it is String && it.isNotBlank() && it.length <= 200, "listId", "Choose an existing list or No list.")
      it as String
    }
    val list = listId?.let { content().records().list(it) }
    validate(listId == null || list != null, "listId", "This list was removed. Choose an existing list or No list.")
    return ReminderRecord(id, title, start, end, due, old?.createdAtMs ?: now(), old?.completed ?: false,
      (old?.revision ?: 0) + 1, text(command, "notes", old?.notes ?: "", 10_000),
      list?.name.orEmpty(), mode, alarm, allDay, zone.id,
      dueLinked, alarmLinked, old?.deleted ?: false, sound, flag(command, "vibration", old?.vibration ?: settings.vibration), listId = listId)
  }
  private fun projection(operation: String, record: ReminderRecord, generation: Long): PendingSchedule =
    PendingSchedule(operation, record.id, record.definedAlarmAtMs ?: record.eventStartMs, generation,
      record.mode, record.sound, record.vibration, (content().records().settings() ?: SettingsRecord()).snoozeMinutes,
      !record.completed && !record.deleted && !record.skipped)
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
      "Edit" -> draft(command, id, old).copy(segmentId = old.segmentId, nominalSlot = old.nominalSlot,
        exception = old.segmentId != null || old.exception, skipped = old.skipped).also {
        val changedTime = it.definedAlarmAtMs != (old.definedAlarmAtMs ?: old.eventStartMs) || it.mode != old.mode
        validate(!changedTime || it.mode == "None" || it.completed || it.definedAlarmAtMs!! > now(), "alarmAtMs", "Choose an alarm time in the future.")
      }
      "Done" -> old.copy(completed = true, revision = old.revision + 1)
      "Reopen" -> old.copy(completed = false, skipped = false, exception = old.exception || old.segmentId != null, revision = old.revision + 1)
      "Delete" -> old.copy(deleted = true, revision = old.revision + 1)
      "UndoDelete" -> old.copy(deleted = false, exception = old.exception || old.segmentId != null, revision = old.revision + 1)
      "Skip" -> { validate(old.segmentId != null, "occurrenceId", "Only recurring occurrences can be skipped."); old.copy(skipped = true, revision = old.revision + 1) }
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
      if (record.segmentId != null) { previous?.let { alerts.put(it.copy(exception = record.exception)) }; series.replenish(); series.materialize() }
      changed(); return result(id)
    }
    val generation = maxOf(previous?.generation ?: 0, db.records().pending().filter { it.occurrenceId == id }.maxOfOrNull { it.generation } ?: 0) + 1
    // Fence first. If the CE commit is interrupted, Changing is recovered from
    // the last committed definition, never from an obsolete outbox or callback.
    alerts.put((previous ?: AlertRecord(id, record.definedAlarmAtMs!!, 0, "Pending"))
      .copy(generation = generation, state = "Changing", sessionId = null, previousState = previous?.state))
    previous?.let {
      try { scheduler.cancel(it) } catch (_: Exception) { /* stale generation remains fenced */ }
      it.sessionId?.let { session -> refreshOrEndSession(session) }
    }
    db.runInTransaction {
      db.records().update(record)
      db.records().pending(projection(operation, record, generation).copy(
        targetMs = if (changedDefinition) record.definedAlarmAtMs!! else previous?.targetMs ?: record.definedAlarmAtMs!!))
      db.records().receipt(CreationReceipt(operation, id, kind))
      db.records().history(HistoryRecord(operation, id, kind, now(), generation, record.definedAlarmAtMs))
    }
    AlarmNotifications(context).clearAttention(id)
    applyPending(db); series.replenish(); series.materialize(); changed()
    return result(id)
  }
  fun settings(): Map<String, Any> {
    val settings = prepareContentActions().records().settings() ?: SettingsRecord()
    return mapOf("revision" to settings.revision, "snoozeMinutes" to settings.snoozeMinutes,
      "tomorrowMorning" to settings.tomorrowMorning, "tomorrowAfternoon" to settings.tomorrowAfternoon,
      "tomorrowEvening" to settings.tomorrowEvening, "sound" to settings.sound,
      "vibration" to settings.vibration, "theme" to settings.theme, "atmosphere" to AppearancePolicy.selection(settings.atmosphere))
  }
  private fun listView(list: ListRecord): Map<String, Any> = listView(list, now())
  private fun listView(list: ListRecord, queryNow: Long): Map<String, Any> = mapOf("id" to list.id, "name" to list.name,
    "revision" to list.revision, "overdueCount" to content().records().all().count {
      it.listId == list.id && overdue(it, queryNow)
    })
  fun lists(): List<Map<String, Any>> {
    val records = prepareContentActions().records().lists()
    val queryNow = now()
    return records.map { listView(it, queryNow) }
  }
  private fun mutateList(operation: String, command: Map<String, Any?>): Map<String, Any?> {
    val dao = content().records(); val kind = command["kind"] as String
    val id = if (kind == "CreateList") UUID.nameUUIDFromBytes("remilo:list-create:$operation".toByteArray()).toString()
      else text(command, "listId", "", 200).also { validate(it.isNotBlank(), "listId", "Choose an existing list.") }
    dao.receipt(operation)?.let {
      validate(it.kind == kind && it.occurrenceId == id, "operationId", "This operation was already used. Try again.")
      return mapOf("status" to "Applied", "list" to dao.list(id)?.let(::listView))
    }
    val old = dao.list(id)
    if (kind != "CreateList") {
      if (old == null) return mapOf("status" to "Rejected", "errorCode" to "NOT_FOUND", "errorField" to "listId", "errorMessage" to "This list was removed.")
      if (epoch(command["expectedRevision"], "expectedRevision") != old.revision)
        return mapOf("status" to "Rejected", "errorCode" to "STALE_REVISION", "errorMessage" to "This list changed. Refresh before updating it.")
    }
    val name = if (kind == "RemoveList") null else ListNames.display(text(command, "name", "", 60)).also { value ->
      validate(value.isNotEmpty(), "name", "Enter a list name.")
      validate(dao.lists().none { it.id != id && it.normalizedName == ListNames.key(value) }, "name", "A list with this name already exists.")
    }
    val next = name?.let { ListRecord(id, it, ListNames.key(it), (old?.revision ?: 0) + 1, old?.createdAtMs ?: now()) }
    content().runInTransaction {
      when (kind) {
        "CreateList" -> dao.insertList(requireNotNull(next))
        "RenameList" -> dao.updateList(requireNotNull(next))
        "RemoveList" -> {
          dao.all().filter { it.listId == id }.forEach { dao.update(it.copy(listId = null, listName = "", revision = it.revision + 1)) }
          dao.series().forEach { segment ->
            val template = BackupCodec.decodeRecord(org.json.JSONObject(segment.template))
            if (template.listId == id) dao.series(segment.copy(template = org.json.JSONObject(BackupCodec.record(template.copy(listId = null, listName = ""))).toString(), revision = segment.revision + 1))
          }
          dao.removeList(id)
        }
      }
      dao.receipt(CreationReceipt(operation, id, kind))
    }
    changed()
    return mapOf("status" to "Applied", "list" to next?.let(::listView))
  }
  fun querySeries(): List<Map<String, Any?>> { prepareContentActions(); return series.list() }
  fun queryRepeatFamilies(): List<Map<String, Any?>> {
    prepareContentActions()
    return series.families()
  }
  fun timeZones(atMs: Double): List<Map<String, Any>> = TimeZoneCatalog.list(epoch(atMs, "atMs"))
  fun convertTime(input: Map<String, Any?>): Map<String, Any> {
    val id = input["zoneId"] as? String ?: throw IllegalArgumentException("Choose a valid time zone.")
    require(input.containsKey("instantMs") != input.containsKey("local")) { "Choose one time to convert." }
    return if (input.containsKey("instantMs")) CivilTime.fromInstant(id, epoch(input["instantMs"], "instantMs"))
      else CivilTime.fromLocal(id, input["local"] as? String ?: throw IllegalArgumentException("Choose a valid local time."))
  }
  fun getSeries(id: String): Map<String, Any?>? { prepareContentActions(); return series.get(id) }
  fun getSeriesDraft(id: String, nominal: String): Map<String, Any?> { prepareContentActions(); return series.editDraft(id, nominal) }
  private fun updateSettings(operation: String, command: Map<String, Any?>): Map<String, Any?> {
    val db = content()
    val old = db.records().settings() ?: SettingsRecord()
    if (old.lastOperationId == operation) {
      syncProtectedSettings(old); changed()
      return mapOf("status" to "Applied")
    }
    if (epoch(command["expectedRevision"], "expectedRevision") != old.revision)
      return mapOf("status" to "Rejected", "errorCode" to "STALE_REVISION", "errorMessage" to "Refresh settings and try again.")
    val sound = text(command, "sound", old.sound, 20)
    val theme = text(command, "theme", old.theme, 20)
    val atmosphere = if (command.containsKey("atmosphere")) text(command, "atmosphere", "automatic", 20) else old.atmosphere
    validate(sound in setOf("remilo", "system"), "sound", "Choose a valid sound.")
    validate(theme in setOf("system", "light", "dark"), "theme", "Choose a valid appearance.")
    validate(!command.containsKey("atmosphere") || atmosphere in AppearancePolicy.selections, "atmosphere", "Choose a valid atmosphere.")
    val next = old.copy(revision = old.revision + 1,
      snoozeMinutes = integer(command["snoozeMinutes"] ?: old.snoozeMinutes, "snoozeMinutes", 1, 1440),
      tomorrowMorning = integer(command["tomorrowMorning"] ?: old.tomorrowMorning, "tomorrowMorning", 0, 1439),
      tomorrowAfternoon = integer(command["tomorrowAfternoon"] ?: old.tomorrowAfternoon, "tomorrowAfternoon", 0, 1439),
      tomorrowEvening = integer(command["tomorrowEvening"] ?: old.tomorrowEvening, "tomorrowEvening", 0, 1439),
      sound = sound, vibration = flag(command, "vibration", old.vibration), theme = theme, atmosphere = atmosphere, lastOperationId = operation)
    db.records().settings(next)
    // CE is authority. A failed mirror leaves the same operation retryable; its
    // receipt branch above repairs DP before acknowledging the committed write.
    syncProtectedSettings(next)
    changed(); return mapOf("status" to "Applied")
  }
  private fun mirrorAppearance(settings: SettingsRecord) {
    val mirror = AppearanceRecord(atmosphere = AppearancePolicy.selection(settings.atmosphere), theme = AppearancePolicy.brightness(settings.theme))
    if (alerts.appearance() != mirror) { beforeAppearanceWrite(); alerts.appearance(mirror) }
  }
  private fun syncProtectedSettings(settings: SettingsRecord) {
    var snoozeChanged = false
    operational.runInTransaction {
      mirrorAppearance(settings)
      alerts.all().filter { it.snoozeMinutes != settings.snoozeMinutes }.forEach {
        alerts.put(it.copy(snoozeMinutes = settings.snoozeMinutes)); snoozeChanged = true
      }
      alerts.plans().filter { it.snoozeMinutes != settings.snoozeMinutes }.forEach { alerts.plan(it.copy(snoozeMinutes = settings.snoozeMinutes)) }
    }
    if (snoozeChanged) alerts.activeSession()?.let { RingingService.refresh(context, it.id) }
  }
  private fun resolveAppearance(): AppearancePolicy.Resolved {
    val mirror = try { alerts.appearance() } catch (_: Exception) { null }
    return try { AppearancePolicy.resolve(mirror?.atmosphere, mirror?.theme, now(), appearanceZone(), systemDark()) }
    catch (_: Exception) { AppearancePolicy.captured(null, null) }
  }
  fun diagnostics(): Map<String, Any> { prepareContentActions(); return mapOf("observedAtMs" to now(), "capabilities" to capabilities(),
    "contentSchema" to 5, "operationalSchema" to 6,
    "states" to alerts.all().groupingBy { it.state }.eachCount(),
    "pendingOperations" to (content().records().pending().size + alerts.completions().size)) }
  fun exportBackup(): String {
    val db = prepareContentActions()
    val records = db.records().all().filter { !it.deleted || it.segmentId != null }
    val targets = records.associate { record -> record.id to alerts.find(record.id)?.let { alert ->
      if (!record.completed && alert.state in setOf("Scheduled", "Pending", "Blocked", "Paused")) alert.targetMs else null
    } }
    return BackupCodec.encode(records, targets, records.flatMap { db.records().history(it.id) }, now(), db.records().series(), db.records().lists())
  }
  fun previewImport(json: String): Map<String, Any> {
    val bundle = BackupCodec.decode(json)
    val dao = prepareContentActions().records()
    val families = bundle.series.groupBy { it.seriesId }
    val localFamilies = dao.series().map { it.seriesId }.toSet()
    val items = bundle.records.filter { it.segmentId == null }.map {
      mapOf("id" to it.id, "title" to it.title, "conflict" to (dao.find(it.id) != null),
        "futureAlert" to (!it.completed && it.mode != "None" && (bundle.nextAlerts[it.id] ?: it.definedAlarmAtMs!!) > now()))
    } + families.map { (id, segments) ->
      val segment = segments.lastOrNull { it.state != "Archived" } ?: segments.last()
      mapOf("id" to id, "title" to "${series.template(segment).title} (series)", "conflict" to (id in localFamilies || segments.any { dao.series(it.id) != null }),
        "futureAlert" to segments.any { current -> val mode = series.template(current).mode
          current.state == "Active" && mode != "None" && Recurrence.future(RuleCodec.decode(current.rule), now(), ZoneId.systemDefault(), mode).any() })
    }
    val restored = restoredLists(bundle).first
    return mapOf("count" to items.size, "items" to items, "lists" to bundle.lists.map { source ->
      val target = restored.getValue(source.id)
      mapOf("id" to source.id, "name" to source.name, "restoredName" to target.name,
        "conflict" to (dao.list(source.id) != null || target.name != source.name))
    })
  }
  /** Preserve matching identities; distinct imported lists never merge by name. */
  private fun restoredLists(bundle: BackupCodec.Bundle): Pair<Map<String, ListRecord>, List<ListRecord>> {
    val local = content().records().lists().associateBy { it.id }
    val reserved = local.values.map { it.normalizedName }.toMutableSet()
    val rows = mutableListOf<ListRecord>()
    val mapping = bundle.lists.sortedBy { it.id }.associate { source ->
      val target = local[source.id] ?: run {
        var name = source.name; var number = 1
        while (ListNames.key(name) in reserved) {
          val suffix = if (number == 1) " (restored)" else " (restored $number)"
          name = source.name.take(60 - suffix.length).trimEnd() + suffix
          number++
        }
        source.copy(name = name, normalizedName = ListNames.key(name), revision = 1).also { rows.add(it) }
      }
      reserved.add(target.normalizedName)
      source.id to target
    }
    return mapping to rows
  }
  fun importBackup(json: String, copyIds: List<String>, operation: String): Map<String, Any?> {
    var mutationStarted = false
    return try {
    validate(operation.isNotBlank() && operation.length <= 200, "operationId", "Try this import again.")
    val db = content()
    validate(alerts.completionReceipt(operation) == null, "operationId", "This operation was already used.")
    db.records().receipt(operation)?.let { receipt ->
      validate(receipt.kind == "Import", "operationId", "This operation was already used.")
      // The receipt proves this operation already committed. Replay failure is
      // uncertain even when its exception resembles input validation.
      mutationStarted = true
      prepareContentActions()
      applyPending(db); return mapOf("status" to "Applied", "retry" to true)
    }
    prepareContentActions()
    val bundle = BackupCodec.decode(json) // Entire new import is validated before writing anything.
    val families = bundle.series.groupBy { it.seriesId }
    val localFamilies = db.records().series().map { it.seriesId }.toSet()
    val conflicts = families.filter { (id, segments) -> id in localFamilies || segments.any { db.records().series(it.id) != null } }.keys
    validate(copyIds.all { id -> bundle.records.any { it.segmentId == null && it.id == id } || id in families }, "copyIds", "Choose conflicts from this backup.")
    val acceptedFamilies = families.filter { (id, _) -> id !in conflicts || id in copyIds }
    val segments = acceptedFamilies.values.flatten()
    val segmentMap = segments.associate { it.id to if (it.seriesId !in conflicts) it.id
      else UUID.nameUUIDFromBytes("$operation:segment:${it.id}".toByteArray()).toString() }
    val accepted = bundle.records.filter { if (it.segmentId != null) it.segmentId in segmentMap
      else db.records().find(it.id) == null || it.id in copyIds }
    val mapped = accepted.associate { record -> record.id to
      if (record.segmentId != null) UUID.nameUUIDFromBytes("remilo:${segmentMap.getValue(record.segmentId)}:${record.nominalSlot}".toByteArray()).toString()
      else if (db.records().find(record.id) == null) record.id else UUID.nameUUIDFromBytes("$operation:${record.id}".toByteArray()).toString() }
    val (listMap, newLists) = restoredLists(bundle)
    mutationStarted = true
    db.runInTransaction {
      newLists.forEach(db.records()::insertList)
      segments.forEach { source ->
        val id = segmentMap.getValue(source.id)
        val family = if (source.seriesId !in conflicts) source.seriesId else UUID.nameUUIDFromBytes("$operation:family:${source.seriesId}".toByteArray()).toString()
        val template = BackupCodec.decodeRecord(org.json.JSONObject(source.template))
        val list = template.listId?.let { listMap.getValue(it) }
        db.records().series(source.copy(id = id, seriesId = family,
          template = org.json.JSONObject(BackupCodec.record(template.copy(listId = list?.id, listName = list?.name.orEmpty()))).toString()))
        db.records().pendingSeries(PendingSeries("$operation:series:$id", id))
      }
      accepted.forEach { source ->
        val id = mapped.getValue(source.id)
        val record = source.copy(id = id, segmentId = source.segmentId?.let { segmentMap.getValue(it) },
          listId = source.listId?.let { listMap.getValue(it).id }, listName = source.listId?.let { listMap.getValue(it).name }.orEmpty(),
          title = if (id == source.id || source.segmentId != null) source.title else "${source.title.take(193)} (copy)")
        db.records().insert(record)
        db.records().pending(projection("$operation:$id", record, 1).copy(
          targetMs = bundle.nextAlerts[source.id] ?: record.definedAlarmAtMs!!,
          eligible = !record.completed && !record.deleted && !record.skipped && (record.mode == "None" || bundle.nextAlerts[source.id] != null)))
      }
      bundle.history.filter { it.occurrenceId in mapped }.forEach { history ->
        db.records().history(history.copy(operationId = UUID.nameUUIDFromBytes("$operation:${history.operationId}".toByteArray()).toString(),
          occurrenceId = mapped.getValue(history.occurrenceId)))
      }
      db.records().receipt(CreationReceipt(operation, "import", "Import"))
    }
    applyPending(db); series.recover(); changed()
    val blocked = mapped.values.count { alerts.find(it)?.state == "Blocked" }
    val added = accepted.count { it.segmentId == null } + acceptedFamilies.size
    mapOf("status" to if (blocked > 0) "Blocked" else "Applied", "added" to added,
      "preserved" to bundle.records.count { it.segmentId == null } + families.size - added, "blocked" to blocked)
    } catch (error: Exception) {
      // Only proven pre-mutation validation failures release the caller's frozen
      // operation. Once mutation starts, transport failure remains uncertain.
      if (!mutationStarted && (error is IllegalArgumentException || error is org.json.JSONException || error is java.time.DateTimeException)) {
        mapOf("status" to "Rejected", "errorCode" to if (json.toByteArray(Charsets.UTF_8).size > 10_000_000) "BACKUP_TOO_LARGE" else "INVALID_BACKUP",
          "errorField" to ((error as? InputError)?.field ?: "backup"),
          "errorMessage" to "This backup could not be restored. Check the file and your choices.")
      } else throw error
    }
  }
  fun previewSound(sound: String, requestId: String): Map<String, Any> {
    validate(sound in setOf("remilo", "system"), "sound", "Choose a valid sound.")
    validate(requestId.isNotBlank() && requestId.length <= 200, "requestId", "Try this preview again.")
    return preview.start(sound, requestId, alerts.activeSession() == null)
  }
  fun stopSoundPreview(requestId: String): Map<String, Any>? = preview.stop(requestId)
  fun soundPreview(): Map<String, Any>? = preview.snapshot()
  fun beforeAlarmPlayback(ready: () -> Unit) = submit { preview.stop(reason = "AlarmActive", afterStopped = ready) }
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
    if (command["kind"] !in setOf("Stop", "StopAll", "CompleteDelivery", "DoneAll", "SnoozeAll", "Snooze", "Postpone")) {
      prepareContentActions()
      if (alerts.completionReceipt(operationId) != null || alerts.bulkSnoozeReceipt(operationId) != null)
        return mapOf("status" to "Rejected", "errorCode" to "OPERATION_REUSED")
    }
    return when (command["kind"]) {
      "Create" -> create(operationId, command)
      "Edit", "Done", "Reopen", "Delete", "UndoDelete", "Skip" -> modify(operationId, command)
      "CreateSeries", "EditSeries", "EditFollowing", "PauseSeries", "ResumeSeries" -> {
        if (command["kind"] != "CreateSeries") {
          validate(text(command, "segmentId", "", 200).isNotBlank(), "segmentId", "Choose a series.")
          epoch(command["expectedRevision"], "expectedRevision")
        }
        if (command["kind"] in setOf("CreateSeries", "EditSeries", "EditFollowing"))
          validate(command["recurrence"] is Map<*, *>, "recurrence", "Choose a repeat rule.")
        if (command["kind"] == "EditFollowing") validate(command["nominalSlot"] is String,
          "nominalSlot", "Choose an original occurrence.")
        try {
          val result = when (command["kind"]) {
            "CreateSeries" -> series.create(operationId, draft(command, "template"), command["recurrence"] as Map<String, Any?>)
            "EditSeries", "EditFollowing" -> {
              val old = series.editTemplate(command["segmentId"] as String,
                if (command["kind"] == "EditFollowing") command["nominalSlot"] as String else null)
              series.mutate(operationId, command, draft(command, "template", old))
            }
            else -> series.mutate(operationId, command)
          }
          changed(); result
        } catch (error: InputError) { throw error }
        catch (_: IllegalArgumentException) { mapOf("status" to "Rejected", "errorCode" to "INVALID_RECURRENCE", "errorField" to "recurrence",
          "errorMessage" to "Choose a valid repeat rule and future ending. Intervals support 1–999, counts 1–100,000, and timing offsets up to one year.") }
      }
      "Settings" -> updateSettings(operationId, command)
      "CreateList", "RenameList", "RemoveList" -> mutateList(operationId, command)
      "StopAll" -> stopAll(operationId, text(command, "expectedSessionId", "", 200))
      "DoneAll", "SnoozeAll" -> {
        val sessionId = text(command, "expectedSessionId", "", 200)
        validate(sessionId.isNotBlank(), "expectedSessionId", "Choose the current alarm session.")
        val captured = capturedMembers(command["members"])
        val minutes = if (command["kind"] == "SnoozeAll") integer(command["snoozeMinutes"], "snoozeMinutes", 1, 1440) else null
        applySessionAction(operationId, sessionId, captured, minutes)
      }
      "Stop", "CompleteDelivery", "Snooze", "Postpone" -> {
        val id = command["occurrenceId"] as? String
          ?: throw InputError("occurrenceId", "Choose an existing reminder.")
        validate(id.isNotBlank() && id.length <= 200, "occurrenceId", "Choose an existing reminder.")
        val number = (command["expectedGeneration"] as? Number)?.toDouble()
          ?: throw InputError("expectedGeneration", "Refresh this reminder and try again.")
        validate(number.isFinite() && number >= 1 && number <= 9_007_199_254_740_991L && number % 1.0 == 0.0,
          "expectedGeneration", "Refresh this reminder and try again.")
        val generation = number.toLong()
        val at = if (command["kind"] == "Postpone") epoch(command["alarmAtMs"], "alarmAtMs") else null
        val expectedMinutes = if (command["kind"] == "Snooze" && command.containsKey("expectedSnoozeMinutes"))
          integer(command["expectedSnoozeMinutes"], "expectedSnoozeMinutes", 1, 1440) else null
        applyAction(id, generation, command["kind"] as String, operationId, at, expectedMinutes)
      }
      else -> mapOf("status" to "Rejected", "errorCode" to "UNSUPPORTED_COMMAND", "errorField" to "kind")
    }
  }
  fun testAlarm(operationId: String): Map<String, Any?> = apply(mapOf(
    "kind" to "Create", "operationId" to operationId, "title" to "Remilo test alarm", "alarmAtMs" to now() + 15_000L))
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
      val product = db.records().find(pending.occurrenceId)
      val segment = product?.segmentId?.let { db.records().series(it) }
      val resolved = if (segment != null && product.nominalSlot != null && !product.exception &&
          (if (product.mode == "None") product.eventStartMs else pending.targetMs) > now())
        Recurrence.resolve(RuleCodec.decode(segment.rule), java.time.LocalDateTime.parse(product.nominalSlot), ZoneId.systemDefault()) else null
      val desired = AlertRecord(pending.occurrenceId, resolved?.alarmAtMs ?: pending.targetMs, pending.generation,
        when {
          db.records().find(pending.occurrenceId)?.completed == true -> "Completed"
          db.records().find(pending.occurrenceId)?.deleted == true -> "Deleted"
          db.records().find(pending.occurrenceId)?.skipped == true -> "Skipped"
          db.records().find(pending.occurrenceId)?.let { it.segmentId != null && !it.exception &&
            db.records().series(it.segmentId)?.state == "Paused" &&
            (if (it.mode == "None") it.eventStartMs else pending.targetMs) > now() } == true -> "Paused"
          pending.eligible -> "Pending"
          else -> "Missed"
        },
        mode = pending.mode, sound = pending.sound, vibration = pending.vibration,
        snoozeMinutes = (db.records().settings() ?: SettingsRecord()).snoozeMinutes,
        segmentId = db.records().find(pending.occurrenceId)?.segmentId,
        nominalSlot = db.records().find(pending.occurrenceId)?.nominalSlot,
        exception = db.records().find(pending.occurrenceId)?.exception ?: false,
        resolvedZone = resolved?.zoneId ?: existing?.resolvedZone ?: product?.zoneId.orEmpty())
      alerts.put(desired)
      if (desired.state != "Pending" || register(desired).state != "Blocked") db.records().acknowledge(pending.operationId)
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
  private fun acknowledgedActionResult(current: AlertRecord, kind: String, generation: Long, targetMs: Long?): Map<String, Any?> {
    // A receipt acknowledges the mutation, but must not claim its unchanged target
    // was scheduled when registration is still blocked or pending. Later actions
    // retain their own state; replaying this receipt only acknowledges its old result.
    val status = if (kind in setOf("Snooze", "Postpone") && current.generation == generation &&
        targetMs != null && current.targetMs == targetMs && current.state in setOf("Blocked", "Pending")) current.state else "Applied"
    return mapOf("status" to status, "generation" to if (kind == "Stop") current.generation else generation)
  }

  private fun applyAction(id: String, expected: Long, kind: String, operationId: String, targetMs: Long? = null,
    expectedSnoozeMinutes: Int? = null): Map<String, Any?> {
    if (alerts.bulkSnoozeReceipt(operationId) != null) return mapOf("status" to "Rejected", "errorCode" to "OPERATION_REUSED")
    alerts.completionReceipt(operationId)?.let { receipt ->
      if (kind !in setOf("Stop", "CompleteDelivery") || receipt.kind != kind || receipt.occurrenceId != id || receipt.expectedGeneration != expected)
        return mapOf("status" to "Rejected", "errorCode" to "OPERATION_REUSED")
      if (unlocked()) prepareContentActions()
      return completionResult(receipt)
    }
    // Stop's protected commit and sound termination precede CE projection. The
    // narrow legacy receipt lookups below preserve old retry semantics.
    if (kind !in setOf("Stop", "CompleteDelivery") && unlocked()) prepareContentActions()
    val old = alerts.find(id) ?: return mapOf("status" to "Rejected", "errorCode" to "NOT_FOUND")
    val receipt = alerts.action(operationId)
    if (receipt != null) {
      if (receipt.occurrenceId != id || receipt.kind != kind ||
          (kind in setOf("Snooze", "Postpone") && (receipt.generation != expected + 1 ||
            (kind == "Postpone" && receipt.targetMs != null && receipt.targetMs != targetMs))) ||
          (kind == "Snooze" && expectedSnoozeMinutes != null &&
            (receipt.targetMs == null || receipt.targetMs - receipt.occurredAtMs != expectedSnoozeMinutes * 60_000L)))
        return mapOf("status" to "Rejected", "errorCode" to "OPERATION_REUSED")
      return acknowledgedActionResult(old, kind, receipt.generation, receipt.targetMs)
    }
    if (unlocked()) content().records().receipt(operationId)?.let {
      return mapOf("status" to "Rejected", "errorCode" to "OPERATION_REUSED")
    }
    if (unlocked()) content().records().historyOperation(operationId)?.let {
      val matches = it.kind == kind && it.occurrenceId == id && (kind !in setOf("Snooze", "Postpone") ||
        (it.generation == expected + 1 && (kind != "Postpone" || it.targetMs == null || it.targetMs == targetMs))) &&
        (kind != "Snooze" || expectedSnoozeMinutes == null ||
          (it.targetMs != null && it.targetMs - it.occurredAtMs == expectedSnoozeMinutes * 60_000L))
      return if (matches) acknowledgedActionResult(old, kind, it.generation, it.targetMs)
        else mapOf("status" to "Rejected", "errorCode" to "OPERATION_REUSED")
    }
    if (old.generation != expected) return mapOf("status" to "Rejected", "errorCode" to "STALE_GENERATION",
      "errorField" to "expectedGeneration", "generation" to old.generation)
    if (old.state in setOf("Completed", "Deleted", "Changing", "SeriesChanging", "Skipped", "Replaced", "Paused") || old.mode == "None")
      return mapOf("status" to "Rejected", "errorCode" to "NOT_ELIGIBLE", "errorMessage" to "This reminder has no eligible alert. Refresh it first.")
    if (kind == "Stop" && old.state != "Alerting") return mapOf("status" to "Rejected", "errorCode" to "NOT_RINGING")
    if (kind == "CompleteDelivery" && old.state != "Alerting" && !(old.mode == "Notification" && old.state == "Notified"))
      return mapOf("status" to "Rejected", "errorCode" to "NOT_DELIVERED", "errorMessage" to "That delivery has ended. Refresh this reminder.")
    if (kind in setOf("Stop", "CompleteDelivery")) {
      val receipt = CompletionReceipt(operationId, kind, id, expected, null, old.generation + 1, 1)
      completeDeliveries(listOf(old), receipt)
      return completionResult(receipt)
    }
    if (kind == "Snooze" && expectedSnoozeMinutes != null && old.snoozeMinutes != expectedSnoozeMinutes)
      return mapOf("status" to "Rejected", "errorCode" to "STALE_SNOOZE", "errorMessage" to "The Snooze duration changed. Refresh controls and try again.")
    if (kind == "Postpone") validate(requireNotNull(targetMs) > now(), "alarmAtMs", "Choose an alert time in the future.")
    val actionAt = now()
    val next = old.copy(generation = old.generation + 1, sessionId = null,
      exception = old.exception || (old.segmentId != null && kind in setOf("Snooze", "Postpone")),
      targetMs = when (kind) { "Snooze" -> actionAt + old.snoozeMinutes * 60_000L;
        "Postpone" -> requireNotNull(targetMs); else -> old.targetMs },
      state = "Pending")
    operational.runInTransaction {
      alerts.put(next)
      alerts.action(ActionRecord(operationId, id, kind, actionAt, next.generation, next.targetMs))
    }
    old.sessionId?.let { refreshOrEndSession(it) }
    try { scheduler.cancel(old) } catch (_: Exception) { /* generation already fences the old callback */ }
    val updated = if (kind in setOf("Snooze", "Postpone")) register(next) else next
    if (updated.state == "Blocked") AlarmNotifications(context).unresolved(updated)
    else AlarmNotifications(context).clearAttention(id)
    series.replenish(); series.materialize()
    changed()
    return mapOf("status" to if (updated.state == "Blocked") "Blocked" else "Applied", "generation" to updated.generation)
  }

  private fun completionResult(receipt: CompletionReceipt): Map<String, Any?> =
    mapOf("status" to "Applied") + if (receipt.occurrenceId == null) mapOf("count" to receipt.count)
    else mapOf("generation" to receipt.generation)

  private fun stopAll(operationId: String, sessionId: String): Map<String, Any?> {
    validate(sessionId.isNotBlank(), "expectedSessionId", "Choose the current alarm session.")
    if (alerts.bulkSnoozeReceipt(operationId) != null) return mapOf("status" to "Rejected", "errorCode" to "OPERATION_REUSED")
    alerts.completionReceipt(operationId)?.let { receipt ->
      if (receipt.kind != "StopAll" || receipt.sessionId != sessionId)
        return mapOf("status" to "Rejected", "errorCode" to "OPERATION_REUSED")
      if (unlocked()) prepareContentActions()
      return completionResult(receipt)
    }
    if (unlocked()) {
      content().records().receipt(operationId)?.let {
        return mapOf("status" to "Rejected", "errorCode" to "OPERATION_REUSED")
      }
      content().records().historyOperation(operationId)?.let {
        return mapOf("status" to "Rejected", "errorCode" to "OPERATION_REUSED")
      }
    }
    if (alerts.action(operationId) != null) return mapOf("status" to "Rejected", "errorCode" to "OPERATION_REUSED")
    val session = alerts.activeSession()
    if (session == null || session.id != sessionId)
      return mapOf("status" to "Rejected", "errorCode" to "STALE_SESSION", "errorMessage" to "That alarm session has ended.")
    val members = alerts.members(session.id)
    val receipt = CompletionReceipt(operationId, "StopAll", null, null, sessionId, null, members.size)
    completeDeliveries(members, receipt)
    return completionResult(receipt)
  }

  private fun capturedMembers(input: Any?): List<DeliverySnapshot.Member> {
    validate(input is List<*> && input.isNotEmpty(), "members", "Refresh the current alarm group.")
    val members = (input as List<*>).map { raw ->
      validate(raw is Map<*, *>, "members", "Refresh the current alarm group.")
      val member = raw as Map<*, *>
      val id = member["occurrenceId"] as? String
      validate(id != null && id.isNotBlank() && id.length <= 200, "members", "Choose a current alarm.")
      val generation = epoch(member["expectedGeneration"], "expectedGeneration")
      validate(generation >= 1, "expectedGeneration", "Refresh the current alarm group.")
      DeliverySnapshot.Member(requireNotNull(id), generation)
    }.sortedBy { it.occurrenceId }
    validate(members.map { it.occurrenceId }.distinct().size == members.size, "members", "Choose each alarm only once.")
    return members
  }

  private fun applySessionAction(operationId: String, sessionId: String, captured: List<DeliverySnapshot.Member>,
    snoozeMinutes: Int?): Map<String, Any?> {
    val kind = if (snoozeMinutes == null) "DoneAll" else "SnoozeAll"
    val key = DeliverySnapshot.key(captured, snoozeMinutes)
    alerts.completionReceipt(operationId)?.let { receipt ->
      if (kind != receipt.kind || receipt.sessionId != sessionId || receipt.snapshotKey != key)
        return mapOf("status" to "Rejected", "errorCode" to "OPERATION_REUSED")
      if (unlocked()) prepareContentActions()
      return completionResult(receipt)
    }
    alerts.bulkSnoozeReceipt(operationId)?.let { receipt ->
      if (kind != "SnoozeAll" || receipt.sessionId != sessionId || receipt.snapshotKey != key)
        return mapOf("status" to "Rejected", "errorCode" to "OPERATION_REUSED")
      return resumeBulkSnooze(receipt)
    }
    if (alerts.action(operationId) != null || (unlocked() &&
        (content().records().receipt(operationId) != null || content().records().historyOperation(operationId) != null)))
      return mapOf("status" to "Rejected", "errorCode" to "OPERATION_REUSED")
    if (snoozeMinutes != null && unlocked()) prepareContentActions()
    val session = alerts.activeSession()
    if (session?.id != sessionId) return mapOf("status" to "Rejected", "errorCode" to "STALE_SESSION",
      "errorMessage" to "That alarm session has ended. Refresh controls.")
    val members = captured.map { member -> alerts.find(member.occurrenceId) }
    if (members.zip(captured).any { (record, member) -> record == null || record.state != "Alerting" ||
        record.sessionId != sessionId || record.generation != member.expectedGeneration })
      return mapOf("status" to "Rejected", "errorCode" to "STALE_MEMBERS", "errorMessage" to "The alarm group changed. Refresh controls and try again.")
    val current = members.filterNotNull()
    if (snoozeMinutes == null) {
      val receipt = CompletionReceipt(operationId, kind, null, null, sessionId, null, current.size, key)
      completeDeliveries(current, receipt)
      return completionResult(receipt)
    }
    if (current.any { it.snoozeMinutes != snoozeMinutes }) return mapOf("status" to "Rejected", "errorCode" to "STALE_SNOOZE",
      "errorMessage" to "The Snooze duration changed. Refresh controls and try again.")
    val at = now()
    val receipt = BulkSnoozeReceipt(operationId, sessionId, key, at, at + snoozeMinutes * 60_000L, snoozeMinutes)
    operational.runInTransaction {
      alerts.bulkSnoozeReceipt(receipt)
      current.forEach { old ->
        val next = old.copy(generation = old.generation + 1, state = "Pending", sessionId = null,
          targetMs = receipt.targetMs, exception = old.exception || old.segmentId != null)
        alerts.put(next)
        alerts.bulkSnoozeMember(BulkSnoozeMember(operationId, old.occurrenceId, old.generation, next.generation))
        val child = UUID.nameUUIDFromBytes("remilo:snoozeall:$operationId:${old.occurrenceId}".toByteArray()).toString()
        alerts.action(ActionRecord(child, old.occurrenceId, "Snooze", at, next.generation, receipt.targetMs))
      }
    }
    // Detach the exact captured group before registration or private projection.
    refreshOrEndSession(sessionId)
    current.forEach { try { scheduler.cancel(it) } catch (_: Exception) { /* fenced */ } }
    changed()
    bulkSnoozeCheckpoint("protected-committed")
    return resumeBulkSnooze(receipt)
  }

  /** Resume only the frozen target/generations. A newer user action always wins. */
  private fun resumeBulkSnooze(receipt: BulkSnoozeReceipt): Map<String, Any?> {
    if (!receipt.settled) {
      alerts.bulkSnoozeMembers(receipt.operationId).filter { it.status == "Pending" }.forEach { member ->
        val current = alerts.find(member.occurrenceId)
        val status = when {
          current == null || current.generation != member.generation || current.targetMs != receipt.targetMs -> "Superseded"
          current.state in setOf("Scheduled", "Alerting", "Notified") -> "Scheduled"
          current.state == "Blocked" -> "Blocked"
          current.state == "Missed" -> "Missed"
          current.state != "Pending" -> "Superseded"
          else -> {
            try { scheduler.cancel(current.copy(generation = member.expectedGeneration)) } catch (_: Exception) { /* fenced */ }
            register(current).state
          }
        }
        bulkSnoozeCheckpoint("member-registered")
        alerts.bulkSnoozeMember(member.copy(status = status))
        if (status in setOf("Blocked", "Missed") && current != null)
          AlarmNotifications(context).unresolved(alerts.find(current.occurrenceId) ?: current)
        else if (status != "Superseded") AlarmNotifications(context).clearAttention(member.occurrenceId)
        bulkSnoozeCheckpoint("member-acknowledged")
      }
      alerts.bulkSnoozeReceipt(receipt.copy(settled = true))
      bulkSnoozeCheckpoint("settled")
      series.replenish(); series.materialize()
      changed()
    }
    val members = alerts.bulkSnoozeMembers(receipt.operationId)
    val status = when {
      members.all { it.status == "Scheduled" } -> "Applied"
      members.all { it.status == "Blocked" } -> "Blocked"
      members.all { it.status == "Pending" } -> "Pending"
      else -> "Partial"
    }
    return mapOf("status" to status, "count" to members.size, "memberResults" to members.map {
      mapOf("occurrenceId" to it.occurrenceId, "generation" to it.generation, "status" to it.status, "targetMs" to receipt.targetMs)
    })
  }

  private fun completeDeliveries(members: List<AlertRecord>, receipt: CompletionReceipt) {
    val at = now()
    operational.runInTransaction {
      members.forEach { old ->
        val next = old.copy(state = "Completed", generation = old.generation + 1, sessionId = null)
        alerts.put(next)
        val operation = if (receipt.occurrenceId != null) receipt.operationId else
          UUID.nameUUIDFromBytes("remilo:${if (receipt.kind == "StopAll") "stopall" else "doneall"}:${receipt.operationId}:${old.occurrenceId}".toByteArray()).toString()
        alerts.completion(PendingCompletion(operation, old.occurrenceId, next.generation, at))
      }
      alerts.completionReceipt(receipt)
    }
    // Sound termination precedes private history/materialization, even if it fails.
    members.mapNotNull { it.sessionId }.distinct().forEach(::refreshOrEndSession)
    members.forEach { old ->
      try { scheduler.cancel(old) } catch (_: Exception) { /* committed generation fence */ }
      AlarmNotifications(context).clearAttention(old.occurrenceId)
    }
    changed()
    completionCheckpoint("protected-committed")
    series.replenish()
    if (unlocked()) prepareContentActions()
  }

  fun receive(intent: Intent, finished: () -> Unit) = submit(finished) {
    val purpose = intent.action?.substringAfterLast('.')
    if (purpose in setOf("doneall", "snoozeall")) {
      val sessionId = intent.getStringExtra("sessionId") ?: return@submit
      val ids = intent.getStringArrayExtra("memberIds") ?: return@submit
      val generations = intent.getLongArrayExtra("memberGenerations") ?: return@submit
      if (ids.size != generations.size) return@submit
      val command = mutableMapOf<String, Any?>("kind" to if (purpose == "doneall") "DoneAll" else "SnoozeAll",
        "expectedSessionId" to sessionId, "members" to ids.indices.map { mapOf("occurrenceId" to ids[it], "expectedGeneration" to generations[it]) },
        "operationId" to "notification:$purpose:${UUID.nameUUIDFromBytes(intent.data.toString().toByteArray())}")
      if (purpose == "snoozeall") command["snoozeMinutes"] = intent.getIntExtra("snoozeMinutes", -1)
      val result = apply(command)
      if (result["status"] == "Rejected") RingingService.refresh(context, sessionId)
      return@submit
    }
    if (intent.action?.substringAfterLast('.') == "stopall") {
      val sessionId = intent.getStringExtra("sessionId") ?: return@submit
      apply(mapOf("kind" to "StopAll", "expectedSessionId" to sessionId, "operationId" to "notification-stopall:$sessionId"))
      return@submit
    }
    val id = intent.getStringExtra("occurrenceId") ?: return@submit
    val generation = intent.getLongExtra("generation", -1)
    when (intent.action?.substringAfterLast('.')) {
      "fire" -> deliver(id, generation)
      "done", "quicksnooze" -> {
        val command = mutableMapOf<String, Any?>("kind" to if (purpose == "done") "CompleteDelivery" else "Snooze",
          "occurrenceId" to id, "expectedGeneration" to generation,
          "operationId" to "notification:$purpose:${UUID.nameUUIDFromBytes(intent.data.toString().toByteArray())}")
        if (purpose == "quicksnooze") command["expectedSnoozeMinutes"] = intent.getIntExtra("snoozeMinutes", -1)
        val result = apply(command)
        if (result["status"] == "Rejected") alerts.find(id)?.let { current ->
          current.sessionId?.let { RingingService.refresh(context, it) }
          if (current.mode == "Notification" && current.state == "Notified")
            AlarmNotifications(context).regular(current, memberContent(id)?.title ?: "Reminder", resolveAppearance(), onlyAlertOnce = true)
        }
      }
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
      AlarmPolicy.Delivery.MISSED -> { alerts.put(alert.copy(state = "Missed")); series.replenish(); series.materialize(); changed(); return }
      AlarmPolicy.Delivery.BLOCKED -> { alerts.put(alert.copy(state = "Blocked")); series.replenish(); series.materialize(); changed(); return }
      AlarmPolicy.Delivery.RING -> Unit
    }
    series.replenish(); series.materialize()
    if (alert.mode == "Notification") {
      alerts.put(alert.copy(state = "Notified"))
      val title = memberContent(id)?.title ?: "Reminder"
      AlarmNotifications(context).regular(alert, title, resolveAppearance())
      changed(); return
    }
    preview.stop(reason = "AlarmActive")
    var session = alerts.activeSession()
    if (session != null && session.deadlineElapsedMs > 0 && session.deadlineElapsedMs <= elapsed()) {
      endSession(session.id, "TimedOut")
      session = null
    }
    if (session == null) {
      val appearance = resolveAppearance()
      session = SessionRecord(UUID.randomUUID().toString(), "Starting", sound = alert.sound, vibration = alert.vibration,
        resolvedAtmosphere = appearance.atmosphere, resolvedBrightness = appearance.brightness)
    }
    val active = session
    operational.runInTransaction {
      alerts.session(active)
      alerts.put(alert.copy(state = "Alerting", sessionId = active.id))
    }
    try {
      val initial = AlarmNotifications(context).ringing(active.id, memberViews(active.id),
        AppearancePolicy.captured(active.resolvedAtmosphere, active.resolvedBrightness))
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
      changed()
    }
  }
  fun audioEnded(sessionId: String, reason: String) = submit { endSession(sessionId, reason) }
  private fun refreshOrEndSession(sessionId: String) {
    if (alerts.members(sessionId).isEmpty()) {
      // End the durable session before another delivery can join it. The
      // component-owned controller guards the ID and stops without a CE query.
      endSession(sessionId, "Stopped")
      RingingService.stopSession(sessionId)
    } else RingingService.refresh(context, sessionId)
  }
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
  data class SessionMemberContent(val title: String, val eventStartMs: Long, val eventEndMs: Long,
    val dueAtMs: Long, val allDay: Boolean, val zoneId: String, val dueLinked: Boolean)
  data class SessionSnapshot(val id: String, val state: String, val members: List<Pair<AlertRecord, String>>,
    val theme: String, val atmosphere: String, val content: Map<String, SessionMemberContent> = emptyMap())
  fun sessionSnapshot(sessionId: String, callback: (SessionSnapshot) -> Unit, failed: (String) -> Unit) = request({
    val session = alerts.session(sessionId)
    val appearance = AppearancePolicy.captured(session?.resolvedAtmosphere, session?.resolvedBrightness)
    val members = alerts.members(sessionId)
    val content = members.mapNotNull { record -> memberContent(record.occurrenceId)?.let { record.occurrenceId to it } }.toMap()
    SessionSnapshot(sessionId, session?.state ?: "Ended", members.map { it to (content[it.occurrenceId]?.title ?: "Reminder") },
      appearance.brightness, appearance.atmosphere, content)
  }, { callback(it as SessionSnapshot) }, failed)
  private fun memberViews(sessionId: String) = alerts.members(sessionId).map { it to
    (memberContent(it.occurrenceId)?.title ?: "Reminder") }
  private fun memberContent(id: String): SessionMemberContent? {
    if (!unlocked()) return null
    return try { prepareContentActions().records().find(id)?.let {
      SessionMemberContent(it.title, it.eventStartMs, it.eventEndMs, it.dueAtMs, it.allDay, it.zoneId, it.dueLinked)
    } } catch (_: Exception) { null /* DP actions remain available if private projection is unavailable. */ }
  }
  fun recover(finished: () -> Unit = {}) = submit(finished) {
    // Older catch-up rows labeled a reminder with no alert as Missed. Repair only
    // this impossible delivery state, without moving targets or registering alarms.
    alerts.all().filter { it.mode == "None" && it.state == "Missed" }.forEach { alerts.put(it.copy(state = "NoAlert")) }
    if (unlocked()) {
      val db = prepareContentActions()
      series.recover()
      applyPending(db)
      alerts.all().filter { it.state == "Changing" }.forEach { alert ->
        db.records().find(alert.occurrenceId)?.let { record ->
          val eligible = !record.completed && !record.deleted && !record.skipped && (alert.previousState == null ||
            alert.previousState in setOf("Scheduled", "Pending", "Blocked", "NoAlert"))
          db.records().pending(projection("recover:${alert.occurrenceId}:${alert.generation}", record, alert.generation)
            .copy(targetMs = alert.targetMs, eligible = eligible))
        }
      }
      applyPending(db); replayHistory(db)
      try { syncProtectedSettings(db.records().settings() ?: SettingsRecord()) }
      catch (_: Exception) { /* Leave mirror repair retryable, never block scheduling recovery. */ }
    }
    alerts.pendingBulkSnoozes().forEach { resumeBulkSnooze(it) }
    alerts.all().filter { it.state in setOf("Scheduled", "Pending", "Blocked") }.forEach { register(it) }
    series.recover()
    val caps = capabilities()
    Log.i("Remilo", "Recovery finished: unlocked=${caps["unlocked"]} exact=${caps["exactAlarms"]} notifications=${caps["notifications"]} channel=${caps["channelEnabled"]}")
    changed()
  }

  internal fun close() {
    worker.submit { preview.close(); content?.close(); operational.close() }.get(10, TimeUnit.SECONDS)
    worker.shutdown()
  }

  companion object {
    @Volatile private var instance: AlarmEngine? = null
    fun get(context: Context): AlarmEngine = instance ?: synchronized(this) {
      instance ?: AlarmEngine(context.applicationContext).also { instance = it }
    }
  }
}

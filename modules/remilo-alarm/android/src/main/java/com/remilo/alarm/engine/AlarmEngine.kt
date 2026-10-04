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
      try { resolve(block()) } catch (_: IllegalArgumentException) { reject("INVALID_INPUT") }
      catch (_: IllegalStateException) { reject("NOT_AVAILABLE") }
      catch (_: Exception) { reject("STORAGE_ERROR") }
    }
  }

  fun capabilities(): Map<String, Any> {
    val manager = context.getSystemService(NotificationManager::class.java)
    val channel = manager.getNotificationChannel(AlarmNotifications.RINGING_CHANNEL)
    return mapOf("exactAlarms" to scheduler.canSchedule(),
      "notifications" to manager.areNotificationsEnabled(),
      "channelEnabled" to (channel == null || channel.importance != NotificationManager.IMPORTANCE_NONE),
      "fullScreen" to manager.canUseFullScreenIntent(), "unlocked" to unlocked(),
      "observedAtMs" to now())
  }

  private fun ready(): Boolean {
    val capabilities = capabilities()
    return capabilities["exactAlarms"] == true && capabilities["notifications"] == true &&
      capabilities["channelEnabled"] == true
  }
  fun query(filter: String, cursor: String?): Map<String, Any?> {
    val db = content()
    replayHistory(db)
    val records = db.records().all().filter {
      filter != "attention" || alerts.find(it.id)?.state in setOf("Missed", "Stopped", "TimedOut", "Interrupted", "Blocked", "Failed")
    }
    val offset = cursor?.toIntOrNull()?.coerceAtLeast(0) ?: 0
    val page = records.drop(offset).take(50)
    return mapOf("items" to page.map { view(it) },
      "nextCursor" to if (offset + page.size < records.size) (offset + page.size).toString() else null)
  }
  fun occurrence(id: String): Map<String, Any?>? = content().records().find(id)?.let { view(it) }
  private fun view(record: ReminderRecord): Map<String, Any?> {
    val alert = alerts.find(record.id)
    return mapOf("id" to record.id, "title" to record.title, "eventStartMs" to record.eventStartMs,
      "eventEndMs" to record.eventEndMs, "dueAtMs" to record.dueAtMs, "completed" to record.completed,
      "revision" to record.revision, "nextAlertMs" to alert?.targetMs,
      "generation" to (alert?.generation ?: 0L), "deliveryState" to (alert?.state ?: "Pending"))
  }
  private fun epoch(value: Any?): Long {
    val number = (value as? Number)?.toDouble() ?: throw IllegalArgumentException()
    require(number.isFinite() && number >= 0 && number <= 8_640_000_000_000_000L)
    return number.toLong()
  }
  fun preview(draft: Map<String, Any?>): Map<String, Any> {
    val at = epoch(draft["alarmAtMs"])
    return mapOf("alarmAtMs" to at, "eventStartMs" to epoch(draft["eventStartMs"] ?: at),
      "dueAtMs" to epoch(draft["dueAtMs"] ?: at), "warnings" to emptyList<String>())
  }
  fun apply(command: Map<String, Any?>): Map<String, Any?> {
    val operationId = command["operationId"] as? String ?: throw IllegalArgumentException()
    require(operationId.length in 1..200)
    return when (command["kind"]) {
      "Create" -> create(operationId, command)
      "Stop", "Snooze" -> {
        val id = command["occurrenceId"] as? String ?: throw IllegalArgumentException()
        val generation = (command["expectedGeneration"] as? Number)?.toLong() ?: throw IllegalArgumentException()
        applyAction(id, generation, command["kind"] as String, operationId)
      }
      else -> mapOf("status" to "Rejected", "errorCode" to "UNSUPPORTED_COMMAND")
    }
  }
  fun testAlarm(): Map<String, Any?> = create(UUID.randomUUID().toString(), mapOf(
    "title" to "Remilo test alarm", "alarmAtMs" to now() + 15_000L))
  private fun create(operationId: String, command: Map<String, Any?>): Map<String, Any?> {
    val db = content()
    db.records().receipt(operationId)?.let {
      applyPending(db)
      return result(it.occurrenceId)
    }
    val title = (command["title"] as? String)?.trim() ?: ""
    require(title.isNotEmpty() && title.length <= 200)
    val target = epoch(command["alarmAtMs"])
    require(target > now())
    val eventStart = epoch(command["eventStartMs"] ?: target)
    val eventEnd = epoch(command["eventEndMs"] ?: (eventStart + 30 * 60_000L))
    require(eventEnd > eventStart)
    val id = UUID.randomUUID().toString()
    db.runInTransaction {
      db.records().insert(ReminderRecord(id, title, eventStart, eventEnd,
        epoch(command["dueAtMs"] ?: eventStart), now()))
      db.records().pending(PendingSchedule(operationId, id, target, 1))
      db.records().receipt(CreationReceipt(operationId, id))
    }
    applyPending(db)
    changed()
    return result(id)
  }
  private fun result(id: String): Map<String, Any?> {
    val alert = alerts.find(id)
    val status = when (alert?.state) { "Scheduled" -> "Scheduled"; "Blocked" -> "Blocked"; else -> "Pending" }
    return mapOf("status" to status, "occurrence" to occurrence(id))
  }
  private fun register(alert: AlertRecord): AlertRecord {
    val state = when {
      alert.targetMs <= now() -> "Missed"
      !ready() -> "Blocked"
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
          existing.state !in setOf("Pending", "Scheduled", "Blocked"))) {
        db.records().acknowledge(pending.operationId)
        continue
      }
      val desired = existing ?: AlertRecord(pending.occurrenceId, pending.targetMs, pending.generation, "Pending")
      alerts.put(desired)
      if (register(desired).state != "Blocked") db.records().acknowledge(pending.operationId)
    }
  }
  private fun replayHistory(db: ContentDatabase) {
    for (action in alerts.actions()) {
      db.records().history(HistoryRecord(action.operationId, action.occurrenceId, action.kind,
        action.occurredAtMs, action.generation))
      alerts.acknowledge(action.operationId) // history insert is idempotent; no operational replay
    }
  }
  private fun actionRecord(id: String, kind: String, generation: Long, operationId: String = UUID.randomUUID().toString()) =
    ActionRecord(operationId, id, kind, now(), generation)

  private fun applyAction(id: String, expected: Long, kind: String, operationId: String): Map<String, Any?> {
    val old = alerts.find(id) ?: return mapOf("status" to "Rejected", "errorCode" to "NOT_FOUND")
    if (alerts.action(operationId) != null) return mapOf("status" to "Applied", "generation" to old.generation)
    if (old.generation != expected) return mapOf("status" to "Rejected", "errorCode" to "STALE_GENERATION")
    if (kind == "Stop" && old.state != "Alerting") return mapOf("status" to "Rejected", "errorCode" to "NOT_RINGING")
    val next = old.copy(generation = old.generation + 1, sessionId = null,
      targetMs = if (kind == "Snooze") now() + AlarmPolicy.SNOOZE_MILLIS else old.targetMs,
      state = if (kind == "Snooze") "Pending" else "Stopped")
    operational.runInTransaction {
      alerts.put(next)
      alerts.action(actionRecord(id, kind, next.generation, operationId))
    }
    try { scheduler.cancel(old) } catch (_: Exception) { /* generation already fences the old callback */ }
    val updated = if (kind == "Snooze") register(next) else next
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
      alert.state in setOf("Scheduled", "Pending"), ready())) {
      AlarmPolicy.Delivery.STALE -> return
      AlarmPolicy.Delivery.EARLY -> { register(alert); return }
      AlarmPolicy.Delivery.MISSED -> { alerts.put(alert.copy(state = "Missed")); changed(); return }
      AlarmPolicy.Delivery.BLOCKED -> { alerts.put(alert.copy(state = "Blocked")); changed(); return }
      AlarmPolicy.Delivery.RING -> Unit
    }
    var session = alerts.activeSession()
    if (session != null && session.deadlineElapsedMs > 0 && session.deadlineElapsedMs <= elapsed()) {
      endSession(session.id, "TimedOut")
      session = null
    }
    if (session == null) session = SessionRecord(UUID.randomUUID().toString(), "Starting")
    val active = session
    operational.runInTransaction {
      alerts.session(active)
      alerts.put(alert.copy(state = "Alerting", sessionId = active.id))
    }
    try {
      context.startForegroundService(Intent(context, RingingService::class.java).putExtra("sessionId", active.id))
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
    callback(alerts.members(sessionId).map { it to
      if (unlocked()) (content().records().find(it.occurrenceId)?.title ?: "Reminder") else "Reminder" })
  }
  fun recover(finished: () -> Unit = {}) = submit(finished) {
    if (unlocked()) { val db = content(); applyPending(db); replayHistory(db) }
    alerts.all().filter { it.state in setOf("Scheduled", "Pending", "Blocked") }.forEach { register(it) }
    val caps = capabilities()
    Log.i("Remilo", "Recovery finished: unlocked=${caps["unlocked"]} exact=${caps["exactAlarms"]} notifications=${caps["notifications"]} channel=${caps["channelEnabled"]}")
    changed()
  }

  internal fun close() {
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

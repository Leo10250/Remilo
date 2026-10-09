package com.remilo.alarm.engine

import android.os.UserManager
import android.content.Context
import com.remilo.alarm.core.*
import com.remilo.alarm.data.*
import com.remilo.alarm.system.AlarmRegistrar
import org.json.JSONObject
import java.time.*
import java.util.UUID

/** Called only on AlarmEngine's serialized worker; never starts another state owner. */
internal class SeriesCoordinator(private val context: Context, private val db: () -> ContentDatabase,
  private val operational: OperationalDatabase, private val scheduler: AlarmRegistrar,
  private val now: () -> Long, private val register: (AlertRecord) -> AlertRecord) {
  private val alerts get() = operational.records()
  private fun unlocked() = context.getSystemService(UserManager::class.java).isUserUnlocked
  private fun zone() = ZoneId.systemDefault()
  private fun scheduledAt(slot: ResolvedSlot, mode: String): Long =
    if (mode == "None") slot.eventStartMs else slot.alarmAtMs
  private fun scheduledAt(alert: AlertRecord, rule: RecurrenceRule): Long {
    if (alert.mode != "None") return alert.targetMs
    val resolved = Recurrence.resolve(if (alert.resolvedZone.isEmpty()) rule else rule.copy(zoneId = alert.resolvedZone),
      LocalDateTime.parse(alert.nominalSlot), zone())
    return resolved.eventStartMs
  }
  fun template(series: SeriesRecord): ReminderRecord = BackupCodec.decodeRecord(JSONObject(series.template)).let { record ->
    record.copy(listName = record.listId?.let { db().records().list(it)?.name }.orEmpty())
  }
  private fun encodeTemplate(record: ReminderRecord) = JSONObject(BackupCodec.record(record)).toString()
  private fun JSONObject.toMap(): Map<String, Any?> = keys().asSequence().associateWith { key ->
    val value = get(key); if (value == JSONObject.NULL) null else value
  }
  fun rule(record: ReminderRecord, spec: Map<String, Any?>): RecurrenceRule {
    val recordZone = ZoneId.of(record.zoneId)
    val anchor = Instant.ofEpochMilli(record.eventStartMs).atZone(recordZone).toLocalDateTime()
    fun integer(key: String, fallback: Int): Int {
      val number = spec[key] ?: return fallback
      require(number is Number && number.toDouble().isFinite() && number.toDouble() % 1 == 0.0 &&
        number.toDouble() in -1.0..100_000.0) { "Enter a valid recurrence number." }
      return number.toInt()
    }
    fun local(at: Long) = Instant.ofEpochMilli(at).atZone(recordZone).toLocalDateTime()
    val weekdays = (spec["weekdays"] as? List<*>)?.map { number ->
      require(number is Number && number.toDouble() % 1 == 0.0 && number.toDouble() in 1.0..7.0); number.toInt()
    } ?: listOf(anchor.dayOfWeek.value)
    require(spec["zoneMode"] == null || spec["zoneMode"] in setOf("floating", "pinned"))
    return RecurrenceRule(anchor, spec["frequency"] as? String ?: error("Choose a repeat rule."),
      integer("interval", 1), weekdays, integer("day", anchor.dayOfMonth), integer("ordinal", 1),
      integer("weekday", anchor.dayOfWeek.value), integer("month", anchor.monthValue),
      if (spec["count"] == null) null else integer("count", 1),
      (spec["until"] as? String)?.let { LocalDate.parse(it) },
      if (spec["zoneMode"] == "pinned") recordZone.id else null, allDay = record.allDay,
      endOffsetMs = if (record.allDay) 86_400_000 else record.eventEndMs - record.eventStartMs,
      dueOffsetMs = if (record.allDay && record.dueLinked) 86_400_000 else Duration.between(anchor, local(record.dueAtMs)).toMillis(),
      alarmOffsetMs = if (record.allDay && record.alarmLinked) 9 * 3_600_000 else
        Duration.between(anchor, local(record.definedAlarmAtMs ?: record.eventStartMs)).toMillis())
  }
  fun preview(record: ReminderRecord, spec: Map<String, Any?>): List<Map<String, Any?>> {
    val rule = rule(record, spec)
    return Recurrence.future(rule, now(), zone(), record.mode).take(3).map { slot ->
      mapOf("nominalSlot" to slot.nominal.toString(), "eventStartMs" to slot.eventStartMs,
        "dueAtMs" to slot.dueAtMs, "alarmAtMs" to slot.alarmAtMs, "adjusted" to slot.adjusted, "zoneId" to slot.zoneId)
    }.toList()
  }
  private fun occurrenceId(segment: String, nominal: String) = UUID.nameUUIDFromBytes("remilo:$segment:$nominal".toByteArray()).toString()
  private fun resolveRecord(segment: SeriesRecord, nominal: String, id: String, resolvedZone: String = ""): ReminderRecord {
    val original = template(segment)
    val rule = RuleCodec.decode(segment.rule)
    val slot = Recurrence.resolve(if (resolvedZone.isEmpty()) rule else rule.copy(zoneId = resolvedZone), LocalDateTime.parse(nominal), zone())
    return original.copy(id = id, eventStartMs = slot.eventStartMs, eventEndMs = slot.eventEndMs,
      dueAtMs = slot.dueAtMs, definedAlarmAtMs = slot.alarmAtMs, zoneId = slot.zoneId,
      segmentId = segment.id, nominalSlot = nominal, completed = false, deleted = false, revision = 1)
  }
  fun materialize() {
    if (!unlocked()) return
    val dao = db().records()
    alerts.all().filter { it.segmentId != null && it.nominalSlot != null }.forEach { alert ->
      val segment = dao.series(alert.segmentId!!) ?: return@forEach
      val existing = dao.find(alert.occurrenceId)
      val resolved = resolveRecord(segment, alert.nominalSlot!!, alert.occurrenceId, alert.resolvedZone)
      if (existing == null) dao.insert(resolved.copy(exception = alert.exception, skipped = alert.state in setOf("Skipped", "Replaced")))
      else if (alert.exception && !existing.exception) dao.update(existing.copy(exception = true))
      // Eligibility uses the retained private schedule. Travel can move a future
      // No alert slot into the past; its newly resolved DP zone must still project.
      else if (!existing.exception && !alert.exception && (if (alert.mode == "None") existing.eventStartMs else alert.targetMs) > now() &&
        alert.state in setOf("Scheduled", "Pending", "Blocked", "Paused", "NoAlert"))
        dao.update(resolved.copy(revision = existing.revision, createdAtMs = existing.createdAtMs,
          completed = existing.completed, deleted = existing.deleted, skipped = existing.skipped))
      if (alert.state == "Replaced" && existing != null && !existing.skipped)
        dao.update(existing.copy(skipped = true, revision = existing.revision + 1))
    }
  }
  fun get(id: String): Map<String, Any?>? = db().records().series(id)?.let { series ->
    val rule = RuleCodec.decode(series.rule)
    val rows = alerts.all().filter { it.segmentId == id }
    val original = template(series)
    val future = Recurrence.future(rule, now(), zone(), original.mode).take(3).toList()
    mapOf("id" to series.id, "seriesId" to series.seriesId, "revision" to series.revision,
      "state" to series.state, "exhausted" to future.isEmpty(), "template" to BackupCodec.record(original),
      "rule" to RuleCodec.map(rule), "registered" to rows.count { !it.exception && it.state == "Scheduled" && it.targetMs > now() },
      "pending" to rows.count { !it.exception && it.state == "Blocked" && it.targetMs > now() },
      "upcoming" to future.map { mapOf("nominalSlot" to it.nominal.toString(), "eventStartMs" to it.eventStartMs, "alarmAtMs" to it.alarmAtMs) })
  }
  fun list(): List<Map<String, Any?>> = db().records().series().filter { it.state != "Archived" }.mapNotNull { get(it.id) }
  /** Family identity survives splits and replacement; this projection never registers an alert. */
  fun families(): List<Map<String, Any?>> {
    val dao = db().records()
    val records = dao.all().associateBy { it.id }
    val deliveries = alerts.all().associateBy { it.occurrenceId }
    val at = now()
    return dao.series().groupBy { it.seriesId }.map { (familyId, segments) ->
      val ordinary = segments.filter { it.state != "Archived" }
      val representative = (ordinary.ifEmpty { segments }).sortedWith(
        compareByDescending<SeriesRecord> { it.createdAtMs }.thenBy { it.id }).first()
      val candidates = ordinary.flatMap { segment ->
        Recurrence.future(RuleCodec.decode(segment.rule), at, zone(), template(segment).mode).filter { slot ->
          val id = occurrenceId(segment.id, slot.nominal.toString())
          val record = records[id]
          val delivery = deliveries[id]
          record?.completed != true && record?.deleted != true && record?.skipped != true &&
            record?.exception != true && delivery?.exception != true &&
            delivery?.state !in setOf("Completed", "Deleted", "Skipped", "Replaced")
        }.take(3).map { slot -> segment to slot }.toList()
      }.sortedWith(compareBy<Pair<SeriesRecord, ResolvedSlot>> { it.second.eventStartMs }
        .thenBy { it.first.id }.thenBy { it.second.nominal })
      val ids = segments.map { it.id }.toSet()
      mapOf("seriesId" to familyId, "current" to requireNotNull(get(representative.id)),
        "state" to when { candidates.isEmpty() -> "Ended"; candidates.all { it.first.state == "Paused" } -> "Paused"; else -> "Active" },
        "upcoming" to candidates.take(3).map { (segment, slot) -> mapOf("segmentId" to segment.id,
          "nominalSlot" to slot.nominal.toString(), "eventStartMs" to slot.eventStartMs, "alarmAtMs" to slot.alarmAtMs,
          "zoneId" to slot.zoneId, "mode" to template(segment).mode, "state" to segment.state) },
        "unfinishedCount" to records.values.count { it.segmentId in ids && !it.completed && !it.deleted && !it.skipped })
    }.sortedBy { it["seriesId"] as String }
  }
  fun editTemplate(id: String, nominal: String?): ReminderRecord {
    val series = requireNotNull(db().records().series(id))
    return if (nominal == null) template(series) else resolveRecord(series, nominal, "editor")
  }
  fun editDraft(id: String, nominal: String): Map<String, Any?> {
    val segment = requireNotNull(db().records().series(id))
    val rule = RuleCodec.decode(segment.rule)
    val selected = Recurrence.future(rule, -367L * 86_400_000, zone(), template(segment).mode)
      .takeWhile { it.nominal <= LocalDateTime.parse(nominal) }.lastOrNull()
    require(selected?.nominal.toString() == nominal) { "Choose an original series slot." }
    return mapOf("template" to BackupCodec.record(editTemplate(id, nominal)),
      "remainingCount" to rule.count?.let { it - selected!!.index + 1 })
  }
  fun create(operation: String, record: ReminderRecord, spec: Map<String, Any?>): Map<String, Any?> {
    val dao = db().records()
    dao.receipt(operation)?.let {
      require(it.kind == "CreateSeries"); recover(); return mapOf("status" to "Applied", "segmentId" to it.occurrenceId)
    }
    val rule = rule(record, spec)
    require(Recurrence.future(rule, now(), zone(), record.mode).any()) { "No future occurrences. Change the rule or its ending." }
    val id = UUID.randomUUID().toString()
    val series = SeriesRecord(id, id, encodeTemplate(record), RuleCodec.encode(rule), createdAtMs = now())
    db().runInTransaction {
      dao.series(series); dao.pendingSeries(PendingSeries(operation, id)); dao.receipt(CreationReceipt(operation, id, "CreateSeries"))
    }
    recover()
    return response(id)
  }
  private fun response(id: String) = mapOf("status" to when {
      alerts.all().any { it.segmentId == id && it.state == "Blocked" } -> "Blocked"
      alerts.all().any { it.segmentId == id && it.state == "Scheduled" } -> "Scheduled"
      else -> "Applied" },
    "segmentId" to id)
  private fun fence(series: SeriesRecord, from: LocalDateTime? = null) {
    alerts.plan(series.id)?.let { alerts.plan(it.copy(state = "Changing")) }
    val rule = RuleCodec.decode(series.rule)
    alerts.all().filter { it.segmentId == series.id && !it.exception && scheduledAt(it, rule) > now() &&
      it.state in setOf("Scheduled", "Pending", "Blocked", "NoAlert", "Paused") &&
      (from == null || LocalDateTime.parse(it.nominalSlot) >= from) }.forEach { alert ->
      alerts.put(alert.copy(state = "SeriesChanging", previousState = alert.state, generation = alert.generation + 1))
      try { scheduler.cancel(alert) } catch (_: Exception) { /* fenced */ }
    }
  }
  fun mutate(operation: String, command: Map<String, Any?>, record: ReminderRecord? = null): Map<String, Any?> {
    val dao = db().records()
    val kind = command["kind"] as String
    val id = command["segmentId"] as? String ?: error("Choose a series.")
    dao.receipt(operation)?.let { require(it.kind == kind && it.sourceId == id); recover(); return response(it.occurrenceId) }
    val old = dao.series(id) ?: return mapOf("status" to "Rejected", "errorCode" to "NOT_FOUND")
    if ((command["expectedRevision"] as? Number)?.toDouble() != old.revision.toDouble())
      return mapOf("status" to "Rejected", "errorCode" to "STALE_REVISION", "errorMessage" to "This series changed. Reload before saving.")
    require(old.state != "Archived") { "This series segment was replaced. Open its current series." }
    val priorRule = RuleCodec.decode(old.rule)
    val following = if (kind == "EditFollowing") LocalDateTime.parse(command["nominalSlot"] as String) else null
    if (following != null) {
      require(following >= priorRule.anchor && (priorRule.endExclusive == null || following < priorRule.endExclusive))
      editDraft(id, following.toString()) // Only an actual original slot can split a series.
    }
    val nextRule = if (record != null) rule(record, command["recurrence"] as Map<String, Any?>) else priorRule
    if (record != null) require(Recurrence.future(nextRule, now(), zone(), record.mode).any()) { "No future occurrences. Change the rule or its ending." }
    val nextId = if (record == null) id else UUID.randomUUID().toString()
    val related = dao.series().filter { it.seriesId == old.seriesId && it.state != "Archived" &&
      (following == null || it.id == old.id || RuleCodec.decode(it.rule).anchor >= following) }
    related.forEach { fence(it, if (it.id == old.id) following else null) }
    db().runInTransaction {
      if (record == null) related.forEach { dao.series(it.copy(state = if (kind == "PauseSeries") "Paused" else "Active", revision = it.revision + 1)) }
      else {
        related.forEach { segment -> dao.series(segment.copy(state = if (following == null || segment.id != old.id) "Archived" else old.state,
          rule = if (following != null && segment.id == old.id) RuleCodec.encode(priorRule.copy(endExclusive = following)) else segment.rule,
          revision = segment.revision + 1)) }
        dao.series(SeriesRecord(nextId, old.seriesId, encodeTemplate(record), RuleCodec.encode(nextRule), state = old.state, createdAtMs = now()))
        dao.pendingSeries(PendingSeries("$operation:new", nextId))
      }
      related.forEach { dao.pendingSeries(PendingSeries("$operation:${it.id}", it.id)) }
      dao.receipt(CreationReceipt(operation, nextId, kind, id))
    }
    recover(); return response(nextId)
  }
  /** Recover CE intents when unlocked; protected rules remain sufficient when locked. */
  fun recover() {
    if (unlocked()) {
      val dao = db().records()
      val ids = (dao.pendingSeries().map { it.segmentId } + alerts.plans().filter { it.state == "Changing" }.map { it.id }).distinct()
      ids.forEach { id ->
        val series = dao.series(id) ?: return@forEach
        val private = template(series)
        val rule = RuleCodec.decode(series.rule)
        operational.runInTransaction {
          alerts.plan(SeriesPlan(id, RuleCodec.encode(rule), series.state, private.mode, private.sound,
            private.vibration, (dao.settings() ?: SettingsRecord()).snoozeMinutes, rule.zone(zone()).id,
            alerts.plan(id)?.materializedThrough))
          alerts.all().filter { it.segmentId == id && it.state == "SeriesChanging" }.forEach { alert ->
            val replaced = series.state == "Archived" || (rule.endExclusive != null && LocalDateTime.parse(alert.nominalSlot) >= rule.endExclusive)
            alerts.put(alert.copy(state = when { replaced -> "Replaced"; series.state == "Paused" -> "Paused"; else -> "Pending" }, previousState = null))
          }
        }
      }
      dao.pendingSeries().forEach { dao.acknowledgeSeries(it.operationId) }
    }
    replenish(); materialize()
  }
  /** Two independent normal future slots per segment, in addition to exceptions. */
  fun replenish() {
    for (plan in alerts.plans().filter { it.state == "Active" }) {
      val rule = RuleCodec.decode(plan.rule)
      val resolvedZone = rule.zone(zone()).id
      // Retain elapsed slots beyond the two-registration window after a long
      // outage. These rows are silent; they never dispatch presentation.
      plan.materializedThrough?.let { cursor ->
        val nominal = LocalDateTime.parse(cursor)
        val boundary = scheduledAt(Recurrence.resolve(rule, nominal, zone()), plan.mode)
        val elapsedSlots = Recurrence.future(rule, boundary - 1, zone(), plan.mode).filter { it.nominal > nominal }
          .takeWhile { scheduledAt(it, plan.mode) <= now() }.toList()
        operational.runInTransaction { elapsedSlots.forEach { slot ->
          val id = occurrenceId(plan.id, slot.nominal.toString())
          if (alerts.find(id) == null) alerts.put(AlertRecord(id, slot.alarmAtMs, 1, if (plan.mode == "None") "NoAlert" else "Missed", mode = plan.mode,
            sound = plan.sound, vibration = plan.vibration, snoozeMinutes = plan.snoozeMinutes,
            segmentId = plan.id, nominalSlot = slot.nominal.toString(), resolvedZone = slot.zoneId))
        } }
      }
      val rows = alerts.all().filter { it.segmentId == plan.id }
      // Elapsed delivery is never revived by travel/recovery. The receiver itself
      // may still handle its ordinary callback within the lateness window.
      rows.filter { !it.exception && scheduledAt(it, rule) <= now() && it.state in setOf("Paused") }.forEach {
        alerts.put(it.copy(state = if (it.mode == "None") "NoAlert" else "Missed", generation = it.generation + 1))
      }
      if (plan.resolvedZone != resolvedZone) {
        rows.filter { !it.exception && scheduledAt(it, rule) > now() && it.state in setOf("Scheduled", "Pending", "Blocked", "NoAlert") }.forEach { old ->
          val slot = Recurrence.resolve(rule, LocalDateTime.parse(old.nominalSlot), zone())
          alerts.put(old.copy(targetMs = slot.alarmAtMs, resolvedZone = resolvedZone, generation = old.generation + 1, state = "Pending"))
          try { scheduler.cancel(old) } catch (_: Exception) { /* old callback fenced */ }
        }
        alerts.plan(plan.copy(resolvedZone = resolvedZone))
      }
      val eligible = setOf("Scheduled", "Pending", "Blocked", "Paused", "NoAlert")
      val candidates = Recurrence.future(rule, now(), zone(), plan.mode).filter { slot ->
        val existing = alerts.find(occurrenceId(plan.id, slot.nominal.toString()))
        existing == null || (!existing.exception && scheduledAt(existing, rule) > now() && existing.state in eligible)
      }.take(2).toList()
      candidates.forEach { slot ->
        val nominal = slot.nominal.toString()
        val id = occurrenceId(plan.id, nominal)
        val old = alerts.find(id)
        val desired = old ?: AlertRecord(id, slot.alarmAtMs, 1, "Pending", mode = plan.mode,
          sound = plan.sound, vibration = plan.vibration, snoozeMinutes = plan.snoozeMinutes,
          segmentId = plan.id, nominalSlot = nominal, resolvedZone = slot.zoneId)
        if (desired.state != "Scheduled" && desired.state != "NoAlert") register(desired.copy(state = "Pending"))
      }
      val latest = alerts.all().filter { it.segmentId == plan.id }.mapNotNull { it.nominalSlot }.maxOrNull()
      alerts.plan((alerts.plan(plan.id) ?: plan).copy(materializedThrough = latest ?: plan.materializedThrough))
    }
  }
}

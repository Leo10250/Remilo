package com.remilo.alarm.core

import java.time.*
import java.time.temporal.ChronoUnit
import java.time.temporal.TemporalAdjusters

/** Civil-time rules. No Android, Room, JSON, network or bridge dependencies. */
data class RecurrenceRule(
  val anchor: LocalDateTime, val frequency: String, val interval: Int = 1,
  val weekdays: List<Int> = listOf(anchor.dayOfWeek.value), val day: Int = anchor.dayOfMonth,
  val ordinal: Int = 1, val weekday: Int = anchor.dayOfWeek.value, val month: Int = anchor.monthValue,
  val count: Int? = null, val until: LocalDate? = null, val zoneId: String? = null,
  val endExclusive: LocalDateTime? = null, val allDay: Boolean = false,
  val endOffsetMs: Long = 1_800_000, val dueOffsetMs: Long = 0, val alarmOffsetMs: Long = 0
) {
  init {
    require(anchor.year in 1970..9999)
    require(frequency in setOf("daily", "weekly", "monthlyDay", "monthlyOrdinal", "lastWeekday", "yearly"))
    require(interval in 1..999 && day in 1..31 && month in 1..12 && weekday in 1..7)
    require(ordinal in 1..5 || ordinal == -1)
    require(weekdays.isNotEmpty() && weekdays.all { it in 1..7 } && weekdays.distinct().size == weekdays.size)
    require(count == null || count in 1..100_000)
    require(until == null || (until >= anchor.toLocalDate() && until.year <= 9999))
    require(endOffsetMs > 0 && endOffsetMs <= 366L * 86_400_000)
    require(kotlin.math.abs(dueOffsetMs) <= 366L * 86_400_000 && kotlin.math.abs(alarmOffsetMs) <= 366L * 86_400_000)
    zoneId?.let { ZoneId.of(it) }
  }
  fun zone(deviceZone: ZoneId) = zoneId?.let { ZoneId.of(it) } ?: deviceZone
}

data class ResolvedSlot(val nominal: LocalDateTime, val index: Int,
  val eventStartMs: Long, val eventEndMs: Long, val dueAtMs: Long, val alarmAtMs: Long,
  val zoneId: String, val adjusted: Boolean)

object Recurrence {
  private fun gcd(a: Int, b: Int): Int = if (b == 0) a else gcd(b, a % b)
  private fun cycleStart(rule: RecurrenceRule, cycle: Long): LocalDate = when (rule.frequency) {
    "daily" -> rule.anchor.toLocalDate().plusDays(cycle * rule.interval)
    "weekly" -> rule.anchor.toLocalDate().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).plusWeeks(cycle * rule.interval)
    "yearly" -> LocalDate.of(rule.anchor.year, 1, 1).plusYears(cycle * rule.interval)
    else -> rule.anchor.toLocalDate().withDayOfMonth(1).plusMonths(cycle * rule.interval)
  }
  private fun candidates(rule: RecurrenceRule, cycle: Long): List<LocalDateTime> {
    val start = cycleStart(rule, cycle)
    val dates = when (rule.frequency) {
      "daily" -> listOf(start)
      "weekly" -> rule.weekdays.sorted().map { start.plusDays(it - 1L) }
      "yearly" -> {
        val ym = YearMonth.of(start.year, rule.month)
        if (rule.day <= ym.lengthOfMonth()) listOf(ym.atDay(rule.day)) else emptyList()
      }
      "monthlyDay" -> if (rule.day <= start.lengthOfMonth()) listOf(start.withDayOfMonth(rule.day)) else emptyList()
      "monthlyOrdinal" -> {
        val date = if (rule.ordinal == -1) start.with(TemporalAdjusters.lastInMonth(DayOfWeek.of(rule.weekday)))
          else start.with(TemporalAdjusters.dayOfWeekInMonth(rule.ordinal, DayOfWeek.of(rule.weekday)))
        if (date.month == start.month) listOf(date) else emptyList()
      }
      else -> {
        var date = start.with(TemporalAdjusters.lastDayOfMonth())
        while (date.dayOfWeek in setOf(DayOfWeek.SATURDAY, DayOfWeek.SUNDAY)) date = date.minusDays(1)
        listOf(date)
      }
    }
    return dates.map { it.atTime(rule.anchor.toLocalTime()) }.filter { it >= rule.anchor }
  }
  fun resolve(rule: RecurrenceRule, nominal: LocalDateTime, deviceZone: ZoneId, index: Int = 0): ResolvedSlot {
    val zone = rule.zone(deviceZone)
    val event = nominal.atZone(zone) // Java's documented gap-forward / earlier-fold policy.
    val end = if (rule.allDay) event.toLocalDate().plusDays(1).atStartOfDay(zone)
      else event.plusNanos(rule.endOffsetMs * 1_000_000)
    val due = if (rule.allDay && rule.dueOffsetMs == 86_400_000L) end
      else nominal.plusNanos(rule.dueOffsetMs * 1_000_000).atZone(zone)
    val alarm = nominal.plusNanos(rule.alarmOffsetMs * 1_000_000).atZone(zone)
    return ResolvedSlot(nominal, index, event.toInstant().toEpochMilli(), end.toInstant().toEpochMilli(),
      due.toInstant().toEpochMilli(), alarm.toInstant().toEpochMilli(), zone.id,
      event.toLocalDateTime() != nominal || due.toLocalDateTime() != nominal.plusNanos(rule.dueOffsetMs * 1_000_000) ||
        alarm.toLocalDateTime() != nominal.plusNanos(rule.alarmOffsetMs * 1_000_000))
  }
  /** Finite COUNT is consumed by valid nominal slots, including skipped/completed instances. */
  fun future(rule: RecurrenceRule, afterMs: Long, deviceZone: ZoneId, mode: String = "Alarm"): Sequence<ResolvedSlot> = sequence {
    // A retained alert offset has no scheduling meaning while this series has no alert.
    val noAlert = mode == "None"
    // No-count rules can seek. ±18h covers all legal zone offsets, including travel.
    val bound = Instant.ofEpochMilli(afterMs).atOffset(ZoneOffset.UTC).toLocalDateTime()
      .minusNanos(if (noAlert) 0 else rule.alarmOffsetMs * 1_000_000).minusHours(18).toLocalDate()
    val base = cycleStart(rule, 0)
    val distance = when (rule.frequency) {
      "daily" -> ChronoUnit.DAYS.between(base, bound)
      "weekly" -> ChronoUnit.WEEKS.between(base, bound)
      "yearly" -> bound.year.toLong() - base.year
      else -> ChronoUnit.MONTHS.between(YearMonth.from(base), YearMonth.from(bound))
    }
    var cycle = if (rule.count != null) 0L else (distance / rule.interval - 1).coerceAtLeast(0)
    var consumed = 0
    var emptyCycles = 0
    val repeat = when (rule.frequency) { "yearly" -> 400 / gcd(400, rule.interval)
      "monthlyDay", "monthlyOrdinal" -> 4800 / gcd(4800, rule.interval); else -> 1 }
    while (true) {
      val start = try { cycleStart(rule, cycle) } catch (_: DateTimeException) { break }
      if (start.year > 9999 || (rule.until != null && start > rule.until) ||
        (rule.endExclusive != null && start.atStartOfDay() > rule.endExclusive)) break
      val slots = candidates(rule, cycle++)
      if (slots.isEmpty()) { if (++emptyCycles > repeat) break } else emptyCycles = 0
      for (nominal in slots) {
        if (rule.until != null && nominal.toLocalDate() > rule.until) return@sequence
        if (rule.endExclusive != null && nominal >= rule.endExclusive) return@sequence
        consumed++
        if (rule.count != null && consumed > rule.count) return@sequence
        val resolved = resolve(rule, nominal, deviceZone, consumed)
        if ((if (noAlert) resolved.eventStartMs else resolved.alarmAtMs) > afterMs) yield(resolved)
      }
    }
  }
}

package com.remilo.alarm.core

import org.json.JSONArray
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import android.app.Application
import java.time.*

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34], application = Application::class)
class RecurrenceTest {
  @Test fun portableCalendarCasesConform() {
    val cases = JSONArray(javaClass.getResourceAsStream("/recurrence.json")!!.bufferedReader().use { it.readText() })
    for (index in 0 until cases.length()) {
      val obj = cases.getJSONObject(index)
      val anchor = LocalDateTime.parse(obj.getString("anchor"))
      val days = obj.optJSONArray("weekdays")
      val rule = RecurrenceRule(anchor, obj.getString("frequency"), obj.optInt("interval", 1),
        days?.let { (0 until it.length()).map { index -> it.getInt(index) } } ?: listOf(anchor.dayOfWeek.value),
        obj.optInt("day", anchor.dayOfMonth), obj.optInt("ordinal", 1), obj.optInt("weekday", anchor.dayOfWeek.value),
        obj.optInt("month", anchor.monthValue), if (obj.has("count")) obj.getInt("count") else null)
      val expected = obj.getJSONArray("expected")
      val actual = Recurrence.future(rule, Instant.parse(obj.getString("after")).toEpochMilli(), ZoneId.of(obj.getString("zone")))
        .take(expected.length()).map { Instant.ofEpochMilli(it.alarmAtMs).toString() }.toList()
      assertEquals(obj.getString("name"), (0 until expected.length()).map { expected.getString(it) }, actual)
    }
  }
  @Test fun finiteCountIncludesPastAndDateEndingIsInclusive() {
    val rule = RecurrenceRule(LocalDateTime.parse("2027-01-01T09:00"), "daily", count = 3)
    assertEquals(1, Recurrence.future(rule, Instant.parse("2027-01-02T10:00:00Z").toEpochMilli(), ZoneOffset.UTC).count())
    assertEquals(2, Recurrence.future(rule.copy(count = null, until = LocalDate.parse("2027-01-02")), 0, ZoneOffset.UTC).count())
  }
  @Test fun floatingTravelChangesInstantsButNeverNominalIdentity() {
    val rule = RecurrenceRule(LocalDateTime.parse("2027-01-01T09:00"), "daily")
    val west = Recurrence.future(rule, 0, ZoneId.of("America/Los_Angeles")).first()
    val east = Recurrence.future(rule, 0, ZoneId.of("America/New_York")).first()
    assertEquals(west.nominal, east.nominal)
    assertEquals(3 * 3_600_000L, west.alarmAtMs - east.alarmAtMs)
    val pinned = rule.copy(zoneId = "America/Los_Angeles")
    assertEquals(Recurrence.future(pinned, 0, ZoneOffset.UTC).first().alarmAtMs,
      Recurrence.future(pinned, 0, ZoneId.of("Asia/Tokyo")).first().alarmAtMs)
  }
  @Test fun allDayDeadlineUsesLocalBoundaryAndImpossibleRulesTerminate() {
    val rule = RecurrenceRule(LocalDateTime.parse("2027-03-14T00:00"), "daily", allDay = true,
      dueOffsetMs = 86_400_000, alarmOffsetMs = 9 * 3_600_000)
    val first = Recurrence.future(rule, 0, ZoneId.of("America/Los_Angeles")).first()
    assertEquals(23 * 3_600_000L, first.dueAtMs - first.eventStartMs)
    assertEquals(first.eventEndMs, first.dueAtMs)
    assertTrue(Recurrence.future(rule.copy(frequency = "yearly", interval = 4, day = 29, month = 2),
      0, ZoneOffset.UTC).none()) // 2027 + 4n is never a leap year.
    assertTrue(Recurrence.future(rule.copy(frequency = "monthlyDay", interval = 12, day = 31,
      anchor = LocalDateTime.parse("2027-02-01T09:00")), 0, ZoneOffset.UTC).none())
  }
  @Test fun independentLocalTimingRetainsItsClockAcrossGap() {
    val rule = RecurrenceRule(LocalDateTime.parse("2027-03-14T01:30"), "daily", dueOffsetMs = 2 * 3_600_000)
    val first = Recurrence.future(rule, 0, ZoneId.of("America/Los_Angeles")).first()
    assertEquals("2027-03-14T10:30:00Z", Instant.ofEpochMilli(first.dueAtMs).toString())
    val shifted = Recurrence.future(rule.copy(anchor = LocalDateTime.parse("2027-03-14T02:30")), 0,
      ZoneId.of("America/Los_Angeles")).first()
    assertEquals(1_800_000L, shifted.eventEndMs - shifted.eventStartMs)
  }
  @Test fun noAlertUpcomingUsesEventStartWithoutChangingAuthoredAlertOrCount() {
    val anchor = LocalDateTime.parse("2027-01-01T09:00")
    val after = Instant.parse("2027-01-01T10:00:00Z").toEpochMilli()
    for (offset in listOf(-2L * 86_400_000, 2L * 86_400_000)) {
      val rule = RecurrenceRule(anchor, "daily", count = 3, alarmOffsetMs = offset)
      val future = Recurrence.future(rule, after, ZoneOffset.UTC, "None").toList()
      assertEquals(listOf("2027-01-02T09:00", "2027-01-03T09:00"), future.map { it.nominal.toString() })
      assertEquals(listOf(2, 3), future.map { it.index })
      assertTrue(future.all { it.alarmAtMs - it.eventStartMs == offset })
      assertEquals(Recurrence.future(rule, after, ZoneOffset.UTC).toList(),
        Recurrence.future(rule, after, ZoneOffset.UTC, "Notification").toList())
    }
  }
  @Test fun noAlertSeekIgnoresHiddenOffsetsForUnboundedSeries() {
    val anchor = LocalDateTime.parse("2020-01-01T09:00")
    val after = Instant.parse("2027-01-02T10:00:00Z").toEpochMilli()
    for (offset in listOf(-30L * 86_400_000, 30L * 86_400_000)) {
      val rule = RecurrenceRule(anchor, "daily", alarmOffsetMs = offset)
      assertEquals(listOf("2027-01-03T09:00", "2027-01-04T09:00", "2027-01-05T09:00"),
        Recurrence.future(rule, after, ZoneOffset.UTC, "None").take(3).map { it.nominal.toString() }.toList())
    }
  }
  @Test fun noAlertInvalidMonthlyDaysStillDoNotConsumeCount() {
    val rule = RecurrenceRule(LocalDateTime.parse("2027-01-31T09:00"), "monthlyDay", count = 3,
      alarmOffsetMs = 20L * 86_400_000)
    val after = Instant.parse("2027-02-02T00:00:00Z").toEpochMilli()
    val future = Recurrence.future(rule, after, ZoneOffset.UTC, "None").toList()
    assertEquals(listOf("2027-03-31T09:00", "2027-05-31T09:00"), future.map { it.nominal.toString() })
    assertEquals(listOf(2, 3), future.map { it.index })
  }
}

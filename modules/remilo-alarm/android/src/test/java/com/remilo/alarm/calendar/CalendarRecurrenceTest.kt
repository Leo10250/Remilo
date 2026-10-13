package com.remilo.alarm.calendar

import com.remilo.alarm.core.*
import java.time.*
import org.json.*
import org.junit.Test
import org.junit.Assert.*
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34], application = android.app.Application::class)
class CalendarRecurrenceTest {
  private val zone = ZoneId.of("America/Los_Angeles")
  private fun dates(rule: RecurrenceRule) = Recurrence.future(rule, -1, zone, "None").take(6).map { it.nominal.toLocalDate().toString() }.toList()
  private fun roundtrip(rule: RecurrenceRule): RecurrenceRule = CalendarRecurrence.decode(CalendarRecurrence.encode(rule), rule.anchor, zone.id, rule.allDay, rule.endOffsetMs)
  @Test fun standardRulesMatchExplicitCalendarNominalFixtures() {
    val cases = listOf(
      RecurrenceRule(LocalDateTime.parse("2027-01-31T09:00"), "monthlyDay", count = 4, zoneId = zone.id) to listOf("2027-01-31", "2027-03-31", "2027-05-31", "2027-07-31"),
      RecurrenceRule(LocalDateTime.parse("2028-02-29T09:00"), "yearly", count = 3, zoneId = zone.id) to listOf("2028-02-29", "2032-02-29", "2036-02-29"),
      RecurrenceRule(LocalDateTime.parse("2027-01-29T09:00"), "monthlyOrdinal", ordinal = 5, weekday = 5, count = 3, zoneId = zone.id) to listOf("2027-01-29", "2027-04-30", "2027-07-30"),
      RecurrenceRule(LocalDateTime.parse("2027-01-29T09:00"), "lastWeekday", count = 3, zoneId = zone.id) to listOf("2027-01-29", "2027-02-26", "2027-03-31"),
      RecurrenceRule(LocalDateTime.parse("2027-01-04T09:00"), "weekly", interval = 2, weekdays = listOf(1, 5), count = 4, zoneId = zone.id) to listOf("2027-01-04", "2027-01-08", "2027-01-18", "2027-01-22"))
    cases.forEach { (rule, expected) -> assertEquals(expected, dates(rule)); assertEquals(expected, dates(roundtrip(rule))) }
  }
  @Test fun untilAndSplitRespectExactExclusiveSlotAndOriginalCount() {
    val rule = RecurrenceRule(LocalDateTime.parse("2027-01-04T09:00"), "daily", count = 2, zoneId = zone.id,
      endExclusive = LocalDateTime.parse("2027-01-20T09:00"))
    assertEquals(listOf("2027-01-04", "2027-01-05"), dates(roundtrip(rule)))
    assertEquals(listOf("2027-01-04"), dates(roundtrip(rule.copy(endExclusive = LocalDateTime.parse("2027-01-05T09:00")))))
  }
  @Test fun canonicalStartPreservesNativeCountAndIntervalWhenAnchorIsOutsideThePattern() {
    val rule = RecurrenceRule(LocalDateTime.parse("2027-01-04T09:00"), "monthlyDay", interval = 2, day = 31, count = 3, zoneId = zone.id)
    val canonical = CalendarRecurrence.canonical(rule)
    assertEquals(LocalDateTime.parse("2027-01-31T09:00"), canonical.anchor)
    assertEquals(dates(rule), dates(roundtrip(canonical)))
    try { CalendarRecurrence.decode(CalendarRecurrence.encode(rule), rule.anchor, zone.id, false, 1_800_000); fail("Google DTSTART outside the pattern needs review") }
    catch (error: CalendarFailure) { assertEquals("UNSUPPORTED_RECURRENCE", error.code) }
  }
  @Test fun namedZonePreservesCivilDstPolicyAndAllDayBoundaries() {
    val rule = RecurrenceRule(LocalDateTime.parse("2027-03-13T02:30"), "daily", count = 3, zoneId = zone.id)
    val slots = Recurrence.future(roundtrip(rule), -1, zone).toList()
    assertEquals("2027-03-14T03:30", Instant.ofEpochMilli(slots[1].eventStartMs).atZone(zone).toLocalDateTime().toString())
    val allDay = rule.copy(anchor = LocalDateTime.parse("2027-03-14T00:00"), allDay = true, count = 1)
    val slot = Recurrence.future(roundtrip(allDay), -1, zone).first()
    assertEquals(23 * 3_600_000L, slot.eventEndMs - slot.eventStartMs)
  }
  @Test fun rejectsUnsupportedExtensionsAndNeverFlattensThem() {
    listOf("RRULE:FREQ=HOURLY", "RRULE:FREQ=DAILY;BYHOUR=9", "RRULE:FREQ=MONTHLY;BYDAY=MO",
      "RRULE:FREQ=WEEKLY;WKST=SU", "RRULE:FREQ=DAILY;COUNT=2;UNTIL=20270106T000000Z").forEach {
      try { CalendarRecurrence.decode(JSONArray().put(it), LocalDateTime.parse("2027-01-04T09:00"), zone.id, false, 1_800_000); fail(it) }
      catch (error: CalendarFailure) { assertEquals("UNSUPPORTED_RECURRENCE", error.code) }
    }
  }
  @Test fun movedInstanceRetainsItsOriginalNamedZoneSlot() {
    val event = JSONObject().put("originalStartTime", JSONObject().put("dateTime", "2027-03-15T16:00:00Z"))
      .put("start", JSONObject().put("dateTime", "2027-03-16T16:00:00Z"))
    assertEquals(LocalDateTime.parse("2027-03-15T09:00"), CalendarRecurrence.originalSlot(event, zone.id))
  }
}

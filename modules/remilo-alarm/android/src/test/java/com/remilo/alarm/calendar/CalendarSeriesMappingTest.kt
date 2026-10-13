package com.remilo.alarm.calendar

import com.remilo.alarm.core.*
import com.remilo.alarm.data.*
import java.time.*
import org.json.*
import org.junit.*
import org.junit.Assert.*
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34], application = android.app.Application::class)
class CalendarSeriesMappingTest {
  private val rule = RecurrenceRule(LocalDateTime.parse("2027-01-04T09:00"), "daily", count = 10, zoneId = "UTC")
  private val record = ReminderRecord("template", "Title", 1_799_053_200_000, 1_799_055_000_000, 1_799_053_200_000, 0,
    zoneId = "UTC", segmentId = "segment", nominalSlot = "2027-01-04T09:00", exception = true)
  private fun segment(id: String, rule: RecurrenceRule) = SeriesRecord(id, "family", JSONObject(BackupCodec.record(record)).toString(), RuleCodec.encode(rule), createdAtMs = 0)
  @Test fun stableMasterIdentityAndFollowingScopeNeverExpandToInstanceWrites() {
    val old = segment("old", rule); val next = segment("next", rule.copy(anchor = LocalDateTime.parse("2027-01-08T09:00"), count = 6))
    val (trim, create) = CalendarSeriesMapping.split("account", "calendar", old, next, rule.anchor.plusDays(4))
    assertEquals(CalendarSeriesMapping.master("account", "calendar", old).eventId, trim.eventId)
    assertNotEquals(trim.eventId, create.eventId)
    assertTrue(trim.payload.getJSONArray("recurrence").getString(0).contains("UNTIL=20270108T085959Z"))
    assertTrue(create.payload.getJSONArray("recurrence").getString(0).contains("COUNT=6"))
  }
  @Test fun movedExceptionRetainsOriginalSlotAndLocalTerminalActionsProduceNoRemotePayload() {
    val moved = record.copy(eventStartMs = record.eventStartMs + 86_400_000, eventEndMs = record.eventEndMs + 86_400_000)
    val payload = CalendarSeriesMapping.exception("instance", "master", moved, rule)!!
    assertEquals(rule.anchor, CalendarRecurrence.originalSlot(payload, "UTC"))
    assertNull(CalendarSeriesMapping.exception("instance", "master", moved.copy(skipped = true), rule))
    assertNull(CalendarSeriesMapping.exception("instance", "master", moved.copy(completed = true), rule))
    assertNull(CalendarSeriesMapping.exception("instance", "master", moved.copy(deleted = true), rule))
  }
}

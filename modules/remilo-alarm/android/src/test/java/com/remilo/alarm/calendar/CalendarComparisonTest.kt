package com.remilo.alarm.calendar

import org.json.JSONObject
import org.junit.Test
import org.junit.Assert.*
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34], application = android.app.Application::class)
class CalendarComparisonTest {
  private fun fields(title: String = "Title", notes: String = "Notes", time: Long = 1000) = JSONObject().put("title", title).put("notes", notes)
    .put("schedule", JSONObject().put("eventStartMs", time).put("eventEndMs", time + 1000).put("allDay", false).put("zoneId", "UTC"))
  @Test fun fiveCasesAndDifferentGroupMerge() {
    val base = fields()
    assertTrue(CalendarComparison.compare(base, base, base).conflicts.isEmpty())
    assertEquals(setOf("title"), CalendarComparison.compare(fields("Local"), base, base).outbound)
    assertEquals(setOf("schedule"), CalendarComparison.compare(base, fields(time = 2000), base).inbound)
    assertTrue(CalendarComparison.compare(fields("Shared"), fields("Shared"), base).outbound.isEmpty())
    assertEquals(setOf("title"), CalendarComparison.compare(fields("Local"), fields("Google"), base).conflicts)
    val merged = CalendarComparison.compare(fields("Local"), fields(notes = "", time = 2000), base)
    assertEquals(setOf("title"), merged.outbound); assertEquals(setOf("notes", "schedule"), merged.inbound)
    assertEquals("Local", merged.desired.getString("title")); assertEquals("", merged.desired.getString("notes"))
  }
  @Test fun absentBaselineRequiresChoicesForEveryDifference() {
    assertEquals(setOf("title", "notes"), CalendarComparison.compare(fields("Local"), fields("Google", "Other"), null).conflicts)
    assertTrue(CalendarComparison.compare(fields(), fields(), null).conflicts.isEmpty())
  }
}

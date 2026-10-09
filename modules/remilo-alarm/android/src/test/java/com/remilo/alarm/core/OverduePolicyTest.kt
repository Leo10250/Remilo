package com.remilo.alarm.core

import java.time.Instant
import java.time.ZoneId
import java.time.ZoneOffset
import org.junit.Assert.*
import org.junit.Test

class OverduePolicyTest {
  private fun instant(value: String) = Instant.parse(value).toEpochMilli()

  @Test fun alarmAndNotificationUseTheAuthoredAlertIncludingAllDay() {
    val event = instant("2027-03-14T08:00:00Z")
    val alert = instant("2027-03-14T16:00:00Z")
    for (mode in listOf("Alarm", "Notification")) {
      assertEquals(alert, OverduePolicy.reference(mode, event, alert, false, ZoneOffset.UTC))
      assertEquals(alert, OverduePolicy.reference(mode, event, alert, true, ZoneId.of("America/Los_Angeles")))
    }
  }

  @Test fun missingLegacyAlertFallsBackToTheSavedEventStart() {
    val event = instant("2027-01-01T09:00:00Z")
    assertEquals(event, OverduePolicy.reference("Alarm", event, null, false, ZoneOffset.UTC))
    assertEquals(event, OverduePolicy.reference("Notification", event, null, true, ZoneOffset.UTC))
  }

  @Test fun timedNoAlertIgnoresItsRetainedAlarmTimeAndZone() {
    val event = instant("2027-01-01T09:00:00Z")
    for (hiddenAlert in listOf(null, event - 86_400_000, event + 86_400_000)) {
      assertEquals(event, OverduePolicy.reference("None", event, hiddenAlert, false, ZoneId.of("Asia/Tokyo")))
    }
  }

  @Test fun allDayNoAlertUsesTheNextLocalMidnightAcrossBothDstChanges() {
    val zone = ZoneId.of("America/Los_Angeles")
    val spring = instant("2027-03-14T08:00:00Z")
    val autumn = instant("2027-11-07T07:00:00Z")
    val springEnd = OverduePolicy.reference("None", spring, spring + 9 * 3_600_000, true, zone)
    val autumnEnd = OverduePolicy.reference("None", autumn, null, true, zone)
    assertEquals(instant("2027-03-15T07:00:00Z"), springEnd)
    assertEquals(23 * 3_600_000L, springEnd - spring)
    assertEquals(instant("2027-11-08T08:00:00Z"), autumnEnd)
    assertEquals(25 * 3_600_000L, autumnEnd - autumn)
  }

  @Test fun allDayImportedNonMidnightStartStillUsesItsScheduledDateBoundary() {
    // Imported event durations cannot extend the No alert completion boundary.
    val start = instant("2027-03-14T19:30:00Z")
    assertEquals(instant("2027-03-15T07:00:00Z"),
      OverduePolicy.reference("None", start, start + 3 * 86_400_000, true, ZoneId.of("America/Los_Angeles")))
  }

  @Test fun allDayBoundaryUsesTheResolvedScheduleZone() {
    val start = instant("2027-01-01T08:00:00Z")
    assertEquals(instant("2027-01-02T08:00:00Z"),
      OverduePolicy.reference("None", start, null, true, ZoneId.of("America/Los_Angeles")))
    assertEquals(instant("2027-01-02T00:00:00Z"),
      OverduePolicy.reference("None", start, null, true, ZoneOffset.UTC))
  }

  @Test fun overdueIsStrictlyPastAndIndependentOfDelivery() {
    assertFalse(OverduePolicy.isOverdue(1000, false, false, false, 999))
    assertFalse(OverduePolicy.isOverdue(1000, false, false, false, 1000))
    assertTrue(OverduePolicy.isOverdue(1000, false, false, false, 1001))
  }

  @Test fun completedSkippedAndDeletedWorkCannotBeOverdue() {
    assertFalse(OverduePolicy.isOverdue(1000, true, false, false, 1001))
    assertFalse(OverduePolicy.isOverdue(1000, false, true, false, 1001))
    assertFalse(OverduePolicy.isOverdue(1000, false, false, true, 1001))
  }
}

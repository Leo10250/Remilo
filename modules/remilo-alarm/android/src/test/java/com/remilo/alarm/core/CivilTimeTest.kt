package com.remilo.alarm.core

import java.time.Instant
import org.junit.Assert.*
import org.junit.Test

class CivilTimeTest {
  @Test fun gapsShiftByGapAndFoldsChooseEarlierOffset() {
    val gap = CivilTime.fromLocal("America/Los_Angeles", "2027-03-14T02:30:00")
    assertEquals("gapForward", gap["adjustment"])
    assertEquals("2027-03-14T03:30:00", gap["local"])
    assertEquals(Instant.parse("2027-03-14T10:30:00Z").toEpochMilli(), gap["instantMs"])
    val fold = CivilTime.fromLocal("America/Los_Angeles", "2027-11-07T01:30:00")
    assertEquals("earlierFold", fold["adjustment"])
    assertEquals(-7 * 3_600, fold["offsetSeconds"])
    assertEquals(Instant.parse("2027-11-07T08:30:00Z").toEpochMilli(), fold["instantMs"])
  }
  @Test fun conversionPreservesInstantsAndExistingZoneAliases() {
    val instant = Instant.parse("2027-07-12T17:15:20.123Z").toEpochMilli()
    val displayed = CivilTime.fromInstant("US/Pacific", instant)
    assertEquals("US/Pacific", displayed["zoneId"])
    assertEquals(instant, displayed["instantMs"])
    assertEquals("2027-07-12T10:15:20", displayed["local"])
    assertEquals("none", displayed["adjustment"])
    val local = CivilTime.fromLocal("US/Pacific", "2027-07-12T10:15:20")
    assertEquals("US/Pacific", local["zoneId"])
    assertEquals(instant - 123, local["instantMs"])
  }
  @Test fun allDayBoundariesRemainLocalMidnightAcrossClockChanges() {
    fun midnight(date: String) = CivilTime.fromLocal("America/Los_Angeles", "${date}T00:00:00")["instantMs"] as Long
    assertEquals(23 * 3_600_000L, midnight("2027-03-15") - midnight("2027-03-14"))
    assertEquals(25 * 3_600_000L, midnight("2027-11-08") - midnight("2027-11-07"))
  }
  @Test fun invalidZonesAndMalformedLocalTimesAreRejected() {
    listOf("2027-02-30T09:00:00", "2027-07-12T09:00:00Z", "2027-07-12T09:00:00.123").forEach { local ->
      assertThrows(IllegalArgumentException::class.java) { CivilTime.fromLocal("UTC", local) }
    }
    assertThrows(IllegalArgumentException::class.java) { CivilTime.fromLocal("Not/A_Zone", "2027-07-12T09:00:00") }
  }
}

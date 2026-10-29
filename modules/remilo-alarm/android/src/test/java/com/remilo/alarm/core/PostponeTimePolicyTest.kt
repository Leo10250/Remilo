package com.remilo.alarm.core

import java.time.Instant
import org.junit.Assert.*
import org.junit.Test

class PostponeTimePolicyTest {
  private fun at(value: String) = Instant.parse(value).toEpochMilli()
  private fun resolve(kind: String, reference: String, vararg values: Pair<String, Any?>) =
    PostponeTimePolicy.resolve(mapOf("kind" to kind, "zoneId" to "America/Los_Angeles",
      "referenceAtMs" to at(reference)) + values)

  @Test fun relativeMinutesFreezeTheSelectedInstantAcrossMidnightAndDst() {
    val reference = "2027-07-13T06:50:20.123Z"
    listOf(15, 30, 60, 1440).forEach { minutes ->
      assertEquals(at(reference) + minutes * 60_000L, resolve("Relative", reference, "minutes" to minutes)["instantMs"])
    }
    val midnight = resolve("Relative", "2027-07-13T06:50:20.123Z", "minutes" to 30)
    assertEquals(at("2027-07-13T07:20:20.123Z"), midnight["instantMs"])
    assertEquals("2027-07-13T00:20:20", midnight["local"])
    val spring = resolve("Relative", "2027-03-13T18:00:00Z", "minutes" to 1440)
    val fall = resolve("Relative", "2027-11-06T17:00:00Z", "minutes" to 1440)
    assertEquals("2027-03-14T11:00:00", spring["local"])
    assertEquals("2027-11-07T09:00:00", fall["local"])
    assertEquals(86_400_000L, (spring["instantMs"] as Long) - at("2027-03-13T18:00:00Z"))
    assertEquals(86_400_000L, (fall["instantMs"] as Long) - at("2027-11-06T17:00:00Z"))
  }

  @Test fun tomorrowUsesNextLocalDateAndConfiguredClockMinutes() {
    val tomorrow = resolve("Tomorrow", "2027-07-13T06:50:00Z", "minutesOfDay" to 840)
    assertEquals("2027-07-13T14:00:00", tomorrow["local"])
    assertEquals(at("2027-07-13T21:00:00Z"), tomorrow["instantMs"])
    listOf(
      "2027-01-31T20:00:00Z" to "2027-02-01T10:00:00",
      "2027-12-31T20:00:00Z" to "2028-01-01T10:00:00",
      "2028-02-28T20:00:00Z" to "2028-02-29T10:00:00"
    ).forEach { (reference, local) ->
      assertEquals(local, resolve("Tomorrow", reference, "minutesOfDay" to 600)["local"])
    }
    val spring = resolve("Tomorrow", "2027-03-13T18:00:00Z", "minutesOfDay" to 600)
    assertEquals(23 * 3_600_000L, (spring["instantMs"] as Long) - at("2027-03-13T18:00:00Z"))
  }

  @Test fun tomorrowAndCustomShareTheExistingGapAndFoldPolicy() {
    val gap = resolve("Tomorrow", "2027-03-13T18:00:00Z", "minutesOfDay" to 150)
    assertEquals("gapForward", gap["adjustment"])
    assertEquals("2027-03-14T03:30:00", gap["local"])
    val fold = resolve("Custom", "2027-11-06T17:00:00Z", "local" to "2027-11-07T01:30:00")
    assertEquals("earlierFold", fold["adjustment"])
    assertEquals(-7 * 3600, fold["offsetSeconds"])
    assertEquals(at("2027-11-07T08:30:00Z"), fold["instantMs"])
  }

  @Test fun sameReferenceAndSelectionAlwaysReturnSamePreview() {
    val input = mapOf("kind" to "Relative", "zoneId" to "UTC", "referenceAtMs" to at("2027-10-28T10:00:00Z"), "minutes" to 15)
    assertEquals(PostponeTimePolicy.resolve(input), PostponeTimePolicy.resolve(input))
    assertEquals(CivilTime.fromInstant("UTC", at("2027-10-28T10:15:00Z")), PostponeTimePolicy.resolve(input))
  }

  @Test fun invalidExpiredAndUnsupportedSelectionsNeverProduceATarget() {
    val base = mapOf<String, Any?>("kind" to "Relative", "zoneId" to "UTC",
      "referenceAtMs" to at("2027-10-28T10:00:00Z"), "minutes" to 15)
    listOf(
      base + ("minutes" to 0), base + ("minutes" to 2), base + ("minutes" to 1441), base + ("minutes" to 15.5),
      base + ("referenceAtMs" to Double.NaN), base + ("zoneId" to "Not/A_Zone"),
      base + ("kind" to "Unknown"), base + mapOf("kind" to "Tomorrow", "minutesOfDay" to 1440),
      base + mapOf("kind" to "Custom", "local" to "2027-10-28T10:00:00"),
      base + mapOf("kind" to "Custom", "local" to "2027-02-30T10:00:00"),
      base + mapOf("kind" to "Custom", "local" to "2027-10-29T10:00:00.123"),
      base + ("referenceAtMs" to at("9999-12-31T23:59:00Z"))
    ).forEach { input -> assertThrows(IllegalArgumentException::class.java) { PostponeTimePolicy.resolve(input) } }
  }
}

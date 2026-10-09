package com.remilo.alarm.core

import android.app.Application
import java.time.Instant
import java.time.ZoneId
import org.junit.Assert.*
import org.junit.Test
import org.json.JSONObject
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34], application = Application::class)
class AppearancePolicyTest {
  @Test fun sharedBoundaryAndZoneFixturesMatchTheAppResolver() {
    val source = javaClass.getResourceAsStream("/appearance-boundaries.json")!!.bufferedReader().use { it.readText() }
    val cases = JSONObject(source).getJSONArray("cases")
    for (index in 0 until cases.length()) {
      val fixture = cases.getJSONObject(index)
      val selection = if (fixture.isNull("selection")) null else fixture.getString("selection")
      val actual = AppearancePolicy.resolve(selection, "light", Instant.parse(fixture.getString("instant")).toEpochMilli(),
        ZoneId.of(fixture.getString("zone")), false)
      assertEquals(fixture.getString("label"), fixture.getString("expected"), actual.atmosphere)
    }
  }
  private fun resolve(local: String, zone: String = "America/Los_Angeles", selection: String? = "automatic", brightness: String? = "system", dark: Boolean = false) =
    AppearancePolicy.resolve(selection, brightness, java.time.LocalDateTime.parse(local).atZone(ZoneId.of(zone)).toInstant().toEpochMilli(), ZoneId.of(zone), dark)

  @Test fun everyInclusiveEdgeAndMidnightUsesTheCurrentLocalPeriod() {
    val cases = listOf("00:00:00" to "night", "05:59:59" to "night", "06:00:00" to "sunrise",
      "09:59:59" to "sunrise", "10:00:00" to "sky", "16:59:59" to "sky",
      "17:00:00" to "evening", "20:59:59" to "evening", "21:00:00" to "night", "23:59:59" to "night")
    cases.forEach { (time, scene) -> assertEquals(scene, resolve("2026-10-09T$time").atmosphere) }
  }
  @Test fun manualScenesAndBrightnessResolveIndependently() {
    AppearancePolicy.atmospheres.forEach { scene ->
      assertEquals(AppearancePolicy.Resolved(scene, "dark"), resolve("2026-10-09T07:00:00", selection = scene, brightness = "dark"))
      assertEquals(AppearancePolicy.Resolved(scene, "light"), resolve("2026-10-09T22:00:00", selection = scene, brightness = "light", dark = true))
    }
    assertEquals("dark", resolve("2026-10-09T12:00:00", dark = true).brightness)
    assertEquals("light", resolve("2026-10-09T12:00:00", dark = false).brightness)
  }
  @Test fun absentAndUnknownChoicesUseAutomaticAndSystem() {
    assertEquals(AppearancePolicy.Resolved("sky", "dark"), resolve("2026-10-09T12:00:00", selection = null, brightness = null, dark = true))
    assertEquals(AppearancePolicy.Resolved("sunrise", "light"), resolve("2026-10-09T06:00:00", selection = "legacy", brightness = "invalid"))
  }
  @Test fun dstChangesAndTravelResolveTheInstantInTheCurrentZone() {
    listOf("2027-03-14T09:59:59Z", "2027-03-14T10:00:00Z", "2026-11-01T08:30:00Z", "2026-11-01T09:30:00Z").forEach {
      assertEquals("night", AppearancePolicy.resolve("automatic", "light", Instant.parse(it).toEpochMilli(), ZoneId.of("America/Los_Angeles"), false).atmosphere)
    }
    val instant = Instant.parse("2026-10-09T16:00:00Z").toEpochMilli()
    assertEquals("sunrise", AppearancePolicy.resolve("automatic", "light", instant, ZoneId.of("America/Los_Angeles"), false).atmosphere)
    assertEquals("sky", AppearancePolicy.resolve("automatic", "light", instant, ZoneId.of("America/New_York"), false).atmosphere)
    assertEquals("night", AppearancePolicy.resolve("automatic", "light", instant, ZoneId.of("Asia/Shanghai"), false).atmosphere)
  }
  @Test fun capturedAppearanceNeverFollowsAnotherClockOrSystemConfiguration() {
    assertEquals(AppearancePolicy.Resolved("evening", "dark"), AppearancePolicy.captured("evening", "dark"))
    assertEquals(AppearancePolicy.Resolved("night", "dark"), AppearancePolicy.captured(null, null))
    assertEquals(AppearancePolicy.Resolved("night", "dark"), AppearancePolicy.captured("automatic", "system"))
  }
}

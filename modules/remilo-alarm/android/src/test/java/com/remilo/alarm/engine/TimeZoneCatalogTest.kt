package com.remilo.alarm.engine

import android.app.Application
import java.time.Instant
import java.time.ZoneId
import java.util.Locale
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34], application = Application::class)
class TimeZoneCatalogTest {
  @Test fun offlineCatalogHasHumanNamesSupportedIdsAndDateSpecificOffsets() {
    fun catalog(date: String) = TimeZoneCatalog.list(Instant.parse(date).toEpochMilli(), Locale.US).associateBy { it["id"] }
    val winter = catalog("2027-01-15T12:00:00Z")
    val summer = catalog("2027-07-15T12:00:00Z")
    assertTrue(winter.size > 300)
    assertTrue(winter.keys.all { it in ZoneId.getAvailableZoneIds() })
    assertTrue(winter.keys.none { (it as String).startsWith("SystemV/") || it in setOf("Factory", "Etc/Unknown", "US/Pacific") })
    assertTrue(winter.containsKey("UTC"))
    val losAngeles = winter.getValue("America/Los_Angeles")
    assertEquals("Los Angeles", losAngeles["label"])
    assertEquals("United States", losAngeles["region"])
    assertEquals(-8 * 3_600, losAngeles["offsetSeconds"])
    assertEquals(-7 * 3_600, summer.getValue("America/Los_Angeles")["offsetSeconds"])
    assertTrue(winter.values.all { (it["label"] as String).isNotBlank() && (it["region"] as String).isNotBlank() })
  }
}

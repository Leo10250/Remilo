package com.remilo.alarm.engine

import android.icu.text.TimeZoneNames
import android.icu.util.TimeZone
import android.icu.util.ULocale
import java.time.Instant
import java.time.ZoneId
import java.text.Collator
import java.util.Locale

/** New choices use ICU's canonical system zones with authoritative java.time offsets.
 * Stored aliases remain valid inputs to CivilTime and are never rewritten by this read. */
internal object TimeZoneCatalog {
  fun list(atMs: Long, locale: Locale = Locale.getDefault()): List<Map<String, Any>> {
    val names = TimeZoneNames.getInstance(locale)
    val displayLocale = ULocale.forLocale(locale)
    val instant = Instant.ofEpochMilli(atMs)
    val collator = Collator.getInstance(locale)
    val supported = ZoneId.getAvailableZoneIds()
    val selectable = TimeZone.getAvailableIDs(TimeZone.SystemTimeZoneType.CANONICAL, null, null)
      .filter { it in supported && !it.startsWith("SystemV/") && it !in setOf("Factory", "Etc/Unknown") }
      .toSet() + "UTC"
    return selectable.map { id ->
      val canonical = TimeZone.getCanonicalID(id) ?: id
      val label = if (canonical in setOf("Etc/UTC", "Etc/GMT")) "UTC" else
        names.getExemplarLocationName(canonical) ?: id.substringAfterLast('/').replace('_', ' ')
      val country = try { TimeZone.getRegion(canonical) } catch (_: IllegalArgumentException) { "001" }
      val region = if (country == "001") "Worldwide" else
        ULocale.Builder().setRegion(country).build().getDisplayCountry(displayLocale)
      mapOf("id" to id, "label" to label, "region" to region,
        "offsetSeconds" to ZoneId.of(id).rules.getOffset(instant).totalSeconds)
    }.sortedWith { a, b ->
      val byLabel = collator.compare(a["label"] as String, b["label"] as String)
      if (byLabel != 0) byLabel else (a["id"] as String).compareTo(b["id"] as String)
    }
  }
}

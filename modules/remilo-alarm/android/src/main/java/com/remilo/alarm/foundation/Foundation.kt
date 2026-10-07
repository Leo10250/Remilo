package com.remilo.alarm.foundation

internal enum class Brightness { Light, Dark }
internal data class ScenePlacement(val edge: String, val anchor: List<Float>, val quietRegion: List<Float>,
  val heightFraction: Float, val maxColumnDp: Float, val layout: String = "content-first")
internal data class Foundation(val id: String, val brightness: Brightness, val colors: Map<String, Long>,
  val scene: String?, val fallback: String = "none") {
  val revision: String get() = FoundationCatalog.revision
  fun placement(mode: String): ScenePlacement? = FoundationCatalog.placements["$id/${if (brightness == Brightness.Dark) "dark" else "light"}/$mode"]
}

/** Static rendering lookup only. No preference, content, time, database or engine access. */
internal object Foundations {
  fun lookup(id: String?, brightness: Brightness,
    source: Map<String, Map<String, Map<String, Long>>> = FoundationCatalog.colors): Foundation {
    val mode = if (brightness == Brightness.Dark) "dark" else "light"
    val requested = source[id]?.get(mode)
    fun valid(values: Map<String, Long>?) = values != null && FoundationCatalog.colors.getValue("classic").getValue(mode).keys
      .all { values[it]?.let { value -> value in 0xFF000000L..0xFFFFFFFFL } == true }
    val selected = if (valid(requested)) id!! else "classic"
    val colors = source[selected]?.get(mode)
    if (!valid(colors)) return emergency(brightness)
    return Foundation(selected, brightness, colors!!, FoundationCatalog.scenes["$selected/$mode"],
      if (selected == id) "none" else if (requested == null) "unknown-id" else "invalid-tokens")
  }
  fun missingArt(foundation: Foundation) = lookup("classic", foundation.brightness).copy(fallback = "missing-art")
  private fun emergency(brightness: Brightness): Foundation {
    // Independent emergency roles; intentionally simple, opaque and readable.
    val dark = brightness == Brightness.Dark
    val ink = if (dark) 0xFFFFFFFFL else 0xFF000000L
    val bg = if (dark) 0xFF101318L else 0xFFFFFFFFL
    val accent = if (dark) 0xFFA9C5FFL else 0xFF245CD6L
    val values = FoundationCatalog.colors.getValue("classic").getValue(if (dark) "dark" else "light").keys
      .associateWith { role -> when (role) {
        "background", "surface", "soft", "disabledSurface", "secondaryPressed", "selectedSurface", "dangerSurface" -> bg
        "accent", "primaryPressed", "focus" -> accent
        "accentInk", "onPrimaryPressed" -> if (dark) 0xFF102B59L else 0xFFFFFFFFL
        "inverseSurface" -> ink
        "inverseInk", "inverseAction" -> bg
        else -> ink
      } }
    return Foundation("classic", brightness, values, null, "emergency")
  }
}

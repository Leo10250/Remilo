package com.remilo.alarm.review

import android.graphics.Bitmap
import android.view.View
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.core.view.drawToBitmap
import org.json.JSONArray
import org.json.JSONObject
import org.junit.*
import org.junit.Assert.*
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File
import java.util.Locale
import java.util.TimeZone

/** Attributed pre-P02 controls; production layout/colors/type, synthetic records only. */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], qualifiers = "w360dp-h800dp-mdpi")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class P02BaselineCaptureTest {
  @get:Rule val compose = createAndroidComposeRule<AlarmDesignReviewActivity>()
  private lateinit var zone: TimeZone
  private lateinit var locale: Locale
  @Before fun fixedFormatting() {
    zone = TimeZone.getDefault(); locale = Locale.getDefault()
    TimeZone.setDefault(TimeZone.getTimeZone("America/Los_Angeles")); Locale.setDefault(Locale.US)
  }
  @After fun restoreFormatting() { TimeZone.setDefault(zone); Locale.setDefault(locale) }

  @Test fun capturesProductionSingleAndMultipleControls() {
    val output = File("build/outputs/design-review/p02-baseline")
    assertTrue(output.isDirectory || output.mkdirs())
    val entries = JSONArray()
    for (scenario in listOf(AlarmReviewScenario.Single, AlarmReviewScenario.Multiple)) {
      for (dark in listOf(false, true)) for (scale in listOf(1f, 2f)) {
        val config = AlarmReviewConfiguration(baseline = true, scenario = scenario, dark = dark, fontScale = scale)
        compose.runOnUiThread { compose.activity.showReview(config) }; compose.waitForIdle()
        compose.onNodeWithText("Remilo").assertIsDisplayed()
        val stem = "${scenario.name.lowercase()}-${if (dark) "dark" else "light"}-${scale.toInt()}x"
        entries.put(capture(output, "$stem-top.png", config, "top"))
        val controls = JSONArray()
        val count = if (scenario == AlarmReviewScenario.Multiple) 3 else 1
        for (label in listOf("Stop", "Snooze · 10 min")) for (index in 0 until count) {
          val node = compose.onAllNodesWithText(label)[index]
          node.performScrollTo().assertIsDisplayed().assertHasClickAction()
          // Material's painted button can be 40 dp with an expanded 48 dp touch
          // area. Measure actual input bounds, separately from displayed layout.
          val semantics = node.fetchSemanticsNode()
          val bounds = semantics.touchBoundsInRoot
          val density = compose.activity.resources.displayMetrics.density
          assertTrue("${scenario.name}/$dark/$scale/$label retains a 48 dp target: $bounds",
            bounds.width / density >= 48 && bounds.height / density >= 48)
          controls.put(JSONObject().put("label", label).put("memberIndex", index)
            .put("width", bounds.width / density).put("height", bounds.height / density)
            .put("paintedWidthPx", semantics.size.width).put("paintedHeightPx", semantics.size.height))
        }
        if (count > 1) compose.onNodeWithText("Stop all").performScrollTo().assertIsDisplayed().assertHasClickAction()
        compose.onNodeWithText("Stop leaves the reminder unfinished.").performScrollTo().assertIsDisplayed()
        entries.put(capture(output, "$stem-controls.png", config, "controls").put("checkedControls", controls))
      }
    }
    assertTrue(compose.activity.databaseList().none { it.startsWith("remilo") })
    assertTrue(compose.activity.createDeviceProtectedStorageContext().databaseList().none { it.startsWith("remilo") })
    File(output, "index.json").writeText(JSONObject()
      .put("artifactId", "P02-native-baseline-1b91f34").put("deviceEvidence", false)
      .put("renderer", "Robolectric 4.17 / actual AlarmControlsScreen / unchanged production theme and layout")
      .put("api", 35).put("density", 1).put("systemInsets", "Synthetic host zero insets")
      .put("fixtureTime", "2026-10-06T08:00:00-07:00").put("zone", "America/Los_Angeles")
      .put("locale", "en-US").put("snapshots", entries).toString(2))
  }

  private fun capture(output: File, name: String, config: AlarmReviewConfiguration, scroll: String): JSONObject {
    lateinit var bitmap: Bitmap
    compose.runOnUiThread { bitmap = compose.activity.findViewById<View>(android.R.id.content).drawToBitmap() }
    assertEquals(360, bitmap.width); assertEquals(800, bitmap.height)
    File(output, name).outputStream().use { assertTrue(bitmap.compress(Bitmap.CompressFormat.PNG, 100, it)) }
    return JSONObject().put("file", name).put("scenario", config.scenario.name)
      .put("brightness", if (config.dark) "dark" else "light").put("fontScale", config.fontScale)
      .put("width", bitmap.width).put("height", bitmap.height).put("scroll", scroll)
  }
}

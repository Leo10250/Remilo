package com.remilo.alarm.review

import android.graphics.Bitmap
import android.view.View
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.core.view.drawToBitmap
import org.json.JSONArray
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File
import java.util.Locale
import java.util.TimeZone

/** Baseline capture only: uses the preserved review activity without changing its layout. */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], qualifiers = "w360dp-h800dp-mdpi")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class P01IntakeCaptureTest {
  @get:Rule val compose = createAndroidComposeRule<AlarmDesignReviewActivity>()
  private lateinit var previousZone: TimeZone
  private lateinit var previousLocale: Locale

  @Before fun setFixtureLocale() {
    previousZone = TimeZone.getDefault()
    previousLocale = Locale.getDefault()
    TimeZone.setDefault(TimeZone.getTimeZone("America/Los_Angeles"))
    Locale.setDefault(Locale.US)
  }

  @After fun restoreLocale() {
    TimeZone.setDefault(previousZone)
    Locale.setDefault(previousLocale)
  }

  @Test fun capturePreservedHybridAtBothBrightnessAndTextSizes() {
    val output = File("build/outputs/design-review/p01-intake")
    assertTrue(output.isDirectory || output.mkdirs())
    val entries = JSONArray()
    val configurations = listOf(false, true).flatMap { dark ->
      listOf(1f, 2f).map { scale -> AlarmReviewConfiguration(dark = dark, fontScale = scale) }
    } + listOf(AlarmReviewScenario.LongTitle, AlarmReviewScenario.ChineseTitle).map {
      AlarmReviewConfiguration(scenario = it, fontScale = 2f)
    }
    configurations.forEach { configuration ->
      compose.runOnUiThread { compose.activity.showReview(configuration) }
      compose.waitForIdle()
      compose.onNodeWithText("Remilo").assertIsDisplayed()
      val stem = "compose-${configuration.scenario.name.lowercase()}-${if (configuration.dark) "dark" else "light"}-${configuration.fontScale.toInt()}x"
      entries.put(capture(output, "$stem-top.png", configuration, "top"))
      compose.onNodeWithText("Stop").performScrollTo().assertIsDisplayed().assertHasClickAction()
      compose.onNodeWithText("Snooze · 10 min").performScrollTo().assertIsDisplayed().assertHasClickAction()
      val bounds = JSONArray()
      listOf("Stop", "Snooze · 10 min").forEach { label ->
        val node = compose.onNodeWithText(label).fetchSemanticsNode()
        val rect = node.boundsInRoot
        assertTrue("$label has a 48 dp target", rect.width >= 48f && rect.height >= 48f)
        bounds.put(JSONObject().put("label", label).put("left", rect.left).put("top", rect.top)
          .put("width", rect.width).put("height", rect.height))
      }
      compose.onNodeWithText("Stop leaves the reminder unfinished.").performScrollTo().assertIsDisplayed()
      entries.put(capture(output, "$stem-controls.png", configuration, "controls").put("actionBoundsBeforeFootnoteScroll", bounds))
    }
    assertTrue(compose.activity.databaseList().none { it.startsWith("remilo") })
    assertTrue(compose.activity.createDeviceProtectedStorageContext().databaseList().none { it.startsWith("remilo") })
    File(output, "index.json").writeText(JSONObject().put("renderer", "Robolectric 4.17 native graphics / AlarmControlsScreen")
      .put("deviceEvidence", false).put("qualifiers", "w360dp-h800dp-mdpi").put("api", 35)
      .put("fixtureTime", "2026-10-06T08:00:00-07:00").put("zone", "America/Los_Angeles")
      .put("locale", "en-US; separately authored Simplified Chinese title").put("snapshots", entries).toString(2))
  }

  private fun capture(output: File, name: String, configuration: AlarmReviewConfiguration, scroll: String): JSONObject {
    lateinit var bitmap: Bitmap
    compose.runOnUiThread { bitmap = compose.activity.findViewById<View>(android.R.id.content).drawToBitmap() }
    assertEquals(360, bitmap.width)
    assertTrue(bitmap.height >= 600)
    File(output, name).outputStream().use { assertTrue(bitmap.compress(Bitmap.CompressFormat.PNG, 100, it)) }
    val metrics = compose.activity.resources.displayMetrics
    return JSONObject().put("file", name).put("scenario", configuration.scenario.name)
      .put("approach", configuration.approach.name).put("ambientPalette", configuration.palette)
      .put("memberPalette", "Meadow").put("dark", configuration.dark).put("fontScale", configuration.fontScale)
      .put("width", bitmap.width).put("height", bitmap.height).put("density", metrics.density)
      .put("scroll", scroll).put("configurationKeyResetsScroll", true)
  }
}

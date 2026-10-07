package com.remilo.alarm.review

import android.graphics.Bitmap
import android.view.View
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.graphics.toArgb
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

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], qualifiers = "w360dp-h800dp-mdpi")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class P01PrototypeTest {
  @get:Rule val compose = createAndroidComposeRule<AlarmDesignReviewActivity>()
  private lateinit var zone: TimeZone
  private lateinit var locale: Locale
  @Before fun fixedFormatting() {
    zone = TimeZone.getDefault(); locale = Locale.getDefault()
    TimeZone.setDefault(TimeZone.getTimeZone("America/Los_Angeles")); Locale.setDefault(Locale.US)
  }
  @After fun restoreFormatting() { TimeZone.setDefault(zone); Locale.setDefault(locale) }

  @Test fun phone360() = matrix(360, 800)
  @Test @Config(qualifiers = "w412dp-h915dp-mdpi") fun phone412() = matrix(412, 915)
  @Test @Config(qualifiers = "w800dp-h1024dp-mdpi") fun expanded800() = matrix(800, 1024)

  private fun matrix(width: Int, height: Int) {
    val output = File("build/outputs/design-review/p01-render-r1/compose-$width-$height")
    assertTrue(output.isDirectory || output.mkdirs())
    val entries = JSONArray()
    val scenarios = listOf(AlarmReviewScenario.Single, AlarmReviewScenario.LongTitle, AlarmReviewScenario.ChineseTitle) +
      if (width == 360) listOf(AlarmReviewScenario.Consequential, AlarmReviewScenario.Error, AlarmReviewScenario.Generic) else emptyList()
    for (dark in listOf(false, true)) for (scale in listOf(1f, 2f)) for (scenario in scenarios) {
      val config = AlarmReviewConfiguration(p01 = true, dark = dark, fontScale = scale, scenario = scenario)
      capturePair(output, config, width, height, entries)
    }
    if (width == 360) {
      capturePair(output, AlarmReviewConfiguration(p01 = true, missingArt = true), width, height, entries)
      capturePair(output, AlarmReviewConfiguration(p01 = true, invalidTokens = true), width, height, entries)
    }
    File(output, "index.json").writeText(JSONObject().put("renderer", "Robolectric 4.17 / actual AlarmControlsScreen")
      .put("api", 35).put("density", 1).put("deviceEvidence", false).put("snapshots", entries).toString(2))
  }

  private fun capturePair(output: File, config: AlarmReviewConfiguration, width: Int, height: Int, entries: JSONArray) {
    val stem = "${config.scenario.name.lowercase()}-${if (config.dark) "dark" else "light"}-${config.fontScale.toInt()}x${if (config.missingArt) "-missing-art" else ""}${if (config.invalidTokens) "-invalid-tokens" else ""}"
    for (scroll in listOf("top", "controls")) {
      compose.runOnUiThread { compose.activity.showReview(config) }; compose.waitForIdle()
      if (scroll == "controls") compose.onNodeWithText("Stop leaves the reminder unfinished.").performScrollTo().assertIsDisplayed()
      capture(File(output, "$stem-$scroll.png"), width, height)
      val bounds = textBounds()
      if (scroll == "controls") {
        for (label in listOf("Stop", "Snooze · 10 min")) {
          compose.onNodeWithText(label).assertIsDisplayed().assertHasClickAction()
          val rect = compose.onNodeWithText(label).fetchSemanticsNode().boundsInRoot
          assertTrue("$label has at least 48 dp bounds", rect.width >= 48 && rect.height >= 48)
        }
      }
      compose.runOnUiThread { compose.activity.showReview(config.copy(sampleBackground = true)) }; compose.waitForIdle()
      if (scroll == "controls") compose.onNodeWithText("Stop leaves the reminder unfinished.").performScrollTo()
      fun geometry(rows: List<JSONObject>) = rows.map { row -> listOf("text", "left", "top", "width", "height").map { row.get(it) } }
      assertEquals("Background sampling retains identical layout", geometry(bounds), geometry(textBounds()))
      capture(File(output, "$stem-$scroll-background.png"), width, height)
      entries.put(JSONObject().put("file", "$stem-$scroll.png").put("background", "$stem-$scroll-background.png")
        .put("scenario", config.scenario.name).put("dark", config.dark).put("fontScale", config.fontScale)
        .put("missingArt", config.missingArt).put("invalidTokens", config.invalidTokens)
        .put("width", width).put("height", height).put("scroll", scroll).put("textBounds", JSONArray(bounds)))
    }
  }

  private fun textBounds(): List<JSONObject> = compose.onAllNodes(hasText("", substring = true), useUnmergedTree = true)
    .fetchSemanticsNodes().map { node ->
      val text = node.config[SemanticsProperties.Text].joinToString(" ") { it.text }
      val layouts = mutableListOf<TextLayoutResult>()
      node.config.getOrNull(SemanticsActions.GetTextLayoutResult)?.action?.invoke(layouts)
      // Intrinsic paragraph width can exceed its integer-sized box by a fractional
      // pixel in native Skia. Check actual line extents, with one raster pixel tolerance.
      assertTrue("Text wraps without clipping: $text", layouts.all { layout -> !layout.didOverflowHeight &&
        (0 until layout.lineCount).all { layout.getLineLeft(it) >= -1f && layout.getLineRight(it) <= layout.size.width + 1f } })
      val rect = node.boundsInRoot
      JSONObject().put("text", text).put("left", rect.left).put("top", rect.top).put("width", rect.width).put("height", rect.height)
        .put("ink", layouts.firstOrNull()?.layoutInput?.style?.color?.toArgb())
        .put("fontSizeSp", layouts.firstOrNull()?.layoutInput?.style?.fontSize?.value)
    }

  private fun capture(file: File, width: Int, height: Int) {
    lateinit var bitmap: Bitmap
    compose.runOnUiThread { bitmap = compose.activity.findViewById<View>(android.R.id.content).drawToBitmap() }
    assertEquals(width, bitmap.width); assertEquals(height, bitmap.height)
    file.outputStream().use { assertTrue(bitmap.compress(Bitmap.CompressFormat.PNG, 100, it)) }
  }

  @Test fun frozenCanvasAndCapturedActions() {
    val initial = AlarmReviewFixtures.snapshot(AlarmReviewScenario.Single)!!
    val mixed = AlarmReviewFixtures.snapshot(AlarmReviewScenario.Multiple)!!
    compose.runOnUiThread { compose.activity.showReview(AlarmReviewConfiguration(p01 = true)) }
    val output = File("build/outputs/design-review/p01-render-r1/session-sequence")
    assertTrue(output.isDirectory || output.mkdirs())
    capture(File(output, "01-water-plants.png"), 360, 800)
    for ((index, members) in listOf(mixed.members.take(2), mixed.members.take(2).reversed(), mixed.members.drop(1).take(1)).withIndex()) {
      compose.runOnUiThread { compose.activity.showSession(initial.copy(members = members)) }
      compose.onNode(SemanticsMatcher.expectValue(SemanticsProperties.StateDescription, "Review canvas: Meadow")).assertExists()
      capture(File(output, "0${index + 2}-same-session.png"), 360, 800)
    }
    compose.onNodeWithText("Stop").performScrollTo().performClick()
    compose.runOnIdle { assertEquals("Stop" to "review-medicine", compose.activity.lastAction) }
    compose.onNodeWithText("Retry").performScrollTo().performClick()
    compose.onNodeWithText("Snooze · 10 min").performScrollTo().performClick()
    compose.runOnIdle { assertEquals("Snooze" to "review-medicine", compose.activity.lastAction) }
    assertEquals("Active", initial.state)
    compose.runOnUiThread { compose.activity.showSession(initial.copy(id = "new-review-session", members = mixed.members.drop(1).take(1))) }
    compose.onNode(SemanticsMatcher.expectValue(SemanticsProperties.StateDescription, "Review canvas: Sky")).assertExists()
    capture(File(output, "05-new-session.png"), 360, 800)
    assertTrue(compose.activity.databaseList().none { it.startsWith("remilo") })
    assertTrue(compose.activity.createDeviceProtectedStorageContext().databaseList().none { it.startsWith("remilo") })
  }

  @Test fun genericOmitsPrivateContentAndRetainsNativeActions() {
    compose.runOnUiThread { compose.activity.showReview(AlarmReviewConfiguration(p01 = true, scenario = AlarmReviewScenario.Generic)) }
    compose.onNodeWithText("Reminder").assertExists(); compose.onNodeWithText("Water plants").assertDoesNotExist()
    compose.onNode(SemanticsMatcher.expectValue(SemanticsProperties.StateDescription, "Review canvas: Generic")).assertExists()
    compose.onNodeWithText("Stop").performScrollTo().performClick()
    compose.runOnIdle { assertEquals("Stop" to "review-generic", compose.activity.lastAction) }
  }
}

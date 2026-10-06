package com.remilo.alarm.review

import android.graphics.Bitmap
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.core.view.drawToBitmap
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.security.MessageDigest
import java.util.Locale
import java.util.TimeZone

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], qualifiers = "w360dp-h800dp-mdpi")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class AlarmDesignReviewTest {
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

  @Test fun renderNativeComparison() {
    val output = File(System.getProperty("remilo.review.output") ?: "build/outputs/design-review/native")
    assertTrue(output.isDirectory || output.mkdirs())
    val scenarios = listOf(
      AlarmReviewConfiguration(scenario = AlarmReviewScenario.Single),
      AlarmReviewConfiguration(scenario = AlarmReviewScenario.Multiple),
      AlarmReviewConfiguration(scenario = AlarmReviewScenario.Generic),
      AlarmReviewConfiguration(scenario = AlarmReviewScenario.LongTitle),
      AlarmReviewConfiguration(scenario = AlarmReviewScenario.ChineseTitle),
      AlarmReviewConfiguration(scenario = AlarmReviewScenario.Single, dark = true, palette = "Mist"),
      AlarmReviewConfiguration(scenario = AlarmReviewScenario.Multiple, dark = true, palette = "Mist"),
      AlarmReviewConfiguration(scenario = AlarmReviewScenario.LongTitle, fontScale = 2f),
      AlarmReviewConfiguration(scenario = AlarmReviewScenario.ChineseTitle, fontScale = 2f),
      AlarmReviewConfiguration(scenario = AlarmReviewScenario.Multiple, fontScale = 2f),
      AlarmReviewConfiguration(scenario = AlarmReviewScenario.Error)
    )
    val entries = mutableListOf<JSONObject>()
    val comparisonDigests = mutableSetOf<String>()
    AlarmReviewApproach.entries.forEach { approach ->
      scenarios.forEach { scenario ->
        val configuration = scenario.copy(approach = approach)
        compose.runOnUiThread { compose.activity.showReview(configuration) }
        compose.waitForIdle()
        compose.onNodeWithText("Remilo").assertIsDisplayed()
        val name = "${approach.name.lowercase()}-${scenario.scenario.name.lowercase()}-${if (scenario.dark) "dark" else "light"}-${scenario.fontScale.toInt()}x"
        val bitmap = captureComposition()
        assertVisiblePixels(bitmap)
        save(bitmap, File(output, "$name.png"))
        entries += snapshotEntry("$name.png", configuration, bitmap)
        if (scenario == scenarios.first()) comparisonDigests += digest(File(output, "$name.png"))
        val action = if (scenario.scenario == AlarmReviewScenario.Multiple) "Stop all" else "Stop"
        compose.onNodeWithText(action).performScrollTo().assertIsDisplayed().assertHasClickAction()
        if (scenario.scenario == AlarmReviewScenario.Multiple) {
          repeat(3) { index ->
            compose.onAllNodesWithText("Stop")[index].performScrollTo().assertIsDisplayed().assertHasClickAction()
            compose.onAllNodesWithText("Snooze · 10 min")[index].performScrollTo().assertIsDisplayed().assertHasClickAction()
          }
        } else compose.onNodeWithText("Snooze · 10 min").performScrollTo().assertIsDisplayed().assertHasClickAction()
        if (scenario.fontScale == 2f || scenario.scenario == AlarmReviewScenario.Multiple) {
          compose.onNodeWithText("Stop leaves the reminder unfinished.").performScrollTo().assertIsDisplayed()
          val controls = captureComposition()
          assertVisiblePixels(controls)
          save(controls, File(output, "$name-controls.png"))
          entries += snapshotEntry("$name-controls.png", configuration, controls).put("scroll", "controls")
        }
      }
    }
    assertEquals("A/B/C must render different appearance treatments", 3, comparisonDigests.size)
    listOf(false, true).forEach { dark ->
      val baseline = AlarmReviewConfiguration(baseline = true, dark = dark)
      compose.runOnUiThread { compose.activity.showReview(baseline) }
      compose.waitForIdle()
      val bitmap = captureComposition()
      assertVisiblePixels(bitmap)
      val name = "baseline-single-${if (dark) "dark" else "light"}-1x"
      save(bitmap, File(output, "$name.png"))
      entries += snapshotEntry("$name.png", baseline, bitmap)
    }
    File(output, "index.json").writeText(JSONObject()
      .put("renderer", "Robolectric native graphics / actual AlarmControlsScreen")
      .put("deviceEvidence", false).put("snapshots", JSONArray(entries)).toString(2))
    File(output, "gallery.html").writeText(nativeGallery(entries))
  }

  @Test fun reviewActionsRetainTheirCapturedMemberAndNeverRunAnAlarm() {
    compose.runOnUiThread { compose.activity.showReview(AlarmReviewConfiguration()) }
    compose.onNodeWithText("Stop").performScrollTo().performClick()
    compose.runOnIdle { assertEquals("Stop" to "review-plants", compose.activity.lastAction) }
    compose.onNodeWithText("Review action: Stop. No alarm is running.").assertExists()
    compose.onNodeWithText("Retry").performScrollTo().performClick()
    compose.onNodeWithText("Snooze · 10 min").performScrollTo().performClick()
    compose.runOnIdle { assertEquals("Snooze" to "review-plants", compose.activity.lastAction) }
    compose.runOnUiThread { compose.activity.showReview(AlarmReviewConfiguration(scenario = AlarmReviewScenario.Multiple)) }
    compose.onNodeWithText("Stop all").performScrollTo().performClick()
    compose.runOnIdle { assertEquals("StopAll" to null, compose.activity.lastAction) }
    assertEquals("Active", AlarmReviewFixtures.snapshot(AlarmReviewScenario.Multiple)?.state)
    assertEquals(3, AlarmReviewFixtures.snapshot(AlarmReviewScenario.Multiple)?.members?.size)
    assertTrue(compose.activity.databaseList().none { it.startsWith("remilo") })
    assertTrue(compose.activity.createDeviceProtectedStorageContext().databaseList().none { it.startsWith("remilo") })
  }

  @Test fun genericFixtureContainsNoPrivateContentAndOmitsDecorations() {
    val snapshot = AlarmReviewFixtures.snapshot(AlarmReviewScenario.Generic)!!
    assertEquals(listOf("Reminder"), snapshot.members.map { it.second })
    compose.runOnUiThread { compose.activity.showReview(AlarmReviewConfiguration(scenario = AlarmReviewScenario.Generic)) }
    compose.onNodeWithText("Reminder").assertIsDisplayed()
    compose.onNodeWithText("Water plants").assertDoesNotExist()
    compose.onNodeWithText("Current ringing delivery").assertIsDisplayed()
    compose.onNodeWithText("Snooze · 10 min").performScrollTo().assertIsDisplayed()
  }

  private fun assertVisiblePixels(bitmap: Bitmap) {
    assertTrue("Native capture has a usable viewport", bitmap.width >= 300 && bitmap.height >= 600)
    val pixels = IntArray(bitmap.width * bitmap.height)
    bitmap.getPixels(pixels, 0, bitmap.width, 0, 0, bitmap.width, bitmap.height)
    assertTrue("Actual Compose text, artwork and controls must be rendered", pixels.toSet().size > 100)
    assertTrue("Capture must contain opaque content", pixels.count { (it ushr 24) == 255 } > pixels.size / 2)
  }

  private fun captureComposition(): Bitmap {
    compose.waitForIdle()
    lateinit var bitmap: Bitmap
    // Draw the real Compose view with native Skia; the host window has no redraw callback.
    compose.runOnUiThread {
      bitmap = compose.activity.findViewById<android.view.View>(android.R.id.content).drawToBitmap()
    }
    return bitmap
  }

  private fun snapshotEntry(file: String, configuration: AlarmReviewConfiguration, bitmap: Bitmap): JSONObject = JSONObject()
    .put("file", file).put("approach", if (configuration.baseline) "Baseline" else configuration.approach.name)
    .put("scenario", configuration.scenario.name).put("dark", configuration.dark).put("fontScale", configuration.fontScale)
    .put("width", bitmap.width).put("height", bitmap.height)

  private fun nativeGallery(entries: List<JSONObject>): String {
    val sections = entries.groupBy {
      listOf(it.getString("scenario"), it.getBoolean("dark"), it.getDouble("fontScale"), it.optString("scroll", "top"))
    }.map { (key, captures) ->
      val scenario = key[0].toString()
      val dark = key[1] as Boolean
      val scale = (key[2] as Double).toInt()
      val scroll = key[3].toString()
      val label = when (scenario) {
        "Multiple" -> "Simultaneous alarms"
        "Generic" -> "Generic before unlock"
        "LongTitle" -> "Long English title"
        "ChineseTitle" -> "Simplified Chinese title"
        "Error" -> "Action error"
        else -> "Single alarm"
      }
      val figures = captures.sortedBy { listOf("Baseline", "Immersive", "Layered", "Hybrid").indexOf(it.getString("approach")) }
        .joinToString("") {
          val approach = it.getString("approach")
          val title = when (approach) { "Immersive" -> "A: Immersive"; "Layered" -> "B: Layered"; "Hybrid" -> "C: Hybrid"; else -> "Current baseline" }
          val file = it.getString("file")
          "<figure><figcaption>$title</figcaption><a href=\"$file\"><img src=\"$file\" width=\"360\" height=\"800\" alt=\"$title, $label, ${if (dark) "dark" else "light"}, ${scale}x text, $scroll\"></a></figure>"
        }
      "<section data-scenario=\"${scenario.lowercase()}\" data-dark=\"$dark\" data-scale=\"$scale\"><h2>$label <span>${if (dark) "Dark" else "Light"} · ${scale}x text${if (scroll == "controls") " · Controls" else ""}</span></h2><div class=\"comparison\">$figures</div></section>"
    }.joinToString("\n")
    return """<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Remilo Native Design Review</title><style>
*{box-sizing:border-box}body{margin:0;background:#F5F6F8;color:#14203A;font:15px/1.5 system-ui,sans-serif}
header,main{max-width:1536px;margin:auto;padding:24px}header{border-bottom:1px solid #DADEE7;background:#FFFFFF}
h1{font-size:28px;line-height:1.2;margin:0 0 12px}p{max-width:850px;margin:8px 0;color:#4D5870}
nav{display:flex;flex-wrap:wrap;gap:16px;margin-top:20px}label{display:flex;align-items:center;gap:8px}
select{min-height:48px;font:inherit;color:#14203A;background:white;border:1px solid #6F788C;border-radius:6px;padding:8px}
section{padding:16px 0 28px;border-bottom:1px solid #DADEE7}h2{font-size:20px;margin:0 0 16px}h2 span{font-size:14px;font-weight:400;color:#4D5870;margin-left:8px}
.comparison{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,360px));gap:24px;align-items:start}
figure{margin:0;min-width:0}figcaption{font-weight:650;margin:0 0 8px}img{display:block;width:100%;height:auto;border:1px solid #DADEE7}
a:focus-visible{outline:3px solid #454AC4;outline-offset:4px}[hidden]{display:none}
@media(max-width:520px){header,main{padding:16px}.comparison{grid-template-columns:1fr}h2 span{display:block;margin:4px 0 0}}
</style></head><body><header><h1>Remilo Native Design Review</h1>
<p>Actual AlarmControlsScreen rendered with Compose and Robolectric native Skia. Host snapshots of synthetic reminders; these are not device or alarm-reliability evidence. The review fixture opens no Remilo database and runs no audio.</p>
<p>Controlled fixture: October 6, 2026 at 8 AM in America/Los_Angeles. Times identify current ringing deliveries. Long English and Chinese titles are native layout stress cases.</p>
<nav aria-label="Review filters"><label>Scenario <select id="scenario"><option value="all">All scenarios</option><option value="single">Single alarm</option><option value="multiple">Simultaneous alarms</option><option value="generic">Generic before unlock</option><option value="longtitle">Long English title</option><option value="chinesetitle">Simplified Chinese title</option><option value="error">Action error</option></select></label>
<label>Brightness <select id="brightness"><option value="all">Light and dark</option><option value="false">Light</option><option value="true">Dark</option></select></label>
<label>Text <select id="scale"><option value="all">All sizes</option><option value="1">100%</option><option value="2">200%</option></select></label></nav></header>
<main>$sections</main><script>
const filters=['scenario','brightness','scale'].map(id=>document.getElementById(id));
function filter(){for(const section of document.querySelectorAll('section'))section.hidden=!(
(filters[0].value==='all'||filters[0].value===section.dataset.scenario)&&
(filters[1].value==='all'||filters[1].value===section.dataset.dark)&&
(filters[2].value==='all'||filters[2].value===section.dataset.scale));}
for(const control of filters)control.addEventListener('change',filter);
</script></body></html>"""
  }

  private fun save(bitmap: Bitmap, file: File) {
    file.outputStream().use { assertTrue(bitmap.compress(Bitmap.CompressFormat.PNG, 100, it)) }
  }

  private fun digest(file: File): String = MessageDigest.getInstance("SHA-256").digest(file.readBytes())
    .joinToString("") { "%02x".format(it) }
}

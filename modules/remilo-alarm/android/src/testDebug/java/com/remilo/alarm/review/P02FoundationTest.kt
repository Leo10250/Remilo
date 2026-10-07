package com.remilo.alarm.review

import android.graphics.Bitmap
import android.view.View
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.graphics.toArgb
import androidx.core.view.drawToBitmap
import com.remilo.alarm.foundation.*
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
@Config(sdk=[35],qualifiers="w360dp-h800dp-mdpi")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class P02FoundationTest {
  @get:Rule val compose = createAndroidComposeRule<AlarmDesignReviewActivity>()
  private val output = File("build/outputs/design-review/p02-sample")
  private val entries = JSONArray()
  private lateinit var zone: TimeZone
  private lateinit var locale: Locale
  @Before fun fixedFormatting() { zone=TimeZone.getDefault(); locale=Locale.getDefault(); TimeZone.setDefault(TimeZone.getTimeZone("America/Los_Angeles")); Locale.setDefault(Locale.US); assertTrue(output.isDirectory || output.mkdirs()) }
  @After fun restoreFormatting() { TimeZone.setDefault(zone); Locale.setDefault(locale) }

  @Test fun rendersExpansionAndAnchorMatrix() {
    for (palette in listOf("Sky","Rose","Sunrise","Meadow")) for (dark in listOf(false,true)) for (scale in listOf(1f,2f)) {
      val scenarios = if (palette in listOf("Sky","Rose")) listOf(AlarmReviewScenario.Single,AlarmReviewScenario.LongTitle,AlarmReviewScenario.ChineseTitle) else listOf(AlarmReviewScenario.Single)
      for (scenario in scenarios) capturePair(AlarmReviewConfiguration(p02=true,palette=palette,dark=dark,fontScale=scale,scenario=scenario))
    }
    for (palette in listOf("Sky","Rose")) for (dark in listOf(false,true)) for (scale in listOf(1f,2f)) {
      capturePair(AlarmReviewConfiguration(p02=true,p02Primitives=true,palette=palette,dark=dark,fontScale=scale))
    }
    writeIndex()
  }
  @Test fun fallbacksStatesAndCapturedActionsRemainIndependent() {
    for (dark in listOf(false,true)) {
      val base=AlarmReviewConfiguration(p02=true,palette="Rose",dark=dark,fontScale=2f)
      for (config in listOf(base.copy(palette="unknown"),base.copy(invalidTokens=true),base.copy(missingArt=true),base.copy(scenario=AlarmReviewScenario.Generic),
        base.copy(scenario=AlarmReviewScenario.Loading),base.copy(scenario=AlarmReviewScenario.Error),base.copy(scenario=AlarmReviewScenario.Multiple),base.copy(p02Busy=true))) capturePair(config)
    }
    val configuration=AlarmReviewConfiguration(p02=true,palette="Sky")
    compose.runOnUiThread { compose.activity.showReview(configuration) }; compose.waitForIdle()
    compose.onNodeWithText("Stop").performScrollTo().performClick()
    assertEquals("Stop" to "review-plants",compose.activity.lastAction)
    compose.runOnUiThread { compose.activity.showReview(configuration) }; compose.waitForIdle()
    compose.onNodeWithText("Snooze · 10 min").performScrollTo().performClick()
    assertEquals("Snooze" to "review-plants",compose.activity.lastAction)
    compose.runOnUiThread { compose.activity.showReview(configuration.copy(scenario=AlarmReviewScenario.Multiple)) }; compose.waitForIdle()
    compose.onNodeWithText("Stop all").performScrollTo().performClick()
    assertEquals("StopAll" to null,compose.activity.lastAction)
    compose.runOnUiThread { compose.activity.showReview(configuration.copy(p02Busy=true)) }; compose.waitForIdle()
    compose.onNodeWithText("Stop").performScrollTo().assertIsNotEnabled().performClick()
    assertNull(compose.activity.lastAction)
    assertTrue(compose.activity.databaseList().none { it.startsWith("remilo") })
    assertTrue(compose.activity.createDeviceProtectedStorageContext().databaseList().none { it.startsWith("remilo") })
    writeIndex("targeted")
  }
  @Test fun pureLookupFallbacksDoNotChangeCatalog() {
    val before=FoundationCatalog.colors.toString()
    for (brightness in Brightness.entries) {
      assertEquals("classic",Foundations.lookup("unknown",brightness).id)
      assertEquals(brightness,Foundations.lookup("unknown",brightness).brightness)
      val rose=Foundations.lookup("rose",brightness)
      assertEquals("missing-art",Foundations.missingArt(rose).fallback)
      assertNull(Foundations.lookup("classic",brightness).scene)
      val invalid=FoundationCatalog.colors.mapValues { (id,values) -> if (id=="rose") values.mapValues { emptyMap() } else values }
      assertEquals("invalid-tokens",Foundations.lookup("rose",brightness,invalid).fallback)
      assertEquals("emergency",Foundations.lookup("rose",brightness,emptyMap()).fallback)
    }
    assertEquals(before,FoundationCatalog.colors.toString())
  }
  @Test @Config(qualifiers="w412dp-h915dp-mdpi") fun rendersWidePhone() { captureWider("phone") }
  @Test @Config(qualifiers="w800dp-h1024dp-mdpi") fun rendersTabletColumn() { captureWider("tablet") }
  private fun captureWider(suffix:String) {
    for(palette in listOf("Sky","Rose")) for(dark in listOf(false,true)) for(scale in listOf(1f,2f)) {
      capturePair(AlarmReviewConfiguration(p02=true,palette=palette,dark=dark,fontScale=scale,scenario=if(scale==2f) AlarmReviewScenario.ChineseTitle else AlarmReviewScenario.Single))
    }
    writeIndex(suffix)
  }
  private fun capturePair(config: AlarmReviewConfiguration) {
    val width=compose.activity.resources.configuration.screenWidthDp
    val height=compose.activity.resources.configuration.screenHeightDp
    val stem="${width}x${height}-${config.palette.lowercase()}-${if(config.dark) "dark" else "light"}-${config.fontScale.toInt()}x-${config.scenario.name.lowercase()}${if(config.p02Primitives) "-primitives" else ""}${if(config.missingArt) "-missing" else ""}${if(config.invalidTokens) "-invalid" else ""}${if(config.p02Busy) "-busy" else ""}"
    val originalBounds=mutableMapOf<String,String>()
    for (background in listOf(false,true)) {
      compose.runOnUiThread { compose.activity.showReview(config.copy(sampleBackground=background)) }; compose.waitForIdle()
      val top=metadata(); originalBounds[if(background) "background" else "original"]=(0 until top.length()).joinToString { index ->
        val node=top.getJSONObject(index); "${node.getString("text")}/${node.getJSONArray("bounds")}/${node.getDouble("fontSp")}" }
      entries.put(capture("$stem-top${if(background) "-background" else ""}.png",config,"top",background,top))
      if (config.p02Primitives) compose.onNodeWithText("Retry").performScrollTo()
      else if (config.scenario != AlarmReviewScenario.Loading) {
        val label=if(config.scenario==AlarmReviewScenario.Multiple) "Stop all" else "Snooze · 10 min"
        val action=compose.onNodeWithText(label)
        action.performScrollTo().assertIsDisplayed()
        val density=compose.activity.resources.displayMetrics.density
        val bounds=action.fetchSemanticsNode().touchBoundsInRoot
        assertTrue("48 dp input $stem",bounds.width/density>=48 && bounds.height/density>=48)
        if(config.scenario!=AlarmReviewScenario.Multiple) assertTrue("64 dp single button",bounds.height/density>=64)
        compose.onNodeWithText("Stop leaves the reminder unfinished.").performScrollTo().assertIsDisplayed()
      }
      compose.waitForIdle()
      entries.put(capture("$stem-controls${if(background) "-background" else ""}.png",config,"controls",background,metadata()))
    }
    assertEquals("Background sampling preserves text nodes/layout $stem",originalBounds["original"],originalBounds["background"])
  }
  private fun metadata(): JSONArray {
    val values=JSONArray()
    for (node in compose.onAllNodes(hasText("",substring=true),useUnmergedTree=true).fetchSemanticsNodes()) {
      val label=node.config.getOrNull(SemanticsProperties.Text)?.joinToString { it.text } ?: continue
      val b=node.boundsInRoot
      val result=mutableListOf<TextLayoutResult>()
      node.config.getOrNull(androidx.compose.ui.semantics.SemanticsActions.GetTextLayoutResult)?.action?.invoke(result)
      // Same measured Skia normalization as P01: intrinsic width may exceed an
      // integer box by a fraction of one raster pixel. Check actual line extents.
      for (layout in result) assertTrue("No clipped essential text: $label",!layout.didOverflowHeight &&
        (0 until layout.lineCount).all { layout.getLineLeft(it)>=-1f && layout.getLineRight(it)<=layout.size.width+1f })
      values.put(JSONObject().put("text",label).put("bounds",JSONArray(listOf(b.left,b.top,b.width,b.height)))
        .put("fontSp",result.firstOrNull()?.layoutInput?.style?.fontSize?.value ?: 0)
        .put("ink",result.firstOrNull()?.layoutInput?.style?.color?.toArgb()))
    }
    return values
  }
  private fun capture(name:String,config:AlarmReviewConfiguration,scroll:String,background:Boolean,bounds:JSONArray): JSONObject {
    lateinit var bitmap:Bitmap
    compose.runOnUiThread { bitmap=compose.activity.findViewById<View>(android.R.id.content).drawToBitmap() }
    assertEquals(compose.activity.resources.configuration.screenWidthDp,bitmap.width); assertEquals(compose.activity.resources.configuration.screenHeightDp,bitmap.height)
    File(output,name).outputStream().use { assertTrue(bitmap.compress(Bitmap.CompressFormat.PNG,100,it)) }
    return JSONObject().put("file",name).put("palette",config.palette).put("brightness",if(config.dark) "dark" else "light").put("fontScale",config.fontScale)
      .put("scenario",config.scenario.name).put("primitives",config.p02Primitives).put("width",bitmap.width).put("height",bitmap.height).put("scroll",scroll).put("backgroundOnly",background).put("textBounds",bounds)
  }
  private fun writeIndex(suffix:String="matrix") {
    File(output,"index-$suffix.json").writeText(JSONObject().put("revision",FoundationCatalog.revision).put("renderer","Robolectric 4.17 / actual AlarmControlsScreen + Compose Material 3 1.3.2").put("api",35).put("density",1).put("insets","synthetic zero").put("deviceEvidence",false).put("snapshots",entries).toString(2))
  }
}

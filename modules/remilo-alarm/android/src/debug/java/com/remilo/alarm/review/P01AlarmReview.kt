package com.remilo.alarm.review

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.ColorMatrix
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.res.painterResource
import com.remilo.alarm.R
import com.remilo.alarm.data.AlertRecord
import com.remilo.alarm.engine.AlarmEngine
import com.remilo.alarm.system.AlarmControlsScreen
import org.json.JSONObject

/** Memory-only review state. Initialized by session ID, independently of member order. */
@Composable
internal fun P01AlarmReview(configuration: AlarmReviewConfiguration, snapshot: AlarmEngine.SessionSnapshot?,
  feedback: String?, onAction: (String, AlertRecord?) -> Unit, onRetry: () -> Unit) {
  val canvas = remember(snapshot?.id) {
    snapshot?.members?.firstOrNull()?.first?.let(AlarmReviewFixtures::memberPalette) ?: "Classic"
  }
  val generic = configuration.scenario == AlarmReviewScenario.Generic
  val decorated = !generic && canvas == "Meadow" && !configuration.missingArt
  val resources = LocalContext.current.resources
  val contract = remember(resources) {
    resources.openRawResource(R.raw.p01_composition).bufferedReader().use { JSONObject(it.readText()) }
  }
  val values = contract.getJSONObject("colors").getJSONObject("meadow").getJSONObject(if (configuration.dark) "dark" else "light")
  val valid = !configuration.invalidTokens && values.keys().asSequence().all { values.getString(it).matches(Regex("#[0-9a-fA-F]{6}")) }
  fun color(name: String): Color = Color(android.graphics.Color.parseColor(values.getString(name)))
  val base = if (configuration.dark) darkColorScheme() else lightColorScheme()
  val scheme = if (!valid || generic || canvas != "Meadow") base else base.copy(
    primary = color("accent"), onPrimary = color("accentInk"), background = color("background"), onBackground = color("ink"),
    surface = color("surface"), onSurface = color("ink"), onSurfaceVariant = color("muted"),
    outline = color("outline"), error = color("danger"))
  val sample = configuration.sampleBackground
  val inkScheme = if (sample) scheme.copy(onBackground = Color.Transparent, onSurface = Color.Transparent,
    onSurfaceVariant = Color.Transparent, onPrimary = Color.Transparent, error = Color.Transparent) else scheme
  val density = LocalDensity.current
  val baseType = Typography()
  val type = Typography(
    headlineLarge = baseType.headlineLarge.copy(fontSize = 28.sp, lineHeight = 36.sp, fontWeight = FontWeight.SemiBold, textAlign = TextAlign.Start),
    titleLarge = baseType.titleLarge.copy(fontSize = 18.sp, lineHeight = 26.sp, textAlign = TextAlign.Start),
    titleMedium = baseType.titleMedium.copy(fontSize = 16.sp, lineHeight = 24.sp, textAlign = TextAlign.Start),
    bodyLarge = baseType.bodyLarge.copy(fontSize = 16.sp, lineHeight = 24.sp, textAlign = TextAlign.Start),
    bodyMedium = baseType.bodyMedium.copy(fontSize = 14.sp, lineHeight = 20.sp, textAlign = TextAlign.Start))
  CompositionLocalProvider(LocalDensity provides Density(density.density, configuration.fontScale)) {
    MaterialTheme(colorScheme = inkScheme, typography = type) {
      BoxWithConstraints(Modifier.fillMaxSize().semantics { stateDescription = "Review canvas: ${if (generic) "Generic" else canvas}" }) {
        val artHeight = minOf(maxHeight * if (configuration.fontScale >= 1.5f) 0.4f else 0.68f, maxWidth * 1.5f)
        val scenerySpace = minOf(maxHeight * if (configuration.fontScale >= 1.5f) 0.16f else 0.36f, 340.dp)
        AlarmControlsScreen(snapshot, false,
          feedback ?: if (configuration.scenario == AlarmReviewScenario.Error) "Could not apply this action. Try again." else null,
          onAction, onRetry,
          backdrop = {
            if (decorated) {
              Image(painterResource(R.drawable.p01_meadow_m1), null,
              modifier = Modifier.align(Alignment.TopCenter).fillMaxWidth().height(artHeight).clearAndSetSemantics {},
              alignment = Alignment.TopCenter, contentScale = ContentScale.Crop,
              colorFilter = if (configuration.dark) ColorFilter.colorMatrix(ColorMatrix(floatArrayOf(
                .24f,0f,0f,0f,0f, 0f,.40f,0f,0f,0f, 0f,0f,.30f,0f,0f, 0f,0f,0f,1f,0f))) else null)
              val readingStart = scenerySpace + 20.dp + 24.dp * configuration.fontScale
              Box(Modifier.align(Alignment.TopCenter).fillMaxWidth().height(artHeight)
                .background(Brush.verticalGradient(listOf(Color.Transparent, scheme.background),
                  startY = with(LocalDensity.current) { (readingStart - 48.dp).toPx() },
                  endY = with(LocalDensity.current) { readingStart.toPx() })).clearAndSetSemantics {})
            }
          },
          deliveryLabel = {
            if (!generic && configuration.scenario == AlarmReviewScenario.Consequential) {
              Text("Event 10:00 AM · Due 9:00 AM", style = MaterialTheme.typography.bodyMedium, color = inkScheme.onSurfaceVariant)
            }
            Text("Current ringing delivery", style = MaterialTheme.typography.bodyMedium, color = inkScheme.onSurfaceVariant)
          },
          singlePresentation = { information, actions, status ->
            Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 24.dp, vertical = 20.dp),
              horizontalAlignment = Alignment.CenterHorizontally) {
              Text("Remilo", modifier = Modifier.fillMaxWidth(), style = MaterialTheme.typography.titleMedium,
                textAlign = TextAlign.Center, color = inkScheme.onSurface)
              Spacer(Modifier.height(if (decorated) scenerySpace else 24.dp))
              Column(Modifier.widthIn(max = 480.dp).fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(8.dp)) {
                MaterialTheme(typography = type.copy(titleLarge = type.titleLarge.copy(fontSize = 32.sp, lineHeight = 40.sp,
                  color = if (sample) Color.Transparent else scheme.primary),
                  bodyLarge = type.bodyLarge.copy(color = if (sample) Color.Transparent else scheme.primary)),
                  colorScheme = if (sample) inkScheme.copy(primary = Color.Transparent) else inkScheme, content = information)
                Spacer(Modifier.height(12.dp))
                actions()
                Spacer(Modifier.height(4.dp))
                status()
              }
            }
          })
      }
    }
  }
}

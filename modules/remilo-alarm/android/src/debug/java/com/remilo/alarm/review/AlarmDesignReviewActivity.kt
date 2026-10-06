package com.remilo.alarm.review

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.remilo.alarm.R
import com.remilo.alarm.data.AlertRecord
import com.remilo.alarm.engine.AlarmEngine
import com.remilo.alarm.system.AlarmControlsScreen
import java.time.LocalDateTime
import java.time.ZoneId
import java.util.Locale
import org.json.JSONObject

enum class AlarmReviewApproach { Immersive, Layered, Hybrid }
enum class AlarmReviewScenario { Single, Multiple, Generic, LongTitle, ChineseTitle, Loading, Error }

data class AlarmReviewConfiguration(
  val approach: AlarmReviewApproach = AlarmReviewApproach.Hybrid,
  val scenario: AlarmReviewScenario = AlarmReviewScenario.Single,
  val palette: String = "Sunrise",
  val dark: Boolean = false,
  val fontScale: Float = 1f,
  val baseline: Boolean = false
)

/** Debug-only immutable content. This activity never obtains an engine or starts a service. */
class AlarmDesignReviewActivity : ComponentActivity() {
  var configuration by mutableStateOf(AlarmReviewConfiguration())
    private set
  var lastAction: Pair<String, String?>? = null
    private set
  private var feedback by mutableStateOf<String?>(null)

  fun showReview(configuration: AlarmReviewConfiguration) {
    this.configuration = configuration
    feedback = null
    lastAction = null
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    showReview(AlarmReviewConfiguration(
      approach = AlarmReviewApproach.entries.firstOrNull { it.name.equals(intent.getStringExtra("approach"), true) }
        ?: AlarmReviewApproach.Hybrid,
      scenario = AlarmReviewScenario.entries.firstOrNull { it.name.equals(intent.getStringExtra("scenario"), true) }
        ?: AlarmReviewScenario.Single,
      palette = intent.getStringExtra("palette") ?: "Sunrise",
      dark = intent.getBooleanExtra("dark", false),
      fontScale = intent.getFloatExtra("fontScale", 1f).coerceIn(1f, 2f),
      baseline = intent.getBooleanExtra("baseline", false)
    ))
    setContent {
      key(configuration) {
        AlarmDesignReviewScreen(configuration, feedback, { kind, record ->
          lastAction = kind to record?.occurrenceId
          feedback = "Review action: ${if (kind == "StopAll") "Stop all" else kind}. No alarm is running."
        }, { feedback = null })
      }
    }
  }
}

internal object AlarmReviewFixtures {
  private val sessionId = "design-review-session"
  private fun target(hour: Int, minute: Int): Long =
    LocalDateTime.of(2026, 10, 6, hour, minute).atZone(ZoneId.of("America/Los_Angeles")).toInstant().toEpochMilli()
  private fun member(id: String, title: String, hour: Int, minute: Int = 0) =
    AlertRecord("review-$id", target(hour, minute), 1, "Alerting", sessionId, resolvedZone = "America/Los_Angeles") to title

  private val plants = member("plants", "Water plants", 8)
  private val medicine = member("medicine", "Take medicine", 8)
  private val reading = member("reading", "Read", 8)
  private val longTitle = member("plants", "Water the balcony plants and check the new seedlings before leaving for the afternoon", 8)
  private val chineseTitle = member("plants", "给阳台的植物浇水，并检查新的幼苗。下午出门前记得把窗户关好。", 8)
  private val generic = member("generic", "Reminder", 8)

  fun snapshot(scenario: AlarmReviewScenario): AlarmEngine.SessionSnapshot? = when (scenario) {
    AlarmReviewScenario.Loading -> null
    AlarmReviewScenario.Multiple -> AlarmEngine.SessionSnapshot(sessionId, "Active", listOf(plants, medicine, reading), "light")
    AlarmReviewScenario.LongTitle -> AlarmEngine.SessionSnapshot(sessionId, "Active", listOf(longTitle), "light")
    AlarmReviewScenario.ChineseTitle -> AlarmEngine.SessionSnapshot(sessionId, "Active", listOf(chineseTitle), "light")
    AlarmReviewScenario.Generic -> AlarmEngine.SessionSnapshot(sessionId, "Active", listOf(generic), "system")
    else -> AlarmEngine.SessionSnapshot(sessionId, "Active", listOf(plants), "light")
  }

  fun memberPalette(record: AlertRecord): String = when (record.occurrenceId) {
    "review-plants" -> "Meadow"
    "review-medicine" -> "Sky"
    "review-reading" -> "Classic"
    else -> "Classic"
  }
}

@Composable
internal fun AlarmDesignReviewScreen(
  configuration: AlarmReviewConfiguration,
  feedback: String?,
  onAction: (String, AlertRecord?) -> Unit,
  onRetry: () -> Unit
) {
  val generic = configuration.scenario == AlarmReviewScenario.Generic
  val decorated = !generic && !configuration.baseline
  val snapshot = remember(configuration.scenario) { AlarmReviewFixtures.snapshot(configuration.scenario) }
  val resources = LocalContext.current.resources
  val tokens = remember(resources) { resources.openRawResource(R.raw.review_palette_tokens).bufferedReader().use { JSONObject(it.readText()) } }
  val ambient = reviewScheme(tokens, if (generic) "Classic" else configuration.palette, configuration.dark)
  val first = snapshot?.members?.firstOrNull()?.first
  val member = reviewScheme(tokens, first?.let(AlarmReviewFixtures::memberPalette) ?: "Classic", configuration.dark)
  val scheme = if (configuration.baseline) baselineScheme(configuration.dark)
    else if (generic || first == null) ambient else when (configuration.approach) {
    AlarmReviewApproach.Immersive -> member
    AlarmReviewApproach.Layered, AlarmReviewApproach.Hybrid -> ambient.copy(primary = member.primary, onPrimary = member.onPrimary)
  }
  val baseType = Typography()
  val type = Typography(
    headlineLarge = baseType.headlineLarge.copy(fontSize = 28.sp, lineHeight = 36.sp),
    headlineMedium = baseType.headlineMedium.copy(fontSize = 28.sp, lineHeight = 36.sp),
    titleLarge = baseType.titleLarge.copy(fontSize = 22.sp, lineHeight = 28.sp),
    bodyLarge = baseType.bodyLarge.copy(fontSize = 16.sp, lineHeight = 24.sp),
    bodyMedium = baseType.bodyMedium.copy(fontSize = 14.sp, lineHeight = 20.sp),
    labelSmall = baseType.labelSmall.copy(fontSize = 12.sp, lineHeight = 16.sp)
  )
  val density = LocalDensity.current
  CompositionLocalProvider(LocalDensity provides Density(density.density, configuration.fontScale)) {
    MaterialTheme(colorScheme = scheme, typography = type,
      shapes = if (configuration.baseline) Shapes() else Shapes(medium = RoundedCornerShape(8.dp))) {
      AlarmControlsScreen(snapshot, false,
        feedback ?: if (configuration.scenario == AlarmReviewScenario.Error) "Could not apply this action. Try again." else null,
        onAction, onRetry,
        backdrop = {
          if (decorated) Image(painterResource(R.drawable.review_landscape), null,
            modifier = Modifier.align(Alignment.BottomCenter).fillMaxWidth().height(180.dp),
            alpha = if (configuration.dark) 0.16f else 0.26f, contentScale = ContentScale.Crop)
        },
        memberArtwork = { record ->
          if (decorated && configuration.approach != AlarmReviewApproach.Layered) {
            val multiple = (snapshot?.members?.size ?: 0) > 1
            Image(painterResource(if (record.occurrenceId == "review-plants") R.drawable.review_botanical else R.drawable.review_landscape),
              null, contentScale = ContentScale.Fit,
              modifier = Modifier.fillMaxWidth().height(if (multiple) 64.dp else 180.dp),
              alpha = if (configuration.dark) 0.8f else 1f)
          }
        },
        deliveryLabel = {
          if (!configuration.baseline) Text("Current ringing delivery", style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant)
        },
        memberPresentation = { record, content ->
          if (!decorated) content()
          else {
            val individual = reviewScheme(tokens, AlarmReviewFixtures.memberPalette(record), configuration.dark)
            val memberScheme = if (configuration.approach == AlarmReviewApproach.Immersive) individual.copy(surface = individual.background)
              else ambient.copy(primary = individual.primary, onPrimary = individual.onPrimary)
            MaterialTheme(colorScheme = memberScheme, content = content)
          }
        }
      )
    }
  }
}

private fun reviewScheme(tokens: JSONObject, name: String, dark: Boolean): ColorScheme {
  val palette = tokens.optJSONObject(name.lowercase(Locale.ROOT)) ?: tokens.getJSONObject("classic")
  val token = palette.getJSONObject(if (dark) "dark" else "light")
  fun color(name: String) = Color(android.graphics.Color.parseColor(token.getString(name)))
  val base = if (dark) darkColorScheme() else lightColorScheme()
  return base.copy(primary = color("accent"), onPrimary = color("accentInk"),
    primaryContainer = color("soft"), onPrimaryContainer = color("ink"),
    secondary = color("accent"), onSecondary = color("accentInk"),
    secondaryContainer = color("soft"), onSecondaryContainer = color("ink"),
    background = color("background"), onBackground = color("ink"), surface = color("surface"),
    onSurface = color("ink"), onSurfaceVariant = color("muted"), outline = color("outline"),
    outlineVariant = color("border"), error = color("danger"), surfaceTint = color("accent"))
}

private fun baselineScheme(dark: Boolean): ColorScheme = if (dark) darkColorScheme(
  primary = Color(0xFFA9C5FF), onPrimary = Color(0xFF102B59), background = Color(0xFF101318),
  surface = Color(0xFF1B2028), onSurface = Color(0xFFF1F4F9), onSurfaceVariant = Color(0xFFADB8C8), error = Color(0xFFFFB4AB))
else lightColorScheme(primary = Color(0xFF245CD6), onPrimary = Color.White, background = Color(0xFFF7F8FA),
  surface = Color.White, onSurface = Color(0xFF18212F), onSurfaceVariant = Color(0xFF596475), error = Color(0xFFB3261E))

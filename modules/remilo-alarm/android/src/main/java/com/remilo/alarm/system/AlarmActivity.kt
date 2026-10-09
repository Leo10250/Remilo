package com.remilo.alarm.system

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.material3.*
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.sp
import com.remilo.alarm.core.SessionRefreshGuard
import com.remilo.alarm.core.AppearancePolicy
import com.remilo.alarm.data.AlertRecord
import com.remilo.alarm.engine.AlarmEngine
import com.remilo.alarm.presentation.AtmosphereTokens
import androidx.core.view.WindowCompat
import java.util.UUID

/** Native-only controls. Empty loading state must never dismiss a live session. */
class AlarmActivity : ComponentActivity() {
  private val snapshot = mutableStateOf<AlarmEngine.SessionSnapshot?>(null)
  private val error = mutableStateOf<String?>(null)
  private val refreshError = mutableStateOf<String?>(null)
  private val busy = mutableStateOf(false)
  private val progress = mutableStateOf<String?>(null)
  private val loadingAppearance = mutableStateOf(AppearancePolicy.resolve(null, null, System.currentTimeMillis(),
    java.time.ZoneId.systemDefault(), false))
  private val guard = SessionRefreshGuard()
  private var pendingCommand: Map<String, Any?>? = null
  private val unconfirmed = mutableStateOf(false)
  private var observation: AutoCloseable? = null
  private lateinit var engine: AlarmEngine
  private fun select(intent: Intent) {
    val id = intent.getStringExtra("sessionId") ?: run { finish(); return }
    val atmosphere = intent.getStringExtra("atmosphere")
    val brightness = intent.getStringExtra("brightness")
    loadingAppearance.value = if (atmosphere in AppearancePolicy.atmospheres && brightness in setOf("light", "dark"))
      AppearancePolicy.captured(atmosphere, brightness) else AppearancePolicy.resolve(null, null,
        System.currentTimeMillis(), java.time.ZoneId.systemDefault(),
        (resources.configuration.uiMode and android.content.res.Configuration.UI_MODE_NIGHT_MASK) == android.content.res.Configuration.UI_MODE_NIGHT_YES)
    pendingCommand = null; unconfirmed.value = false
    guard.select(id); snapshot.value = null; error.value = null; refreshError.value = null; busy.value = false; progress.value = null
    refresh()
  }
  private fun refresh() {
    val ticket = guard.request()
    engine.sessionSnapshot(ticket.sessionId, { current -> runOnUiThread {
      if (!isDestroyed && guard.accepts(ticket) && current.id == ticket.sessionId) {
        snapshot.value = current
        refreshError.value = null
        if (SessionRefreshGuard.ended(current.state)) finish()
      }
    } }, { runOnUiThread { if (!isDestroyed && guard.accepts(ticket)) refreshError.value = if (snapshot.value == null) "Could not load alarm controls." else "Could not refresh alarm controls." } })
  }
  private fun act(kind: String, record: AlertRecord? = null) {
    val current = snapshot.value ?: return
    if (busy.value || pendingCommand != null) return
    error.value = null; refreshError.value = null
    val title = current.members.firstOrNull { it.first.occurrenceId == record?.occurrenceId }?.second ?: "Reminder"
    progress.value = when (kind) { "StopAll" -> "Stopping all alarms…"; "Snooze" -> "Snoozing $title…"; else -> "Stopping $title…" }
    val command = mapOf("kind" to kind, "operationId" to UUID.randomUUID().toString(),
      "expectedSessionId" to current.id, "occurrenceId" to record?.occurrenceId, "expectedGeneration" to record?.generation)
    pendingCommand = command
    sendAction(command)
  }
  private fun retry() { pendingCommand?.let(::sendAction) ?: refresh() }
  private fun sendAction(command: Map<String, Any?>) {
    if (busy.value) return
    val sessionId = command["expectedSessionId"] as String
    busy.value = true; unconfirmed.value = false; error.value = null
    engine.request({ engine.apply(command) }, { result -> runOnUiThread {
      if (!isDestroyed && snapshot.value?.id == sessionId) {
        busy.value = false; progress.value = null; pendingCommand = null; unconfirmed.value = false
        val status = result as? Map<*, *>
        if (status?.get("status") == "Rejected") error.value = status["errorMessage"] as? String ?: "Could not apply this action. Retry."
        refresh() // Only a confirmed terminated snapshot closes the activity.
      }
    } }, { runOnUiThread { if (!isDestroyed && snapshot.value?.id == sessionId) {
      busy.value = false; progress.value = null; unconfirmed.value = true
      error.value = "Could not confirm this action. Retry the same action."; refresh()
    } } })
  }
  override fun onNewIntent(intent: Intent) { super.onNewIntent(intent); setIntent(intent); select(intent) }
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setShowWhenLocked(true); setTurnScreenOn(true)
    engine = AlarmEngine.get(this)
    observation = engine.observe { runOnUiThread { if (!isDestroyed) refresh() } }
    select(intent)
    savedInstanceState?.getBundle("pendingAction")?.let { saved ->
      if (saved.getString("sessionId") == intent.getStringExtra("sessionId")) {
        pendingCommand = mapOf("kind" to saved.getString("kind"), "operationId" to saved.getString("operationId"),
          "expectedSessionId" to saved.getString("sessionId"), "occurrenceId" to saved.getString("occurrenceId"),
          "expectedGeneration" to if (saved.containsKey("generation")) saved.getLong("generation") else null)
        unconfirmed.value = true; error.value = "Could not confirm this action. Retry the same action."
      }
    }
    setContent {
      val current = snapshot.value
      val dark = (current?.theme ?: loadingAppearance.value.brightness) == "dark"
      val roles = AtmosphereTokens.colors(current?.atmosphere ?: loadingAppearance.value.atmosphere, if (dark) "dark" else "light")
      val scheme = if (dark) darkColorScheme(primary = Color(roles.primary), onPrimary = Color(roles.onPrimary),
        background = Color(roles.canvas), surface = Color(roles.surface), onSurface = Color(roles.onSurface),
        onSurfaceVariant = Color(roles.onSurfaceVariant), surfaceVariant = Color(roles.container), outline = Color(roles.outline), error = Color(roles.error))
        else lightColorScheme(primary = Color(roles.primary), onPrimary = Color(roles.onPrimary),
          background = Color(roles.canvas), surface = Color(roles.surface), onSurface = Color(roles.onSurface),
          onSurfaceVariant = Color(roles.onSurfaceVariant), surfaceVariant = Color(roles.container), outline = Color(roles.outline), error = Color(roles.error))
      SideEffect {
        WindowCompat.getInsetsController(window, window.decorView).apply {
          isAppearanceLightStatusBars = !dark; isAppearanceLightNavigationBars = !dark
        }
      }
      val baseType = Typography()
      val type = Typography(
        // The larger single-alarm headline remains a deliberate native hierarchy.
        headlineLarge = baseType.headlineLarge.copy(fontSize = 28.sp, lineHeight = 36.sp),
        headlineMedium = baseType.headlineMedium.copy(fontSize = AtmosphereTokens.typeTitle.sp, lineHeight = AtmosphereTokens.spaceXl.sp),
        titleLarge = baseType.titleLarge.copy(fontSize = AtmosphereTokens.typeTitle.sp, lineHeight = AtmosphereTokens.spaceXl.sp),
        titleMedium = baseType.titleMedium.copy(fontSize = AtmosphereTokens.typeHeading.sp, lineHeight = (AtmosphereTokens.typeHeading + AtmosphereTokens.spaceSm).sp),
        bodyLarge = baseType.bodyLarge.copy(fontSize = AtmosphereTokens.typeBody.sp, lineHeight = AtmosphereTokens.spaceLg.sp),
        bodyMedium = baseType.bodyMedium.copy(fontSize = AtmosphereTokens.typeSupporting.sp, lineHeight = 20.sp),
        bodySmall = baseType.bodySmall.copy(fontSize = AtmosphereTokens.typeSupporting.sp, lineHeight = 20.sp),
        labelLarge = baseType.labelLarge.copy(fontSize = AtmosphereTokens.typeLabel.sp, lineHeight = 20.sp),
        labelMedium = baseType.labelMedium.copy(fontSize = AtmosphereTokens.typeLabel.sp, lineHeight = 20.sp),
        labelSmall = baseType.labelSmall.copy(fontSize = AtmosphereTokens.typeLabel.sp, lineHeight = 20.sp)
      )
      MaterialTheme(colorScheme = scheme, typography = type) {
        AlarmControlsScreen(current, busy.value, error.value, ::act, ::retry, roles, progress.value, refreshError.value, unconfirmed.value)
      }
    }
  }
  override fun onSaveInstanceState(outState: Bundle) {
    pendingCommand?.let { command -> outState.putBundle("pendingAction", Bundle().apply {
      putString("kind", command["kind"] as String); putString("operationId", command["operationId"] as String)
      putString("sessionId", command["expectedSessionId"] as String)
      putString("occurrenceId", command["occurrenceId"] as? String)
      (command["expectedGeneration"] as? Long)?.let { putLong("generation", it) }
    }) }
    super.onSaveInstanceState(outState)
  }
  override fun onDestroy() { observation?.close(); super.onDestroy() }
}

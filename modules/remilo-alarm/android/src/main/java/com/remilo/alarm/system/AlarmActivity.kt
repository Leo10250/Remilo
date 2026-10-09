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
import com.remilo.alarm.core.DeliverySnapshot
import com.remilo.alarm.data.AlertRecord
import com.remilo.alarm.engine.AlarmEngine
import com.remilo.alarm.presentation.AtmosphereTokens
import androidx.core.view.WindowCompat
import java.util.UUID
import android.widget.Toast

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
  private var deferredIntent: Intent? = null
  private val unconfirmed = mutableStateOf(false)
  private var observation: AutoCloseable? = null
  private lateinit var engine: AlarmEngine
  private fun select(intent: Intent) {
    val id = intent.getStringExtra("sessionId") ?: run {
      if (pendingCommand == null && !busy.value && !unconfirmed.value) finish()
      return
    }
    val preserveAction = pendingCommand != null || busy.value || unconfirmed.value
    // Keep the selected session and exact retry even when a later alarm starts a new group.
    if (!guard.select(id, pendingCommand != null, busy.value, unconfirmed.value)) {
      if (id != this.intent.getStringExtra("sessionId")) deferredIntent = Intent(intent)
      refresh(); return
    }
    setIntent(intent)
    val atmosphere = intent.getStringExtra("atmosphere")
    val brightness = intent.getStringExtra("brightness")
    loadingAppearance.value = if (atmosphere in AppearancePolicy.atmospheres && brightness in setOf("light", "dark"))
      AppearancePolicy.captured(atmosphere, brightness) else AppearancePolicy.resolve(null, null,
        System.currentTimeMillis(), java.time.ZoneId.systemDefault(),
        (resources.configuration.uiMode and android.content.res.Configuration.UI_MODE_NIGHT_MASK) == android.content.res.Configuration.UI_MODE_NIGHT_YES)
    snapshot.value = null; refreshError.value = null
    if (!preserveAction) {
      pendingCommand = null; unconfirmed.value = false; error.value = null; busy.value = false; progress.value = null
    }
    refresh()
  }
  private fun refresh() {
    val ticket = guard.request()
    engine.sessionSnapshot(ticket.sessionId, { current -> runOnUiThread {
      if (!isDestroyed && guard.accepts(ticket) && current.id == ticket.sessionId) {
        snapshot.value = current
        refreshError.value = null
        if (SessionRefreshGuard.mayDismiss(current.state, pendingCommand != null, busy.value, unconfirmed.value)) finish()
      }
    } }, { runOnUiThread { if (!isDestroyed && guard.accepts(ticket)) refreshError.value = if (snapshot.value == null) "Could not load alarm controls." else "Could not refresh alarm controls." } })
  }
  private fun act(kind: String, record: AlertRecord? = null) {
    val current = snapshot.value ?: return
    if (busy.value || pendingCommand != null) return
    error.value = null; refreshError.value = null
    val title = current.members.firstOrNull { it.first.occurrenceId == record?.occurrenceId }?.second ?: "Reminder"
    progress.value = when (kind) { "DoneAll" -> "Completing ${current.members.size} reminders…";
      "SnoozeAll" -> "Snoozing ${current.members.size} reminders…"; "Snooze" -> "Snoozing $title…"; else -> "Completing $title…" }
    val command = mutableMapOf<String, Any?>("kind" to kind, "operationId" to UUID.randomUUID().toString(),
      "expectedSessionId" to current.id, "occurrenceId" to record?.occurrenceId, "expectedGeneration" to record?.generation)
    if (kind in setOf("DoneAll", "SnoozeAll")) command["members"] = DeliverySnapshot.maps(current.members.map {
      DeliverySnapshot.Member(it.first.occurrenceId, it.first.generation) })
    if (kind == "SnoozeAll") command["snoozeMinutes"] = current.members.first().first.snoozeMinutes
    if (kind == "Snooze") command["expectedSnoozeMinutes"] = record?.snoozeMinutes
    pendingCommand = command
    sendAction(command)
  }
  private fun retry() { pendingCommand?.let(::sendAction) ?: refresh() }
  private fun sendAction(command: Map<String, Any?>) {
    if (busy.value) return
    busy.value = true; unconfirmed.value = false; error.value = null
    engine.request({ engine.apply(command) }, { result -> runOnUiThread {
      if (!isDestroyed && pendingCommand?.get("operationId") == command["operationId"]) {
        busy.value = false; progress.value = null
        val status = result as? Map<*, *>
        val definitive = status?.get("status") in setOf("Applied", "Rejected", "Partial", "Blocked")
        if (definitive) { pendingCommand = null; unconfirmed.value = false }
        else {
          pendingCommand = command; unconfirmed.value = true
          error.value = "Could not confirm this action. Retry the same action."
        }
        if (status?.get("status") == "Rejected") error.value = status["errorMessage"] as? String ?: "Could not apply this action. Retry."
        if (status?.get("status") in setOf("Partial", "Blocked")) {
          val outcomes = status?.get("memberResults") as? List<*>
          val scheduled = outcomes?.count { (it as? Map<*, *>)?.get("status") == "Scheduled" } ?: 0
          val message = if (outcomes != null) "$scheduled of ${outcomes.size} reminders snoozed. Review alert problems in Remilo."
            else "Could not schedule Snooze. Review alert problems in Remilo."
          error.value = message
          Toast.makeText(this, message, Toast.LENGTH_LONG).show()
        }
        if (status?.get("status") == "Pending") {
          pendingCommand = command; unconfirmed.value = true
          val message = "Snooze is saved; scheduling is pending. Retry the same action."
          error.value = message
          Toast.makeText(this, message, Toast.LENGTH_LONG).show()
        }
        if (status?.get("status") == "Applied" && command["kind"] in setOf("CompleteDelivery", "DoneAll")) {
          val message = if (command["kind"] == "DoneAll") "${status["count"]} reminders completed" else "Reminder completed"
          Toast.makeText(this, message, Toast.LENGTH_SHORT).show()
        }
        if (definitive && deferredIntent != null) {
          val incoming = deferredIntent!!; deferredIntent = null; select(incoming)
        } else refresh() // A terminated snapshot closes only after a definitive action acknowledgement.
      }
    } }, { runOnUiThread { if (!isDestroyed && pendingCommand?.get("operationId") == command["operationId"]) {
      busy.value = false; progress.value = null; unconfirmed.value = true
      error.value = "Could not confirm this action. Retry the same action."; refresh()
    } } })
  }
  override fun onNewIntent(intent: Intent) { super.onNewIntent(intent); select(intent) }
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setShowWhenLocked(true); setTurnScreenOn(true)
    engine = AlarmEngine.get(this)
    deferredIntent = savedInstanceState?.getParcelable("deferredIntent", Intent::class.java)
    savedInstanceState?.getBundle("pendingAction")?.let { saved ->
      if (saved.getString("sessionId") != null) {
        pendingCommand = mapOf<String, Any?>("kind" to saved.getString("kind"), "operationId" to saved.getString("operationId"),
          "expectedSessionId" to saved.getString("sessionId"), "occurrenceId" to saved.getString("occurrenceId"),
          "expectedGeneration" to if (saved.containsKey("generation")) saved.getLong("generation") else null).toMutableMap().also { command ->
          val ids = saved.getStringArray("memberIds")
          val generations = saved.getLongArray("memberGenerations")
          if (ids != null && generations != null && ids.size == generations.size)
            command["members"] = DeliverySnapshot.maps(ids.indices.map { DeliverySnapshot.Member(ids[it], generations[it]) })
          if (saved.containsKey("snoozeMinutes")) command["snoozeMinutes"] = saved.getInt("snoozeMinutes")
          if (saved.containsKey("expectedSnoozeMinutes")) command["expectedSnoozeMinutes"] = saved.getInt("expectedSnoozeMinutes")
        }
        unconfirmed.value = true; error.value = "Could not confirm this action. Retry the same action."
      }
    }
    val initialIntent = pendingCommand?.get("expectedSessionId")?.let { savedSession ->
      if (savedSession != intent.getStringExtra("sessionId")) deferredIntent = Intent(intent)
      Intent(intent).putExtra("sessionId", savedSession as String)
    } ?: intent
    select(initialIntent)
    observation = engine.observe { runOnUiThread { if (!isDestroyed) refresh() } }
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
    deferredIntent?.let { outState.putParcelable("deferredIntent", it) }
    pendingCommand?.let { command -> outState.putBundle("pendingAction", Bundle().apply {
      putString("kind", command["kind"] as String); putString("operationId", command["operationId"] as String)
      putString("sessionId", command["expectedSessionId"] as String)
      putString("occurrenceId", command["occurrenceId"] as? String)
      (command["expectedGeneration"] as? Long)?.let { putLong("generation", it) }
      (command["members"] as? List<*>)?.let { raw ->
        val members = raw.map { it as Map<*, *> }
        putStringArray("memberIds", members.map { it["occurrenceId"] as String }.toTypedArray())
        putLongArray("memberGenerations", members.map { (it["expectedGeneration"] as Number).toLong() }.toLongArray())
      }
      (command["snoozeMinutes"] as? Int)?.let { putInt("snoozeMinutes", it) }
      (command["expectedSnoozeMinutes"] as? Int)?.let { putInt("expectedSnoozeMinutes", it) }
    }) }
    super.onSaveInstanceState(outState)
  }
  override fun onDestroy() { observation?.close(); super.onDestroy() }
}

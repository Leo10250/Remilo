package com.remilo.alarm.system

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.*
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.sp
import com.remilo.alarm.core.SessionRefreshGuard
import com.remilo.alarm.data.AlertRecord
import com.remilo.alarm.engine.AlarmEngine
import java.util.UUID

/** Native-only controls. Empty loading state must never dismiss a live session. */
class AlarmActivity : ComponentActivity() {
  private val snapshot = mutableStateOf<AlarmEngine.SessionSnapshot?>(null)
  private val error = mutableStateOf<String?>(null)
  private val busy = mutableStateOf(false)
  private val guard = SessionRefreshGuard()
  private var observation: AutoCloseable? = null
  private lateinit var engine: AlarmEngine
  private fun select(intent: Intent) {
    val id = intent.getStringExtra("sessionId") ?: run { finish(); return }
    guard.select(id); snapshot.value = null; error.value = null; busy.value = false
    refresh()
  }
  private fun refresh() {
    val ticket = guard.request()
    engine.sessionSnapshot(ticket.sessionId, { current -> runOnUiThread {
      if (!isDestroyed && guard.accepts(ticket) && current.id == ticket.sessionId) {
        snapshot.value = current
        if (SessionRefreshGuard.ended(current.state)) finish()
      }
    } }, { runOnUiThread { if (!isDestroyed && guard.accepts(ticket)) error.value = "Could not load alarm controls. Retry." } })
  }
  private fun act(kind: String, record: AlertRecord? = null) {
    val current = snapshot.value ?: return
    if (busy.value) return
    busy.value = true; error.value = null
    val sessionId = current.id
    val command = mapOf("kind" to kind, "operationId" to UUID.randomUUID().toString(),
      "expectedSessionId" to sessionId, "occurrenceId" to record?.occurrenceId, "expectedGeneration" to record?.generation)
    engine.request({ engine.apply(command) }, { result -> runOnUiThread {
      if (!isDestroyed && snapshot.value?.id == sessionId) {
        busy.value = false
        val status = result as? Map<*, *>
        if (status?.get("status") == "Rejected") error.value = status["errorMessage"] as? String ?: "Could not apply this action. Retry."
        refresh() // Only a confirmed terminated snapshot closes the activity.
      }
    } }, { runOnUiThread { if (!isDestroyed && snapshot.value?.id == sessionId) {
      busy.value = false; error.value = "Could not apply this action. Try again."; refresh()
    } } })
  }
  override fun onNewIntent(intent: Intent) { super.onNewIntent(intent); setIntent(intent); select(intent) }
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setShowWhenLocked(true); setTurnScreenOn(true)
    engine = AlarmEngine.get(this)
    observation = engine.observe { runOnUiThread { if (!isDestroyed) refresh() } }
    select(intent)
    setContent {
      val current = snapshot.value
      val dark = when (current?.theme) { "dark" -> true; "light" -> false; else -> isSystemInDarkTheme() }
      val scheme = if (dark) darkColorScheme(primary = Color(0xFFA9C5FF), onPrimary = Color(0xFF102B59),
        background = Color(0xFF101318), surface = Color(0xFF1B2028), onSurface = Color(0xFFF1F4F9),
        onSurfaceVariant = Color(0xFFADB8C8), error = Color(0xFFFFB4AB))
        else lightColorScheme(primary = Color(0xFF245CD6), onPrimary = Color.White,
          background = Color(0xFFF7F8FA), surface = Color.White, onSurface = Color(0xFF18212F),
          onSurfaceVariant = Color(0xFF596475), error = Color(0xFFB3261E))
      val baseType = Typography()
      val type = Typography(
        headlineLarge = baseType.headlineLarge.copy(fontSize = 28.sp, lineHeight = 36.sp),
        headlineMedium = baseType.headlineMedium.copy(fontSize = 28.sp, lineHeight = 36.sp),
        titleLarge = baseType.titleLarge.copy(fontSize = 22.sp, lineHeight = 28.sp),
        bodyLarge = baseType.bodyLarge.copy(fontSize = 16.sp, lineHeight = 24.sp),
        bodyMedium = baseType.bodyMedium.copy(fontSize = 14.sp, lineHeight = 20.sp),
        labelSmall = baseType.labelSmall.copy(fontSize = 12.sp, lineHeight = 16.sp)
      )
      MaterialTheme(colorScheme = scheme, typography = type) {
        AlarmControlsScreen(current, busy.value, error.value, ::act, ::refresh)
      }
    }
  }
  override fun onDestroy() { observation?.close(); super.onDestroy() }
}

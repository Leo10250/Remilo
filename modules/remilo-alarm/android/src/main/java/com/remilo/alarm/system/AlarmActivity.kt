package com.remilo.alarm.system

import android.os.Bundle
import android.content.Intent
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.remilo.alarm.data.AlertRecord
import com.remilo.alarm.engine.AlarmEngine
import java.util.UUID

/** Standalone controls; this screen never initializes Expo/React Native. */
class AlarmActivity : ComponentActivity() {
  private val members = mutableStateOf<List<Pair<AlertRecord, String>>>(emptyList())
  private var observation: AutoCloseable? = null
  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    val id = intent.getStringExtra("sessionId") ?: return
    AlarmEngine.get(this).sessionMembers(id) { rows -> runOnUiThread { members.value = rows } }
  }
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setShowWhenLocked(true); setTurnScreenOn(true)
    val engine = AlarmEngine.get(this)
    fun refresh() {
      val id = intent.getStringExtra("sessionId") ?: return
      engine.sessionMembers(id) { rows -> runOnUiThread { members.value = rows } }
    }
    observation = engine.observe { refresh() }
    refresh()
    setContent {
      MaterialTheme {
        Surface(modifier = Modifier.fillMaxSize()) {
          Column(Modifier.padding(24.dp).safeDrawingPadding(), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Text("Remilo", style = MaterialTheme.typography.headlineLarge)
            if (members.value.isEmpty()) Text("This alarm session has ended. The reminder remains unfinished.")
            members.value.forEach { (record, title) ->
              Text(title, style = MaterialTheme.typography.titleLarge)
              Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                listOf("Stop", "Snooze").forEach { kind ->
                  Button(onClick = {
                    engine.request({ engine.apply(mapOf("kind" to kind, "operationId" to UUID.randomUUID().toString(),
                      "occurrenceId" to record.occurrenceId, "expectedGeneration" to record.generation)) }, {}, {})
                  }) { Text(if (kind == "Snooze") "Snooze 10 min" else "Stop") }
                }
              }
            }
            Text("Stop silences this delivery. It does not complete the reminder.")
            TextButton(onClick = { finish() }) { Text("Close") }
          }
        }
      }
    }
  }
  override fun onDestroy() { observation?.close(); super.onDestroy() }
}

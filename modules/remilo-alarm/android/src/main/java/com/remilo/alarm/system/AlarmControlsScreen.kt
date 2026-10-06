package com.remilo.alarm.system

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.remilo.alarm.data.AlertRecord
import com.remilo.alarm.engine.AlarmEngine
import java.text.DateFormat
import java.util.Date

/** Rendering only; the activity owns observation, actions, and confirmed dismissal. */
@Composable
internal fun AlarmControlsScreen(
  current: AlarmEngine.SessionSnapshot?,
  busy: Boolean,
  error: String?,
  onAction: (String, AlertRecord?) -> Unit,
  onRetry: () -> Unit,
  backdrop: @Composable BoxScope.() -> Unit = {},
  memberArtwork: @Composable (AlertRecord) -> Unit = {},
  deliveryLabel: @Composable (AlertRecord) -> Unit = {},
  memberPresentation: @Composable (AlertRecord, @Composable () -> Unit) -> Unit = { _, content -> content() }
) {
  val scheme = MaterialTheme.colorScheme
  Surface(color = scheme.background, modifier = Modifier.fillMaxSize()) {
    BoxWithConstraints(Modifier.fillMaxSize().safeDrawingPadding()) {
      backdrop()
      val viewportHeight = maxHeight
      Column(Modifier.verticalScroll(rememberScrollState()).padding(16.dp)
        .heightIn(min = (viewportHeight - 32.dp).coerceAtLeast(0.dp)), verticalArrangement = Arrangement.SpaceBetween) {
        Column(verticalArrangement = Arrangement.spacedBy(20.dp)) {
          Text("Remilo", style = MaterialTheme.typography.titleMedium, color = scheme.onSurfaceVariant)
          if (current == null) { CircularProgressIndicator(); Text("Loading alarm…") }
          else if (current.members.isEmpty()) Text("Updating alarm controls…")
          else if (current.members.size == 1) {
            val (record, title) = current.members.first()
            memberArtwork(record)
            Text(title, style = MaterialTheme.typography.headlineLarge)
            deliveryLabel(record)
            Text(DateFormat.getTimeInstance(DateFormat.SHORT).format(Date(record.targetMs)), style = MaterialTheme.typography.titleLarge)
            Text(if (current.state == "Active") "Alarm ringing" else "Starting alarm…", color = scheme.primary)
          } else {
            Text("${current.members.size} alarms ringing", style = MaterialTheme.typography.headlineMedium)
            current.members.forEach { (record, title) ->
              memberPresentation(record) {
                Surface(shape = MaterialTheme.shapes.medium) {
                  Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    memberArtwork(record)
                    Text(title, style = MaterialTheme.typography.titleLarge)
                    deliveryLabel(record)
                    Text(DateFormat.getTimeInstance(DateFormat.SHORT).format(Date(record.targetMs)), color = MaterialTheme.colorScheme.onSurfaceVariant)
                    // A FlowRow wraps at large font size instead of clipping two actions.
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                      Button(onClick = { onAction("Stop", record) }, enabled = !busy) { Text("Stop") }
                      OutlinedButton(onClick = { onAction("Snooze", record) }, enabled = !busy) { Text("Snooze · ${record.snoozeMinutes} min") }
                    }
                  }
                }
              }
            }
          }
        }
        Column(Modifier.padding(top = 24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
          if (current?.members?.size == 1) {
            val record = current.members.first().first
            Button(onClick = { onAction("Stop", record) }, enabled = !busy,
              modifier = Modifier.fillMaxWidth().heightIn(min = 64.dp), contentPadding = PaddingValues(20.dp)) {
              Text("Stop", style = MaterialTheme.typography.titleLarge)
            }
            OutlinedButton(onClick = { onAction("Snooze", record) }, enabled = !busy,
              modifier = Modifier.fillMaxWidth().heightIn(min = 64.dp), contentPadding = PaddingValues(20.dp)) {
              Text("Snooze · ${record.snoozeMinutes} min", style = MaterialTheme.typography.titleMedium)
            }
          } else if ((current?.members?.size ?: 0) > 1) {
            Button(onClick = { onAction("StopAll", null) }, enabled = !busy, modifier = Modifier.fillMaxWidth().heightIn(min = 56.dp)) { Text("Stop all") }
          }
          Text("Stop leaves the reminder unfinished.", style = MaterialTheme.typography.bodyMedium, color = scheme.onSurfaceVariant)
          error?.let { Text(it, color = scheme.error); TextButton(onClick = onRetry, modifier = Modifier.align(Alignment.Start)) { Text("Retry") } }
        }
      }
    }
  }
}

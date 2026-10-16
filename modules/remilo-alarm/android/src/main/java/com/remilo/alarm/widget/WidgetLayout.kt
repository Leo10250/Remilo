package com.remilo.alarm.widget

import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.*
import androidx.glance.action.*
import androidx.glance.appwidget.*
import androidx.glance.appwidget.action.*
import androidx.glance.layout.*
import androidx.glance.text.*
import androidx.glance.unit.ColorProvider
import androidx.glance.semantics.semantics
import androidx.glance.semantics.contentDescription
import com.remilo.alarm.presentation.AtmosphereTokens
import com.remilo.alarm.presentation.L10n
import com.remilo.alarm.system.PresentationLanguage
import java.time.LocalDate
import java.time.format.DateTimeFormatter

/** Production RemoteViews composition shared by launcher, setup and native render tests. */
@Composable internal fun WidgetContent(snapshot: WidgetSnapshot, preview: Boolean = false, fontScale: Float = 1f, staticCollections: Boolean = preview) {
  val context = LocalContext.current; val size = LocalSize.current
  val roles = AtmosphereTokens.colors(snapshot.appearance.atmosphere,snapshot.appearance.brightness)
  val ink = ColorProvider(Color(roles.onSurface)); val muted = ColorProvider(Color(roles.onSurfaceVariant))
  val accent = ColorProvider(Color(roles.primary)); val onAccent = ColorProvider(Color(roles.onPrimary))
  fun label(text: String) = L10n.text(context,text)
  val agenda = actionStartActivity(widgetOpen(context,""))
  val setup = actionStartActivity(Intent(context,WidgetConfigureActivity::class.java).putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID,snapshot.id))
  val session = snapshot.session?.takeUnless { it["deleted"] == true }
  @Suppress("UNCHECKED_CAST") val steps = session?.get("steps") as? List<Map<String,Any?>> ?: emptyList()
  val step = steps.firstOrNull { it["completed"] != true }
  val route = snapshot.configuration.routineId?.let { "routine-session?id=${Uri.encode(it)}&date=${snapshot.date}" + (step?.get("id")?.let { id -> "&stepId=${Uri.encode(id.toString())}" } ?: "") }
  val openRoutine = route?.let { actionStartActivity(widgetOpen(context,it)) } ?: setup
  val date = runCatching { LocalDate.parse(snapshot.date).format(DateTimeFormatter.ofPattern("EEE, MMM d",PresentationLanguage.context(context).resources.configuration.locales[0])) }.getOrDefault("")
  val state = session?.get("state") as? String
  val title = session?.get("title") as? String ?: label(if(snapshot.configuration.routineId != null) "Routine unavailable" else "Today's reminders")
  val total = (session?.get("totalCount") as? Number)?.toInt()?.coerceAtLeast(0) ?: 0
  val done = ((session?.get("completedCount") as? Number)?.toInt() ?: 0).coerceIn(0,total)
  val outcome = label(when(state) { "Rest" -> "Rest day"; "Paused" -> "Paused"; "Skipped" -> "Skipped today"; "Completed" -> "Completed today"; "Upcoming" -> "Not started yet"; else -> "$done of $total done" })
  val summary = size.width < 300.dp || size.height < 240.dp || fontScale >= 1.6f || fontScale > 1.2f && size.height < 440.dp
  val expanded = size.height >= 440.dp && fontScale <= 1.2f
  @Composable fun copy(text: String, supporting: Boolean = false, lines: Int = 1, font: Int = if(supporting)14 else 16, modifier: GlanceModifier = GlanceModifier) {
    Text(text,modifier,TextStyle(color = if(supporting)muted else ink,fontSize = font.sp),maxLines = lines)
  }
  @Composable fun refresh() {
    if(!snapshot.locked) Image(ImageProvider(com.remilo.alarm.R.drawable.ic_widget_refresh),label("Refresh"),
      GlanceModifier.size(48.dp).padding(14.dp).then(if(preview)GlanceModifier else GlanceModifier.clickable(actionRunCallback<WidgetRefreshAction>())),colorFilter = ColorFilter.tint(muted))
  }
  @Composable fun action(text: String, callback: Action, modifier: GlanceModifier, primary: Boolean) {
    Box(modifier.background(ImageProvider(com.remilo.alarm.R.drawable.widget_row_single), colorFilter = ColorFilter.tint(if(primary)accent else ColorProvider(Color(roles.container))))
      .clickable(callback).padding(horizontal = 8.dp), contentAlignment = Alignment.Center) {
      Text(text,style = TextStyle(color = if(primary)onAccent else ink,fontSize = 16.sp,fontWeight = FontWeight.Medium),maxLines = 1)
    }
  }
  Column(GlanceModifier.fillMaxSize().appWidgetBackground().background(ColorProvider(Color(roles.surface)))
    .cornerRadius(android.R.dimen.system_app_widget_background_radius).padding(if(summary && fontScale >= 1.6f)8.dp else 12.dp)
    .then(if(summary && snapshot.configured && !snapshot.locked && !snapshot.failed) GlanceModifier.clickable(if(snapshot.configuration.routineId != null)openRoutine else agenda) else GlanceModifier)
    .semantics { contentDescription = if(snapshot.locked) label("Unlock to view Remilo.") else "$title, $date, $outcome" }) {
    if(summary && snapshot.configured && !snapshot.locked && !snapshot.failed) {
      if(fontScale < 1.6f) copy(date,true)
      copy(title,lines = 1)
      copy(if(session != null) if(state in setOf("Rest","Paused","Skipped","Completed","Upcoming"))outcome else "$done/$total" else if(snapshot.configuration.routineId != null)label("Routine unavailable") else label("${snapshot.total} reminders"),true)
    } else {
      Row(GlanceModifier.fillMaxWidth(),verticalAlignment = Alignment.Vertical.CenterVertically) {
        Image(ImageProvider(com.remilo.alarm.R.drawable.ic_remilo_notification),null,GlanceModifier.size(20.dp),colorFilter = ColorFilter.tint(muted))
        copy("Remilo",true,modifier = GlanceModifier.defaultWeight().padding(start = 6.dp))
        copy(date,true)
      }
      Spacer(GlanceModifier.height(8.dp))
      when {
        snapshot.locked -> copy(label("Unlock to view Remilo."),lines = 2)
        snapshot.failed -> { copy(label(snapshot.notice ?: "Could not load the widget. Refresh to try again."),lines = 2); refresh() }
        !snapshot.configured -> Button(label("Choose what to show"),setup,GlanceModifier.fillMaxWidth().height(56.dp))
        else -> {
          if(snapshot.notice != null) copy(label(snapshot.notice),true,2)
          if(snapshot.configuration.routineId != null) {
            // Group layout nodes to stay below RemoteViews' ten-child limit;
            // this adds no second surface or card.
            Column(GlanceModifier.fillMaxWidth()) {
            Text(title,style = TextStyle(color = ink,fontSize = 22.sp,fontWeight = FontWeight.Medium),maxLines = if(expanded)2 else 1)
            Spacer(GlanceModifier.height(8.dp))
            if(session == null) { copy(label("Routine unavailable"),true); Button(label("Choose what to show"),setup,GlanceModifier.height(56.dp)); refresh() }
            else {
              Row(GlanceModifier.fillMaxWidth(),verticalAlignment = Alignment.Vertical.CenterVertically) {
                if(total > 0) Box(GlanceModifier.defaultWeight().padding(end = 8.dp)) { WidgetRoutineProgress(done,total,accent,ColorProvider(Color(roles.outline))) }
                copy(outcome,true)
              }
              Spacer(GlanceModifier.height(12.dp))
              Row(GlanceModifier.fillMaxWidth(),verticalAlignment = Alignment.Vertical.CenterVertically) {
                Column(GlanceModifier.defaultWeight().padding(end = 12.dp).clickable(openRoutine).height((56*fontScale.coerceAtLeast(1f)).dp)) {
                  Text(step?.get("name") as? String ?: outcome,style = TextStyle(color = ink,fontSize = 18.sp,fontWeight = FontWeight.Medium),maxLines = 1)
                  (step?.get("target") as? String)?.takeIf { it.isNotEmpty() }?.let { copy(it,true) }
                }
                action(label("Resume"),openRoutine,GlanceModifier.width((104*fontScale.coerceAtLeast(1f)).dp).height((56*fontScale.coerceAtLeast(1f)).dp),true)
              }
              Spacer(GlanceModifier.height(8.dp))
              Row(GlanceModifier.fillMaxWidth(),verticalAlignment = Alignment.Vertical.CenterVertically) {
                val next = steps.dropWhile { it !== step }.drop(1).firstOrNull { it["completed"] != true }
                val undo = snapshot.undoToken
                Box(GlanceModifier.defaultWeight().height((48*fontScale.coerceAtLeast(1f)).dp),contentAlignment = Alignment.CenterStart) {
                  if(undo != null) Text(label("Undo ${snapshot.undoName.orEmpty()}"),GlanceModifier.fillMaxSize().clickable(if(preview)openRoutine else actionRunCallback<WidgetExerciseAction>(actionParametersOf(WidgetExerciseAction.TOKEN to undo))),TextStyle(color = accent,fontSize = 14.sp),maxLines = 2)
                  else if(snapshot.configuration.mode == "Today" && !expanded) Text(label("View Agenda (${snapshot.total})"),GlanceModifier.fillMaxSize().clickable(agenda),TextStyle(color = accent,fontSize = 14.sp),maxLines = 2)
                  else if(next != null) copy(label("Next: ${next["name"]}"),true,2)
                }
                refresh()
                val token = snapshot.retryToken ?: snapshot.doneToken
                if(token != null) action(label(if(snapshot.retryToken != null)"Retry" else "Done"),if(preview)openRoutine else actionRunCallback<WidgetExerciseAction>(actionParametersOf(WidgetExerciseAction.TOKEN to token)),
                  GlanceModifier.width((80*fontScale.coerceAtLeast(1f)).dp).height((48*fontScale.coerceAtLeast(1f)).dp).semantics { contentDescription = label(if(snapshot.retryToken != null)"Retry the same action" else "Mark as done") + ": " + (step?.get("name") as? String).orEmpty() },false)
              }
            }
            }
          }
          if((expanded || session == null && snapshot.configuration.routineId == null) && snapshot.configuration.mode == "Today") {
            Column(GlanceModifier.fillMaxWidth().defaultWeight()) {
            Spacer(GlanceModifier.height(8.dp)); copy(label("Today's reminders"),true)
            @Composable fun item(reminder: Map<String,Any?>) {
              Column(GlanceModifier.fillMaxWidth().height(68.dp).padding(8.dp).clickable(actionStartActivity(widgetOpen(context,"reminder/${reminder["id"]}")))) {
                copy(reminder["title"] as? String ?: "")
                Text(WidgetText.reminder(context,reminder),style = TextStyle(color = if(reminder["overdue"] == true)ColorProvider(Color(roles.warning)) else muted,fontSize = 14.sp),maxLines = 1)
              }
            }
            if(staticCollections) Column(GlanceModifier.fillMaxWidth().defaultWeight()) { snapshot.reminders.take(if(session == null)4 else 1).forEach { item(it) } }
            else androidx.glance.appwidget.lazy.LazyColumn(GlanceModifier.fillMaxWidth().defaultWeight()) { snapshot.reminders.forEach { row -> item { item(row) } } }
            if(snapshot.reminders.isEmpty()) copy(label("No reminders for today."),true)
            Row(GlanceModifier.fillMaxWidth()) { Text(label("View Agenda (${snapshot.total})"),GlanceModifier.defaultWeight().height(48.dp).clickable(agenda),TextStyle(color = accent,fontSize = 16.sp)); if(session == null)refresh() }
            }
          } else if(expanded && snapshot.configuration.mode == "Routine" && steps.any { it !== step && it["completed"] != true }) {
            Column(GlanceModifier.fillMaxWidth().defaultWeight()) {
            Spacer(GlanceModifier.height(12.dp))
            @Composable fun upcoming(row: Map<String,Any?>) {
              val destination = snapshot.configuration.routineId?.let { id -> actionStartActivity(widgetOpen(context,"routine-session?id=${Uri.encode(id)}&date=${snapshot.date}&stepId=${Uri.encode(row["id"].toString())}")) } ?: openRoutine
              Column(GlanceModifier.fillMaxWidth().height(64.dp).padding(8.dp).clickable(destination)) { copy(row["name"] as? String ?: ""); copy(row["target"] as? String ?: "",true) }
            }
            if(staticCollections) Column { steps.filter { it !== step && it["completed"] != true }.take(2).forEach { upcoming(it) } }
            else androidx.glance.appwidget.lazy.LazyColumn(GlanceModifier.fillMaxWidth().defaultWeight()) { steps.filter { it !== step && it["completed"] != true }.forEach { row -> item { upcoming(row) } } }
            }
          }
        }
      }
    }
  }
}

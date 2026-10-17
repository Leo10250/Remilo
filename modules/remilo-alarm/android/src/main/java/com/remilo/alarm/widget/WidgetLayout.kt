package com.remilo.alarm.widget

import android.appwidget.AppWidgetManager
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
  val outcome = label(when(state) { "Rest" -> "Rest day"; "Paused" -> "Paused"; "Skipped" -> "Skipped today"; "Completed" -> "Completed today"; "Upcoming" -> "Not started yet"; "NotCompleted" -> "Not completed"; "PartiallyCompleted" -> "Partially completed"; else -> "$done of $total done" })
  val minimumHeight = (24 + 210*fontScale.coerceAtLeast(1f)).dp
  val summary = size.width < 300.dp || size.height < maxOf(240.dp,minimumHeight) || fontScale >= 1.6f || fontScale > 1.2f && size.height < 440.dp
  val expanded = size.height >= 440.dp && fontScale <= 1.2f
  val selected = snapshot.configuration.routineId != null
  val activeExercise = step != null && session?.get("ended") != true && state !in setOf("Rest","Skipped","Upcoming","Paused")
  val actionHeight = (48*fontScale.coerceAtLeast(1f)).dp
  val primaryHeight = (56*fontScale.coerceAtLeast(1f)).dp
  @Composable fun copy(text: String, supporting: Boolean = false, lines: Int = 1, font: Int = if(supporting)14 else 16, modifier: GlanceModifier = GlanceModifier, medium: Boolean = false) {
    Text(text,modifier,TextStyle(color = if(supporting)muted else ink,fontSize = font.sp,fontWeight = if(medium)FontWeight.Medium else FontWeight.Normal),maxLines = lines)
  }
  @Composable fun refresh() {
    if(!snapshot.locked) Image(ImageProvider(com.remilo.alarm.R.drawable.ic_widget_refresh),label("Refresh"),
      GlanceModifier.size(actionHeight).padding((actionHeight - 20.dp)/2).then(if(preview)GlanceModifier else GlanceModifier.clickable(actionRunCallback<WidgetRefreshAction>())),colorFilter = ColorFilter.tint(muted))
  }
  @Composable fun action(text: String, callback: Action, modifier: GlanceModifier, primary: Boolean = false, description: String = text) {
    // Center an intrinsic-height label; do not stretch a TextView inside the action viewport.
    Box(modifier.then(if(primary) GlanceModifier.background(ImageProvider(com.remilo.alarm.R.drawable.widget_row_single),colorFilter = ColorFilter.tint(accent)) else GlanceModifier)
      .then(if(preview)GlanceModifier else GlanceModifier.clickable(callback)).padding(horizontal = 8.dp)
      .semantics { contentDescription = description },contentAlignment = Alignment.Center) {
      Text(text,style = TextStyle(color = if(primary)onAccent else accent,fontSize = 16.sp,fontWeight = FontWeight.Medium),maxLines = 1)
    }
  }
  @Composable fun footer() {
    Row(GlanceModifier.fillMaxWidth().height(actionHeight),verticalAlignment = Alignment.Vertical.CenterVertically) {
      val undo = snapshot.undoToken
      val next = steps.dropWhile { it !== step }.drop(1).firstOrNull { it["completed"] != true }
      Box(GlanceModifier.defaultWeight().fillMaxHeight()
        .then(when { preview -> GlanceModifier; undo != null -> GlanceModifier.clickable(actionRunCallback<WidgetExerciseAction>(actionParametersOf(WidgetExerciseAction.TOKEN to undo)))
          snapshot.configuration.mode == "Today" -> GlanceModifier.clickable(agenda); else -> GlanceModifier }),contentAlignment = Alignment.CenterStart) {
        when {
          undo != null -> Text(label("Undo ${snapshot.undoName.orEmpty()}"),style = TextStyle(color = accent,fontSize = 14.sp),maxLines = 2)
          snapshot.configuration.mode == "Today" -> Text(label("View Agenda (${snapshot.total})"),style = TextStyle(color = accent,fontSize = 14.sp),maxLines = 1)
          snapshot.notice != null -> copy(label(snapshot.notice),true,2)
          next != null && activeExercise -> copy(label("Next: ${next["name"]}"),true)
        }
      }
      refresh()
      val token = snapshot.retryToken ?: snapshot.doneToken
      if(token != null && selected && (activeExercise || snapshot.retryToken != null)) action(label(if(snapshot.retryToken != null)"Retry" else "Done"),
        actionRunCallback<WidgetExerciseAction>(actionParametersOf(WidgetExerciseAction.TOKEN to token)),
        GlanceModifier.width((64*fontScale.coerceAtLeast(1f)).dp).fillMaxHeight(),
        description = label(if(snapshot.retryToken != null)"Retry the same action" else "Mark as done") + ": " + (step?.get("name") as? String).orEmpty())
    }
  }
  @Composable fun reminder(row: Map<String,Any?>) {
    Column(GlanceModifier.fillMaxWidth().height(68.dp).padding(vertical = 8.dp)
      .then(if(preview)GlanceModifier else GlanceModifier.clickable(actionStartActivity(widgetOpen(context,"reminder/${row["id"]}"))))) {
      copy(row["title"] as? String ?: "",medium = true)
      Text(WidgetText.reminder(context,row),style = TextStyle(color = if(row["overdue"] == true)ColorProvider(Color(roles.warning)) else muted,fontSize = 14.sp),maxLines = 1)
    }
  }
  Column(GlanceModifier.fillMaxSize().appWidgetBackground().background(ColorProvider(Color(roles.surface)))
    .cornerRadius(android.R.dimen.system_app_widget_background_radius).padding(if(summary && fontScale >= 1.6f)8.dp else 12.dp)
    .then(if(!preview && summary && snapshot.configured && !snapshot.locked && !snapshot.failed) GlanceModifier.clickable(if(selected) if(session == null)setup else openRoutine else agenda) else GlanceModifier)
    .semantics { contentDescription = if(snapshot.locked) label("Unlock to view Remilo.") else "$title, $date, " + if(selected)outcome else label("${snapshot.total} reminders") }) {
    if(summary && snapshot.configured && !snapshot.locked && !snapshot.failed) {
      if(fontScale < 1.6f) copy(date,true)
      copy(title)
      copy(if(session != null) if(state in setOf("Rest","Paused","Skipped","Completed","Upcoming","NotCompleted","PartiallyCompleted"))outcome else "$done/$total"
        else if(selected)label("Choose routine") else label(if(snapshot.total == 0)"No reminders for today." else "${snapshot.total} reminders"),true)
    } else {
      Row(GlanceModifier.fillMaxWidth(),verticalAlignment = Alignment.Vertical.CenterVertically) {
        Image(ImageProvider(com.remilo.alarm.R.drawable.ic_remilo_notification),null,GlanceModifier.size(20.dp),colorFilter = ColorFilter.tint(muted))
        copy("Remilo",true,modifier = GlanceModifier.defaultWeight().padding(start = 6.dp)); copy(date,true)
      }
      Spacer(GlanceModifier.height(8.dp))
      when {
        snapshot.locked -> copy(label("Unlock to view Remilo."),lines = 2)
        snapshot.failed -> { copy(label(snapshot.notice ?: "Could not load the widget. Refresh to try again."),lines = 2); refresh() }
        !snapshot.configured -> action(label("Choose what to show"),setup,GlanceModifier.fillMaxWidth().height(primaryHeight),true)
        else -> {
          if(selected) {
            // One surface; fixed content followed by a separately measured footer/list region.
            Column(GlanceModifier.fillMaxWidth()) {
              copy(title,font = 22,medium = true)
              Spacer(GlanceModifier.height(12.dp))
              if(session == null) {
                copy(label("Choose a routine to show its progress."),true,2)
                Spacer(GlanceModifier.height(16.dp))
                action(label("Choose routine"),setup,GlanceModifier.fillMaxWidth().height(primaryHeight),true)
              } else {
                if(total > 0) {
                  Row(GlanceModifier.fillMaxWidth(),verticalAlignment = Alignment.Vertical.CenterVertically) {
                    Box(GlanceModifier.defaultWeight().padding(end = 8.dp)) { WidgetRoutineProgress(done,total,accent,ColorProvider(Color(roles.outline))) }
                    copy(label("$done of $total done"),true)
                  }
                  Spacer(GlanceModifier.height(16.dp))
                }
                Row(GlanceModifier.fillMaxWidth(),verticalAlignment = Alignment.Vertical.CenterVertically) {
                  Column(GlanceModifier.defaultWeight().padding(end = 12.dp)
                    .then(if(preview)GlanceModifier else GlanceModifier.clickable(openRoutine))) {
                    copy(if(activeExercise)step!!["name"] as? String ?: "" else outcome,font = 18,medium = true)
                    if(activeExercise) (step!!["target"] as? String)?.takeIf { it.isNotEmpty() }?.let { copy(it,true) }
                    else if(state == "Rest") copy(label("No exercises scheduled today."),true,2)
                  }
                  action(label(if(activeExercise)"Resume" else "View routine"),openRoutine,
                    GlanceModifier.width(((if(activeExercise)104 else 128)*fontScale.coerceAtLeast(1f)).dp).height(primaryHeight),activeExercise)
                }
              }
              Spacer(GlanceModifier.height(8.dp))
            }
          } else {
            copy(title,font = 22,medium = true)
            Spacer(GlanceModifier.height(12.dp))
          }
          // List space is bounded ABOVE the footer. Compact Today shows exactly one full row.
          if(snapshot.configuration.mode == "Today" && (!selected || expanded)) {
            Column(GlanceModifier.fillMaxWidth().defaultWeight()) {
              if(selected) copy(label("Today's reminders"),true)
              if(snapshot.reminders.isEmpty()) {
                copy(label("No reminders for today."),lines = 2)
                if(!selected) copy(label("Today's and overdue reminders will appear here."),true,2)
              } else if(!expanded) reminder(snapshot.reminders.first())
              else if(staticCollections) Column { snapshot.reminders.take(if(selected)2 else 4).forEach { reminder(it) } }
              else androidx.glance.appwidget.lazy.LazyColumn(GlanceModifier.fillMaxSize()) { snapshot.reminders.forEach { row -> item { reminder(row) } } }
            }
          } else if(expanded && snapshot.configuration.mode == "Routine") {
            Column(GlanceModifier.fillMaxWidth().defaultWeight()) {
              @Composable fun upcoming(row: Map<String,Any?>) {
                val destination = snapshot.configuration.routineId?.let { id -> actionStartActivity(widgetOpen(context,"routine-session?id=${Uri.encode(id)}&date=${snapshot.date}&stepId=${Uri.encode(row["id"].toString())}")) } ?: openRoutine
                Column(GlanceModifier.fillMaxWidth().height(64.dp).padding(vertical = 8.dp).then(if(preview)GlanceModifier else GlanceModifier.clickable(destination))) {
                  copy(row["name"] as? String ?: ""); copy(row["target"] as? String ?: "",true)
                }
              }
              val remaining = steps.filter { it !== step && it["completed"] != true }.takeIf { activeExercise }.orEmpty()
              if(staticCollections) Column { remaining.take(2).forEach { upcoming(it) } }
              else androidx.glance.appwidget.lazy.LazyColumn(GlanceModifier.fillMaxSize()) { remaining.forEach { row -> item { upcoming(row) } } }
            }
          }
          footer()
        }
      }
    }
  }
}

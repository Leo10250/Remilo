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
import androidx.glance.appwidget.components.CircleIconButton
import androidx.glance.layout.*
import androidx.glance.text.*
import androidx.glance.unit.ColorProvider
import androidx.glance.semantics.semantics
import androidx.glance.semantics.contentDescription
import com.remilo.alarm.presentation.AtmosphereTokens
import com.remilo.alarm.presentation.L10n
import com.remilo.alarm.presentation.NativeMessages

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
  val weekday = WidgetText.weekday(context,snapshot.date)
  val fullDate = WidgetText.date(context,snapshot.date)
  val state = session?.get("state") as? String
  val title = session?.get("title") as? String ?: label(if(snapshot.configuration.routineId != null) "Routine unavailable" else "Today's reminders")
  val total = (session?.get("totalCount") as? Number)?.toInt()?.coerceAtLeast(0) ?: 0
  val done = ((session?.get("completedCount") as? Number)?.toInt() ?: 0).coerceIn(0,total)
  val outcome = label(when(state) { "Rest" -> "Rest day"; "Paused" -> "Paused"; "Skipped" -> "Skipped today"; "Completed" -> "Completed today"; "Upcoming" -> "Not started yet"; "NotCompleted" -> "Not completed"; "PartiallyCompleted" -> "Partially completed"; else -> "$done of $total done" })
  val feedback = snapshot.actionFeedback
  val busy = feedback?.busy == true
  val hasRecovery = snapshot.retryToken != null || snapshot.notice != null
  val expanded = size.height >= 440.dp && fontScale <= 1.2f
  val hasFooter = hasRecovery || snapshot.configuration.mode == "Today"
  val minimumHeight = WidgetSizing.minimumHeight(context,snapshot,fontScale).dp
  val minimumWidth = WidgetSizing.minimumWidth(snapshot,fontScale).dp
  val summary = size.width < minimumWidth || size.height < maxOf(WidgetSizing.compactHeight(snapshot).dp,minimumHeight) || fontScale >= 1.6f || fontScale > 1.2f && size.height < 440.dp
  val selected = snapshot.configuration.routineId != null
  val activeExercise = step != null && session?.get("ended") != true && state !in setOf("Rest","Skipped","Upcoming","Paused")
  val nextStep = widgetNextExercise(snapshot)
  val nextLabel = nextStep?.let { L10n.text(context,NativeMessages.widget_next(it["name"] as? String ?: "")) }
  val bottomActions = !expanded && bottomAlignedFocusActions(snapshot)
  val actionHeight = (48*fontScale.coerceAtLeast(1f)).dp
  val primaryHeight = (56*fontScale.coerceAtLeast(1f)).dp
  @Composable fun copy(text: String, supporting: Boolean = false, lines: Int = 1, font: Int = if(supporting)14 else 16, modifier: GlanceModifier = GlanceModifier, medium: Boolean = false) {
    Text(text,modifier,TextStyle(color = if(supporting)muted else ink,fontSize = font.sp,fontWeight = if(medium)FontWeight.Medium else FontWeight.Normal),maxLines = lines)
  }
  @Composable fun action(text: String, callback: Action, modifier: GlanceModifier, primary: Boolean = false, description: String = text, enabled: Boolean = true) {
    // Center an intrinsic-height label; do not stretch a TextView inside the action viewport.
    Box(modifier.then(if(primary) GlanceModifier.background(ImageProvider(com.remilo.alarm.R.drawable.widget_row_single),colorFilter = ColorFilter.tint(if(enabled)accent else ColorProvider(Color(roles.disabledSurface)))) else GlanceModifier)
      .then(if(preview || !enabled)GlanceModifier else GlanceModifier.clickable(callback)).padding(horizontal = 8.dp)
      .semantics { contentDescription = description },contentAlignment = Alignment.Center) {
      Text(text,style = TextStyle(color = if(!enabled)ColorProvider(Color(roles.disabledInk)) else if(primary)onAccent else accent,fontSize = 16.sp,fontWeight = FontWeight.Medium),maxLines = 1)
    }
  }
  @Composable fun undoControl() {
    val token = snapshot.undoToken
    val description = label(if(token != null)"Undo completion of ${snapshot.undoName.orEmpty()}" else "Undo unavailable")
    if(preview || busy || token == null || snapshot.retryToken != null) {
      AndroidRemoteViews(android.widget.RemoteViews(context.packageName,com.remilo.alarm.R.layout.widget_undo_disabled).apply {
        setBoolean(com.remilo.alarm.R.id.widget_undo_disabled,"setEnabled",false)
        setContentDescription(com.remilo.alarm.R.id.widget_undo_disabled,description)
        // The disabled glyph is the same neutral ink at 38% opacity, not the
        // opaque disabled text role intended for a different container.
        setInt(com.remilo.alarm.R.id.widget_undo_disabled,"setColorFilter",roles.onSurfaceVariant.toInt())
        setInt(com.remilo.alarm.R.id.widget_undo_disabled,"setImageAlpha",
          if(preview && token != null && !busy && snapshot.retryToken == null)255 else 97)
      },GlanceModifier.size(actionHeight))
    } else CircleIconButton(imageProvider = ImageProvider(com.remilo.alarm.R.drawable.widget_undo_frame),
      contentDescription = description,
      onClick = actionRunCallback<WidgetExerciseAction>(actionParametersOf(WidgetExerciseAction.TOKEN to token.orEmpty())),
      modifier = GlanceModifier.size(actionHeight),
      backgroundColor = null, contentColor = muted)
  }
  @Composable fun exerciseText() {
    Column(GlanceModifier.fillMaxWidth().then(if(preview)GlanceModifier else GlanceModifier.clickable(openRoutine))
      .semantics { contentDescription = if(activeExercise)listOfNotNull(feedback?.confirmation?.let(::label),
        label("Exercise ${steps.indexOf(step) + 1} of $total"),step!!["name"],step["target"]).joinToString(". ") else outcome }) {
      if(activeExercise) copy(step!!["name"] as? String ?: "",font = 18,medium = true,lines = if(expanded)2 else 1)
      else copy(outcome,font = 18,medium = true,lines = 2)
      if(activeExercise) (step!!["target"] as? String)?.takeIf { it.isNotEmpty() }?.let { copy(it,true) }
      else if(state == "Rest") copy(label("No exercises scheduled today."),true,2)
    }
  }
  @Composable fun footer() {
    val agendaAtEnd = selected && snapshot.configuration.mode == "Today" && !hasRecovery
    Row(GlanceModifier.fillMaxWidth().height(actionHeight),verticalAlignment = Alignment.Vertical.CenterVertically) {
      Box(GlanceModifier.defaultWeight().fillMaxHeight()
        .then(when { preview -> GlanceModifier
          !agendaAtEnd && !hasRecovery && snapshot.configuration.mode == "Today" -> GlanceModifier.clickable(agenda); else -> GlanceModifier }),contentAlignment = Alignment.CenterStart) {
        when {
          snapshot.notice != null -> copy(label(snapshot.notice),true,2)
          snapshot.retryToken != null -> copy(label("Retry the same action"),true,2)
          !agendaAtEnd && snapshot.configuration.mode == "Today" -> Text(label("View Agenda (${snapshot.total})"),style = TextStyle(color = accent,fontSize = 14.sp),maxLines = 1)
        }
      }
      // Retry always binds the captured operation, never the newly displayed exercise.
      val retry = snapshot.retryToken
      if(retry != null) action(label("Retry"),actionRunCallback<WidgetExerciseAction>(actionParametersOf(WidgetExerciseAction.TOKEN to retry)),
        GlanceModifier.width((80*fontScale.coerceAtLeast(1f)).dp).fillMaxHeight(),description = label("Retry the same action"))
      else if(snapshot.notice != null) action(label("Refresh"),actionRunCallback<WidgetRefreshAction>(),GlanceModifier.width((88*fontScale.coerceAtLeast(1f)).dp).fillMaxHeight())
      else if(agendaAtEnd) Box(GlanceModifier.fillMaxHeight().padding(start = 8.dp)
        .then(if(preview)GlanceModifier else GlanceModifier.clickable(agenda)),contentAlignment = Alignment.CenterEnd) {
        Text(label("View Agenda (${snapshot.total})"),style = TextStyle(color = accent,fontSize = 14.sp),maxLines = 1)
      }
    }
  }
  @Composable fun reminder(row: Map<String,Any?>) {
    Column(GlanceModifier.fillMaxWidth().height(WidgetSizing.reminderHeight(context,fontScale,expanded).dp).padding(vertical = 8.dp)
      .then(if(preview)GlanceModifier else GlanceModifier.clickable(actionStartActivity(widgetOpen(context,"reminder/${row["id"]}"))))) {
      copy(row["title"] as? String ?: "",medium = true)
      Text(WidgetText.reminder(context,row),style = TextStyle(color = if(row["overdue"] == true)ColorProvider(Color(roles.warning)) else muted,fontSize = 14.sp),maxLines = 1)
    }
  }
  Column(GlanceModifier.fillMaxSize().appWidgetBackground().background(ColorProvider(Color(roles.surface)))
    .cornerRadius(android.R.dimen.system_app_widget_background_radius).padding(if(summary && fontScale >= 1.6f)8.dp else 12.dp)
    .then(if(!preview && summary && !snapshot.locked) GlanceModifier.clickable(when {
      snapshot.retryToken != null -> actionRunCallback<WidgetExerciseAction>(actionParametersOf(WidgetExerciseAction.TOKEN to snapshot.retryToken))
      snapshot.failed || snapshot.notice != null -> actionRunCallback<WidgetRefreshAction>(); !snapshot.configured -> setup; selected -> if(session == null)setup else openRoutine; else -> agenda }) else GlanceModifier)
    .semantics { contentDescription = when { snapshot.locked -> label("Unlock to view Remilo."); snapshot.retryToken != null -> "$title, $fullDate, " + label("Retry the same action"); snapshot.failed -> label(snapshot.notice ?: "Could not load the widget. Refresh to try again."); else -> "$title, $fullDate, " + if(selected)outcome else label("${snapshot.total} reminders") } }) {
    if(summary && (snapshot.locked || snapshot.failed || !snapshot.configured)) {
      if(fontScale < 1.2f) copy("Remilo",medium = true)
      copy(label(when { snapshot.locked -> "Unlock to view Remilo."; snapshot.failed -> "Could not load the widget. Refresh to try again."; else -> "Choose what to show" }),true,if(fontScale >= 1.2f)2 else 3)
    } else if(summary && (snapshot.retryToken != null || snapshot.notice != null)) {
      copy(title)
      copy(label(if(snapshot.retryToken != null)"Retry the same action" else "This view changed. Review the refreshed routine."),true,2)
    } else if(summary) {
      if(fontScale < 1.6f) copy(weekday,true)
      copy(title)
      copy(if(session != null) if(state in setOf("Rest","Paused","Skipped","Completed","Upcoming","NotCompleted","PartiallyCompleted"))outcome else "$done/$total"
        else if(selected)label("Choose routine") else label(if(snapshot.total == 0)"No reminders for today." else "${snapshot.total} reminders"),true)
    } else {
      Row(GlanceModifier.fillMaxWidth(),verticalAlignment = Alignment.Vertical.CenterVertically) {
          Image(ImageProvider(com.remilo.alarm.R.drawable.ic_remilo_notification),null,GlanceModifier.size(20.dp),colorFilter = ColorFilter.tint(muted))
          copy("Remilo",true,modifier = GlanceModifier.defaultWeight().padding(start = 6.dp))
        copy(weekday,true)
      }
      Spacer(GlanceModifier.height(if(selected && !expanded)4.dp else 8.dp))
      when {
        snapshot.locked -> copy(label("Unlock to view Remilo."),lines = 2)
        snapshot.failed -> {
          copy(label(snapshot.notice ?: "Could not load the widget. Refresh to try again."),lines = 2)
          action(label("Refresh"),actionRunCallback<WidgetRefreshAction>(),GlanceModifier.fillMaxWidth().height(actionHeight))
        }
        !snapshot.configured -> action(label("Choose what to show"),setup,GlanceModifier.fillMaxWidth().height(primaryHeight),true)
        else -> {
          if(selected) {
            // One surface; fixed content followed by a separately measured footer/list region.
            Column(GlanceModifier.fillMaxWidth()) {
              copy(title,font = 22,medium = true)
              Spacer(GlanceModifier.height(if(expanded)12.dp else 4.dp))
              if(session == null) {
                copy(label("Choose a routine to show its progress."),true,2)
                Spacer(GlanceModifier.height(16.dp))
                action(label("Choose routine"),setup,GlanceModifier.fillMaxWidth().height(primaryHeight),true)
              } else {
                if(total > 0) {
                  Row(GlanceModifier.fillMaxWidth(),verticalAlignment = Alignment.Vertical.CenterVertically) {
                    Box(GlanceModifier.defaultWeight().padding(end = 8.dp)) { WidgetRoutineProgress(done,total,roles.primary,roles.container) }
                    Box(GlanceModifier.size(16.dp).padding(end = 2.dp)) {
                      if(feedback?.confirmation != null) Image(ImageProvider(com.remilo.alarm.R.drawable.widget_check),label(feedback.confirmation),GlanceModifier.fillMaxSize(),colorFilter = ColorFilter.tint(accent))
                    }
                    copy(label("$done of $total done"),true)
                  }
                  Spacer(GlanceModifier.height(if(expanded)16.dp else 12.dp))
                }
                Row(GlanceModifier.fillMaxWidth(),verticalAlignment = if(bottomActions)Alignment.Vertical.Bottom else Alignment.Vertical.CenterVertically) {
                  Column(GlanceModifier.defaultWeight().padding(end = 12.dp)) {
                    if(bottomActions) {
                      Box(GlanceModifier.fillMaxWidth().height(WidgetSizing.currentTextHeight(context,fontScale).dp),contentAlignment = Alignment.CenterStart) { exerciseText() }
                      Spacer(GlanceModifier.height(2.dp))
                      Box(GlanceModifier.fillMaxWidth().height(WidgetSizing.nextLineHeight(context,snapshot,fontScale).dp),contentAlignment = Alignment.CenterStart) {
                        if(nextStep != null) copy(nextLabel.orEmpty(),true,
                          modifier = GlanceModifier.fillMaxWidth().semantics { contentDescription = nextLabel.orEmpty() })
                      }
                    } else exerciseText()
                  }
                  Row(GlanceModifier.then(if(bottomActions)GlanceModifier.height(primaryHeight) else GlanceModifier),verticalAlignment = Alignment.Vertical.CenterVertically) {
                    if(activeExercise) {
                      undoControl(); Spacer(GlanceModifier.width(8.dp))
                      Box(GlanceModifier.width((80*fontScale.coerceAtLeast(1f)).dp).height(primaryHeight)) {
                        snapshot.doneToken?.takeIf { snapshot.retryToken == null }?.let { token -> action(label(if(feedback?.saving == true)"Saving…" else "Done"),
                          actionRunCallback<WidgetExerciseAction>(actionParametersOf(WidgetExerciseAction.TOKEN to token)),
                          GlanceModifier.fillMaxSize(),true,
                          label(if(busy)"Saving progress" else "Mark ${step!!["name"]} as done"),enabled = !busy) }
                      }
                    } else if(snapshot.undoToken != null && snapshot.retryToken == null) {
                      undoControl()
                      // Keep Undo in its established slot after the final completion.
                      Spacer(GlanceModifier.width((8 + 80*fontScale.coerceAtLeast(1f)).dp))
                    }
                    else action(label("View routine"),openRoutine,
                      GlanceModifier.width((128*fontScale.coerceAtLeast(1f)).dp).height(primaryHeight))
                  }
                }
              }
              if((hasFooter || expanded) && !bottomActions) Spacer(GlanceModifier.height(8.dp))
            }
          } else {
            copy(title,font = 22,medium = true)
            Spacer(GlanceModifier.height(12.dp))
          }
          // List space is bounded ABOVE the footer. Compact Today shows exactly one full row.
          if(snapshot.configuration.mode == "Today" && (!selected || expanded)) {
            Column(GlanceModifier.fillMaxWidth().defaultWeight()) {
              if(selected && expanded && nextStep != null) {
                copy(nextLabel.orEmpty(),true); Spacer(GlanceModifier.height(8.dp))
              }
              if(selected) copy(label("Today's reminders"),true)
              if(snapshot.reminders.isEmpty()) {
                copy(label("No reminders for today."),lines = 2)
                if(!selected) copy(label("Today's and overdue reminders will appear here."),true,2)
              } else if(!expanded) reminder(snapshot.reminders.first())
              else if(staticCollections) Column { snapshot.reminders.take(if(selected)1 else 4).forEach { reminder(it) } }
              else androidx.glance.appwidget.lazy.LazyColumn(GlanceModifier.fillMaxSize()) { snapshot.reminders.forEach { row -> item { reminder(row) } } }
            }
          } else if(expanded && snapshot.configuration.mode == "Routine") {
            Column(GlanceModifier.fillMaxWidth().defaultWeight()) {
              @Composable fun upcoming(row: Map<String,Any?>) {
                val destination = snapshot.configuration.routineId?.let { id -> actionStartActivity(widgetOpen(context,"routine-session?id=${Uri.encode(id)}&date=${snapshot.date}&stepId=${Uri.encode(row["id"].toString())}")) } ?: openRoutine
                Column(GlanceModifier.fillMaxWidth().height(64.dp).padding(vertical = 8.dp).then(if(preview)GlanceModifier else GlanceModifier.clickable(destination))) {
                  val next = row === nextStep
                  copy(if(next) nextLabel.orEmpty() else row["name"] as? String ?: "",supporting = next)
                  copy(row["target"] as? String ?: "",true)
                }
              }
              val remaining = steps.filter { it !== step && it["completed"] != true }.takeIf { activeExercise }.orEmpty()
              if(staticCollections) Column { remaining.take(2).forEach { upcoming(it) } }
              else androidx.glance.appwidget.lazy.LazyColumn(GlanceModifier.fillMaxSize()) { remaining.forEach { row -> item { upcoming(row) } } }
            }
          }
          if(hasFooter) footer()
        }
      }
    }
  }
}

package com.remilo.alarm.widget

import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.unit.DpSize
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
import androidx.compose.ui.graphics.Color
import com.remilo.alarm.presentation.AtmosphereTokens
import com.remilo.alarm.presentation.L10n
import com.remilo.alarm.system.PresentationLanguage
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import java.util.Locale

class RemiloWidget(private val load: suspend (Context, Int) -> WidgetSnapshot = { context, number ->
  widgetRequest(context) { it.widgetSnapshot(number, WidgetWork.supported(context, number)) }
}) : GlanceAppWidget() {
  override val sizeMode = SizeMode.Responsive(setOf(DpSize(180.dp,110.dp), DpSize(300.dp,280.dp), DpSize(300.dp,440.dp)))
  override suspend fun provideGlance(context: Context, id: GlanceId) {
    val number = GlanceAppWidgetManager(context).getAppWidgetId(id)
    val snapshot = try { load(context,number) }
      catch (_: Exception) { WidgetSnapshot(number, notice = "Could not load the widget. Refresh to try again.", failed = true) }
    val projection = WidgetPresentation.publish(snapshot.copy(id = number,fontScale = context.resources.configuration.fontScale))
    provideContent {
      val current by projection.collectAsState()
      WidgetContent(current,fontScale = current.fontScale)
    }
  }
  override val previewSizeMode = SizeMode.Responsive(setOf(DpSize(180.dp,110.dp), DpSize(300.dp,280.dp)))
  override suspend fun providePreview(context: Context, widgetCategory: Int) {
    val fontScale = context.resources.configuration.fontScale
    provideContent { WidgetContent(previewSnapshot(), true, fontScale) }
  }
}

internal fun previewSnapshot() = WidgetSnapshot(-1, WidgetConfiguration("Today", "preview"), "2026-10-12",
  session = mapOf("title" to "Routine", "state" to "InProgress", "date" to "2026-10-12", "completedCount" to 1, "totalCount" to 4,
    "steps" to listOf(
      mapOf("name" to "Bird-dog", "target" to "3 × 10", "completed" to true),
      mapOf("name" to "Front plank", "target" to "3 × 40 s", "completed" to false),
      mapOf("name" to "Side plank", "target" to "3 × 25 s / side", "completed" to false),
      mapOf("name" to "Intervals", "target" to "8 intervals", "completed" to false))), doneToken = "preview")

/** Same production composition for setup and host render verification, with inert controls. */
internal class WidgetRender(private val snapshot: WidgetSnapshot, private val preview: Boolean = true) : GlanceAppWidget() {
  override val sizeMode = SizeMode.Exact
  override suspend fun provideGlance(context: Context, id: GlanceId) {
    val fontScale = context.resources.configuration.fontScale
    provideContent { WidgetContent(snapshot, preview, fontScale, staticCollections = true) }
  }
}

internal fun widgetOpen(context: Context, path: String): Intent = Intent(Intent.ACTION_VIEW, Uri.parse("remilo://$path"))
  .setPackage(context.packageName).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)

@Composable
internal fun WidgetContent(snapshot: WidgetSnapshot, preview: Boolean = false, fontScale: Float = 1f, staticCollections: Boolean = preview) {
  val context = LocalContext.current
  val size = LocalSize.current
  val roles = AtmosphereTokens.colors(snapshot.appearance.atmosphere, snapshot.appearance.brightness)
  val ink = ColorProvider(Color(roles.onSurface)); val supporting = ColorProvider(Color(roles.onSurfaceVariant))
  val primary = ColorProvider(Color(roles.primary)); val onPrimary = ColorProvider(Color(roles.onPrimary))
  fun label(text: String) = L10n.text(context, text)
  val openAgenda = actionStartActivity(widgetOpen(context, ""))
  val setup = actionStartActivity(Intent(context, WidgetConfigureActivity::class.java).putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, snapshot.id))
  val session = snapshot.session?.takeUnless { it["deleted"] == true }
  val routineRoute = snapshot.configuration.routineId?.let { "routine-session?id=${Uri.encode(it)}&date=${snapshot.date}" }
  val openRoutine = routineRoute?.let { actionStartActivity(widgetOpen(context, it)) } ?: setup
  val compact = size.width < 300.dp || size.height < 280.dp || fontScale >= 1.6f || fontScale > 1.2f && size.height < 440.dp
  val date = runCatching { LocalDate.parse(snapshot.date).format(DateTimeFormatter.ofPattern("MMM d · EEE")
    .withLocale(PresentationLanguage.context(context).resources.configuration.locales[0] ?: Locale.ENGLISH)) }.getOrDefault("")
  @Composable fun copy(text: String, muted: Boolean = false, lines: Int = Int.MAX_VALUE) {
    Text(text, style = TextStyle(color = if (muted) supporting else ink, fontSize = if (muted) 14.sp else 16.sp), maxLines = lines)
  }
  if (compact && snapshot.configured && !snapshot.locked && !snapshot.failed) {
    val shortDate = runCatching { LocalDate.parse(snapshot.date).format(DateTimeFormatter.ofPattern(if (fontScale >= 1.6f) "M/d" else "MMM d",
      PresentationLanguage.context(context).resources.configuration.locales[0])) }.getOrDefault("")
    val summary = if (session == null && snapshot.configuration.routineId != null) label("Routine unavailable")
      else if (session == null) label("${snapshot.total} reminders") else label(when (session["state"]) {
      "Rest" -> "Rest day"; "Paused" -> "Paused"; "Skipped" -> "Skipped"; "Completed" -> "Completed"
      else -> "${session["completedCount"]}/${session["totalCount"]}" })
    Column(GlanceModifier.fillMaxSize().appWidgetBackground().background(ColorProvider(Color(roles.canvas)))
      .cornerRadius(android.R.dimen.system_app_widget_background_radius).padding(if (fontScale >= 1.6f) 8.dp else 12.dp)
      .clickable(if (snapshot.configuration.routineId != null) openRoutine else openAgenda)
      .semantics { contentDescription = (session?.get("title") as? String ?: label("Today's reminders")) + ", " + date + ", " +
        if (session == null || session["state"] in setOf("Rest","Paused","Skipped","Completed")) summary else label("${session["completedCount"]} of ${session["totalCount"]} completed") }) {
      if (session != null && session["state"] in setOf("Rest","Paused","Skipped","Completed")) {
        Row(GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.Vertical.CenterVertically) {
          Text(session["title"] as? String ?: "", GlanceModifier.defaultWeight(), TextStyle(color = ink, fontSize = 16.sp), maxLines = 1)
          Text(shortDate, GlanceModifier.padding(start = 4.dp), TextStyle(color = supporting, fontSize = 14.sp), maxLines = 1)
        }
        copy(summary, lines = 1)
      } else {
        Row(GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.Vertical.CenterVertically) {
          if (fontScale < 1.6f || session == null) Image(ImageProvider(com.remilo.alarm.R.drawable.ic_remilo_notification), "Remilo", GlanceModifier.size(20.dp).padding(end = 4.dp), colorFilter = ColorFilter.tint(supporting))
          Text(shortDate, GlanceModifier.defaultWeight(), TextStyle(color = supporting, fontSize = 14.sp), maxLines = 1)
          if (session != null) Text(summary, style = TextStyle(color = supporting, fontSize = 14.sp), maxLines = 1)
        }
        copy(session?.get("title") as? String ?: summary, muted = session == null, lines = if (session == null) 2 else 1)
      }
    }
    return
  }
  Column(GlanceModifier.fillMaxSize().appWidgetBackground().background(ColorProvider(Color(roles.canvas)))
    .cornerRadius(android.R.dimen.system_app_widget_background_radius).padding(12.dp)) {
    Row(GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.Vertical.CenterVertically) {
      Column(GlanceModifier.defaultWeight().clickable(if (snapshot.configuration.mode == "Routine") openRoutine else openAgenda)) {
        copy(label(if (snapshot.configuration.mode == "Routine") "Remilo · Routine" else "Remilo · Today"), lines = 1)
        if (date.isNotEmpty()) copy(date, true, 1)
      }
      if (!preview && !snapshot.locked) {
        Image(ImageProvider(com.remilo.alarm.R.drawable.ic_widget_refresh), label("Refresh"),
          GlanceModifier.size(48.dp).padding(12.dp).clickable(actionRunCallback<WidgetRefreshAction>()), colorFilter = ColorFilter.tint(supporting))
        Image(ImageProvider(com.remilo.alarm.R.drawable.ic_widget_settings), label("Widget settings"),
          GlanceModifier.size(48.dp).padding(12.dp).clickable(setup), colorFilter = ColorFilter.tint(supporting))
      }
    }
    when {
      snapshot.locked -> copy(label("Unlock to view Remilo."))
      snapshot.failed -> copy(label(snapshot.notice ?: "Could not load the widget. Refresh to try again."))
      !snapshot.configured -> Text(label("Choose what to show"), GlanceModifier.fillMaxSize().clickable(setup), TextStyle(color = ink, fontSize = 16.sp))
      else -> {
        if (snapshot.notice != null) Text(label(snapshot.notice), style = TextStyle(color = supporting, fontSize = 14.sp), maxLines = 2)
        if (snapshot.configuration.routineId != null) {
          Column(GlanceModifier.fillMaxWidth().background(ImageProvider(com.remilo.alarm.R.drawable.widget_row_single), colorFilter = ColorFilter.tint(ColorProvider(Color(roles.surface)))).padding(8.dp).clickable(openRoutine)) {
            Row(GlanceModifier.fillMaxWidth().semantics { contentDescription = when { session == null -> label("Routine unavailable"); session["state"] == "Rest" -> label("Rest day"); else -> label("${session["completedCount"]} of ${session["totalCount"]} completed") } }) {
              Text(session?.get("title") as? String ?: label("Routine unavailable"), GlanceModifier.defaultWeight(), TextStyle(color = ink, fontSize = 16.sp), maxLines = 1)
              if (session != null && session["state"] !in setOf("Rest","Paused","Skipped")) Text("${session["completedCount"]}/${session["totalCount"]}", style = TextStyle(color = supporting, fontSize = 14.sp))
            }
            if (session != null) {
              val state = session["state"] as? String
              val total = (session["totalCount"] as? Number)?.toInt()?.coerceAtLeast(0) ?: 0
              val completed = ((session["completedCount"] as? Number)?.toInt() ?: 0).coerceIn(0, total)
              if (total > 0 && state !in setOf("Rest", "Paused", "Skipped")) {
                Spacer(GlanceModifier.height(8.dp))
                WidgetRoutineProgress(completed, total, primary, ColorProvider(Color(roles.container)))
                Spacer(GlanceModifier.height(8.dp))
              }
              if (state in setOf("Rest","Paused","Skipped","Completed","Upcoming")) copy(label(when(state) { "Rest" -> "Rest day"; "Paused" -> "Paused"; "Skipped" -> "Skipped today"; "Completed" -> "Completed today"; else -> "Not started yet" }), true, 1)
              @Suppress("UNCHECKED_CAST") val step = (session["steps"] as? List<Map<String, Any?>>)?.firstOrNull { it["completed"] != true }
              if (step != null && state !in setOf("Paused","Skipped","Rest")) {
                copy(step["name"] as? String ?: "", lines = if (size.height >= 440.dp && fontScale <= 1.2f) 2 else 1)
                (step["target"] as? String)?.takeIf { it.isNotEmpty() }?.let { copy(it,true,if(size.height >= 440.dp && fontScale <= 1.2f) 2 else 1) }
              }
            }
          }
        }
        @Composable fun reminderRow(index: Int, reminder: Map<String, Any?>) {
          val shape = when { index == 0 && index == snapshot.reminders.lastIndex -> com.remilo.alarm.R.drawable.widget_row_single
            index == 0 -> com.remilo.alarm.R.drawable.widget_row_first; index == snapshot.reminders.lastIndex -> com.remilo.alarm.R.drawable.widget_row_last; else -> com.remilo.alarm.R.drawable.widget_row_middle }
          Column(GlanceModifier.fillMaxWidth().padding(bottom = 2.dp)) {
            Row(GlanceModifier.fillMaxWidth().height(((if(size.height >= 440.dp) 104 else 64) * fontScale.coerceAtLeast(1f)).dp)
              .background(ImageProvider(shape), colorFilter = ColorFilter.tint(ColorProvider(Color(roles.surface))))
              .clickable(actionStartActivity(widgetOpen(context,"reminder/${reminder["id"]}"))).padding(8.dp)) {
              Image(ImageProvider(com.remilo.alarm.R.drawable.ic_widget_event),null,GlanceModifier.size(20.dp),colorFilter = ColorFilter.tint(supporting))
              Column(GlanceModifier.defaultWeight().padding(start = 6.dp)) {
                copy(reminder["title"] as? String ?: "",lines = if(size.height >= 440.dp) 2 else 1)
                Text(WidgetText.reminder(context,reminder),style = TextStyle(color = if(reminder["overdue"] == true) ColorProvider(Color(roles.warning)) else supporting,fontSize = 14.sp),maxLines = if(size.height >= 440.dp) 2 else 1)
              }
            }
          }
        }
        @Composable fun viewAgenda() { Text(label(if(snapshot.total > 20) "View Agenda (${snapshot.total})" else "View Agenda"),GlanceModifier.fillMaxWidth().height(48.dp).padding(vertical = 8.dp).clickable(openAgenda),TextStyle(color = primary,fontSize = 16.sp)) }
        // Keep a usable Focus/action area at enlarged text. The Today header
        // still opens Agenda; a sliver of a clipped list is not an action target.
        if (snapshot.configuration.mode == "Today" && !(fontScale > 1.2f && session != null)) {
          if (size.height >= 440.dp || session == null) Text(label("Today's reminders"),GlanceModifier.padding(top = 8.dp,bottom = 4.dp),TextStyle(color = supporting,fontSize = 14.sp))
          if (staticCollections) Column(GlanceModifier.fillMaxWidth().defaultWeight().padding(top = 2.dp)) {
            snapshot.reminders.take(if(size.height >= 440.dp) 2 else 1).forEachIndexed { index, row -> reminderRow(index,row) }
            if(snapshot.reminders.isEmpty()) copy(label("No reminders for today."),true,1)
            if((size.height >= 440.dp || session == null) && fontScale <= 1.2f) viewAgenda()
          } else androidx.glance.appwidget.lazy.LazyColumn(GlanceModifier.fillMaxWidth().defaultWeight().padding(top = 2.dp)) {
            if(snapshot.reminders.isEmpty()) item { Text(label("No reminders for today."),style = TextStyle(color = supporting,fontSize = 14.sp)) }
            snapshot.reminders.forEachIndexed { index,row -> item { reminderRow(index,row) } }
            item { viewAgenda() }
          }
        } else Spacer(GlanceModifier.defaultWeight())
        val token = snapshot.retryToken ?: snapshot.doneToken
        if (snapshot.undoToken != null) Text(label("Completed: ${snapshot.undoName.orEmpty()}"), style = TextStyle(color = supporting, fontSize = 14.sp), maxLines = 1)
        if (token != null || snapshot.undoToken != null) {
          @Composable fun completion(modifier: GlanceModifier) {
            if (token != null) Box(modifier.height((56 * fontScale.coerceAtLeast(1f)).dp)
              .background(ImageProvider(com.remilo.alarm.R.drawable.widget_row_single), colorFilter = ColorFilter.tint(primary))) {
              @Suppress("UNCHECKED_CAST") val unfinished = (session?.get("steps") as? List<Map<String, Any?>>)?.count { it["completed"] != true } ?: 0
              Button(label(if (snapshot.retryToken != null) "Retry the same action" else if (unfinished == 1) "Complete exercise" else "Complete & continue"),
                if (preview) openRoutine else actionRunCallback<WidgetExerciseAction>(actionParametersOf(WidgetExerciseAction.TOKEN to token)),
                GlanceModifier.fillMaxSize().cornerRadius(16.dp), style = TextStyle(fontSize = 16.sp), maxLines = 2,
                colors = ButtonDefaults.buttonColors(backgroundColor = ColorProvider(Color.Transparent), contentColor = onPrimary))
            }
          }
          @Composable fun undo(modifier: GlanceModifier) {
            if (snapshot.undoToken != null) Box(modifier.height((56 * fontScale.coerceAtLeast(1f)).dp)
              .background(ImageProvider(com.remilo.alarm.R.drawable.widget_row_single),colorFilter = ColorFilter.tint(ColorProvider(Color(roles.surface))))) {
              Button(label("Undo"), actionRunCallback<WidgetExerciseAction>(actionParametersOf(WidgetExerciseAction.TOKEN to snapshot.undoToken)),
                GlanceModifier.fillMaxSize().cornerRadius(16.dp).semantics { contentDescription = label("Undo ${snapshot.undoName.orEmpty()}") }, style = TextStyle(fontSize = 16.sp), maxLines = 2,
                colors = ButtonDefaults.buttonColors(backgroundColor = ColorProvider(Color.Transparent), contentColor = primary))
            }
          }
          if (fontScale > 1.2f && token != null && snapshot.undoToken != null) {
            Column(GlanceModifier.fillMaxWidth().padding(top = 8.dp)) {
              completion(GlanceModifier.fillMaxWidth())
              Spacer(GlanceModifier.height(4.dp))
              undo(GlanceModifier.fillMaxWidth())
            }
          } else Row(GlanceModifier.fillMaxWidth().padding(top = 8.dp), verticalAlignment = Alignment.Vertical.CenterVertically) {
            completion(GlanceModifier.defaultWeight())
            if (token != null && snapshot.undoToken != null) Spacer(GlanceModifier.width(4.dp))
            undo(if (token != null) GlanceModifier.width(88.dp) else GlanceModifier.fillMaxWidth())
          }
        }
      }
    }
  }
}

/** Count units, not ordinal step positions. Numeric progress remains in the header. */
@Composable
private fun WidgetRoutineProgress(completed: Int, total: Int, fill: ColorProvider, track: ColorProvider) {
  if (total <= 12) Row(GlanceModifier.fillMaxWidth().height(4.dp)) {
    repeat(total) { index ->
      if (index > 0) Spacer(GlanceModifier.width(2.dp))
      Box(GlanceModifier.defaultWeight().height(4.dp).cornerRadius(2.dp).background(if (index < completed) fill else track)) {}
    }
  } else Row(GlanceModifier.fillMaxWidth().height(4.dp).cornerRadius(2.dp).background(track)) {
    // Use the native progress component for arbitrary totals without extra RemoteViews.
    LinearProgressIndicator(progress = completed.toFloat() / total, modifier = GlanceModifier.fillMaxWidth().height(4.dp), color = fill, backgroundColor = track)
  }
}

class WidgetExerciseAction : ActionCallback {
  override suspend fun onAction(context: Context, glanceId: GlanceId, parameters: ActionParameters) {
    val id = GlanceAppWidgetManager(context).getAppWidgetId(glanceId)
    parameters[TOKEN]?.let { token -> runCatching { widgetRequest(context) { it.widgetAction(id, token, WidgetWork.supported(context, id)) } } }
    WidgetPresentation.refresh(context)
    RemiloWidget().updateAll(context)
  }
  companion object { val TOKEN = ActionParameters.Key<String>("token") }
}
class WidgetRefreshAction : ActionCallback {
  override suspend fun onAction(context: Context, glanceId: GlanceId, parameters: ActionParameters) { WidgetPresentation.refresh(context); RemiloWidget().updateAll(context); WidgetWork.request(context) }
}

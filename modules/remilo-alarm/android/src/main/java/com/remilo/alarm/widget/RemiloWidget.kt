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
}, private val previewBase: suspend (Context) -> WidgetSnapshot = { context ->
  widgetRequest(context) { it.widgetSnapshot(-1,false) }
}) : GlanceAppWidget() {
  override val sizeMode = SizeMode.Exact
  override suspend fun provideGlance(context: Context, id: GlanceId) {
    val number = GlanceAppWidgetManager(context).getAppWidgetId(id)
    val snapshot = try { if(WidgetWork.unlocked(context) && WidgetWork.supported(context,number))
      WidgetPresentation.feedbackSnapshot(number) ?: load(context,number) else load(context,number) }
      catch (_: Exception) { WidgetSnapshot(number, notice = "Could not load the widget. Refresh to try again.", failed = true) }
    val projection = WidgetPresentation.publish(snapshot.copy(id = number,fontScale = context.resources.configuration.fontScale))
    provideContent {
      val current by projection.collectAsState()
      WidgetContent(current,fontScale = current.fontScale)
    }
  }
  // A picker showcases the interactive footprint. Including the tiny summary here
  // lets launchers select it and stretch three labels over the entire preview.
  override val previewSizeMode = SizeMode.Responsive(setOf(DpSize(300.dp,240.dp), DpSize(300.dp,440.dp)))
  override suspend fun providePreview(context: Context, widgetCategory: Int) {
    val fontScale = context.resources.configuration.fontScale
    val base = previewBase(context).copy(date = LocalDate.now().toString())
    val example = WidgetSetup.example(context,"Routine",base)
    provideContent { WidgetContent(example, true, fontScale) }
  }
}

internal fun previewSnapshot() = WidgetSnapshot(-1, WidgetConfiguration("Today", "preview"), "2026-10-12", doneToken = "preview",
  session = mapOf("title" to "Routine", "state" to "InProgress", "date" to "2026-10-12", "completedCount" to 1, "totalCount" to 4,
    "steps" to listOf(
      mapOf("id" to "preview-bird-dog", "name" to "Bird-dog", "target" to "3 × 10", "completed" to true),
      mapOf("id" to "preview-front-plank", "name" to "Front plank", "target" to "3 × 40 s", "completed" to false),
      mapOf("id" to "preview-side-plank", "name" to "Side plank", "target" to "3 × 25 s / side", "completed" to false),
      mapOf("id" to "preview-intervals", "name" to "Intervals", "target" to "8 intervals", "completed" to false))))

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

/** Count units, not ordinal step positions. Numeric progress remains in the header. */
@Composable
internal fun WidgetRoutineProgress(completed: Int, total: Int, fill: Long, track: Long) {
  if(total <= 0)return
  val done = completed.coerceIn(0,total)
  if (total <= 12) AndroidRemoteViews(WidgetProgressViews.segments(LocalContext.current,done,total,fill.toInt(),track.toInt()),
    GlanceModifier.fillMaxWidth().height(4.dp))
  else Row(GlanceModifier.fillMaxWidth().height(4.dp).cornerRadius(2.dp).background(ColorProvider(Color(track)))) {
    // Use the native progress component for arbitrary totals without extra RemoteViews.
    LinearProgressIndicator(progress = done.toFloat() / total, modifier = GlanceModifier.fillMaxWidth().height(4.dp), color = ColorProvider(Color(fill)), backgroundColor = ColorProvider(Color(track)))
  }
}

class WidgetExerciseAction : ActionCallback {
  override suspend fun onAction(context: Context, glanceId: GlanceId, parameters: ActionParameters) {
    val id = GlanceAppWidgetManager(context).getAppWidgetId(glanceId)
    val token = parameters[TOKEN] ?: return
    val ticket = WidgetPresentation.begin(id,token) ?: return
    runWidgetAction(ticket,if(ticket.undo)"Undid completion of ${ticket.name}" else "Completed ${ticket.name}",
      execute = { runCatching { widgetRequest(context) { it.widgetAction(id, token, WidgetWork.supported(context, id)) } }.getOrNull() },
      refresh = { WidgetPresentation.refresh(context) },
      render = { all -> if(all)RemiloWidget().updateAll(context) else RemiloWidget().update(context,glanceId) })
  }
  companion object { val TOKEN = ActionParameters.Key<String>("token") }
}
class WidgetRefreshAction : ActionCallback {
  override suspend fun onAction(context: Context, glanceId: GlanceId, parameters: ActionParameters) {
    WidgetPresentation.refresh(context,GlanceAppWidgetManager(context).getAppWidgetId(glanceId))
    RemiloWidget().updateAll(context); WidgetWork.request(context)
  }
}

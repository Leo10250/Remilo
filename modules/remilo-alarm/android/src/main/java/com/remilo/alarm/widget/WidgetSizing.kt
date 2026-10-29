package com.remilo.alarm.widget

import android.content.Context
import android.graphics.Paint
import android.util.TypedValue
import android.text.StaticLayout
import android.text.TextPaint
import com.remilo.alarm.presentation.L10n
import com.remilo.alarm.presentation.NativeMessages
import kotlin.math.ceil

/** Shared by real launcher constraints and the inert native setup preview. */
internal object WidgetSizing {
  fun minimumWidth(snapshot: WidgetSnapshot, scale: Float): Int = if(snapshot.configuration.routineId != null)
    kotlin.math.ceil(44 + 256*scale.coerceAtLeast(1f).toDouble()).toInt() else 260
  private fun lineHeight(context: Context, sp: Int, budget: Int, scale: Float): Int {
    val metrics = context.resources.displayMetrics
    val font = Paint().apply { textSize = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP,sp.toFloat(),metrics) }.fontMetricsInt
    // Include top/bottom font padding, including fonts with taller vendor metrics.
    return maxOf(ceil((font.bottom-font.top)/metrics.density.toDouble()).toInt(),ceil(budget*scale.coerceAtLeast(1f)).toInt())
  }
  fun reminderHeight(context: Context, scale: Float, expanded: Boolean): Int = maxOf(if(expanded)68 else 56,
    16 + lineHeight(context,16,24,scale) + lineHeight(context,14,20,scale))
  @Suppress("UNCHECKED_CAST")
  fun nextLineHeight(context: Context, snapshot: WidgetSnapshot, scale: Float): Int {
    // Include fallback glyph metrics for every authored name, even after Next disappears.
    val names=(snapshot.session?.get("steps") as? List<Map<String,Any?>>).orEmpty().joinToString(" ") { it["name"] as? String ?: "" }
      .replace('\n',' ').replace('\r',' ')
    val text=L10n.text(context,NativeMessages.widget_next(names))
    val metrics=context.resources.displayMetrics
    val paint=TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
      textSize=TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP,14f,metrics)
      textLocales=context.resources.configuration.locales
    }
    val native=StaticLayout.Builder.obtain(text,0,text.length,paint,1_000_000)
      .setMaxLines(1).setIncludePad(true).setUseLineSpacingFromFallbacks(true).build().height
    return maxOf(lineHeight(context,14,20,scale),ceil(native/metrics.density.toDouble()).toInt())
  }
  fun currentTextHeight(context: Context, scale: Float): Int = maxOf(ceil(56*scale.coerceAtLeast(1f)).toInt(),
    lineHeight(context,18,24,scale) + lineHeight(context,14,20,scale))
  fun minimumHeight(context: Context, snapshot: WidgetSnapshot, scale: Float): Int {
    val base = maxOf(compactHeight(snapshot),ceil(24 + (if(selectedRoutineNeedsFooter(snapshot))210 else 164)*scale.coerceAtLeast(1f)).toInt())
    if(bottomAlignedFocusActions(snapshot)) {
      // Current text and a reserved Next line share the bottom of the full action group.
      val focus = 24 + maxOf(20,lineHeight(context,14,20,scale)) + 4 + lineHeight(context,22,28,scale) + 4 +
        lineHeight(context,14,20,scale) + 12 + currentTextHeight(context,scale) + 2 + nextLineHeight(context,snapshot,scale)
      val footer = if(snapshot.configuration.mode == "Today")maxOf(ceil(48*scale.coerceAtLeast(1f)).toInt(),lineHeight(context,14,20,scale)) else 0
      return maxOf(base,focus + footer)
    }
    if(snapshot.configuration.mode != "Today" || snapshot.configuration.routineId != null || snapshot.reminders.isEmpty() ||
      snapshot.failed || snapshot.locked || !snapshot.configured)return base
    val today = 24 + maxOf(20,lineHeight(context,14,20,scale)) + 8 + lineHeight(context,22,28,scale) + 12 +
      reminderHeight(context,scale,false) + maxOf(ceil(48*scale.coerceAtLeast(1f)).toInt(),lineHeight(context,14,20,scale))
    return maxOf(base,today)
  }
  fun previewHeight(context: Context, snapshot: WidgetSnapshot?, expanded: Boolean, scale: Float): Int =
    if(expanded || scale > 1.2f)440 else minimumHeight(context,snapshot ?: WidgetSnapshot(-1),scale) + 4
  fun compactHeight(snapshot: WidgetSnapshot?): Int =
    if(snapshot == null || selectedRoutineNeedsFooter(snapshot) || snapshot.configuration.routineId != null && snapshot.session == null)240 else 200
}

/** Healthy compact Focus keeps its action position through the last step and eligible final Undo. */
@Suppress("UNCHECKED_CAST")
internal fun bottomAlignedFocusActions(snapshot: WidgetSnapshot): Boolean {
  if(snapshot.configuration.routineId == null || !snapshot.configured || snapshot.locked || snapshot.failed ||
    snapshot.retryToken != null || snapshot.notice != null)return false
  val session = snapshot.session ?: return false
  if(session["deleted"] == true || session["ended"] == true)return false
  return snapshot.undoToken != null || session["state"] !in setOf("Rest","Skipped","Upcoming","Paused") &&
    (session["steps"] as? List<Map<String,Any?>>).orEmpty().any { it["completed"] != true }
}

/** Presentation of the next unfinished step in the same native session, never tomorrow's plan. */
@Suppress("UNCHECKED_CAST")
internal fun widgetNextExercise(snapshot: WidgetSnapshot): Map<String,Any?>? {
  val session = snapshot.session ?: return null
  if(session["deleted"] == true || session["ended"] == true || session["state"] in setOf("Rest","Skipped","Upcoming","Paused"))return null
  return (session["steps"] as? List<Map<String,Any?>>).orEmpty().filter { it["completed"] != true }.getOrNull(1)
}

internal fun selectedRoutineNeedsFooter(snapshot: WidgetSnapshot): Boolean =
  snapshot.configuration.routineId != null && (snapshot.configuration.mode == "Today" || snapshot.retryToken != null || snapshot.notice != null)

package com.remilo.alarm.widget

/** Shared by real launcher constraints and the inert native setup preview. */
internal object WidgetSizing {
  fun previewHeight(snapshot: WidgetSnapshot?, expanded: Boolean, scale: Float): Int =
    if(expanded || scale > 1.2f)440 else maxOf(compactHeight(snapshot),(24 + (if(snapshot != null && selectedRoutineNeedsFooter(snapshot))210 else 164)*scale.coerceAtLeast(1f)).toInt() + 4)
  fun compactHeight(snapshot: WidgetSnapshot?): Int =
    if(snapshot == null || selectedRoutineNeedsFooter(snapshot) || snapshot.configuration.routineId != null && snapshot.session == null)240 else 200
}

internal fun selectedRoutineNeedsFooter(snapshot: WidgetSnapshot): Boolean =
  snapshot.configuration.routineId != null && (snapshot.configuration.mode == "Today" || snapshot.retryToken != null || snapshot.notice != null)

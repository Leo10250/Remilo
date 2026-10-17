package com.remilo.alarm.widget

/** Shared by real launcher constraints and the inert native setup preview. */
internal object WidgetSizing {
  fun compactHeight(snapshot: WidgetSnapshot?): Int =
    if(snapshot == null || selectedRoutineNeedsFooter(snapshot) || snapshot.configuration.routineId != null && snapshot.session == null)240 else 200
}

internal fun selectedRoutineNeedsFooter(snapshot: WidgetSnapshot): Boolean =
  snapshot.configuration.routineId != null && (snapshot.configuration.mode == "Today" || snapshot.retryToken != null || snapshot.undoToken != null || snapshot.notice != null)

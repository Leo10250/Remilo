package com.remilo.alarm.widget

import android.content.Context
import android.util.TypedValue
import android.widget.RemoteViews
import com.remilo.alarm.R

/** One Glance child, even for twelve segments. Native weights keep every segment equal. */
internal object WidgetProgressViews {
  fun segments(context: Context, completed: Int, total: Int, fill: Int, track: Int): RemoteViews {
    require(total in 1..12)
    return RemoteViews(context.packageName, R.layout.widget_progress_track).apply {
      removeAllViews(R.id.widget_progress_track)
      repeat(total) { index ->
        addView(R.id.widget_progress_track, RemoteViews(context.packageName, R.layout.widget_progress_segment).apply {
          setInt(R.id.widget_progress_segment, "setColorFilter", if(index < completed.coerceIn(0,total))fill else track)
          setViewLayoutMargin(R.id.widget_progress_segment, RemoteViews.MARGIN_END,
            if(index == total - 1)0f else 2f, TypedValue.COMPLEX_UNIT_DIP)
        })
      }
    }
  }
}

package com.remilo.alarm.widget

import android.content.Context
import kotlinx.coroutines.flow.MutableStateFlow
import java.util.concurrent.ConcurrentHashMap

/** Discardable process-only projections. Never used to validate or perform an exercise action. */
internal object WidgetPresentation {
  private val projections = ConcurrentHashMap<Int,MutableStateFlow<WidgetSnapshot>>()
  fun publish(value: WidgetSnapshot): MutableStateFlow<WidgetSnapshot> = projections.computeIfAbsent(value.id) { MutableStateFlow(value) }.also { flow ->
    synchronized(flow) { if (value.projectionEpoch >= flow.value.projectionEpoch || value.locked || value.failed || flow.value.failed) flow.value = value }
  }
  suspend fun refresh(context: Context, acknowledgeWidget: Int? = null) {
    WidgetWork.ids(context).forEach { id ->
      val next = runCatching { widgetRequest(context) {
        if(id == acknowledgeWidget) it.refreshWidget(id,WidgetWork.supported(context,id))
        else it.widgetSnapshot(id,WidgetWork.supported(context,id))
      } }
        .getOrElse { WidgetSnapshot(id,notice = "Could not load the widget. Refresh to try again.",failed = true) }
      publish(next.copy(fontScale = context.resources.configuration.fontScale))
    }
  }
  fun prune(active: Set<Int>) { projections.keys.filter { it !in active }.forEach(projections::remove) }
}

package com.remilo.alarm.widget

import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/** Display deadlines never occupy the mutation worker or delay the next eligible action. */
internal suspend fun runWidgetAction(ticket: WidgetPresentation.Ticket, confirmation: String,
  execute: suspend () -> Map<String,Any?>?, refresh: suspend () -> Unit, render: suspend (Boolean) -> Unit) = coroutineScope {
  val pending = launch { delay(250); if(WidgetPresentation.saving(ticket))runCatching { render(false) } }
  try {
    val result = execute()
    pending.cancel()
    refresh()
    val acknowledged = WidgetPresentation.finish(ticket,result,confirmation)
    render(true)
    if(acknowledged) { delay(1500); WidgetPresentation.clear(ticket); render(false) }
  } finally { pending.cancel(); WidgetPresentation.clear(ticket) }
}

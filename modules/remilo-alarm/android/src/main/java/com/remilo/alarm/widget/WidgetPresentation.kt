package com.remilo.alarm.widget

import android.content.Context
import kotlinx.coroutines.flow.MutableStateFlow
import java.util.concurrent.ConcurrentHashMap

/** Discardable process-only projections. Never used to validate or perform an exercise action. */
internal object WidgetPresentation {
  private val projections = ConcurrentHashMap<Int,MutableStateFlow<WidgetSnapshot>>()
  private val bases = mutableMapOf<Int,WidgetSnapshot>()
  private val actions = mutableMapOf<Int,Ticket>()
  internal class Ticket(val id: Int, val token: String, val captured: WidgetSnapshot?) {
    var saving = false
    var confirmedRevision: Long? = null
    var confirmation: String? = null
    val undo = token == captured?.undoToken || (token == captured?.retryToken && captured?.retryIsUndo == true)
    @Suppress("UNCHECKED_CAST")
    val name = if(token == captured?.retryToken)captured?.retryName.orEmpty() else if(undo)captured?.undoName.orEmpty() else
      (captured?.session?.get("steps") as? List<Map<String,Any?>>)?.firstOrNull { it["completed"] != true }?.get("name") as? String ?: ""
  }
  private fun sameContext(a: WidgetSnapshot, b: WidgetSnapshot) = !b.locked && !b.failed && b.configured &&
    a.configuration == b.configuration && a.date == b.date && a.session?.get("occurrenceId") == b.session?.get("occurrenceId")
  private fun decorate(base: WidgetSnapshot): WidgetSnapshot {
    val ticket = actions[base.id] ?: return base
    val captured = ticket.captured ?: return base
    if(!sameContext(captured,base) || revision(base) != (ticket.confirmedRevision ?: revision(captured))) return base
    return base.copy(actionFeedback = WidgetActionFeedback(ticket.confirmation == null,ticket.saving,ticket.confirmation))
  }
  private fun revision(value: WidgetSnapshot) = (value.session?.get("revision") as? Number)?.toLong()
  @Synchronized fun publish(value: WidgetSnapshot): MutableStateFlow<WidgetSnapshot> {
    val previous = bases[value.id]
    if(previous == null || value.projectionEpoch >= previous.projectionEpoch || value.locked || value.failed || previous.failed) {
      bases[value.id] = value.copy(actionFeedback = null)
      actions[value.id]?.captured?.let { if(!sameContext(it,value))actions.remove(value.id) }
    }
    val next = decorate(bases.getValue(value.id))
    return projections.computeIfAbsent(value.id) { MutableStateFlow(next) }.also { it.value = next }
  }
  private fun emit(id: Int) { bases[id]?.let { projections[id]?.value = decorate(it) } }
  /** A second tap cannot replace an in-flight token. Receipt checks still own completed retries. */
  @Synchronized fun begin(id: Int, token: String): Ticket? {
    if(actions[id]?.let { it.confirmation == null } == true)return null
    val base = bases[id]
    val captured = base?.takeIf { token in listOf(it.doneToken,it.undoToken,it.retryToken) && !it.locked && !it.failed }
    return Ticket(id,token,captured).also { actions[id] = it; emit(id) }
  }
  @Synchronized fun saving(ticket: Ticket): Boolean {
    if(actions[ticket.id] !== ticket || ticket.confirmation != null)return false
    ticket.saving = true; emit(ticket.id); return ticket.captured != null
  }
  @Synchronized fun finish(ticket: Ticket, result: Map<String,Any?>?, confirmation: String): Boolean {
    if(actions[ticket.id] !== ticket)return false
    val base = bases[ticket.id]
    val revision = ((result?.get("routineSession") as? Map<*,*>)?.get("revision") as? Number)?.toLong()
    if(result?.get("status") == "Applied" && result["widgetReplay"] != true && ticket.captured != null && base != null &&
      revision != null && sameContext(ticket.captured,base) && revision(base) == revision) {
      ticket.confirmedRevision = revision; ticket.confirmation = confirmation; ticket.saving = false; emit(ticket.id); return true
    }
    actions.remove(ticket.id); emit(ticket.id); return false
  }
  @Synchronized fun clear(ticket: Ticket) { if(actions[ticket.id] === ticket) { actions.remove(ticket.id); emit(ticket.id) } }
  /** Render feedback without queueing another read behind the mutation worker. */
  @Synchronized fun feedbackSnapshot(id: Int): WidgetSnapshot? = bases[id]?.let(::decorate)?.takeIf { it.actionFeedback != null }
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
  @Synchronized fun prune(active: Set<Int>) {
    projections.keys.filter { it !in active }.forEach(projections::remove)
    bases.keys.retainAll(active); actions.keys.retainAll(active)
  }
}

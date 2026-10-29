package com.remilo.alarm.widget

import org.junit.Assert.*
import org.junit.After
import org.junit.Test
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.async
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout

class WidgetPresentationTest {
  @After fun clear() { WidgetPresentation.prune(emptySet()) }
  private fun initial(id: Int = 1) = previewSnapshot().copy(id = id, doneToken = "done", projectionEpoch = 1,
    session = previewSnapshot().session!! + mapOf("occurrenceId" to "day", "revision" to 1L))
  private fun result(revision: Long = 2, replay: Boolean = false) = mapOf("status" to "Applied", "widgetReplay" to replay,
    "routineSession" to mapOf("revision" to revision))
  @Test fun pendingUsesCapturedProjectionWithoutChangingProgressAndRejectsDuplicateSubmission() {
    val flow = WidgetPresentation.publish(initial())
    val ticket = WidgetPresentation.begin(1,"done")!!
    assertTrue(flow.value.actionFeedback!!.busy); assertFalse(flow.value.actionFeedback!!.saving)
    assertEquals(1,flow.value.session!!["completedCount"])
    assertNull(WidgetPresentation.begin(1,"done"))
    assertTrue(WidgetPresentation.saving(ticket)); assertTrue(WidgetPresentation.feedbackSnapshot(1)!!.actionFeedback!!.saving)
    WidgetPresentation.clear(ticket); assertNull(flow.value.actionFeedback)
  }
  @Test fun confirmationUsesFreshConfirmedRevisionAndOldExpiryCannotClearNewAction() {
    val original=initial(); val flow=WidgetPresentation.publish(original)
    val first=WidgetPresentation.begin(1,"done")!!
    WidgetPresentation.publish(original.copy(projectionEpoch=2,doneToken="next",session=original.session!! + ("revision" to 2L)))
    assertTrue(WidgetPresentation.finish(first,result(),"Completed Front plank"))
    assertEquals("Completed Front plank",flow.value.actionFeedback!!.confirmation)
    val next=WidgetPresentation.begin(1,"next")!!
    WidgetPresentation.clear(first); assertTrue(flow.value.actionFeedback!!.busy)
    assertTrue(WidgetPresentation.saving(next))
  }
  @Test fun unrelatedWidgetAndLateOlderSnapshotNeverAcquireConfirmation() {
    val original=initial(); val first=WidgetPresentation.publish(original); val other=WidgetPresentation.publish(initial(2))
    val ticket=WidgetPresentation.begin(1,"done")!!
    WidgetPresentation.publish(original.copy(projectionEpoch=3,session=original.session!! + ("revision" to 2L)))
    assertTrue(WidgetPresentation.finish(ticket,result(),"Completed Front plank"))
    WidgetPresentation.publish(original)
    assertEquals(3L,first.value.projectionEpoch); assertNotNull(first.value.actionFeedback)
    assertNull(other.value.actionFeedback)
  }
  @Test fun replayUncertainAndConflictNeverClaimACompletion() {
    for(response in listOf(null,mapOf("status" to "Rejected"),result(1,true))) {
      val flow=WidgetPresentation.publish(initial()); val ticket=WidgetPresentation.begin(1,"done")!!
      assertFalse(WidgetPresentation.finish(ticket,response,"Completed Front plank")); assertNull(flow.value.actionFeedback)
    }
  }
  @Test fun retryFeedbackUsesTheCapturedActionDirectionAndNameInsteadOfCurrentControls() {
    for(undo in listOf(false,true)) {
      WidgetPresentation.publish(initial().copy(doneToken=null,undoToken=null,undoName="Earlier completion",
        retryToken="retry",retryIsUndo=undo,retryName="Captured exercise"))
      val ticket=WidgetPresentation.begin(1,"retry")!!
      assertEquals(undo,ticket.undo); assertEquals("Captured exercise",ticket.name)
      WidgetPresentation.clear(ticket)
    }
  }
  @Test fun dateConfigPrivacyAndConcurrentRevisionFenceFeedback() {
    val original=initial()
    for(next in listOf(original.copy(date="2026-10-13"),original.copy(configuration=WidgetConfiguration("Routine","other",2)),
      original.copy(locked=true),original.copy(session=original.session!! + ("revision" to 9L)))) {
      WidgetPresentation.prune(emptySet()); val flow=WidgetPresentation.publish(original); val ticket=WidgetPresentation.begin(1,"done")!!
      WidgetPresentation.publish(next.copy(projectionEpoch=2))
      assertFalse(WidgetPresentation.finish(ticket,result(),"Completed Front plank")); assertNull(flow.value.actionFeedback)
    }
  }
  @Test fun processOnlyStateIsDiscardedAndOldTimerCannotTouchRecreatedWidget() {
    WidgetPresentation.publish(initial()); val old=WidgetPresentation.begin(1,"done")!!
    WidgetPresentation.prune(emptySet()); val fresh=WidgetPresentation.publish(initial()); val current=WidgetPresentation.begin(1,"done")!!
    WidgetPresentation.clear(old); assertTrue(fresh.value.actionFeedback!!.busy); WidgetPresentation.clear(current)
  }
  @Test fun immediateCommitNeverFlashesSavingAndConfirmationExpires() = runBlocking {
    val original=initial(); val flow=WidgetPresentation.publish(original); val ticket=WidgetPresentation.begin(1,"done")!!
    val frames=mutableListOf<WidgetActionFeedback?>()
    runWidgetAction(ticket,"Completed Front plank",execute={ result() },refresh={
      WidgetPresentation.publish(original.copy(projectionEpoch=2,session=original.session!! + ("revision" to 2L)))
    },render={ frames.add(flow.value.actionFeedback) })
    assertFalse(frames.any { it?.saving == true })
    assertEquals("Completed Front plank",frames.first()!!.confirmation)
    assertNull(frames.last()); assertNull(flow.value.actionFeedback)
  }
  @Test fun slowCommitShowsSavingWithoutWaitingForWorkerAndAdvancesOnlyAfterCommit() = runBlocking {
    val original=initial(); val flow=WidgetPresentation.publish(original); val ticket=WidgetPresentation.begin(1,"done")!!
    val commit=CompletableDeferred<Unit>(); val pendingRendered=CompletableDeferred<Unit>()
    val running=async {
      runWidgetAction(ticket,"Completed Front plank",execute={ commit.await(); result() },refresh={
        WidgetPresentation.publish(original.copy(projectionEpoch=2,session=original.session!! + mapOf("revision" to 2L,"completedCount" to 2)))
      },render={ if(flow.value.actionFeedback?.saving == true)pendingRendered.complete(Unit) })
    }
    withTimeout(2000) { pendingRendered.await() }
    assertEquals(1,flow.value.session!!["completedCount"]); assertNull(WidgetPresentation.begin(1,"done"))
    commit.complete(Unit); running.await()
    assertEquals(2,(flow.value.session!!["completedCount"] as Number).toInt()); assertNull(flow.value.actionFeedback)
  }
}

package com.remilo.alarm.calendar

import android.app.Application
import androidx.room.Room
import com.remilo.alarm.data.ContentDatabase
import com.remilo.alarm.data.ReminderRecord
import org.junit.*
import org.junit.Assert.*
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import java.util.UUID

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34], application = Application::class)
class CalendarSyncRequestsTest {
  private lateinit var db: ContentDatabase
  private lateinit var requests: CalendarSyncRequests
  private var now = 1_800_000_000_000L
  @Before fun open() {
    db = Room.inMemoryDatabaseBuilder(RuntimeEnvironment.getApplication(), ContentDatabase::class.java).allowMainThreadQueries().build()
    db.calendar().connection(CalendarConnection(revision = 1, connected = true, subject = "subject"))
    requests = CalendarSyncRequests(db) { now }
  }
  @After fun close() = db.close()
  private fun capture(association: String? = null): String {
    val id = UUID.randomUUID().toString()
    requests.capture(mapOf("operationId" to id, "scope" to if (association == null) mapOf("kind" to "AllAuthorized") else mapOf("kind" to "Association", "occurrenceId" to association)))
    return id
  }
  private fun link(id: String) {
    db.records().insert(ReminderRecord(id, "Private title", now + 60_000, now + 120_000, now + 60_000, now))
    db.links().put(CalendarLink(id, "remote:$id", "subject", "calendar", "event:$id", "Calendar", "Imported"))
    db.sync().put(CalendarSyncState(id, mode = "Automatic"))
  }
  private fun result(id: String) = requests.view(id)!!["syncResult"] as Map<*, *>
  @Test fun acknowledgedRequestIsImmutableAndRetryRetainsIdentity() {
    val id = capture(); val before = db.managedCalendar().receipt(id)
    requests.capture(mapOf("operationId" to id, "scope" to mapOf("kind" to "AllAuthorized")))
    assertTrue(requests.begin(id)); requests.finish(id, CalendarRunSummary(1, 0, 0, false))
    assertEquals(before, db.managedCalendar().receipt(id)); assertFalse(requests.begin(id))
    try { requests.capture(mapOf("operationId" to id, "scope" to mapOf("kind" to "Association", "occurrenceId" to "other"))); fail() }
    catch (e: CalendarFailure) { assertEquals("OPERATION_REUSED", e.code) }
  }
  @Test fun agreementAndChangesAreSeparateAndRepeatedResourcesCountOnce() {
    val id = capture(); requests.begin(id)
    requests.checkpoint("same"); requests.checkpoint("same"); requests.checkpoint("changed", changed = true); requests.checkpoint("changed", changed = true)
    requests.finish(id, CalendarRunSummary(1, 2, 2, false))
    assertEquals(2, result(id)["checked"]); assertEquals(1, result(id)["changed"]); assertEquals("Synced", result(id)["outcome"])
  }
  @Test fun zeroLegacyConfirmationsDoesNotMeanAnEmptySourceWasChecked() {
    val incomplete = capture(); requests.begin(incomplete); requests.finish(incomplete, CalendarRunSummary(0, 0, 0, false))
    assertEquals("NotChecked", result(incomplete)["outcome"])
    val empty = capture(); requests.begin(empty); requests.finish(empty, CalendarRunSummary(1, 0, 0, false))
    assertEquals("NoChanges", result(empty)["outcome"])
    val discoveryOnly = capture(); requests.begin(discoveryOnly); requests.finish(discoveryOnly, CalendarRunSummary(1, 0, 0, false, collectionPages = 0))
    assertEquals("NotChecked", result(discoveryOnly)["outcome"])
  }
  @Test fun continuationAndOfflineCannotProduceSuccess() {
    val id = capture(); requests.begin(id); requests.checkpoint("changed", changed = true)
    requests.finish(id, CalendarRunSummary(1, 1, 1, true)); assertEquals("Pending", result(id)["outcome"])
    val offline = capture(); requests.begin(offline); requests.finish(offline, error = "NETWORK"); assertEquals("Pending", result(offline)["outcome"])
  }
  @Test fun scopedResultExcludesOtherRemindersAndSurvivesRecreation() {
    link("one"); link("two"); val id = capture("one"); requests.begin(id)
    requests.checkpoint("two", changed = true); requests.checkpoint("one")
    requests.finish(id, CalendarRunSummary(1, 1, 1, false))
    assertEquals("NoChanges", result(id)["outcome"]); assertEquals(0, result(id)["changed"])
    assertEquals(id, CalendarSyncRequests(db) { now }.latest("one")); assertNull(requests.latest())
  }
  @Test fun changedAccountAndPurgeFenceLateResultsAndErasePrivateReferences() {
    link("private-id"); val id = capture("private-id"); requests.begin(id); requests.checkpoint("private-id", changed = true)
    requests.purge("private-id"); requests.finish(id, CalendarRunSummary(1, 1, 1, false)); requests.checkpoint("private-id", changed = true)
    assertEquals("ScopeChanged", result(id)["outcome"]); assertNull(requests.latest("private-id"))
    assertFalse(db.managedCalendar().receipts("CalendarSyncRequest").toString().contains("private-id"))
    assertFalse(db.managedCalendar().receipts("CalendarSyncProgress").toString().contains("private-id"))
    val other = capture(); requests.begin(other); db.calendar().connection(db.calendar().connection()!!.copy(revision = 2))
    requests.finish(other, CalendarRunSummary(1, 0, 0, false)); assertEquals("ScopeChanged", result(other)["outcome"])
  }
  @Test fun deniedAccessAndUncertainWritesHaveDifferentOutcomes() {
    val denied = capture(); requests.begin(denied); requests.finish(denied, error = "AUTH")
    assertEquals("AccessRequired", result(denied)["outcome"])
    link("one"); db.sync().put(CalendarSyncState("one", mode = "Automatic", status = "Unconfirmed"))
    val uncertain = capture("one"); requests.begin(uncertain); requests.finish(uncertain, CalendarRunSummary(1, 1, 0, false))
    assertEquals("Unconfirmed", result(uncertain)["outcome"])
  }
  @Test fun partialProgressSurvivesInterruptionWithoutInventingAdditionalChanges() {
    val id = capture(); requests.begin(id); requests.checkpoint("one", changed = true)
    val resumed = CalendarSyncRequests(db) { now + 1 }; assertEquals(listOf(id), resumed.pending()); resumed.begin(id)
    resumed.checkpoint("one", changed = true); resumed.checkpoint("two"); resumed.finish(id, CalendarRunSummary(1, 1, 1, false))
    assertEquals(1, result(id)["changed"]); assertEquals(2, result(id)["checked"])
  }
  @Test fun laterDirtyContentSupersedesAnEarlierGreenAgreement() {
    link("one"); val id = capture("one"); requests.begin(id); requests.checkpoint("one"); requests.finish(id, CalendarRunSummary(1, 1, 1, false))
    assertEquals("NoChanges", result(id)["outcome"])
    db.sync().put(CalendarSyncState("one", mode = "Automatic", dirtyRevision = 2, status = "UpdatePending"))
    assertEquals("Pending", result(id)["outcome"])
  }
  @Test fun pendingRunResumesTheSameIdentityAndAnIntentionalPauseDoesNotBeginExecution() {
    val id = capture(); requests.begin(id); requests.checkpoint("one", changed = true); requests.finish(id, CalendarRunSummary(1, 1, 1, true))
    assertEquals(listOf(id), requests.pending()); assertTrue(requests.begin(id)); assertEquals("Checking", result(id)["outcome"])
    requests.finish(id, CalendarRunSummary(1, 0, 0, false)); assertEquals("Synced", result(id)["outcome"])
    db.managedCalendar().binding(CalendarManagedBinding(mode = "Paused"))
    val paused = capture(); assertFalse(requests.begin(paused)); assertEquals("Paused", result(paused)["outcome"])
  }
  @Test fun savedReadDoesNotMarkAnActiveWriteInterrupted() {
    link("one")
    db.links().insert(CalendarLinkOperation("write", "one", "remote:one", "AutomaticCalendarTransfer", "key", "subject", "calendar", "event:one", "Calendar", "Imported",
      1, 1, 1, 1, "etag", "{}", "{}", "{}", "{}", false, state = "Sending"))
    val id = capture("one"); requests.begin(id); requests.view(id); CalendarStatusStore(db) { now }.progress()
    assertEquals("Sending", db.links().operation("write")!!.state)
  }
  @Test fun exhaustedBudgetRetainsTheOriginalRequestForContinuation() {
    val id = capture(); requests.begin(id); requests.checkpoint("one")
    requests.finish(id, error = "BUDGET")
    assertEquals("Pending", result(id)["outcome"]); assertEquals(listOf(id), requests.pending())
    assertEquals(1, requests.view(id)!!["pending"])
  }
  @Test fun latestRequestIsStableWhenTheClockHasNotAdvanced() {
    val first = capture(); val second = capture()
    assertEquals(second, requests.latest()); assertNotEquals(first, requests.latest())
    now -= 60_000; val third = capture(); assertEquals(third, requests.latest())
    assertEquals(listOf(first, second, third), requests.pending())
  }
  @Test fun aggregateAttentionIncludesBlockingIssuesBeyondTheFirstReviewPage() {
    val sync = CalendarSyncStore(db, { now }, CalendarLinkStore(db, { now }, recoverInterrupted = false))
    repeat(51) { index -> link("item$index"); sync.issue("item$index", if (index == 50) "NEEDS_ACCESS" else "ChangesNeedReview", false) }
    assertEquals(51, sync.summary()["reviewCount"])
    assertEquals("danger", sync.attention()["tone"])
    db.sync().resolve("item50")
    assertEquals("warning", sync.attention()["tone"])
  }
  @Test fun interruptedAndOfflineRequestsUseDurableBoundedRetryDeadlines() {
    val id = capture(); assertEquals(id, requests.nextReady()); requests.begin(id)
    requests.finish(id, error = "NETWORK")
    assertNull(requests.nextReady()); assertEquals(now + 60_000, requests.nextRetryMs())
    now += 60_000; assertEquals(id, requests.nextReady()); requests.begin(id); requests.finish(id, error = "NETWORK")
    assertEquals(now + 120_000, requests.nextRetryMs())
    repeat(10) { now = requests.nextRetryMs()!!; requests.begin(id); requests.finish(id, error = "NETWORK") }
    assertEquals(now + 3_600_000, requests.nextRetryMs())
  }
  @Test fun emptyManagedAccessFailureIsActionableAndLateAccountFailuresAreIgnored() {
    val connection = db.calendar().connection()!!
    val binding = CalendarManagedBinding(subject = connection.subject, calendarId = "empty", mode = "Enabled", phase = "Ready", authEpoch = 4)
    db.managedCalendar().binding(binding)
    val sync = CalendarSyncStore(db, { now }, CalendarLinkStore(db, { now }, recoverInterrupted = false))
    db.calendar().connection(connection.copy(revision = connection.revision + 1))
    sync.failedRun(connection, 4, "AUTH", true)
    assertEquals(binding, db.managedCalendar().binding()); assertTrue(db.managedCalendar().issues().isEmpty())
    db.calendar().connection(connection)
    sync.failedRun(connection, 4, "AUTH", true)
    assertEquals("AccessRequired", db.managedCalendar().binding()!!.phase)
    assertEquals(1, sync.summary()["reviewCount"]); assertEquals("danger", sync.attention()["tone"])
  }
}

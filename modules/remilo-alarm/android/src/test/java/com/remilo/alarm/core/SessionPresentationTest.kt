package com.remilo.alarm.core
import org.junit.Assert.*
import org.junit.Test

class SessionPresentationTest {
  @Test fun loadingAndActiveSnapshotsNeverImplyTermination() {
    assertFalse(SessionRefreshGuard.ended(null))
    assertFalse(SessionRefreshGuard.ended("Starting"))
    assertFalse(SessionRefreshGuard.ended("Active"))
    listOf("Stopped", "TimedOut", "Interrupted", "Blocked", "Ended").forEach { assertTrue(SessionRefreshGuard.ended(it)) }
  }
  @Test fun changingIntentsRejectsOldSessionCallbacks() {
    val guard = SessionRefreshGuard()
    guard.select("old"); val old = guard.request()
    guard.select("new"); val current = guard.request()
    assertFalse(guard.accepts(old)); assertTrue(guard.accepts(current))
  }
  @Test fun outOfOrderRefreshDoesNotReplaceNewerMembership() {
    val guard = SessionRefreshGuard(); guard.select("session")
    val old = guard.request(); val latest = guard.request()
    assertFalse(guard.accepts(old)); assertTrue(guard.accepts(latest))
  }
  @Test fun committedTerminalSnapshotDoesNotDismissAnUnknownAction() {
    // A protected commit can end the session before its response is acknowledged.
    listOf("Stopped", "TimedOut", "Interrupted", "Blocked", "Ended").forEach { state ->
      assertFalse(SessionRefreshGuard.mayDismiss(state, pending = true, busy = false, unconfirmed = true))
      assertFalse(SessionRefreshGuard.mayDismiss(state, pending = true, busy = true, unconfirmed = false))
      assertFalse(SessionRefreshGuard.mayDismiss(state, pending = false, busy = true, unconfirmed = false))
      assertFalse(SessionRefreshGuard.mayDismiss(state, pending = false, busy = false, unconfirmed = true))
      assertTrue(SessionRefreshGuard.mayDismiss(state, pending = false, busy = false, unconfirmed = false))
    }
  }
  @Test fun newIntentCannotReplaceTheSessionOwningAnExactRetry() {
    val guard = SessionRefreshGuard(); assertTrue(guard.select("original"))
    val pendingRefresh = guard.request()
    assertFalse(guard.select("later", pending = true, unconfirmed = true))
    assertTrue(guard.accepts(pendingRefresh))
    assertEquals("original", guard.request().sessionId)
    // Repeated intents for the same session also retain its captured controls.
    assertFalse(guard.select("original", pending = true, busy = true))
    assertEquals("original", guard.request().sessionId)
    // Only a definitive acknowledgement/rejection allows the queued group to take over.
    assertTrue(guard.select("later"))
    assertEquals("later", guard.request().sessionId)
  }
  @Test fun recreationCanRestoreTheFrozenSessionBeforeRefreshingIt() {
    val guard = SessionRefreshGuard()
    assertTrue(guard.select("saved-command-session", pending = true, unconfirmed = true))
    assertEquals("saved-command-session", guard.request().sessionId)
    assertFalse(guard.select("incoming-session", pending = true, unconfirmed = true))
    assertEquals("saved-command-session", guard.request().sessionId)
  }
}

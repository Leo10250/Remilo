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
}

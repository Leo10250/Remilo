package com.remilo.alarm.core

import org.junit.Assert.*
import org.junit.Test

class PostponePresentationTest {
  private val a = DeliverySnapshot.Member("a", 3)
  private val b = DeliverySnapshot.Member("b", 8)
  private val c = DeliverySnapshot.Member("later", 1)
  private fun draft(all: Boolean = true) = PostponeDraft("session", if (all) listOf(a, b) else listOf(a), all,
    "America/Los_Angeles", "15", 1_800_000L, 900_000L)

  @Test fun laterArrivalsRemainOutsideTheDisplayedCaptureAndCommand() {
    val captured = draft()
    assertTrue(captured.matches("session", "Active", listOf(a, b, c)))
    val command = captured.command("operation")
    assertEquals(DeliverySnapshot.maps(listOf(a, b)), command["members"])
    assertEquals(1_800_000L, command["alarmAtMs"])
    assertEquals("PostponeAll", command["kind"])
  }
  @Test fun changedRemovedOrTerminalMembersCannotReuseAnUncommittedDraft() {
    val captured = draft()
    assertFalse(captured.matches("session", "Active", listOf(a)))
    assertFalse(captured.matches("session", "Active", listOf(a, b.copy(expectedGeneration = 9))))
    assertFalse(captured.matches("new-session", "Active", listOf(a, b)))
    assertFalse(captured.matches("session", "TimedOut", listOf(a, b)))
  }
  @Test fun aSingleCommandBindsItsSessionGenerationAndExactTarget() {
    val command = draft(false).command("single-operation")
    assertEquals(mapOf("kind" to "Postpone", "operationId" to "single-operation", "expectedSessionId" to "session",
      "alarmAtMs" to 1_800_000L, "occurrenceId" to "a", "expectedGeneration" to 3L), command)
  }
  @Test fun provisionalCustomPickerCancellationPreservesThePreviousSelectionAndTarget() {
    val captured = draft()
    val picking = captured.copy(picker = PostponePickerDraft("2027-03-14T02:30:00", "time"))
    assertEquals(captured, picking.copy(picker = null))
  }
  @Test fun retryIdentityDoesNotDependOnLaterClockOrMembershipReads() {
    val captured = draft()
    val command = captured.command("retry")
    assertEquals(command, captured.copy(stale = true).command("retry"))
    assertEquals(1_800_000L, command["alarmAtMs"])
  }
  @Test fun customUseValidatesWithoutLosingTheEditableProvisionalDate() {
    val at = java.time.Instant.parse("2027-03-14T08:00:00Z").toEpochMilli()
    val original = draft(false).copy(referenceAtMs = at, targetMs = at + 900_000,
      picker = PostponePickerDraft("2027-03-13T10:00:00"))
    assertThrows(IllegalArgumentException::class.java) { original.useCustom(at) }
    assertEquals("2027-03-13T10:00:00", original.picker!!.local)
    assertEquals(at + 900_000, original.targetMs)
    val chosen = original.copy(picker = PostponePickerDraft("2027-03-14T02:30:00")).useCustom(at)
    assertNull(chosen.picker)
    assertEquals("custom", chosen.selection)
    assertEquals("gapForward", chosen.adjustment)
    assertEquals(java.time.Instant.parse("2027-03-14T10:30:00Z").toEpochMilli(), chosen.targetMs)
  }
  @Test fun customSeedUsesValidTargetOrFifteenMinutesFromNowWithoutChangingSelection() {
    val at = java.time.Instant.parse("2027-07-12T17:00:00Z").toEpochMilli()
    val captured = draft(false).copy(referenceAtMs = at, targetMs = at + 1_800_000)
    assertEquals("2027-07-12T10:30:00", captured.beginCustom(at).picker!!.local)
    val expired = captured.copy(targetMs = at - 1)
    assertEquals("2027-07-12T10:15:00", expired.beginCustom(at).picker!!.local)
    assertEquals(expired.targetMs, expired.beginCustom(at).targetMs)
    assertEquals(expired.selection, expired.beginCustom(at).selection)
  }
}

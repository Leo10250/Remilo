package com.remilo.alarm.core

import org.junit.Assert.*
import org.junit.Test

class NotificationPostponeRequestTest {
  @Test fun singleCaptureContainsOnlyOccurrenceIdentityAndGeneration() {
    val request = NotificationPostponeRequest.single("opaque-id", 7)
    assertEquals(mapOf("kind" to "Single", "occurrenceId" to "opaque-id", "expectedGeneration" to 7L), request)
    assertNotEquals(request, NotificationPostponeRequest.single("opaque-id", 8))
  }

  @Test fun groupCaptureIsOrderedImmutableAndExcludesLaterArrivals() {
    val input = mutableListOf(DeliverySnapshot.Member("b", 2), DeliverySnapshot.Member("a", 1))
    val captured = NotificationPostponeRequest.group("session", input)
    input.add(DeliverySnapshot.Member("later", 1))
    assertEquals(setOf("kind", "expectedSessionId", "members"), captured.keys)
    assertEquals("Group", captured["kind"]); assertEquals("session", captured["expectedSessionId"])
    assertEquals(listOf(mapOf("occurrenceId" to "a", "expectedGeneration" to 1L),
      mapOf("occurrenceId" to "b", "expectedGeneration" to 2L)), captured["members"])
    assertEquals(captured, NotificationPostponeRequest.group("session", input.take(2).reversed()))
    assertNotEquals(captured, NotificationPostponeRequest.group("session", input))
    assertNotEquals(captured, NotificationPostponeRequest.group("other-session", input.take(2)))
  }

  @Test fun malformedCapturesCannotProduceAnActionableNavigationRequest() {
    listOf(0L, -1L, 9_007_199_254_740_992L).forEach {
      assertThrows(IllegalArgumentException::class.java) { NotificationPostponeRequest.single("id", it) }
    }
    assertThrows(IllegalArgumentException::class.java) { NotificationPostponeRequest.single("", 1) }
    assertThrows(IllegalArgumentException::class.java) { NotificationPostponeRequest.single("a".repeat(201), 1) }
    assertThrows(IllegalArgumentException::class.java) { NotificationPostponeRequest.group("", listOf(DeliverySnapshot.Member("a", 1))) }
    assertThrows(IllegalArgumentException::class.java) { NotificationPostponeRequest.group("session", emptyList()) }
    assertThrows(IllegalArgumentException::class.java) { NotificationPostponeRequest.group("session", listOf(DeliverySnapshot.Member("a", 1), DeliverySnapshot.Member("a", 2))) }
  }
}

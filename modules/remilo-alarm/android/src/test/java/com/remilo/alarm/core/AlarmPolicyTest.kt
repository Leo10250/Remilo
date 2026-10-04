package com.remilo.alarm.core
import org.junit.Assert.*
import org.junit.Test

class AlarmPolicyTest {
  @Test fun staleCallbacksCannotRingEvenWhenOnTime() {
    assertEquals(AlarmPolicy.Delivery.STALE, AlarmPolicy.delivery(100, 100, 1, 2, true, true))
    assertEquals(AlarmPolicy.Delivery.STALE, AlarmPolicy.delivery(100, 100, 2, 2, false, true))
  }
  @Test fun lateDeliveryHasAnInclusiveFiveMinuteBoundary() {
    assertEquals(AlarmPolicy.Delivery.RING, AlarmPolicy.delivery(300_100, 100, 1, 1, true, true))
    assertEquals(AlarmPolicy.Delivery.MISSED, AlarmPolicy.delivery(300_101, 100, 1, 1, true, true))
  }
  @Test fun futureCallbacksDoNotRingAndDeniedPermissionIsExplicit() {
    assertEquals(AlarmPolicy.Delivery.EARLY, AlarmPolicy.delivery(99, 100, 1, 1, true, true))
    assertEquals(AlarmPolicy.Delivery.BLOCKED, AlarmPolicy.delivery(100, 100, 1, 1, true, false))
  }
  @Test fun arrivalsNeverGiveAnExistingSessionMoreTime() {
    val start = 2_000L
    assertEquals(300_000L, AlarmPolicy.remaining(start, start))
    assertEquals(1_000L, AlarmPolicy.remaining(start, start + 299_000L))
    assertEquals(0L, AlarmPolicy.remaining(start, start + 300_000L))
    assertEquals(0L, AlarmPolicy.remaining(start, start + 500_000L))
  }
}

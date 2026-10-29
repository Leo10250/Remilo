package com.remilo.alarm.core

import org.junit.Assert.*
import org.junit.Test

class DeliverySnapshotTest {
  @Test fun postponeIdentityBindsExactTargetAndGenerationWithoutDependingOnOrder() {
    val members = listOf(DeliverySnapshot.Member("a", 1), DeliverySnapshot.Member("b", 2))
    val key = DeliverySnapshot.postponeKey(members, 1_800_000_000_000L)
    assertEquals(key, DeliverySnapshot.postponeKey(members.reversed(), 1_800_000_000_000L))
    assertNotEquals(key, DeliverySnapshot.postponeKey(members, 1_800_000_000_001L))
    assertNotEquals(key, DeliverySnapshot.postponeKey(members + DeliverySnapshot.Member("c", 1), 1_800_000_000_000L))
    assertNotEquals(key, DeliverySnapshot.postponeKey(members.map { it.copy(expectedGeneration = it.expectedGeneration + 1) }, 1_800_000_000_000L))
    assertNotEquals(key, DeliverySnapshot.key(members))
    assertNotEquals(key, DeliverySnapshot.key(members, 10))
  }

  @Test fun legacyFingerprintsRemainCompatible() {
    val members = listOf(DeliverySnapshot.Member("a", 1), DeliverySnapshot.Member("b", 2))
    // Recorded legacy canonical input: 1:a:1;1:b:2;snooze:10
    val expected = java.security.MessageDigest.getInstance("SHA-256").digest("1:a:1;1:b:2;snooze:10".toByteArray())
      .joinToString("") { "%02x".format(it.toInt() and 0xff) }
    assertEquals(expected, DeliverySnapshot.key(members, 10))
  }
}

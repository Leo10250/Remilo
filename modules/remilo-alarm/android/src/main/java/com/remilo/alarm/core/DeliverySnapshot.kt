package com.remilo.alarm.core

import java.security.MessageDigest

/** Privacy-safe action identity; member order does not change the captured operation. */
object DeliverySnapshot {
  data class Member(val occurrenceId: String, val expectedGeneration: Long)
  fun key(members: List<Member>, snoozeMinutes: Int? = null): String {
    val canonical = members.sortedBy { it.occurrenceId }.joinToString("") {
      "${it.occurrenceId.length}:${it.occurrenceId}:${it.expectedGeneration};"
    } + "snooze:${snoozeMinutes ?: ""}"
    return MessageDigest.getInstance("SHA-256").digest(canonical.toByteArray(Charsets.UTF_8))
      .joinToString("") { "%02x".format(it.toInt() and 0xff) }
  }
  fun maps(members: List<Member>): List<Map<String, Any>> = members.map {
    mapOf("occurrenceId" to it.occurrenceId, "expectedGeneration" to it.expectedGeneration)
  }
}

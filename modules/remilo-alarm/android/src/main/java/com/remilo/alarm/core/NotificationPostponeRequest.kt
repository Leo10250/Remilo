package com.remilo.alarm.core

/** Immutable allowlisted navigation capture. Opening it never applies an engine action. */
object NotificationPostponeRequest {
  fun single(occurrenceId: String, expectedGeneration: Long): Map<String, Any> {
    validMember(occurrenceId, expectedGeneration)
    return mapOf("kind" to "Single", "occurrenceId" to occurrenceId, "expectedGeneration" to expectedGeneration)
  }

  fun group(expectedSessionId: String, members: List<DeliverySnapshot.Member>): Map<String, Any> {
    require(expectedSessionId.isNotBlank() && expectedSessionId.length <= 200)
    require(members.isNotEmpty() && members.map { it.occurrenceId }.distinct().size == members.size)
    members.forEach { validMember(it.occurrenceId, it.expectedGeneration) }
    val captured = members.sortedBy { it.occurrenceId }.map { it.copy() }
    return mapOf("kind" to "Group", "expectedSessionId" to expectedSessionId, "members" to DeliverySnapshot.maps(captured))
  }

  private fun validMember(id: String, generation: Long) {
    require(id.isNotBlank() && id.length <= 200)
    require(generation in 1..9_007_199_254_740_991L)
  }
}

package com.remilo.alarm.core

/** Presentation-only capture. Contains operational identities and times, never private text. */
data class PostponeDraft(
  val sessionId: String,
  val members: List<DeliverySnapshot.Member>,
  val all: Boolean,
  val zoneId: String,
  val selection: String,
  val targetMs: Long,
  val referenceAtMs: Long,
  val preferencesRevision: Long? = null,
  val tomorrowMinutes: List<Int>? = null,
  val adjustment: String = "none",
  val stale: Boolean = false,
  val picker: PostponePickerDraft? = null
) {
  init {
    require(sessionId.isNotEmpty() && members.isNotEmpty())
    require(members.map { it.occurrenceId }.distinct().size == members.size)
    require(all || members.size == 1)
    require(tomorrowMinutes == null || (tomorrowMinutes.size == 3 && tomorrowMinutes.all { it in 0..1439 }))
  }

  /** Arrivals do not enlarge a capture; any changed captured member invalidates it. */
  fun matches(id: String, state: String, current: List<DeliverySnapshot.Member>): Boolean =
    id == sessionId && !SessionRefreshGuard.ended(state) &&
      members.all { captured -> current.any { it == captured } }

  fun command(operationId: String): Map<String, Any?> = buildMap {
    put("kind", if (all) "PostponeAll" else "Postpone")
    put("operationId", operationId)
    put("expectedSessionId", sessionId)
    put("alarmAtMs", targetMs)
    if (all) put("members", DeliverySnapshot.maps(members))
    else {
      put("occurrenceId", members.single().occurrenceId)
      put("expectedGeneration", members.single().expectedGeneration)
    }
  }

  /** The custom step is provisional until its own Use action succeeds. */
  fun useCustom(atMs: Long): PostponeDraft {
    val custom = requireNotNull(picker)
    require(custom.step == "custom")
    val result = PostponeTimePolicy.resolve(mapOf("kind" to "Custom", "zoneId" to zoneId,
      "referenceAtMs" to atMs, "local" to custom.local))
    return copy(selection = "custom", targetMs = (result["instantMs"] as Number).toLong(), referenceAtMs = atMs,
      adjustment = result["adjustment"] as String, picker = null)
  }

  fun beginCustom(atMs: Long): PostponeDraft {
    val seed = if (targetMs > atMs) targetMs else (PostponeTimePolicy.resolve(mapOf("kind" to "Relative", "zoneId" to zoneId,
      "referenceAtMs" to atMs, "minutes" to 15))["instantMs"] as Number).toLong()
    return copy(picker = PostponePickerDraft(CivilTime.fromInstant(zoneId, seed)["local"] as String))
  }
}

/** A provisional picker does not replace the last confirmed tile/target on Cancel. */
data class PostponePickerDraft(val local: String, val step: String = "custom") {
  init { require(step in setOf("custom", "date", "time")) }
}

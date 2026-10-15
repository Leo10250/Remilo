package com.remilo.alarm.calendar

import org.json.JSONObject

/** No timestamps or event-wide etag changes participate in field conflict decisions. */
object CalendarComparison {
  data class Result(val desired: JSONObject, val inbound: Set<String>, val outbound: Set<String>, val conflicts: Set<String>)
  fun compare(local: JSONObject, remote: JSONObject, baseline: JSONObject?): Result {
    val desired = JSONObject(local.toString())
    val inbound = linkedSetOf<String>(); val outbound = linkedSetOf<String>(); val conflicts = linkedSetOf<String>()
    for (group in listOf("title", "notes", "schedule")) {
      val l = local.get(group); val r = remote.get(group); val b = baseline?.opt(group)
      when {
        CalendarLinkMapper.equal(l, r) -> Unit
        b == null -> conflicts.add(group)
        CalendarLinkMapper.equal(l, b) -> { inbound.add(group); desired.put(group, r) }
        CalendarLinkMapper.equal(r, b) -> outbound.add(group)
        else -> conflicts.add(group)
      }
    }
    return Result(desired, inbound, outbound, conflicts)
  }
}

package com.remilo.alarm.calendar

import org.json.JSONArray
import java.text.Normalizer
import java.util.Locale
import java.util.UUID

/** Calendar names and descriptions are editable hints. Only native account/ownership checks grant eligibility. */
object CalendarManagedDiscovery {
  const val name = "Remilo"
  private const val markerHeader = "Remilo managed calendar v1\nSetup reference: "
  fun marker(operationId: String): String {
    val parsed = try { UUID.fromString(operationId) } catch (_: IllegalArgumentException) { throw CalendarFailure("INVALID_INPUT") }
    if (parsed.toString() != operationId) throw CalendarFailure("INVALID_INPUT")
    return markerHeader + operationId
  }
  fun markerOperation(description: String): String? {
    if (!description.startsWith(markerHeader)) return null
    val id = description.removePrefix(markerHeader)
    return try { id.takeIf { UUID.fromString(it).toString() == it && marker(it) == description } }
    catch (_: IllegalArgumentException) { null }
  }
  fun normalizedName(value: String) = Normalizer.normalize(value.trim(), Normalizer.Form.NFC).lowercase(Locale.ROOT)
  fun matchingName(calendar: OwnedCalendar) = normalizedName(calendar.canonicalName) == normalizedName(name)
  fun eligibility(calendar: OwnedCalendar, verifiedEmail: String): String? = when {
    calendar.id.isBlank() || calendar.primary || calendar.deleted || calendar.accessRole != "owner" -> "NOT_OWNER"
    calendar.dataOwner.isBlank() || verifiedEmail.isBlank() -> "OWNERSHIP_UNKNOWN"
    !calendar.dataOwner.equals(verifiedEmail, ignoreCase = true) -> "NOT_OWNER"
    calendar.zoneId !in java.time.ZoneId.getAvailableZoneIds() -> "INVALID_ZONE"
    else -> null
  }
  fun requireEligible(calendar: OwnedCalendar, verifiedEmail: String) {
    eligibility(calendar, verifiedEmail)?.let { throw CalendarFailure(it) }
  }
  /** Name-only candidates stay visible for an explicit adoption review; arbitrary renamed calendars do not. */
  fun candidate(calendar: OwnedCalendar, verifiedEmail: String) = !calendar.primary && !calendar.deleted && calendar.accessRole == "owner" &&
    (matchingName(calendar) || markerOperation(calendar.description) != null) &&
    (calendar.dataOwner.isBlank() || calendar.dataOwner.equals(verifiedEmail, ignoreCase = true))
  fun candidates(saved: String): List<OwnedCalendar> {
    val values = JSONArray(saved)
    return (0 until values.length()).map { OwnedCalendar.managedJson(values.getJSONObject(it)) }
  }
  /** Each call inspects at most ten pages; the caller durably captures every page before asking for the next. */
  fun inspect(transport: CalendarTransport, token: String, startCursor: String?, deadlineElapsedMs: Long,
    elapsedMs: () -> Long, checkpoint: (CalendarPage) -> Unit): Int {
    var cursor = startCursor
    var pages = 0
    do {
      if (pages == 10 || elapsedMs() >= deadlineElapsedMs) break
      val page = transport.calendars(token, cursor)
      checkpoint(page)
      pages++
      cursor = page.nextCursor
    } while (cursor != null)
    return pages
  }
}

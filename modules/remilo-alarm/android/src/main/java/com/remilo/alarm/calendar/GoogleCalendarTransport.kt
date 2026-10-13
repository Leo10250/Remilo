package com.remilo.alarm.calendar

import org.json.JSONObject
import java.net.URL
import java.net.URLEncoder
import java.time.OffsetDateTime
import javax.net.ssl.HttpsURLConnection

class GoogleCalendarTransport(private val openConnection: (URL) -> HttpsURLConnection = { it.openConnection() as HttpsURLConnection }) : CalendarTransport {
  internal var deadlineElapsedMs = Long.MAX_VALUE
  private fun path(id: String) = URLEncoder.encode(id, "UTF-8").replace("+", "%20")
  private val base = "https://www.googleapis.com/calendar/v3"
  private fun request(token: String, url: String, payload: String? = null, allowMissing: Boolean = false, method: String = "POST", etag: String? = null, inspect: Boolean = false, incremental: Boolean = false): JSONObject? {
    val remaining = if (deadlineElapsedMs == Long.MAX_VALUE) Long.MAX_VALUE else deadlineElapsedMs - android.os.SystemClock.elapsedRealtime()
    if (remaining <= 0) throw CalendarFailure("BUDGET")
    val connection = openConnection(URL(url))
    try {
      connection.connectTimeout = minOf(10_000L, maxOf(1L, remaining / 2)).toInt()
      connection.readTimeout = minOf(20_000L, maxOf(1L, remaining / 2)).toInt(); connection.instanceFollowRedirects = false
      connection.setRequestProperty("Authorization", "Bearer $token")
      connection.setRequestProperty("Accept", "application/json")
      if (etag != null) connection.setRequestProperty("If-Match", etag)
      if (payload != null) {
        try { connection.requestMethod = method }
        catch (error: java.net.ProtocolException) {
          if (method != "PATCH") throw error
          // Google API's documented method override for URLConnection implementations without PATCH.
          connection.requestMethod = "POST"
          connection.setRequestProperty("X-HTTP-Method-Override", "PATCH")
        }
        connection.doOutput = true
        connection.setRequestProperty("Content-Type", "application/json; charset=UTF-8")
        connection.outputStream.use { it.write(payload.toByteArray(Charsets.UTF_8)) }
      }
      val status = connection.responseCode
      if (allowMissing && status == 404) return null
      if (status !in 200..299) {
        // Parse only bounded error codes, never retain or log the response body.
        val reason = if (status == 403 || status == 410 && inspect) try {
          val bytes = connection.errorStream?.use { it.readNBytes(16_384) }
          bytes?.let { JSONObject(String(it, Charsets.UTF_8)).optJSONObject("error")?.optJSONArray("errors")?.optJSONObject(0)?.optString("reason") }
        } catch (_: Exception) { null } else null
        throw CalendarFailure(when (status) {
        400 -> "BAD_REQUEST"; 401 -> "AUTH"; 403 -> when (reason) {
          "rateLimitExceeded", "userRateLimitExceeded" -> "RETRY"
          "insufficientPermissions" -> "AUTH"
          else -> "FORBIDDEN"
        }
        404 -> "NOT_FOUND"; 409 -> "DUPLICATE"
        410 -> if (incremental) "SYNC_TOKEN_EXPIRED" else if (!inspect) "REMOTE_REMOVED" else if (reason == "deleted") "REMOTE_DELETED" else "REMOTE_UNAVAILABLE"
        412 -> "STALE_REMOTE"
        429, in 500..599 -> "RETRY"; else -> "API_ERROR"
        })
      }
      val bytes = connection.inputStream.use { it.readNBytes(2_000_001) }
      if (bytes.size > 2_000_000) throw CalendarFailure("RESPONSE_LIMIT")
      return JSONObject(String(bytes, Charsets.UTF_8))
    } catch (error: CalendarFailure) { throw error }
    catch (_: Exception) { throw CalendarFailure("NETWORK") }
    finally { connection.disconnect() }
  }
  override fun account(token: String): CalendarAccount {
    val value = request(token, "https://openidconnect.googleapis.com/v1/userinfo")!!
    return CalendarAccount(value.getString("sub"), value.getString("email"))
  }
  override fun calendars(token: String, cursor: String?): CalendarPage {
    val value = request(token, "$base/users/me/calendarList?minAccessRole=owner&maxResults=100&showHidden=true" +
      (cursor?.let { "&pageToken=${path(it)}" } ?: ""))!!
    return page(value)
  }
  internal fun page(value: JSONObject): CalendarPage {
    val rows = value.optJSONArray("items") ?: org.json.JSONArray()
    val items = (0 until rows.length()).map { rows.getJSONObject(it) }.filter {
      it.optString("accessRole") == "owner" && !it.optBoolean("deleted")
    }.map { OwnedCalendar(it.getString("id"), it.optString("summaryOverride", it.optString("summary")), it.optString("timeZone")) }
    return CalendarPage(items, value.optString("nextPageToken").takeIf { it.isNotBlank() })
  }
  override fun calendar(token: String, id: String): OwnedCalendar {
    val value = request(token, "$base/users/me/calendarList/${path(id)}")!!
    if (value.optString("accessRole") != "owner" || value.optBoolean("deleted")) throw CalendarFailure("NOT_OWNER")
    return OwnedCalendar(value.getString("id"), value.optString("summaryOverride", value.optString("summary")), value.optString("timeZone"),
      hasDefaultReminders = (value.optJSONArray("defaultReminders")?.length() ?: 0) > 0)
  }
  override fun event(token: String, calendarId: String, eventId: String): JSONObject? =
    request(token, "$base/calendars/${path(calendarId)}/events/${path(eventId)}", allowMissing = true)
  override fun lookup(token: String, calendarId: String, eventId: String): CalendarEventLookup = try {
    request(token, "$base/calendars/${path(calendarId)}/events/${path(eventId)}", allowMissing = true, inspect = true)
      ?.let { CalendarEventLookup.Found(it) } ?: CalendarEventLookup.Missing
  } catch (error: CalendarFailure) {
    if (error.code == "REMOTE_DELETED") CalendarEventLookup.Deleted else throw error
  }
  /** Repair legacy timestamp encoding at the wire boundary, retaining captured content and identity. */
  private fun publicationPayload(payload: String): String {
    val event = JSONObject(payload)
    for (field in listOf("start", "end")) {
      val bound = event.getJSONObject(field)
      if (bound.has("dateTime")) {
        val instant = try { OffsetDateTime.parse(bound.getString("dateTime")).toInstant() }
        catch (_: java.time.DateTimeException) { throw CalendarFailure("INVALID_EVENT") }
        bound.put("dateTime", instant.toString()) // Instant always includes RFC 3339 seconds; named zone stays intact.
      }
    }
    return event.toString()
  }
  override fun insert(token: String, calendarId: String, payload: String): JSONObject =
    request(token, "$base/calendars/${path(calendarId)}/events?sendUpdates=none", publicationPayload(payload))!!
  override fun events(token: String, calendarId: String, from: String, until: String, cursor: String?): JSONObject =
    request(token, "$base/calendars/${path(calendarId)}/events?singleEvents=true&orderBy=startTime&eventTypes=default&maxResults=100&showDeleted=false&timeMin=${path(from)}&timeMax=${path(until)}" +
      (cursor?.let { "&pageToken=${path(it)}" } ?: ""))!!
  override fun patch(token: String, calendarId: String, eventId: String, etag: String, payload: String): JSONObject {
    if (etag.isBlank()) throw CalendarFailure("INVALID_INPUT")
    return request(token, "$base/calendars/${path(calendarId)}/events/${path(eventId)}?sendUpdates=none", payload, method = "PATCH", etag = etag)!!
  }
  override fun recurringEvents(token: String, calendarId: String, from: String, until: String, cursor: String?): JSONObject =
    request(token, "$base/calendars/${path(calendarId)}/events?singleEvents=false&maxResults=100&showDeleted=false&timeMin=${path(from)}&timeMax=${path(until)}" +
      (cursor?.let { "&pageToken=${path(it)}" } ?: ""))!!
  override fun syncEvents(token: String, calendarId: String, syncToken: String?, pageToken: String?): JSONObject =
    request(token, "$base/calendars/${path(calendarId)}/events?singleEvents=false&showDeleted=true&maxResults=100" +
      (syncToken?.let { "&syncToken=${path(it)}" } ?: "") + (pageToken?.let { "&pageToken=${path(it)}" } ?: ""), incremental = true)!!
  override fun instance(token: String, calendarId: String, masterId: String, originalStart: String): JSONObject? {
    val result = request(token, "$base/calendars/${path(calendarId)}/events/${path(masterId)}/instances?showDeleted=true&maxResults=100&originalStart=${path(originalStart)}")!!
    val rows = result.optJSONArray("items") ?: org.json.JSONArray()
    if (result.optString("nextPageToken").isNotBlank() || rows.length() > 1) throw CalendarFailure("INVALID_INSTANCE")
    return if (rows.length() == 1) rows.getJSONObject(0) else null
  }
  override fun inspectRecurring(token: String, calendar: OwnedCalendar, event: JSONObject): JSONObject = CalendarRecurringReview(this).inspect(token, calendar, event)
}

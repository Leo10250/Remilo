package com.remilo.alarm.calendar

import org.json.JSONObject
import java.net.URL
import java.net.URLEncoder
import javax.net.ssl.HttpsURLConnection

class GoogleCalendarTransport : CalendarTransport {
  private fun path(id: String) = URLEncoder.encode(id, "UTF-8").replace("+", "%20")
  private val base = "https://www.googleapis.com/calendar/v3"
  private fun request(token: String, url: String, payload: String? = null, allowMissing: Boolean = false): JSONObject? {
    val connection = URL(url).openConnection() as HttpsURLConnection
    try {
      connection.connectTimeout = 10_000; connection.readTimeout = 20_000; connection.instanceFollowRedirects = false
      connection.setRequestProperty("Authorization", "Bearer $token")
      connection.setRequestProperty("Accept", "application/json")
      if (payload != null) {
        connection.requestMethod = "POST"; connection.doOutput = true
        connection.setRequestProperty("Content-Type", "application/json; charset=UTF-8")
        connection.outputStream.use { it.write(payload.toByteArray(Charsets.UTF_8)) }
      }
      val status = connection.responseCode
      if (allowMissing && status == 404) return null
      if (status !in 200..299) {
        // Parse only bounded error codes, never retain or log the response body.
        val reason = if (status == 403) try {
          val bytes = connection.errorStream?.use { it.readNBytes(16_384) }
          bytes?.let { JSONObject(String(it, Charsets.UTF_8)).optJSONObject("error")?.optJSONArray("errors")?.optJSONObject(0)?.optString("reason") }
        } catch (_: Exception) { null } else null
        throw CalendarFailure(when (status) {
        401 -> "AUTH"; 403 -> when (reason) {
          "rateLimitExceeded", "userRateLimitExceeded" -> "RETRY"
          "insufficientPermissions" -> "AUTH"
          else -> "FORBIDDEN"
        }
        404 -> "NOT_FOUND"; 409 -> "DUPLICATE"; 410 -> "REMOTE_REMOVED"
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
    return OwnedCalendar(value.getString("id"), value.optString("summaryOverride", value.optString("summary")), value.optString("timeZone"))
  }
  override fun event(token: String, calendarId: String, eventId: String): JSONObject? =
    request(token, "$base/calendars/${path(calendarId)}/events/${path(eventId)}", allowMissing = true)
  override fun insert(token: String, calendarId: String, payload: String): JSONObject =
    request(token, "$base/calendars/${path(calendarId)}/events?sendUpdates=none", payload)!!
}

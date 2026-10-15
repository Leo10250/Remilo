package com.remilo.alarm.calendar

import androidx.room.*

/** All Calendar records are credential-protected and excluded from portable backups. */
@Entity(tableName = "calendar_connection")
data class CalendarConnection(@PrimaryKey val id: String = "google", val revision: Long = 0,
  val connected: Boolean = false, val subject: String = "", val email: String = "",
  val calendarId: String = "", val calendarName: String = "", val calendarZone: String = "",
  val message: String = "")

@Entity(tableName = "calendar_publications")
data class CalendarBinding(@PrimaryKey val occurrenceId: String, val operationId: String)

@Entity(tableName = "calendar_operations")
data class CalendarOperation(@PrimaryKey val operationId: String, val occurrenceId: String,
  val requestKey: String, val reminderRevision: Long, val connectionRevision: Long,
  val subject: String, val email: String, val calendarId: String, val calendarName: String,
  val zoneId: String, val eventId: String, val fingerprint: String, val payload: String,
  val state: String = "Waiting", val attempted: Boolean = false, val readOnly: Boolean = false,
  val message: String = "Ready to publish. Retry to continue.", val htmlLink: String = "",
  val etag: String = "", val publishedAtMs: Long? = null)

@Dao interface CalendarDao {
  @Query("SELECT * FROM calendar_connection WHERE id = 'google'") fun connection(): CalendarConnection?
  @Insert(onConflict = OnConflictStrategy.REPLACE) fun connection(value: CalendarConnection)
  @Query("SELECT * FROM calendar_operations WHERE operationId = :id") fun operation(id: String): CalendarOperation?
  @Query("SELECT * FROM calendar_operations ORDER BY rowid DESC") fun operations(): List<CalendarOperation>
  @Query("SELECT * FROM calendar_operations WHERE occurrenceId = :id") fun operationsFor(id: String): List<CalendarOperation>
  @Insert fun insert(value: CalendarOperation)
  @Update fun update(value: CalendarOperation)
  @Query("SELECT * FROM calendar_publications WHERE occurrenceId = :id") fun binding(id: String): CalendarBinding?
  @Insert fun binding(value: CalendarBinding)
  @Query("DELETE FROM calendar_publications WHERE occurrenceId = :id") fun unbind(id: String)
}

data class OwnedCalendar(val id: String, val name: String, val zoneId: String, val accessRole: String = "owner", val hasDefaultReminders: Boolean = true,
  val canonicalName: String = name, val description: String = "", val dataOwner: String = "", val primary: Boolean = false, val deleted: Boolean = false) {
  fun view(): Map<String, Any> = mapOf("id" to id, "name" to name, "zoneId" to zoneId)
  /** Private setup checkpoints retain metadata, never credentials or arbitrary Calendar event bodies. */
  fun managedJson(): org.json.JSONObject = org.json.JSONObject().put("id", id).put("name", name).put("zoneId", zoneId)
    .put("accessRole", accessRole).put("hasDefaultReminders", hasDefaultReminders).put("canonicalName", canonicalName)
    .put("description", description).put("dataOwner", dataOwner).put("primary", primary).put("deleted", deleted)
  companion object {
    fun managedJson(value: org.json.JSONObject) = OwnedCalendar(value.getString("id"), value.getString("name"), value.getString("zoneId"),
      value.optString("accessRole"), value.optBoolean("hasDefaultReminders"), value.optString("canonicalName", value.getString("name")),
      value.optString("description"), value.optString("dataOwner"), value.optBoolean("primary"), value.optBoolean("deleted"))
  }
}
data class CalendarAccount(val subject: String, val email: String, val emailVerified: Boolean = true)
data class CalendarPage(val items: List<OwnedCalendar>, val nextCursor: String?)
class CalendarFailure(val code: String) : Exception(code)

object CalendarConsent {
  const val calendarCreation = "https://www.googleapis.com/auth/calendar.app.created"
  val required = setOf("https://www.googleapis.com/auth/calendar.calendarlist.readonly",
    "https://www.googleapis.com/auth/calendar.events.owned", "openid", "email")
  fun requiredFor(createCalendar: Boolean = false) = if (createCalendar) required + calendarCreation else required
  fun requireGranted(granted: List<String>, createCalendar: Boolean = false) {
    val normalized = granted.map { if (it == "https://www.googleapis.com/auth/userinfo.email") "email" else it }.toSet()
    if (!normalized.containsAll(requiredFor(createCalendar))) throw CalendarFailure("NEEDS_ACCESS")
  }
}

/** Transport errors never carry server response text or private content. */
sealed class CalendarEventLookup {
  data class Found(val event: org.json.JSONObject) : CalendarEventLookup()
  data object Missing : CalendarEventLookup()
  data object Deleted : CalendarEventLookup()
}
interface CalendarTransport {
  fun account(token: String): CalendarAccount
  fun calendars(token: String, cursor: String?): CalendarPage
  fun calendar(token: String, id: String): OwnedCalendar
  fun createCalendar(token: String, name: String, zoneId: String, description: String): OwnedCalendar = throw CalendarFailure("NOT_AVAILABLE")
  fun event(token: String, calendarId: String, eventId: String): org.json.JSONObject?
  fun lookup(token: String, calendarId: String, eventId: String): CalendarEventLookup =
    event(token, calendarId, eventId)?.let { CalendarEventLookup.Found(it) } ?: CalendarEventLookup.Missing
  fun insert(token: String, calendarId: String, payload: String): org.json.JSONObject
  fun events(token: String, calendarId: String, from: String, until: String, cursor: String?): org.json.JSONObject = throw CalendarFailure("NOT_AVAILABLE")
  fun recurringEvents(token: String, calendarId: String, from: String, until: String, cursor: String?): org.json.JSONObject = events(token, calendarId, from, until, cursor)
  fun syncEvents(token: String, calendarId: String, syncToken: String?, pageToken: String?): org.json.JSONObject = throw CalendarFailure("NOT_AVAILABLE")
  fun instance(token: String, calendarId: String, masterId: String, originalStart: String): org.json.JSONObject? = throw CalendarFailure("NOT_AVAILABLE")
  fun inspectRecurring(token: String, calendar: OwnedCalendar, event: org.json.JSONObject): org.json.JSONObject = event
  fun patch(token: String, calendarId: String, eventId: String, etag: String, payload: String): org.json.JSONObject = throw CalendarFailure("NOT_AVAILABLE")
}

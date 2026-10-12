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

data class OwnedCalendar(val id: String, val name: String, val zoneId: String, val accessRole: String = "owner") {
  fun view(): Map<String, Any> = mapOf("id" to id, "name" to name, "zoneId" to zoneId)
}
data class CalendarAccount(val subject: String, val email: String)
data class CalendarPage(val items: List<OwnedCalendar>, val nextCursor: String?)
class CalendarFailure(val code: String) : Exception(code)

object CalendarConsent {
  val required = setOf("https://www.googleapis.com/auth/calendar.calendarlist.readonly",
    "https://www.googleapis.com/auth/calendar.events.owned", "openid", "email")
  fun requireGranted(granted: List<String>) {
    val normalized = granted.map { if (it == "https://www.googleapis.com/auth/userinfo.email") "email" else it }.toSet()
    if (!normalized.containsAll(required)) throw CalendarFailure("NEEDS_ACCESS")
  }
}

/** Transport errors never carry server response text or private content. */
interface CalendarTransport {
  fun account(token: String): CalendarAccount
  fun calendars(token: String, cursor: String?): CalendarPage
  fun calendar(token: String, id: String): OwnedCalendar
  fun event(token: String, calendarId: String, eventId: String): org.json.JSONObject?
  fun insert(token: String, calendarId: String, payload: String): org.json.JSONObject
}

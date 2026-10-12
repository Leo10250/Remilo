package com.remilo.alarm.calendar

import androidx.room.*

@Entity(tableName = "calendar_links", indices = [Index(value = ["remoteKey"], unique = true)])
data class CalendarLink(@PrimaryKey val occurrenceId: String, val remoteKey: String,
  val subject: String, val calendarId: String, val eventId: String, val calendarName: String,
  val origin: String, val revision: Long = 1, val baseline: String = "", val etag: String = "",
  val state: String = "Linked", val checkedAtMs: Long? = null, val message: String = "",
  val htmlLink: String = "", val erased: Boolean = false)

@Entity(tableName = "calendar_link_operations", indices = [Index(value = ["remoteKey"])])
data class CalendarLinkOperation(@PrimaryKey val operationId: String, val occurrenceId: String,
  val remoteKey: String, val kind: String, val requestKey: String, val subject: String,
  val calendarId: String, val eventId: String, val calendarName: String, val origin: String,
  val expectedRevision: Long, val expectedGeneration: Long, val expectedLinkRevision: Long,
  val expectedConnectionRevision: Long, val etag: String, val remote: String, val desired: String,
  val draft: String, val patch: String, val disableReminders: Boolean, val state: String = "Waiting",
  val localApplied: Boolean = false, val remoteAttempted: Boolean = false,
  val localStatus: String = "", val message: String = "Confirmed request saved. Continue this operation.",
  val erased: Boolean = false, val htmlLink: String = "")

@Dao interface CalendarLinkDao {
  @Query("SELECT * FROM calendar_links") fun links(): List<CalendarLink>
  @Query("SELECT * FROM calendar_links WHERE occurrenceId = :id") fun link(id: String): CalendarLink?
  @Query("SELECT * FROM calendar_links WHERE remoteKey = :key") fun remote(key: String): CalendarLink?
  @Insert(onConflict = OnConflictStrategy.REPLACE) fun put(link: CalendarLink)
  @Query("SELECT * FROM calendar_link_operations WHERE operationId = :id") fun operation(id: String): CalendarLinkOperation?
  @Query("SELECT * FROM calendar_link_operations ORDER BY rowid DESC") fun operations(): List<CalendarLinkOperation>
  @Insert fun insert(operation: CalendarLinkOperation)
  @Update fun update(operation: CalendarLinkOperation)
}

data class CalendarLinkPreview(val id: String, val connectionRevision: Long, val subject: String,
  val calendar: OwnedCalendar, val eventId: String, val etag: String, val remote: String,
  val occurrenceId: String, val local: String, val baseline: String, val revision: Long,
  val generation: Long, val linkRevision: Long, val origin: String, val choices: String,
  val htmlLink: String, val googleReminders: Boolean, val preservedAlertMs: Long? = null)

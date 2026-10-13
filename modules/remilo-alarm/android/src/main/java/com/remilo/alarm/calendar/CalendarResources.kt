package com.remilo.alarm.calendar

import androidx.room.*
import org.json.JSONObject

/** CE-only resource identity/checkpoints for a Schedule spanning masters and exceptions. */
@Entity(tableName = "calendar_resources", primaryKeys = ["associationId", "resourceId"])
data class CalendarResource(val associationId: String, val resourceId: String, val calendarId: String,
  val eventId: String, val segmentId: String, val nominalSlot: String = "", val etag: String = "",
  val fields: String = "", val availability: String = "Unknown")

@Entity(tableName = "calendar_resource_jobs", primaryKeys = ["operationId", "resourceId"])
data class CalendarResourceJob(val operationId: String, val resourceId: String, val associationId: String,
  val calendarId: String, val eventId: String, val etag: String, val desired: String, val payload: String,
  val insert: Boolean = false, val attempted: Boolean = false, val confirmed: Boolean = false,
  val erased: Boolean = false, val outcome: String = "Pending", val lookupMaster: String = "", val originalStart: String = "", val remote: String = "")

@Dao interface CalendarResourceDao {
  @Query("SELECT * FROM calendar_resources WHERE associationId = :id ORDER BY resourceId") fun resources(id: String): List<CalendarResource>
  @Insert(onConflict = OnConflictStrategy.REPLACE) fun put(resource: CalendarResource)
  @Query("SELECT * FROM calendar_resource_jobs WHERE operationId = :id ORDER BY resourceId") fun jobs(id: String): List<CalendarResourceJob>
  @Insert fun insert(job: CalendarResourceJob)
  @Update fun update(job: CalendarResourceJob)
  @Query("DELETE FROM calendar_resources WHERE associationId = :id") fun purge(id: String)
  @Query("UPDATE calendar_resources SET fields = '', etag = '' WHERE associationId = :id") fun clearFields(id: String)
  @Query("UPDATE calendar_resource_jobs SET erased = 1, desired = '', payload = '', etag = '', lookupMaster = '', originalStart = '', remote = '' WHERE associationId = :id") fun erase(id: String)
}

interface CalendarResourceAccess {
  fun jobs(operationId: String): List<CalendarResourceJob>
  /** Runs on the native worker; checks the parent operation's lifecycle permission. */
  fun permit(job: CalendarResourceJob): CalendarResourceJob?
  fun acknowledge(job: CalendarResourceJob, event: JSONObject)
  fun outcome(job: CalendarResourceJob, code: String)
  fun bind(job: CalendarResourceJob, event: JSONObject, zone: String): CalendarResourceJob? = null
  fun rebase(job: CalendarResourceJob, event: JSONObject): CalendarResourceJob? = null
}

/** Immutable child operations; no replay of a confirmed phase or uncertain POST/PATCH. */
class CalendarResourceRunner(private val state: CalendarResourceAccess, private val transport: CalendarTransport) {
  fun run(operationId: String, token: String, zone: String): Boolean {
    for (captured in state.jobs(operationId)) {
      var job = captured
      if (job.erased) return false
      if (job.confirmed) continue
      try {
        if (job.eventId.isEmpty()) {
          val actual = transport.instance(token, job.calendarId, job.lookupMaster, job.originalStart) ?: throw CalendarFailure("REMOTE_UNAVAILABLE")
          if (actual.optString("recurringEventId") != job.lookupMaster || actual.optString("status") == "cancelled") throw CalendarFailure("REMOTE_DELETED")
          val actualOriginal = actual.getJSONObject("originalStartTime")
          val original = actualOriginal.optString("date").ifEmpty { java.time.OffsetDateTime.parse(actualOriginal.getString("dateTime")).toInstant().toString() }
          if (original != job.originalStart) throw CalendarFailure("FOREIGN_IDENTITY")
          job = state.bind(job, actual, zone) ?: return false
        }
        val lookup = transport.lookup(token, job.calendarId, job.eventId)
        val event = (lookup as? CalendarEventLookup.Found)?.event
        if (event != null && event.optString("status") == "cancelled" || lookup == CalendarEventLookup.Deleted) throw CalendarFailure("REMOTE_DELETED")
        if (event != null && matches(job, event, zone)) { state.acknowledge(job, event); continue }
        if (job.attempted) throw CalendarFailure("UNCONFIRMED_RESOURCE")
        if (job.insert && event != null) throw CalendarFailure("FOREIGN_IDENTITY")
        if (!job.insert && event == null) throw CalendarFailure("STALE_REMOTE")
        if (!job.insert && event!!.optString("etag") != job.etag) {
          val current = CalendarLinkMapper.fields(JSONObject(event.toString()).also { it.remove("recurringEventId") }, zone)
          if (job.remote.isEmpty() || !CalendarLinkMapper.equal(CalendarLinkMapper.mainFields(current), CalendarLinkMapper.mainFields(JSONObject(job.remote)))) throw CalendarFailure("RESOURCE_CONFLICT")
          job = state.rebase(job, event) ?: return false
        }
        if (transport.calendar(token, job.calendarId).accessRole != "owner") throw CalendarFailure("NOT_OWNER")
        val permitted = state.permit(job) ?: return false
        val result = if (permitted.insert) transport.insert(token, permitted.calendarId, permitted.payload)
          else transport.patch(token, permitted.calendarId, permitted.eventId, permitted.etag, permitted.payload)
        if (!matches(permitted, result, zone)) throw CalendarFailure("UNCONFIRMED_RESOURCE")
        state.acknowledge(permitted, result)
      } catch (error: CalendarFailure) { state.outcome(job, error.code); return false }
      catch (_: Exception) { state.outcome(job, "NETWORK"); return false }
    }
    return true
  }
  private fun matches(job: CalendarResourceJob, event: JSONObject, zone: String): Boolean {
    if (event.optString("id") != job.eventId || job.insert && !CalendarMapper.matching(event, job.eventId)) return false
    val plain = JSONObject(event.toString()).also { it.remove("recurringEventId") }
    return CalendarLinkMapper.equal(CalendarLinkMapper.mainFields(CalendarLinkMapper.fields(plain, zone)), CalendarLinkMapper.mainFields(JSONObject(job.desired)))
  }
}

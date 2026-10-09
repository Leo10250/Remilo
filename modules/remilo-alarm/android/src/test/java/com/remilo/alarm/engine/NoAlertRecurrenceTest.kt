package com.remilo.alarm.engine

import android.app.Application
import android.content.Context
import android.os.UserManager
import com.remilo.alarm.data.AlertRecord
import com.remilo.alarm.data.BackupCodec
import com.remilo.alarm.data.OperationalDatabase
import com.remilo.alarm.data.ReminderRecord
import com.remilo.alarm.system.AlarmRegistrar
import java.time.Instant
import java.util.TimeZone
import java.util.concurrent.CompletableFuture
import java.util.concurrent.TimeUnit
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34], application = Application::class)
class NoAlertRecurrenceTest {
  private lateinit var context: Context
  private lateinit var engine: AlarmEngine
  private lateinit var originalZone: TimeZone
  private var now = instant("2027-01-01T08:00:00Z")
  private val registered = mutableListOf<AlertRecord>()
  private val start = instant("2027-01-01T09:00:00Z")
  private fun instant(value: String) = Instant.parse(value).toEpochMilli()

  @Before fun setup() {
    originalZone = TimeZone.getDefault()
    TimeZone.setDefault(TimeZone.getTimeZone("UTC"))
    context = RuntimeEnvironment.getApplication()
    shadowOf(context.getSystemService(UserManager::class.java)).setUserUnlocked(true)
    context.deleteDatabase("remilo-content.db")
    context.createDeviceProtectedStorageContext().deleteDatabase("remilo-operational.db")
    engine = AlarmEngine(context, object : AlarmRegistrar {
      override fun canSchedule() = true
      override fun register(alert: AlertRecord) { registered.add(alert) }
      override fun cancel(alert: AlertRecord) {}
    }, { now }, { 10_000L })
  }
  @After fun teardown() {
    engine.close()
    TimeZone.setDefault(originalZone)
  }
  private fun request(body: () -> Any?): Any? {
    val result = CompletableFuture<Any?>()
    engine.request(body, { result.complete(it) }, { result.completeExceptionally(AssertionError(it)) })
    return result.get(20, TimeUnit.SECONDS)
  }
  private fun recover() {
    val result = CompletableFuture<Unit>()
    engine.recover { result.complete(Unit) }
    result.get(20, TimeUnit.SECONDS)
  }
  private fun recurrence(count: Int = 8, floating: Boolean = false) =
    mapOf("frequency" to "daily", "interval" to 1, "count" to count, "zoneMode" to if (floating) "floating" else "pinned")
  private fun draft(offset: Long, count: Int = 8, floating: Boolean = false) = mapOf(
    "title" to "Quiet reminder", "mode" to "None", "eventStartMs" to start,
    "alarmAtMs" to start + offset, "alarmLinked" to false, "zoneId" to "UTC", "recurrence" to recurrence(count, floating))
  private fun create(offset: Long, count: Int = 8, floating: Boolean = false): String {
    val result = request { engine.apply(draft(offset, count, floating) + mapOf("kind" to "CreateSeries", "operationId" to "create:$offset:$count:$floating")) } as Map<*, *>
    assertEquals("Applied", result["status"])
    return result["segmentId"] as String
  }
  private fun rows(): List<AlertRecord> = request {
    val db = OperationalDatabase.open(context)
    try { db.records().all() } finally { db.close() }
  } as List<AlertRecord>
  private fun occurrence(id: String) = request { engine.occurrence(id) } as Map<*, *>
  private fun series(id: String) = request { engine.getSeries(id) } as Map<*, *>
  private fun families() = request { engine.queryRepeatFamilies() } as List<*>
  private fun mutate(id: String, kind: String, revision: Int) {
    val result = request { engine.apply(mapOf("kind" to kind, "operationId" to "$kind:$id:$revision",
      "segmentId" to id, "expectedRevision" to revision)) } as Map<*, *>
    assertEquals("Applied", result["status"])
  }

  @Test fun hiddenAlertOffsetsDoNotChangePreviewUpcomingOrFutureCoverage() {
    for (offset in listOf(-2L * 86_400_000, 2L * 86_400_000)) {
      val preview = request { engine.preview(draft(offset)) } as Map<*, *>
      val dates = (preview["upcoming"] as List<*>).map { (it as Map<*, *>)["eventStartMs"] }
      assertEquals(listOf(start, start + 86_400_000, start + 2 * 86_400_000), dates)
      val segment = create(offset)
      val protected = rows().filter { it.segmentId == segment }
      assertEquals(2, protected.size)
      assertEquals(listOf("2027-01-01T09:00", "2027-01-02T09:00"), protected.map { it.nominalSlot }.sortedBy { it })
      assertTrue(protected.all { it.state == "NoAlert" })
      for (alert in protected) {
        val projected = occurrence(alert.occurrenceId)
        assertEquals((projected["eventStartMs"] as Long) + offset, projected["alarmAtMs"])
      }
      assertEquals(dates, (series(segment)["upcoming"] as List<*>).map { (it as Map<*, *>)["eventStartMs"] })
      val family = families().map { it as Map<*, *> }.single { it["seriesId"] == segment }
      assertEquals("Active", family["state"])
      assertEquals(dates, (family["upcoming"] as List<*>).map { (it as Map<*, *>)["eventStartMs"] })
    }
    assertTrue(registered.isEmpty())
  }

  @Test fun pauseResumeAndCatchupRetainElapsedWhenSlotsDespiteHiddenOffsets() {
    val segments = listOf(-2L * 86_400_000, 2L * 86_400_000).map { create(it) }
    segments.forEach { mutate(it, "PauseSeries", 1) }
    now = instant("2027-01-06T08:00:00Z")
    for (segment in segments) {
      mutate(segment, "ResumeSeries", 2)
      val protected = rows().filter { it.segmentId == segment }
      assertEquals(7, protected.size)
      assertTrue(protected.all { it.state == "NoAlert" })
      val page = request { engine.query(mapOf("view" to "overdue", "segmentId" to segment), null) } as Map<*, *>
      assertEquals(5, page["total"])
      assertEquals(listOf(start + 5 * 86_400_000, start + 6 * 86_400_000, start + 7 * 86_400_000),
        (series(segment)["upcoming"] as List<*>).map { (it as Map<*, *>)["eventStartMs"] })
    }
    assertTrue(registered.isEmpty())
  }

  @Test fun exhaustedNoAlertFamilyDoesNotWaitForItsHiddenAlarm() {
    val segment = create(2L * 86_400_000, count = 3)
    now = instant("2027-01-03T10:00:00Z")
    recover()
    assertEquals(3, rows().filter { it.segmentId == segment }.size)
    assertEquals(true, series(segment)["exhausted"])
    val family = families().single() as Map<*, *>
    assertEquals("Ended", family["state"])
    assertTrue((family["upcoming"] as List<*>).isEmpty())
    assertEquals(3, family["unfinishedCount"])
    assertEquals(3, (request { engine.query("overdue", null) } as Map<*, *>)["total"])
    assertTrue(registered.isEmpty())
  }

  @Test fun seriesEditKeepsElapsedNoAlertOccurrenceInsteadOfReplacingItsHiddenFutureAlarm() {
    val offset = 2L * 86_400_000
    val segment = create(offset, count = 5)
    val first = rows().filter { it.segmentId == segment }.minBy { it.nominalSlot!! }
    now = start + 60_000
    val result = request { engine.apply(mapOf("kind" to "EditSeries", "operationId" to "edit-quiet", "segmentId" to segment,
      "expectedRevision" to 1, "eventStartMs" to now + 60_000, "alarmAtMs" to now + 60_000 + offset,
      "recurrence" to recurrence(3))) } as Map<*, *>
    assertEquals("Applied", result["status"])
    val retained = occurrence(first.occurrenceId)
    assertEquals(start, retained["eventStartMs"])
    assertEquals(false, retained["skipped"])
    assertEquals(true, retained["overdue"])
    assertEquals("NoAlert", retained["deliveryState"])
    assertEquals(1, (request { engine.query(mapOf("view" to "overdue", "seriesId" to segment), null) } as Map<*, *>)["total"])
  }

  @Test fun floatingNoAlertTravelMovesFutureWhenAndRetainsElapsedWhen() {
    val segment = create(-2L * 86_400_000, floating = true)
    val first = rows().filter { it.segmentId == segment }.minBy { it.nominalSlot!! }
    TimeZone.setDefault(TimeZone.getTimeZone("America/Los_Angeles"))
    recover()
    assertEquals(start + 8 * 3_600_000, occurrence(first.occurrenceId)["eventStartMs"])
    assertEquals(first.nominalSlot, rows().single { it.occurrenceId == first.occurrenceId }.nominalSlot)
    now = start + 8 * 3_600_000 + 60_000
    TimeZone.setDefault(TimeZone.getTimeZone("America/New_York"))
    recover()
    assertEquals(start + 8 * 3_600_000, occurrence(first.occurrenceId)["eventStartMs"])
    assertEquals("America/Los_Angeles", occurrence(first.occurrenceId)["zoneId"])
    assertTrue(registered.isEmpty())
  }

  @Test fun floatingNoAlertTravelProjectsAFutureWhenEvenWhenItMovesIntoThePast() {
    val segment = create(-2L * 86_400_000, floating = true)
    val first = rows().filter { it.segmentId == segment }.minBy { it.nominalSlot!! }
    TimeZone.setDefault(TimeZone.getTimeZone("Asia/Tokyo"))
    recover()
    val projected = occurrence(first.occurrenceId)
    assertEquals(start - 9 * 3_600_000, projected["eventStartMs"])
    assertEquals("Asia/Tokyo", projected["zoneId"])
    assertEquals(true, projected["overdue"])
    assertEquals(first.nominalSlot, rows().single { it.occurrenceId == first.occurrenceId }.nominalSlot)
    assertEquals(1, (request { engine.query("overdue", null) } as Map<*, *>)["total"])
    assertTrue(registered.isEmpty())
  }

  @Test fun importedAllDayDurationAndDueDoNotExtendTheScheduledDateBoundary() {
    val day = instant("2027-01-01T00:00:00Z")
    val record = ReminderRecord("imported", "All day", day, day + 3 * 86_400_000, day + 4 * 86_400_000, now,
      mode = "None", definedAlarmAtMs = day + 5 * 86_400_000, allDay = true, zoneId = "UTC", dueLinked = false, alarmLinked = false)
    val backup = BackupCodec.encode(listOf(record), emptyMap(), emptyList(), now)
    val imported = request { engine.importBackup(backup, emptyList(), "import-all-day") } as Map<*, *>
    assertEquals("Applied", imported["status"])
    val projected = occurrence(record.id)
    assertEquals(day, projected["agendaAtMs"])
    assertEquals(day + 86_400_000, projected["overdueAtMs"])
    assertEquals(false, projected["overdue"])
    now = day + 86_400_000 + 1
    assertEquals(true, occurrence(record.id)["overdue"])
    assertTrue(registered.isEmpty())
  }
}

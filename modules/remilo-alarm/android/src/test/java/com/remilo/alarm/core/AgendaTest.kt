package com.remilo.alarm.core
import java.time.Instant
import java.time.ZoneId
import org.junit.Assert.*
import org.junit.Test

class AgendaTest {
  private val now = Instant.parse("2026-10-04T19:00:00Z").toEpochMilli()
  private val zone = ZoneId.of("America/Los_Angeles")
  @Test fun browsingDateRemainsIndependentOfTheOverdueReference() {
    assertEquals("2026-10-04", Agenda.group(now - 3600000, now + 3600000, false, false, now, zone))
    assertEquals("earlier", Agenda.group(now - 86400000, now + 3600000, false, false, now, zone))
  }
  @Test fun overdueTakesPriorityOverFutureDeliveryDate() {
    assertEquals("overdue", Agenda.group(now + 86400000, now - 1, false, false, now, zone))
    assertEquals("completed", Agenda.group(now, now - 1, true, false, now, zone))
    assertEquals("completed", Agenda.group(now, now - 1, false, true, now, zone))
  }
  @Test fun anAlertAtThisExactInstantIsNotYetOverdue() {
    assertEquals("2026-10-04", Agenda.group(now, now, false, false, now, zone))
    assertEquals("overdue", Agenda.group(now + 86_400_000, now, false, false, now + 1, zone))
  }
  @Test fun groupDateUsesLocalZoneRatherThanUtcDay() {
    val event = Instant.parse("2026-10-05T01:00:00Z").toEpochMilli()
    assertEquals("2026-10-04", Agenda.group(event, event, false, false, now, zone))
    assertEquals("2026-10-05", Agenda.group(event, event, false, false, now, ZoneId.of("UTC")))
  }
}

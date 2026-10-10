package com.remilo.alarm.data

import android.app.Application
import com.remilo.alarm.core.RecurrenceRule
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.time.LocalDateTime

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34], application = Application::class)
class BackupCodecTest {
  @Test fun versionFourExclusionsAreContentFreeAndRejectMalformedOrOverlappingIdentities() {
    val nominal = "2027-01-01T09:00"
    val id = java.util.UUID.nameUUIDFromBytes("remilo:segment:$nominal".toByteArray()).toString()
    val template = SeriesRecord("segment", "family", JSONObject(BackupCodec.record(record)).toString(), rule, createdAtMs = 500)
    val exclusion = PurgedOccurrence(id, "segment", nominal)
    val json = BackupCodec.encode(emptyList(), emptyMap(), emptyList(), 500, listOf(template), purged = listOf(exclusion))
    assertEquals(listOf(exclusion), BackupCodec.decode(json).purged)
    val encoded = JSONObject(json).getJSONArray("purgedOccurrences").getJSONObject(0)
    assertEquals(setOf("id", "segmentId", "nominalSlot"), encoded.keys().asSequence().toSet())
    listOf("id" to "wrong", "segmentId" to "missing", "nominalSlot" to "not-a-date").forEach { (field, value) ->
      val root = JSONObject(json); root.getJSONArray("purgedOccurrences").getJSONObject(0).put(field, value)
      assertThrows(Exception::class.java) { BackupCodec.decode(root.toString()) }
    }
    val duplicate = JSONObject(json); duplicate.getJSONArray("purgedOccurrences").put(JSONObject(encoded.toString()))
    assertThrows(IllegalArgumentException::class.java) { BackupCodec.decode(duplicate.toString()) }
    val overlap = BackupCodec.encode(listOf(record.copy(id = id, segmentId = "segment", nominalSlot = nominal)), emptyMap(), emptyList(),
      500, listOf(template), purged = listOf(exclusion))
    assertThrows(IllegalArgumentException::class.java) { BackupCodec.decode(overlap) }
  }
  @Test fun existingVersionThreeBackupStillReadsWithoutExclusions() {
    val root = JSONObject(BackupCodec.encode(listOf(record), emptyMap(), emptyList(), 500))
    root.put("version", 3); root.remove("purgedOccurrences")
    val bundle = BackupCodec.decode(root.toString())
    assertEquals(record.id, bundle.records.single().id); assertTrue(bundle.purged.isEmpty())
  }
  private val record = ReminderRecord("one-off", "Reminder", 1000, 2000, 1500, 500,
    definedAlarmAtMs = 1000, zoneId = "UTC")
  private val rule = RuleCodec.encode(RecurrenceRule(LocalDateTime.of(2027, 1, 1, 9, 0), "daily", count = 3, zoneId = "UTC"))

  private fun legacy(version: Int, records: List<ReminderRecord>, templates: List<SeriesRecord> = emptyList()): String {
    val root = JSONObject(BackupCodec.encode(records, emptyMap(), emptyList(), 500, templates))
    root.put("version", version); root.remove("lists")
    val items = root.getJSONArray("reminders")
    for (index in 0 until items.length()) {
      val item = items.getJSONObject(index)
      item.remove("listId")
      if (version == 1) listOf("deleted", "segmentId", "nominalSlot", "exception", "skipped").forEach(item::remove)
    }
    if (version == 1) root.remove("series") else {
      val series = root.getJSONArray("series")
      for (index in 0 until series.length()) series.getJSONObject(index).getJSONObject("template").remove("listId")
    }
    return root.toString()
  }

  @Test fun versionOneReaderGivesExactLegacyNamesDistinctStableIdentities() {
    val rows = listOf(record.copy(listName = "Work"), record.copy(id = "lowercase", listName = "work"),
      record.copy(id = "spaced", listName = " Work "), record.copy(id = "no-list"))
    val bundle = BackupCodec.decode(legacy(1, rows))
    assertEquals(setOf("Work", "work", " Work "), bundle.lists.map { it.name }.toSet())
    assertEquals(3, bundle.lists.map { it.id }.toSet().size)
    rows.forEach { source ->
      val decoded = bundle.records.single { it.id == source.id }
      assertEquals(if (source.listName.isEmpty()) null else ListNames.legacyId(source.listName), decoded.listId)
      assertEquals(source.listName, decoded.listName)
      assertFalse(decoded.deleted); assertFalse(decoded.skipped)
    }
    assertEquals(bundle.lists, BackupCodec.decode(legacy(1, rows)).lists)
  }

  @Test fun versionTwoReaderRetainsArchivedAndPausedTemplatesAndTheirLegacyMemberships() {
    val templates = listOf(SeriesRecord("archived", "family", JSONObject(BackupCodec.record(record.copy(id = "template-a", listName = "Archive"))).toString(),
      rule, state = "Archived", createdAtMs = 500),
      SeriesRecord("paused", "family", JSONObject(BackupCodec.record(record.copy(id = "template-p", listName = "History"))).toString(),
        rule, state = "Paused", createdAtMs = 500))
    val bundle = BackupCodec.decode(legacy(2, listOf(record.copy(completed = true, deleted = true)), templates))
    assertEquals(setOf("Archive", "History"), bundle.lists.map { it.name }.toSet())
    assertEquals(setOf("Archived", "Paused"), bundle.series.map { it.state }.toSet())
    bundle.series.forEach { source ->
      val template = BackupCodec.decodeRecord(JSONObject(source.template))
      assertEquals(ListNames.legacyId(template.listName), template.listId)
    }
    assertTrue(bundle.records.single().completed); assertTrue(bundle.records.single().deleted)
  }

  @Test fun versionThreeRoundTripRetainsEmptyListsAndTemplateMembershipIds() {
    val empty = ListRecord("empty-list", "Empty", "empty", createdAtMs = 500)
    val used = ListRecord("used-list", "Used", "used", createdAtMs = 500)
    val template = SeriesRecord("segment", "family", JSONObject(BackupCodec.record(record.copy(id = "template", listId = used.id, listName = used.name))).toString(),
      rule, state = "Archived", createdAtMs = 500)
    val bundle = BackupCodec.decode(BackupCodec.encode(emptyList(), emptyMap(), emptyList(), 500, listOf(template), listOf(empty, used)))
    assertEquals(setOf(empty.id, used.id), bundle.lists.map { it.id }.toSet())
    assertTrue(bundle.records.isEmpty())
    assertEquals(used.id, BackupCodec.decodeRecord(JSONObject(bundle.series.single().template)).listId)
    assertEquals("Archived", bundle.series.single().state)
  }

  @Test fun invalidMembershipIsRejectedBeforeImportCanWriteAnything() {
    val root = JSONObject(BackupCodec.encode(listOf(record.copy(listId = "missing")), emptyMap(), emptyList(), 500))
    assertThrows(IllegalArgumentException::class.java) { BackupCodec.decode(root.toString()) }
    root.put("lists", JSONArray().put(JSONObject(mapOf("id" to "missing", "name" to "Work", "createdAtMs" to 500))))
    assertEquals("Work", BackupCodec.decode(root.toString()).records.single().listName)
  }
}

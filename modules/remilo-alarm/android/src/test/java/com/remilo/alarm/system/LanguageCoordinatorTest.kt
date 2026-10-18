package com.remilo.alarm.system

import android.app.Application
import android.app.LocaleManager
import android.content.Context
import android.os.LocaleList
import androidx.room.Room
import com.remilo.alarm.data.LanguageRecord
import com.remilo.alarm.data.OperationalDatabase
import com.remilo.alarm.presentation.L10n
import org.junit.After
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34], application = Application::class)
class LanguageCoordinatorTest {
  private fun <T> OperationalDatabase.withDatabase(block: (OperationalDatabase) -> T): T = try { block(this) } finally { close() }
  private val context: Context get() = RuntimeEnvironment.getApplication()
  @After fun reset() { PresentationLanguage.update(context, "en") }
  @Test fun orderedLanguageMatchingRespectsChineseScript() {
    assertEquals("zh-Hans", LanguageCoordinator.resolve(listOf("fr", "zh-Hans-SG", "en")))
    assertEquals("en", LanguageCoordinator.resolve(listOf("zh-Hant-CN", "zh-TW", "zh-HK", "zh-MO")))
    assertEquals("zh-Hans", LanguageCoordinator.resolve(listOf("zh-Hans-HK")))
    assertEquals("zh-Hans", LanguageCoordinator.resolve(listOf("zh-CN")))
    assertEquals("zh-Hans", LanguageCoordinator.resolve(listOf("zh-SG")))
    assertEquals("en", LanguageCoordinator.resolve(listOf("en-GB", "zh-CN")))
    assertEquals("en", LanguageCoordinator.resolve(emptyList()))
  }
  @Test fun translatedAlarmCopyCannotChangeCapturedCommandKinds() {
    val expected = mapOf(
      AlarmControlAction.CompleteDelivery to "CompleteDelivery",
      AlarmControlAction.StartRoutine to "StartRoutine",
      AlarmControlAction.DismissRoutine to "DismissRoutineAlarm",
      AlarmControlAction.RoutineSnooze to "SnoozeRoutineAlarm",
      AlarmControlAction.Snooze to "Snooze",
      AlarmControlAction.DoneAll to "DoneAll",
      AlarmControlAction.SnoozeAll to "SnoozeAll")
    PresentationLanguage.update(context, "en")
    val english = AlarmControlAction.entries.associateWith { it.commandKind }
    assertEquals(expected, english)
    assertEquals("Start routine", L10n.text(context, "Start routine"))
    assertEquals("Dismiss alarm", L10n.text(context, "Dismiss alarm"))
    PresentationLanguage.update(context, "zh-Hans")
    assertEquals(expected, AlarmControlAction.entries.associateWith { it.commandKind })
    assertEquals(english, AlarmControlAction.entries.associateWith { it.commandKind })
    assertEquals("开始计划", L10n.text(context, "Start routine"))
    assertEquals("\u5173\u95ed\u95f9\u949f", L10n.text(context, "Dismiss alarm"))
    assertNotEquals(L10n.text(context, "Start routine"), AlarmControlAction.StartRoutine.commandKind)
    assertNotEquals(L10n.text(context, "Dismiss alarm"), AlarmControlAction.DismissRoutine.commandKind)
    assertNotEquals(AlarmControlAction.CompleteDelivery.commandKind, AlarmControlAction.StartRoutine.commandKind)
    assertNotEquals(AlarmControlAction.CompleteDelivery.commandKind, AlarmControlAction.DismissRoutine.commandKind)
    assertEquals("稍后提醒", L10n.text(context, "Snooze"))
    for (count in listOf(1, 2)) assertEquals("$count 项未完成提醒需要查看。", L10n.text(com.remilo.alarm.presentation.NativeMessages.calendar_review_notification(count)))
  }
  @Test fun legacyInitializationPinsEnglishBeforePrivateStorageIsAvailable() {
    Room.inMemoryDatabaseBuilder(context, OperationalDatabase::class.java).allowMainThreadQueries().build().withDatabase { db ->
      val manager = context.getSystemService(LocaleManager::class.java)
      manager.applicationLocales = LocaleList.getEmptyLocaleList()
      db.records().language(LanguageRecord(preference = "en"))
      val owner = LanguageCoordinator(context, db.records())
      val saved = owner.reconcile()
      assertEquals("en", saved.preference)
      assertEquals("en", manager.applicationLocales[0].language)
      assertFalse(saved.pendingProjection)
      val snapshot = owner.snapshot()
      assertEquals(setOf("languagePreference", "resolvedLanguage", "localeTag", "uses24HourClock"), snapshot.keys)
      assertEquals("en", snapshot["resolvedLanguage"])
    }
  }
  @Test fun explicitSystemChoiceBeforeInitializationIsKept() {
    Room.inMemoryDatabaseBuilder(context, OperationalDatabase::class.java).allowMainThreadQueries().build().withDatabase { db ->
      context.getSystemService(LocaleManager::class.java).applicationLocales = LocaleList.forLanguageTags("zh-Hans")
      val owner = LanguageCoordinator(context, db.records())
      assertEquals("zh-Hans", owner.reconcile().preference)
      owner.snapshot()
      assertEquals("标记为完成", L10n.text(context, "Mark as done"))
    }
  }
  @Test fun freshAndUnopenedOlderInstallationsInitializeOnceFromInstallMetadata() {
    for ((updated, expected) in listOf(false to "system", true to "en")) {
      Room.inMemoryDatabaseBuilder(context, OperationalDatabase::class.java).allowMainThreadQueries().build().withDatabase { db ->
        context.getSystemService(LocaleManager::class.java).applicationLocales = LocaleList.getEmptyLocaleList()
        var metadataReads = 0
        val owner = LanguageCoordinator(context, db.records(), wasUpdated = { metadataReads++; updated })
        assertEquals(expected, owner.reconcile().preference)
        assertEquals(expected, owner.reconcile().preference)
        assertEquals(1, metadataReads)
      }
    }
  }
  @Test fun unknownHistoricalProseCannotMatchAnUnrelatedPresentationTemplate() {
    PresentationLanguage.update(context, "zh-Hans")
    assertNull(L10n.calendarDescriptor("Legacy unknown status at lunchtime"))
    assertEquals("此历史记录的详细说明暂不可用。", L10n.stored("", "{}", "Legacy unknown status at lunchtime"))
    assertNotNull(L10n.calendarDescriptor("Google account connected. Review Calendar setup to continue."))
  }
  @Test fun interruptedProjectionRepairsOnceAndExternalChoiceAdvancesItsRevision() {
    Room.inMemoryDatabaseBuilder(context, OperationalDatabase::class.java).allowMainThreadQueries().build().withDatabase { db ->
      val manager = context.getSystemService(LocaleManager::class.java)
      manager.applicationLocales = LocaleList.forLanguageTags("en")
      db.records().language(LanguageRecord(preference = "zh-Hans", projected = "en", pendingProjection = true, settingsRevision = 7))
      val owner = LanguageCoordinator(context, db.records())
      val repaired = owner.reconcile()
      assertEquals("zh-Hans", repaired.projected)
      assertEquals(repaired, owner.reconcile())
      manager.applicationLocales = LocaleList.getEmptyLocaleList()
      val external = owner.reconcile()
      assertEquals("system", external.preference)
      assertTrue(external.externalPending)
      assertTrue(external.revision > repaired.revision)
      assertEquals(7L, external.settingsRevision)
      owner.imported(8)
      assertFalse(owner.reconcile().externalPending)
      assertEquals(8L, owner.reconcile().settingsRevision)
    }
  }
  @Test fun changingLanguagePreservesExplicitDeviceClockChoice() {
    Room.inMemoryDatabaseBuilder(context, OperationalDatabase::class.java).allowMainThreadQueries().build().withDatabase { db ->
      val owner = LanguageCoordinator(context, db.records())
      android.provider.Settings.System.putString(context.contentResolver, android.provider.Settings.System.TIME_12_24, "12")
      owner.commit("zh-Hans", 2)
      assertEquals(false, owner.snapshot()["uses24HourClock"])
      android.provider.Settings.System.putString(context.contentResolver, android.provider.Settings.System.TIME_12_24, "24")
      owner.commit("en", 3)
      assertEquals(true, owner.snapshot()["uses24HourClock"])
    }
  }
  @Test fun newerExternalSelectionSupersedesAnInterruptedProjection() {
    Room.inMemoryDatabaseBuilder(context, OperationalDatabase::class.java).allowMainThreadQueries().build().withDatabase { db ->
      val manager = context.getSystemService(LocaleManager::class.java)
      manager.applicationLocales = LocaleList.getEmptyLocaleList()
      db.records().language(LanguageRecord(preference = "zh-Hans", projected = "en", pendingProjection = true, settingsRevision = 7))
      val owner = LanguageCoordinator(context, db.records())
      val external = owner.reconcile()
      assertEquals("system", external.preference)
      assertTrue(external.externalPending)
      assertFalse(external.pendingProjection)
      assertTrue(manager.applicationLocales.isEmpty)
      assertEquals(external, owner.reconcile())
    }
  }
  @Test fun failedProjectionRetainsItsTargetAndLastConfirmedPresentation() {
    Room.inMemoryDatabaseBuilder(context, OperationalDatabase::class.java).allowMainThreadQueries().build().withDatabase { db ->
      context.getSystemService(LocaleManager::class.java).applicationLocales = LocaleList.forLanguageTags("en")
      db.records().language(LanguageRecord(preference = "en", projected = "en", settingsRevision = 7))
      val interrupted = LanguageCoordinator(context, db.records(), beforeProjection = { throw IllegalStateException("injected") })
      try { interrupted.commit("zh-Hans", 8); fail("Projection must remain unacknowledged") } catch (_: IllegalStateException) { }
      assertTrue(db.records().language()!!.pendingProjection)
      assertEquals("zh-Hans", db.records().language()!!.preference)
      assertEquals("en", interrupted.cachedSnapshot()["resolvedLanguage"])
      val recovered = LanguageCoordinator(context, db.records())
      assertEquals("zh-Hans", recovered.snapshot()["resolvedLanguage"])
      assertFalse(db.records().language()!!.pendingProjection)
    }
  }
}

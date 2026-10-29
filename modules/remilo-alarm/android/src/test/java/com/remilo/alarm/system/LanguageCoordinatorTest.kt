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
    val english = AlarmControlAction.entries.map { it.commandKind }
    PresentationLanguage.update(context, "zh-Hans")
    assertEquals(listOf("CompleteDelivery", "Postpone", "DoneAll", "PostponeAll"), english)
    assertEquals(english, AlarmControlAction.entries.map { it.commandKind })
    assertEquals("稍后提醒", L10n.text(context, "Snooze"))
    assertEquals("推迟", L10n.text(context, com.remilo.alarm.presentation.NativeMessages.postpone_action()))
    assertEquals("全部推迟（3）", L10n.text(context, com.remilo.alarm.presentation.NativeMessages.postpone_all_action(3)))
    for (count in listOf(1, 2)) assertEquals("$count 项未完成提醒需要查看。", L10n.text(com.remilo.alarm.presentation.NativeMessages.calendar_review_notification(count)))
  }
  @Test fun postponeTilesCustomAndLockedFeedbackUseSimplifiedChinese() {
    PresentationLanguage.update(context, "zh-Hans")
    val expected = mapOf(
      "15 min" to "15 分钟", "30 min" to "30 分钟", "1 hour" to "1 小时",
      "1 day" to "1 天", "24 hours later" to "24 小时后", "Tomorrow" to "明天",
      "Custom" to "自定", "Date & time" to "日期和时间", "Use this time" to "使用此时间",
      "Back to choices" to "返回选项", "Choose a future time." to "请选择未来的时间。",
      "Saved times are available after unlocking." to "解锁后可使用已保存的时间。",
      "Only the next alert changes. The reminder stays unfinished." to "仅更改下次提醒时间，此提醒仍未完成。"
    )
    expected.forEach { (english, chinese) -> assertEquals(english, chinese, L10n.text(context, english)) }
    assertEquals("全部 3 个提醒的下次时间", L10n.text(context, com.remilo.alarm.presentation.NativeMessages.postpone_next_group(3)))
    assertEquals("已安排 3 个提醒中的 2 个，请在 Remilo 中检查提醒问题。",
      L10n.text(context, com.remilo.alarm.presentation.NativeMessages.postpone_partial(2, 3)))
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

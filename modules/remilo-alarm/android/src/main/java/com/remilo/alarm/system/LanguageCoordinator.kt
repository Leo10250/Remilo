package com.remilo.alarm.system

import android.app.LocaleManager
import android.content.Context
import android.content.res.Configuration
import android.os.LocaleList
import android.provider.Settings
import android.text.format.DateFormat
import com.remilo.alarm.data.LanguageRecord
import com.remilo.alarm.data.OperationalDao
import java.util.Locale

/** Called only on Remilo-state. The protected singleton contains enums/epochs only. */
class LanguageCoordinator(private val context: Context, private val dao: OperationalDao,
  private val wasUpdated: () -> Boolean = {
    val info = context.packageManager.getPackageInfo(context.packageName, 0)
    info.lastUpdateTime > info.firstInstallTime
  }, private val beforeProjection: () -> Unit = {}) {
  private val manager get() = context.getSystemService(LocaleManager::class.java)
  private fun systemPreference(): String {
    val tags = manager.applicationLocales
    return if (tags.isEmpty) "system" else resolve((0 until tags.size()).map { tags[it].toLanguageTag() })
  }
  fun reconcile(): LanguageRecord {
    var record = dao.language()
    if (record == null) {
      val existing = wasUpdated()
      val explicit = systemPreference()
      record = LanguageRecord(preference = if (explicit != "system") explicit else if (existing) "en" else "system")
      dao.language(record)
    }
    if (record.projected.isEmpty()) {
      val explicit = systemPreference()
      if (explicit != "system") record = record.copy(preference = explicit, externalPending = true)
      record = record.copy(pendingProjection = true)
      dao.language(record)
    }
    if (record.pendingProjection) {
      val selected = systemPreference()
      // A third value can only be a newer external choice. A recovered write
      // must not replace it with its captured, now stale target.
      if (record.projected.isNotEmpty() && selected != record.projected && selected != record.preference) {
        return record.copy(preference = selected, projected = selected, pendingProjection = false,
          revision = record.revision + 1, externalPending = true).also { dao.language(it) }
      }
      return project(record)
    }
    val selected = systemPreference()
    if (selected != record.projected) {
      record = record.copy(preference = selected, projected = selected, revision = record.revision + 1, externalPending = true)
      dao.language(record)
    }
    return record
  }
  private fun project(record: LanguageRecord): LanguageRecord {
    if (systemPreference() != record.preference) {
      beforeProjection()
      manager.applicationLocales = if (record.preference == "system") LocaleList.getEmptyLocaleList() else LocaleList.forLanguageTags(record.preference)
    }
    check(systemPreference() == record.preference) { "Language projection not confirmed" }
    return record.copy(projected = record.preference, pendingProjection = false).also { dao.language(it) }
  }
  fun commit(preference: String, settingsRevision: Long): LanguageRecord {
    require(preference in selections)
    val old = dao.language() ?: reconcile()
    val next = old.copy(preference = preference, settingsRevision = settingsRevision,
      revision = old.revision + if (old.preference == preference) 0 else 1, pendingProjection = true, externalPending = false)
    dao.language(next)
    return project(next)
  }
  fun imported(settingsRevision: Long) { dao.language(reconcile().copy(settingsRevision = settingsRevision, externalPending = false)) }
  fun snapshot(): Map<String, Any> = snapshotFor(reconcile().preference)
  /** Last confirmed projection remains usable if the Android locale service fails. */
  fun cachedSnapshot(): Map<String, Any> {
    val record = dao.language()
    val selected = record?.projected?.takeIf { it in selections } ?: record?.preference?.takeIf { it in selections } ?: "en"
    return snapshotFor(selected)
  }
  private fun snapshotFor(preference: String): Map<String, Any> {
    val systems = runCatching { manager.systemLocales }.getOrElse { android.content.res.Resources.getSystem().configuration.locales }
    val resolved = if (preference == "system") resolve((0 until systems.size()).map { systems[it].toLanguageTag() }) else preference
    val configuration = Configuration(context.resources.configuration).apply { setLocales(systems) }
    val clockContext = context.createConfigurationContext(configuration)
    val explicitClock = runCatching { Settings.System.getString(context.contentResolver, Settings.System.TIME_12_24) }.getOrNull()
    val clock24 = when(explicitClock) { "12" -> false; "24" -> true; else -> DateFormat.is24HourFormat(clockContext) }
    val region = systems.takeUnless { it.isEmpty }?.get(0)?.country.orEmpty()
    val locale = Locale.Builder().setLanguageTag(resolved).apply { if (region.isNotEmpty()) setRegion(region) }.build()
    PresentationLanguage.update(context, resolved, locale.toLanguageTag())
    return mapOf("languagePreference" to preference, "resolvedLanguage" to resolved,
      "localeTag" to locale.toLanguageTag(), "uses24HourClock" to clock24)
  }
  companion object {
    val selections = setOf("system", "en", "zh-Hans")
    fun resolve(tags: List<String>): String {
      tags.forEach { tag ->
        val locale = Locale.forLanguageTag(tag.replace('_', '-'))
        if (locale.language == "en") return "en"
        if (locale.language == "zh" && locale.script != "Hant" && (locale.script == "Hans" || locale.country !in setOf("TW", "HK", "MO"))) return "zh-Hans"
      }
      return "en"
    }
  }
}

/** Process-local rendering cache. No private content and no engine/JS dependency. */
object PresentationLanguage {
  @Volatile var language: String = "en"; private set
  @Volatile var localeTag: String = "en"; private set
  @Volatile private var localized: Context? = null
  fun cachedContext(): Context? = localized
  fun update(context: Context, language: String, localeTag: String = language) {
    this.language = language
    this.localeTag = localeTag
    localized = context.createConfigurationContext(Configuration(context.resources.configuration).apply { setLocale(Locale.forLanguageTag(localeTag)) })
  }
  fun context(fallback: Context): Context = localized ?: fallback.createConfigurationContext(Configuration(fallback.resources.configuration).apply { setLocale(Locale.ENGLISH) })
}

package com.remilo.alarm.widget

import android.content.Context
import android.os.UserManager
import com.remilo.alarm.core.AppearancePolicy
import org.json.JSONObject

data class WidgetConfiguration(val mode: String = "Today", val routineId: String? = null, val revision: Long = 0)
/** Discardable feedback only. Never serialized to preferences, DP or portable backup. */
data class WidgetActionFeedback(val busy: Boolean = false, val saving: Boolean = false, val confirmation: String? = null)
data class WidgetSnapshot(val id: Int, val configuration: WidgetConfiguration = WidgetConfiguration(),
  val date: String = "", val appearance: AppearancePolicy.Resolved = AppearancePolicy.Resolved("sky", "light"),
  val session: Map<String, Any?>? = null, val reminders: List<Map<String, Any?>> = emptyList(), val total: Int = 0,
  val doneToken: String? = null, val undoToken: String? = null, val undoName: String? = null,
  val retryToken: String? = null, val notice: String? = null, val locked: Boolean = false, val configured: Boolean = true, val failed: Boolean = false,
  val fontScale: Float = 1f, val localeTag: String = "en", val uses24HourClock: Boolean = false,
  val zoneId: String = java.time.ZoneId.systemDefault().id, val projectionEpoch: Long = 0,
  val actionFeedback: WidgetActionFeedback? = null)

/** CE-only presentation identities. Access exclusively on AlarmEngine's serialized worker. */
internal class WidgetState(private val context: Context) {
  private fun preferences(): android.content.SharedPreferences {
    check(context.getSystemService(UserManager::class.java).isUserUnlocked)
    return context.getSharedPreferences("remilo-widgets-v1", Context.MODE_PRIVATE)
  }
  fun read(id: Int): JSONObject? = preferences().getString("widget:$id", null)?.let(::JSONObject)
  fun write(id: Int, value: JSONObject) { check(preferences().edit().putString("widget:$id", value.toString()).commit()) }
  fun remove(id: Int) { check(preferences().edit().remove("widget:$id").commit()) }
  fun configuration(value: JSONObject?) = WidgetConfiguration(value?.optString("mode") ?: "Today",
    value?.optString("routineId")?.takeIf { it.isNotEmpty() }, value?.optLong("revision") ?: 0)
  fun save(id: Int, mode: String, routineId: String?, expected: Long): WidgetConfiguration {
    val previous = read(id); require(configuration(previous).revision == expected)
    val next = JSONObject().put("version", 1).put("mode", mode).put("routineId", routineId.orEmpty()).put("revision", expected + 1)
    // Retain descriptors for receipt-first committed retries; config revision fences other old taps.
    next.put("actions", previous?.optJSONObject("actions") ?: JSONObject())
    write(id, next); return configuration(next)
  }
  fun restore(oldId: Int, newId: Int) {
    val saved = read(oldId) ?: return
    val config = configuration(saved)
    if (oldId == newId) {
      write(newId, JSONObject().put("version", 1).put("mode", config.mode)
        .put("routineId", config.routineId.orEmpty()).put("revision", config.revision + 1))
      return
    }
    if (read(newId) == null) save(newId, config.mode, config.routineId, 0)
    remove(oldId)
  }
  fun prune(active: Set<Int>) {
    preferences().all.keys.filter { it.startsWith("widget:") }.forEach {
      val id = it.substringAfter(':').toIntOrNull() ?: return@forEach
      if (id !in active) remove(id)
    }
  }
  fun capturePin(mode: String, routineId: String?, at: Long): String {
    val token = java.util.UUID.randomUUID().toString()
    val prefs = preferences(); val edit = prefs.edit()
    prefs.all.filterKeys { it.startsWith("pin:") }.forEach { (key, raw) ->
      if (runCatching { JSONObject(raw as String).getLong("at") < at - 86_400_000 }.getOrDefault(true)) edit.remove(key)
    }
    check(edit.putString("pin:$token", JSONObject().put("mode", mode).put("routineId", routineId.orEmpty()).put("at", at).toString()).commit())
    return token
  }
  fun finishPin(token: String, id: Int, at: Long): Boolean {
    val prefs = preferences(); val raw = prefs.getString("pin:$token", null) ?: return false
    val saved = JSONObject(raw)
    if (at - saved.getLong("at") !in 0..86_400_000 || read(id) != null) return false
    save(id, saved.getString("mode"), saved.optString("routineId").takeIf { it.isNotEmpty() }, 0)
    check(prefs.edit().remove("pin:$token").commit()); return true
  }
}

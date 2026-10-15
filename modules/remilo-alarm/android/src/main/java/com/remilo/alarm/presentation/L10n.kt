package com.remilo.alarm.presentation

import android.content.Context
import com.remilo.alarm.system.PresentationLanguage
import org.json.JSONObject

/** Only call legacy() for app-authored presentation, never reminder/Calendar content. */
object L10n {
  data class Message(val key: String, val args: Map<String, String> = emptyMap())
  private val exact by lazy { MessageCatalog.entries.filterValues { it.args.isEmpty() }.map { it.value.english to Message(it.key) }.toMap() }
  private val patterns by lazy { MessageCatalog.entries.map { (key, entry) ->
    val parts = Regex("\\{([a-zA-Z][a-zA-Z0-9]*)\\}").findAll(entry.english).toList()
    var start = 0
    val pattern = buildString {
      append("^")
      for (part in parts) { append(Regex.escape(entry.english.substring(start, part.range.first))); append("([\\s\\S]*?)"); start = part.range.last + 1 }
      append(Regex.escape(entry.english.substring(start))); append("$")
    }
    Triple(key, Regex(pattern), parts.map { it.groupValues[1] })
  }.sortedByDescending { (_, regex, _) -> regex.pattern.length } }
  fun descriptor(english: String): Message? = describe(english, false)
  fun calendarDescriptor(english: String): Message? = describe(english, true)
  private fun describe(english: String, calendarOnly: Boolean): Message? {
    if (english.isEmpty()) return null
    exact[english]?.takeIf { !calendarOnly || MessageCatalog.entries[it.key]?.calendarStatus == true }?.let { return it }
    for ((key, pattern, names) in patterns) {
      if (calendarOnly && MessageCatalog.entries[key]?.calendarStatus != true) continue
      val match = pattern.matchEntire(english) ?: continue
      return Message(key, names.mapIndexed { i, name -> name to match.groupValues[i + 1] }.toMap())
    }
    return null
  }
  fun render(context: Context, message: Message): String {
    val entry = MessageCatalog.entries[message.key] ?: return text(context, "Historical details are unavailable.")
    val resources = PresentationLanguage.context(context).resources
    val values = entry.args.map { message.args[it].orEmpty() }.toTypedArray()
    return if (entry.plural) resources.getQuantityString(entry.resource, message.args["count"]?.toIntOrNull() ?: 0, *values)
      else if (values.isEmpty()) resources.getString(entry.resource) else resources.getString(entry.resource, *values)
  }
  fun text(context: Context, english: String): String = descriptor(english)?.let { render(context, it) } ?: english
  fun text(english: String): String = PresentationLanguage.cachedContext()?.let { text(it, english) } ?: english
  fun text(context: Context, message: Message): String = render(context, message)
  fun text(message: Message): String = PresentationLanguage.cachedContext()?.let { render(it, message) }
    ?: MessageCatalog.entries[message.key]?.english?.replace(Regex("\\{([a-zA-Z][a-zA-Z0-9]*)\\}")) { message.args[it.groupValues[1]].orEmpty() }.orEmpty()
  fun stored(key: String, args: String, legacy: String): String {
    if (legacy.isEmpty() && key.isEmpty()) return ""
    val message = if (key.isNotEmpty()) runCatching {
      val obj = JSONObject(args)
      Message(key, obj.keys().asSequence().associateWith { obj.get(it).toString() })
    }.getOrNull()?.takeIf { MessageCatalog.entries[it.key]?.calendarStatus == true } else calendarDescriptor(legacy)
    val context = PresentationLanguage.cachedContext() ?: return legacy
    return render(context, message ?: requireNotNull(descriptor("Historical details are unavailable.")))
  }
  fun argsJson(message: Message?): String = JSONObject(message?.args ?: emptyMap<String, String>()).toString()
}

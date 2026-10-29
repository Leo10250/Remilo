package com.remilo.alarm.core

import java.util.IdentityHashMap

/** Narrow diagnostic allowlist. Never return exception messages, SQL, paths, hashes or content. */
object StorageFailureDiagnostics {
  private val missingMigration = Regex("^A migration from ([0-9]{1,10}) to ([0-9]{1,10}) was required but not found\\.")
  private val exceptionName = Regex("[A-Za-z_][A-Za-z0-9_]{0,79}")

  fun summary(error: Throwable): String {
    val seen = IdentityHashMap<Throwable, Boolean>()
    var current: Throwable? = error
    var fallback = safeExceptionName(error)
    repeat(16) {
      val cause = current ?: return "type=unknown exception=$fallback"
      if (seen.put(cause, true) != null) return "type=unknown exception=$fallback"
      val name = safeExceptionName(cause)
      fallback = name
      val message = runCatching { cause.message }.getOrNull()?.take(512).orEmpty()
      missingMigration.find(message)?.let { match ->
        val from = match.groupValues[1].toIntOrNull()
        val to = match.groupValues[2].toIntOrNull()
        if (from != null && from > 0 && to != null && to > 0)
          return "type=room_missing_migration from=$from to=$to exception=$name"
      }
      if (message.startsWith("Room cannot verify the data integrity.") && message.contains("Expected identity hash:"))
        return "type=room_identity_mismatch exception=$name"
      current = runCatching { cause.cause }.getOrNull()
    }
    return "type=unknown exception=$fallback"
  }

  private fun safeExceptionName(error: Throwable): String =
    error.javaClass.simpleName.takeIf { exceptionName.matches(it) } ?: "Throwable"
}

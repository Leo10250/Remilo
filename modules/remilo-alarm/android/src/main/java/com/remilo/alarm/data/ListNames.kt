package com.remilo.alarm.data

import java.text.Normalizer
import java.util.Locale
import java.util.UUID

/** Credential-only list names; identities never derive from operational state. */
object ListNames {
  fun display(name: String) = Normalizer.normalize(name.trim(), Normalizer.Form.NFC)
  fun key(name: String) = display(name).lowercase(Locale.ROOT)
  fun legacyId(name: String) = UUID.nameUUIDFromBytes("remilo:list:$name".toByteArray(Charsets.UTF_8)).toString()
}

package com.remilo.alarm.system

import android.os.Bundle
import com.remilo.alarm.core.DeliverySnapshot
import com.remilo.alarm.core.PostponeDraft
import com.remilo.alarm.core.PostponePickerDraft

/** Explicit operational allowlist; private reminder text never enters saved draft state. */
internal object PostponeSavedState {
  fun save(draft: PostponeDraft): Bundle = Bundle().apply {
    putString("sessionId", draft.sessionId)
    putStringArray("memberIds", draft.members.map { it.occurrenceId }.toTypedArray())
    putLongArray("memberGenerations", draft.members.map { it.expectedGeneration }.toLongArray())
    putBoolean("all", draft.all)
    putString("zoneId", draft.zoneId)
    putString("selection", draft.selection)
    putLong("targetMs", draft.targetMs)
    putLong("referenceAtMs", draft.referenceAtMs)
    draft.preferencesRevision?.let { putLong("preferencesRevision", it) }
    draft.tomorrowMinutes?.let { putIntArray("tomorrowMinutes", it.toIntArray()) }
    putString("adjustment", draft.adjustment)
    putBoolean("stale", draft.stale)
    draft.picker?.let { putString("pickerLocal", it.local); putString("pickerStep", it.step) }
  }

  fun restore(saved: Bundle): PostponeDraft? = runCatching {
    val ids = requireNotNull(saved.getStringArray("memberIds"))
    val generations = requireNotNull(saved.getLongArray("memberGenerations"))
    require(ids.size == generations.size && saved.containsKey("targetMs") && saved.containsKey("referenceAtMs"))
    PostponeDraft(requireNotNull(saved.getString("sessionId")), ids.indices.map { DeliverySnapshot.Member(ids[it], generations[it]) },
      saved.getBoolean("all"), requireNotNull(saved.getString("zoneId")), requireNotNull(saved.getString("selection")),
      saved.getLong("targetMs"), saved.getLong("referenceAtMs"),
      if (saved.containsKey("preferencesRevision")) saved.getLong("preferencesRevision") else null,
      saved.getIntArray("tomorrowMinutes")?.toList(), saved.getString("adjustment") ?: "none", saved.getBoolean("stale"),
      saved.getString("pickerLocal")?.let { PostponePickerDraft(it, saved.getString("pickerStep") ?: "custom") })
  }.getOrNull()
}

package com.remilo.alarm.system

import com.remilo.alarm.core.DeliverySnapshot
import com.remilo.alarm.core.PostponeDraft
import com.remilo.alarm.core.PostponePickerDraft
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34], application = android.app.Application::class)
class PostponeSavedStateTest {
  @Test fun recreationPreservesExactTargetCaptureAndProvisionalPickerWithoutPrivateFields() {
    val draft = PostponeDraft("captured-session", listOf(DeliverySnapshot.Member("a", 3), DeliverySnapshot.Member("b", 7)), true,
      "America/Los_Angeles", "tomorrow-1", 1_900_000_000_000L, 1_899_000_000_000L,
      preferencesRevision = 9, tomorrowMinutes = listOf(600, 840, 1020),
      picker = PostponePickerDraft("2030-01-04T14:15:00", "time"))
    val saved = PostponeSavedState.save(draft)
    val restored = requireNotNull(PostponeSavedState.restore(saved))
    assertEquals(draft, restored)
    assertEquals(draft.command("frozen-operation"), restored.command("frozen-operation"))
    assertFalse(saved.keySet().any { it in setOf("title", "notes", "content", "subject") })
  }
  @Test fun missingCapturedIdentityCannotInventAReplacementDraft() {
    val saved = android.os.Bundle().apply { putString("sessionId", "session"); putLong("targetMs", 123L) }
    assertNull(PostponeSavedState.restore(saved))
  }
}

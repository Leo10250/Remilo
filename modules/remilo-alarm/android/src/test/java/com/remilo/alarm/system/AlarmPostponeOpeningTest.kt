package com.remilo.alarm.system

import android.app.Application
import androidx.compose.runtime.MutableState
import com.remilo.alarm.core.PostponeDraft
import com.remilo.alarm.data.AlertRecord
import com.remilo.alarm.engine.AlarmEngine
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.util.ReflectionHelpers
import org.robolectric.util.ReflectionHelpers.ClassParameter

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34], application = Application::class)
class AlarmPostponeOpeningTest {
  @Test fun openingFromTheNativeActionCreatesOnlyADraftWithoutEngineMutationOrNavigation() {
    // Do not call onCreate: no engine or audio owner exists in this fixture.
    // If opening Postpone starts either authority instead of just capturing state, this fails.
    val activity = Robolectric.buildActivity(AlarmActivity::class.java).get()
    val original = AlertRecord("ordinary", System.currentTimeMillis(), 4, "Alerting", "session")
    val snapshot = AlarmEngine.SessionSnapshot("session", "Active", listOf(original to "Reminder"), "light", "sky")
    ReflectionHelpers.getField<MutableState<AlarmEngine.SessionSnapshot?>>(activity, "snapshot").value = snapshot
    ReflectionHelpers.callInstanceMethod<Unit>(activity, "act", ClassParameter.from(String::class.java, "Postpone"), ClassParameter.from(AlertRecord::class.java, original))
    val draft = ReflectionHelpers.getField<MutableState<PostponeDraft?>>(activity, "postpone").value
    assertNotNull(draft)
    assertEquals("session", draft!!.sessionId)
    assertEquals("ordinary", draft.members.single().occurrenceId)
    assertEquals(4L, draft.members.single().expectedGeneration)
    assertEquals("15", draft.selection)
    assertEquals(snapshot, ReflectionHelpers.getField<MutableState<AlarmEngine.SessionSnapshot?>>(activity, "snapshot").value)
    assertNull(ReflectionHelpers.getField<Any?>(activity, "engine"))
    assertNull(ReflectionHelpers.getField<Any?>(activity, "pendingCommand"))
    assertFalse(activity.isFinishing)
    assertNull(org.robolectric.Shadows.shadowOf(activity).nextStartedActivity)
  }
}

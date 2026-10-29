package com.remilo.alarm.system

import android.app.Application
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.input.InputMode
import androidx.compose.ui.input.InputModeManager
import androidx.compose.ui.platform.LocalInputModeManager
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createEmptyComposeRule
import androidx.compose.ui.unit.dp
import com.remilo.alarm.presentation.AtmosphereTokens
import com.remilo.alarm.core.DeliverySnapshot
import com.remilo.alarm.core.PostponeDraft
import org.junit.After
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.android.controller.ActivityController
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import org.robolectric.shadows.ShadowDialog
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34], application = Application::class, qualifiers = "w360dp-h800dp-mdpi")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class AlarmModalHostTest {
  @get:Rule val compose = createEmptyComposeRule()
  private var controller: ActivityController<ComponentActivity>? = null

  @After fun closeHost() { controller?.pause()?.stop()?.destroy() }

  private fun host(content: @Composable () -> Unit): ComponentActivity {
    val owner = Robolectric.buildActivity(ComponentActivity::class.java).setup()
    controller = owner
    var inputMode: InputModeManager? = null
    return owner.get().also { activity ->
      activity.setShowWhenLocked(true)
      activity.setContent {
        inputMode = LocalInputModeManager.current
        content()
      }
      // setup() makes the Activity visible but does not deliver this window event.
      // Keyboard focus requests require the same focused host window as on device.
      owner.windowFocusChanged(true)
      compose.runOnIdle { assertTrue(requireNotNull(inputMode).requestInputMode(InputMode.Keyboard)) }
    }
  }

  @Test fun chooserStaysInTheAlarmWindowAndFencesBackgroundAccessibilityAndKeyboardFocus() {
    var open by mutableStateOf(false)
    val backgroundFocus = FocusRequester()
    host {
      MaterialTheme {
        AlarmModalFrame(open, content = {
          // Deliberately enabled: the frame must fence focus even if a caller misses its busy flag.
          Button(onClick = { open = true }, modifier = Modifier.focusRequester(backgroundFocus)) { Text("Background done") }
        }, modal = {
          AlarmPostponeSheet(true, false, "Postpone choices", AtmosphereTokens.colors("sky", "light"),
            onClose = { open = false }, onBackChoices = {}) {
            Button(onClick = {}, modifier = Modifier.fillMaxWidth().heightIn(min = 64.dp)) { Text("15 minutes") }
            Button(onClick = { open = false }) { Text("Close choices") }
          }
        })
      }
    }
    compose.onNodeWithText("Background done").performSemanticsAction(SemanticsActions.RequestFocus) { assertTrue(it()) }
    compose.onNodeWithText("Background done").performClick()
    compose.onNodeWithText("15 minutes").assertIsDisplayed()
    compose.onNodeWithText("Background done").assertDoesNotExist()
    compose.onNodeWithText("15 minutes").performSemanticsAction(SemanticsActions.RequestFocus) { assertTrue(it()) }
    compose.runOnIdle { assertFalse(backgroundFocus.requestFocus()) }
    compose.onNodeWithText("15 minutes").assertIsFocused()
    assertNull(ShadowDialog.getLatestDialog())
    compose.onNodeWithText("Close choices").performClick()
    compose.onNodeWithText("Background done").assertIsDisplayed().assertIsFocused()
    assertNull(ShadowDialog.getLatestDialog())
  }

  @Test fun unknownBackCannotDismissAndCustomBackReturnsToVisibleChoices() {
    var open by mutableStateOf(true)
    var canDismiss by mutableStateOf(false)
    var custom by mutableStateOf(true)
    var closeCount = 0
    var backCount = 0
    val activity = host {
      MaterialTheme {
        AlarmModalFrame(open, content = { Text("Alarm controls") }, modal = {
          AlarmPostponeSheet(canDismiss, custom, "Postpone choices", AtmosphereTokens.colors("sky", "light"),
            onClose = { closeCount++; open = false }, onBackChoices = { backCount++; custom = false }) {
            Text(if (custom) "Custom date and time" else "Preset choices")
          }
        })
      }
    }
    compose.onNodeWithText("Custom date and time").assertIsDisplayed()
    compose.runOnIdle { activity.onBackPressedDispatcher.onBackPressed() }
    compose.onNodeWithText("Custom date and time").assertIsDisplayed()
    assertEquals(0, closeCount)
    assertEquals(0, backCount)
    compose.runOnIdle { canDismiss = true }
    compose.runOnIdle { activity.onBackPressedDispatcher.onBackPressed() }
    compose.onNodeWithText("Preset choices").assertIsDisplayed()
    assertEquals(1, backCount)
    assertEquals(0, closeCount)
    compose.runOnIdle { activity.onBackPressedDispatcher.onBackPressed() }
    compose.onNodeWithText("Alarm controls").assertIsDisplayed()
    assertEquals(1, closeCount)
  }

  @Test fun zeroPeekCollapseDismissesInsteadOfLeavingAnInvisibleModal() {
    var open by mutableStateOf(true)
    host {
      MaterialTheme {
        AlarmModalFrame(open, content = { Text("Alarm controls") }, modal = {
          AlarmPostponeSheet(true, false, "Postpone choices", AtmosphereTokens.colors("sky", "light"),
            onClose = { open = false }, onBackChoices = {}) {
            Text("Preset choices")
          }
        })
      }
    }
    compose.onNodeWithText("Preset choices").assertIsDisplayed()
    compose.onNode(SemanticsMatcher.keyIsDefined(SemanticsActions.Collapse)).performSemanticsAction(SemanticsActions.Collapse) { it() }
    compose.onNodeWithText("Alarm controls").assertIsDisplayed()
    assertNull(ShadowDialog.getLatestDialog())
  }

  @Test fun actualChooserShowsPresetAndConfirmationAndKeepsCustomReachableInTheHostWindow() {
    var open by mutableStateOf(true)
    val now = System.currentTimeMillis()
    val draft = PostponeDraft("session", listOf(DeliverySnapshot.Member("ordinary", 4)), false, "UTC", "15",
      now + 900_000, now, tomorrowMinutes = listOf(600, 840, 1020))
    val clock = SimpleDateFormat("h:mm a", Locale.US).apply { timeZone = TimeZone.getTimeZone("UTC") }
    host {
      MaterialTheme {
        AlarmModalFrame(open, content = { Text("Alarm controls") }, modal = {
          PostponeChooser(draft, "Reminder", true, false, false, null, AtmosphereTokens.colors("sky", "light"),
            onClose = { open = false }, onChoice = {}, onConfirm = {}, onRetry = {}, onBackChoices = {}, onPickField = {}, onUseCustom = {},
            clockFormat = clock, minutesClockFormat = clock)
        })
      }
    }
    compose.onNodeWithText("15 min").assertIsDisplayed()
    compose.onNodeWithText("Postpone", useUnmergedTree = true).assertIsDisplayed()
    compose.onNodeWithText("Custom").performScrollTo().assertIsDisplayed()
    compose.onNodeWithText("Postpone", useUnmergedTree = true).assertIsDisplayed()
    assertNull(ShadowDialog.getLatestDialog())
  }
}

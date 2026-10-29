package com.remilo.alarm.system

import android.app.Application
import android.app.Dialog
import android.view.WindowManager
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34], application = Application::class)
class AlarmChildWindowPolicyTest {
  @Suppress("DEPRECATION")
  @Test fun pickerGetsExplicitLockscreenEligibilityAndParentSecurityWithoutUnlockOrWakeFlags() {
    val context = RuntimeEnvironment.getApplication()
    val parent = requireNotNull(Dialog(context).window)
    val child = requireNotNull(Dialog(context).window)
    parent.addFlags(WindowManager.LayoutParams.FLAG_SECURE or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON)
    child.clearFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD)
    AlarmChildWindowPolicy.inherit(child, parent)
    assertTrue(child.attributes.flags and WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED != 0)
    assertTrue(child.attributes.flags and WindowManager.LayoutParams.FLAG_SECURE != 0)
    assertEquals(0, child.attributes.flags and WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON)
    assertEquals(0, child.attributes.flags and WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD)
  }
  @Test fun aNonSecureParentDoesNotLeaveAnOldSecurePolicyOnTheChild() {
    val context = RuntimeEnvironment.getApplication()
    val parent = requireNotNull(Dialog(context).window)
    val child = requireNotNull(Dialog(context).window)
    parent.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
    child.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
    AlarmChildWindowPolicy.inherit(child, parent)
    assertEquals(0, child.attributes.flags and WindowManager.LayoutParams.FLAG_SECURE)
  }
}

package com.remilo.alarm.system

import android.view.Window
import android.view.WindowManager

/** Only for pickers owned by the already lockscreen-eligible native AlarmActivity. */
internal object AlarmChildWindowPolicy {
  @Suppress("DEPRECATION")
  fun inherit(child: Window, parent: Window) {
    // Activity.setShowWhenLocked is ActivityRecord policy, not a copyable Window flag.
    // Give this native child its own eligibility without dismissing keyguard or waking again.
    val mask = WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or WindowManager.LayoutParams.FLAG_SECURE
    val flags = WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
      (parent.attributes.flags and WindowManager.LayoutParams.FLAG_SECURE)
    child.setFlags(flags, mask)
  }
}

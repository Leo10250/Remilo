package com.remilo.alarm.core

import org.junit.Assert.*
import org.junit.Test

class AlarmPresentationPolicyTest {
  @Test fun ordinaryPostponeAndBulkControlsStayAvailableWithoutRoutines() {
    assertTrue(AlarmPresentationPolicy.canPostpone(listOf("Reminder")))
    assertFalse(AlarmPresentationPolicy.canShowOrdinaryBulk(listOf("Reminder")))
    assertTrue(AlarmPresentationPolicy.canShowOrdinaryBulk(listOf("Reminder", "Reminder")))
    assertFalse(AlarmPresentationPolicy.canPostpone(emptyList()))
  }
  @Test fun routineAndMixedGroupsKeepTheirSpecializedMemberActions() {
    assertFalse(AlarmPresentationPolicy.canPostpone(listOf(RoutinePolicy.PROFILE)))
    assertFalse(AlarmPresentationPolicy.canShowOrdinaryBulk(listOf(RoutinePolicy.PROFILE, RoutinePolicy.PROFILE)))
    assertFalse(AlarmPresentationPolicy.canPostpone(listOf("Reminder", RoutinePolicy.PROFILE)))
    assertFalse(AlarmPresentationPolicy.canShowOrdinaryBulk(listOf("Reminder", RoutinePolicy.PROFILE)))
    // The ordinary member itself remains independently postponable.
    assertTrue(AlarmPresentationPolicy.canPostpone(listOf("Reminder")))
  }
}

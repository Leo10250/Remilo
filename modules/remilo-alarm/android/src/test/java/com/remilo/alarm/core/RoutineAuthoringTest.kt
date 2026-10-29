package com.remilo.alarm.core

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class RoutineAuthoringTest {
  private fun days(): JSONArray {
    val values: List<Map<String,Any?>> = (0..6).map { day ->
      val steps: List<Map<String,String>> = if(day < 2) listOf(mapOf("id" to "day-$day", "sharedStepId" to "logical", "name" to "Read", "target" to "10 minutes", "notes" to "")) else emptyList()
      mapOf("type" to (if(day < 2) "Exercises" else "Rest"), "exercises" to steps)
    }
    return JSONArray(values)
  }
  @Test fun validSharedContentAllowsDifferentExecutionIds() { RoutineAuthoring.validate(days(),"Shared","General") }
  @Test fun sharedSiblingMismatchAndMissingLinkAreRejected() {
    val changed = days(); changed.getJSONObject(1).getJSONArray("exercises").getJSONObject(0).put("target","20 minutes")
    assertThrows(IllegalArgumentException::class.java) { RoutineAuthoring.validate(changed,"Shared","General") }
    val missing = days(); missing.getJSONObject(1).getJSONArray("exercises").getJSONObject(0).remove("sharedStepId")
    assertThrows(IllegalArgumentException::class.java) { RoutineAuthoring.validate(missing,"Shared","General") }
  }
  @Test fun duplicateSharedKeyIsRejectedEvenWithMatchingText() {
    val duplicate = days(); val steps = duplicate.getJSONObject(0).getJSONArray("exercises")
    steps.put(JSONObject(steps.getJSONObject(0).toString()).put("id","other"))
    assertThrows(IllegalArgumentException::class.java) { RoutineAuthoring.validate(duplicate,"Shared","Exercise") }
  }
  @Test fun unsupportedMetadataAndDormantLinkageAreRejected() {
    assertThrows(IllegalArgumentException::class.java) { RoutineAuthoring.validate(days(),"Other","General") }
    assertThrows(IllegalArgumentException::class.java) { RoutineAuthoring.validate(days(),"Shared","Other") }
    assertThrows(IllegalArgumentException::class.java) { RoutineAuthoring.validate(days(),"ByWeekday","Exercise") }
  }
}

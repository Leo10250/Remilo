package com.remilo.alarm.core

import org.json.JSONArray

/** Authoring linkage is content, never a second execution/progress identity. */
object RoutineAuthoring {
  fun validate(days: JSONArray, mode: String, preset: String) {
    require(mode in setOf("Shared", "ByWeekday") && preset in setOf("General", "Exercise")) { "Choose valid routine fields and step arrangement." }
    var expected: List<List<String>>? = null
    for (d in 0 until days.length()) {
      val day = days.getJSONObject(d)
      val steps = day.getJSONArray("exercises")
      val keys = mutableSetOf<String>()
      val content = (0 until steps.length()).map { i ->
        val step = steps.getJSONObject(i)
        val key = step.optString("sharedStepId", "")
        require(key.length <= 200 && (mode == "Shared" && key.isNotBlank() && keys.add(key) || mode == "ByWeekday" && key.isEmpty())) { "Routine step links are invalid." }
        if(step.has("exerciseTarget")) ExerciseTargets.validate(step.getJSONObject("exerciseTarget"),step.getString("target"))
        listOf(key, step.getString("name"), step.getString("target"), ExerciseTargets.signature(step), step.getString("notes"), step.optString("illustration", ""), step.optString("customImageId", ""))
      }
      if (mode == "Shared" && day.getString("type") == "Exercises") {
        require(expected == null || expected == content) { "Shared steps must match on every scheduled day." }
        expected = content
      }
    }
  }
}

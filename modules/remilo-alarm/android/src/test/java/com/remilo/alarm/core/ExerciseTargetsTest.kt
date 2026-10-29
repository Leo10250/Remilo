package com.remilo.alarm.core

import android.content.Context
import android.app.Application
import com.remilo.alarm.presentation.exerciseTargetText
import com.remilo.alarm.system.PresentationLanguage
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.After
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk=[34],application=Application::class)
class ExerciseTargetsTest {
  private val context: Context get() = RuntimeEnvironment.getApplication()
  @After fun reset() { PresentationLanguage.update(context,"en") }
  private fun map(value: JSONObject): Map<String,Any?> = value.keys().asSequence().associateWith { key -> value.get(key).let { if(it is JSONObject)map(it) else it } }
  @Test fun sharedEnglishAndChineseFormattingFixturesMatchReactNative() {
    val cases=JSONArray(javaClass.getResourceAsStream("/exercise-targets.json")!!.bufferedReader().use { it.readText() })
    for(language in listOf("en","zh-Hans")) {
      PresentationLanguage.update(context,language)
      for(i in 0 until cases.length()) { val row=cases.getJSONObject(i)
        if(row.has("exerciseTarget"))ExerciseTargets.validate(row.getJSONObject("exerciseTarget"),row.getString("target"))
        assertEquals(row.getString(if(language=="en")"en" else "zh"),exerciseTargetText(context,map(row)))
      }
    }
  }
  @Test fun malformedAndAmbiguousTargetsAreRejected() {
    val invalid=listOf("{}","{\"sets\":0}","{\"reps\":1.5}","{\"sets\":9007199254740992}","{\"repsMax\":12}","{\"reps\":10,\"repsMax\":8}",
      "{\"eachSide\":true}","{\"eachSide\":false,\"reps\":3}","{\"duration\":{\"value\":1,\"unit\":\"days\"}}","{\"weight\":{\"value\":1,\"unit\":\"stone\"}}","{\"sets\":\"3\"}","{\"sets\":null}","{\"unknown\":1}")
    invalid.forEach { value -> assertThrows(Exception::class.java) { ExerciseTargets.validate(JSONObject(value),"") } }
    assertThrows(IllegalArgumentException::class.java) { ExerciseTargets.validate(JSONObject("{\"sets\":3}"),"Original target") }
    assertNull(ExerciseTargets.checked(null,"Original target"))
    ExerciseTargets.validate(JSONObject("{\"duration\":{\"value\":1.5,\"unit\":\"min\"},\"eachSide\":true}"),"")
  }
}

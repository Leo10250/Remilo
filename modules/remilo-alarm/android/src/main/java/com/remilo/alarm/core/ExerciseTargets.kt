package com.remilo.alarm.core

import org.json.JSONObject
import org.json.JSONArray
import java.math.BigDecimal

/** Credential-protected authored content. No derived summary or execution state is stored. */
object ExerciseTargets {
  private val keys = setOf("sets","reps","repsMax","duration","eachSide","weight","additionalText")
  private fun number(value: Any?, integer: Boolean = false): Double {
    require(value is Number) { "Enter a valid exercise target." }
    val n = value.toDouble()
    require(n.isFinite() && n > 0 && n <= 9_007_199_254_740_991.0 && (!integer || n % 1 == 0.0)) { "Enter a valid exercise target." }
    return n
  }
  fun validate(value: JSONObject, custom: String) {
    require(custom.isEmpty() && value.length() > 0 && value.keys().asSequence().all { it in keys }) { "Choose one exercise target format." }
    listOf("sets","reps","repsMax").forEach { if(value.has(it)) number(value.get(it),true) }
    if(value.has("repsMax")) require(value.has("reps") && number(value.get("repsMax"),true) >= number(value.get("reps"),true)) { "Enter a valid repetition range." }
    for((key,units) in listOf("duration" to setOf("sec","min","hr"),"weight" to setOf("kg","lb"))) if(value.has(key)) {
      val item = value.getJSONObject(key)
      require(item.keys().asSequence().toSet() == setOf("value","unit") && item.get("unit") is String && item.getString("unit") in units) { "Choose a valid target unit." }
      number(item.get("value"))
    }
    if(value.has("eachSide")) require(value.get("eachSide") == true && (value.has("reps") || value.has("duration"))) { "Add repetitions or time for each side." }
    if(value.has("additionalText")) { val text=value.get("additionalText"); require(text is String && text.isNotBlank() && text.length <= 1000) { "Enter valid additional target text." } }
  }
  @Suppress("UNCHECKED_CAST")
  fun checked(value: Any?, custom: String): Map<String,Any?>? {
    if(value == null)return null
    require(value is Map<*,*> && value.keys.all { it is String }) { "Enter a valid exercise target." }
    try { validate(JSONObject(value),custom) } catch(error: Exception) { throw IllegalArgumentException("Enter a valid exercise target.",error) }
    return value as Map<String,Any?>
  }
  /** Stable shared-content comparison independent of JSON property order. */
  fun signature(step: JSONObject): String = step.optJSONObject("exerciseTarget")?.let { value ->
    fun n(number: Any?) = (number as? Number)?.let { BigDecimal(it.toString()).stripTrailingZeros().toPlainString() }
    JSONArray(listOf(n(value.opt("sets")),n(value.opt("reps")),n(value.opt("repsMax")),n(value.optJSONObject("duration")?.opt("value")),value.optJSONObject("duration")?.opt("unit"),
      value.opt("eachSide"),n(value.optJSONObject("weight")?.opt("value")),value.optJSONObject("weight")?.opt("unit"),value.opt("additionalText"))).toString()
  }.orEmpty()

  @Suppress("UNCHECKED_CAST")
  fun text(step: Map<String,Any?>, translate: (String,Map<String,String>) -> String): String {
    val value = step["exerciseTarget"] as? Map<String,Any?> ?: return step["target"] as? String ?: ""
    fun n(value: Any?) = BigDecimal(value.toString()).stripTrailingZeros().toPlainString()
    fun count(key: String, value: Any?) = translate(key,mapOf("count" to n(value)))
    val sets = value["sets"]?.let { count("exercise_count_sets",it) }.orEmpty()
    val reps = value["reps"]?.let { if(value["repsMax"] != null)translate("exercise_range_reps",mapOf("min" to n(it),"max" to n(value["repsMax"]))) else count("exercise_count_reps",it) }.orEmpty()
    val duration = value["duration"] as? Map<String,Any?>
    val time = duration?.let { count(when(it["unit"]) { "min" -> "exercise_minutes_short"; "hr" -> "exercise_hours_short"; else -> "exercise_seconds_short" },it["value"]) }.orEmpty()
    var amount = if(reps.isNotEmpty() && time.isNotEmpty())listOf(sets,translate("exercise_per_set",mapOf("value" to reps)),translate("exercise_per_set",mapOf("value" to time))).filter { it.isNotEmpty() }.joinToString(" · ")
      else listOf(sets,reps.ifEmpty { time }).filter { it.isNotEmpty() }.joinToString(" × ")
    if(value["eachSide"] == true)amount=translate("exercise_each_side_summary",mapOf("value" to amount))
    val weight = value["weight"] as? Map<String,Any?>
    return listOf(amount,weight?.let { n(it["value"]) + " " + it["unit"] }.orEmpty(),value["additionalText"] as? String ?: "").filter { it.isNotEmpty() }.joinToString(" · ")
  }
}

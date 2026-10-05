package com.remilo.alarm

import android.content.Intent
import android.net.Uri
import android.provider.Settings
import com.remilo.alarm.engine.AlarmEngine
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.UUID

class RemiloAlarmModule : Module() {
  private var observation: AutoCloseable? = null
  private fun engine() = AlarmEngine.get(requireNotNull(appContext.reactContext).applicationContext)
  private fun dispatch(promise: Promise, body: (AlarmEngine) -> Any?) {
    val owner = engine()
    owner.request({ body(owner) }, { promise.resolve(it) }, { promise.reject(it, "Native operation failed: $it", null) })
  }
  override fun definition() = ModuleDefinition {
    Name("RemiloAlarm")
    Events("onChange")
    OnCreate {
      val owner = engine()
      observation = owner.observe { sendEvent("onChange", emptyMap<String, Any>()) }
      owner.recover()
    }
    OnDestroy { observation?.close(); observation = null }
    Function("createOperationId") { UUID.randomUUID().toString() }
    AsyncFunction("getCapabilities") { promise: Promise -> dispatch(promise) { it.capabilities() } }
    AsyncFunction("queryReminders") { filter: Map<String, Any?>, cursor: String?, promise: Promise ->
      dispatch(promise) { it.query(filter, cursor) }
    }
    AsyncFunction("getOccurrence") { id: String, promise: Promise -> dispatch(promise) { it.occurrence(id) } }
    AsyncFunction("previewSchedule") { draft: Map<String, Any?>, promise: Promise -> dispatch(promise) { it.preview(draft) } }
    AsyncFunction("applyCommand") { command: Map<String, Any?>, promise: Promise -> dispatch(promise) { it.apply(command) } }
    AsyncFunction("scheduleTestAlarm") { promise: Promise -> dispatch(promise) { it.testAlarm() } }
    AsyncFunction("getSettings") { promise: Promise -> dispatch(promise) { it.settings() } }
    AsyncFunction("getLists") { promise: Promise -> dispatch(promise) { it.lists() } }
    AsyncFunction("querySeries") { promise: Promise -> dispatch(promise) { it.querySeries() } }
    AsyncFunction("queryRepeatFamilies") { promise: Promise -> dispatch(promise) { it.queryRepeatFamilies() } }
    AsyncFunction("getTimeZones") { atMs: Double, promise: Promise -> dispatch(promise) { it.timeZones(atMs) } }
    AsyncFunction("convertTime") { input: Map<String, Any?>, promise: Promise -> dispatch(promise) { it.convertTime(input) } }
    AsyncFunction("getSeries") { id: String, promise: Promise -> dispatch(promise) { it.getSeries(id) } }
    AsyncFunction("getSeriesDraft") { id: String, nominal: String, promise: Promise -> dispatch(promise) { it.getSeriesDraft(id, nominal) } }
    AsyncFunction("getDiagnostics") { promise: Promise -> dispatch(promise) { it.diagnostics() } }
    AsyncFunction("previewSound") { sound: String, promise: Promise -> dispatch(promise) { it.previewSound(sound) } }
    AsyncFunction("exportBackup") { promise: Promise -> dispatch(promise) { it.exportBackup() } }
    AsyncFunction("previewImport") { json: String, promise: Promise -> dispatch(promise) { it.previewImport(json) } }
    AsyncFunction("importBackup") { json: String, copyIds: List<String>, operation: String, promise: Promise ->
      dispatch(promise) { it.importBackup(json, copyIds, operation) }
    }
    AsyncFunction("reconcile") { engine().recover() }
    AsyncFunction("openSettings") { kind: String ->
      val context = requireNotNull(appContext.reactContext)
      val intent = when (kind) {
        "exact" -> Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:${context.packageName}"))
        "fullScreen" -> Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, Uri.parse("package:${context.packageName}"))
        "notifications" -> Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
        else -> throw IllegalArgumentException("Unknown settings destination")
      }
      context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
  }
}

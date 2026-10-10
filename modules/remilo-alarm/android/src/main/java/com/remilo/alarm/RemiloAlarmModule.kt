package com.remilo.alarm

import android.content.Intent
import android.net.Uri
import android.provider.Settings
import com.remilo.alarm.engine.AlarmEngine
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.UUID
import com.remilo.alarm.calendar.*
import com.google.android.gms.common.GoogleApiAvailability
import com.google.android.gms.common.ConnectionResult

class RemiloAlarmModule : Module() {
  private var observation: AutoCloseable? = null
  private var previewObservation: AutoCloseable? = null
  private fun engine() = AlarmEngine.get(requireNotNull(appContext.reactContext).applicationContext)
  private fun dispatch(promise: Promise, body: (AlarmEngine) -> Any?) {
    val owner = engine()
    owner.request({ body(owner) }, { promise.resolve(it) }, { promise.reject(it, "Native operation failed: $it", null) })
  }
  override fun definition() = ModuleDefinition {
    Name("RemiloAlarm")
    Events("onChange", "onSoundPreviewState")
    OnCreate {
      val owner = engine()
      observation = owner.observe { sendEvent("onChange", emptyMap<String, Any>()) }
      previewObservation = owner.observeSoundPreview { sendEvent("onSoundPreviewState", it) }
      owner.recover()
    }
    OnDestroy { observation?.close(); observation = null; previewObservation?.close(); previewObservation = null }
    Function("createOperationId") { UUID.randomUUID().toString() }
    AsyncFunction("getCapabilities") { promise: Promise -> dispatch(promise) { it.capabilities() } }
    AsyncFunction("queryReminders") { filter: Map<String, Any?>, cursor: String?, promise: Promise ->
      dispatch(promise) { it.query(filter, cursor) }
    }
    AsyncFunction("getOccurrence") { id: String, promise: Promise -> dispatch(promise) { it.occurrence(id) } }
    AsyncFunction("previewSchedule") { draft: Map<String, Any?>, promise: Promise -> dispatch(promise) { it.preview(draft) } }
    AsyncFunction("applyCommand") { command: Map<String, Any?>, promise: Promise -> dispatch(promise) { it.apply(command) } }
    AsyncFunction("scheduleTestAlarm") { operationId: String, promise: Promise -> dispatch(promise) { it.testAlarm(operationId) } }
    AsyncFunction("getSettings") { promise: Promise -> dispatch(promise) { it.settings() } }
    AsyncFunction("getCalendarConnection") { promise: Promise ->
      val context = requireNotNull(appContext.reactContext).applicationContext
      engine().calendarRequest(block = { it.connectionView() + mapOf("available" to (GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(context) == ConnectionResult.SUCCESS)) }, resolve = { promise.resolve(it) }, reject = { promise.reject(it, "Calendar request could not be confirmed: $it", null) })
    }
    AsyncFunction("getCalendarPublications") { promise: Promise ->
      engine().calendarRequest(block = { it.publications() }, resolve = { promise.resolve(it) }, reject = { promise.reject(it, "Calendar request could not be confirmed: $it", null) })
    }
    AsyncFunction("previewCalendarPublication") { id: String, promise: Promise ->
      engine().calendarRequest(block = { it.preview(id) }, resolve = { promise.resolve(it) }, reject = { promise.reject(it, "Calendar preview unavailable: $it", null) })
    }
    AsyncFunction("authorizeCalendar") { publicationId: String? ->
      val activity = requireNotNull(appContext.currentActivity) { "Open Calendar settings after unlocking." }
      activity.startActivity(Intent(activity, CalendarAuthorizationActivity::class.java).putExtra("publicationId", publicationId))
    }
    AsyncFunction("listOwnedCalendars") { cursor: String?, promise: Promise ->
      CalendarRuntime.get(requireNotNull(appContext.reactContext).applicationContext).list(cursor,
        { promise.resolve(it) }, { promise.reject(it, "Calendar list unavailable: $it", null) })
    }
    AsyncFunction("applyCalendarCommand") { command: Map<String, Any?>, promise: Promise ->
      val runtime = CalendarRuntime.get(requireNotNull(appContext.reactContext).applicationContext)
      val reject: (String) -> Unit = { promise.reject(it, "Calendar action could not be confirmed: $it", null) }
      when (command["kind"]) {
        "SelectCalendar" -> runtime.select(command, { promise.resolve(it) }, reject)
        "PublishOneOff" -> engine().calendarRequest(true, { it.capture(command) }, { result ->
          promise.resolve(result); runtime.start(CalendarStore.string(command, "operationId"))
        }, reject)
        "RetryPublication" -> engine().calendarRequest(block = {
          it.operation(CalendarStore.string(command, "operationId"))?.let(it::view) ?: throw CalendarFailure("NOT_FOUND")
        }, resolve = { promise.resolve(it); runtime.start(CalendarStore.string(command, "operationId")) }, reject = reject)
        "DisconnectCalendar" -> engine().calendarRequest(true, {
          it.disconnect(CalendarStore.string(command, "operationId"), CalendarStore.number(command, "expectedConnectionRevision"))
        }, { old -> promise.resolve(mapOf("disconnected" to true)); if (old != null) runtime.revoke(old) }, reject)
        else -> reject("INVALID_INPUT")
      }
    }
    AsyncFunction("getLists") { promise: Promise -> dispatch(promise) { it.lists() } }
    AsyncFunction("queryLists") { promise: Promise -> dispatch(promise) { it.lists() } }
    AsyncFunction("querySeries") { promise: Promise -> dispatch(promise) { it.querySeries() } }
    AsyncFunction("queryRepeatFamilies") { promise: Promise -> dispatch(promise) { it.queryRepeatFamilies() } }
    AsyncFunction("getTimeZones") { atMs: Double, promise: Promise -> dispatch(promise) { it.timeZones(atMs) } }
    AsyncFunction("convertTime") { input: Map<String, Any?>, promise: Promise -> dispatch(promise) { it.convertTime(input) } }
    AsyncFunction("getSeries") { id: String, promise: Promise -> dispatch(promise) { it.getSeries(id) } }
    AsyncFunction("getSeriesDraft") { id: String, nominal: String, promise: Promise -> dispatch(promise) { it.getSeriesDraft(id, nominal) } }
    AsyncFunction("getDiagnostics") { promise: Promise -> dispatch(promise) { it.diagnostics() } }
    AsyncFunction("previewSound") { sound: String, requestId: String, promise: Promise -> dispatch(promise) { it.previewSound(sound, requestId) } }
    AsyncFunction("stopSoundPreview") { requestId: String, promise: Promise -> dispatch(promise) { it.stopSoundPreview(requestId) } }
    AsyncFunction("getSoundPreview") { promise: Promise -> dispatch(promise) { it.soundPreview() } }
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

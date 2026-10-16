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
import com.remilo.alarm.system.TimeDisplayPreferences

class RemiloAlarmModule : Module() {
  private var observation: AutoCloseable? = null
  private var previewObservation: AutoCloseable? = null
  private var timeObservation: AutoCloseable? = null
  private fun engine() = AlarmEngine.get(requireNotNull(appContext.reactContext).applicationContext)
  private fun dispatch(promise: Promise, body: (AlarmEngine) -> Any?) {
    val owner = engine()
    owner.request({ body(owner) }, { promise.resolve(it) }, { promise.reject(it, "Native operation failed: $it", null) })
  }
  private fun authorize(requestId: String, publicationId: String?, promise: Promise? = null) {
    val activity = appContext.currentActivity
    if (activity == null) { promise?.reject("NEEDS_ACCESS", "Open Calendar after unlocking.", null); return }
    engine().calendarRequest(true, { store ->
      val launch = CalendarStatusStore(store.database(), System::currentTimeMillis).beginAuthorization(requestId, publicationId)
      val managed = publicationId?.let { store.managed.setupOperation(it) }
      val recover = managed != null && (managed.phase in setOf("Fenced", "Cancelled", "Confirmed") || managed.authEpoch != store.managed.binding().authEpoch || !store.connection().connected)
      Triple(if (recover) null else publicationId, managed?.kind == "Create" && !recover, launch)
    }, { saved -> activity.runOnUiThread {
      if (!saved.third) promise?.resolve(mapOf("operationId" to requestId, "launched" to false))
      else if (!activity.isFinishing) {
        try {
          activity.startActivity(Intent(activity, CalendarAuthorizationActivity::class.java).putExtra("requestId", requestId)
            .putExtra("publicationId", saved.first).putExtra("managedCalendarCreation", saved.second))
          promise?.resolve(mapOf("operationId" to requestId, "launched" to true))
        } catch (_: Exception) {
          engine().calendarRequest(true, { CalendarStatusStore(it.database(), System::currentTimeMillis).finishAuthorization(requestId, "Failed") }, {}, {})
          promise?.reject("NOT_AVAILABLE", "Google authorization could not open.", null)
        }
      } else {
        engine().calendarRequest(true, { CalendarStatusStore(it.database(), System::currentTimeMillis).finishAuthorization(requestId, "Failed") }, {}, {})
        promise?.reject("NOT_AVAILABLE", "Google authorization could not open.", null)
      }
    } }, { promise?.reject(it, "Google authorization could not open.", null) })
  }
  override fun definition() = ModuleDefinition {
    Name("RemiloAlarm")
    AsyncFunction("getWidgetSupport") {
      val context = requireNotNull(appContext.reactContext).applicationContext
      mapOf("pinSupported" to android.appwidget.AppWidgetManager.getInstance(context).isRequestPinAppWidgetSupported,
        "instanceCount" to com.remilo.alarm.widget.WidgetWork.ids(context).size)
    }
    AsyncFunction("openWidgetSetup") { routineId: String?, promise: Promise ->
      val activity = appContext.currentActivity
      if (activity == null) promise.reject("NOT_AVAILABLE", "Open Remilo after unlocking.", null)
      else activity.runOnUiThread {
        try {
          val intent = Intent(activity, com.remilo.alarm.widget.WidgetConfigureActivity::class.java)
          if (routineId != null) intent.putExtra("routineId", routineId)
          activity.startActivity(intent); promise.resolve(mapOf("opened" to true))
        } catch (_: Exception) { promise.reject("NOT_AVAILABLE", "Widget setup could not open.", null) }
      }
    }
    Events("onChange", "onSoundPreviewState", "onTimeDisplayPreferencesChanged")
    OnCreate {
      val context = requireNotNull(appContext.reactContext).applicationContext
      timeObservation = runCatching { TimeDisplayPreferences.observe(context) { engine().presentationChanged { sendEvent("onTimeDisplayPreferencesChanged", TimeDisplayPreferences.read(context)) } } }.getOrNull()
      val owner = engine()
      observation = owner.observe { sendEvent("onChange", emptyMap<String, Any>()); sendEvent("onTimeDisplayPreferencesChanged", owner.presentationSnapshot()) }
      previewObservation = owner.observeSoundPreview { sendEvent("onSoundPreviewState", it) }
      owner.recover()
    }
    OnDestroy { observation?.close(); observation = null; previewObservation?.close(); previewObservation = null; timeObservation?.close(); timeObservation = null }
    AsyncFunction("getTimeDisplayPreferences") { promise: Promise ->
      val owner = engine(); owner.presentationChanged { promise.resolve(owner.presentationSnapshot()) }
    }
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
    AsyncFunction("authorizeCalendar") { publicationId: String? -> authorize(UUID.randomUUID().toString(), publicationId) }
    AsyncFunction("beginCalendarAuthorization") { requestId: String, publicationId: String?, promise: Promise -> authorize(requestId, publicationId, promise) }
    AsyncFunction("getCalendarOperationStatus") { id: String, promise: Promise ->
      engine().calendarRequest(block = { CalendarStatusStore(it.database(), System::currentTimeMillis).operation(id) },
        resolve = { promise.resolve(it) }, reject = { promise.reject(it, it, null) })
    }
    AsyncFunction("listOwnedCalendars") { cursor: String?, promise: Promise ->
      CalendarRuntime.get(requireNotNull(appContext.reactContext).applicationContext).list(cursor,
        { promise.resolve(it) }, { promise.reject(it, "Calendar list unavailable: $it", null) })
    }
    AsyncFunction("applyCalendarCommand") { command: Map<String, Any?>, promise: Promise ->
      val runtime = CalendarRuntime.get(requireNotNull(appContext.reactContext).applicationContext)
      val reject: (String) -> Unit = { promise.reject(it, "Calendar action could not be confirmed: $it", null) }
      when (command["kind"]) {
        "RequestCalendarSync" -> runtime.requestSync(command, { promise.resolve(it) }, reject)
        "ConfirmManagedCalendarSetup", "ApplyManagedCalendarPolicy", "PauseManagedCalendar", "DisableManagedCalendar", "ResumeManagedCalendar",
        "ImportManagedCalendarCandidate", "IgnoreManagedCalendarCandidate", "RetryManagedCalendarOperation", "SetCalendarReminderDisposition", "EnableRecoveredCalendarAlerts" ->
          runtime.managedCommand(command, { promise.resolve(it) }, reject)
        "ImportCalendarEvents" -> engine().calendarRequest(true,
          { it.links.captureBatch(command) }, { result ->
            promise.resolve(result)
            @Suppress("UNCHECKED_CAST") val jobs = result["operations"] as List<Map<String, Any?>>
            jobs.forEach { runtime.startLink(CalendarStore.string(it, "operationId"), result["retry"] == true) }
          }, reject)
        "ImportCalendarEvent", "EnableCalendarLink", "ApplyCalendarResolution", "EnableAutomaticCalendarSync", "ActivateCalendarLinks" -> {
          val owner = engine()
          owner.request({ owner.calendarCapture(command) }, { value ->
            @Suppress("UNCHECKED_CAST") val result = value as Map<String, Any?>
            promise.resolve(result)
            if (command["kind"] == "ActivateCalendarLinks") {
              @Suppress("UNCHECKED_CAST") val jobs = result["operations"] as List<Map<String, Any?>>
              jobs.forEach { runtime.startLink(CalendarStore.string(it, "operationId"), result["retry"] == true) }
            } else runtime.startLink(CalendarStore.string(command, "operationId"))
          }, reject)
        }
        "SetCalendarReviewNotifications" -> engine().calendarRequest(true, { it.sync.preference(command) }, { promise.resolve(it) }, reject)
        "RetryCalendarOperation" -> engine().calendarRequest(block = {
          it.links.operation(CalendarStore.string(command, "operationId"))?.let(it.links::view) ?: throw CalendarFailure("NOT_FOUND")
        }, resolve = { promise.resolve(it); runtime.startLink(CalendarStore.string(command, "operationId"), true) }, reject = reject)
        "UnlinkCalendar" -> engine().calendarRequest(true, { it.links.unlink(command) }, { promise.resolve(it) }, reject)
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
    AsyncFunction("listCalendarEvents") { query: Map<String, Any?>, promise: Promise ->
      CalendarRuntime.get(requireNotNull(appContext.reactContext).applicationContext).linkRequest("list", query,
        { promise.resolve(it) }, { promise.reject(it, "Calendar events unavailable: $it", null) })
    }
    AsyncFunction("previewCalendarImport") { event: Map<String, Any?>, choices: Map<String, Any?>, promise: Promise ->
      CalendarRuntime.get(requireNotNull(appContext.reactContext).applicationContext).linkRequest("import", event + mapOf("choices" to choices),
        { promise.resolve(it) }, { promise.reject(it, "Calendar import review unavailable: $it", null) })
    }
    AsyncFunction("previewCalendarLink") { id: String, promise: Promise ->
      CalendarRuntime.get(requireNotNull(appContext.reactContext).applicationContext).linkRequest("link", mapOf("occurrenceId" to id),
        { promise.resolve(it) }, { promise.reject(it, "Calendar link review unavailable: $it", null) })
    }
    AsyncFunction("checkCalendarLink") { id: String, promise: Promise ->
      CalendarRuntime.get(requireNotNull(appContext.reactContext).applicationContext).linkRequest("check", mapOf("occurrenceId" to id),
        { promise.resolve(it) }, { promise.reject(it, it, null) })
    }
    AsyncFunction("previewCalendarUpdate") { id: String, promise: Promise ->
      CalendarRuntime.get(requireNotNull(appContext.reactContext).applicationContext).linkRequest("update", mapOf("occurrenceId" to id),
        { promise.resolve(it) }, { promise.reject(it, "Calendar changes unavailable: $it", null) })
    }
    AsyncFunction("getCalendarLinks") { promise: Promise ->
      engine().calendarRequest(block = { it.links.links() }, resolve = { promise.resolve(it) }, reject = { promise.reject(it, "Calendar links unavailable: $it", null) })
    }
    AsyncFunction("getCalendarContext") { id: String, promise: Promise -> dispatch(promise) { it.calendarContext(id) } }
    AsyncFunction("getCalendarSyncSummary") { promise: Promise ->
      engine().calendarRequest(block = { it.sync.summary() }, resolve = { promise.resolve(it) }, reject = { promise.reject(it, it, null) })
    }
    AsyncFunction("getManagedCalendarState") { promise: Promise ->
      engine().calendarRequest(block = { it.managed.view() }, resolve = { promise.resolve(it) }, reject = { promise.reject(it, it, null) })
    }
    AsyncFunction("getCalendarReminderDisposition") { id: String, promise: Promise ->
      engine().calendarRequest(block = { it.managed.disposition(id) }, resolve = { promise.resolve(it) }, reject = { promise.reject(it, it, null) })
    }
    AsyncFunction("previewManagedCalendarSetup") { choices: Map<String, Any?>, promise: Promise ->
      CalendarRuntime.get(requireNotNull(appContext.reactContext).applicationContext).managedRequest("setup", choices,
        { promise.resolve(it) }, { promise.reject(it, it, null) })
    }
    AsyncFunction("previewManagedCalendarPolicyChange") { choices: Map<String, Any?>, promise: Promise ->
      CalendarRuntime.get(requireNotNull(appContext.reactContext).applicationContext).managedRequest("policy", choices,
        { promise.resolve(it) }, { promise.reject(it, it, null) })
    }
    AsyncFunction("previewManagedCalendarResume") { promise: Promise ->
      CalendarRuntime.get(requireNotNull(appContext.reactContext).applicationContext).managedRequest("resume", emptyMap(),
        { promise.resolve(it) }, { promise.reject(it, it, null) })
    }
    AsyncFunction("previewManagedCalendarCandidate") { id: String, choices: Map<String, Any?>, promise: Promise ->
      CalendarRuntime.get(requireNotNull(appContext.reactContext).applicationContext).managedRequest("candidate", mapOf("candidateId" to id, "choices" to choices),
        { promise.resolve(it) }, { promise.reject(it, it, null) })
    }
    AsyncFunction("previewManagedCalendarRecoveredAlerts") { ids: List<String>, promise: Promise ->
      CalendarRuntime.get(requireNotNull(appContext.reactContext).applicationContext).managedRequest("recovered", mapOf("ids" to ids),
        { promise.resolve(it) }, { promise.reject(it, it, null) })
    }
    AsyncFunction("getCalendarReviewIssues") { cursor: String?, promise: Promise ->
      engine().calendarRequest(block = { it.sync.issues(cursor) }, resolve = { promise.resolve(it) }, reject = { promise.reject(it, it, null) })
    }
    AsyncFunction("previewCalendarActivation") { ids: List<String>, promise: Promise ->
      CalendarRuntime.get(requireNotNull(appContext.reactContext).applicationContext).activation(ids, { promise.resolve(it) }, { promise.reject(it, it, null) })
    }
    AsyncFunction("syncCalendarNow") { id: String?, promise: Promise ->
      CalendarRuntime.get(requireNotNull(appContext.reactContext).applicationContext).syncNow(id).whenComplete { result, error ->
        if (error == null) promise.resolve(result.view()) else { val code = ((error.cause ?: error) as? CalendarFailure)?.code ?: "NETWORK"; promise.reject(code, code, null) }
      }
    }
    AsyncFunction("getCalendarOperations") { promise: Promise ->
      engine().calendarRequest(block = { it.links.operations() }, resolve = { promise.resolve(it) }, reject = { promise.reject(it, "Calendar operations unavailable: $it", null) })
    }
    AsyncFunction("getLists") { promise: Promise -> dispatch(promise) { it.lists() } }
    AsyncFunction("queryLists") { promise: Promise -> dispatch(promise) { it.lists() } }
    AsyncFunction("querySeries") { promise: Promise -> dispatch(promise) { it.querySeries() } }
    AsyncFunction("queryRoutines") { promise: Promise -> dispatch(promise) { it.queryRoutines() } }
    AsyncFunction("previewRoutine") { input: Map<String, Any?>, promise: Promise -> dispatch(promise) { it.previewRoutine(input) } }
    AsyncFunction("getRoutineSession") { id: String, date: String?, promise: Promise -> dispatch(promise) { it.routineSession(id, date) } }
    AsyncFunction("queryRoutineHistory") { id: String, cursor: String?, promise: Promise -> dispatch(promise) { it.routineHistory(id, cursor) } }
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
        "routineChannel" -> Intent(Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
          .putExtra(Settings.EXTRA_CHANNEL_ID, com.remilo.alarm.system.AlarmNotifications.ROUTINE_CHANNEL)
        else -> throw IllegalArgumentException("Unknown settings destination")
      }
      context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
  }
}

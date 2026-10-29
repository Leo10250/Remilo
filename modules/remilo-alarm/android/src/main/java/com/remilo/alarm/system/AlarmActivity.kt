package com.remilo.alarm.system

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.material3.*
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.sp
import androidx.compose.ui.text.font.FontWeight
import com.remilo.alarm.core.SessionRefreshGuard
import com.remilo.alarm.core.AppearancePolicy
import com.remilo.alarm.core.DeliverySnapshot
import com.remilo.alarm.core.PostponeDraft
import com.remilo.alarm.core.PostponePickerDraft
import com.remilo.alarm.core.PostponeTimePolicy
import com.remilo.alarm.data.AlertRecord
import com.remilo.alarm.engine.AlarmEngine
import com.remilo.alarm.presentation.AtmosphereTokens
import androidx.core.view.WindowCompat
import java.util.UUID
import android.widget.Toast
import android.app.Dialog
import android.app.DatePickerDialog
import android.app.TimePickerDialog
import com.remilo.alarm.presentation.L10n
import com.remilo.alarm.presentation.NativeMessages
import java.time.LocalDateTime
import java.time.ZoneId

/** Native-only controls. Empty loading state must never dismiss a live session. */
class AlarmActivity : ComponentActivity() {
  override fun onConfigurationChanged(newConfig: android.content.res.Configuration) {
    super.onConfigurationChanged(newConfig)
    engine.presentationChanged()
    if (pickerDialog != null) {
      pickerViewState = pickerDialog?.onSaveInstanceState()
      dismissPicker()
      window.decorView.post { showPicker() }
    }
  }
  private val snapshot = mutableStateOf<AlarmEngine.SessionSnapshot?>(null)
  private val error = mutableStateOf<String?>(null)
  private val refreshError = mutableStateOf<String?>(null)
  private val busy = mutableStateOf(false)
  private val postpone = mutableStateOf<PostponeDraft?>(null)
  private val progress = mutableStateOf<String?>(null)
  private val loadingAppearance = mutableStateOf(AppearancePolicy.resolve(null, null, System.currentTimeMillis(),
    java.time.ZoneId.systemDefault(), false))
  private val guard = SessionRefreshGuard()
  private var pendingCommand: Map<String, Any?>? = null
  private var deferredIntent: Intent? = null
  private val unconfirmed = mutableStateOf(false)
  private var observation: AutoCloseable? = null
  private lateinit var engine: AlarmEngine
  private var pickerDialog: Dialog? = null
  private var pickerViewState: Bundle? = null
  private var dismissingPicker = false
  private fun select(intent: Intent) {
    val id = intent.getStringExtra("sessionId") ?: run {
      if (pendingCommand == null && !busy.value && !unconfirmed.value && postpone.value == null) finish()
      return
    }
    val preserveAction = pendingCommand != null || busy.value || unconfirmed.value || postpone.value != null
    // Keep the selected session and exact retry even when a later alarm starts a new group.
    if (!guard.select(id, pendingCommand != null, busy.value, unconfirmed.value, choosing = postpone.value != null)) {
      if (id != this.intent.getStringExtra("sessionId")) deferredIntent = Intent(intent)
      refresh(); return
    }
    setIntent(intent)
    val atmosphere = intent.getStringExtra("atmosphere")
    val brightness = intent.getStringExtra("brightness")
    loadingAppearance.value = if (atmosphere in AppearancePolicy.atmospheres && brightness in setOf("light", "dark"))
      AppearancePolicy.captured(atmosphere, brightness) else AppearancePolicy.resolve(null, null,
        System.currentTimeMillis(), java.time.ZoneId.systemDefault(),
        (resources.configuration.uiMode and android.content.res.Configuration.UI_MODE_NIGHT_MASK) == android.content.res.Configuration.UI_MODE_NIGHT_YES)
    snapshot.value = null; refreshError.value = null
    if (!preserveAction) {
      pendingCommand = null; unconfirmed.value = false; error.value = null; busy.value = false; progress.value = null
    }
    refresh()
  }
  private fun refresh() {
    val ticket = guard.request()
    engine.sessionSnapshot(ticket.sessionId, { current -> runOnUiThread {
      if (!isDestroyed && guard.accepts(ticket) && current.id == ticket.sessionId) {
        snapshot.value = current
        refreshError.value = null
        val draft = postpone.value
        if (draft != null && pendingCommand == null && !busy.value && !unconfirmed.value &&
          !draft.matches(current.id, current.state, current.members.map { DeliverySnapshot.Member(it.first.occurrenceId, it.first.generation) })) {
          postpone.value = draft.copy(stale = true, picker = null)
          dismissPicker()
        }
        if (SessionRefreshGuard.mayDismiss(current.state, pendingCommand != null, busy.value, unconfirmed.value)) {
          discardPostpone()
          val incoming = deferredIntent
          if (incoming != null) { deferredIntent = null; select(incoming) } else finish()
        }
      }
    } }, { runOnUiThread { if (!isDestroyed && guard.accepts(ticket)) refreshError.value = if (snapshot.value == null) "Could not load alarm controls." else "Could not refresh alarm controls." } })
  }
  private fun act(kind: String, record: AlertRecord? = null) {
    if (kind in setOf("Postpone", "PostponeAll")) { openPostpone(kind == "PostponeAll", record); return }
    val current = snapshot.value ?: return
    if (busy.value || pendingCommand != null || postpone.value != null) return
    error.value = null; refreshError.value = null
    val title = current.members.firstOrNull { it.first.occurrenceId == record?.occurrenceId }?.second ?: "Reminder"
    progress.value = when (kind) { "DoneAll" -> "Completing ${current.members.size} reminders…";
      "SnoozeAll" -> "Snoozing ${current.members.size} reminders…"; "Snooze" -> "Snoozing $title…"; else -> "Completing $title…" }
    val command = mutableMapOf<String, Any?>("kind" to kind, "operationId" to UUID.randomUUID().toString(),
      "expectedSessionId" to current.id, "occurrenceId" to record?.occurrenceId, "expectedGeneration" to record?.generation)
    if (kind in setOf("DoneAll", "SnoozeAll")) command["members"] = DeliverySnapshot.maps(current.members.map {
      DeliverySnapshot.Member(it.first.occurrenceId, it.first.generation) })
    if (kind == "SnoozeAll") command["snoozeMinutes"] = current.members.first().first.snoozeMinutes
    if (kind == "Snooze") command["expectedSnoozeMinutes"] = record?.snoozeMinutes
    pendingCommand = command
    sendAction(command)
  }
  private fun openPostpone(all: Boolean, record: AlertRecord?) {
    val current = snapshot.value ?: return
    if (busy.value || pendingCommand != null || unconfirmed.value || postpone.value != null || SessionRefreshGuard.ended(current.state)) return
    val selected = if (all) current.members.map { it.first } else current.members.map { it.first }.filter {
      it.occurrenceId == record?.occurrenceId && it.generation == record?.generation
    }
    if (selected.isEmpty()) { refresh(); return }
    val at = System.currentTimeMillis()
    val zone = ZoneId.systemDefault().id
    val target = PostponeTimePolicy.resolve(mapOf("kind" to "Relative", "zoneId" to zone, "referenceAtMs" to at, "minutes" to 15))
    val preferences = current.postponePreferences
    postpone.value = PostponeDraft(current.id, selected.map { DeliverySnapshot.Member(it.occurrenceId, it.generation) }, all,
      zone, "15", (target["instantMs"] as Number).toLong(), at, preferences?.revision,
      preferences?.let { listOf(it.tomorrowMorning, it.tomorrowAfternoon, it.tomorrowEvening) })
    error.value = null
  }
  private fun choosePostpone(key: String) {
    val draft = postpone.value ?: return
    if (busy.value || pendingCommand != null || unconfirmed.value || draft.stale) return
    if (key == "custom") {
      postpone.value = draft.beginCustom(System.currentTimeMillis())
      error.value = null; return
    }
    val at = System.currentTimeMillis()
    val input = mutableMapOf<String, Any?>("zoneId" to draft.zoneId, "referenceAtMs" to at)
    if (key.startsWith("tomorrow-")) {
      val index = key.substringAfter('-').toIntOrNull() ?: return
      val minutes = draft.tomorrowMinutes?.getOrNull(index) ?: return
      input["kind"] = "Tomorrow"; input["minutesOfDay"] = minutes
    } else {
      val minutes = key.toIntOrNull()?.takeIf { it in setOf(15, 30, 60, 1440) } ?: return
      input["kind"] = "Relative"; input["minutes"] = minutes
    }
    try {
      val resolved = PostponeTimePolicy.resolve(input)
      postpone.value = draft.copy(selection = key, targetMs = (resolved["instantMs"] as Number).toLong(), referenceAtMs = at,
        adjustment = resolved["adjustment"] as String, picker = null)
      error.value = null
    } catch (_: Exception) { error.value = L10n.text(this, NativeMessages.postpone_failed_time()) }
  }
  private fun confirmPostpone() {
    val draft = postpone.value ?: return
    if (busy.value || pendingCommand != null || unconfirmed.value || draft.stale || draft.picker != null) return
    val current = snapshot.value ?: return
    if (!draft.matches(current.id, current.state, current.members.map { DeliverySnapshot.Member(it.first.occurrenceId, it.first.generation) })) {
      postpone.value = draft.copy(stale = true)
      return
    }
    if (draft.targetMs <= System.currentTimeMillis()) { error.value = L10n.text(this, NativeMessages.postpone_future_time()); return }
    val command = draft.command(UUID.randomUUID().toString())
    error.value = null; refreshError.value = null
    progress.value = L10n.text(this, if (draft.all) NativeMessages.postpone_submitting_group(draft.members.size) else NativeMessages.postpone_submitting())
    pendingCommand = command
    sendAction(command)
  }
  private fun closePostpone() {
    if (busy.value || pendingCommand != null || unconfirmed.value) return
    discardPostpone(); error.value = null
    val incoming = deferredIntent
    if (incoming != null) { deferredIntent = null; select(incoming) } else refresh()
  }
  private fun backToPostponeChoices() {
    if (busy.value || pendingCommand != null || unconfirmed.value) return
    dismissPicker()
    postpone.value = postpone.value?.copy(picker = null)
    error.value = null
  }
  private fun pickCustomField(step: String) {
    val draft = postpone.value ?: return
    val custom = draft.picker ?: return
    if (busy.value || pendingCommand != null || unconfirmed.value || draft.stale || step !in setOf("date", "time")) return
    postpone.value = draft.copy(picker = custom.copy(step = step))
    pickerViewState = null
    showPicker()
  }
  private fun useCustomTime() {
    val draft = postpone.value ?: return
    val custom = draft.picker ?: return
    if (busy.value || pendingCommand != null || unconfirmed.value || draft.stale || custom.step != "custom") return
    try {
      val at = System.currentTimeMillis()
      postpone.value = draft.useCustom(at)
      error.value = null
    } catch (_: Exception) { error.value = L10n.text(this, NativeMessages.postpone_future_time()) }
  }
  private fun discardPostpone() { postpone.value = null; dismissPicker(); pickerViewState = null }
  private fun dismissPicker() {
    dismissingPicker = true
    pickerDialog?.dismiss(); pickerDialog = null
    dismissingPicker = false
  }
  /** System-owned date/time dialogs retain provisional input and never issue an action. */
  private fun showPicker() {
    val draft = postpone.value ?: return
    val picking = draft.picker ?: return
    if (picking.step == "custom") return
    if (isDestroyed || isFinishing || pickerDialog?.isShowing == true || pendingCommand != null) return
    val local = try { LocalDateTime.parse(picking.local) } catch (_: Exception) {
      postpone.value = draft.copy(picker = null); return
    }
    var accepted = false
    val dialog: Dialog = if (picking.step == "date") DatePickerDialog(this, { _, year, month, day ->
      accepted = true
      val active = postpone.value
      if (active != null && active.sessionId == draft.sessionId && active.picker == picking && !active.stale) {
        val chosen = LocalDateTime.of(year, month + 1, day, local.hour, local.minute)
        postpone.value = active.copy(picker = PostponePickerDraft(chosen.toString()))
        error.value = null
      }
    }, local.year, local.monthValue - 1, local.dayOfMonth) else TimePickerDialog(this, { _, hour, minute ->
      accepted = true
      val active = postpone.value
      if (active != null && active.sessionId == draft.sessionId && active.picker == picking && !active.stale) {
        val chosen = local.withHour(hour).withMinute(minute).withSecond(0).withNano(0)
        postpone.value = active.copy(picker = PostponePickerDraft(chosen.toString()))
        error.value = null
      }
    }, local.hour, local.minute, android.text.format.DateFormat.is24HourFormat(this))
    pickerDialog = dialog
    dialog.setOnDismissListener {
      val owned = pickerDialog === dialog
      if (owned) pickerDialog = null
      if (owned && !accepted && !dismissingPicker && !isDestroyed) {
        postpone.value?.let { if (it.sessionId == draft.sessionId && it.picker == picking) postpone.value = it.copy(picker = picking.copy(step = "custom")) }
      }
    }
    pickerViewState?.let { dialog.onRestoreInstanceState(it) }; pickerViewState = null
    dialog.show()
  }
  private fun retry() { pendingCommand?.let(::sendAction) ?: refresh() }
  private fun sendAction(command: Map<String, Any?>) {
    if (busy.value) return
    busy.value = true; unconfirmed.value = false; error.value = null
    engine.request({ engine.apply(command) }, { result -> runOnUiThread {
      if (!isDestroyed && pendingCommand?.get("operationId") == command["operationId"]) {
        busy.value = false; progress.value = null
        val status = result as? Map<*, *>
        val definitive = status?.get("status") in setOf("Applied", "Rejected", "Partial", "Blocked")
        if (definitive) { pendingCommand = null; unconfirmed.value = false }
        else {
          pendingCommand = command; unconfirmed.value = true
          error.value = "Could not confirm this action. Retry the same action."
        }
        if (status?.get("status") == "Rejected") error.value = status["errorMessage"] as? String ?: "Could not apply this action. Retry."
        if (status?.get("status") in setOf("Partial", "Blocked")) {
          val outcomes = status?.get("memberResults") as? List<*>
          val scheduled = outcomes?.count { (it as? Map<*, *>)?.get("status") == "Scheduled" } ?: 0
          val postponing = command["kind"] in setOf("Postpone", "PostponeAll")
          val message = if (postponing) {
            if (outcomes != null) L10n.text(this, NativeMessages.postpone_partial(scheduled, outcomes.size))
            else L10n.text(this, NativeMessages.postpone_failed_schedule())
          } else if (outcomes != null) "$scheduled of ${outcomes.size} reminders snoozed. Review alert problems in Remilo."
            else "Could not schedule Snooze. Review alert problems in Remilo."
          error.value = message
          Toast.makeText(this, com.remilo.alarm.presentation.L10n.text(this, message), Toast.LENGTH_LONG).show()
        }
        if (status?.get("status") == "Pending") {
          pendingCommand = command; unconfirmed.value = true
          val message = if (command["kind"] in setOf("Postpone", "PostponeAll")) L10n.text(this, NativeMessages.postpone_pending())
            else "Snooze is saved; scheduling is pending. Retry the same action."
          error.value = message
          Toast.makeText(this, message, Toast.LENGTH_LONG).show()
        }
        if (status?.get("status") == "Applied" && command["kind"] in setOf("CompleteDelivery", "DoneAll")) {
          val message = if (command["kind"] == "DoneAll") "${status["count"]} reminders completed" else "Reminder completed"
          Toast.makeText(this, message, Toast.LENGTH_SHORT).show()
        }
        if (definitive && status?.get("status") != "Rejected" && command["kind"] in setOf("Postpone", "PostponeAll")) discardPostpone()
        if (definitive && deferredIntent != null) {
          val incoming = deferredIntent!!; deferredIntent = null; select(incoming)
        } else refresh() // A terminated snapshot closes only after a definitive action acknowledgement.
      }
    } }, { runOnUiThread { if (!isDestroyed && pendingCommand?.get("operationId") == command["operationId"]) {
      busy.value = false; progress.value = null; unconfirmed.value = true
      error.value = "Could not confirm this action. Retry the same action."; refresh()
    } } })
  }
  override fun onNewIntent(intent: Intent) { super.onNewIntent(intent); select(intent) }
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setShowWhenLocked(true); setTurnScreenOn(true)
    engine = AlarmEngine.get(this)
    deferredIntent = savedInstanceState?.getParcelable("deferredIntent", Intent::class.java)
    postpone.value = savedInstanceState?.getBundle("postponeDraft")?.let(PostponeSavedState::restore)
    pickerViewState = savedInstanceState?.getBundle("postponePickerView")
    savedInstanceState?.getBundle("pendingAction")?.let { saved ->
      if (saved.getString("sessionId") != null) {
        pendingCommand = mapOf<String, Any?>("kind" to saved.getString("kind"), "operationId" to saved.getString("operationId"),
          "expectedSessionId" to saved.getString("sessionId"), "occurrenceId" to saved.getString("occurrenceId"),
          "expectedGeneration" to if (saved.containsKey("generation")) saved.getLong("generation") else null).toMutableMap().also { command ->
          val ids = saved.getStringArray("memberIds")
          val generations = saved.getLongArray("memberGenerations")
          if (ids != null && generations != null && ids.size == generations.size)
            command["members"] = DeliverySnapshot.maps(ids.indices.map { DeliverySnapshot.Member(ids[it], generations[it]) })
          if (saved.containsKey("snoozeMinutes")) command["snoozeMinutes"] = saved.getInt("snoozeMinutes")
          if (saved.containsKey("expectedSnoozeMinutes")) command["expectedSnoozeMinutes"] = saved.getInt("expectedSnoozeMinutes")
          if (saved.containsKey("alarmAtMs")) command["alarmAtMs"] = saved.getLong("alarmAtMs")
        }
        unconfirmed.value = true; error.value = "Could not confirm this action. Retry the same action."
      }
    }
    val savedSession = pendingCommand?.get("expectedSessionId") as? String ?: postpone.value?.sessionId
    val initialIntent = savedSession?.let {
      if (savedSession != intent.getStringExtra("sessionId")) deferredIntent = Intent(intent)
      Intent(intent).putExtra("sessionId", savedSession)
    } ?: intent
    select(initialIntent)
    observation = engine.observe { runOnUiThread { if (!isDestroyed) refresh() } }
    setContent {
      val current = snapshot.value
      val dark = (current?.theme ?: loadingAppearance.value.brightness) == "dark"
      val roles = AtmosphereTokens.colors(current?.atmosphere ?: loadingAppearance.value.atmosphere, if (dark) "dark" else "light")
      val scheme = if (dark) darkColorScheme(primary = Color(roles.primary), onPrimary = Color(roles.onPrimary),
        background = Color(roles.canvas), surface = Color(roles.surface), onSurface = Color(roles.onSurface),
        onSurfaceVariant = Color(roles.onSurfaceVariant), surfaceVariant = Color(roles.container), outline = Color(roles.outline), error = Color(roles.error))
        else lightColorScheme(primary = Color(roles.primary), onPrimary = Color(roles.onPrimary),
          background = Color(roles.canvas), surface = Color(roles.surface), onSurface = Color(roles.onSurface),
          onSurfaceVariant = Color(roles.onSurfaceVariant), surfaceVariant = Color(roles.container), outline = Color(roles.outline), error = Color(roles.error))
      SideEffect {
        WindowCompat.getInsetsController(window, window.decorView).apply {
          isAppearanceLightStatusBars = !dark; isAppearanceLightNavigationBars = !dark
        }
      }
      val baseType = Typography()
      val englishType = Typography(
        // The larger single-alarm headline remains a deliberate native hierarchy.
        headlineLarge = baseType.headlineLarge.copy(fontSize = 28.sp, lineHeight = 36.sp),
        headlineMedium = baseType.headlineMedium.copy(fontSize = AtmosphereTokens.typeTitle.sp, lineHeight = AtmosphereTokens.spaceXl.sp),
        titleLarge = baseType.titleLarge.copy(fontSize = AtmosphereTokens.typeTitle.sp, lineHeight = AtmosphereTokens.spaceXl.sp),
        titleMedium = baseType.titleMedium.copy(fontSize = AtmosphereTokens.typeHeading.sp, lineHeight = (AtmosphereTokens.typeHeading + AtmosphereTokens.spaceSm).sp),
        bodyLarge = baseType.bodyLarge.copy(fontSize = AtmosphereTokens.typeBody.sp, lineHeight = AtmosphereTokens.spaceLg.sp),
        bodyMedium = baseType.bodyMedium.copy(fontSize = AtmosphereTokens.typeSupporting.sp, lineHeight = 20.sp),
        bodySmall = baseType.bodySmall.copy(fontSize = AtmosphereTokens.typeSupporting.sp, lineHeight = 20.sp),
        labelLarge = baseType.labelLarge.copy(fontSize = AtmosphereTokens.typeLabel.sp, lineHeight = 20.sp),
        labelMedium = baseType.labelMedium.copy(fontSize = AtmosphereTokens.typeLabel.sp, lineHeight = 20.sp),
        labelSmall = baseType.labelSmall.copy(fontSize = AtmosphereTokens.typeLabel.sp, lineHeight = 20.sp)
      )
      val type = if (com.remilo.alarm.system.PresentationLanguage.language != "zh-Hans") englishType else englishType.copy(
        headlineLarge = englishType.headlineLarge.copy(fontSize = AtmosphereTokens.chineseDisplaySize.sp, lineHeight = AtmosphereTokens.chineseDisplayLineHeight.sp, fontWeight = FontWeight(AtmosphereTokens.chineseDisplayWeight), letterSpacing = 0.sp),
        headlineMedium = englishType.headlineMedium.copy(fontSize = AtmosphereTokens.chineseTitleSize.sp, lineHeight = AtmosphereTokens.chineseTitleLineHeight.sp, fontWeight = FontWeight(AtmosphereTokens.chineseTitleWeight), letterSpacing = 0.sp),
        titleLarge = englishType.titleLarge.copy(fontSize = AtmosphereTokens.chineseAppBarSize.sp, lineHeight = AtmosphereTokens.chineseAppBarLineHeight.sp, fontWeight = FontWeight(AtmosphereTokens.chineseAppBarWeight), letterSpacing = 0.sp),
        titleMedium = englishType.titleMedium.copy(fontSize = AtmosphereTokens.chineseHeadingSize.sp, lineHeight = AtmosphereTokens.chineseHeadingLineHeight.sp, fontWeight = FontWeight(AtmosphereTokens.chineseHeadingWeight), letterSpacing = 0.sp),
        bodyLarge = englishType.bodyLarge.copy(fontSize = AtmosphereTokens.chineseBodySize.sp, lineHeight = AtmosphereTokens.chineseBodyLineHeight.sp, fontWeight = FontWeight(AtmosphereTokens.chineseBodyWeight), letterSpacing = 0.sp),
        bodyMedium = englishType.bodyMedium.copy(fontSize = AtmosphereTokens.chineseSupportingSize.sp, lineHeight = AtmosphereTokens.chineseSupportingLineHeight.sp, fontWeight = FontWeight(AtmosphereTokens.chineseSupportingWeight), letterSpacing = 0.sp),
        bodySmall = englishType.bodySmall.copy(fontSize = AtmosphereTokens.chineseSupportingSize.sp, lineHeight = AtmosphereTokens.chineseSupportingLineHeight.sp, fontWeight = FontWeight(AtmosphereTokens.chineseSupportingWeight), letterSpacing = 0.sp),
        labelLarge = englishType.labelLarge.copy(fontSize = AtmosphereTokens.chineseBodySize.sp, lineHeight = AtmosphereTokens.chineseBodyLineHeight.sp, fontWeight = FontWeight.Medium, letterSpacing = 0.sp),
        labelMedium = englishType.labelMedium.copy(fontSize = AtmosphereTokens.chineseSupportingSize.sp, lineHeight = AtmosphereTokens.chineseSupportingLineHeight.sp, fontWeight = FontWeight(AtmosphereTokens.chineseSupportingWeight), letterSpacing = 0.sp),
        labelSmall = englishType.labelSmall.copy(fontSize = AtmosphereTokens.chineseSupportingSize.sp, lineHeight = AtmosphereTokens.chineseSupportingLineHeight.sp, fontWeight = FontWeight(AtmosphereTokens.chineseSupportingWeight), letterSpacing = 0.sp))
      MaterialTheme(colorScheme = scheme, typography = type) {
        AlarmControlsScreen(current, busy.value, error.value, { action, record -> act(action.commandKind, record) }, ::retry, roles, progress.value, refreshError.value, unconfirmed.value)
        postpone.value?.let { draft ->
          val subject = current?.members?.firstOrNull { it.first.occurrenceId == draft.members.first().occurrenceId }?.second
            ?: L10n.text(NativeMessages.m_31757bbfa17e())
          PostponeChooser(draft, subject, current?.id == draft.sessionId, busy.value, unconfirmed.value, error.value, roles,
            ::closePostpone, ::choosePostpone, ::confirmPostpone, ::retry, ::backToPostponeChoices, ::pickCustomField, ::useCustomTime)
        }
      }
    }
    if (postpone.value?.picker != null && pendingCommand == null) window.decorView.post { showPicker() }
  }
  override fun onSaveInstanceState(outState: Bundle) {
    deferredIntent?.let { outState.putParcelable("deferredIntent", it) }
    postpone.value?.let { outState.putBundle("postponeDraft", PostponeSavedState.save(it)) }
    pickerDialog?.onSaveInstanceState()?.let { outState.putBundle("postponePickerView", it) }
    pendingCommand?.let { command -> outState.putBundle("pendingAction", Bundle().apply {
      putString("kind", command["kind"] as String); putString("operationId", command["operationId"] as String)
      putString("sessionId", command["expectedSessionId"] as String)
      putString("occurrenceId", command["occurrenceId"] as? String)
      (command["expectedGeneration"] as? Long)?.let { putLong("generation", it) }
      (command["members"] as? List<*>)?.let { raw ->
        val members = raw.map { it as Map<*, *> }
        putStringArray("memberIds", members.map { it["occurrenceId"] as String }.toTypedArray())
        putLongArray("memberGenerations", members.map { (it["expectedGeneration"] as Number).toLong() }.toLongArray())
      }
      (command["snoozeMinutes"] as? Int)?.let { putInt("snoozeMinutes", it) }
      (command["expectedSnoozeMinutes"] as? Int)?.let { putInt("expectedSnoozeMinutes", it) }
      (command["alarmAtMs"] as? Number)?.let { putLong("alarmAtMs", it.toLong()) }
    }) }
    super.onSaveInstanceState(outState)
  }
  override fun onDestroy() { observation?.close(); dismissPicker(); super.onDestroy() }
}

package com.remilo.alarm.system

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.activity.compose.BackHandler
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.LifecycleOwner
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.dp
import com.remilo.alarm.core.PostponeDraft
import com.remilo.alarm.core.PostponeTimePolicy
import com.remilo.alarm.presentation.AtmosphereTokens
import com.remilo.alarm.presentation.L10n
import com.remilo.alarm.presentation.NativeMessages
import java.text.DateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.time.LocalDateTime
import java.time.ZoneOffset
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive

/** Native presentation only: choosing a tile never changes delivery or the audio session. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun PostponeChooser(
  draft: PostponeDraft, subject: String, ready: Boolean,
  busy: Boolean, unconfirmed: Boolean, error: String?, roles: AtmosphereTokens.Roles,
  onClose: () -> Unit, onChoice: (String) -> Unit, onConfirm: () -> Unit, onRetry: () -> Unit,
  onBackChoices: () -> Unit, onPickField: (String) -> Unit, onUseCustom: () -> Unit
) {
  val canDismiss = !busy && !unconfirmed
  val latestDismiss = rememberUpdatedState(canDismiss)
  val confirmDismiss = remember { { value: SheetValue -> value != SheetValue.Hidden || latestDismiss.value } }
  val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true,
    confirmValueChange = confirmDismiss)
  var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
  val lifecycle = (LocalContext.current as? LifecycleOwner)?.lifecycle
  var foreground by remember(lifecycle) { mutableStateOf(lifecycle?.currentState?.isAtLeast(Lifecycle.State.STARTED) != false) }
  DisposableEffect(lifecycle) {
    val observer = LifecycleEventObserver { _, _ -> foreground = lifecycle?.currentState?.isAtLeast(Lifecycle.State.STARTED) != false }
    lifecycle?.addObserver(observer)
    onDispose { lifecycle?.removeObserver(observer) }
  }
  // Cosmetic validity only. The serialized native mutation validates again.
  LaunchedEffect(draft.targetMs, foreground) {
    if (!foreground) return@LaunchedEffect
    while (isActive) { now = System.currentTimeMillis(); delay(1_000) }
  }
  val frozen = !ready || busy || unconfirmed || draft.stale
  val custom = draft.picker != null
  var previousCustom by remember { mutableStateOf(custom) }
  LaunchedEffect(custom) {
    // A dialog-window Back can reach the modal dismissal callback before the
    // inner BackHandler. Returning from Custom must restore visible choices.
    if (previousCustom && !custom) sheetState.show()
    previousCustom = custom
  }
  val customTime = if (custom) runCatching { PostponeTimePolicy.resolve(mapOf("kind" to "Custom", "zoneId" to draft.zoneId,
    "referenceAtMs" to now, "local" to draft.picker!!.local)) }.getOrNull() else null
  val shownTarget = if (custom) (customTime?.get("instantMs") as? Number)?.toLong() else draft.targetMs
  val future = shownTarget != null && shownTarget > now
  val time = rememberDeviceTimeFormat(TimeZone.getTimeZone(draft.zoneId))
  val shortcutClock = rememberDeviceTimeFormat(TimeZone.getTimeZone("UTC"))
  val date = remember(draft.zoneId, PresentationLanguage.localeTag) {
    DateFormat.getDateInstance(DateFormat.MEDIUM, Locale.forLanguageTag(PresentationLanguage.localeTag)).apply {
      timeZone = TimeZone.getTimeZone(draft.zoneId)
    }
  }
  val target = shownTarget?.let { date.format(Date(it)) + " · " + time.format(Date(it)) } ?: "—"
  val tomorrow = (0..2).map { draft.tomorrowMinutes?.get(it) }
  data class Tile(val key: String, val label: String, val supporting: String? = null, val enabled: Boolean = true)
  fun relativePreview(minutes: Int): String = runCatching {
    val instant = if (draft.selection == minutes.toString()) draft.targetMs else
      (PostponeTimePolicy.resolve(mapOf("kind" to "Relative", "zoneId" to draft.zoneId, "referenceAtMs" to now, "minutes" to minutes))["instantMs"] as Number).toLong()
    time.format(Date(instant))
  }.getOrDefault("—")
  val tiles = listOf(
    Tile("15", L10n.text(NativeMessages.postpone_15_minutes()), relativePreview(15)),
    Tile("30", L10n.text(NativeMessages.postpone_30_minutes()), relativePreview(30)),
    Tile("60", L10n.text(NativeMessages.postpone_one_hour()), relativePreview(60)),
    Tile("1440", L10n.text(NativeMessages.postpone_one_day()), L10n.text(NativeMessages.postpone_24_hours()) + "\n" + relativePreview(1440))
  ) + tomorrow.mapIndexed { index, minutes -> Tile("tomorrow-$index", L10n.text(NativeMessages.postpone_tomorrow()),
    minutes?.let { shortcutClock.format(Date(it * 60_000L)) } ?: "—", minutes != null) } +
    Tile("custom", L10n.text(NativeMessages.postpone_custom()), L10n.text(NativeMessages.postpone_date_time()))

  ModalBottomSheet(onDismissRequest = { if (canDismiss) { if (custom) onBackChoices() else onClose() } }, sheetState = sheetState,
    containerColor = Color(roles.surface), contentColor = Color(roles.onSurface),
    shape = RoundedCornerShape(topStart = AtmosphereTokens.shapeSheet.dp, topEnd = AtmosphereTokens.shapeSheet.dp)) {
    BackHandler(enabled = custom && canDismiss) { onBackChoices() }
    BoxWithConstraints(Modifier.fillMaxWidth().fillMaxHeight(.94f)) {
      val density = LocalDensity.current
      val measurer = rememberTextMeasurer()
      val tileStyle = MaterialTheme.typography.bodyLarge.copy(fontWeight = FontWeight.Medium)
      val supportStyle = MaterialTheme.typography.bodyMedium
      val proposedWidth = with(density) { ((maxWidth - 40.dp) / 2 - 48.dp).roundToPx() }.coerceAtLeast(1)
      val needsMoreWidth = tiles.any { tile ->
        measurer.measure(tile.label, tileStyle, constraints = Constraints(maxWidth = proposedWidth)).lineCount > 1 ||
          tile.supporting?.let { measurer.measure(it, supportStyle, constraints = Constraints(maxWidth = proposedWidth)).lineCount > 2 } == true
      }
      val columns = if (density.fontScale >= 1.6f || needsMoreWidth) 1 else 2
      val labelWidth = with(density) { ((maxWidth - 32.dp - 8.dp * (columns - 1)) / columns - 48.dp).roundToPx() }.coerceAtLeast(1)
      val tallest = tiles.maxOf { tile ->
        measurer.measure(tile.label, tileStyle, constraints = Constraints(maxWidth = labelWidth)).size.height +
          (tile.supporting?.let { measurer.measure(it, supportStyle, constraints = Constraints(maxWidth = labelWidth)).size.height + with(density) { 4.dp.roundToPx() } } ?: 0)
      }
      val tileHeight = with(density) { tallest.toDp() + 24.dp }.coerceAtLeast(AtmosphereTokens.postponeTile.dp)
      var footerHeight by remember { mutableIntStateOf(0) }
      val footerOverflows = with(density) { footerHeight.toDp() } > maxHeight - AtmosphereTokens.nativeSingle.dp
      val header: @Composable () -> Unit = {
        Row(Modifier.fillMaxWidth().padding(start = 16.dp, end = 8.dp), verticalAlignment = Alignment.CenterVertically) {
          Text(if (custom) L10n.text(NativeMessages.postpone_custom_date_time()) else if (draft.all) L10n.text(NativeMessages.postpone_all_action(draft.members.size)) else L10n.text(NativeMessages.m_a5200499d443()),
            style = MaterialTheme.typography.headlineMedium, modifier = Modifier.weight(1f).semantics { heading() })
          TextButton(onClick = onClose, enabled = canDismiss, modifier = Modifier.defaultMinSize(minWidth = 48.dp, minHeight = 48.dp)) {
            Text(L10n.text(NativeMessages.m_19766ed6ccb2()), color = Color(if (canDismiss) roles.primary else roles.disabledInk))
          }
        }
      }
      val content: @Composable () -> Unit = {
        Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
          Text(if (draft.all) L10n.text(NativeMessages.postpone_group_subject(draft.members.size)) else subject,
            style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Medium)
          Text(if (draft.all) L10n.text(NativeMessages.postpone_scope_group(draft.members.size)) else L10n.text(NativeMessages.postpone_scope_single()),
            style = MaterialTheme.typography.bodyMedium, color = Color(roles.onSurfaceVariant))
          if (custom) {
            val nominal = runCatching { LocalDateTime.parse(draft.picker!!.local) }.getOrNull()
            val carrier = nominal?.toInstant(ZoneOffset.UTC)?.toEpochMilli()
            val customDate = DateFormat.getDateInstance(DateFormat.MEDIUM, Locale.forLanguageTag(PresentationLanguage.localeTag)).apply { timeZone = TimeZone.getTimeZone("UTC") }
            OutlinedButton(onClick = { onPickField("date") }, enabled = !frozen,
              modifier = Modifier.fillMaxWidth().heightIn(min = 64.dp), shape = RoundedCornerShape(16.dp),
              border = BorderStroke(1.dp, Color(roles.outline)), colors = ButtonDefaults.outlinedButtonColors(contentColor = Color(roles.onSurface))) {
              Column(Modifier.fillMaxWidth().padding(4.dp)) {
                Text(L10n.text(NativeMessages.m_99c40ab40592()), style = MaterialTheme.typography.bodyMedium, color = Color(roles.onSurfaceVariant))
                Text(carrier?.let { customDate.format(Date(it)) } ?: "—", style = MaterialTheme.typography.bodyLarge)
              }
            }
            OutlinedButton(onClick = { onPickField("time") }, enabled = !frozen,
              modifier = Modifier.fillMaxWidth().heightIn(min = 64.dp), shape = RoundedCornerShape(16.dp),
              border = BorderStroke(1.dp, Color(roles.outline)), colors = ButtonDefaults.outlinedButtonColors(contentColor = Color(roles.onSurface))) {
              Column(Modifier.fillMaxWidth().padding(4.dp)) {
                Text(L10n.text(NativeMessages.m_33b93476cf59()), style = MaterialTheme.typography.bodyMedium, color = Color(roles.onSurfaceVariant))
                Text(carrier?.let { shortcutClock.format(Date(it)) } ?: "—", style = MaterialTheme.typography.bodyLarge)
              }
            }
          } else Column(Modifier.fillMaxWidth().selectableGroup(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            tiles.chunked(columns).forEach { row ->
              Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                row.forEach { tile ->
                  PostponeTile(tile.label, tile.supporting, draft.selection == tile.key, !frozen && tile.enabled,
                    tile.key == "custom", roles, Modifier.weight(1f).heightIn(min = tileHeight).fillMaxHeight()) { onChoice(tile.key) }
                }
              }
            }
          }
          if (!custom && draft.tomorrowMinutes == null) Text(L10n.text(NativeMessages.postpone_saved_times_locked()),
            style = MaterialTheme.typography.bodyMedium, color = Color(roles.onSurfaceVariant))
          val adjustment = if (custom) customTime?.get("adjustment") else draft.adjustment
          if (adjustment != null && adjustment != "none") Text(L10n.text(if (adjustment == "gapForward") NativeMessages.m_d242331f3d81() else NativeMessages.m_9365adde07dc()),
            style = MaterialTheme.typography.bodyMedium, color = Color(roles.onSurfaceVariant))
          Spacer(Modifier.height(4.dp))
        }
      }
      val footer: @Composable () -> Unit = {
        Column(Modifier.fillMaxWidth().onSizeChanged { footerHeight = it.height }.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
          Surface(color = Color(roles.canvas), shape = RoundedCornerShape(16.dp)) {
            Column(Modifier.fillMaxWidth().padding(12.dp).semantics { liveRegion = LiveRegionMode.Polite }) {
              Text(if (draft.all) L10n.text(NativeMessages.postpone_next_group(draft.members.size)) else L10n.text(NativeMessages.postpone_next_alert()),
                style = MaterialTheme.typography.bodyMedium, color = Color(roles.onSurfaceVariant))
              Text(target, style = MaterialTheme.typography.bodyLarge)
              Text(L10n.text(NativeMessages.postpone_zone(draft.zoneId)), style = MaterialTheme.typography.bodyMedium, color = Color(roles.onSurfaceVariant))
            }
          }
          val warning = when {
            draft.stale && !unconfirmed -> L10n.text(NativeMessages.postpone_stale())
            !future && !busy && !unconfirmed -> L10n.text(NativeMessages.postpone_future_time())
            else -> error?.let(L10n::text)
          }
          warning?.let { Text(it, color = Color(roles.error), style = MaterialTheme.typography.bodyMedium,
            modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite }) }
          Button(onClick = if (unconfirmed) onRetry else if (custom) onUseCustom else onConfirm,
            enabled = !busy && (unconfirmed || (ready && !draft.stale && future && (!custom || draft.picker?.step == "custom"))),
            shape = RoundedCornerShape(16.dp), modifier = Modifier.fillMaxWidth().heightIn(min = 64.dp),
            contentPadding = PaddingValues(16.dp), colors = ButtonDefaults.buttonColors(
              containerColor = Color(roles.primary), contentColor = Color(roles.onPrimary),
              disabledContainerColor = Color(roles.disabledSurface), disabledContentColor = Color(roles.disabledInk))) {
            Text(when {
              busy -> L10n.text(NativeMessages.postpone_submitting())
              unconfirmed -> L10n.text(NativeMessages.m_24873c1de2a9())
              custom -> L10n.text(NativeMessages.postpone_use_time())
              draft.all -> L10n.text(NativeMessages.postpone_all_action(draft.members.size))
              else -> L10n.text(NativeMessages.postpone_action())
            }, style = MaterialTheme.typography.titleMedium)
          }
          if (custom) OutlinedButton(onClick = onBackChoices, enabled = canDismiss,
            modifier = Modifier.fillMaxWidth().heightIn(min = 64.dp), shape = RoundedCornerShape(16.dp),
            colors = ButtonDefaults.outlinedButtonColors(contentColor = Color(roles.primary)), border = BorderStroke(1.dp, Color(roles.primary))) {
            Text(L10n.text(NativeMessages.postpone_back_choices()), style = MaterialTheme.typography.bodyLarge)
          }
        }
      }
      if (footerOverflows) Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) { header(); content(); footer() }
      else Column(Modifier.fillMaxSize()) {
        header()
        Column(Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState())) { content() }
        footer()
      }
    }
  }
}

@Composable
private fun PostponeTile(label: String, supporting: String?, selected: Boolean, enabled: Boolean, custom: Boolean,
  roles: AtmosphereTokens.Roles, modifier: Modifier, onClick: () -> Unit) {
  val shape = RoundedCornerShape(16.dp)
  val ink = Color(if (!enabled) roles.disabledInk else if (selected) roles.primary else roles.onSurface)
  val interaction = if (custom) Modifier.clickable(enabled = enabled, role = Role.Button, onClick = onClick)
    else Modifier.selectable(selected = selected, enabled = enabled, role = Role.RadioButton, onClick = onClick)
  Box(modifier.heightIn(min = AtmosphereTokens.postponeTile.dp).clip(shape)
    .background(Color(if (selected) roles.container else roles.canvas))
    .border(BorderStroke(if (selected) 2.dp else 1.dp, Color(if (selected) roles.primary else roles.outline)), shape)
    .then(interaction).semantics(mergeDescendants = true) {
      if (custom && selected) stateDescription = L10n.text(NativeMessages.postpone_selected())
    }.padding(12.dp)) {
    Column(Modifier.fillMaxWidth().padding(end = 24.dp).align(Alignment.CenterStart), verticalArrangement = Arrangement.spacedBy(4.dp)) {
      Text(label, color = ink, style = MaterialTheme.typography.bodyLarge, fontWeight = if (selected) FontWeight.Medium else FontWeight.Normal)
      supporting?.let { Text(it, color = Color(if (enabled) roles.onSurfaceVariant else roles.disabledInk), style = MaterialTheme.typography.bodyMedium) }
    }
    if (selected) Canvas(Modifier.align(Alignment.TopEnd).size(20.dp)) {
      val stroke = 2.dp.toPx()
      drawLine(ink, Offset(size.width * .15f, size.height * .5f), Offset(size.width * .42f, size.height * .75f), stroke, StrokeCap.Round)
      drawLine(ink, Offset(size.width * .42f, size.height * .75f), Offset(size.width * .85f, size.height * .25f), stroke, StrokeCap.Round)
    }
    if (custom) Canvas(Modifier.align(Alignment.CenterEnd).size(20.dp)) {
      val stroke = 1.8.dp.toPx()
      drawLine(ink, Offset(size.width * .35f, size.height * .25f), Offset(size.width * .65f, size.height * .5f), stroke, StrokeCap.Round)
      drawLine(ink, Offset(size.width * .65f, size.height * .5f), Offset(size.width * .35f, size.height * .75f), stroke, StrokeCap.Round)
    }
  }
}

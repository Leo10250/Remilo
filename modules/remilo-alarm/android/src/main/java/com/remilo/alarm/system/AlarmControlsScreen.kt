package com.remilo.alarm.system

import com.remilo.alarm.presentation.NativeMessages

import com.remilo.alarm.presentation.L10n


import android.graphics.BitmapFactory
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.sp
import com.remilo.alarm.R
import com.remilo.alarm.data.AlertRecord
import com.remilo.alarm.engine.AlarmEngine
import com.remilo.alarm.presentation.AtmosphereTokens
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.text.DateFormat
import java.util.Date
import java.util.TimeZone
import kotlin.math.roundToInt

internal enum class AlarmControlAction(val commandKind: String) {
  CompleteDelivery("CompleteDelivery"), Snooze("Snooze"), DoneAll("DoneAll"), SnoozeAll("SnoozeAll")
}

/** Rendering only. Native observation, guarded actions and confirmed dismissal stay in the activity. */
@Composable
internal fun AlarmControlsScreen(
  current: AlarmEngine.SessionSnapshot?, busy: Boolean, error: String?,
  onAction: (AlarmControlAction, AlertRecord?) -> Unit, onRetry: () -> Unit,
  roles: AtmosphereTokens.Roles, progress: String? = null, refreshError: String? = null, unconfirmed: Boolean = false
) {
  val density = LocalDensity.current
  var footerHeight by remember { mutableIntStateOf(0) }
  val members = current?.members.orEmpty()
  val single = members.size == 1
  Surface(color = Color(roles.canvas), modifier = Modifier.fillMaxSize()) {
    BoxWithConstraints(Modifier.fillMaxSize().safeDrawingPadding()) {
      // Measured footer is a sibling of the form viewport. At extreme heights it
      // joins one accessible scroller instead of clipping targets or overlapping cards.
      val footerOverflows = with(density) { footerHeight.toDp() } > maxHeight - (AtmosphereTokens.nativeSingle + AtmosphereTokens.spaceSm).dp
      val art = when {
        footerOverflows || density.fontScale >= 1.8f || maxHeight < 440.dp -> 0.dp
        single && density.fontScale < 1.3f && maxHeight >= 640.dp -> AtmosphereTokens.home.dp
        single -> AtmosphereTokens.secondary.dp
        density.fontScale < 1.3f -> AtmosphereTokens.secondary.dp
        else -> 0.dp
      }
      val body: @Composable () -> Unit = {
        AlarmBody(current, busy || unconfirmed, roles, art, onAction, refreshError, onRetry)
      }
      val footer: @Composable () -> Unit = {
        AlarmFooter(current, busy, error, progress, roles, onAction, onRetry,
          Modifier.onSizeChanged { footerHeight = it.height }, unconfirmed)
      }
      if (footerOverflows) {
        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) { body(); footer() }
      } else {
        Column(Modifier.fillMaxSize()) {
          Column(Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState())) { body() }
          footer()
        }
      }
    }
  }
}

@Composable
private fun AlarmBody(current: AlarmEngine.SessionSnapshot?, busy: Boolean, roles: AtmosphereTokens.Roles,
  artHeight: androidx.compose.ui.unit.Dp, onAction: (AlarmControlAction, AlertRecord?) -> Unit, refreshError: String?, onRetry: () -> Unit) {
  val timeFormat = rememberDeviceTimeFormat()
  val members = current?.members.orEmpty()
  Column(Modifier.fillMaxWidth()) {
    val stateHeading = if (members.size > 1) if (current?.state == "Active") L10n.text("${members.size} alarms ringing") else L10n.text("Starting ${members.size} alarms…") else null
    AlarmHeader(stateHeading, roles, artHeight)
    Column(Modifier.fillMaxWidth().padding(AtmosphereTokens.spaceGutter.dp), verticalArrangement = Arrangement.spacedBy(AtmosphereTokens.spaceMd.dp)) {
    refreshError?.let { RefreshBanner(it, busy, roles, onRetry) }
    if (current == null) {
      CircularProgressIndicator(); Text(L10n.text(NativeMessages.m_ef3765955e59()))
    } else if (members.isEmpty()) Text(L10n.text(NativeMessages.m_79527b2274c6()))
    else members.forEach { (record, title) -> key(record.occurrenceId) {
      Surface(shape = RoundedCornerShape(AtmosphereTokens.shapeGroup.dp), color = Color(roles.surface)) {
        Column(Modifier.fillMaxWidth().padding(AtmosphereTokens.spaceGutter.dp), verticalArrangement = Arrangement.spacedBy(AtmosphereTokens.spaceSm.dp)) {
          val state = if (current.state == "Active") L10n.text(NativeMessages.m_1ce1890d9f80()) else L10n.text(NativeMessages.m_aa3e565dfaa9())
          if (members.size == 1) Text(state, style = MaterialTheme.typography.bodyMedium, color = Color(roles.onSurfaceVariant))
          Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(AtmosphereTokens.spaceMd.dp)) {
            ReminderGlyph(Color(roles.onSurfaceVariant))
            Text(title, style = if (members.size == 1) MaterialTheme.typography.headlineLarge else if (PresentationLanguage.language == "zh-Hans") MaterialTheme.typography.headlineMedium else MaterialTheme.typography.titleLarge,
              fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f).semantics { heading() })
          }
          val time = timeFormat.format(Date(record.targetMs))
          if (members.size == 1) {
            Text(L10n.text(NativeMessages.m_eaf9eb2fb8f9()), style = MaterialTheme.typography.bodyMedium, color = Color(roles.onSurfaceVariant))
            Text(time, fontSize = AtmosphereTokens.typeDisplay.sp,
              lineHeight = (if (PresentationLanguage.language == "zh-Hans") AtmosphereTokens.chineseDisplayLineHeight else AtmosphereTokens.typeDisplay + AtmosphereTokens.spaceSm).sp, fontWeight = FontWeight.SemiBold)
          } else {
            Text(state, style = MaterialTheme.typography.bodyMedium, color = Color(roles.onSurfaceVariant))
            TimingRow(L10n.text(NativeMessages.m_eaf9eb2fb8f9()), time, roles)
          }
          current.content[record.occurrenceId]?.let { TimingContext(it, roles) }
          if (members.size > 1) AlarmActions(record, title, current.state, busy, roles, AtmosphereTokens.nativeMember, onAction)
        }
      }
    } }
    }
  }
}

@Composable
private fun AlarmHeader(stateHeading: String?, roles: AtmosphereTokens.Roles, artHeight: androidx.compose.ui.unit.Dp) {
  val hasArt = artHeight > 0.dp
  var textHeight by remember { mutableIntStateOf(0) }
  Box(Modifier.fillMaxWidth().heightIn(min = artHeight)) {
    if (hasArt) {
      SceneArtwork(roles, artHeight <= AtmosphereTokens.secondary.dp, Modifier.matchParentSize())
      if (roles.headerScrimAlpha > 0f) Canvas(Modifier.matchParentSize()) {
        // Protect the actual label area, then fade back to unobscured scenery.
        // Alpha/ink are measured against the approved hero/compact derivatives.
        val baseline = (if (stateHeading == null) AtmosphereTokens.toolbar else AtmosphereTokens.toolbar + AtmosphereTokens.spaceGutter).dp.toPx()
        val plateau = (if (textHeight > 0) textHeight.toFloat() else baseline).coerceAtMost(size.height)
        val scrim = Color(roles.headerScrim).copy(alpha = roles.headerScrimAlpha.toFloat())
        drawRect(scrim, size = Size(size.width, plateau))
        if (plateau < size.height) drawRect(
          Brush.verticalGradient(listOf(scrim, Color.Transparent), startY = plateau,
            endY = (plateau + AtmosphereTokens.spaceLg.dp.toPx()).coerceAtMost(size.height)),
          topLeft = Offset(0f, plateau), size = Size(size.width, size.height - plateau))
      }
    }
    Column(Modifier.align(Alignment.TopStart).fillMaxWidth(if (hasArt) 0.65f else 1f)
      .onSizeChanged { textHeight = it.height }
      .padding(horizontal = AtmosphereTokens.spaceGutter.dp, vertical = AtmosphereTokens.spaceSm.dp)) {
      val ink = Color(if (hasArt) roles.headerInk else roles.onSurface)
      Text("Remilo", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold,
        color = ink, modifier = Modifier.semantics { heading() })
      stateHeading?.let { Text(it, style = MaterialTheme.typography.bodyLarge, color = ink,
        modifier = Modifier.semantics { heading() }) }
    }
  }
}

@Composable
private fun RefreshBanner(message: String, busy: Boolean, roles: AtmosphereTokens.Roles, onRetry: () -> Unit) {
  Surface(shape = RoundedCornerShape(AtmosphereTokens.shapeGroup.dp), color = Color(roles.surface),
    border = androidx.compose.foundation.BorderStroke(1.dp, Color(roles.error))) {
    Column(Modifier.fillMaxWidth().padding(AtmosphereTokens.spaceGutter.dp), verticalArrangement = Arrangement.spacedBy(AtmosphereTokens.spaceMd.dp)) {
      Text(L10n.text(message), color = Color(roles.error), modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite })
      OutlinedButton(onClick = onRetry, enabled = !busy, shape = RoundedCornerShape(AtmosphereTokens.shapeAction.dp),
        modifier = Modifier.fillMaxWidth().heightIn(min = AtmosphereTokens.target.dp)) { Text(L10n.text(NativeMessages.m_24873c1de2a9())) }
    }
  }
}

@Composable
private fun AlarmFooter(current: AlarmEngine.SessionSnapshot?, busy: Boolean, error: String?, progress: String?,
  roles: AtmosphereTokens.Roles, onAction: (AlarmControlAction, AlertRecord?) -> Unit, onRetry: () -> Unit, modifier: Modifier, unconfirmed: Boolean) {
  Surface(color = Color(roles.surface), modifier = modifier.fillMaxWidth()) {
    Column(Modifier.padding(AtmosphereTokens.spaceGutter.dp), verticalArrangement = Arrangement.spacedBy(AtmosphereTokens.spaceMd.dp)) {
      val members = current?.members.orEmpty()
      if (members.size == 1) {
        val (record, title) = members.single()
        AlarmActions(record, title, current!!.state, busy || unconfirmed, roles, AtmosphereTokens.nativeSingle, onAction)
      } else if (members.size > 1) {
        FilledAlarmButton(L10n.text("Mark all as done (${members.size})"), L10n.text("Mark all ${members.size} shown reminders as done"), busy || unconfirmed, roles,
          AtmosphereTokens.nativeSingle, checkmark = true) { onAction(AlarmControlAction.DoneAll, null) }
        SnoozeGroupButton(members.first().first.snoozeMinutes, members.size, busy || unconfirmed, roles) { onAction(AlarmControlAction.SnoozeAll, null) }
      }
      // Reserve one scalable status line so starting an action cannot move its
      // targets. The full member remains readable in the retained information card.
      Text(progress?.let(L10n::text) ?: " ", color = Color(roles.onSurfaceVariant), maxLines = 1,
        overflow = TextOverflow.Ellipsis, modifier = Modifier.fillMaxWidth().semantics {
          if (progress != null) { contentDescription = L10n.text(progress); liveRegion = LiveRegionMode.Polite }
        })
      error?.let {
        Text(L10n.text(it), color = Color(roles.error))
        OutlinedButton(onClick = onRetry, enabled = !busy, shape = RoundedCornerShape(AtmosphereTokens.shapeAction.dp),
          modifier = Modifier.fillMaxWidth().heightIn(min = AtmosphereTokens.target.dp)) { Text(if (unconfirmed) L10n.text(NativeMessages.m_94d292cade49()) else L10n.text(NativeMessages.m_24873c1de2a9())) }
      }
    }
  }
}

@Composable
private fun AlarmActions(record: AlertRecord, title: String, state: String, busy: Boolean, roles: AtmosphereTokens.Roles,
  minimum: Int, onAction: (AlarmControlAction, AlertRecord?) -> Unit) {
  val stateLabel = if (state == "Active") L10n.text(NativeMessages.m_b22fd07a194a()) else L10n.text(NativeMessages.m_1827590dc0e9())
  val density = LocalDensity.current
  BoxWithConstraints(Modifier.fillMaxWidth()) {
    // The approved member row is compact at ordinary text size. Stack when text
    // or usable width needs more room, retaining both measured action minimums.
    val inline = minimum == AtmosphereTokens.nativeMember && maxWidth >= 280.dp && density.fontScale <= 1.15f
    if (inline) Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(AtmosphereTokens.spaceMd.dp)) {
      FilledAlarmButton(L10n.text(NativeMessages.m_62aa4b87cc52()), L10n.text("Mark as done, $title, $stateLabel"), busy, roles, minimum, Modifier.weight(1f).fillMaxHeight(), compact = true, checkmark = true) { onAction(AlarmControlAction.CompleteDelivery, record) }
      SnoozeAlarmButton(record, title, stateLabel, busy, roles, minimum, Modifier.weight(1f).fillMaxHeight(), compact = true, onAction = onAction)
    } else Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(AtmosphereTokens.spaceMd.dp)) {
      FilledAlarmButton(L10n.text(NativeMessages.m_62aa4b87cc52()), L10n.text("Mark as done, $title, $stateLabel"), busy, roles, minimum, checkmark = true) { onAction(AlarmControlAction.CompleteDelivery, record) }
      SnoozeAlarmButton(record, title, stateLabel, busy, roles, minimum, onAction = onAction)
    }
  }
}

@Composable
private fun SnoozeAlarmButton(record: AlertRecord, title: String, stateLabel: String, busy: Boolean, roles: AtmosphereTokens.Roles,
  minimum: Int, modifier: Modifier = Modifier, compact: Boolean = false, onAction: (AlarmControlAction, AlertRecord?) -> Unit) {
  OutlinedButton(onClick = { onAction(AlarmControlAction.Snooze, record) }, enabled = !busy, shape = RoundedCornerShape(AtmosphereTokens.shapeAction.dp),
    colors = ButtonDefaults.outlinedButtonColors(contentColor = Color(roles.primary), disabledContentColor = Color(roles.disabledInk)),
    border = androidx.compose.foundation.BorderStroke(1.dp, Color(if (busy) roles.disabledInk else roles.primary)),
    contentPadding = PaddingValues(horizontal = (if (compact) AtmosphereTokens.spaceSm else AtmosphereTokens.spaceGutter).dp,
      vertical = AtmosphereTokens.spaceSm.dp), modifier = modifier.fillMaxWidth().heightIn(min = minimum.dp)
      .semantics { contentDescription = L10n.text("Snooze ${record.snoozeMinutes} minutes, $title, $stateLabel") }) {
    Text(L10n.text("Snooze · ${record.snoozeMinutes} min"), fontSize = AtmosphereTokens.typeBody.sp, lineHeight = AtmosphereTokens.spaceLg.sp)
  }
}

@Composable
private fun SnoozeGroupButton(minutes: Int, count: Int, busy: Boolean, roles: AtmosphereTokens.Roles, onClick: () -> Unit) {
  OutlinedButton(onClick = onClick, enabled = !busy, shape = RoundedCornerShape(AtmosphereTokens.shapeAction.dp),
    colors = ButtonDefaults.outlinedButtonColors(contentColor = Color(roles.primary), disabledContentColor = Color(roles.disabledInk)),
    border = androidx.compose.foundation.BorderStroke(1.dp, Color(if (busy) roles.disabledInk else roles.primary)),
    contentPadding = PaddingValues(horizontal = AtmosphereTokens.spaceGutter.dp, vertical = AtmosphereTokens.spaceSm.dp),
    modifier = Modifier.fillMaxWidth().heightIn(min = AtmosphereTokens.nativeSingle.dp)
      .semantics { contentDescription = L10n.text("Snooze all $count shown reminders for $minutes minutes") }) {
    Text(L10n.text("Snooze all · $minutes min"), fontSize = AtmosphereTokens.typeBody.sp, lineHeight = AtmosphereTokens.spaceLg.sp)
  }
}

@Composable
private fun FilledAlarmButton(label: String, description: String, busy: Boolean, roles: AtmosphereTokens.Roles,
  minimum: Int, modifier: Modifier = Modifier, compact: Boolean = false, checkmark: Boolean = false, onClick: () -> Unit) {
  Button(onClick = onClick, enabled = !busy, shape = RoundedCornerShape(AtmosphereTokens.shapeAction.dp),
    contentPadding = PaddingValues(horizontal = (if (compact) AtmosphereTokens.spaceSm else AtmosphereTokens.spaceGutter).dp,
      vertical = AtmosphereTokens.spaceSm.dp),
    colors = ButtonDefaults.buttonColors(containerColor = Color(roles.primary), contentColor = Color(roles.onPrimary),
      disabledContainerColor = Color(roles.disabledSurface), disabledContentColor = Color(roles.disabledInk)),
    modifier = modifier.fillMaxWidth().heightIn(min = minimum.dp).semantics { contentDescription = description }) {
    if (checkmark) {
      Canvas(Modifier.size(24.dp)) {
        val ink = Color(if (busy) roles.disabledInk else roles.onPrimary)
        drawLine(ink, Offset(size.width * .2f, size.height * .5f), Offset(size.width * .42f, size.height * .72f), 2.dp.toPx(), StrokeCap.Round)
        drawLine(ink, Offset(size.width * .42f, size.height * .72f), Offset(size.width * .8f, size.height * .28f), 2.dp.toPx(), StrokeCap.Round)
      }
      Spacer(Modifier.width(AtmosphereTokens.spaceSm.dp))
    }
    Text(label, fontSize = (if (PresentationLanguage.language == "zh-Hans") AtmosphereTokens.typeBody else AtmosphereTokens.typeHeading).sp,
      lineHeight = (if (PresentationLanguage.language == "zh-Hans") AtmosphereTokens.chineseBodyLineHeight else AtmosphereTokens.typeHeading + AtmosphereTokens.spaceSm).sp)
  }
}

@Composable
private fun TimingContext(content: AlarmEngine.SessionMemberContent, roles: AtmosphereTokens.Roles) {
  val zone = TimeZone.getTimeZone(content.zoneId.ifEmpty { TimeZone.getDefault().id })
  val time = rememberDeviceTimeFormat(zone)
  val date = DateFormat.getDateInstance(DateFormat.MEDIUM, java.util.Locale.forLanguageTag(PresentationLanguage.localeTag)).apply { timeZone = zone }
  val shortDate = DateFormat.getDateInstance(DateFormat.SHORT, java.util.Locale.forLanguageTag(PresentationLanguage.localeTag)).apply { timeZone = zone }
  val dateTime: (Date) -> String = { shortDate.format(it) + " · " + time.format(it) }
  val startDate = date.format(Date(content.eventStartMs))
  val lastDate = date.format(Date(content.eventEndMs - 1)) // All-day end is exclusive.
  val event = if (content.allDay) L10n.text("All day · $startDate") + if (startDate == lastDate) "" else " – $lastDate"
    else "${dateTime(Date(content.eventStartMs))} – ${dateTime(Date(content.eventEndMs))}"
  TimingRow("Event", event, roles)
  if (!content.dueLinked || content.dueAtMs != (if (content.allDay) content.eventEndMs else content.eventStartMs))
    TimingRow("Due", dateTime(Date(content.dueAtMs)), roles)
}

@Composable
private fun TimingRow(label: String, value: String, roles: AtmosphereTokens.Roles) {
  Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(AtmosphereTokens.spaceSm.dp), verticalAlignment = Alignment.Top) {
    Text(L10n.text(label), style = MaterialTheme.typography.bodyMedium, color = Color(roles.onSurfaceVariant), modifier = Modifier.width(80.dp))
    Text(value, style = MaterialTheme.typography.bodyLarge, color = Color(roles.onSurface), modifier = Modifier.weight(1f))
  }
}

@Composable
private fun ReminderGlyph(color: Color) {
  Canvas(Modifier.size(28.dp)) {
    val stroke = 1.8.dp.toPx()
    drawCircle(color, radius = size.minDimension * 0.37f, style = Stroke(stroke))
    drawLine(color, center, Offset(center.x, size.height * 0.28f), stroke)
    drawLine(color, center, Offset(size.width * 0.68f, center.y), stroke)
  }
}

private fun sceneResource(name: String): Int? = when (name) {
  "remilo_scene_sunrise_light_v1" -> R.drawable.remilo_scene_sunrise_light_v1
  "remilo_scene_sunrise_dark_v1" -> R.drawable.remilo_scene_sunrise_dark_v1
  "remilo_scene_sky_light_v1" -> R.drawable.remilo_scene_sky_light_v1
  "remilo_scene_sky_dark_v1" -> R.drawable.remilo_scene_sky_dark_v1
  "remilo_scene_evening_light_v1" -> R.drawable.remilo_scene_evening_light_v1
  "remilo_scene_evening_dark_v1" -> R.drawable.remilo_scene_evening_dark_v1
  "remilo_scene_night_light_v2" -> R.drawable.remilo_scene_night_light_v2
  "remilo_scene_night_dark_v2" -> R.drawable.remilo_scene_night_dark_v2
  else -> null
}

@Composable
private fun SceneArtwork(roles: AtmosphereTokens.Roles, compact: Boolean, modifier: Modifier) {
  val resources = LocalContext.current.resources
  val resource = sceneResource(roles.drawableName)
  val bitmap by produceState<ImageBitmap?>(null, resource) {
    value = withContext(Dispatchers.IO) {
      try { resource?.let { BitmapFactory.decodeResource(resources, it)?.asImageBitmap() } }
      catch (_: Exception) { null } catch (_: OutOfMemoryError) { null }
    }
  }
  val focalX = if (compact) roles.compactX else roles.heroX
  val focalY = if (compact) roles.compactY else roles.heroY
  val cropAlignment = remember(focalX, focalY) { object : Alignment {
    override fun align(size: IntSize, space: IntSize, layoutDirection: LayoutDirection): IntOffset {
      // Focal values identify source pixels, rather than fractional alignment of
      // the crop overflow. This matches the app and the approved crop previews.
      val x = (space.width / 2f - size.width * focalX).roundToInt().coerceIn(minOf(0, space.width - size.width), 0)
      val y = (space.height / 2f - size.height * focalY).roundToInt().coerceIn(minOf(0, space.height - size.height), 0)
      return IntOffset(x, y)
    }
  } }
  Box(modifier) {
    bitmap?.let { Image(bitmap = it, contentDescription = null, modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Crop,
      alignment = cropAlignment) }
  }
}

/** Observer follows this rendering owner, including Direct Boot without private reads. */
@Composable
private fun rememberDeviceTimeFormat(zone: TimeZone = TimeZone.getDefault()): java.text.DateFormat {
  val context = LocalContext.current
  var observation by remember { mutableIntStateOf(0) }
  DisposableEffect(context) {
    val subscription = runCatching { TimeDisplayPreferences.observe(context) {
      AlarmEngine.get(context).presentationChanged {
        android.os.Handler(android.os.Looper.getMainLooper()).post { observation++ }
      }
    } }.getOrNull()
    onDispose { subscription?.close() }
  }
  return remember(context, observation, zone.id, PresentationLanguage.localeTag, TimeDisplayPreferences.read(context)["uses24HourClock"]) { java.text.SimpleDateFormat(android.text.format.DateFormat.getBestDateTimePattern(java.util.Locale.forLanguageTag(PresentationLanguage.localeTag), if (TimeDisplayPreferences.read(context)["uses24HourClock"] == true) "Hm" else "hm"), java.util.Locale.forLanguageTag(PresentationLanguage.localeTag)).apply { timeZone = zone } }
}

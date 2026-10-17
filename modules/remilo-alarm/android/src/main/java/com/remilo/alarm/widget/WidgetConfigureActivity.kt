package com.remilo.alarm.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.lifecycleScope
import androidx.compose.ui.viewinterop.AndroidView
import androidx.glance.appwidget.compose
import androidx.compose.ui.unit.DpSize
import com.remilo.alarm.presentation.AtmosphereTokens
import com.remilo.alarm.presentation.L10n
import kotlinx.coroutines.launch

class WidgetConfigureActivity : ComponentActivity() {
  private var number = AppWidgetManager.INVALID_APPWIDGET_ID
  private var restored = false
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    restored = savedInstanceState != null
    setResult(RESULT_CANCELED)
    number = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID)
    if (!WidgetWork.unlocked(this) || number != AppWidgetManager.INVALID_APPWIDGET_ID && !WidgetWork.supported(this, number)) { finish(); return }
    setContent { Setup() }
    if (android.os.Build.VERSION.SDK_INT >= 35) lifecycleScope.launch {
      runCatching {
        val provider = AppWidgetManager.getInstance(this@WidgetConfigureActivity).installedProviders.firstOrNull {
          it.provider == ComponentName(this@WidgetConfigureActivity, RemiloWidgetReceiver::class.java) }
        if (provider != null && provider.generatedPreviewCategories and android.appwidget.AppWidgetProviderInfo.WIDGET_CATEGORY_HOME_SCREEN == 0)
          androidx.glance.appwidget.GlanceAppWidgetManager(this@WidgetConfigureActivity).setWidgetPreviews(
            RemiloWidgetReceiver::class, androidx.collection.intSetOf(android.appwidget.AppWidgetProviderInfo.WIDGET_CATEGORY_HOME_SCREEN))
      }
    }
  }
  @Composable private fun Setup() {
    var loaded by remember { mutableStateOf(false) }
    var mode by rememberSaveable { mutableStateOf(if (intent.hasExtra("routineId")) "Routine" else "Today") }
    var routineId by rememberSaveable { mutableStateOf(intent.getStringExtra("routineId")) }
    var revision by rememberSaveable { mutableLongStateOf(0L) }
    var plans by remember { mutableStateOf<List<Map<String, Any?>>>(emptyList()) }
    var preview by remember { mutableStateOf<WidgetSnapshot?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    var renderedPreview by remember { mutableStateOf<android.widget.RemoteViews?>(null) }
    var previewFailed by remember { mutableStateOf(false) }
    var previewAttempt by remember { mutableIntStateOf(0) }
    var examplePreview by remember { mutableStateOf(false) }
    var expandedPreview by rememberSaveable { mutableStateOf(false) }
    var previewWidth by remember { mutableStateOf(300.dp) }
    val previewDensity = LocalDensity.current
    var appearance by remember { mutableStateOf<com.remilo.alarm.core.AppearancePolicy.Resolved?>(null) }
    androidx.activity.compose.BackHandler(enabled = busy) { /* Save retains its captured configuration until acknowledged. */ }
    fun text(value: String) = L10n.text(this, value)
    fun chooseMode(value: String) {
      if(busy) return
      routineId = WidgetSetup.routineSelection(value,routineId,plans)
      mode = value
    }
    suspend fun refresh() {
      plans = widgetRequest(this) { it.widgetPlans() }
      routineId = WidgetSetup.routineSelection(mode, routineId, plans)
      val selectedMode = mode; val selectedRoutine = routineId
      // A no-routine Focus draft still has a truthful base for its example/appearance.
      val available = selectedRoutine == null || plans.any { it["id"] == selectedRoutine }
      val base = widgetRequest(this) { it.widgetPreview(if(selectedRoutine == null || !available) "Today" else selectedMode, selectedRoutine.takeIf { available }) }
        .let { if(available) it else it.copy(configuration = WidgetConfiguration(selectedMode,selectedRoutine),session = null) }
      if (mode != selectedMode || routineId != selectedRoutine) return
      examplePreview = WidgetSetup.needsExample(base, selectedMode, selectedRoutine)
      preview = if(examplePreview) WidgetSetup.example(this, selectedMode, base) else base
      error = null
    }
    LaunchedEffect(Unit) {
      try {
        appearance = widgetRequest(this@WidgetConfigureActivity) { it.widgetPreview("Today",null).appearance }
        if (number != AppWidgetManager.INVALID_APPWIDGET_ID && !restored) {
          val config = widgetRequest(this@WidgetConfigureActivity) { it.widgetConfiguration(number) }
          if (config.revision > 0) { mode = config.mode; routineId = config.routineId; revision = config.revision }
        }
        refresh(); loaded = true
      } catch (_: Exception) { loaded = plans.isNotEmpty(); error = "Could not load the widget. Refresh to try again." }
    }
    LaunchedEffect(mode, routineId, loaded) { if (loaded) try { refresh() }
      catch (cancelled: kotlinx.coroutines.CancellationException) { throw cancelled }
      catch (_: Exception) { error = "This view changed. Review the refreshed routine." } }
    val previewHeight = if(expandedPreview)440 else WidgetSizing.compactHeight(preview)
    LaunchedEffect(preview,previewHeight,previewWidth,previewAttempt) {
      val snapshot = preview ?: return@LaunchedEffect
      previewFailed = false
      try { renderedPreview = WidgetRender(snapshot).compose(this@WidgetConfigureActivity, size = DpSize(previewWidth,previewHeight.dp)) }
      catch (cancelled: kotlinx.coroutines.CancellationException) { throw cancelled }
      catch (_: Exception) { renderedPreview = null; previewFailed = true }
    }
    val roles = (preview?.appearance ?: appearance)?.let { AtmosphereTokens.colors(it.atmosphere, it.brightness) }
      ?: AtmosphereTokens.colors("sky", if ((resources.configuration.uiMode and 48) == 32) "dark" else "light")
    val dark = (preview?.appearance ?: appearance)?.brightness == "dark" || appearance == null && (resources.configuration.uiMode and 48) == 32
    val colors = if (dark) darkColorScheme(primary = Color(roles.primary), onPrimary = Color(roles.onPrimary), surface = Color(roles.surface),
      onSurface = Color(roles.onSurface), background = Color(roles.canvas), onBackground = Color(roles.onSurface),
      onSurfaceVariant = Color(roles.onSurfaceVariant), surfaceVariant = Color(roles.container), outline = Color(roles.outline), error = Color(roles.error))
    else lightColorScheme(primary = Color(roles.primary), onPrimary = Color(roles.onPrimary), surface = Color(roles.surface),
      onSurface = Color(roles.onSurface), background = Color(roles.canvas), onBackground = Color(roles.onSurface),
      onSurfaceVariant = Color(roles.onSurfaceVariant), surfaceVariant = Color(roles.container), outline = Color(roles.outline), error = Color(roles.error))
    val chinese = com.remilo.alarm.system.PresentationLanguage.language == "zh-Hans"
    val type = Typography(bodyLarge = androidx.compose.ui.text.TextStyle(fontSize = 16.sp, lineHeight = (if (chinese) AtmosphereTokens.chineseBodyLineHeight else 24).sp),
      bodyMedium = androidx.compose.ui.text.TextStyle(fontSize = 14.sp, lineHeight = (if (chinese) AtmosphereTokens.chineseSupportingLineHeight else 20).sp),
      labelLarge = androidx.compose.ui.text.TextStyle(fontSize = 16.sp, lineHeight = 22.sp))
    SideEffect { androidx.core.view.WindowCompat.getInsetsController(window,window.decorView).apply {
      isAppearanceLightStatusBars = !dark; isAppearanceLightNavigationBars = !dark } }
    MaterialTheme(colorScheme = colors, typography = type) {
      Scaffold(containerColor = Color(roles.canvas), bottomBar = {
        Column(Modifier.fillMaxWidth().background(Color(roles.canvas)).navigationBarsPadding().imePadding().padding(16.dp)) {
          if (error != null) Text(text(error!!), color = colors.error, fontSize = 14.sp)
          Button(enabled = loaded && !busy && (mode == "Today" || routineId != null) && (routineId == null || plans.any { it["id"] == routineId }),
            modifier = Modifier.fillMaxWidth().heightIn(min = 56.dp), shape = androidx.compose.foundation.shape.RoundedCornerShape(16.dp), onClick = {
              busy = true; error = null
              lifecycleScope.launch {
                try {
                  if (number != AppWidgetManager.INVALID_APPWIDGET_ID) {
                    widgetRequest(this@WidgetConfigureActivity) { it.configureWidget(number, mode, routineId, revision) }
                    WidgetWork.request(this@WidgetConfigureActivity)
                    setResult(RESULT_OK, Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, number)); finish()
                  } else {
                    val manager = AppWidgetManager.getInstance(this@WidgetConfigureActivity)
                    if (!manager.isRequestPinAppWidgetSupported) error = "Add Remilo from your home screen's Widgets menu."
                    else {
                      val token = widgetRequest(this@WidgetConfigureActivity) { it.captureWidgetPin(mode, routineId) }
                      val callback = PendingIntent.getBroadcast(this@WidgetConfigureActivity, 0,
                        Intent(this@WidgetConfigureActivity, WidgetPinReceiver::class.java).setData(android.net.Uri.parse("remilo-widget-pin://$token")).putExtra("token", token),
                        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE)
                      if (manager.requestPinAppWidget(ComponentName(this@WidgetConfigureActivity, RemiloWidgetReceiver::class.java), null, callback)) finish()
                      else error = "Add Remilo from your home screen's Widgets menu."
                    }
                  }
                } catch (_: Exception) { error = "This view changed. Close setup and try again." }
                finally { busy = false }
              }
            }) { Text(text(if (number == AppWidgetManager.INVALID_APPWIDGET_ID) "Add to Home screen" else "Save"), fontSize = 16.sp) }
          TextButton(enabled = !busy, onClick = { finish() }, modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp)) { Text(text("Cancel")) }
        }
      }) { insets ->
        Column(Modifier.padding(insets).fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
          Text(text("Home-screen widget"), fontSize = 24.sp)
          if (error != null && !busy) TextButton(onClick = { lifecycleScope.launch {
            try { refresh(); loaded = true; error = null } catch (_: Exception) { error = "This view changed. Close setup and try again." }
          } }, modifier = Modifier.heightIn(min = 48.dp)) { Text(text("Refresh")) }
          Text(text("Choose what to show"), fontSize = 16.sp)
          Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
          listOf("Today" to "Today's and overdue reminders, with an optional routine.", "Routine" to "One routine's exercise and daily progress.").forEachIndexed { index, (value, description) ->
            Surface(shape = connectedShape(index,2), color = Color(roles.surface), onClick = { chooseMode(value) }) {
              Row(Modifier.fillMaxWidth().padding(12.dp)) {
                RadioButton(selected = mode == value, onClick = { chooseMode(value) }, enabled = !busy)
                Column(Modifier.weight(1f).padding(start = 8.dp)) { Text(text(if (value == "Routine") "Routine Focus" else "Today"), fontSize = 16.sp); Text(text(description), fontSize = 14.sp, color = Color(roles.onSurfaceVariant)) }
              }
            }
          }
          }
          Text(text("Routine"), fontSize = 16.sp)
          if (loaded && plans.isEmpty()) Text(text("Create a routine in Remilo to show its progress."))
          val sources = (if (mode == "Today") listOf(null to text("No routine")) else emptyList()) + plans.map { (it["id"] as String?) to (it["title"] as String) }
          Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
          sources.forEachIndexed { index, (sourceId, name) -> Surface(onClick = { if (!busy) routineId = sourceId }, shape = connectedShape(index,sources.size)) {
            Row(Modifier.fillMaxWidth().padding(12.dp)) {
              RadioButton(selected = routineId == sourceId, onClick = { if (!busy) routineId = sourceId }, enabled = !busy)
              Text(name, Modifier.weight(1f).padding(12.dp), fontSize = 16.sp)
            }
          } }
          }
          Text(text("Preview"), fontSize = 16.sp)
          Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            FilterChip(selected = !expandedPreview,onClick = { expandedPreview = false },enabled = !busy,label = { Text(text("Compact")) },shape = androidx.compose.foundation.shape.RoundedCornerShape(16.dp),modifier = Modifier.heightIn(min = 48.dp))
            FilterChip(selected = expandedPreview,onClick = { expandedPreview = true },enabled = !busy,label = { Text(text("Expanded")) },shape = androidx.compose.foundation.shape.RoundedCornerShape(16.dp),modifier = Modifier.heightIn(min = 48.dp))
          }
          if(examplePreview) Text(text("Example preview · Sample content only"),fontSize = 14.sp,color = Color(roles.onSurfaceVariant))
          Box(Modifier.fillMaxWidth().height(previewHeight.dp).onSizeChanged { previewWidth = with(previewDensity) { it.width.toDp() } }
            .semantics { contentDescription = text("Preview") + ": " + (preview?.session?.get("title") as? String ?: text("Today's reminders")) }) {
          renderedPreview?.let { remote -> AndroidView(modifier = Modifier.fillMaxSize(),
            factory = { android.widget.FrameLayout(it).apply { isEnabled = false; importantForAccessibility = android.view.View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS } },
            update = { host -> host.removeAllViews(); host.addView(remote.apply(host.context, host),android.widget.FrameLayout.LayoutParams(android.view.ViewGroup.LayoutParams.MATCH_PARENT,android.view.ViewGroup.LayoutParams.MATCH_PARENT));
              fun inert(view: android.view.View) { view.isEnabled = false; view.isClickable = false; if (view is android.view.ViewGroup) for (i in 0 until view.childCount) inert(view.getChildAt(i)) }; inert(host)
            }) }
          if(renderedPreview == null) Surface(shape = androidx.compose.foundation.shape.RoundedCornerShape(16.dp),color = Color(roles.surface),modifier = Modifier.fillMaxSize()) {
            Column(Modifier.padding(16.dp),verticalArrangement = Arrangement.spacedBy(12.dp)) {
              Text(text(if(previewFailed || error != null) "Could not load the preview." else "Loading preview…"),fontSize = 16.sp)
              if(previewFailed) TextButton(onClick = { previewAttempt++ }) { Text(text("Refresh")) }
            }
          }
          }
          Text(text("The size and text settings determine how much fits. Smaller widgets open Remilo for actions."), fontSize = 14.sp)
        }
      }
    }
  }
  private fun connectedShape(index: Int, count: Int) = androidx.compose.foundation.shape.RoundedCornerShape(
    topStart = if (index == 0) 16.dp else 4.dp, topEnd = if (index == 0) 16.dp else 4.dp,
    bottomStart = if (index == count - 1) 16.dp else 4.dp, bottomEnd = if (index == count - 1) 16.dp else 4.dp)
}

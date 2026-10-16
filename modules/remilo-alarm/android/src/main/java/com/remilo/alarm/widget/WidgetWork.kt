package com.remilo.alarm.widget

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.os.UserManager
import android.widget.RemoteViews
import androidx.work.*
import androidx.glance.appwidget.updateAll
import com.remilo.alarm.R
import com.remilo.alarm.engine.AlarmEngine
import com.remilo.alarm.presentation.L10n
import java.time.Instant
import java.time.ZoneId
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlin.coroutines.suspendCoroutine

internal suspend fun <T> widgetRequest(context: Context, body: (AlarmEngine) -> T): T = suspendCoroutine { continuation ->
  val engine = AlarmEngine.get(context)
  engine.request({ body(engine) }, { @Suppress("UNCHECKED_CAST") continuation.resume(it as T) }, { continuation.resumeWithException(IllegalStateException(it)) })
}

object WidgetWork {
  const val REFRESH = "remilo-widget-refresh"
  const val PERIODIC = "remilo-widget-periodic"
  const val BOUNDARY = "remilo-widget-boundary"
  private val queued = AtomicBoolean(false)
  fun ids(context: Context): IntArray = AppWidgetManager.getInstance(context).getAppWidgetIds(ComponentName(context, RemiloWidgetReceiver::class.java))
  fun unlocked(context: Context) = context.getSystemService(UserManager::class.java).isUserUnlocked
  fun supported(context: Context, id: Int): Boolean {
    val manager = AppWidgetManager.getInstance(context)
    return manager.getAppWidgetInfo(id)?.provider == ComponentName(context, RemiloWidgetReceiver::class.java) &&
      manager.getAppWidgetOptions(id).getInt(AppWidgetManager.OPTION_APPWIDGET_HOST_CATEGORY, android.appwidget.AppWidgetProviderInfo.WIDGET_CATEGORY_HOME_SCREEN) == android.appwidget.AppWidgetProviderInfo.WIDGET_CATEGORY_HOME_SCREEN
  }
  fun generic(context: Context) {
    val manager = AppWidgetManager.getInstance(context)
    ids(context).forEach { id -> manager.updateAppWidget(id, RemoteViews(context.packageName, R.layout.remilo_widget_locked).apply {
      setTextViewText(R.id.widget_locked_text, L10n.text(context, "Unlock to view Remilo."))
    }) }
    // Protected appearance contains only enums; no CE content is read for this generic view.
    val engine = AlarmEngine.get(context)
    engine.request({ engine.widgetSnapshot(-1,false) }, { value ->
      val snapshot = value as WidgetSnapshot
      val roles = com.remilo.alarm.presentation.AtmosphereTokens.colors(snapshot.appearance.atmosphere,snapshot.appearance.brightness)
      ids(context).forEach { id -> manager.updateAppWidget(id,RemoteViews(context.packageName,R.layout.remilo_widget_locked).apply {
        setTextViewText(R.id.widget_locked_text,L10n.text(context,"Unlock to view Remilo.")); setTextColor(R.id.widget_locked_text,roles.onSurface.toInt())
        setInt(R.id.widget_locked_root,"setBackgroundColor",roles.canvas.toInt())
      }) }
    }, {})
  }
  fun request(context: Context) {
    try {
      if (ids(context).isEmpty()) return
      if (!unlocked(context)) { generic(context); return }
      if (!queued.compareAndSet(false, true)) return
      WorkManager.getInstance(context).enqueueUniqueWork(REFRESH, ExistingWorkPolicy.APPEND_OR_REPLACE,
      OneTimeWorkRequest.Builder(WidgetRefreshWorker::class.java).build()) }
    catch (_: Exception) { queued.set(false) /* Widget presentation cannot block an alarm mutation. */ }
  }
  internal fun started() { queued.set(false) }
  internal fun boundary(at: Long, zone: ZoneId): Long {
    val local = Instant.ofEpochMilli(at).atZone(zone)
    return (listOf(6,10,17,21).map { local.toLocalDate().atTime(it,0).atZone(zone).toInstant().toEpochMilli() } +
      local.toLocalDate().plusDays(1).atStartOfDay(zone).toInstant().toEpochMilli()).filter { it > at }.min()
  }
  suspend fun reconcile(context: Context) {
    if (!unlocked(context)) { generic(context); return }
    val active = ids(context).toSet()
    WidgetPresentation.prune(active)
    widgetRequest(context) { it.pruneWidgets(active) }
    val manager = WorkManager.getInstance(context)
    if (active.isEmpty()) {
      manager.cancelUniqueWork(PERIODIC); manager.cancelUniqueWork(BOUNDARY); return
    }
    manager.enqueueUniquePeriodicWork(PERIODIC, ExistingPeriodicWorkPolicy.KEEP,
      PeriodicWorkRequest.Builder(WidgetRefreshWorker::class.java, 30, TimeUnit.MINUTES).build())
    val at = System.currentTimeMillis()
    manager.enqueueUniqueWork(BOUNDARY, ExistingWorkPolicy.REPLACE, OneTimeWorkRequest.Builder(WidgetBoundaryWorker::class.java)
      .setInitialDelay(boundary(at, ZoneId.systemDefault()) - at, TimeUnit.MILLISECONDS).build())
  }
}

class WidgetRefreshWorker(context: Context, parameters: WorkerParameters) : CoroutineWorker(context, parameters) {
  override suspend fun doWork(): Result {
    WidgetWork.started()
    if (!WidgetWork.unlocked(applicationContext)) { WidgetWork.generic(applicationContext); return Result.success() }
    return try { WidgetPresentation.refresh(applicationContext); RemiloWidget().updateAll(applicationContext); WidgetWork.reconcile(applicationContext); Result.success() }
    catch (_: Exception) { Result.retry() }
  }
}
class WidgetBoundaryWorker(context: Context, parameters: WorkerParameters) : CoroutineWorker(context, parameters) {
  override suspend fun doWork(): Result { WidgetWork.request(applicationContext); return Result.success() }
}

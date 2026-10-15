package com.remilo.alarm.calendar

import android.content.Context
import android.os.UserManager
import androidx.work.*
import com.remilo.alarm.engine.AlarmEngine
import java.util.concurrent.TimeUnit

/** Never called from locked boot. Inputs/tags contain no account or reminder content. */
object CalendarWork {
  const val PERIODIC = "remilo-calendar-periodic"
  const val PENDING = "remilo-calendar-pending"
  private fun unlocked(context: Context) = context.getSystemService(UserManager::class.java).isUserUnlocked
  fun reconcile(context: Context, opportunity: Boolean = false, owner: AlarmEngine? = null) {
    if (!unlocked(context)) return
    val app = context.applicationContext
    (owner ?: AlarmEngine.get(app)).calendarRequest(block = { store -> Triple(store.connection().connected,
      (store.sync.summary()["automaticCount"] as Int) > 0 || store.sync.pending().isNotEmpty() || store.managed.hasWork() || CalendarSyncRequests(store.database(), System::currentTimeMillis).pending().isNotEmpty(),
        listOfNotNull(store.sync.nextRetryMs(), store.managed.nextRetryMs(), CalendarSyncRequests(store.database(), System::currentTimeMillis).nextRetryMs()).minOrNull() ?:
        System.currentTimeMillis().takeIf { store.incremental.calendars().any { store.incremental.cursor(it).paging } }) }, resolve = { saved ->
      if (!saved.first || !saved.second) {
        // Avoid initializing WorkManager for alarm-only startup unless it already exists.
        existing(app)?.let { it.cancelUniqueWork(PERIODIC); it.cancelUniqueWork(PENDING) }
        return@calendarRequest
      }
      val work = WorkManager.getInstance(app)
      work.enqueueUniquePeriodicWork(PERIODIC, ExistingPeriodicWorkPolicy.KEEP, periodic())
      if (opportunity || saved.third != null) request(work, saved.third?.let { maxOf(0, it - System.currentTimeMillis()) } ?: 0)
    }, reject = { /* No Calendar work until unlocked CE can be read. Alarm startup remains autonomous. */ })
  }
  internal fun periodic() = PeriodicWorkRequest.Builder(CalendarSyncWorker::class.java, 1, TimeUnit.HOURS, 15, TimeUnit.MINUTES)
    .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
    .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 1, TimeUnit.MINUTES).build()
  internal fun pending(delayMs: Long) = OneTimeWorkRequest.Builder(CalendarSyncWorker::class.java)
    .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
    .setInitialDelay(delayMs, TimeUnit.MILLISECONDS).setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 1, TimeUnit.MINUTES).build()
  private fun existing(context: Context): WorkManager? = try {
    // getInstance() would initialize on demand; use the legacy accessor only to detect an existing instance.
    @Suppress("DEPRECATION") WorkManager.getInstance()
  } catch (_: IllegalStateException) { null }
  fun request(work: WorkManager, delayMs: Long = 0) {
    work.enqueueUniqueWork(PENDING, ExistingWorkPolicy.KEEP, pending(delayMs))
  }
}

class CalendarSyncWorker @JvmOverloads constructor(context: Context, parameters: WorkerParameters,
  private val synchronize: () -> java.util.concurrent.CompletableFuture<CalendarRunSummary> = { CalendarRuntime.get(context.applicationContext).synchronize(background = true) }) : Worker(context, parameters) {
  @Volatile private var flight: java.util.concurrent.CompletableFuture<CalendarRunSummary>? = null
  @Volatile private var stopped = false
  override fun onStopped() { stopped = true; flight?.cancel(false) }
  override fun doWork(): Result {
    if (stopped || isStopped) return Result.success()
    if (!applicationContext.getSystemService(UserManager::class.java).isUserUnlocked) return Result.retry()
    return try {
      val pending = synchronize(); flight = pending
      if (stopped || isStopped) pending.cancel(false)
      val result = pending.get(130, TimeUnit.SECONDS)
      if (result.continuation) Result.retry() else Result.success()
    } catch (error: Exception) {
      val failure = (error.cause ?: error) as? CalendarFailure
      if (stopped || isStopped || error is java.util.concurrent.CancellationException || failure?.code in setOf("AUTH", "NEEDS_ACCESS", "ACCOUNT_MISMATCH", "STALE_AUTHORIZATION", "CANCELLED")) Result.success() else Result.retry()
    }
  }
}

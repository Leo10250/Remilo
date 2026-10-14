package com.remilo.alarm.calendar

import android.app.Application
import android.content.Context
import android.os.UserManager
import androidx.work.*
import androidx.work.testing.TestWorkerBuilder
import org.junit.*
import org.junit.Assert.*
import org.junit.runner.RunWith
import org.robolectric.*
import org.robolectric.annotation.Config
import java.util.concurrent.CompletableFuture

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34], application = Application::class)
class CalendarWorkTest {
  private val context: Context get() = RuntimeEnvironment.getApplication()
  private var calls = 0
  private var onSynchronize: () -> Unit = {}
  private var outcome: CompletableFuture<CalendarRunSummary> = CompletableFuture.completedFuture(CalendarRunSummary(0, 0, 0, false))
  private fun worker() = TestWorkerBuilder.from(context, CalendarSyncWorker::class.java, java.util.concurrent.Executor { it.run() })
    .setWorkerFactory(object : WorkerFactory() {
      override fun createWorker(appContext: Context, workerClassName: String, parameters: WorkerParameters): ListenableWorker =
        CalendarSyncWorker(appContext, parameters) { calls++; onSynchronize(); outcome }
    }).build() as CalendarSyncWorker
  @Test fun coldNativeWorkerCompletesWithoutJavaScriptAndContinuesDurableWork() {
    Shadows.shadowOf(context.getSystemService(UserManager::class.java)).setUserUnlocked(true)
    assertEquals(ListenableWorker.Result.success(), worker().doWork()); assertEquals(1, calls)
    outcome = CompletableFuture.completedFuture(CalendarRunSummary(10, 50, 49, true))
    assertEquals(ListenableWorker.Result.retry(), worker().doWork())
  }
  @Test fun lockedBootDoesNotCreateCalendarRuntimeOrReadCredentialStorage() {
    Shadows.shadowOf(context.getSystemService(UserManager::class.java)).setUserUnlocked(false)
    assertEquals(ListenableWorker.Result.retry(), worker().doWork()); assertEquals(0, calls)
    CalendarWork.reconcile(context, opportunity = true); assertEquals(0, calls)
  }
  @Test fun consentRequiredStopsBackgroundRetriesWhileTransientFailuresContinue() {
    Shadows.shadowOf(context.getSystemService(UserManager::class.java)).setUserUnlocked(true)
    outcome = CompletableFuture<CalendarRunSummary>().also { it.completeExceptionally(CalendarFailure("NEEDS_ACCESS")) }
    assertEquals(ListenableWorker.Result.success(), worker().doWork())
    outcome = CompletableFuture<CalendarRunSummary>().also { it.completeExceptionally(CalendarFailure("NETWORK")) }
    assertEquals(ListenableWorker.Result.retry(), worker().doWork())
  }
  @Test fun requestConfigurationIsHourlyConstrainedFlexibleAndContainsNoPrivateInputs() {
    val periodic = CalendarWork.periodic().workSpec
    assertEquals(3_600_000L, periodic.intervalDuration); assertEquals(900_000L, periodic.flexDuration)
    assertEquals(NetworkType.CONNECTED, periodic.constraints.requiredNetworkType)
    assertEquals(BackoffPolicy.EXPONENTIAL, periodic.backoffPolicy); assertEquals(60_000L, periodic.backoffDelayDuration)
    assertTrue(periodic.input.keyValueMap.isEmpty())
    val pending = CalendarWork.pending(120_000).workSpec
    assertEquals(120_000L, pending.initialDelay); assertTrue(pending.input.keyValueMap.isEmpty())
    assertEquals(NetworkType.CONNECTED, pending.constraints.requiredNetworkType)
  }
  @Test fun stoppedWorkerCannotStartAnotherNativeOpportunity() {
    Shadows.shadowOf(context.getSystemService(UserManager::class.java)).setUserUnlocked(true)
    outcome = CompletableFuture()
    val current = worker()
    current.onStopped()
    assertEquals(ListenableWorker.Result.success(), current.doWork())
    assertEquals(0, calls)
  }
  @Test fun stoppingAnInFlightWorkerCancelsItsNativeOpportunity() {
    Shadows.shadowOf(context.getSystemService(UserManager::class.java)).setUserUnlocked(true)
    outcome = CompletableFuture()
    val started = java.util.concurrent.CountDownLatch(1)
    onSynchronize = { started.countDown() }
    val current = worker(); val executor = java.util.concurrent.Executors.newSingleThreadExecutor()
    try {
      val result = executor.submit<ListenableWorker.Result> { current.doWork() }
      assertTrue(started.await(5, java.util.concurrent.TimeUnit.SECONDS))
      current.onStopped()
      assertEquals(ListenableWorker.Result.success(), result.get(5, java.util.concurrent.TimeUnit.SECONDS))
      assertTrue(outcome.isCancelled)
    } finally { executor.shutdownNow() }
  }
}

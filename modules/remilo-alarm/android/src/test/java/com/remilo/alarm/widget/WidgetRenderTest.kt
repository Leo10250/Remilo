package com.remilo.alarm.widget

import android.app.Application
import android.content.Context
import android.content.res.Configuration
import android.graphics.Bitmap
import android.graphics.Canvas
import android.os.LocaleList
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.TextView
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import androidx.glance.appwidget.compose
import androidx.glance.appwidget.runComposition
import androidx.glance.ExperimentalGlanceApi
import com.remilo.alarm.core.AppearancePolicy
import com.remilo.alarm.system.PresentationLanguage
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeout
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.flow.collect
import org.junit.Assert.*
import org.junit.Test
import org.junit.After
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File
import java.time.Instant
import java.time.ZoneId

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34], application = Application::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class WidgetRenderTest {
  private fun context(language: String, scale: Float): Context {
    val app = RuntimeEnvironment.getApplication() as Context
    val config = Configuration(app.resources.configuration).apply { setLocales(LocaleList.forLanguageTags(language)); fontScale = scale }
    return app.createConfigurationContext(config).also { PresentationLanguage.update(it,language) }
  }
  @After fun resetLanguage() { PresentationLanguage.update(RuntimeEnvironment.getApplication(),"en") }
  @OptIn(ExperimentalGlanceApi::class)
  @Test fun activeGlanceSessionConsumesFreshNativeProjectionWithoutRestart() = runBlocking {
    val ctx = context("en",1f)
    val number = CompletableDeferred<Int>()
    val initial = previewSnapshot().copy(configuration = WidgetConfiguration("Routine","example"))
    val widget = RemiloWidget { _, id -> number.complete(id); initial.copy(id = id) }
    val first = CompletableDeferred<Unit>(); val second = CompletableDeferred<Unit>()
    val collection = launch {
      widget.runComposition(ctx,sizes = listOf(DpSize(300.dp,280.dp))).collect { remote ->
        val host = FrameLayout(ctx); val root = remote.apply(ctx,host)
        val values = text(root)
        if (values.contains("Front plank")) first.complete(Unit)
        if (values.contains("Changed native exercise")) second.complete(Unit)
      }
    }
    withTimeout(15_000) { first.await() }
    val updated = initial.copy(id = number.await(),projectionEpoch = 2,session = initial.session!! + ("steps" to listOf(mapOf("name" to "Changed native exercise","target" to "3 × 10","completed" to false))))
    val stream = WidgetPresentation.publish(updated)
    withTimeout(15_000) { second.await() }; collection.cancelAndJoin()
    WidgetPresentation.publish(initial.copy(id = number.await())) // A late older query must not replace the fresh frame.
    assertEquals(2L,stream.value.projectionEpoch)
    WidgetPresentation.prune(emptySet())
  }
  private fun render(context: Context, snapshot: WidgetSnapshot, width: Int, height: Int, name: String): View {
    val remote = runBlocking { WidgetRender(snapshot, preview = false).compose(context, size = DpSize(width.dp,height.dp)) }
    val parent = FrameLayout(context)
    val view = remote.apply(context, parent); parent.addView(view)
    val density = context.resources.displayMetrics.density
    val w = (width*density).toInt(); val h = (height*density).toInt()
    fun layout() { parent.measure(View.MeasureSpec.makeMeasureSpec(w,View.MeasureSpec.EXACTLY),View.MeasureSpec.makeMeasureSpec(h,View.MeasureSpec.EXACTLY)); parent.layout(0,0,w,h) }
    layout(); shadowOf(android.os.Looper.getMainLooper()).idle(); layout()
    assertEquals(w,parent.measuredWidth); assertEquals(h,parent.measuredHeight)
    // Only nonpersonal fixtures are captured, inside the ignored module build directory.
    val bitmap = Bitmap.createBitmap(w,h,Bitmap.Config.ARGB_8888); parent.draw(Canvas(bitmap))
    val output = File("build/widget-captures/$name.png"); output.parentFile?.mkdirs()
    output.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG,100,it) }; bitmap.recycle()
    return parent
  }
  private fun textViews(view: View): List<TextView> = (if (view is TextView) listOf(view) else emptyList()) +
    if (view is ViewGroup) (0 until view.childCount).flatMap { textViews(view.getChildAt(it)) } else emptyList()
  private fun text(view: View) = textViews(view).map { it.text.toString() }
  @Test fun actualRemoteViewsRenderEightAppearancesBothLanguagesAndAdaptiveSizes() {
    for (language in listOf("en","zh-Hans")) for (scene in listOf("sunrise","sky","evening","night")) for (brightness in listOf("light","dark")) {
      val sample = previewSnapshot().copy(appearance = AppearancePolicy.Resolved(scene,brightness),
        reminders = listOf(mapOf("id" to "example", "title" to "Read", "alarmAtMs" to 0L, "overdueAtMs" to Instant.parse("2026-10-11T16:00:00Z").toEpochMilli(), "overdue" to true)), total = 1)
      val root = render(context(language,1f),sample,300,440,"$language-$scene-$brightness")
      assertTrue(text(root).joinToString().contains("Remilo"))
      assertTrue(text(root).contains("Front plank")); assertTrue(text(root).contains("Read"))
    }
    for (language in listOf("en","zh-Hans")) {
      val compact = render(context(language,2f),previewSnapshot(),180,110,"$language-compact-200")
      assertFalse(text(compact).contains("Mark as done")); assertFalse(text(compact).contains("标记为完成"))
      assertTrue(text(compact).contains("Routine")); assertTrue(text(compact).contains("1/4"))
      val largeText = render(context(language,2f),previewSnapshot(),300,280,"$language-focus-200")
      assertTrue(text(largeText).contains("Routine")); assertTrue(text(largeText).contains("1/4"))
      render(context(language,1f),previewSnapshot(),300,280,"$language-focus")
      render(context(language,1.5f),previewSnapshot().copy(undoToken = "undo",undoName = "Bird-dog"),300,440,"$language-undo-150")
    }
  }
  @Test fun lockedAndRestStatesExposeNoCompletion() {
    val ctx = context("en",1f)
    val locked = render(ctx,WidgetSnapshot(1,locked = true),300,280,"locked")
    assertTrue(text(locked).any { it.contains("Unlock") }); assertFalse(text(locked).contains("Mark as done"))
    val rest = previewSnapshot().copy(doneToken = null, session = mapOf("title" to "Routine", "state" to "Rest", "completedCount" to 0, "totalCount" to 0, "steps" to emptyList<Any>()))
    val root = render(ctx,rest,300,280,"rest")
    assertFalse(text(root).contains("Mark as done")); assertTrue(text(root).contains("Rest day"))
    for (language in listOf("en","zh-Hans")) for (state in listOf("Rest","Paused","Skipped","Completed")) {
      val compact = render(context(language,2f),rest.copy(session = rest.session!! + ("state" to state)),180,110,"$language-$state-compact-200")
      assertTrue(text(compact).contains("Routine"))
      val date = textViews(compact).single { it.text.toString() == "10/12" }
      assertEquals(0,date.layout.getEllipsisCount(0))
    }
    PresentationLanguage.update(ctx,"en")
    val unavailable = render(ctx,WidgetSnapshot(1,WidgetConfiguration("Routine","removed")),180,110,"unavailable")
    assertTrue(text(unavailable).contains("Routine unavailable")); assertFalse(text(unavailable).contains("0 reminders"))
    val failure = render(ctx,WidgetSnapshot(1,failed = true,notice = "Could not load the widget. Refresh to try again."),300,280,"error")
    assertFalse(text(failure).contains("No reminders for today."))
  }
  @Test fun civilRefreshBoundaryUsesLocalMidnightAndDst() {
    val zone = ZoneId.of("America/Los_Angeles")
    val at = Instant.parse("2026-11-01T05:00:00Z").toEpochMilli() // 22:00 local before DST ends.
    assertEquals(Instant.parse("2026-11-01T07:00:00Z").toEpochMilli(),WidgetWork.boundary(at,zone))
  }
  @Test fun uncommittedUncertainTapKeepsItsIdentityButCannotBlockTomorrow() {
    val ctx = RuntimeEnvironment.getApplication() as Context
    shadowOf(ctx.getSystemService(android.os.UserManager::class.java)).setUserUnlocked(true)
    ctx.getSharedPreferences("remilo-widgets-v1",Context.MODE_PRIVATE).edit().clear().commit()
    var at = Instant.parse("2026-10-12T12:00:00Z").toEpochMilli()
    var date = "2026-10-12"
    val coordinator = WidgetCoordinator(ctx,{ at },{ AppearancePolicy.Resolved("sky","light") },{ mapOf("date" to date,"occurrenceId" to date,
      "revision" to 1L,"steps" to listOf(mapOf("id" to "step-$date","name" to date,"completed" to false)),"ended" to false) },
      { emptyMap() },{ true },{ throw IllegalStateException("Storage unavailable before capture") },{ false })
    coordinator.configure(700,"Routine","plan",0)
    val original = coordinator.snapshot(700).doneToken!!
    try { coordinator.act(700,original); fail("Expected storage interruption") } catch (_: IllegalStateException) { }
    assertEquals(original,coordinator.snapshot(700).retryToken)
    assertNull(coordinator.snapshot(700).doneToken)
    date = "2026-10-13"; at = Instant.parse("2026-10-13T12:00:00Z").toEpochMilli()
    val next = coordinator.snapshot(700)
    assertNull(next.retryToken); assertNotNull(next.doneToken); assertNotEquals(original,next.doneToken)
    ctx.getSharedPreferences("remilo-widgets-v1",Context.MODE_PRIVATE).edit().clear().commit()
  }
}

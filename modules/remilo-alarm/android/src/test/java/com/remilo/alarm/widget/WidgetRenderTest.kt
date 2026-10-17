package com.remilo.alarm.widget

import android.app.Application
import android.content.Context
import android.content.res.Configuration
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Rect
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
import com.remilo.alarm.presentation.L10n
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
  private fun descriptions(view: View): List<String> = listOfNotNull(view.contentDescription?.toString()) +
    if(view is ViewGroup) (0 until view.childCount).flatMap { descriptions(view.getChildAt(it)) } else emptyList()
  private fun assertNoCompletionOrRefresh(root: View, ctx: Context) {
    assertFalse(text(root).contains(L10n.text(ctx,"Done")))
    assertFalse(text(root).contains(L10n.text(ctx,"Retry")))
    assertFalse(descriptions(root).contains(L10n.text(ctx,"Refresh")))
    assertFalse(text(root).contains(L10n.text(ctx,"Refresh")))
  }
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
  @Test fun routineFocusHasOnlyResumeInCompactAndNextExerciseOnlyWhenExpanded() {
    val sample=previewSnapshot().copy(configuration = WidgetConfiguration("Routine","preview"),session=previewSnapshot().session!! + ("title" to "Core & intervals"))
    val ctx=context("en",1f)
    val compact=render(ctx,sample.copy(doneToken="legacy-unused"),300,200,"routine-focus-compact")
    assertActionFullyVisible(compact,"Resume"); assertNoCompletionOrRefresh(compact,ctx)
    assertFalse(text(compact).any { it.contains("Next:") }); assertFalse(text(compact).contains("Widget settings"))
    val expanded=render(ctx,sample,300,440,"routine-focus-expanded")
    assertTrue(text(expanded).contains("Next: Side plank")); assertTrue(text(expanded).contains("Intervals"))
    assertActionFullyVisible(expanded,"Resume"); assertNoCompletionOrRefresh(expanded,ctx)
  }
  @OptIn(ExperimentalGlanceApi::class)
  @Test fun inertPreviewPreservesResumeOnlyProductionLabels() {
    val ctx=context("en",1f)
    val sample=previewSnapshot().copy(configuration=WidgetConfiguration("Routine","preview"))
    fun root(preview: Boolean): View {
      val remote=runBlocking { WidgetRender(sample,preview).compose(ctx,size=DpSize(300.dp,240.dp)) }
      return remote.apply(ctx,FrameLayout(ctx))
    }
    val production=root(false); val preview=root(true)
    assertEquals(text(production),text(preview))
    assertNoCompletionOrRefresh(production,ctx); assertNoCompletionOrRefresh(preview,ctx)
    fun clickable(view: View): List<View> = (if(view.hasOnClickListeners())listOf(view) else emptyList()) +
      if(view is ViewGroup) (0 until view.childCount).flatMap { clickable(view.getChildAt(it)) } else emptyList()
    assertTrue("Example controls must be inert",clickable(preview).isEmpty())
  }
  private fun assertActionFullyVisible(root: View, label: String) {
    val matches = textViews(root).filter { it.text.toString().equals(label, ignoreCase = true) }
    assertEquals("Expected one action named $label; rendered ${text(root)}", 1, matches.size)
    val button = matches.single()
    assertEquals("Action must be visible: $label", View.VISIBLE, button.visibility)
    val layout = button.layout ?: throw AssertionError("Action has no measured text layout: $label")
    val transformed = button.transformationMethod?.getTransformation(button.text, button)?.toString() ?: button.text.toString()
    assertEquals("Text transformation must preserve the whole label: $label", transformed, layout.text.toString())
    assertTrue("Action has no visible text lines: $label", layout.lineCount > 0)
    assertEquals("Final label characters must not be hidden: $label", transformed.length, layout.getLineEnd(layout.lineCount - 1))
    val availableWidth = button.width - button.compoundPaddingLeft - button.compoundPaddingRight
    for (line in 0 until layout.lineCount) {
      assertEquals("Action label must not ellipsize: $label, line $line", 0, layout.getEllipsisCount(line))
      assertTrue("Action label exceeds its text width: $label, line $line", layout.getLineMax(line) <= availableWidth + 1f)
      val ink = Rect()
      button.paint.getTextBounds(transformed, layout.getLineStart(line), layout.getLineVisibleEnd(line), ink)
      val baseline = button.totalPaddingTop + layout.getLineBaseline(line)
      assertTrue("Action glyphs exceed their text viewport: $label, line $line ($ink / ${button.height})",
        baseline + ink.top >= button.extendedPaddingTop && baseline + ink.bottom <= button.height - button.extendedPaddingBottom)
    }
    // Check every measured clipping ancestor, not only the final host bounds.
    var child: View = button
    val bounds = Rect(0, 0, button.width, button.height)
    while (child.parent is ViewGroup) {
      val parent = child.parent as ViewGroup
      bounds.offset(child.left - parent.scrollX, child.top - parent.scrollY)
      if (parent.clipChildren) {
        val left = if (parent.clipToPadding) parent.paddingLeft else 0
        val top = if (parent.clipToPadding) parent.paddingTop else 0
        val right = parent.width - if (parent.clipToPadding) parent.paddingRight else 0
        val bottom = parent.height - if (parent.clipToPadding) parent.paddingBottom else 0
        assertTrue("Action is clipped by ${parent.javaClass.simpleName}: $label ($bounds / $left,$top,$right,$bottom)",
          bounds.left >= left && bounds.top >= top && bounds.right <= right && bounds.bottom <= bottom)
      }
      child = parent
    }
  }
  @Test fun legacyUndoAndUncertainRetryRemainVisibleWithoutNewCompletionControls() {
    for (language in listOf("en", "zh-Hans")) for ((height, scale) in listOf(240 to 1f, 440 to 1.5f)) {
      val ctx = context(language, scale)
      for (mode in listOf("continue", "final", "retry")) {
        val final = mode == "final"
        val steps = listOf(
          mapOf("name" to "Bird-dog", "target" to "3 x 10", "completed" to true),
          mapOf("name" to "Front plank", "target" to "3 x 40 s", "completed" to false),
          mapOf("name" to "Side plank", "target" to "3 x 25 s", "completed" to final),
          mapOf("name" to "Intervals", "target" to "8 intervals", "completed" to final))
        val sample = previewSnapshot().copy(undoToken = "undo", undoName = "Bird-dog", retryToken = if (mode == "retry") "retry" else null,
          session = previewSnapshot().session!! + mapOf("steps" to steps, "completedCount" to if (final) 3 else 1))
        val root = render(ctx, sample, 300, height, "$language-actions-$height-${(scale * 100).toInt()}-$mode")
        assertFalse(text(root).contains(L10n.text(ctx,"Done")))
        assertFalse(text(root).contains(L10n.text(ctx,"Refresh")))
        if (mode == "retry") assertActionFullyVisible(root,L10n.text(ctx,"Retry"))
        else assertFalse(text(root).contains(L10n.text(ctx,"Retry")))
        assertActionFullyVisible(root, L10n.text(ctx, "Resume"))
        assertActionFullyVisible(root, L10n.text(ctx, "Undo Bird-dog"))
      }
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
      assertFalse(text(compact).contains(L10n.text(ctx, "Done")))
    }
    PresentationLanguage.update(ctx,"en")
    val unavailable = render(ctx,WidgetSnapshot(1,WidgetConfiguration("Routine","removed")),180,110,"unavailable")
    assertTrue(text(unavailable).contains("Routine unavailable")); assertFalse(text(unavailable).contains("0 reminders"))
    val failure = render(ctx,WidgetSnapshot(1,failed = true,notice = "Could not load the widget. Refresh to try again."),300,280,"error")
    assertFalse(text(failure).contains("No reminders for today."))
  }
  @Test fun setupDefaultsAndExamplePreviewsNeverRetargetAnExistingSelection() {
    val plans = listOf(mapOf("id" to "first"),mapOf("id" to "second"))
    assertEquals("first",WidgetSetup.routineSelection("Routine",null,plans))
    assertNull(WidgetSetup.routineSelection("Today",null,plans))
    assertNull(WidgetSetup.routineSelection("Routine",null,emptyList()))
    assertEquals("removed",WidgetSetup.routineSelection("Routine","removed",plans))
    assertEquals("second",WidgetSetup.routineSelection("Routine","second",plans))
    val empty = WidgetSnapshot(-1,date = "2026-10-16")
    assertTrue(WidgetSetup.needsExample(empty,"Today",null))
    assertTrue(WidgetSetup.needsExample(empty,"Routine",null))
    assertFalse(WidgetSetup.needsExample(empty,"Routine","removed"))
    assertFalse(WidgetSetup.needsExample(empty.copy(reminders = listOf(mapOf("title" to "Read"))),"Today",null))
    for(language in listOf("en","zh-Hans")) for(mode in listOf("Today","Routine")) {
      val ctx=context(language,1f)
      val sample=WidgetSetup.example(ctx,mode,empty)
      assertEquals("2026-10-16",sample.date)
      val root=render(ctx,sample,300,240,"$language-setup-example-$mode")
      assertTrue(text(root).contains(L10n.text(ctx,if(mode == "Today") "Water plants" else "Core & intervals")))
      if(mode == "Today") assertActionFullyVisible(root,L10n.text(ctx,"View Agenda (1)"))
      else { assertActionFullyVisible(root,L10n.text(ctx,"Resume")); assertNoCompletionOrRefresh(root,ctx) }
    }
  }
  @Test fun compactTodayFooterNeverOverlapsOrClipsContentAndEmptyStatesAreIntentional() {
    val reminders=(1..20).map { mapOf("id" to "$it","title" to "Reminder $it","overdue" to true,"overdueAtMs" to 0L) }
    for(language in listOf("en","zh-Hans")) for(width in listOf(300,360)) {
      val ctx=context(language,1f)
      val base=WidgetSnapshot(1,date="2026-10-16",reminders=reminders,total=73)
      val ordinary=render(ctx,base,width,240,"$language-today-$width")
      assertTrue(text(ordinary).contains("Reminder 1")); assertFalse(text(ordinary).contains("Reminder 2"))
      assertActionFullyVisible(ordinary,L10n.text(ctx,"View Agenda (73)"))
      val focus=render(ctx,previewSnapshot().copy(reminders=reminders,total=73),width,240,"$language-today-focus-$width")
      for(action in listOf("View Agenda (73)","Resume")) assertActionFullyVisible(focus,L10n.text(ctx,action))
      assertNoCompletionOrRefresh(focus,ctx)
      val rest=previewSnapshot().copy(session=mapOf("title" to "Workout","state" to "Rest","steps" to emptyList<Any>()),doneToken=null,total=73)
      val resting=render(ctx,rest,width,240,"$language-today-rest-$width")
      assertEquals(1,text(resting).count { it == L10n.text(ctx,"Rest day") })
      assertFalse(text(resting).contains(L10n.text(ctx,"Resume")))
      assertFalse(text(resting).contains(L10n.text(ctx,"Done")))
      assertActionFullyVisible(resting,L10n.text(ctx,"View routine")); assertActionFullyVisible(resting,L10n.text(ctx,"View Agenda (73)"))
      val empty=render(ctx,base.copy(reminders=emptyList(),total=0),width,240,"$language-today-empty-$width")
      assertTrue(text(empty).contains(L10n.text(ctx,"No reminders for today.")))
      assertFalse(text(empty).contains(L10n.text(ctx,"Water plants")))
      assertActionFullyVisible(empty,L10n.text(ctx,"View Agenda (0)"))
    }
  }
  @Test fun compactProductionActionsFitEveryAppearanceAndIntermediateTextScaleFallsBack() {
    for(language in listOf("en","zh-Hans")) for(scene in listOf("sunrise","sky","evening","night")) for(brightness in listOf("light","dark")) {
      val ctx=context(language,1f)
      for(mode in listOf("Routine","Today")) {
        val sample=previewSnapshot().copy(configuration=WidgetConfiguration(mode,"preview"),appearance=AppearancePolicy.Resolved(scene,brightness))
        val root=render(ctx,sample,300,WidgetSizing.compactHeight(sample),"$language-$scene-$brightness-$mode-compact")
        assertActionFullyVisible(root,L10n.text(ctx,"Resume"))
        if(mode == "Today") assertActionFullyVisible(root,L10n.text(ctx,"View Agenda (0)"))
        assertNoCompletionOrRefresh(root,ctx)
        assertFalse(text(root).any { it.startsWith("Next:") })
      }
    }
    for(language in listOf("en","zh-Hans")) for(scale in listOf(1.1f,1.2f,1.5f,2f)) {
      val ctx=context(language,scale)
      val root=render(ctx,previewSnapshot(),300,240,"$language-summary-${(scale*100).toInt()}")
      assertFalse(text(root).contains(L10n.text(ctx,"Done")))
      assertTrue(text(root).contains("1/4"))
    }
  }
  @Test fun recoveryControlsAppearOnlyForActualErrorsAndCompactPreviewsMatchContent() {
    assertEquals(200,WidgetSizing.compactHeight(previewSnapshot().copy(configuration=WidgetConfiguration("Routine","plan"))))
    assertEquals(240,WidgetSizing.compactHeight(previewSnapshot()))
    assertEquals(200,WidgetSizing.compactHeight(WidgetSnapshot(1)))
    for(language in listOf("en","zh-Hans")) {
      val ctx=context(language,1f)
      val sample=previewSnapshot().copy(configuration=WidgetConfiguration("Routine","plan"))
      val clean=render(ctx,sample,300,200,"$language-resume-only")
      assertActionFullyVisible(clean,L10n.text(ctx,"Resume")); assertNoCompletionOrRefresh(clean,ctx)
      val failed=render(ctx,WidgetSnapshot(1,failed=true,notice="Could not load the widget. Refresh to try again."),300,200,"$language-recovery-error")
      assertActionFullyVisible(failed,L10n.text(ctx,"Refresh"))
      val conflict=render(ctx,sample.copy(notice="This view changed. Review the refreshed routine."),300,240,"$language-recovery-conflict")
      assertActionFullyVisible(conflict,L10n.text(ctx,"Refresh")); assertFalse(text(conflict).contains(L10n.text(ctx,"Done")))
      val empty=render(ctx,WidgetSnapshot(1,date="2026-10-16"),300,200,"$language-empty-compact")
      assertActionFullyVisible(empty,L10n.text(ctx,"View Agenda (0)")); assertNoCompletionOrRefresh(empty,ctx)
      render(ctx,WidgetSnapshot(1,failed=true),180,110,"$language-error-summary")
    }
  }
  @Test fun civilRefreshBoundaryUsesLocalMidnightAndDst() {
    val zone = ZoneId.of("America/Los_Angeles")
    val at = Instant.parse("2026-11-01T05:00:00Z").toEpochMilli() // 22:00 local before DST ends.
    assertEquals(Instant.parse("2026-11-01T07:00:00Z").toEpochMilli(),WidgetWork.boundary(at,zone))
  }
  @Test fun explicitRefreshAcknowledgesConflictFeedbackWithoutChangingProgressOrConfiguration() {
    val ctx=RuntimeEnvironment.getApplication() as Context
    shadowOf(ctx.getSystemService(android.os.UserManager::class.java)).setUserUnlocked(true)
    ctx.getSharedPreferences("remilo-widgets-v1",Context.MODE_PRIVATE).edit().clear().commit()
    val at=Instant.parse("2026-10-12T12:00:00Z").toEpochMilli()
    val date=Instant.ofEpochMilli(at).atZone(ZoneId.systemDefault()).toLocalDate().toString()
    val session=mapOf("date" to date,"occurrenceId" to "occurrence","revision" to 1L,"ended" to false,
      "steps" to listOf(mapOf("id" to "exercise","name" to "Front plank","completed" to false)))
    val coordinator=WidgetCoordinator(ctx,{at},{AppearancePolicy.Resolved("sky","light")},{session},{emptyMap()},{true},
      {mapOf("status" to "Rejected")},{false})
    coordinator.configure(701,"Routine","plan",0)
    val initial=coordinator.snapshot(701)
    coordinator.act(701,initial.doneToken!!)
    assertNotNull(coordinator.snapshot(701).notice)
    coordinator.acknowledgeRefresh(701)
    val refreshed=coordinator.snapshot(701)
    assertNull(refreshed.notice); assertEquals(initial.session,refreshed.session)
    assertEquals(initial.configuration,refreshed.configuration)
    ctx.getSharedPreferences("remilo-widgets-v1",Context.MODE_PRIVATE).edit().clear().commit()
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
    coordinator.acknowledgeRefresh(700) // Refresh must never discard the uncertain operation.
    assertEquals(original,coordinator.snapshot(700).retryToken)
    assertNull(coordinator.snapshot(700).doneToken)
    date = "2026-10-13"; at = Instant.parse("2026-10-13T12:00:00Z").toEpochMilli()
    val next = coordinator.snapshot(700)
    assertNull(next.retryToken); assertNotNull(next.doneToken); assertNotEquals(original,next.doneToken)
    ctx.getSharedPreferences("remilo-widgets-v1",Context.MODE_PRIVATE).edit().clear().commit()
  }
}

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
import android.widget.ImageView
import android.widget.LinearLayout
import com.remilo.alarm.R
import com.remilo.alarm.presentation.AtmosphereTokens
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import androidx.glance.appwidget.compose
import androidx.glance.appwidget.composeForPreview
import androidx.glance.appwidget.runComposition
import androidx.glance.ExperimentalGlanceApi
import com.remilo.alarm.core.AppearancePolicy
import com.remilo.alarm.presentation.L10n
import com.remilo.alarm.presentation.NativeMessages
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
    val widget = RemiloWidget(load = { _, id -> number.complete(id); initial.copy(id = id) })
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
  private fun render(context: Context, snapshot: WidgetSnapshot, width: Int, height: Int, name: String, preview: Boolean = false): View {
    val remote = runBlocking { WidgetRender(snapshot, preview).compose(context, size = DpSize(width.dp,height.dp)) }
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
  private fun nextLabel(context: Context, name: String) = L10n.text(context,NativeMessages.widget_next(name))
  private fun globalBounds(root: View, view: View): Rect = Rect(0,0,view.width,view.height).also {
    (root as ViewGroup).offsetDescendantRectToMyCoords(view,it)
  }
  private fun doneTarget(root: View, ctx: Context): View {
    val label=textViews(root).single { it.text.toString() == L10n.text(ctx,"Done") }
    return generateSequence(label as View) { it.parent as? View }.first { it.hasOnClickListeners() }
  }
  private fun assertNoNavigationOrRefresh(root: View, ctx: Context) {
    assertFalse(text(root).contains(L10n.text(ctx,"Resume")))
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
  @Test fun routineFocusShowsPlainExerciseWeekdayAndCompactNextWithoutChangingActions() {
    val sample=previewSnapshot().copy(configuration = WidgetConfiguration("Routine","preview"),session=previewSnapshot().session!! + ("title" to "Core & intervals"))
    val ctx=context("en",1f)
    val compact=render(ctx,sample.copy(doneToken="legacy-unused"),300,200,"routine-focus-compact")
    assertActionFullyVisible(compact,"Done"); assertNoNavigationOrRefresh(compact,ctx)
    assertActionFullyVisible(compact,"Next: Side plank"); assertActionFullyVisible(compact,"Monday")
    assertTrue(text(compact).contains("Front plank")); assertFalse(text(compact).contains("2."))
    assertFalse(text(compact).contains("Widget settings"))
    val expanded=render(ctx,sample,300,440,"routine-focus-expanded")
    assertTrue(text(expanded).contains("Next: Side plank")); assertTrue(text(expanded).contains("Intervals"))
    assertActionFullyVisible(expanded,"Done"); assertNoNavigationOrRefresh(expanded,ctx)
    val after=render(ctx,sample.copy(undoToken="undo",undoName="Bird-dog"),300,200,"routine-focus-compact-after-completion")
    assertActionFullyVisible(after,"Done"); assertActionFullyVisible(after,"Undo completion of Bird-dog")
    fun bounds(root: View, view: View): Rect = Rect(0,0,view.width,view.height).also { (root as ViewGroup).offsetDescendantRectToMyCoords(view,it) }
    val undo = descendants(after).first { it.contentDescription?.toString() == "Undo completion of Bird-dog" }
    val undoBounds = bounds(after,undo)
    val doneBounds = bounds(after,textViews(after).single { it.text.toString() == "Done" })
    assertTrue("Undo must precede the trailing primary Done",undoBounds.right < doneBounds.left)
    assertFalse(text(after).contains("Resume")); assertFalse(text(after).contains("Refresh"))
    val final=render(ctx,sample.copy(doneToken=null,undoToken="undo",undoName="Front plank",session=sample.session!! + mapOf("state" to "Completed",
      "completedCount" to 4,"steps" to (sample.session["steps"] as List<Map<String,Any?>>).map { it + ("completed" to true) })),300,200,"routine-focus-final-undo")
    assertActionFullyVisible(final,"Undo completion of Front plank"); assertFalse(text(final).contains("Done"))
    assertActionFullyVisible(final,"Completed today")
    assertEquals("Final completion must not move Undo into Done's slot",undoBounds.centerX(),
      bounds(final,descendants(final).first { it.contentDescription?.toString() == "Undo completion of Front plank" }).centerX())
    assertFalse(text(final).any { it.startsWith("Next:") })
  }
  @Test fun weekdayHeaderCoversTheWholeWeekAndKeepsTheFullDateAccessible() {
    val weekdays = mapOf("en" to listOf("Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"),
      "zh-Hans" to listOf("星期一","星期二","星期三","星期四","星期五","星期六","星期日"))
    for((language,names) in weekdays) for(day in 0..6) {
      val ctx=context(language,1f); val date=java.time.LocalDate.parse("2026-10-12").plusDays(day.toLong()).toString()
      val sample=previewSnapshot().copy(date=date,configuration=WidgetConfiguration("Routine","preview"),
        session=previewSnapshot().session!! + ("date" to date))
      val root=render(ctx,sample,300,200,"$language-weekday-$day")
      assertActionFullyVisible(root,names[day]); assertActionFullyVisible(root,"Front plank")
      val next=nextLabel(ctx,"Side plank"); assertActionFullyVisible(root,next)
      if(language == "zh-Hans") assertEquals("下一项：Side plank",next)
      assertFalse(text(root).contains("2."))
      assertTrue(descriptions(root).any { it.contains(WidgetText.date(ctx,date)) && it.contains("2026") })
      assertTrue(descriptions(root).any { it.contains(L10n.text(ctx,"Exercise 2 of 4")) })
      val nextView=textViews(root).single { it.text.toString() == next }
      val nameView=textViews(root).single { it.text.toString() == "Front plank" }
      fun bounds(view: View)=Rect(0,0,view.width,view.height).also { (root as ViewGroup).offsetDescendantRectToMyCoords(view,it) }
      assertEquals(bounds(nameView).left,bounds(nextView).left)
      val doneView=textViews(root).single { it.text.toString() == L10n.text(ctx,"Done") }
      val doneTarget=generateSequence(doneView as View) { it.parent as? View }.first { it.hasOnClickListeners() }
      val nextBounds=bounds(nextView); val actionBounds=bounds(doneTarget)
      assertTrue("Next must share the bottom action band",nextBounds.top >= actionBounds.top && nextBounds.bottom <= actionBounds.bottom)
      assertTrue("Done must align with the Next line's bottom",actionBounds.bottom-nextBounds.bottom <= 6*ctx.resources.displayMetrics.density)
      assertEquals(android.util.TypedValue.applyDimension(android.util.TypedValue.COMPLEX_UNIT_SP,14f,ctx.resources.displayMetrics),nextView.textSize,0.1f)
      assertEquals(AtmosphereTokens.colors("sky","light").onSurfaceVariant.toInt(),nextView.currentTextColor)
    }
  }
  @Test fun compactActionsAlignWithNextAndStayFixedWithoutPrescriptionOrNext() {
    for(language in listOf("en","zh-Hans"))for(mode in listOf("Routine","Today"))for(scale in listOf(1f,1.2f,1.5f)) {
      val ctx=context(language,scale)
      val sample=previewSnapshot().copy(configuration=WidgetConfiguration(mode,"preview"),undoToken="undo",undoName="Bird-dog")
      @Suppress("UNCHECKED_CAST") val steps=sample.session!!["steps"] as List<Map<String,Any?>>
      val width=WidgetSizing.minimumWidth(sample,scale); val height=WidgetSizing.previewHeight(ctx,sample,false,scale)
      val root=render(ctx,sample,width,height,"$language-bottom-$mode-${(scale*100).toInt()}")
      val action=globalBounds(root,doneTarget(root,ctx))
      val undo=globalBounds(root,descendants(root).first { it.contentDescription?.toString() == L10n.text(ctx,"Undo completion of Bird-dog") })
      val next=globalBounds(root,textViews(root).single { it.text.toString() == nextLabel(ctx,"Side plank") })
      assertEquals("Undo and Done must share a centerline",action.centerY(),undo.centerY())
      assertTrue(next.top >= action.top && next.bottom <= action.bottom)
      assertTrue(action.bottom-next.bottom <= 6*ctx.resources.displayMetrics.density)
      assertActionFullyVisible(root,L10n.text(ctx,"Done")); assertActionFullyVisible(root,nextLabel(ctx,"Side plank"))
      if(mode == "Today") {
        val agenda=textViews(root).single { it.text.toString() == L10n.text(ctx,"View Agenda (0)") }
        val target=generateSequence(agenda as View) { it.parent as? View }.first { it.hasOnClickListeners() }
        assertTrue("Agenda must remain outside the exercise controls",globalBounds(root,target).top >= action.bottom)
        assertActionFullyVisible(root,L10n.text(ctx,"View Agenda (0)"))
      }
      val absentTarget=sample.copy(session=sample.session + ("steps" to steps.map { it - "target" }))
      val noTarget=render(ctx,absentTarget,width,height,"$language-bottom-no-target-$mode-${(scale*100).toInt()}")
      assertEquals(action,globalBounds(noTarget,doneTarget(noTarget,ctx)))
      assertActionFullyVisible(noTarget,"Front plank")
      val last=sample.copy(session=sample.session + mapOf("completedCount" to 3,
        "steps" to steps.mapIndexed { index,step -> step + ("completed" to (index != steps.lastIndex)) }))
      val lastRoot=render(ctx,last,width,height,"$language-bottom-last-$mode-${(scale*100).toInt()}")
      assertEquals(action,globalBounds(lastRoot,doneTarget(lastRoot,ctx)))
      assertFalse(text(lastRoot).any { it.startsWith(nextLabel(ctx,"")) })
      val final=sample.copy(doneToken=null,session=sample.session + mapOf("state" to "Completed","completedCount" to 4,
        "steps" to steps.map { it + ("completed" to true) }))
      val finalRoot=render(ctx,final,width,height,"$language-bottom-final-$mode-${(scale*100).toInt()}")
      assertEquals(undo,globalBounds(finalRoot,descendants(finalRoot).first { it.contentDescription?.toString() == L10n.text(ctx,"Undo completion of Bird-dog") }))
      assertActionFullyVisible(finalRoot,L10n.text(ctx,"Completed today")); assertFalse(text(finalRoot).contains(L10n.text(ctx,"Done")))
    }
  }
  @Test fun nextUsesTheNextUnfinishedStepAndFitsScaledAndLongContent() {
    val sample=previewSnapshot().copy(configuration=WidgetConfiguration("Routine","preview"))
    @Suppress("UNCHECKED_CAST") val steps=sample.session!!["steps"] as List<Map<String,Any?>>
    assertEquals("preview-side-plank",widgetNextExercise(sample)!!["id"])
    val skippedOver=sample.copy(session=sample.session + ("steps" to steps.map { if(it["id"] == "preview-side-plank")it + ("completed" to true) else it }))
    assertEquals("preview-intervals",widgetNextExercise(skippedOver)!!["id"])
    val last=sample.copy(session=sample.session + ("steps" to steps.take(2)))
    assertNull(widgetNextExercise(last))
    for(state in listOf("Rest","Skipped","Upcoming","Paused")) assertNull(widgetNextExercise(sample.copy(session=sample.session + ("state" to state))))
    assertNull(widgetNextExercise(sample.copy(session=sample.session + ("ended" to true))))
    assertNull(widgetNextExercise(sample.copy(session=sample.session + ("deleted" to true))))
    for(language in listOf("en","zh-Hans")) for(scale in listOf(1f,1.1f,1.2f,1.5f,2f)) {
      val ctx=context(language,scale)
      val width=WidgetSizing.minimumWidth(sample,scale); val height=WidgetSizing.previewHeight(ctx,sample,false,scale)
      val root=render(ctx,sample,width,height,"$language-next-scaled-${(scale*100).toInt()}")
      if(scale < 1.6f) {
        assertActionFullyVisible(root,L10n.text(ctx,"Done")); assertActionFullyVisible(root,nextLabel(ctx,"Side plank"))
      } else assertFalse(text(root).any { it.startsWith(nextLabel(ctx,"Side plank")) })
    }
    for(language in listOf("en","zh-Hans")) for(mode in listOf("Routine","Today")) {
      val ctx=context(language,1f); val name=if(language == "en")"Long exercise name ".repeat(15) else "很长的下一项练习名称".repeat(15)
      val long=sample.copy(configuration=WidgetConfiguration(mode,"preview"),session=sample.session +
        ("steps" to steps.map { if(it["id"] == "preview-side-plank")it + ("name" to name) else it }))
      val root=render(ctx,long,300,WidgetSizing.compactHeight(long),"$language-next-long-$mode")
      val label=nextLabel(ctx,name); val next=textViews(root).single { it.text.toString() == label }
      assertEquals(1,next.layout.lineCount); assertTrue(next.layout.getEllipsisCount(0) > 0)
      assertTrue(descriptions(root).contains(label)); assertActionFullyVisible(root,L10n.text(ctx,"Done"))
      if(mode == "Today") assertActionFullyVisible(root,L10n.text(ctx,"View Agenda (0)"))
    }
  }
  @Test fun progressHandlesZeroContinuousAndConfirmedFeedbackWithoutShiftingActions() {
    val ctx=context("en",1f)
    val sample=previewSnapshot().copy(configuration=WidgetConfiguration("Routine","preview"))
    val zero=render(ctx,sample.copy(session=sample.session!! + mapOf("totalCount" to 0,"completedCount" to 0,"state" to "Rest","steps" to emptyList<Any>())),300,200,"progress-zero")
    assertNull(zero.findViewById<View>(R.id.widget_progress_track)); assertFalse(text(zero).contains("0 of 0 done"))
    for(completed in listOf(0,4,13)) {
      val continuous=render(ctx,sample.copy(session=sample.session!! + mapOf("totalCount" to 13,"completedCount" to completed)),300,200,"progress-continuous-$completed")
      assertNull(continuous.findViewById<View>(R.id.widget_progress_track)); assertTrue(text(continuous).contains("$completed of 13 done"))
    }
    val pending=render(ctx,sample.copy(actionFeedback=WidgetActionFeedback(busy=true,saving=true)),300,200,"action-saving")
    assertTrue(text(pending).contains("Saving…"))
    val disabled=pending.findViewById<View>(R.id.widget_undo_disabled)
    assertFalse("Pending Undo must expose disabled state",disabled.isEnabled)
    assertFalse("Pending Undo must have no mutation listener",disabled.hasOnClickListeners())
    val confirmed=render(ctx,sample.copy(actionFeedback=WidgetActionFeedback(confirmation="Completed Bird-dog")),300,200,"action-confirmed")
    val ready=render(ctx,sample,300,200,"action-ready")
    assertTrue(descriptions(confirmed).contains("Completed Bird-dog"))
    val readyCount=textViews(ready).single { it.text.toString() == "1 of 4 done" }
    val confirmedCount=textViews(confirmed).single { it.text.toString() == "1 of 4 done" }
    assertEquals(readyCount.left,confirmedCount.left); assertEquals(readyCount.width,confirmedCount.width)
    assertActionFullyVisible(confirmed,"Done")
  }
  @OptIn(ExperimentalGlanceApi::class)
  @Test fun inertPreviewPreservesDirectCompletionProductionLabels() {
    val ctx=context("en",1f)
    val sample=previewSnapshot().copy(configuration=WidgetConfiguration("Routine","preview"))
    fun root(preview: Boolean): View {
      val remote=runBlocking { WidgetRender(sample,preview).compose(ctx,size=DpSize(300.dp,240.dp)) }
      return remote.apply(ctx,FrameLayout(ctx))
    }
    val production=root(false); val preview=root(true)
    assertEquals(text(production),text(preview))
    assertNoNavigationOrRefresh(production,ctx); assertNoNavigationOrRefresh(preview,ctx)
    fun clickable(view: View): List<View> = (if(view.hasOnClickListeners())listOf(view) else emptyList()) +
      if(view is ViewGroup) (0 until view.childCount).flatMap { clickable(view.getChildAt(it)) } else emptyList()
    assertTrue("Example controls must be inert",clickable(preview).isEmpty())
  }
  @Test fun staticPickerFallbackMatchesThePlainTitleWeekdayAndNextHierarchy() {
    for(language in listOf("en","zh-Hans")) {
      val ctx=context(language,1f); val parent=FrameLayout(ctx)
      val root=android.view.LayoutInflater.from(ctx).inflate(R.layout.remilo_widget_preview,parent,false)
      parent.addView(root)
      val density=ctx.resources.displayMetrics.density
      parent.measure(View.MeasureSpec.makeMeasureSpec((300*density).toInt(),View.MeasureSpec.EXACTLY),
        View.MeasureSpec.makeMeasureSpec((200*density).toInt(),View.MeasureSpec.EXACTLY))
      parent.layout(0,0,parent.measuredWidth,parent.measuredHeight)
      for(label in listOf("Monday","Read","Done")) assertActionFullyVisible(parent,L10n.text(ctx,label))
      assertActionFullyVisible(parent,L10n.text(ctx,"Next: ${L10n.text(ctx,"Plan the day")}"))
      assertFalse(text(parent).any { it.startsWith("2.") })
      val done=textViews(parent).single { it.text.toString() == L10n.text(ctx,"Done") }
      val next=textViews(parent).single { it.text.toString() == L10n.text(ctx,"Next: ${L10n.text(ctx,"Plan the day")}") }
      assertEquals(globalBounds(parent,done).bottom,globalBounds(parent,next).bottom)
    }
  }
  private fun assertActionFullyVisible(root: View, label: String) {
    val matches = textViews(root).filter { it.text.toString().equals(label, ignoreCase = true) }
    if(matches.isEmpty() && label.startsWith(L10n.text(root.context,"Undo"))) {
      val icon = descendants(root).firstOrNull { it.contentDescription?.toString() == label }
        ?: throw AssertionError("Missing accessible Undo control: $label / ${descriptions(root)}")
      val target = generateSequence(icon) { it.parent as? View }.firstOrNull { it.hasOnClickListeners() }
        ?: throw AssertionError("Undo has no action: $label")
      val density=root.resources.displayMetrics.density
      assertTrue(target.width >= 48*density); assertTrue(target.height >= 48*density)
      assertTrue(target.top >= 0 && target.bottom <= (target.parent as View).height)
      return
    }
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
  private fun descendants(view: View): List<View> = listOf(view) + if(view is ViewGroup)
    (0 until view.childCount).flatMap { descendants(view.getChildAt(it)) } else emptyList()

  @Test fun reminderTimeFitsItsRowAndPreviewAtRealTextScales() {
    val app=RuntimeEnvironment.getApplication() as Context
    val previous=android.provider.Settings.System.getString(app.contentResolver,android.provider.Settings.System.TIME_12_24)
    android.provider.Settings.System.putString(app.contentResolver,android.provider.Settings.System.TIME_12_24,"24")
    try {
      for(language in listOf("en","zh-Hans")) for(scale in listOf(1f,1.1f,1.2f,1.5f,2f)) for(width in listOf(300,360)) {
        val ctx=context(language,scale)
        val sample=WidgetSetup.example(ctx,"Today",WidgetSnapshot(-1,date="2026-10-17"))
        val height=WidgetSizing.previewHeight(ctx,sample,false,scale)
        val root=render(ctx,sample,width,height,"$language-today-time-$width-${(scale*100).toInt()}")
        if(scale < 1.6f) {
          assertActionFullyVisible(root,L10n.text(ctx,"Water plants"))
          assertActionFullyVisible(root,"09:00")
          assertActionFullyVisible(root,L10n.text(ctx,"View Agenda (1)"))
        } else assertFalse(text(root).contains("09:00")) // Intentional large-text summary.
      }
    } finally { android.provider.Settings.System.putString(app.contentResolver,android.provider.Settings.System.TIME_12_24,previous) }
  }

  @Test fun undoEnabledDisabledAndPreviewUseTheSameGlyphGeometryAndDistinctOpacity() {
    fun pixels(view: ImageView): Pair<Rect,Int> {
      val bitmap=Bitmap.createBitmap(view.width,view.height,Bitmap.Config.ARGB_8888); view.draw(Canvas(bitmap))
      val bounds=Rect(view.width,view.height,0,0); var alpha=0
      for(y in 0 until view.height)for(x in 0 until view.width) {
        val value=android.graphics.Color.alpha(bitmap.getPixel(x,y)); alpha=maxOf(alpha,value)
        if(value > 0) { bounds.left=minOf(bounds.left,x);bounds.top=minOf(bounds.top,y);bounds.right=maxOf(bounds.right,x+1);bounds.bottom=maxOf(bounds.bottom,y+1) }
      }
      bitmap.recycle(); return bounds to alpha
    }
    for(scene in listOf("sunrise","sky","evening","night"))for(brightness in listOf("light","dark"))for(scale in listOf(1f,1.5f)) {
      val ctx=context("en",scale); val roles=AtmosphereTokens.colors(scene,brightness)
      val sample=previewSnapshot().copy(configuration=WidgetConfiguration("Routine","preview"),appearance=AppearancePolicy.Resolved(scene,brightness))
      val width=WidgetSizing.minimumWidth(sample,scale); val height=if(scale > 1.2f)440 else 200
      val disabledRoot=render(ctx,sample,width,height,"undo-$scene-$brightness-${(scale*100).toInt()}-disabled")
      val enabledRoot=render(ctx,sample.copy(undoToken="undo",undoName="Bird-dog"),width,height,"undo-$scene-$brightness-${(scale*100).toInt()}-enabled")
      val previewRoot=render(ctx,sample.copy(undoToken="undo",undoName="Bird-dog"),width,height,"undo-$scene-$brightness-${(scale*100).toInt()}-preview",preview=true)
      val disabled=disabledRoot.findViewById<ImageView>(R.id.widget_undo_disabled)
      val node=descendants(enabledRoot).first { it.contentDescription?.toString() == "Undo completion of Bird-dog" }
      val enabled=descendants(node).filterIsInstance<ImageView>().first()
      val (a,enabledAlpha)=pixels(enabled); val (b,disabledAlpha)=pixels(disabled)
      assertEquals(255,enabledAlpha); assertEquals(97,disabledAlpha)
      assertTrue("Undo width changed between states: $a / $b",kotlin.math.abs(a.width()-b.width()) <= 1)
      assertTrue("Undo height changed between states: $a / $b",kotlin.math.abs(a.height()-b.height()) <= 1)
      assertEquals(enabled.drawable.intrinsicWidth,disabled.drawable.intrinsicWidth)
      val enabledBounds=Rect(a).also { (enabledRoot as ViewGroup).offsetDescendantRectToMyCoords(enabled,it) }
      val disabledBounds=Rect(b).also { (disabledRoot as ViewGroup).offsetDescendantRectToMyCoords(disabled,it) }
      assertTrue(kotlin.math.abs(enabledBounds.centerX()-disabledBounds.centerX()) <= 1)
      assertTrue(kotlin.math.abs(enabledBounds.centerY()-disabledBounds.centerY()) <= 1)
      val (previewBounds,previewAlpha)=pixels(previewRoot.findViewById(R.id.widget_undo_disabled))
      assertEquals(b.width(),previewBounds.width()); assertEquals(b.height(),previewBounds.height()); assertEquals(255,previewAlpha)
      assertFalse(disabled.isEnabled); assertFalse(disabled.hasOnClickListeners())
      assertActionFullyVisible(enabledRoot,"Undo completion of Bird-dog")
      val faded=androidx.core.graphics.ColorUtils.compositeColors(androidx.core.graphics.ColorUtils.setAlphaComponent(roles.onSurfaceVariant.toInt(),97),roles.surface.toInt())
      val distinction=androidx.core.graphics.ColorUtils.calculateContrast(roles.onSurfaceVariant.toInt(),faded)
      assertTrue("Enabled/disabled Undo distinction in $scene-$brightness: $distinction",distinction >= 2)
      assertTrue(androidx.core.graphics.ColorUtils.calculateContrast(roles.onSurfaceVariant.toInt(),roles.surface.toInt()) >= 3)
    }
  }

  @Test fun everyProgressSegmentSurvivesAndUsesTheAppColorsAcrossAllEightPairs() {
    for(scene in listOf("sunrise","sky","evening","night")) for(brightness in listOf("light","dark")) {
      val roles=AtmosphereTokens.colors(scene,brightness)
      fun luminance(color: Long): Double {
        fun channel(shift: Int): Double { val s=((color shr shift) and 255)/255.0; return if(s <= 0.04045)s/12.92 else Math.pow((s+0.055)/1.055,2.4) }
        return 0.2126*channel(16)+0.7152*channel(8)+0.0722*channel(0)
      }
      val a=luminance(roles.primary); val b=luminance(roles.container)
      assertTrue("$scene-$brightness progress contrast",(maxOf(a,b)+0.05)/(minOf(a,b)+0.05) >= 3)
      for(total in listOf(1,4,6,7,10,11,12)) {
        val completed=minOf(4,total)
        val sample=previewSnapshot().copy(configuration=WidgetConfiguration("Routine","preview"),appearance=AppearancePolicy.Resolved(scene,brightness),
          session=previewSnapshot().session!! + mapOf("totalCount" to total,"completedCount" to completed,"steps" to (0 until total).map {
            mapOf("id" to "step-$it","name" to "Same name","target" to "3 × 10","completed" to (it < completed)) }))
        val root=render(context("en",1f),sample,300,200,"segments-$scene-$brightness-$total")
        val track=root.findViewById<LinearLayout>(R.id.widget_progress_track)
        assertNotNull("Missing track for $total",track); assertEquals(total,track.childCount)
        repeat(total) { index ->
          val segment=track.getChildAt(index) as ImageView
          assertTrue(segment.width > 0)
          assertTrue(kotlin.math.abs(segment.width-track.getChildAt(0).width) <= 1)
          val pixels=Bitmap.createBitmap(segment.width,segment.height,Bitmap.Config.ARGB_8888)
          segment.draw(Canvas(pixels))
          assertEquals((if(index < completed)roles.primary else roles.container).toInt(),pixels.getPixel(segment.width/2,segment.height/2))
          pixels.recycle()
          val margin=(segment.layoutParams as LinearLayout.LayoutParams).marginEnd
          assertEquals(if(index == total-1)0 else (2*root.resources.displayMetrics.density).toInt(),margin)
        }
        assertTrue(text(root).contains("$completed of $total done"))
      }
    }
  }
  @Test fun undoAndUncertainRetryRemainVisibleWithGuardedCompletion() {
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
        val root = render(ctx, sample, WidgetSizing.minimumWidth(sample,scale), height, "$language-actions-$height-${(scale * 100).toInt()}-$mode")
        assertFalse(text(root).contains(L10n.text(ctx,"Refresh")))
        if (mode == "retry") assertActionFullyVisible(root,L10n.text(ctx,"Retry"))
        else assertFalse(text(root).contains(L10n.text(ctx,"Retry")))
        if(mode != "retry") assertActionFullyVisible(root, L10n.text(ctx, "Done"))
        else assertFalse(text(root).contains(L10n.text(ctx,"Done")))
        if(mode != "retry") assertActionFullyVisible(root, L10n.text(ctx, "Undo completion of Bird-dog"))
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
    val privateData=empty.copy(locked=true,configuration=WidgetConfiguration("Routine","real-id"),session=mapOf("title" to "Private title","state" to "Rest"),
      reminders=listOf(mapOf("title" to "Private reminder")),total=1)
    for(language in listOf("en","zh-Hans")) for(mode in listOf("Today","Routine")) {
      val ctx=context(language,1f)
      val sample=WidgetSetup.example(ctx,mode,privateData)
      assertEquals("2026-10-16",sample.date)
      val root=render(ctx,sample,300,240,"$language-setup-example-$mode")
      assertFalse(text(root).any { it.contains("Private") })
      assertTrue(text(root).contains(L10n.text(ctx,if(mode == "Today") "Water plants" else "Morning routine")))
      if(mode == "Today") assertActionFullyVisible(root,L10n.text(ctx,"View Agenda (1)"))
      else { assertActionFullyVisible(root,L10n.text(ctx,"Done")); assertNoNavigationOrRefresh(root,ctx) }
    }
  }
  @Test fun narrowSetupPreviewPreservesAnExampleAndOnlyShowsActionsWhenTheyFit() {
    for(language in listOf("en","zh-Hans")) for(width in listOf(260,280,300)) for(scale in listOf(1f,1.1f,1.2f,1.5f)) {
      val ctx=context(language,scale)
      val sample=WidgetSetup.example(ctx,"Routine",WidgetSnapshot(-1,date="2026-10-17"))
      val root=render(ctx,sample,width,WidgetSizing.previewHeight(ctx,sample,false,scale),"$language-setup-$width-${(scale*100).toInt()}")
      if(width >= WidgetSizing.minimumWidth(sample,scale)) {
        assertTrue(text(root).contains(L10n.text(ctx,"Read")))
        assertActionFullyVisible(root,L10n.text(ctx,"Done"))
      } else {
        assertTrue(text(root).contains(L10n.text(ctx,"Morning routine")))
        assertFalse(text(root).contains(L10n.text(ctx,"Done")))
      }
    }
  }
  @Test fun genericExamplesAndExercisePresetUseProductionLayoutAcrossAppearancesAndScaling() {
    for(scene in listOf("sunrise","sky","evening","night")) for(brightness in listOf("light","dark"))
      for(language in listOf("en","zh-Hans")) for(scale in listOf(1f,2f)) {
        val ctx=context(language,scale)
        val base=WidgetSnapshot(-1,date="2026-10-17",appearance=AppearancePolicy.Resolved(scene,brightness))
        val sample=WidgetSetup.example(ctx,"Routine",base)
        val root=render(ctx,sample,300,if(scale == 1f)240 else 440,"$scene-$brightness-$language-generic-${(scale*100).toInt()}")
        assertTrue(text(root).contains(L10n.text(ctx,"Morning routine")))
        assertEquals("General",sample.session!!["presentationPreset"])
        if(scale == 1f) { assertActionFullyVisible(root,L10n.text(ctx,"Read")); assertActionFullyVisible(root,L10n.text(ctx,"Done")) }
        else assertFalse(text(root).contains(L10n.text(ctx,"Done")))
      }
    val ctx=context("en",1f)
    val exercise=WidgetSetup.example(ctx,"Routine",WidgetSnapshot(-1,date="2026-10-17"),preset="Exercise")
    val root=render(ctx,exercise,300,240,"exercise-preset-example")
    assertTrue(text(root).contains("Core & intervals")); assertActionFullyVisible(root,"Front plank")
  }
  @OptIn(ExperimentalGlanceApi::class)
  @Test fun launcherPreviewUsesThemedExampleWithInteractiveContentEvenAtMinimumProviderSize() {
    for(language in listOf("en","zh-Hans")) {
      val ctx=context(language,1f)
      val base=WidgetSnapshot(-1,locked=true,appearance=AppearancePolicy.Resolved("night","dark"),
        session=mapOf("title" to "Private routine","state" to "Rest"))
      val widget=RemiloWidget(previewBase={ base })
      val remote=runBlocking { widget.composeForPreview(ctx,android.appwidget.AppWidgetProviderInfo.WIDGET_CATEGORY_HOME_SCREEN,
        android.appwidget.AppWidgetProviderInfo().apply { minWidth=180; minHeight=110 }) }
      val root=remote.apply(ctx,FrameLayout(ctx))
      assertTrue(text(root).contains(L10n.text(ctx,"Read")))
      assertTrue(text(root).contains(L10n.text(ctx,"Done")))
      assertFalse(text(root).contains("Private routine")); assertFalse(text(root).contains(L10n.text(ctx,"Rest day")))
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
      for(action in listOf("View Agenda (73)","Done")) assertActionFullyVisible(focus,L10n.text(ctx,action))
      assertNoNavigationOrRefresh(focus,ctx)
      val after=render(ctx,previewSnapshot().copy(reminders=reminders,total=73,undoToken="undo",undoName="Bird-dog"),width,240,"$language-today-after-completion-$width")
      for(action in listOf("View Agenda (73)","Done","Undo completion of Bird-dog")) assertActionFullyVisible(after,L10n.text(ctx,action))
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
        assertTrue("Compact $language $mode minimum height ${WidgetSizing.minimumHeight(ctx,sample,1f)} exceeds its reference footprint",
          WidgetSizing.minimumHeight(ctx,sample,1f) <= WidgetSizing.compactHeight(sample))
        val root=render(ctx,sample,300,WidgetSizing.compactHeight(sample),"$language-$scene-$brightness-$mode-compact")
        assertActionFullyVisible(root,L10n.text(ctx,"Done"))
        if(mode == "Today") assertActionFullyVisible(root,L10n.text(ctx,"View Agenda (0)"))
        assertNoNavigationOrRefresh(root,ctx)
        assertActionFullyVisible(root,nextLabel(ctx,"Side plank"))
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
      assertActionFullyVisible(clean,L10n.text(ctx,"Done")); assertNoNavigationOrRefresh(clean,ctx)
      val failed=render(ctx,WidgetSnapshot(1,failed=true,notice="Could not load the widget. Refresh to try again."),300,200,"$language-recovery-error")
      assertActionFullyVisible(failed,L10n.text(ctx,"Refresh"))
      val conflict=render(ctx,sample.copy(notice="This view changed. Review the refreshed routine."),300,240,"$language-recovery-conflict")
      assertActionFullyVisible(conflict,L10n.text(ctx,"Refresh")); assertActionFullyVisible(conflict,L10n.text(ctx,"Done"))
      val empty=render(ctx,WidgetSnapshot(1,date="2026-10-16"),300,200,"$language-empty-compact")
      assertActionFullyVisible(empty,L10n.text(ctx,"View Agenda (0)")); assertNoNavigationOrRefresh(empty,ctx)
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
  @Test fun undoInterruptedBeforeNativeCaptureRetriesItsExactTargetAndPreservesEarlierHistory() {
    val ctx = RuntimeEnvironment.getApplication() as Context
    shadowOf(ctx.getSystemService(android.os.UserManager::class.java)).setUserUnlocked(true)
    val prefs = ctx.getSharedPreferences("remilo-widgets-v1",Context.MODE_PRIVATE)
    prefs.edit().clear().commit()
    val at = Instant.parse("2026-10-12T12:00:00Z").toEpochMilli()
    val date = Instant.ofEpochMilli(at).atZone(ZoneId.systemDefault()).toLocalDate().toString()
    var revision = 1L; var interrupt = false
    val completed = mutableSetOf<String>()
    val changes = mutableListOf<Map<String,Any?>>()
    val receipts = mutableSetOf<String>()
    fun coordinator() = WidgetCoordinator(ctx,{at},{AppearancePolicy.Resolved("sky","light")},{
      mapOf("date" to date,"occurrenceId" to "occurrence","revision" to revision,"ended" to false,"changes" to changes.toList(),
        "steps" to listOf("first","second").map { mapOf("id" to it,"name" to it,"completed" to (it in completed)) })
    },{emptyMap()},{true},{ input ->
      if(interrupt) { interrupt = false; throw IllegalStateException("Storage unavailable before native capture") }
      val operation = input["operationId"] as String
      if(operation !in receipts) {
        check(input["expectedRevision"] == revision)
        val step = input["stepId"] as String
        if(input["completed"] == true)completed.add(step) else completed.remove(step)
        changes.add(mapOf("id" to operation,"stepId" to step,"completed" to input["completed"]))
        revision++; receipts.add(operation)
      }
      mapOf("status" to "Applied")
    },{it in receipts})
    var owner = coordinator(); owner.configure(702,"Routine","plan",0)
    repeat(2) { owner.act(702,owner.snapshot(702).doneToken!!) }
    val undo = owner.snapshot(702).undoToken!!
    interrupt = true
    try { owner.act(702,undo); fail("Expected interruption") } catch (_: IllegalStateException) { }
    owner = coordinator() // Process-only owners can be recreated before the same exact Retry.
    owner.acknowledgeRefresh(702)
    val pending = owner.snapshot(702)
    assertEquals(undo,pending.retryToken); assertNull(pending.doneToken); assertNull(pending.undoToken)
    assertTrue(pending.retryIsUndo); assertEquals("second",pending.retryName)
    assertEquals(setOf("first","second"),completed)
    assertEquals("Applied",owner.act(702,undo)["status"])
    assertEquals("first",owner.snapshot(702).undoName)
    assertEquals("Applied",owner.act(702,undo)["status"]); assertEquals(setOf("first"),completed)
    owner.act(702,owner.snapshot(702).undoToken!!)
    assertTrue(completed.isEmpty()); assertNull(owner.snapshot(702).undoToken)
    prefs.edit().clear().commit()
  }
}

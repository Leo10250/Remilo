package com.remilo.alarm.presentation

import android.content.Context
import android.view.View
import android.view.ViewGroup
import android.view.ViewTreeObserver
import android.view.WindowManager
import android.widget.EditText
import android.widget.ScrollView
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView

/** UI-only observer. It has no engine, persistence, text payload or inset ownership. */
class FormGeometryModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("RemiloFormGeometry")
    View(FormGeometryView::class) { Events("onGeometry") }
  }
}

class FormGeometryView(context: Context, appContext: AppContext) : ExpoView(context, appContext), ViewTreeObserver.OnPreDrawListener {
  private val onGeometry by EventDispatcher()
  private var last: Map<String, Any>? = null
  private var previousField = 0
  private var previousStart = -1
  private var previousEnd = -1
  private var startIsActive = false
  private var revealSignature: FormGeometryPolicy.CaretSignature? = null
  private fun scrollWithin(view: View): ScrollView? {
    if (!view.isShown) return null
    if (view is ScrollView) return view
    if (view is ViewGroup) for (i in 0 until view.childCount) scrollWithin(view.getChildAt(i))?.let { return it }
    return null
  }
  override fun onAttachedToWindow() { super.onAttachedToWindow(); viewTreeObserver.addOnPreDrawListener(this) }
  override fun onDetachedFromWindow() {
    if (viewTreeObserver.isAlive) viewTreeObserver.removeOnPreDrawListener(this)
    last = null; revealSignature = null; super.onDetachedFromWindow()
  }
  override fun onPreDraw(): Boolean {
    if (!isShown || !hasWindowFocus() || width == 0 || height == 0) return true
    val root = rootView
    val insets = ViewCompat.getRootWindowInsets(this) ?: return true
    val imeVisible = insets.isVisible(WindowInsetsCompat.Type.ime())
    val location = IntArray(2); getLocationOnScreen(location)
    val density = resources.displayMetrics.density
    // Window metrics are not reduced by adjustResize. Subtracting from root.height
    // would count the keyboard twice in an already-resized Activity or Dialog.
    val windowBottom = context.getSystemService(WindowManager::class.java).currentWindowMetrics.bounds.bottom
    val overlapPx = FormGeometryPolicy.residualImeOverlap(imeVisible, windowBottom,
      insets.getInsets(WindowInsetsCompat.Type.ime()).bottom, location[1], height)
    val overlap = overlapPx / density
    val input = root.findFocus() as? EditText
    val data = mutableMapOf<String, Any>("imeVisible" to imeVisible, "overlap" to overlap,
      "field" to (input?.id ?: 0), "hasCaret" to false, "caretTop" to 0f, "caretBottom" to 0f,
      "hasViewport" to false, "viewportTop" to 0f, "viewportHeight" to 0f,
      "viewportScrollY" to 0f, "shouldReveal" to false)
    var scrollTopPx = 0
    var scrollOffsetPx = 0
    var scrollHeightPx = 0
    // Both caret and viewport use screen coordinates; RN window measurements can
    // have a different origin in inset/dialog windows. No text leaves this view.
    (parent as? View)?.let(::scrollWithin)?.let { scroll ->
      val point = IntArray(2); scroll.getLocationOnScreen(point)
      data["hasViewport"] = true; data["viewportTop"] = point[1] / density
      data["viewportHeight"] = scroll.height / density
      scrollTopPx = point[1]; scrollOffsetPx = scroll.scrollY; scrollHeightPx = scroll.height
      data["viewportScrollY"] = scroll.scrollY / density
    }
    if (input != null && input.layout != null && input.selectionEnd >= 0) {
      val position = IntArray(2); input.getLocationOnScreen(position)
      val layout = input.layout
      if (input.id != previousField || input.selectionEnd != previousEnd) startIsActive = false
      else if (input.selectionStart != previousStart) startIsActive = true
      val endpoint = if (startIsActive) input.selectionStart else input.selectionEnd
      val line = layout.getLineForOffset(endpoint.coerceIn(0, input.length()))
      val origin = position[1] + input.compoundPaddingTop - input.scrollY
      data["hasCaret"] = true
      data["caretTop"] = (origin + layout.getLineTop(line)) / density
      data["caretBottom"] = (origin + layout.getLineBottom(line)) / density
      // Parent scrolling changes screen coordinates but not the logical caret.
      // Keep fresh rectangles without pulling a deliberate scroll back to focus.
      val signature = FormGeometryPolicy.caretSignature(input.id, input.selectionStart, input.selectionEnd,
        origin + layout.getLineTop(line), origin + layout.getLineBottom(line), input.scrollY,
        scrollTopPx, scrollHeightPx, scrollOffsetPx, imeVisible, overlapPx)
      data["shouldReveal"] = revealSignature != signature
      revealSignature = signature
      previousField = input.id; previousStart = input.selectionStart; previousEnd = input.selectionEnd
    } else revealSignature = null
    if (last != data) { last = data.toMap(); onGeometry(data) }
    return true
  }
}

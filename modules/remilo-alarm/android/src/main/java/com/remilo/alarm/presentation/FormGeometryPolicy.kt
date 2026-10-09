package com.remilo.alarm.presentation

/** Pure viewport math. No field content, platform handles, persistence or inset mutation. */
internal object FormGeometryPolicy {
  fun residualImeOverlap(imeVisible: Boolean, windowBottom: Int, imeBottomInset: Int, surfaceTop: Int, surfaceHeight: Int): Int =
    if (imeVisible) (surfaceTop + surfaceHeight - (windowBottom - imeBottomInset)).coerceAtLeast(0) else 0

  data class CaretSignature(val field: Int, val selectionStart: Int, val selectionEnd: Int,
    val contentTop: Int, val contentBottom: Int, val fieldScroll: Int, val viewportTop: Int,
    val viewportHeight: Int, val imeVisible: Boolean, val overlap: Int)

  fun caretSignature(field: Int, selectionStart: Int, selectionEnd: Int, caretTop: Int, caretBottom: Int,
    fieldScroll: Int, viewportTop: Int, viewportHeight: Int, viewportScroll: Int, imeVisible: Boolean, overlap: Int) =
    CaretSignature(field, selectionStart, selectionEnd, caretTop - viewportTop + viewportScroll,
      caretBottom - viewportTop + viewportScroll, fieldScroll, viewportTop, viewportHeight, imeVisible, overlap)
}

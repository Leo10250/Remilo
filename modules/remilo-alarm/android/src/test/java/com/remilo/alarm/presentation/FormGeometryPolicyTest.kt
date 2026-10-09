package com.remilo.alarm.presentation

import org.junit.Assert.*
import org.junit.Test

class FormGeometryPolicyTest {
  @Test fun residualCompensationCountsOnlyTheOverlapLeftAfterActualResize() {
    assertEquals(0, FormGeometryPolicy.residualImeOverlap(true, 1000, 400, 100, 500))
    assertEquals(80, FormGeometryPolicy.residualImeOverlap(true, 1000, 400, 100, 580))
    assertEquals(400, FormGeometryPolicy.residualImeOverlap(true, 1000, 400, 100, 900))
    assertEquals(0, FormGeometryPolicy.residualImeOverlap(false, 1000, 400, 100, 900))
    assertEquals(0, FormGeometryPolicy.residualImeOverlap(true, 1000, 400, 100, 450))
  }
  private fun signature(top: Int = 460, bottom: Int = 488, offset: Int = 100, viewportTop: Int = 100,
    height: Int = 400, end: Int = 80, field: Int = 42, fieldScroll: Int = 0, overlap: Int = 0) =
    FormGeometryPolicy.caretSignature(field, 80, end, top, bottom, fieldScroll, viewportTop, height, offset, true, overlap)

  @Test fun parentScrollKeepsLogicalCaretIdentityWithoutPullingTheUserBackToFocus() {
    assertEquals(signature(), signature(top = 380, bottom = 408, offset = 180))
    assertEquals(signature(), signature(top = 540, bottom = 568, offset = 20))
  }
  @Test fun realCaretAndViewportChangesRequestAnotherReveal() {
    val before = signature()
    assertNotEquals(before, signature(top = 490, bottom = 518))
    assertNotEquals(before, signature(end = 81))
    assertNotEquals(before, signature(field = 43))
    assertNotEquals(before, signature(fieldScroll = 20))
    assertNotEquals(before, signature(viewportTop = 110))
    assertNotEquals(before, signature(height = 300))
    assertNotEquals(before, signature(overlap = 100))
  }
}

package com.remilo.alarm.system

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.focusGroup
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.focusRestorer
import androidx.compose.ui.focus.focusProperties
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.isTraversalGroup
import androidx.compose.ui.semantics.paneTitle
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.remilo.alarm.presentation.AtmosphereTokens

/** The alarm and its chooser share the one Activity window that is eligible above keyguard. */
@Composable
internal fun AlarmModalFrame(modalOpen: Boolean, content: @Composable () -> Unit, modal: @Composable () -> Unit) {
  val backgroundFocus = remember { FocusRequester() }
  var previousOpen by remember { mutableStateOf(modalOpen) }
  LaunchedEffect(modalOpen) {
    if (previousOpen && !modalOpen) runCatching { backgroundFocus.requestFocus() }
    previousOpen = modalOpen
  }
  Box(Modifier.fillMaxSize()) {
    Box(Modifier.fillMaxSize().focusRequester(backgroundFocus).focusProperties {
      // Unlike canFocus=false on a group, cancelling entry also fences its descendants.
      if (modalOpen) onEnter = { cancelFocusChange() }
    }.focusRestorer().focusGroup()
      .then(if (modalOpen) Modifier.clearAndSetSemantics {} else Modifier)) { content() }
    if (modalOpen) modal()
  }
}

/** A modal interaction built in-window; never creates a Dialog or another Activity. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun AlarmPostponeSheet(
  canDismiss: Boolean, custom: Boolean, title: String, roles: AtmosphereTokens.Roles,
  onClose: () -> Unit, onBackChoices: () -> Unit, content: @Composable ColumnScope.() -> Unit
) {
  val currentDismiss = rememberUpdatedState(canDismiss)
  val currentCustom = rememberUpdatedState(custom)
  val close = rememberUpdatedState(onClose)
  val back = rememberUpdatedState(onBackChoices)
  val confirmHide = remember { { value: SheetValue -> value == SheetValue.Expanded || currentDismiss.value } }
  val sheet = rememberStandardBottomSheetState(initialValue = SheetValue.Expanded, skipHiddenState = false,
    confirmValueChange = confirmHide)
  val scaffold = rememberBottomSheetScaffoldState(bottomSheetState = sheet)
  fun dismiss() { if (canDismiss) { if (custom) onBackChoices() else onClose() } }
  BackHandler { dismiss() }
  LaunchedEffect(sheet.currentValue) {
    // With zero peek, PartiallyExpanded is offscreen too; it is dismissal, never a
    // retained invisible modal. Both collapsed targets are fenced during unknown actions.
    if (sheet.currentValue != SheetValue.Expanded && currentDismiss.value) {
      if (currentCustom.value) { back.value(); sheet.expand() } else close.value()
    }
  }
  BottomSheetScaffold(scaffoldState = scaffold, sheetPeekHeight = 0.dp, sheetSwipeEnabled = canDismiss,
    sheetContainerColor = Color(roles.surface), sheetContentColor = Color(roles.onSurface),
    sheetShape = RoundedCornerShape(topStart = AtmosphereTokens.shapeSheet.dp, topEnd = AtmosphereTokens.shapeSheet.dp),
    sheetTonalElevation = 0.dp, containerColor = Color.Transparent,
    modifier = Modifier.fillMaxSize().safeDrawingPadding().focusGroup().semantics { paneTitle = title; isTraversalGroup = true },
    sheetContent = content) {
    Box(Modifier.fillMaxSize().background(Color.Black.copy(alpha = .32f)).pointerInput(canDismiss, custom) {
      detectTapGestures(onTap = { dismiss() })
    }.clearAndSetSemantics {})
  }
}

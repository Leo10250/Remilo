import { useEffect, useRef, useSyncExternalStore, type Ref } from 'react';
import { AccessibilityInfo, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocale, useTranslation } from '../localization/react';
import { Button, Copy } from './components';
import { confirmations, type ConfirmationContent } from './confirmation-state';
import { useReducedMotion } from './motion';
import { PresentationProvider, useAppearanceHold, useFoundationStyle, useFontScaleOverride, useTheme } from './theme';
import { chineseTextMetrics, fontWeightFor, lineHeightFor, shape, space, typography } from './tokens';

/** Shared content is also rendered by the isolated fixture; every control is a production Button. */
export function ConfirmationCard({ content, onChoose, headingRef }: {
  content: ConfirmationContent; onChoose: (index: number) => void; headingRef?: Ref<Text>;
}) {
  'use no memo';
  useLocale();
  const colors = useTheme(), scale = useFontScaleOverride();
  // Match the existing destructive-sheet order without changing callback identities.
  const ordered = content.buttons.map((button, index) => ({ button, index })).sort((a, b) => Number(a.button.style === 'cancel') - Number(b.button.style === 'cancel'));
  return <View accessibilityViewIsModal style={{ width: '100%', maxWidth: 344, flexShrink: 1,
    borderRadius: shape.sheet, backgroundColor: colors.surface, overflow: 'hidden' }}>
    <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ padding: space.lg, gap: space.md }} keyboardShouldPersistTaps="handled" bounces={false}>
      <Text ref={headingRef} accessible accessibilityRole="header" style={{ color: colors.ink, fontSize: typography.appBar * scale,
        lineHeight: lineHeightFor(typography.appBar, 1.3) * scale, fontWeight: fontWeightFor(typography.appBar, '600'),
        ...chineseTextMetrics(typography.appBar, scale, '600') }}>{content.title}</Text>
      {!!content.message && <Copy muted>{content.message}</Copy>}
      <View style={{ gap: space.sm, marginTop: space.md }}>{ordered.map(({ button, index }) => <Button key={index} label={button.text ?? ''}
        variant={button.style === 'destructive' ? 'danger' : button.style === 'cancel' ? 'outlined' : 'primary'} onPress={() => onChoose(index)} />)}</View>
    </ScrollView>
  </View>;
}

export function ConfirmationHost() {
  'use no memo';
  useLocale();
  const t = useTranslation(), entry = useSyncExternalStore(confirmations.subscribe, confirmations.getSnapshot, confirmations.getSnapshot);
  const inherited = useTheme(), foundation = useFoundationStyle(), colors = foundation?.colors ?? inherited;
  const reduced = useReducedMotion(), insets = useSafeAreaInsets(), heading = useRef<Text>(null);
  useAppearanceHold(!!entry);
  useEffect(() => {
    if (entry) return;
    const restore = confirmations.restoreTarget();
    if (!restore?.target) return;
    // Modal removal is committed before returning keyboard/TalkBack focus. A newer
    // confirmation invalidates this callback even if it opened and closed in one frame.
    let second: number | undefined;
    const first = requestAnimationFrame(() => { second = requestAnimationFrame(() => {
      const target = restore.target;
      if (!confirmations.canRestore(restore.id) || !target || target.isConnected === false) return;
      target.focus();
      if (Platform.OS === 'android') AccessibilityInfo.sendAccessibilityEvent(target as View, 'focus');
    }); });
    return () => { cancelAnimationFrame(first); if (second != null) cancelAnimationFrame(second); };
  }, [entry]);
  if (!entry) return null;
  const content = confirmations.content(entry), dismiss = () => confirmations.dismiss(entry.id), cancelable = content.options?.cancelable !== false;
  return <PresentationProvider colors={colors}><Modal transparent visible animationType={reduced ? 'none' : 'fade'} onRequestClose={dismiss}
    onShow={() => { if (Platform.OS === 'android' && heading.current) AccessibilityInfo.sendAccessibilityEvent(heading.current, 'focus'); }}>
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: space.gutter,
      paddingTop: Math.max(insets.top, space.gutter), paddingBottom: Math.max(insets.bottom, space.gutter) }}>
      <Pressable disabled={!cancelable} accessible={false} importantForAccessibility="no" onPress={dismiss}
        accessibilityLabel={t('m_48845bff334a')} style={[StyleSheet.absoluteFill, { backgroundColor: '#00000066' }]} />
      <ConfirmationCard content={content} headingRef={heading} onChoose={index => confirmations.choose(entry.id, index)} />
    </View>
  </Modal></PresentationProvider>;
}

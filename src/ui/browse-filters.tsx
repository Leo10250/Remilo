import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { ListRecord } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { resetBrowseFilters, type BrowseFilterChip, type BrowseFilterField, type BrowseFilters, type BrowseKind } from '../domain/browse-filters';
import { Button, Choice, ConnectedGroup, Copy, Icon, QueryState, Sheet } from './components';
import { useFontScaleOverride, useFoundationStyle, useTheme } from './theme';

export function BrowseFilterButton({ count, onPress, disabled = false, expanded = false }: { count: number; onPress: () => void; disabled?: boolean; expanded?: boolean }) {
  const colors = useTheme(), scale = useFontScaleOverride(), [focused, setFocused] = useState(false);
  return <Pressable accessibilityRole="button" accessibilityLabel={'Filters' + (count ? ', ' + count + ' active' : '')} accessibilityState={{ disabled, expanded }} disabled={disabled}
    onPress={onPress} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
    style={({ pressed }) => ({ minHeight: 48, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center',
      borderRadius: 24, borderWidth: 2, borderColor: focused ? colors.accent : count ? colors.border : 'transparent', backgroundColor: pressed || count ? colors.soft : 'transparent', opacity: disabled ? 0.5 : 1 })}>
    <Icon name="filter_list" size={18} /><Text style={{ color: colors.ink, fontSize: 14 * scale, lineHeight: 14 * scale * 1.4, flexShrink: 1 }}>{'Filters' + (count ? ' · ' + count : '')}</Text>
  </Pressable>;
}
function RemovableFilter({ chip, onRemove, disabled }: { chip: BrowseFilterChip; onRemove: (field: BrowseFilterField) => void; disabled: boolean }) {
  const colors = useTheme(), scale = useFontScaleOverride(), [focused, setFocused] = useState(false);
  return <Pressable accessibilityRole="button" accessibilityLabel={'Remove filter: ' + chip.label} accessibilityState={{ disabled }} disabled={disabled}
    onPress={() => onRemove(chip.field)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
    style={({ pressed }) => ({ maxWidth: '100%', minHeight: 48, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 24,
      borderWidth: 2, borderColor: focused ? colors.accent : 'transparent', backgroundColor: pressed ? colors.surface : colors.soft, opacity: disabled ? 0.5 : 1 })}>
    <Text style={{ flexShrink: 1, color: colors.ink, fontSize: 14 * scale, lineHeight: 14 * scale * 1.4 }}>{chip.label}</Text><Icon name="close" size={18} />
  </Pressable>;
}
export function BrowseFilterChips({ chips, onRemove, onReset, disabled = false }: { chips: readonly BrowseFilterChip[]; onRemove: (field: BrowseFilterField) => void; onReset: () => void; disabled?: boolean }) {
  if (!chips.length) return null;
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
    {chips.map(chip => <RemovableFilter key={chip.field} chip={chip} onRemove={onRemove} disabled={disabled} />)}
    <ResetFiltersAction disabled={disabled} onPress={onReset} />
  </View>;
}
function ResetFiltersAction({ disabled, onPress }: { disabled: boolean; onPress: () => void }) {
  const colors = useTheme(), [focused, setFocused] = useState(false);
  return <Pressable accessibilityRole="button" accessibilityLabel="Reset all filters" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} style={({ pressed }) => ({ minHeight: 48, paddingHorizontal: 12, paddingVertical: 8,
      borderRadius: 24, borderWidth: 2, borderColor: focused ? colors.accent : 'transparent', backgroundColor: pressed ? colors.soft : 'transparent',
      justifyContent: 'center', opacity: disabled ? 0.5 : 1 })}><Copy muted size={14}>Reset filters</Copy></Pressable>;
}
function FilterCheckbox({ label, description, checked, onChange, disabled }: { label: string; description?: string; checked: boolean; onChange: () => void; disabled: boolean }) {
  const colors = useTheme(), foundation = useFoundationStyle(), [focused, setFocused] = useState(false);
  const ink = disabled ? foundation?.colors.disabledInk ?? colors.muted : colors.ink;
  return <Pressable accessibilityRole="checkbox" accessibilityLabel={[label, description].filter(Boolean).join('. ')} accessibilityState={{ checked, disabled }} aria-checked={checked}
    disabled={disabled} onPress={onChange} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
    style={({ pressed }) => ({ minHeight: 56, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 2, borderColor: focused ? colors.accent : 'transparent',
      borderRadius: 16, backgroundColor: disabled ? foundation?.colors.disabledSurface ?? colors.surface : pressed ? colors.soft : 'transparent' })}>
    <View aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: 24, height: 24, borderRadius: 4, borderWidth: 2,
      borderColor: checked && !disabled ? colors.accent : ink, backgroundColor: checked ? disabled ? ink : colors.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
      {checked && <Icon name="check" size={18} color={disabled ? colors.surface : colors.accentInk} />}
    </View><View style={{ flex: 1, gap: 4 }}><Copy>{label}</Copy>{description && <Copy muted size={14}>{description}</Copy>}</View>
  </Pressable>;
}
export function BrowseFilterSheet({ title, kind, draft, onDraftChange, onApply, onCancel, disabled = false, lists, listsLoading, listsError, onRetryLists, fixedListId, fixedListName }: {
  title: string; kind: BrowseKind; draft: BrowseFilters | null; onDraftChange: (next: BrowseFilters) => void; onApply: () => void; onCancel: () => void;
  disabled?: boolean; lists: readonly ListRecord[]; listsLoading: boolean; listsError: unknown; onRetryLists: () => void; fixedListId?: string | null; fixedListName?: string;
}) {
  const change = (next: BrowseFilters) => { if (!disabled) onDraftChange(next); };
  return <Sheet title={title} visible={draft !== null} onClose={onCancel} footer={<View style={{ padding: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
    <View style={{ flexGrow: 1, flexBasis: 140 }}><Button label="Apply filters" disabled={disabled} onPress={onApply} /></View>
    <View style={{ flexGrow: 1, flexBasis: 140 }}><Button label="Cancel" variant="outlined" onPress={onCancel} /></View>
  </View>}>
    {draft && <>
      {kind === 'agenda' && <ConnectedGroup title="Status">
        <FilterCheckbox label="Overdue" checked={draft.overdueOnly} disabled={disabled} onChange={() => change({ ...draft, overdueOnly: !draft.overdueOnly })} />
        <FilterCheckbox label="Alert problems" description="Missed, timed out, interrupted, blocked or failed alerts." checked={draft.deliveryIssuesOnly} disabled={disabled} onChange={() => change({ ...draft, deliveryIssuesOnly: !draft.deliveryIssuesOnly })} />
      </ConnectedGroup>}
      {kind === 'completed' && <ConnectedGroup title="Show"><FilterCheckbox label="Show skipped" checked={draft.includeSkipped} disabled={disabled} onChange={() => change({ ...draft, includeSkipped: !draft.includeSkipped })} /></ConnectedGroup>}
      {fixedListId !== undefined ? <Copy muted size={14}>{'List: ' + (fixedListName ?? (fixedListId === null ? 'No list' : 'List unavailable'))}</Copy> : <ConnectedGroup title="List">
        <Choice label="All lists" selected={draft.listId === undefined} disabled={disabled} onPress={() => change({ ...draft, listId: undefined })} />
        <Choice label="No list" selected={draft.listId === null} disabled={disabled} onPress={() => change({ ...draft, listId: null })} />
        {lists.map(list => <Choice key={list.id} label={list.name} selected={draft.listId === list.id} disabled={disabled} onPress={() => change({ ...draft, listId: list.id })} />)}
      </ConnectedGroup>}
      {fixedListId === undefined && <QueryState loading={listsLoading} error={listsError} onRetry={onRetryLists} />}
      {kind !== 'agenda' && <Copy muted size={14}>Newest first</Copy>}
      <Button label="Reset filters" variant="neutral" disabled={disabled} onPress={() => change(resetBrowseFilters(kind, fixedListId))} />
    </>}
  </Sheet>;
}

import { useLocale, useTranslation } from '../localization/react';

import { useState, type ReactNode, type RefObject } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import type { ListRecord } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import {
  resetBrowseFilters,
  type BrowseFilterChip,
  type BrowseFilterField,
  type BrowseFilters,
  type BrowseKind,
} from '../domain/browse-filters';
import {
  ActionPair,
  Button,
  Choice,
  ConnectedGroup,
  Copy,
  Icon,
  IconButton,
  QueryState,
  Sheet,
} from './components';
import { useFontScaleOverride, useFoundationStyle, useTheme } from './theme';
import { chineseTextMetrics, shape, space, typography } from './tokens';

/** Shared browsing controls. Each destination still owns the query and focus lifecycle. */
export function BrowseControls({
  searching,
  query,
  inputRef,
  onChangeQuery,
  onExitSearch,
  disabled = false,
  filter,
  children,
}: {
  searching: boolean;
  query: string;
  inputRef: RefObject<TextInput | null>;
  onChangeQuery: (query: string) => void;
  onExitSearch: () => void;
  disabled?: boolean;
  filter?: ReactNode;
  children?: ReactNode;
}) {
  const t = useTranslation();
  const colors = useTheme();
  const scale = useFontScaleOverride();
  return (
    <View style={{ gap: space.sm }}>
      {searching && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            borderRadius: shape.field,
            backgroundColor: colors.surface,
          }}
        >
          <IconButton
            icon="arrow_back"
            label={t('m_1655ed829a84')}
            disabled={disabled}
            onPress={onExitSearch}
          />
          <TextInput
            ref={inputRef}
            accessibilityLabel={t('m_608e5f5e0f40')}
            value={query}
            onChangeText={onChangeQuery}
            placeholder={t('m_2796b78f7c5e')}
            editable={!disabled}
            placeholderTextColor={colors.muted}
            style={{
              flex: 1,
              minWidth: 0,
              minHeight: 48,
              padding: space.sm,
              color: colors.ink,
              fontSize: typography.body * scale,
              ...chineseTextMetrics(typography.body, scale),
            }}
          />
          {!!query && (
            <IconButton
              icon="close"
              label={t('m_48a1982ccf79')}
              disabled={disabled}
              onPress={() => onChangeQuery('')}
            />
          )}
        </View>
      )}
      {(children || filter) && (
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: space.sm,
          }}
        >
          {children}
          {filter}
        </View>
      )}
      {!searching && !!query && (
        <View style={{ alignItems: 'flex-start' }}>
          <RemovableChip
            label={t('ui_search_chip', { query })}
            accessibilityLabel={t('ui_remove_search', { query })}
            disabled={disabled}
            onRemove={() => onChangeQuery('')}
          />
        </View>
      )}
    </View>
  );
}

export function BrowseFilterButton({
  count,
  onPress,
  disabled = false,
  expanded = false,
  buttonRef,
}: {
  count: number;
  onPress: () => void;
  disabled?: boolean;
  expanded?: boolean;
  buttonRef?: RefObject<View | null>;
}) {
  'use no memo';
  const t = useTranslation();
  const colors = useTheme(),
    scale = useFontScaleOverride(),
    [focused, setFocused] = useState(false);
  const label = t('m_546ebb8eb993') + (count ? ', ' + count + t('m_2a222bd79b1a') : '');
  return (
    <Pressable
      ref={buttonRef}
      accessibilityRole="button"
      accessibilityLabel={label}
      aria-expanded={expanded}
      accessibilityState={{ disabled, expanded }}
      disabled={disabled}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => ({
        minHeight: 48,
        paddingHorizontal: 12,
        paddingVertical: 8,
        flexDirection: 'row',
        gap: 6,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 24,
        borderWidth: 2,
        borderColor: focused ? colors.accent : count ? colors.border : 'transparent',
        backgroundColor: pressed || count ? colors.soft : 'transparent',
        opacity: disabled ? 0.5 : 1,
      })}
    >
      <Icon name="filter_list" size={18} />
      <Text
        style={{
          color: colors.ink,
          fontSize: 14 * scale,
          lineHeight: 14 * scale * 1.4,
          flexShrink: 1,
          ...chineseTextMetrics(14, scale),
        }}
      >
        {t('m_546ebb8eb993') + (count ? ' · ' + count : '')}
      </Text>
    </Pressable>
  );
}
function RemovableChip({
  label,
  accessibilityLabel,
  onRemove,
  disabled,
}: {
  label: string;
  accessibilityLabel: string;
  onRemove: () => void;
  disabled: boolean;
}) {
  'use no memo';
  useLocale();
  const colors = useTheme(),
    scale = useFontScaleOverride(),
    [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onRemove}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => ({
        maxWidth: '100%',
        minHeight: 48,
        paddingHorizontal: 12,
        paddingVertical: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderRadius: 24,
        borderWidth: 2,
        borderColor: focused ? colors.accent : 'transparent',
        backgroundColor: pressed ? colors.surface : colors.soft,
        opacity: disabled ? 0.5 : 1,
      })}
    >
      <Text
        style={{
          flexShrink: 1,
          color: colors.ink,
          fontSize: 14 * scale,
          lineHeight: 14 * scale * 1.4,
          ...chineseTextMetrics(14, scale),
        }}
      >
        {label}
      </Text>
      <Icon name="close" size={18} />
    </Pressable>
  );
}
export function BrowseFilterChips({
  chips,
  onRemove,
  onReset,
  disabled = false,
}: {
  chips: readonly BrowseFilterChip[];
  onRemove: (field: BrowseFilterField) => void;
  onReset: () => void;
  disabled?: boolean;
}) {
  'use no memo';
  const t = useTranslation();
  if (!chips.length) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      {chips.map((chip) => (
        <RemovableChip
          key={chip.field}
          label={chip.label}
          accessibilityLabel={t('m_e8fe96a2bdd3') + chip.label}
          onRemove={() => onRemove(chip.field)}
          disabled={disabled}
        />
      ))}
      <ResetFiltersAction disabled={disabled} onPress={onReset} />
    </View>
  );
}
function ResetFiltersAction({ disabled, onPress }: { disabled: boolean; onPress: () => void }) {
  'use no memo';
  const t = useTranslation();
  const colors = useTheme(),
    [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('m_58cefb489b1a')}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => ({
        minHeight: 48,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 24,
        borderWidth: 2,
        borderColor: focused ? colors.accent : 'transparent',
        backgroundColor: pressed ? colors.soft : 'transparent',
        justifyContent: 'center',
        opacity: disabled ? 0.5 : 1,
      })}
    >
      <Copy muted size={14}>
        {t('m_10afa98480f2')}
      </Copy>
    </Pressable>
  );
}
function FilterCheckbox({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: () => void;
  disabled: boolean;
}) {
  'use no memo';
  useLocale();
  const colors = useTheme(),
    foundation = useFoundationStyle(),
    [focused, setFocused] = useState(false);
  const ink = disabled ? (foundation?.colors.disabledInk ?? colors.muted) : colors.ink;
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={[label, description].filter(Boolean).join('. ')}
      accessibilityState={{ checked, disabled }}
      aria-checked={checked}
      disabled={disabled}
      onPress={onChange}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => ({
        minHeight: 56,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderWidth: 2,
        borderColor: focused ? colors.accent : 'transparent',
        borderRadius: 16,
        backgroundColor: disabled
          ? (foundation?.colors.disabledSurface ?? colors.surface)
          : pressed
            ? colors.soft
            : 'transparent',
      })}
    >
      <View
        aria-hidden
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          width: 24,
          height: 24,
          borderRadius: 4,
          borderWidth: 2,
          borderColor: checked && !disabled ? colors.accent : ink,
          backgroundColor: checked ? (disabled ? ink : colors.accent) : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {checked && (
          <Icon name="check" size={18} color={disabled ? colors.surface : colors.accentInk} />
        )}
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Copy>{label}</Copy>
        {description && (
          <Copy muted size={14}>
            {description}
          </Copy>
        )}
      </View>
    </Pressable>
  );
}
export function BrowseFilterSheet({
  title,
  kind,
  draft,
  onDraftChange,
  onApply,
  onCancel,
  disabled = false,
  lists,
  listsLoading,
  listsError,
  onRetryLists,
  fixedListId,
  fixedListName,
  returnFocusRef,
}: {
  title: string;
  kind: BrowseKind;
  draft: BrowseFilters | null;
  onDraftChange: (next: BrowseFilters) => void;
  onApply: () => void;
  onCancel: () => void;
  disabled?: boolean;
  lists: readonly ListRecord[];
  listsLoading: boolean;
  listsError: unknown;
  onRetryLists: () => void;
  fixedListId?: string | null;
  fixedListName?: string;
  returnFocusRef?: RefObject<View | null>;
}) {
  'use no memo';
  const t = useTranslation();
  const change = (next: BrowseFilters) => {
    if (!disabled) onDraftChange(next);
  };
  return (
    <Sheet
      title={title}
      visible={draft !== null}
      onClose={onCancel}
      returnFocusRef={returnFocusRef}
      footer={
        <View style={{ padding: space.gutter }}>
          <ActionPair>
            <Button label={t('m_d80ab19b7edb')} disabled={disabled} onPress={onApply} />
            <Button label={t('m_19766ed6ccb2')} variant="outlined" onPress={onCancel} />
          </ActionPair>
        </View>
      }
    >
      {draft && (
        <>
          {kind === 'agenda' && (
            <ConnectedGroup title={t('m_920e413c7d41')}>
              <FilterCheckbox
                label={t('m_d660945bc299')}
                checked={draft.overdueOnly}
                disabled={disabled}
                onChange={() => change({ ...draft, overdueOnly: !draft.overdueOnly })}
              />
              <FilterCheckbox
                label={t('m_e4a303aaa9c2')}
                description={t('m_c64ccd9027a7')}
                checked={draft.deliveryIssuesOnly}
                disabled={disabled}
                onChange={() => change({ ...draft, deliveryIssuesOnly: !draft.deliveryIssuesOnly })}
              />
            </ConnectedGroup>
          )}
          {kind === 'completed' && (
            <ConnectedGroup title={t('m_0df6f1cad36c')}>
              <FilterCheckbox
                label={t('m_614f35ad96d0')}
                checked={draft.includeSkipped}
                disabled={disabled}
                onChange={() => change({ ...draft, includeSkipped: !draft.includeSkipped })}
              />
            </ConnectedGroup>
          )}
          {fixedListId !== undefined ? (
            <Copy muted size={14}>
              {t('m_8e644ee1deea') +
                (fixedListName ??
                  (fixedListId === null ? t('m_eacd31d849f9') : t('m_e7f6d340d947')))}
            </Copy>
          ) : (
            <ConnectedGroup title={t('m_6f202f54a7b2')}>
              <Choice
                label={t('m_53eb3f7aeec6')}
                selected={draft.listId === undefined}
                disabled={disabled}
                onPress={() => change({ ...draft, listId: undefined })}
              />
              <Choice
                label={t('m_eacd31d849f9')}
                selected={draft.listId === null}
                disabled={disabled}
                onPress={() => change({ ...draft, listId: null })}
              />
              {lists.map((list) => (
                <Choice
                  key={list.id}
                  label={list.name}
                  selected={draft.listId === list.id}
                  disabled={disabled}
                  onPress={() => change({ ...draft, listId: list.id })}
                />
              ))}
            </ConnectedGroup>
          )}
          {fixedListId === undefined && (
            <QueryState loading={listsLoading} error={listsError} onRetry={onRetryLists} />
          )}
          {kind !== 'agenda' && (
            <Copy muted size={14}>
              {t('m_ffb6f5764bdd')}
            </Copy>
          )}
          <Button
            label={t('m_10afa98480f2')}
            variant="neutral"
            disabled={disabled}
            onPress={() => change(resetBrowseFilters(kind, fixedListId))}
          />
        </>
      )}
    </Sheet>
  );
}

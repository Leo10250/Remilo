import { chineseTextMetrics, space, typography } from '../../ui/tokens';
import { useTranslation } from '../../localization/react';
import { ownedMessage } from '../../localization';

import { useTimeFormatting } from '../../ui/time-display';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import type { RepeatFamily } from '../../../modules/remilo-alarm/src/RemiloAlarm.types';
import {
  AtmosphericHeader,
  ConnectedGroup,
  Copy,
  Page,
  QueryState,
  SectionStack,
  SettingRow,
} from '../../ui/components';
import { engine, nativeAvailable } from '../../ui/native';
import { repeatLabel } from '../../ui/recurrence';
import { useFontScaleOverride, useTheme } from '../../ui/theme';
import { RootMore, RootNotice, useDestinationNavigation } from '../../ui/navigation';
import { originParams } from '../../domain/navigation';
import { useRootState } from '../../ui/root-state';

export default function Repeats() {
  'use no memo';
  const t = useTranslation();
  const { shortDateTime } = useTimeFormatting();
  const colors = useTheme(),
    scale = useFontScaleOverride();
  const [state, setState] = useRootState<RepeatFamily['state']>('repeats:state', 'Active');
  const back = useDestinationNavigation({ kind: 'repeats' });
  const query = useQuery({
    queryKey: ['repeat-families'],
    queryFn: () => engine().queryRepeatFamilies(),
    enabled: nativeAvailable,
  });
  const items = query.data?.filter((family) => family.state === state) ?? [];
  return (
    <Page
      title={t('m_92ee0233f013')}
      onBack={back}
      scrollKey="repeats"
      scrollReady={!query.isLoading}
      header={
        <AtmosphericHeader
          title={t('m_92ee0233f013')}
          onBack={back}
          actions={<RootMore origin={{ kind: 'repeats' }} />}
        />
      }
      footer={<RootNotice />}
    >
      <SectionStack>
        <View
          accessibilityRole="tablist"
          style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}
        >
          {(['Active', 'Paused', 'Ended'] as const).map((value) => (
            <Pressable
              key={value}
              accessibilityRole="tab"
              aria-selected={state === value}
              accessibilityState={{ selected: state === value }}
              onPress={() => setState(value)}
              style={({ pressed }) => ({
                flexGrow: 1,
                minHeight: 48,
                paddingHorizontal: 16,
                paddingVertical: 8,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 24,
                backgroundColor: state === value ? colors.accent : colors.soft,
                opacity: pressed ? 0.75 : 1,
              })}
            >
              <Text
                style={{
                  color: state === value ? colors.accentInk : colors.ink,
                  fontSize: typography.supporting * scale,
                  lineHeight: typography.supporting * scale * 1.4,
                  fontWeight: state === value ? '600' : '400',
                  ...chineseTextMetrics(
                    typography.supporting,
                    scale,
                    state === value ? '600' : '400',
                  ),
                }}
              >
                {ownedMessage(value)}
              </Text>
            </Pressable>
          ))}
        </View>
        <QueryState
          loading={query.isLoading && nativeAvailable}
          error={query.error}
          empty={!items.length}
          emptyMessage={
            !nativeAvailable
              ? t('m_f53ace288490')
              : t('m_945cc7379b0d', { arg0: String(ownedMessage(state).toLowerCase()) })
          }
          onRetry={() => void query.refetch()}
        />
        {!!items.length && (
          <ConnectedGroup>
            {items.map((family) => {
              const next = family.upcoming[0],
                series = family.current;
              const nextLabel = next
                ? (state === 'Paused' ? t('m_f04891cf0248') : t('m_cd447acb4270')) +
                  shortDateTime(next.alarmAtMs, series.rule.zoneId ?? undefined)
                : state === 'Ended'
                  ? t('m_c4aba4adaad7')
                  : '';
              return (
                <SettingRow
                  key={family.seriesId}
                  intent="navigation"
                  icon="repeat"
                  label={series.template.title}
                  value={repeatLabel(series.rule)}
                  description={nextLabel || undefined}
                  statusLabel={
                    family.unfinishedCount > 0
                      ? t('ui_repeat_unfinished_count', { count: family.unfinishedCount })
                      : undefined
                  }
                  supporting={
                    family.unfinishedCount > 0 ? (
                      <Copy muted size={typography.supporting}>
                        {t('ui_repeat_unfinished_count', { count: family.unfinishedCount })}
                      </Copy>
                    ) : undefined
                  }
                  onPress={() =>
                    router.push({
                      pathname: '/series/[id]',
                      params: {
                        id: series.id,
                        seriesId: family.seriesId,
                        ...originParams({ kind: 'repeats' }),
                      },
                    })
                  }
                />
              );
            })}
          </ConnectedGroup>
        )}
        {state !== 'Active' && (
          <Copy muted size={14}>
            {state === 'Paused' ? t('m_6a458b78ef8b') : t('m_16ec9a74e6b4')} {t('m_211931fb9ac8')}
          </Copy>
        )}
      </SectionStack>
    </Page>
  );
}

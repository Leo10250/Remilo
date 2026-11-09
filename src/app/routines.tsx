import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useTranslation } from '../localization/react';
import { useRef, useState } from 'react';
import { RoutineActions } from '../ui/routine-actions';
import { View } from 'react-native';
import {
  BottomActionBar,
  Button,
  ConnectedGroup,
  Page,
  QueryState,
  SectionStack,
  SplitDestinationRow,
  Status,
} from '../ui/components';
import { engine, nativeAvailable } from '../ui/native';
import { RootNotice } from '../ui/navigation';
import { routineDayKeys } from '../ui/routine-editor';

export default function Routines() {
  const t = useTranslation();
  const [menu, setMenu] = useState<string | null>(null);
  const menuTrigger = useRef<View>(null);
  const menuButtons = useRef(new Map<string, View>());
  const query = useQuery({
    queryKey: ['routines'],
    queryFn: () => engine().queryRoutines(),
    enabled: nativeAvailable,
  });
  return (
    <Page
      title={t('routine_library')}
      footer={
        <>
          <RootNotice />
          <BottomActionBar>
            <View style={{ flex: 1 }}>
              <Button
                label={t('routine_new')}
                icon="add"
                disabled={!nativeAvailable}
                onPress={() => router.push('/routine-edit')}
              />
            </View>
          </BottomActionBar>
        </>
      }
    >
      <SectionStack>
        <QueryState
          loading={query.isLoading}
          error={query.error}
          empty={!query.data?.length}
          emptyMessage={t('routine_empty')}
          onRetry={() => void query.refetch()}
        />
        {!!query.data?.length && (
          <ConnectedGroup title={t('ui_your_routines')}>
            {query.data.map((plan) => {
              const scheduled = plan.days.flatMap((day, i) =>
                day.type === 'Exercises' ? [i] : [],
              );
              const first = scheduled[0],
                last = scheduled[scheduled.length - 1];
              const days =
                scheduled.length > 1 && last - first + 1 === scheduled.length
                  ? t('ui_routine_day_range', {
                      first: t(routineDayKeys[first]),
                      last: t(routineDayKeys[last]),
                    })
                  : scheduled.map((i) => t(routineDayKeys[i])).join(' · ');
              return (
                <SplitDestinationRow
                  key={plan.id}
                  label={plan.title}
                  icon="format_list_numbered"
                  statusLabel={plan.state === 'Paused' ? t('routine_paused') : undefined}
                  supporting={
                    plan.state === 'Paused' ? (
                      <Status icon="pause" tone="muted" label={t('routine_paused')} />
                    ) : undefined
                  }
                  description={
                    days ? t('ui_routine_days_opens_today', { days }) : t('routine_open_today')
                  }
                  onPress={() =>
                    router.push({ pathname: '/routine-session', params: { id: plan.id } })
                  }
                  overflowLabel={t('ui_more_actions', { name: plan.title })}
                  overflowButtonRef={(node) => {
                    if (node) menuButtons.current.set(plan.id, node);
                    else menuButtons.current.delete(plan.id);
                  }}
                  onOverflowPress={() => {
                    menuTrigger.current = menuButtons.current.get(plan.id) ?? null;
                    setMenu(plan.id);
                  }}
                />
              );
            })}
          </ConnectedGroup>
        )}
      </SectionStack>
      <RoutineActions
        target={menu ? { id: menu } : null}
        onClose={() => setMenu(null)}
        showOpenToday={false}
        returnFocusRef={menuTrigger}
      />
    </Page>
  );
}

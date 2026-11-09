import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { errorText } from '../localization';
import { useTranslation } from '../localization/react';
import { ActionFeedback, RowSupport, SettingRow } from './components';
import { engine, iosReminders, nativeAvailable } from './native';

export function useWidgetProfileSupport() {
  return useQuery({
    queryKey: ['widget-profile-support'],
    queryFn: () => engine().getWidgetSupport(),
    enabled: nativeAvailable && iosReminders,
    select: (support) => support.profilesAvailable === true,
  });
}

export function WidgetSetupRow({
  routineId,
  description,
  disabled = false,
  onOpen,
}: {
  routineId?: string;
  description?: string;
  disabled?: boolean;
  onOpen?: () => void;
}) {
  const t = useTranslation(),
    live = useRef(true),
    running = useRef(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string>();
  const profileSupport = useWidgetProfileSupport();
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  if (iosReminders && !profileSupport.data) return null;
  return (
    <View>
      <SettingRow
        intent={routineId && !iosReminders ? 'action' : 'navigation'}
        label={t(iosReminders ? 'ios_widget_profiles' : routineId ? 'widget_add' : 'widget_name')}
        description={description}
        icon="event"
        disabled={disabled || busy || !nativeAvailable}
        onPress={() => {
          if (iosReminders) {
            onOpen?.();
            router.push({ pathname: '/widget-profiles', params: { routineId } });
            return;
          }
          if (running.current) return;
          running.current = true;
          setBusy(true);
          setError(undefined);
          void Promise.resolve()
            .then(() => engine().openWidgetSetup(routineId ?? null))
            .then(() => {
              if (live.current) onOpen?.();
            })
            .catch((e) => {
              if (live.current) setError(errorText(e, t('widget_setup_open_error')));
            })
            .finally(() => {
              running.current = false;
              if (live.current) setBusy(false);
            });
        }}
      />
      {(busy || error) && (
        <RowSupport>
          <ActionFeedback loading={busy} message={error} tone="danger" />
        </RowSupport>
      )}
    </View>
  );
}

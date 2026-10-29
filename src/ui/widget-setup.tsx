import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { errorText } from '../localization';
import { useTranslation } from '../localization/react';
import { ActionFeedback, RowSupport, SettingRow } from './components';
import { engine, nativeAvailable } from './native';

export function WidgetSetupRow({ routineId, disabled = false, onOpen }: { routineId?: string; disabled?: boolean; onOpen?: () => void }) {
  const t = useTranslation(), live = useRef(true), running = useRef(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState<string>();
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  return <View><SettingRow intent={routineId ? 'action' : 'navigation'} label={t(routineId ? 'widget_add' : 'widget_name')} icon="event" disabled={disabled || busy || !nativeAvailable}
    onPress={() => { if (running.current) return; running.current = true; setBusy(true); setError(undefined);
      void Promise.resolve().then(() => engine().openWidgetSetup(routineId ?? null)).then(() => { if (live.current) onOpen?.(); })
        .catch(e => { if (live.current) setError(errorText(e, t('widget_setup_open_error'))); })
        .finally(() => { running.current = false; if (live.current) setBusy(false); });
    }} />{(busy || error) && <RowSupport><ActionFeedback loading={busy} message={error} tone="danger" /></RowSupport>}</View>;
}

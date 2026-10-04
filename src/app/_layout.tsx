import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RemiloAlarm from '../../modules/remilo-alarm/src/RemiloAlarmModule';

const client = new QueryClient({ defaultOptions: { queries: { retry: 1 } } });

export default function RootLayout() {
  useEffect(() => {
    const refresh = () => void client.invalidateQueries();
    const app = AppState.addEventListener('change', (state) => {
      if (state === 'active') { void RemiloAlarm?.reconcile(); refresh(); }
    });
    const native = RemiloAlarm?.addListener('onChange', refresh);
    return () => { app.remove(); native?.remove(); };
  }, []);
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={client}>
        <Stack screenOptions={{ headerShown: false }} />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import RemiloAlarm from '../../modules/remilo-alarm/src/RemiloAlarmModule';
import { ThemeProvider, useTheme } from '../ui/theme';

const client = new QueryClient({ defaultOptions: { queries: { retry: 1 } } });

export default function RootLayout() {
  useEffect(() => {
    const refresh = () => void client.invalidateQueries();
    const app = AppState.addEventListener('change', (state) => {
      if (state === 'active') { void RemiloAlarm?.reconcile(); refresh(); }
    });
    const native = RemiloAlarm?.addListener('onChange', refresh);
    // Presentation refresh only: due status and date groups change while a screen stays open.
    const dateRefresh = setInterval(() => { if (AppState.currentState === 'active') refresh(); }, 60_000);
    return () => { app.remove(); native?.remove(); clearInterval(dateRefresh); };
  }, []);
  return (
    <GestureHandlerRootView style={{ flex: 1 }}><SafeAreaProvider>
      <QueryClientProvider client={client}>
        <ThemeProvider><Navigation /></ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider></GestureHandlerRootView>
  );
}
function Navigation() {
  const colors = useTheme();
  return <><StatusBar style={colors.dark ? 'light' : 'dark'} />
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} /></>;
}

import { useLocale } from '../localization/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import RemiloAlarm from '../../modules/remilo-alarm/src/RemiloAlarmModule';
import { ThemeProvider, useTheme } from '../ui/theme';
import PresentationPreview from '../ui/presentation-preview';
import { TimeDisplayProvider } from '../ui/time-display';
import { ConfirmationHost } from '../ui/confirmation-dialog';
import { iosReminders, useIOSCalendarImport } from '../ui/native';
import { NativeDeliveryRequestHost } from '../ui/postpone-host';

const client = new QueryClient({ defaultOptions: { queries: { retry: 1 } } });

export default function RootLayout() {
  'use no memo';
  useLocale();
  useEffect(() => {
    const refresh = () => void client.invalidateQueries();
    const app = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        if (!iosReminders) void RemiloAlarm?.reconcile();
        refresh();
      }
    });
    const native = RemiloAlarm?.addListener('onChange', refresh);
    // Presentation refresh only: due status and date groups change while a screen stays open.
    const dateRefresh = setInterval(() => {
      if (AppState.currentState === 'active') refresh();
    }, 60_000);
    return () => {
      app.remove();
      native?.remove();
      clearInterval(dateRefresh);
    };
  }, []);
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={client}>
          <TimeDisplayProvider>
            <ThemeProvider>
              <PresentationPreview>
                <Navigation />
                <ConfirmationHost />
              </PresentationPreview>
            </ThemeProvider>
          </TimeDisplayProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
function Navigation() {
  'use no memo';
  useLocale();
  const colors = useTheme();
  const iosCalendarImport = useIOSCalendarImport();
  return (
    <>
      <StatusBar style={colors.dark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
      >
        <Stack.Protected guard={!iosReminders || iosCalendarImport}>
          <Stack.Screen name="calendar" />
          <Stack.Screen name="calendar-import" />
          <Stack.Screen name="calendar-review" />
        </Stack.Protected>
        <Stack.Protected guard={!iosReminders}>
          <Stack.Screen name="calendar-activate" />
          <Stack.Screen name="calendar-import-all" />
          <Stack.Screen name="calendar-manage" />
          <Stack.Screen name="calendar-managed" />
          <Stack.Screen name="calendar-publish" />
          <Stack.Screen name="calendar-reviews" />
        </Stack.Protected>
        <Stack.Protected guard={iosReminders}>
          <Stack.Screen name="widget-profiles" />
        </Stack.Protected>
      </Stack>
      <NativeDeliveryRequestHost />
    </>
  );
}

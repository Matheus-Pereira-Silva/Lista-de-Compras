import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import AppNavigator from './src/navigation/AppNavigator';
import ErrorBoundary from './src/components/ErrorBoundary';
import { OfflineProvider } from './src/hooks/useOffline';
import { ToastProvider } from './src/components/Toast';
import { TestModeProvider } from './src/hooks/useTestMode';

export default function App() {
  return (
    <SafeAreaProvider>
      <OfflineProvider>
        <ToastProvider>
          <TestModeProvider>
            <ErrorBoundary>
              <AppNavigator />
            </ErrorBoundary>
          </TestModeProvider>
        </ToastProvider>
      </OfflineProvider>
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}

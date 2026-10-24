import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import AppNavigator from './src/navigation/AppNavigator';
import ErrorBoundary from './src/components/ErrorBoundary';
import { OfflineProvider } from './src/hooks/useOffline';
import { ToastProvider } from './src/components/Toast';

export default function App() {
  return (
    <SafeAreaProvider>
      <OfflineProvider>
        <ToastProvider>
          <ErrorBoundary>
            <AppNavigator />
          </ErrorBoundary>
        </ToastProvider>
      </OfflineProvider>
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}

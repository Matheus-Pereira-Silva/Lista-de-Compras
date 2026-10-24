import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import AppNavigator from './src/navigation/AppNavigator';
import ErrorBoundary from './src/components/ErrorBoundary';
import { OfflineProvider } from './src/hooks/useOffline';

export default function App() {
  return (
    <SafeAreaProvider>
      <OfflineProvider>
        <ErrorBoundary>
          <AppNavigator />
        </ErrorBoundary>
      </OfflineProvider>
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}

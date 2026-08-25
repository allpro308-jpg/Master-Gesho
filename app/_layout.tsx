import { useCallback } from 'react';
import { View, ActivityIndicator, StyleSheet, I18nManager } from 'react-native';
import { Stack } from 'expo-router';
import { useFonts, Cairo_400Regular, Cairo_500Medium, Cairo_600SemiBold, Cairo_700Bold } from '@expo-google-fonts/cairo';
import { Tajawal_400Regular, Tajawal_500Medium, Tajawal_700Bold, Tajawal_800ExtraBold } from '@expo-google-fonts/tajawal';
import * as SplashScreen from 'expo-splash-screen';
import { AlertProvider, AuthProvider } from '@/template';
import { ThemeProvider, useTheme } from '../contexts/ThemeContext';
import { AppProvider } from '../contexts/AppContext';
import { NotificationsProvider } from '../contexts/NotificationsContext';
import { AchievementsProvider } from '../contexts/AchievementsContext';
import { StatusBar } from 'expo-status-bar';

SplashScreen.preventAutoHideAsync();

I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

function InnerLayout() {
  const { theme, isDark } = useTheme();

  return (
    <AuthProvider>
      <AppProvider>
        <AchievementsProvider>
        <NotificationsProvider>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.background } }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="login" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="tool/[id]"
            options={{ presentation: 'card', animation: 'slide_from_right' }}
          />
          <Stack.Screen name="submit-tool" options={{ presentation: 'card', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="admin" options={{ presentation: 'card', animation: 'slide_from_right' }} />
          <Stack.Screen name="developer/[name]" options={{ presentation: 'card', animation: 'slide_from_right' }} />
          <Stack.Screen name="edit-profile" options={{ presentation: 'card', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="change-password" options={{ presentation: 'card', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="tags" options={{ presentation: 'card', animation: 'slide_from_right' }} />
          <Stack.Screen name="developer-info" options={{ presentation: 'card', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="admin-users" options={{ presentation: 'card', animation: 'slide_from_right' }} />
          <Stack.Screen name="achievements" options={{ presentation: 'card', animation: 'slide_from_right' }} />
          <Stack.Screen name="news" options={{ presentation: 'card', animation: 'slide_from_right' }} />
          <Stack.Screen name="post/[id]" options={{ presentation: 'card', animation: 'slide_from_right' }} />
        </Stack>
        </NotificationsProvider>
        </AchievementsProvider>
      </AppProvider>
    </AuthProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Cairo_400Regular,
    Cairo_500Medium,
    Cairo_600SemiBold,
    Cairo_700Bold,
    Tajawal_400Regular,
    Tajawal_500Medium,
    Tajawal_700Bold,
    Tajawal_800ExtraBold,
  });

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) await SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <AlertProvider>
      <ThemeProvider>
        <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
          <InnerLayout />
        </View>
      </ThemeProvider>
    </AlertProvider>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    backgroundColor: '#0B1120',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

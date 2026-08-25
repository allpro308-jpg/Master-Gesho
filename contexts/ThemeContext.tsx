import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';
import { darkTheme, lightTheme, AppTheme } from '../constants/theme';

export type ThemePreference = 'dark' | 'light' | 'system';

interface ThemeContextType {
  theme: AppTheme;
  isDark: boolean;
  themePreference: ThemePreference;
  toggleTheme: () => void;
  setThemePreference: (pref: ThemePreference) => void;
  applyDbTheme: (tokens: Partial<AppTheme>) => void;
  clearDbTheme: () => void;
  activeDbThemeName: string | null;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: darkTheme, isDark: true,
  themePreference: 'dark',
  toggleTheme: () => {}, setThemePreference: () => {}, applyDbTheme: () => {}, clearDbTheme: () => {},
  activeDbThemeName: null,
});

const THEME_KEY = '@nextools_theme_mode';
const DB_THEME_KEY = '@app_db_theme';
// Value stored: 'dark' | 'light' | 'system'
const THEME_PREF_KEY = '@app_theme_preference';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>('dark');
  const [dbTokens, setDbTokens] = useState<Partial<AppTheme> | null>(null);
  const [activeDbThemeName, setActiveDbThemeName] = useState<string | null>(null);

  useEffect(() => {
    // Load preference (supports old 'dark'/'light' and new 'system')
    AsyncStorage.getItem(THEME_PREF_KEY).then(val => {
      if (val === 'light' || val === 'dark' || val === 'system') {
        setThemePreferenceState(val as ThemePreference);
      } else {
        // Fallback: check old key
        AsyncStorage.getItem(THEME_KEY).then(old => {
          if (old === 'light') setThemePreferenceState('light');
        });
      }
    }).catch(() => {});
    // Load persisted DB theme
    AsyncStorage.getItem(DB_THEME_KEY).then(val => {
      if (val) {
        try {
          const parsed = JSON.parse(val);
          setDbTokens(parsed.tokens || null);
          setActiveDbThemeName(parsed.name || null);
        } catch {}
      }
    }).catch(() => {});
  }, []);

  // Resolved isDark — system follows device
  const isDark = useMemo(() => {
    if (themePreference === 'system') return systemColorScheme === 'dark';
    return themePreference === 'dark';
  }, [themePreference, systemColorScheme]);

  const setThemePreference = useCallback((pref: ThemePreference) => {
    setThemePreferenceState(pref);
    AsyncStorage.setItem(THEME_PREF_KEY, pref);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemePreference(isDark ? 'light' : 'dark');
  }, [isDark, setThemePreference]);

  const applyDbTheme = useCallback((tokens: Partial<AppTheme> & { _name?: string }) => {
    const { _name, ...rest } = tokens as any;
    setDbTokens(rest);
    setActiveDbThemeName(_name || null);
    AsyncStorage.setItem(DB_THEME_KEY, JSON.stringify({ tokens: rest, name: _name || null }));
  }, []);

  const clearDbTheme = useCallback(() => {
    setDbTokens(null);
    setActiveDbThemeName(null);
    AsyncStorage.removeItem(DB_THEME_KEY);
  }, []);

  const theme = useMemo(() => {
    const base = isDark ? darkTheme : lightTheme;
    if (!dbTokens) return base;
    return { ...base, ...dbTokens } as AppTheme;
  }, [isDark, dbTokens]);

  return (
    <ThemeContext.Provider value={{ theme, isDark, themePreference, toggleTheme, setThemePreference, applyDbTheme, clearDbTheme, activeDbThemeName }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);

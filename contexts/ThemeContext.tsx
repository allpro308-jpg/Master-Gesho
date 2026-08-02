import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkTheme, lightTheme, AppTheme } from '../constants/theme';

interface ThemeContextType {
  theme: AppTheme;
  isDark: boolean;
  toggleTheme: () => void;
  applyDbTheme: (tokens: Partial<AppTheme>) => void;
  clearDbTheme: () => void;
  activeDbThemeName: string | null;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: darkTheme, isDark: true,
  toggleTheme: () => {}, applyDbTheme: () => {}, clearDbTheme: () => {},
  activeDbThemeName: null,
});

const THEME_KEY = '@nextools_theme_mode';
const DB_THEME_KEY = '@app_db_theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(true);
  const [dbTokens, setDbTokens] = useState<Partial<AppTheme> | null>(null);
  const [activeDbThemeName, setActiveDbThemeName] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then(val => {
      if (val === 'light') setIsDark(false);
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

  const toggleTheme = useCallback(() => {
    setIsDark(prev => {
      const next = !prev;
      AsyncStorage.setItem(THEME_KEY, next ? 'dark' : 'light');
      return next;
    });
  }, []);

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
    <ThemeContext.Provider value={{ theme, isDark, toggleTheme, applyDbTheme, clearDbTheme, activeDbThemeName }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);

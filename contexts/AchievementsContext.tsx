
/**
 * AchievementsContext.tsx
 * Production-grade achievement system with:
 * - expo-notifications smart local notifications
 * - Custom daily reminder time (user-configurable hour + minute)
 * - Streak-based motivational messages
 * - Internal notification log
 * - AsyncStorage persistence
 */

import React, {
  createContext, useContext, useState, useEffect, useCallback, useMemo, useRef,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { useAppContext } from './AppContext';
import { useAuth } from '@/template';
import {
  Achievement, UserStats, NotificationSettings, StreakData,
  ACHIEVEMENTS_KEY, ACHIEVEMENT_MESSAGES, STREAK_MESSAGES,
  computeAchievements, computeLevel, getRandomMessage, getStreakMotivationMessage,
  updateStreak, getStreak, loadNotifSettings, saveNotifSettings,
  addToNotifiedSet, getNotifiedSet, DEFAULT_NOTIF_SETTINGS,
} from '../services/achievementsService';

// ─── Notification handler ─────────────────────────────────────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// ─── Internal notification log ────────────────────────────────────────────────
export interface InternalNotif {
  id: string;
  title: string;
  body: string;
  timestamp: string;
  achievementId?: string;
  icon: string;
}

const INTERNAL_NOTIFS_KEY = '@nextools_internal_notifs_v2';
const MAX_INTERNAL_NOTIFS = 50;
const DAILY_REMINDER_ID = 'daily_streak_reminder';

// ─── Context type ─────────────────────────────────────────────────────────────
interface AchievementsContextType {
  achievements: Achievement[];
  unlockedAchievements: Achievement[];
  userStats: UserStats;
  streakData: StreakData;
  levelInfo: { level: number; title: string; nextPoints: number; progress: number };
  totalPoints: number;
  notifSettings: NotificationSettings;
  internalNotifs: InternalNotif[];
  unreadNotifCount: number;
  loading: boolean;
  updateStats: (patch: Partial<UserStats>) => void;
  updateNotifSettings: (s: NotificationSettings) => Promise<void>;
  scheduleDailyReminder: (hour: number, minute: number) => Promise<void>;
  clearInternalNotifs: () => void;
  markAllInternalRead: () => void;
  sendTestNotification: () => Promise<void>;
  refreshStreak: () => Promise<void>;
}

const AchievementsContext = createContext<AchievementsContextType>({} as AchievementsContextType);

export function AchievementsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { tools, savedToolIds, votedToolIds, userRatings } = useAppContext();

  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [streakData, setStreakData] = useState<StreakData>({
    currentStreak: 0, longestStreak: 0, lastActiveDate: '',
  });
  const [notifSettings, setNotifSettingsState] = useState<NotificationSettings>(DEFAULT_NOTIF_SETTINGS);
  const [internalNotifs, setInternalNotifs] = useState<InternalNotif[]>([]);
  const [internalReadSet, setInternalReadSet] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [permGranted, setPermGranted] = useState(false);
  const prevAchievedIds = useRef<Set<string>>(new Set());

  // ── Request notification permission ──────────────────────────────────────
  useEffect(() => {
    (async () => {
      if (Platform.OS === 'web') return;
      const { status } = await Notifications.requestPermissionsAsync();
      setPermGranted(status === 'granted');
    })();
  }, []);

  // ── Load persisted data ────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const [streak, settings, notifsRaw] = await Promise.all([
        getStreak(),
        loadNotifSettings(),
        AsyncStorage.getItem(INTERNAL_NOTIFS_KEY),
      ]);
      setStreakData(streak);
      setNotifSettingsState(settings);
      if (notifsRaw) setInternalNotifs(JSON.parse(notifsRaw));
      setLoading(false);
    })();
  }, []);

  // ── Update streak when user is authenticated ──────────────────────────────
  useEffect(() => {
    if (!user?.id) return;
    updateStreak().then(setStreakData);
  }, [user?.id]);

  // ── Derive user stats ──────────────────────────────────────────────────────
  const userStats: UserStats = useMemo(() => {
    const interactedIds = [...new Set([...savedToolIds, ...votedToolIds, ...Object.keys(userRatings)])];
    const categoriesSet = new Set<string>();
    const tagsSet = new Set<string>();
    interactedIds.forEach(id => {
      const tool = tools.find(t => t.id === id);
      if (tool) {
        categoriesSet.add(tool.category);
        tool.tags.forEach(tag => tagsSet.add(tag));
      }
    });
    return {
      totalInteractions: savedToolIds.length + votedToolIds.length + Object.keys(userRatings).length,
      savedCount: savedToolIds.length,
      votedCount: votedToolIds.length,
      ratedCount: Object.keys(userRatings).length,
      commentCount: 0,
      categoriesExplored: categoriesSet.size,
      tagsExplored: tagsSet.size,
      currentStreak: streakData.currentStreak,
      longestStreak: streakData.longestStreak,
      lastActiveDate: streakData.lastActiveDate,
    };
  }, [savedToolIds, votedToolIds, userRatings, tools, streakData]);

  // ── Compute achievements (only when userStats changes, not achievements itself) ─
  useEffect(() => {
    if (!user?.id) return;
    setAchievements(prev => {
      const computed = computeAchievements(userStats, prev);
      const unlockedOthers = computed.filter(a => a.unlocked && a.id !== 'completionist').length;
      const completionist = computed.find(a => a.id === 'completionist');
      if (completionist) {
        completionist.currentValue = unlockedOthers;
        completionist.progress = Math.min(100, Math.round((unlockedOthers / completionist.threshold) * 100));
        completionist.unlocked = unlockedOthers >= completionist.threshold;
      }
      return computed;
    });
  }, [userStats, user?.id]);

  // ── Fire notifications for newly unlocked achievements ─────────────────────
  useEffect(() => {
    if (!user?.id || achievements.length === 0) return;

    (async () => {
      const notifiedSet = await getNotifiedSet();
      const newlyUnlocked = achievements.filter(a => a.unlocked && !notifiedSet.has(a.id));
      if (newlyUnlocked.length === 0) return;

      for (const ach of newlyUnlocked) {
        await addToNotifiedSet(ach.id);
        prevAchievedIds.current.add(ach.id);

        if (!notifSettings.enabled || !notifSettings.achievementAlerts) continue;
        if (!permGranted && Platform.OS !== 'web') continue;

        const hour = new Date().getHours();
        const { quietHoursStart, quietHoursEnd } = notifSettings;
        const inQuiet =
          quietHoursStart > quietHoursEnd
            ? hour >= quietHoursStart || hour < quietHoursEnd
            : hour >= quietHoursStart && hour < quietHoursEnd;
        if (inQuiet) continue;

        const body = getRandomMessage(ACHIEVEMENT_MESSAGES);
        const title = `${ach.icon} ${ach.title}`;

        if (Platform.OS !== 'web') {
          await Notifications.scheduleNotificationAsync({
            content: { title, body, sound: true },
            trigger: null,
          });
        }

        const notifEntry: Pick<InternalNotif, 'title' | 'body' | 'achievementId' | 'icon'> = {
          title, body, achievementId: ach.id, icon: ach.icon,
        };
        const newNotif: InternalNotif = {
          id: `in_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          ...notifEntry,
          timestamp: new Date().toISOString(),
        };
        setInternalNotifs(prev => {
          const updated = [newNotif, ...prev].slice(0, MAX_INTERNAL_NOTIFS);
          AsyncStorage.setItem(INTERNAL_NOTIFS_KEY, JSON.stringify(updated));
          return updated;
        });
      }
    })();
  }, [achievements, user?.id, notifSettings, permGranted]);

  // ── Internal notification helpers ──────────────────────────────────────────
  const addInternalNotif = useCallback(
    async (opts: Pick<InternalNotif, 'title' | 'body' | 'achievementId' | 'icon'>) => {
      const notif: InternalNotif = {
        id: `in_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        title: opts.title,
        body: opts.body,
        timestamp: new Date().toISOString(),
        achievementId: opts.achievementId,
        icon: opts.icon,
      };
      setInternalNotifs(prev => {
        const updated = [notif, ...prev].slice(0, MAX_INTERNAL_NOTIFS);
        AsyncStorage.setItem(INTERNAL_NOTIFS_KEY, JSON.stringify(updated));
        return updated;
      });
    },
    [],
  );

  // Keep addInternalNotif available for sendTestNotification

  const clearInternalNotifs = useCallback(() => {
    setInternalNotifs([]);
    AsyncStorage.removeItem(INTERNAL_NOTIFS_KEY);
  }, []);

  const markAllInternalRead = useCallback(() => {
    setInternalReadSet(prev => {
      const updated = new Set(prev);
      internalNotifs.forEach(n => updated.add(n.id));
      return updated;
    });
  }, [internalNotifs]);

  const unreadNotifCount = useMemo(
    () => internalNotifs.filter(n => !internalReadSet.has(n.id)).length,
    [internalNotifs, internalReadSet],
  );

  // ── Schedule daily reminder (custom time + streak-based message) ───────────
  const scheduleDailyReminder = useCallback(
    async (hour: number, minute: number) => {
      if (Platform.OS === 'web' || !permGranted) return;
      // Cancel any existing daily reminder
      try {
        const scheduled = await Notifications.getAllScheduledNotificationsAsync();
        for (const sn of scheduled) {
          if ((sn.content.data as any)?.type === DAILY_REMINDER_ID) {
            await Notifications.cancelScheduledNotificationAsync(sn.identifier);
          }
        }
      } catch (_) {}

      const message = getStreakMotivationMessage(streakData.currentStreak);

      await Notifications.scheduleNotificationAsync({
        content: {
          title: streakData.currentStreak > 0
            ? `🔥 سلسلتك ${streakData.currentStreak} أيام – لا تكسرها!`
            : '🚀 وقت التفاعل مع أدوات الذكاء الاصطناعي',
          body: message,
          sound: true,
          data: { type: DAILY_REMINDER_ID },
        },
        trigger: {
          hour,
          minute,
          repeats: true,
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
        },
      });
    },
    [permGranted, streakData.currentStreak],
  );

  // ── Update notification settings ───────────────────────────────────────────
  const updateNotifSettings = useCallback(
    async (settings: NotificationSettings) => {
      setNotifSettingsState(settings);
      await saveNotifSettings(settings);

      if (Platform.OS === 'web' || !permGranted) return;

      // Cancel all scheduled first
      await Notifications.cancelAllScheduledNotificationsAsync();

      if (!settings.dailyMotivation || !settings.enabled) return;

      // Reschedule with custom time
      const hour = settings.reminderHour ?? 9;
      const minute = settings.reminderMinute ?? 0;
      const message = getStreakMotivationMessage(streakData.currentStreak);

      await Notifications.scheduleNotificationAsync({
        content: {
          title: streakData.currentStreak > 0
            ? `🔥 سلسلتك ${streakData.currentStreak} أيام – لا تكسرها!`
            : '🚀 وقت التفاعل مع أدوات الذكاء الاصطناعي',
          body: message,
          sound: true,
          data: { type: DAILY_REMINDER_ID },
        },
        trigger: {
          hour,
          minute,
          repeats: true,
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
        },
      });
    },
    [permGranted, streakData.currentStreak],
  );

  // ── Test notification ──────────────────────────────────────────────────────
  const sendTestNotification = useCallback(async () => {
    if (Platform.OS !== 'web' && permGranted) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🔔 هذه معاينة للإشعارات',
          body: 'إشعاراتك تعمل بشكل مثالي في مستر جيشو',
        },
        trigger: null,
      });
    }
    const testNotif: InternalNotif = {
      id: `in_${Date.now()}_test`,
      title: '🔔 معاينة الإشعار',
      body: 'إشعاراتك تعمل بشكل مثالي في مستر جيشو',
      icon: '🔔',
      timestamp: new Date().toISOString(),
    };
    setInternalNotifs(prev => {
      const updated = [testNotif, ...prev].slice(0, MAX_INTERNAL_NOTIFS);
      AsyncStorage.setItem(INTERNAL_NOTIFS_KEY, JSON.stringify(updated));
      return updated;
    });
  }, [permGranted]);

  const refreshStreak = useCallback(async () => {
    const streak = await updateStreak();
    setStreakData(streak);
  }, []);

  const updateStats = useCallback((_patch: Partial<UserStats>) => {
    // Stats are auto-derived from AppContext
  }, []);

  const unlockedAchievements = useMemo(
    () => achievements.filter(a => a.unlocked),
    [achievements],
  );

  const totalPoints = useMemo(
    () => unlockedAchievements.reduce((sum, a) => sum + a.points, 0),
    [unlockedAchievements],
  );

  const levelInfo = useMemo(() => computeLevel(totalPoints), [totalPoints]);

  return (
    <AchievementsContext.Provider
      value={{
        achievements,
        unlockedAchievements,
        userStats,
        streakData,
        levelInfo,
        totalPoints,
        notifSettings,
        internalNotifs,
        unreadNotifCount,
        loading,
        updateStats,
        updateNotifSettings,
        scheduleDailyReminder,
        clearInternalNotifs,
        markAllInternalRead,
        sendTestNotification,
        refreshStreak,
      }}
    >
      {children}
    </AchievementsContext.Provider>
  );
}

export const useAchievements = () => useContext(AchievementsContext);

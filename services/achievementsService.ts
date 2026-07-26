/**
 * achievementsService.ts
 * Production-grade achievement definitions, types, and evaluation engine.
 * Supports: count milestones, streaks, category mastery, seasonal, secret achievements.
 * Includes: custom daily reminder time, streak-based motivational messages.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Storage Keys ────────────────────────────────────────────────────────────
export const ACHIEVEMENTS_KEY = '@nextools_achievements_v2';
export const STREAKS_KEY = '@nextools_streaks_v2';
export const NOTIFIED_ACHIEVEMENTS_KEY = '@nextools_notified_achievements_v2';
export const NOTIF_SETTINGS_KEY = '@nextools_notif_settings_v2';
export const DAILY_NOTIF_KEY = '@nextools_daily_notif_v2';

// ─── Types ───────────────────────────────────────────────────────────────────
export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
export type AchievementType =
  | 'count'
  | 'streak'
  | 'category'
  | 'tags'
  | 'save'
  | 'vote'
  | 'rate'
  | 'comment'
  | 'seasonal'
  | 'secret';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  materialIcon: string;
  type: AchievementType;
  tier: AchievementTier;
  threshold: number;
  secret?: boolean;
  seasonal?: boolean;
  seasonEnd?: number;
  points: number;
  unlocked: boolean;
  unlockedAt?: string;
  progress: number;
  currentValue: number;
}

export interface UserStats {
  totalInteractions: number;
  savedCount: number;
  votedCount: number;
  ratedCount: number;
  commentCount: number;
  categoriesExplored: number;
  tagsExplored: number;
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string;
}

export interface NotificationSettings {
  enabled: boolean;
  achievementAlerts: boolean;
  dailyMotivation: boolean;
  streakReminders: boolean;
  quietHoursStart: number;
  quietHoursEnd: number;
  // Custom daily reminder time
  reminderHour: number;
  reminderMinute: number;
}

export const DEFAULT_NOTIF_SETTINGS: NotificationSettings = {
  enabled: true,
  achievementAlerts: true,
  dailyMotivation: false,
  streakReminders: true,
  quietHoursStart: 22,
  quietHoursEnd: 8,
  reminderHour: 9,
  reminderMinute: 0,
};

// ─── Achievement Definitions ─────────────────────────────────────────────────
export const ACHIEVEMENT_DEFINITIONS: Omit<Achievement, 'unlocked' | 'unlockedAt' | 'progress' | 'currentValue'>[] = [
  {
    id: 'first_step',
    title: 'الخطوة الأولى',
    description: 'تفاعلت مع أول أداة',
    icon: '👣',
    materialIcon: 'emoji-footprints',
    type: 'count',
    tier: 'bronze',
    threshold: 1,
    points: 10,
  },
  {
    id: 'explorer_10',
    title: 'مستكشف مبتدئ',
    description: 'أجريت 10 تفاعلات',
    icon: '🌟',
    materialIcon: 'star',
    type: 'count',
    tier: 'bronze',
    threshold: 10,
    points: 25,
  },
  {
    id: 'explorer_25',
    title: 'مستكشف نشط',
    description: 'أجريت 25 تفاعلاً',
    icon: '🏅',
    materialIcon: 'military-tech',
    type: 'count',
    tier: 'silver',
    threshold: 25,
    points: 60,
  },
  {
    id: 'explorer_50',
    title: 'مستكشف متمرس',
    description: 'أجريت 50 تفاعلاً',
    icon: '🥈',
    materialIcon: 'workspace-premium',
    type: 'count',
    tier: 'silver',
    threshold: 50,
    points: 100,
  },
  {
    id: 'explorer_100',
    title: 'خبير الأدوات',
    description: 'أجريت 100 تفاعل',
    icon: '🥇',
    materialIcon: 'emoji-events',
    type: 'count',
    tier: 'gold',
    threshold: 100,
    points: 200,
  },
  {
    id: 'explorer_200',
    title: 'أسطورة الذكاء',
    description: 'أجريت 200 تفاعل',
    icon: '🏆',
    materialIcon: 'diamond',
    type: 'count',
    tier: 'platinum',
    threshold: 200,
    points: 500,
  },
  {
    id: 'saver_5',
    title: 'جامع الأدوات',
    description: 'حفظت 5 أدوات',
    icon: '🔖',
    materialIcon: 'bookmark',
    type: 'save',
    tier: 'bronze',
    threshold: 5,
    points: 20,
  },
  {
    id: 'saver_20',
    title: 'أرشيف الذكاء',
    description: 'حفظت 20 أداة',
    icon: '📚',
    materialIcon: 'library-books',
    type: 'save',
    tier: 'silver',
    threshold: 20,
    points: 75,
  },
  {
    id: 'saver_50',
    title: 'موسوعة شاملة',
    description: 'حفظت 50 أداة',
    icon: '🗃️',
    materialIcon: 'dataset',
    type: 'save',
    tier: 'gold',
    threshold: 50,
    points: 180,
  },
  {
    id: 'voter_10',
    title: 'ناخب مخلص',
    description: 'صوّت على 10 أدوات',
    icon: '👍',
    materialIcon: 'thumb-up',
    type: 'vote',
    tier: 'bronze',
    threshold: 10,
    points: 20,
  },
  {
    id: 'voter_30',
    title: 'صوت المجتمع',
    description: 'صوّت على 30 أداة',
    icon: '🗳️',
    materialIcon: 'how-to-vote',
    type: 'vote',
    tier: 'silver',
    threshold: 30,
    points: 80,
  },
  {
    id: 'rater_5',
    title: 'محكّم الأدوات',
    description: 'قيّمت 5 أدوات',
    icon: '⭐',
    materialIcon: 'star-rate',
    type: 'rate',
    tier: 'bronze',
    threshold: 5,
    points: 25,
  },
  {
    id: 'rater_15',
    title: 'ناقد محترف',
    description: 'قيّمت 15 أداة',
    icon: '🎯',
    materialIcon: 'gps-fixed',
    type: 'rate',
    tier: 'silver',
    threshold: 15,
    points: 90,
  },
  {
    id: 'cat_explorer_3',
    title: 'متعدد المجالات',
    description: 'استكشفت 3 فئات مختلفة',
    icon: '🌈',
    materialIcon: 'category',
    type: 'category',
    tier: 'bronze',
    threshold: 3,
    points: 30,
  },
  {
    id: 'cat_explorer_all',
    title: 'شامل المعرفة',
    description: 'استكشفت جميع الفئات',
    icon: '🌍',
    materialIcon: 'public',
    type: 'category',
    tier: 'gold',
    threshold: 8,
    points: 250,
  },
  {
    id: 'streak_3',
    title: 'ثلاثة أيام متواصلة',
    description: '3 أيام نشاط متتالية',
    icon: '🔥',
    materialIcon: 'local-fire-department',
    type: 'streak',
    tier: 'bronze',
    threshold: 3,
    points: 30,
  },
  {
    id: 'streak_7',
    title: 'أسبوع من النشاط',
    description: '7 أيام نشاط متتالية',
    icon: '⚡',
    materialIcon: 'bolt',
    type: 'streak',
    tier: 'silver',
    threshold: 7,
    points: 80,
  },
  {
    id: 'streak_30',
    title: 'شهر من الإتقان',
    description: '30 يوم نشاط متتالياً',
    icon: '💎',
    materialIcon: 'diamond',
    type: 'streak',
    tier: 'gold',
    threshold: 30,
    points: 400,
  },
  {
    id: 'tag_explorer_10',
    title: 'صائد الوسوم',
    description: 'تفاعلت مع أدوات تحمل 10 وسوم مختلفة',
    icon: '🏷️',
    materialIcon: 'tag',
    type: 'tags',
    tier: 'bronze',
    threshold: 10,
    points: 35,
  },
  {
    id: 'tag_explorer_25',
    title: 'مكتبة الوسوم',
    description: 'تفاعلت مع 25 وسم مختلف',
    icon: '📑',
    materialIcon: 'style',
    type: 'tags',
    tier: 'silver',
    threshold: 25,
    points: 90,
  },
  {
    id: 'night_owl',
    title: 'بومة الليل',
    description: 'اكتُشف: كنت نشطاً بعد منتصف الليل',
    icon: '🦉',
    materialIcon: 'nightlight',
    type: 'secret',
    tier: 'silver',
    threshold: 1,
    secret: true,
    points: 50,
  },
  {
    id: 'speed_explorer',
    title: 'المستكشف السريع',
    description: 'اكتُشف: تفاعلت مع 5 أدوات في جلسة واحدة',
    icon: '🚀',
    materialIcon: 'rocket-launch',
    type: 'secret',
    tier: 'gold',
    threshold: 5,
    secret: true,
    points: 120,
  },
  {
    id: 'completionist',
    title: 'الكمالي',
    description: 'حصلت على 10 إنجازات أخرى',
    icon: '🎖️',
    materialIcon: 'workspace-premium',
    type: 'count',
    tier: 'diamond',
    threshold: 10,
    secret: true,
    points: 999,
  },
];

// ─── Tier Colors & Labels ─────────────────────────────────────────────────────
export const TIER_COLORS: Record<AchievementTier, string> = {
  bronze: '#CD7F32',
  silver: '#A8A9AD',
  gold: '#FFD700',
  platinum: '#E5E4E2',
  diamond: '#B9F2FF',
};

export const TIER_LABELS: Record<AchievementTier, string> = {
  bronze: 'برونزي',
  silver: 'فضي',
  gold: 'ذهبي',
  platinum: 'بلاتيني',
  diamond: 'ألماسي',
};

// ─── Motivational Messages ────────────────────────────────────────────────────
export const ACHIEVEMENT_MESSAGES: string[] = [
  'رائع! لقد حققت إنجازاً جديداً. استمر بهذا الإيقاع المميز',
  'أداء مذهل! أنت تقترب من مستوى جديد من التميز',
  'سلسلة إنجازاتك مستمرة، لا تدع الحماس يتوقف',
  'لقد أصبحت ضمن المستخدمين الأكثر نشاطاً',
  'إنجاز جديد في رصيدك! مستر جيشو فخور بك',
  'أنت تصنع الفرق في مجتمع الذكاء الاصطناعي',
  'قدراتك تتنامى يوماً بعد يوم، أحسنت الاختيار',
];

export const STREAK_MESSAGES: string[] = [
  'سلسلتك النشطة تشعل الطريق، واصل الرحلة',
  'النشاط المتواصل هو سر النجاح الحقيقي',
  'يوم آخر من التميز. لا تكسر السلسلة',
];

// ─── Streak-based motivational messages ──────────────────────────────────────
export function getStreakMotivationMessage(streak: number): string {
  if (streak === 0) {
    return 'ابدأ رحلتك اليوم! يوم واحد هو كل ما تحتاجه للبداية 🚀';
  } else if (streak === 1) {
    return 'خطوة أولى رائعة! عد غداً لبناء سلسلتك 🔥';
  } else if (streak < 5) {
    return `${streak} أيام متتالية! أنت في البداية الصحيحة، لا توقف الآن 💪`;
  } else if (streak < 10) {
    return `${streak} أيام متواصلة! روحك القتالية ملهمة، استمر 🌟`;
  } else if (streak < 20) {
    return `${streak} يوم! أنت من المستخدمين الأكثر التزاماً. مستر جيشو فخور بك 🏅`;
  } else if (streak < 30) {
    return `${streak} يوم متتالياً! قريب جداً من إنجاز "شهر الإتقان" 🥇`;
  } else if (streak < 60) {
    return `${streak} يوم! لقد تجاوزت الشهر - أنت مثال يُحتذى به 🏆`;
  } else {
    return `${streak} يوم مستمراً! أسطورة حقيقية في مجتمع الذكاء الاصطناعي 💎`;
  }
}

// ─── Engine Functions ─────────────────────────────────────────────────────────
export function computeAchievements(stats: UserStats, currentAchievements: Achievement[]): Achievement[] {
  return ACHIEVEMENT_DEFINITIONS.map(def => {
    const existing = currentAchievements.find(a => a.id === def.id);
    const currentValue = getValueForType(def.type, def.id, stats);
    const progress = Math.min(100, Math.round((currentValue / def.threshold) * 100));
    const unlocked = currentValue >= def.threshold;
    return {
      ...def,
      unlocked,
      unlockedAt: unlocked && !existing?.unlocked ? new Date().toISOString() : existing?.unlockedAt,
      progress,
      currentValue,
    };
  });
}

function getValueForType(type: AchievementType, id: string, stats: UserStats): number {
  switch (type) {
    case 'count': {
      if (id === 'completionist') return 0;
      return stats.totalInteractions;
    }
    case 'save': return stats.savedCount;
    case 'vote': return stats.votedCount;
    case 'rate': return stats.ratedCount;
    case 'comment': return stats.commentCount;
    case 'category': return stats.categoriesExplored;
    case 'tags': return stats.tagsExplored;
    case 'streak': return stats.currentStreak;
    case 'secret':
    case 'seasonal': return 0;
    default: return 0;
  }
}

export function computeLevel(
  totalPoints: number,
): { level: number; title: string; nextPoints: number; progress: number } {
  const levels = [
    { points: 0, title: 'مبتدئ' },
    { points: 50, title: 'مستكشف' },
    { points: 150, title: 'متحمس' },
    { points: 350, title: 'خبير' },
    { points: 700, title: 'محترف' },
    { points: 1200, title: 'نخبة' },
    { points: 2000, title: 'أسطورة' },
    { points: 9999, title: 'معلم' },
  ];
  let level = 0;
  for (let i = levels.length - 1; i >= 0; i--) {
    if (totalPoints >= levels[i].points) {
      level = i;
      break;
    }
  }
  const current = levels[level];
  const next = levels[Math.min(level + 1, levels.length - 1)];
  const progress =
    level < levels.length - 1
      ? Math.round(((totalPoints - current.points) / (next.points - current.points)) * 100)
      : 100;
  return { level: level + 1, title: current.title, nextPoints: next.points, progress };
}

export function getRandomMessage(messages: string[]): string {
  return messages[Math.floor(Math.random() * messages.length)];
}

// ─── Streak Logic ─────────────────────────────────────────────────────────────
export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string;
}

export async function updateStreak(): Promise<StreakData> {
  const raw = await AsyncStorage.getItem(STREAKS_KEY);
  const today = new Date().toISOString().split('T')[0];
  let data: StreakData = raw
    ? JSON.parse(raw)
    : { currentStreak: 0, longestStreak: 0, lastActiveDate: '' };

  if (data.lastActiveDate === today) return data;

  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  if (data.lastActiveDate === yesterday) {
    data.currentStreak += 1;
  } else if (data.lastActiveDate !== today) {
    data.currentStreak = 1;
  }
  data.longestStreak = Math.max(data.longestStreak, data.currentStreak);
  data.lastActiveDate = today;
  await AsyncStorage.setItem(STREAKS_KEY, JSON.stringify(data));
  return data;
}

export async function getStreak(): Promise<StreakData> {
  const raw = await AsyncStorage.getItem(STREAKS_KEY);
  return raw ? JSON.parse(raw) : { currentStreak: 0, longestStreak: 0, lastActiveDate: '' };
}

// ─── Notification Settings ────────────────────────────────────────────────────
export async function loadNotifSettings(): Promise<NotificationSettings> {
  const raw = await AsyncStorage.getItem(NOTIF_SETTINGS_KEY);
  return raw ? { ...DEFAULT_NOTIF_SETTINGS, ...JSON.parse(raw) } : DEFAULT_NOTIF_SETTINGS;
}

export async function saveNotifSettings(settings: NotificationSettings): Promise<void> {
  await AsyncStorage.setItem(NOTIF_SETTINGS_KEY, JSON.stringify(settings));
}

// ─── Notified set ─────────────────────────────────────────────────────────────
export async function getNotifiedSet(): Promise<Set<string>> {
  const raw = await AsyncStorage.getItem(NOTIFIED_ACHIEVEMENTS_KEY);
  return raw ? new Set<string>(JSON.parse(raw)) : new Set<string>();
}

export async function addToNotifiedSet(id: string): Promise<void> {
  const set = await getNotifiedSet();
  set.add(id);
  await AsyncStorage.setItem(NOTIFIED_ACHIEVEMENTS_KEY, JSON.stringify([...set]));
}

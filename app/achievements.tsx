/**
 * achievements.tsx — Full achievements showcase with:
 * - ZoomIn animation for newly-unlocked achievements (first time only)
 * - Tier-specific confetti burst on unlock celebration
 * - Haptic feedback per tier level
 * - Tier filters, progress bars
 */

import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeInDown, ZoomIn, FadeIn, SlideInDown,
  useSharedValue, useAnimatedStyle,
  withTiming, withDelay, withSequence, withRepeat, Easing,
  ZoomInEasyDown, BounceIn,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useTheme } from '../contexts/ThemeContext';
import { useAchievements } from '../contexts/AchievementsContext';
import {
  AchievementTier, TIER_COLORS, TIER_LABELS, Achievement,
} from '../services/achievementsService';

// ─── Key for tracking celebrated achievements ─────────────────────────────────
const CELEBRATED_KEY = '@nextools_celebrated_achievements_v1';

type FilterTier = 'all' | AchievementTier;

const FILTER_TABS: { id: FilterTier; label: string }[] = [
  { id: 'all', label: 'الكل' },
  { id: 'bronze', label: 'برونزي' },
  { id: 'silver', label: 'فضي' },
  { id: 'gold', label: 'ذهبي' },
  { id: 'platinum', label: 'بلاتيني' },
  { id: 'diamond', label: 'ألماسي' },
];

// ─── Tier-specific confetti palettes ──────────────────────────────────────────
const TIER_CONFETTI: Record<AchievementTier, string[]> = {
  bronze: ['#CD7F32', '#E8A95E', '#F5C842', '#D4680A', '#FF9933', '#FDE68A'],
  silver: ['#A8A9AD', '#D1D5DB', '#9CA3AF', '#E5E7EB', '#6B7280', '#C8DCFF'],
  gold:   ['#FFD700', '#FFC200', '#FFAA00', '#F59E0B', '#FBBF24', '#FEF3C7'],
  platinum: ['#E5E4E2', '#CBD5E1', '#94A3B8', '#7EE8FF', '#A5F3FC', '#FFFFFF'],
  diamond: ['#B9F2FF', '#67E8F9', '#22D3EE', '#7C3AED', '#A78BFA', '#F0ABFC'],
};

// ─── Confetti Particle ────────────────────────────────────────────────────────
function ConfettiParticle({
  color, delay, angle, dist, size = 7, startX = 0,
}: {
  color: string; delay: number; angle: number; dist: number; size?: number; startX?: number;
}) {
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const opacity = useSharedValue(0);
  const rotate = useSharedValue(0);
  const scale = useSharedValue(0);

  useEffect(() => {
    const targetX = Math.cos(angle) * dist;
    const targetY = Math.sin(angle) * dist - 20;
    opacity.value = withDelay(delay, withSequence(
      withTiming(1, { duration: 150 }),
      withDelay(500, withTiming(0, { duration: 400 })),
    ));
    scale.value = withDelay(delay, withSequence(withTiming(1.2, { duration: 200 }), withTiming(1, { duration: 100 })));
    x.value = withDelay(delay, withTiming(targetX, { duration: 900, easing: Easing.out(Easing.cubic) }));
    y.value = withDelay(delay, withTiming(targetY, { duration: 900, easing: Easing.out(Easing.cubic) }));
    rotate.value = withDelay(delay, withRepeat(withTiming(360, { duration: 500 }), 2, false));
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      { rotate: `${rotate.value}deg` },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  const isCircle = size % 2 === 0;
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: size,
          height: isCircle ? size : size * 1.6,
          borderRadius: isCircle ? size / 2 : size * 0.3,
          backgroundColor: color,
          left: startX,
          top: 20,
        },
        style,
      ]}
    />
  );
}

function TierConfettiBurst({ tier, active }: { tier: AchievementTier; active: boolean }) {
  const colors = TIER_CONFETTI[tier] || TIER_CONFETTI.bronze;
  const particles = useMemo(
    () =>
      Array.from({ length: 32 }, (_, i) => ({
        key: i,
        color: colors[i % colors.length],
        delay: Math.floor(Math.random() * 200),
        angle: (i / 32) * 2 * Math.PI + (Math.random() - 0.5) * 0.4,
        dist: 60 + Math.random() * 80,
        size: 4 + Math.floor(Math.random() * 7),
        startX: 40 + Math.random() * 120,
      })),
    [],
  );
  if (!active) return null;
  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 160,
        overflow: 'visible',
        pointerEvents: 'none',
        zIndex: 99,
      }}
    >
      {particles.map(p => (
        <ConfettiParticle key={p.key} {...p} />
      ))}
    </View>
  );
}

// ─── Unlock Celebration Modal ─────────────────────────────────────────────────
function UnlockCelebrationModal({
  ach,
  onClose,
}: {
  ach: Achievement;
  onClose: () => void;
}) {
  const { theme } = useTheme();
  const tierColor = TIER_COLORS[ach.tier];
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    // Tier-specific haptic pattern
    const hapticForTier = async () => {
      switch (ach.tier) {
        case 'diamond':
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 150);
          setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 300);
          break;
        case 'gold':
        case 'platinum':
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 200);
          break;
        case 'silver':
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          break;
        default:
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    };
    hapticForTier();
    setTimeout(() => setShowConfetti(true), 100);
    const t = setTimeout(() => setShowConfetti(false), 1800);
    return () => clearTimeout(t);
  }, []);

  return (
    <Modal transparent animationType="fade" statusBarTranslucent>
      <Pressable
        style={ucm.overlay}
        onPress={() => { Haptics.selectionAsync(); onClose(); }}
      >
        <Pressable onPress={() => {}} style={{ alignItems: 'center', width: '100%' }}>
          <Animated.View
            entering={ZoomInEasyDown.springify().damping(12).stiffness(160)}
            style={[ucm.card, { backgroundColor: theme.surface, borderColor: tierColor + '80', position: 'relative' }]}
          >
            <TierConfettiBurst tier={ach.tier} active={showConfetti} />

            {/* Tier glow */}
            <View style={[ucm.glow, { backgroundColor: tierColor + '18' }]} />

            {/* Unlocked label */}
            <Animated.View entering={FadeIn.delay(200)} style={ucm.unlockedLabel}>
              <LinearGradient
                colors={[tierColor, tierColor + 'CC']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={ucm.unlockedGradient}
              >
                <MaterialIcons name="verified" size={14} color="#FFF" />
                <Text style={ucm.unlockedText}>تم الفتح!</Text>
              </LinearGradient>
            </Animated.View>

            {/* Icon */}
            <Animated.View entering={BounceIn.delay(150).springify().damping(8)} style={[ucm.iconBg, { backgroundColor: tierColor + '25' }]}>
              <Text style={{ fontSize: 56 }}>{ach.icon}</Text>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(200)} style={{ alignItems: 'center', gap: 6 }}>
              <Text style={[ucm.title, { color: theme.textPrimary }]}>{ach.title}</Text>
              <Text style={[ucm.desc, { color: theme.textSecondary }]}>{ach.description}</Text>
              <View style={[ucm.tierChip, { backgroundColor: tierColor + '20', borderColor: tierColor + '40' }]}>
                <Text style={[ucm.tierChipText, { color: tierColor }]}>{TIER_LABELS[ach.tier]}</Text>
                <View style={[ucm.dotSep, { backgroundColor: tierColor + '60' }]} />
                <MaterialIcons name="bolt" size={13} color="#F59E0B" />
                <Text style={ucm.points}>{ach.points} نقطة</Text>
              </View>
            </Animated.View>

            <Animated.View entering={FadeIn.delay(400)} style={{ width: '100%', marginTop: 8 }}>
              <Pressable
                onPress={() => { Haptics.selectionAsync(); onClose(); }}
                style={[ucm.closeBtn, { backgroundColor: tierColor + '18', borderColor: tierColor + '40' }]}
              >
                <Text style={[ucm.closeBtnText, { color: tierColor }]}>رائع! استمر</Text>
              </Pressable>
            </Animated.View>
          </Animated.View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const ucm = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%', borderRadius: 24, padding: 24,
    alignItems: 'center', gap: 16, borderWidth: 2,
    overflow: 'hidden', position: 'relative',
  },
  glow: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 24 },
  unlockedLabel: { alignSelf: 'center' },
  unlockedGradient: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 9999,
  },
  unlockedText: { fontSize: 13, fontFamily: 'Cairo_700Bold', color: '#FFF' },
  iconBg: {
    width: 100, height: 100, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 22, fontFamily: 'Cairo_700Bold', textAlign: 'center' },
  desc: { fontSize: 14, fontFamily: 'Cairo_400Regular', textAlign: 'center', lineHeight: 22 },
  tierChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 9999, borderWidth: 1,
  },
  tierChipText: { fontSize: 13, fontFamily: 'Cairo_700Bold' },
  dotSep: { width: 1, height: 12 },
  points: { fontSize: 13, fontFamily: 'Cairo_700Bold', color: '#F59E0B' },
  closeBtn: {
    paddingVertical: 13, borderRadius: 12, borderWidth: 1.5,
    alignItems: 'center',
  },
  closeBtnText: { fontSize: 15, fontFamily: 'Cairo_700Bold' },
});

// ─── Achievement Card ─────────────────────────────────────────────────────────
function AchievementCard({
  ach, index, isNew, onCelebrate,
}: {
  ach: Achievement; index: number; isNew: boolean; onCelebrate: (a: Achievement) => void;
}) {
  const { theme } = useTheme();
  const tierColor = TIER_COLORS[ach.tier as AchievementTier];
  const isSecret = ach.secret && !ach.unlocked;
  const [confettiKey, setConfettiKey] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);

  // Auto-trigger confetti + modal for new unlocks
  useEffect(() => {
    if (isNew && ach.unlocked) {
      const t = setTimeout(() => {
        setConfettiKey(k => k + 1);
        setShowConfetti(true);
        onCelebrate(ach);
        const t2 = setTimeout(() => setShowConfetti(false), 1600);
        return () => clearTimeout(t2);
      }, 200 + index * 80);
      return () => clearTimeout(t);
    }
  }, [isNew, ach.unlocked]);

  const entering = isNew && ach.unlocked
    ? ZoomIn.springify().damping(10).stiffness(150).delay(Math.min(index * 60, 400))
    : FadeInDown.duration(280).delay(Math.min(index * 40, 500));

  return (
    <Animated.View
      entering={entering}
      style={[
        ac.card,
        {
          backgroundColor: theme.surface,
          borderColor: ach.unlocked ? tierColor + '60' : theme.border,
          borderWidth: ach.unlocked ? 1.5 : 1,
        },
      ]}
    >
      {ach.unlocked && <View style={[ac.unlockedGlow, { backgroundColor: tierColor + '10' }]} />}
      <TierConfettiBurst key={confettiKey} tier={ach.tier as AchievementTier} active={showConfetti} />

      {isNew && ach.unlocked && (
        <Animated.View entering={ZoomIn.springify().damping(14).delay(300)} style={[ac.newBadge, { backgroundColor: tierColor }]}>
          <Text style={ac.newBadgeText}>جديد!</Text>
        </Animated.View>
      )}

      <View style={ac.top}>
        <View style={[ac.iconBg, { backgroundColor: ach.unlocked ? tierColor + '20' : theme.backgroundSecondary }]}>
          <Text style={{ fontSize: 24, opacity: isSecret ? 0.3 : 1 }}>
            {isSecret ? '🔒' : ach.icon}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={ac.titleRow}>
            <Text style={[ac.title, { color: isSecret ? theme.textMuted : theme.textPrimary }]} numberOfLines={1}>
              {isSecret ? '؟؟؟ سري' : ach.title}
            </Text>
            <View style={[ac.tierBadge, { backgroundColor: tierColor + '20' }]}>
              <Text style={[ac.tierText, { color: tierColor }]}>{TIER_LABELS[ach.tier as AchievementTier]}</Text>
            </View>
          </View>
          <Text style={[ac.desc, { color: theme.textMuted }]} numberOfLines={2}>
            {isSecret ? 'حقق شروطاً خاصة لكشف هذا الإنجاز' : ach.description}
          </Text>
        </View>
      </View>

      {!isSecret && (
        <View style={{ marginTop: 10, gap: 4 }}>
          <View style={ac.progressRow}>
            <Text style={[ac.progressVal, { color: theme.textMuted }]}>
              {ach.currentValue} / {ach.threshold}
            </Text>
            <Text style={[ac.progressPct, { color: ach.unlocked ? tierColor : theme.textMuted }]}>
              {ach.progress}%
            </Text>
          </View>
          <View style={[ac.progressTrack, { backgroundColor: theme.border }]}>
            <View
              style={[
                ac.progressFill,
                {
                  width: `${ach.progress}%` as any,
                  backgroundColor: ach.unlocked ? tierColor : theme.primary + '60',
                },
              ]}
            />
          </View>
        </View>
      )}

      <View style={ac.footer}>
        <View style={[ac.pointsBadge, { backgroundColor: theme.backgroundSecondary }]}>
          <MaterialIcons name="bolt" size={12} color="#F59E0B" />
          <Text style={[ac.points, { color: '#F59E0B' }]}>{ach.points} نقطة</Text>
        </View>
        {ach.unlocked && ach.unlockedAt && (
          <Text style={[ac.unlockedAtText, { color: theme.textMuted }]}>
            {new Date(ach.unlockedAt).toLocaleDateString('ar-EG')}
          </Text>
        )}
        {ach.unlocked && (
          <View style={[ac.doneChip, { backgroundColor: tierColor + '20' }]}>
            <MaterialIcons name="check-circle" size={13} color={tierColor} />
            <Text style={[ac.doneText, { color: tierColor }]}>مكتمل</Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

const ac = StyleSheet.create({
  card: {
    borderRadius: 16, padding: 14, marginBottom: 12,
    overflow: 'hidden', position: 'relative',
  },
  unlockedGlow: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 16 },
  newBadge: {
    position: 'absolute', top: 10, left: 10, zIndex: 10,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 9999,
  },
  newBadgeText: { fontSize: 10, fontFamily: 'Cairo_700Bold', color: '#FFF' },
  top: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  iconBg: {
    width: 52, height: 52, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' },
  title: { fontSize: 15, fontFamily: 'Cairo_700Bold', flex: 1 },
  tierBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999 },
  tierText: { fontSize: 10, fontFamily: 'Cairo_700Bold' },
  desc: { fontSize: 12, fontFamily: 'Cairo_400Regular', lineHeight: 18 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between' },
  progressVal: { fontSize: 11, fontFamily: 'Cairo_500Medium' },
  progressPct: { fontSize: 11, fontFamily: 'Cairo_700Bold' },
  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3, minWidth: 4 },
  footer: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 10, flexWrap: 'wrap',
  },
  pointsBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 9999,
  },
  points: { fontSize: 11, fontFamily: 'Cairo_700Bold' },
  unlockedAtText: { fontSize: 10, fontFamily: 'Cairo_400Regular', flex: 1, textAlign: 'right' },
  doneChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 9999,
  },
  doneText: { fontSize: 10, fontFamily: 'Cairo_700Bold' },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function AchievementsScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const s = useMemo(() => createStyles(theme), [theme]);
  const { achievements, unlockedAchievements, totalPoints, levelInfo, streakData } = useAchievements();
  const [filterTier, setFilterTier] = useState<FilterTier>('all');

  // Track new (uncelebrated) unlocked achievements
  const [celebratedIds, setCelebratedIds] = useState<Set<string>>(new Set());
  const [newAchievementIds, setNewAchievementIds] = useState<Set<string>>(new Set());
  const [celebratingAch, setCelebratingAch] = useState<Achievement | null>(null);
  const modalShownRef = useRef<Set<string>>(new Set());

  // Load celebrated set on mount, compute new ones
  useEffect(() => {
    (async () => {
      const raw = await AsyncStorage.getItem(CELEBRATED_KEY);
      const alreadyCelebrated: string[] = raw ? JSON.parse(raw) : [];
      const celebSet = new Set<string>(alreadyCelebrated);
      setCelebratedIds(celebSet);

      // Find newly unlocked achievements that haven't been celebrated
      const newIds = new Set<string>(
        achievements
          .filter(a => a.unlocked && !celebSet.has(a.id))
          .map(a => a.id),
      );
      setNewAchievementIds(newIds);

      // Mark all as celebrated in storage now
      if (newIds.size > 0) {
        const updated = [...alreadyCelebrated, ...Array.from(newIds)];
        await AsyncStorage.setItem(CELEBRATED_KEY, JSON.stringify(updated));
      }
    })();
  }, [achievements]);

  const handleCelebrate = useCallback((ach: Achievement) => {
    if (modalShownRef.current.has(ach.id)) return;
    modalShownRef.current.add(ach.id);
    // Show modal after short delay so card animation plays first
    setTimeout(() => setCelebratingAch(ach), 350);
  }, []);

  const filtered = useMemo(() => {
    if (filterTier === 'all') return achievements;
    return achievements.filter(a => a.tier === filterTier);
  }, [achievements, filterTier]);

  const unlockedInFilter = filtered.filter(a => a.unlocked).length;

  // Sort: unlocked first, then by tier weight
  const tierWeight: Record<AchievementTier, number> = {
    diamond: 5, platinum: 4, gold: 3, silver: 2, bronze: 1,
  };
  const sortedFiltered = useMemo(() => {
    const unlocked = filtered.filter(a => a.unlocked)
      .sort((a, b) => tierWeight[b.tier as AchievementTier] - tierWeight[a.tier as AchievementTier]);
    const locked = filtered.filter(a => !a.unlocked)
      .sort((a, b) => b.progress - a.progress);
    return [...unlocked, ...locked];
  }, [filtered]);

  return (
    <SafeAreaView edges={['top']} style={s.container}>
      {/* Celebration Modal */}
      {celebratingAch && (
        <UnlockCelebrationModal
          ach={celebratingAch}
          onClose={() => setCelebratingAch(null)}
        />
      )}

      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <MaterialIcons name="arrow-forward" size={22} color={theme.textPrimary} />
        </Pressable>
        <View style={{ alignItems: 'center' }}>
          <Text style={s.headerTitle}>الإنجازات</Text>
          <Text style={[s.headerSub, { color: theme.primary }]}>
            {unlockedAchievements.length} / {achievements.length} مكتمل
          </Text>
        </View>
        {newAchievementIds.size > 0 ? (
          <View style={[s.newBadgeHeader, { backgroundColor: '#22C55E' }]}>
            <Text style={s.newBadgeHeaderText}>{newAchievementIds.size} جديد</Text>
          </View>
        ) : (
          <View style={{ width: 56 }} />
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      >
        {/* ── Level & Stats Banner ── */}
        <Animated.View entering={FadeInDown.duration(350)} style={{ paddingHorizontal: 16, marginTop: 16, marginBottom: 20 }}>
          <LinearGradient
            colors={['#3B82F6', '#8B5CF6', '#EC4899']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.banner}
          >
            <View style={s.bannerTop}>
              <View style={s.levelBadge}>
                <Text style={s.levelNum}>{levelInfo.level}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.levelTitle}>{levelInfo.title}</Text>
                <Text style={s.levelSub}>{totalPoints} نقطة مكتسبة</Text>
              </View>
              <View style={s.streakBadge}>
                <Text style={{ fontSize: 20 }}>🔥</Text>
                <Text style={s.streakNum}>{streakData.currentStreak}</Text>
              </View>
            </View>
            <View style={s.bannerProgress}>
              <View style={s.bannerProgressRow}>
                <Text style={s.bannerProgressLabel}>نحو المستوى {levelInfo.level + 1}</Text>
                <Text style={s.bannerProgressPct}>{levelInfo.progress}%</Text>
              </View>
              <View style={s.bannerTrack}>
                <View style={[s.bannerFill, { width: `${levelInfo.progress}%` as any }]} />
              </View>
            </View>
            <View style={s.bannerStats}>
              {[
                { label: 'مكتمل', value: unlockedAchievements.length },
                { label: 'المتبقي', value: achievements.length - unlockedAchievements.length },
                { label: 'أيام متتالية', value: streakData.currentStreak },
              ].map((stat, i) => (
                <View key={i} style={s.bannerStat}>
                  {i > 0 && <View style={s.bannerStatDivider} />}
                  <Text style={s.bannerStatVal}>{stat.value}</Text>
                  <Text style={s.bannerStatLabel}>{stat.label}</Text>
                </View>
              ))}
            </View>
          </LinearGradient>
        </Animated.View>

        {/* ── New Achievements Alert ── */}
        {newAchievementIds.size > 0 && (
          <Animated.View entering={SlideInDown.springify().damping(14)} style={{ paddingHorizontal: 16, marginBottom: 16 }}>
            <LinearGradient
              colors={['#22C55E', '#16A34A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.newAlert}
            >
              <Text style={{ fontSize: 24 }}>🎉</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.newAlertTitle}>
                  {newAchievementIds.size === 1 ? 'إنجاز جديد مكتمل!' : `${newAchievementIds.size} إنجازات جديدة مكتملة!`}
                </Text>
                <Text style={s.newAlertSub}>استعرض الإنجازات الجديدة أدناه</Text>
              </View>
              <MaterialIcons name="expand-more" size={22} color="rgba(255,255,255,0.9)" />
            </LinearGradient>
          </Animated.View>
        )}

        {/* ── Tier Filters ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.filterChips}
          style={{ marginBottom: 16 }}
        >
          {FILTER_TABS.map(tab => {
            const active = filterTier === tab.id;
            const color = tab.id === 'all' ? theme.primary : TIER_COLORS[tab.id as AchievementTier];
            return (
              <Pressable
                key={tab.id}
                onPress={() => { Haptics.selectionAsync(); setFilterTier(tab.id); }}
                style={[
                  s.filterChip,
                  active
                    ? { backgroundColor: color, borderColor: color }
                    : { backgroundColor: theme.surface, borderColor: theme.border },
                ]}
              >
                <Text style={[
                  s.filterChipText,
                  active && { color: '#FFF', fontFamily: 'Cairo_700Bold' },
                  !active && { color: tab.id === 'all' ? theme.textSecondary : color },
                ]}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* ── Result count ── */}
        <View style={s.resultHeader}>
          <Text style={[s.resultCount, { color: theme.textMuted }]}>
            {unlockedInFilter} مكتمل من {filtered.length}
          </Text>
        </View>

        {/* ── Achievement List ── */}
        <View style={{ paddingHorizontal: 16 }}>
          {sortedFiltered.map((ach, i) => (
            <AchievementCard
              key={ach.id}
              ach={ach}
              index={i}
              isNew={newAchievementIds.has(ach.id)}
              onCelebrate={handleCelebrate}
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 12,
      borderBottomWidth: 1, borderBottomColor: theme.border,
    },
    backBtn: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border,
      alignItems: 'center', justifyContent: 'center',
    },
    headerTitle: { fontSize: 18, fontFamily: 'Cairo_700Bold', color: theme.textPrimary },
    headerSub: { fontSize: 12, fontFamily: 'Cairo_500Medium', marginTop: 1 },
    newBadgeHeader: {
      paddingHorizontal: 10, paddingVertical: 5, borderRadius: 9999,
    },
    newBadgeHeaderText: { fontSize: 11, fontFamily: 'Cairo_700Bold', color: '#FFF' },

    // Alert
    newAlert: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      padding: 14, borderRadius: 14,
    },
    newAlertTitle: { fontSize: 14, fontFamily: 'Cairo_700Bold', color: '#FFF' },
    newAlertSub: { fontSize: 11, fontFamily: 'Cairo_400Regular', color: 'rgba(255,255,255,0.85)', marginTop: 2 },

    // Banner
    banner: { borderRadius: 20, padding: 18, gap: 14 },
    bannerTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    levelBadge: {
      width: 48, height: 48, borderRadius: 14,
      backgroundColor: 'rgba(255,255,255,0.25)',
      alignItems: 'center', justifyContent: 'center',
    },
    levelNum: { fontSize: 22, fontFamily: 'Cairo_700Bold', color: '#FFF' },
    levelTitle: { fontSize: 18, fontFamily: 'Cairo_700Bold', color: '#FFF' },
    levelSub: { fontSize: 12, fontFamily: 'Cairo_400Regular', color: 'rgba(255,255,255,0.8)' },
    streakBadge: {
      backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12,
      paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center', gap: 2,
    },
    streakNum: { fontSize: 14, fontFamily: 'Cairo_700Bold', color: '#FFF' },
    bannerProgress: { gap: 6 },
    bannerProgressRow: { flexDirection: 'row', justifyContent: 'space-between' },
    bannerProgressLabel: { fontSize: 12, fontFamily: 'Cairo_500Medium', color: 'rgba(255,255,255,0.8)' },
    bannerProgressPct: { fontSize: 12, fontFamily: 'Cairo_700Bold', color: '#FFF' },
    bannerTrack: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' },
    bannerFill: { height: '100%', borderRadius: 4, backgroundColor: '#FFF' },
    bannerStats: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.18)', borderRadius: 12, paddingVertical: 10,
    },
    bannerStat: { flex: 1, alignItems: 'center', position: 'relative' },
    bannerStatDivider: {
      position: 'absolute', left: 0, top: '10%',
      width: 1, height: '80%', backgroundColor: 'rgba(255,255,255,0.25)',
    },
    bannerStatVal: { fontSize: 20, fontFamily: 'Cairo_700Bold', color: '#FFF' },
    bannerStatLabel: { fontSize: 10, fontFamily: 'Cairo_400Regular', color: 'rgba(255,255,255,0.8)' },

    // Filters
    filterChips: { paddingHorizontal: 16, gap: 8 },
    filterChip: {
      paddingHorizontal: 14, paddingVertical: 7, borderRadius: 9999, borderWidth: 1.5,
    },
    filterChipText: { fontSize: 12, fontFamily: 'Cairo_600SemiBold' },

    resultHeader: { paddingHorizontal: 16, marginBottom: 12 },
    resultCount: { fontSize: 13, fontFamily: 'Cairo_500Medium' },
  });

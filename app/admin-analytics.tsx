/**
 * app/admin-analytics.tsx — Analytics Dashboard
 * Platform stats with SVG-style bar charts
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  ActivityIndicator, Dimensions, RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, { FadeInDown, useSharedValue, useAnimatedStyle, withDelay, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '@/template';
import { getSupabaseClient } from '@/template';

const CHART_COLORS = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#F97316', '#06B6D4'];

// ─── Animated Bar (horizontal) ──────────────────────────────────────────────
function HBar({ pct, color, delay }: { pct: number; color: string; delay: number }) {
  const width = useSharedValue(0);
  useEffect(() => { width.value = withDelay(delay, withTiming(Math.max(pct, 2), { duration: 700 })); }, [pct]);
  const style = useAnimatedStyle(() => ({ width: `${width.value}%` as any }));
  return (
    <View style={{ height: 10, borderRadius: 5, backgroundColor: color + '25', overflow: 'hidden', flex: 1 }}>
      <Animated.View style={[{ height: '100%', borderRadius: 5, backgroundColor: color }, style]} />
    </View>
  );
}

// ─── Animated Bar (vertical / column chart) ─────────────────────────────────
function VBar({ heightPct, color, delay, label, value }: { heightPct: number; color: string; delay: number; label: string; value: number | string }) {
  const height = useSharedValue(0);
  const BAR_MAX = 100;
  const BAR_HEIGHT = 100;
  useEffect(() => { height.value = withDelay(delay, withTiming((heightPct / 100) * BAR_HEIGHT, { duration: 700 })); }, [heightPct]);
  const style = useAnimatedStyle(() => ({ height: height.value }));
  return (
    <View style={{ alignItems: 'center', flex: 1, gap: 4 }}>
      <Text style={{ fontSize: 10, fontFamily: 'Cairo_700Bold', color }}>{value}</Text>
      <View style={{ height: BAR_HEIGHT, justifyContent: 'flex-end', width: '70%' }}>
        <Animated.View style={[{ borderRadius: 4, backgroundColor: color }, style]} />
      </View>
      <Text style={{ fontSize: 9, fontFamily: 'Cairo_400Regular', color: '#94A3B8', textAlign: 'center' }} numberOfLines={2}>{label}</Text>
    </View>
  );
}

interface AnalyticsData {
  totalTools: number;
  totalUsers: number;
  totalVotes: number;
  totalComments: number;
  topVotedTools: { name: string; votes: number; category: string }[];
  topDevelopers: { name: string; followers: number; toolsCount: number }[];
  categoryBreakdown: { name: string; count: number }[];
  pricingBreakdown: { type: string; count: number }[];
  recentActivity: { date: string; tools: number; votes: number }[];
}

export default function AdminAnalyticsScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const s = useMemo(() => createStyles(theme), [theme]);

  useEffect(() => {
    if (!user?.id) { setIsAdmin(false); setLoading(false); return; }
    getSupabaseClient().from('user_profiles').select('is_admin').eq('id', user.id).single()
      .then(({ data: d }) => setIsAdmin(d?.is_admin || false));
  }, [user?.id]);

  const loadData = useCallback(async () => {
    const supabase = getSupabaseClient();
    const [toolsRes, usersRes, votesRes, commentsRes] = await Promise.all([
      supabase.from('tools').select('id, name, votes, category, developer_name, developer_followers, developer_tools_count, pricing').eq('status', 'approved'),
      supabase.from('user_profiles').select('id', { count: 'exact', head: true }),
      supabase.from('user_votes').select('id', { count: 'exact', head: true }),
      supabase.from('comments').select('id', { count: 'exact', head: true }),
    ]);

    const tools = toolsRes.data || [];
    const totalUsers = usersRes.count || 0;
    const totalVotes = votesRes.count || 0;
    const totalComments = commentsRes.count || 0;

    // Top voted tools
    const topVotedTools = [...tools]
      .sort((a, b) => (b.votes || 0) - (a.votes || 0))
      .slice(0, 8)
      .map(t => ({ name: t.name, votes: t.votes || 0, category: t.category }));

    // Top developers by followers
    const devMap: Record<string, { name: string; followers: number; toolsCount: number }> = {};
    tools.forEach(t => {
      const dev = t.developer_name;
      if (!dev) return;
      if (!devMap[dev]) devMap[dev] = { name: dev, followers: t.developer_followers || 0, toolsCount: 0 };
      devMap[dev].toolsCount += 1;
    });
    const topDevelopers = Object.values(devMap)
      .sort((a, b) => b.followers - a.followers)
      .slice(0, 8);

    // Category breakdown
    const catMap: Record<string, number> = {};
    tools.forEach(t => { catMap[t.category] = (catMap[t.category] || 0) + 1; });
    const categoryBreakdown = Object.entries(catMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // Pricing breakdown
    const priceMap: Record<string, number> = {};
    tools.forEach(t => { priceMap[t.pricing || 'غير محدد'] = (priceMap[t.pricing || 'غير محدد'] || 0) + 1; });
    const pricingBreakdown = Object.entries(priceMap)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);

    setData({
      totalTools: tools.length,
      totalUsers,
      totalVotes,
      totalComments,
      topVotedTools,
      topDevelopers,
      categoryBreakdown,
      pricingBreakdown,
      recentActivity: [],
    });
  }, []);

  useEffect(() => {
    if (isAdmin === false) { setLoading(false); return; }
    if (isAdmin === true) {
      loadData().finally(() => setLoading(false));
    }
  }, [isAdmin, loadData]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [loadData]);

  if (loading || isAdmin === null) {
    return (
      <SafeAreaView edges={['top']} style={[s.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </SafeAreaView>
    );
  }

  if (!isAdmin) {
    return (
      <SafeAreaView edges={['top']} style={[s.container, { alignItems: 'center', justifyContent: 'center', gap: 12 }]}>
        <MaterialIcons name="lock" size={52} color={theme.textMuted} />
        <Text style={[s.emptyTitle, { color: theme.textPrimary }]}>وصول محدود</Text>
        <Pressable onPress={() => router.back()} style={[s.backBtn, { backgroundColor: theme.primary }]}>
          <Text style={s.backBtnText}>العودة</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const maxVotes = data ? Math.max(...data.topVotedTools.map(t => t.votes), 1) : 1;
  const maxFollowers = data ? Math.max(...data.topDevelopers.map(d => d.followers), 1) : 1;
  const maxCatCount = data ? Math.max(...data.categoryBreakdown.map(c => c.count), 1) : 1;

  return (
    <SafeAreaView edges={['top']} style={s.container}>
      <View style={[s.header, { borderBottomColor: theme.border }]}>
        <Pressable onPress={() => router.back()} style={[s.iconBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <MaterialIcons name="arrow-forward" size={20} color={theme.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[s.title, { color: theme.textPrimary }]}>تحليلات المنصة</Text>
          <Text style={[s.sub, { color: theme.textMuted }]}>نظرة شاملة على الإحصائيات</Text>
        </View>
        <Pressable
          onPress={handleRefresh}
          style={[s.iconBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
        >
          <MaterialIcons name="refresh" size={18} color={theme.textSecondary} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32, gap: 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />}
      >
        {/* Overview Cards */}
        {data && (
          <Animated.View entering={FadeInDown.duration(300)} style={s.overviewGrid}>
            {[
              { icon: 'apps', label: 'إجمالي الأدوات', value: data.totalTools, color: '#3B82F6' },
              { icon: 'people', label: 'إجمالي المستخدمين', value: data.totalUsers, color: '#10B981' },
              { icon: 'arrow-upward', label: 'إجمالي الأصوات', value: data.totalVotes, color: '#F59E0B' },
              { icon: 'chat-bubble', label: 'إجمالي التعليقات', value: data.totalComments, color: '#A78BFA' },
            ].map((item, i) => (
              <View key={i} style={[s.overviewCard, { backgroundColor: theme.surface, borderColor: item.color + '40' }]}>
                <View style={[s.overviewIcon, { backgroundColor: item.color + '18' }]}>
                  <MaterialIcons name={item.icon as any} size={22} color={item.color} />
                </View>
                <Text style={[s.overviewValue, { color: item.color }]}>{item.value.toLocaleString()}</Text>
                <Text style={[s.overviewLabel, { color: theme.textMuted }]}>{item.label}</Text>
              </View>
            ))}
          </Animated.View>
        )}

        {/* Top Voted Tools - Column Chart */}
        {data && data.topVotedTools.length > 0 && (
          <Animated.View entering={FadeInDown.duration(300).delay(60)} style={[s.chartCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={s.chartHeader}>
              <View style={[s.chartIconBg, { backgroundColor: '#3B82F620' }]}>
                <MaterialIcons name="trending-up" size={18} color="#3B82F6" />
              </View>
              <View>
                <Text style={[s.chartTitle, { color: theme.textPrimary }]}>أكثر الأدوات تصويتاً</Text>
                <Text style={[s.chartSub, { color: theme.textMuted }]}>Top {data.topVotedTools.length} tools</Text>
              </View>
            </View>
            <View style={[s.columnChart]}>
              {data.topVotedTools.slice(0, 6).map((tool, i) => (
                <VBar
                  key={tool.name}
                  heightPct={(tool.votes / maxVotes) * 100}
                  color={CHART_COLORS[i % CHART_COLORS.length]}
                  delay={i * 60}
                  label={tool.name.slice(0, 8)}
                  value={tool.votes}
                />
              ))}
            </View>
            {/* Top 3 list */}
            {data.topVotedTools.slice(0, 3).map((tool, i) => (
              <View key={tool.name} style={[s.listRow, { borderBottomColor: theme.border }]}>
                <View style={[s.rankBadge, { backgroundColor: CHART_COLORS[i] + '20' }]}>
                  <Text style={[s.rankText, { color: CHART_COLORS[i] }]}>#{i + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.listItemName, { color: theme.textPrimary }]} numberOfLines={1}>{tool.name}</Text>
                  <Text style={[s.listItemSub, { color: theme.textMuted }]}>{tool.category}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[s.listItemValue, { color: CHART_COLORS[i] }]}>{tool.votes.toLocaleString()}</Text>
                  <Text style={[s.listItemSub, { color: theme.textMuted }]}>صوت</Text>
                </View>
                <HBar pct={(tool.votes / maxVotes) * 100} color={CHART_COLORS[i]} delay={i * 80} />
              </View>
            ))}
          </Animated.View>
        )}

        {/* Top Developers */}
        {data && data.topDevelopers.length > 0 && (
          <Animated.View entering={FadeInDown.duration(300).delay(120)} style={[s.chartCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={s.chartHeader}>
              <View style={[s.chartIconBg, { backgroundColor: '#A78BFA20' }]}>
                <MaterialIcons name="people" size={18} color="#A78BFA" />
              </View>
              <View>
                <Text style={[s.chartTitle, { color: theme.textPrimary }]}>أكثر المطورين متابعة</Text>
                <Text style={[s.chartSub, { color: theme.textMuted }]}>بناءً على عدد المتابعين</Text>
              </View>
            </View>
            {data.topDevelopers.map((dev, i) => (
              <Animated.View key={dev.name} entering={FadeInDown.duration(250).delay(i * 40)}>
                <View style={[s.listRow, { borderBottomColor: theme.border }]}>
                  <View style={[s.devAvatar, { backgroundColor: CHART_COLORS[i % CHART_COLORS.length] + '25' }]}>
                    <Text style={[s.devInitial, { color: CHART_COLORS[i % CHART_COLORS.length] }]}>
                      {dev.name.slice(0, 1)}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.listItemName, { color: theme.textPrimary }]} numberOfLines={1}>{dev.name}</Text>
                    <Text style={[s.listItemSub, { color: theme.textMuted }]}>{dev.toolsCount} أداة</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Text style={[s.listItemValue, { color: CHART_COLORS[i % CHART_COLORS.length] }]}>{dev.followers.toLocaleString()}</Text>
                    <Text style={[s.listItemSub, { color: theme.textMuted }]}>متابع</Text>
                  </View>
                </View>
              </Animated.View>
            ))}
          </Animated.View>
        )}

        {/* Category Breakdown */}
        {data && data.categoryBreakdown.length > 0 && (
          <Animated.View entering={FadeInDown.duration(300).delay(180)} style={[s.chartCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={s.chartHeader}>
              <View style={[s.chartIconBg, { backgroundColor: '#10B98120' }]}>
                <MaterialIcons name="category" size={18} color="#10B981" />
              </View>
              <View>
                <Text style={[s.chartTitle, { color: theme.textPrimary }]}>توزيع الأدوات حسب الفئة</Text>
                <Text style={[s.chartSub, { color: theme.textMuted }]}>{data.categoryBreakdown.length} فئة</Text>
              </View>
            </View>
            {data.categoryBreakdown.map((cat, i) => (
              <Animated.View key={cat.name} entering={FadeInDown.duration(240).delay(i * 30)}>
                <View style={s.barRow}>
                  <View style={[s.catDot, { backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }]} />
                  <Text style={[s.barLabel, { color: theme.textSecondary }]} numberOfLines={1}>{cat.name}</Text>
                  <HBar pct={(cat.count / maxCatCount) * 100} color={CHART_COLORS[i % CHART_COLORS.length]} delay={i * 50} />
                  <Text style={[s.barValue, { color: CHART_COLORS[i % CHART_COLORS.length] }]}>{cat.count}</Text>
                </View>
              </Animated.View>
            ))}
          </Animated.View>
        )}

        {/* Pricing Breakdown */}
        {data && data.pricingBreakdown.length > 0 && (
          <Animated.View entering={FadeInDown.duration(300).delay(240)} style={[s.chartCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={s.chartHeader}>
              <View style={[s.chartIconBg, { backgroundColor: '#F59E0B20' }]}>
                <MaterialIcons name="local-offer" size={18} color="#F59E0B" />
              </View>
              <View>
                <Text style={[s.chartTitle, { color: theme.textPrimary }]}>توزيع نماذج التسعير</Text>
              </View>
            </View>
            <View style={s.columnChart}>
              {data.pricingBreakdown.map((p, i) => {
                const max = Math.max(...data.pricingBreakdown.map(x => x.count), 1);
                return (
                  <VBar
                    key={p.type}
                    heightPct={(p.count / max) * 100}
                    color={CHART_COLORS[i % CHART_COLORS.length]}
                    delay={i * 60}
                    label={p.type}
                    value={p.count}
                  />
                );
              })}
            </View>
          </Animated.View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontFamily: 'Cairo_700Bold' },
  sub: { fontSize: 11, fontFamily: 'Cairo_400Regular', marginTop: 1 },
  overviewGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  overviewCard: { width: '47.5%', borderRadius: 16, padding: 14, gap: 6, alignItems: 'center', borderWidth: 1.5 },
  overviewIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  overviewValue: { fontSize: 26, fontFamily: 'Cairo_700Bold' },
  overviewLabel: { fontSize: 11, fontFamily: 'Cairo_500Medium', textAlign: 'center' },
  chartCard: { borderRadius: 16, padding: 16, borderWidth: 1, gap: 12 },
  chartHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  chartIconBg: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  chartTitle: { fontSize: 15, fontFamily: 'Cairo_700Bold' },
  chartSub: { fontSize: 11, fontFamily: 'Cairo_400Regular', marginTop: 1 },
  columnChart: { flexDirection: 'row', alignItems: 'flex-end', height: 160, gap: 6, paddingTop: 8 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1 },
  rankBadge: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  rankText: { fontSize: 12, fontFamily: 'Cairo_700Bold' },
  listItemName: { fontSize: 13, fontFamily: 'Cairo_600SemiBold' },
  listItemSub: { fontSize: 10, fontFamily: 'Cairo_400Regular', marginTop: 1 },
  listItemValue: { fontSize: 14, fontFamily: 'Cairo_700Bold' },
  devAvatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  devInitial: { fontSize: 16, fontFamily: 'Cairo_700Bold' },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  catDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  barLabel: { width: 80, fontSize: 12, fontFamily: 'Cairo_500Medium' },
  barValue: { fontSize: 12, fontFamily: 'Cairo_700Bold', width: 28, textAlign: 'right' },
  emptyTitle: { fontSize: 18, fontFamily: 'Cairo_700Bold' },
  backBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  backBtnText: { fontSize: 14, fontFamily: 'Cairo_700Bold', color: '#FFF' },
});

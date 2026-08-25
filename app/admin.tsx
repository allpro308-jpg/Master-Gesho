/**
 * app/admin.tsx — مستر جيشو
 * Enterprise Admin Dashboard
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth, useAlert } from '@/template';
import { getSupabaseClient } from '@/template';
import { fetchAllThemes } from '../services/themeEngineService';
import { fetchAllFlags, fetchAllBanners } from '../services/remoteConfigService';
import { fetchTools } from '../services/toolsService';

const QUICK_ACTIONS = [
  { id: 'appearance', icon: 'palette', label: 'الثيمات والمظهر', color: '#A78BFA', route: '/admin-appearance' },
  { id: 'home_builder', icon: 'home', label: 'منشئ الصفحة الرئيسية', color: '#3B82F6', route: '/admin-home-builder' },
  { id: 'navigation', icon: 'navigation', label: 'منشئ التنقل', color: '#10B981', route: '/admin-navigation' },
  { id: 'content', icon: 'article', label: 'إدارة المحتوى', color: '#F97316', route: '/admin-content' },
  { id: 'analytics', icon: 'bar-chart', label: 'تحليلات المنصة', color: '#06B6D4', route: '/admin-analytics' },
  { id: 'flags', icon: 'toggle-on', label: 'إشارات الميزات', color: '#F59E0B', route: '/admin-flags' },
  { id: 'banners', icon: 'campaign', label: 'البانرات والإعلانات', color: '#EC4899', route: '/admin-banners' },
  { id: 'users', icon: 'people', label: 'إدارة المستخدمين', color: '#64748B', route: '/admin-users' },
];

export default function AdminDashboard() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({ themes: 0, flags: 0, banners: 0, tools: 0, activeTheme: '' });
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  const s = useMemo(() => createStyles(theme), [theme]);

  const checkAdmin = useCallback(async () => {
    if (!user?.id) { setIsAdmin(false); setLoading(false); return; }
    const { data } = await getSupabaseClient()
      .from('user_profiles').select('is_admin').eq('id', user.id).single();
    setIsAdmin(data?.is_admin || false);
  }, [user?.id]);

  const loadData = useCallback(async () => {
    try {
      const [themes, flags, banners, tools, logs] = await Promise.all([
        fetchAllThemes(),
        fetchAllFlags(),
        fetchAllBanners(),
        fetchTools(),
        getSupabaseClient().from('admin_audit_logs').select('*').order('created_at', { ascending: false }).limit(10),
      ]);
      const activeTheme = themes.find(t => t.isActive);
      setStats({
        themes: themes.length,
        flags: flags.filter(f => f.enabled).length,
        banners: banners.filter(b => b.status === 'published').length,
        tools: tools.length,
        activeTheme: activeTheme?.name || 'لا يوجد',
      });
      setAuditLogs(logs.data || []);
    } catch {}
  }, []);

  useEffect(() => {
    checkAdmin().then(() => loadData().finally(() => setLoading(false)));
  }, [checkAdmin, loadData]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  if (loading || isAdmin === null) {
    return (
      <SafeAreaView edges={['top']} style={[s.container, s.centered]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </SafeAreaView>
    );
  }

  if (!isAdmin) {
    return (
      <SafeAreaView edges={['top']} style={[s.container, s.centered]}>
        <MaterialIcons name="lock" size={64} color={theme.textMuted} />
        <Text style={[s.accessTitle, { color: theme.textPrimary }]}>وصول محدود</Text>
        <Text style={[s.accessSub, { color: theme.textMuted }]}>هذه الصفحة للمسؤولين فقط</Text>
        <Pressable onPress={() => router.back()} style={[s.backBtn, { backgroundColor: theme.primary }]}>
          <Text style={s.backBtnText}>العودة</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={s.container}>
      {/* Header */}
      <LinearGradient colors={[theme.primary + '22', 'transparent']} style={s.headerGrad}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} style={[s.backCircle, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <MaterialIcons name="arrow-forward" size={20} color={theme.textPrimary} />
          </Pressable>
          <View>
            <Text style={[s.headerTitle, { color: theme.textPrimary }]}>لوحة التحكم</Text>
            <Text style={[s.headerSub, { color: theme.textMuted }]}>مستر جيشو · Admin</Text>
          </View>
          <View style={[s.adminBadge, { backgroundColor: theme.primary + '20', borderColor: theme.primary + '40' }]}>
            <MaterialIcons name="verified" size={14} color={theme.primary} />
            <Text style={[s.adminBadgeText, { color: theme.primary }]}>مسؤول</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />}
      >
        {/* Active Theme Banner */}
        <Animated.View entering={FadeInDown.duration(300)} style={{ paddingHorizontal: 16, marginBottom: 20 }}>
          <LinearGradient colors={[theme.primary, theme.primaryDark]} style={s.themeBanner}>
            <View style={s.themeBannerLeft}>
              <MaterialIcons name="palette" size={22} color="#FFF" />
              <View>
                <Text style={s.themeBannerLabel}>الثيم النشط حالياً</Text>
                <Text style={s.themeBannerName}>{stats.activeTheme}</Text>
              </View>
            </View>
            <Pressable
              onPress={() => { Haptics.selectionAsync(); router.push('/admin-appearance' as any); }}
              style={s.themeBannerBtn}
            >
              <Text style={s.themeBannerBtnText}>تغيير</Text>
              <MaterialIcons name="arrow-back" size={14} color={theme.primary} />
            </Pressable>
          </LinearGradient>
        </Animated.View>

        {/* Stats */}
        <Animated.View entering={FadeInDown.duration(300).delay(50)} style={s.statsRow}>
          {[
            { val: stats.themes, label: 'ثيم', icon: 'palette', color: '#A78BFA' },
            { val: stats.flags, label: 'ميزة نشطة', icon: 'toggle-on', color: '#10B981' },
            { val: stats.banners, label: 'بانر', icon: 'campaign', color: '#EC4899' },
            { val: stats.tools, label: 'أداة', icon: 'apps', color: '#3B82F6' },
          ].map((st, i) => (
            <View key={i} style={[s.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <MaterialIcons name={st.icon as any} size={18} color={st.color} />
              <Text style={[s.statVal, { color: theme.textPrimary }]}>{st.val}</Text>
              <Text style={[s.statLabel, { color: theme.textMuted }]}>{st.label}</Text>
            </View>
          ))}
        </Animated.View>

        {/* Quick Actions */}
        <Animated.View entering={FadeInDown.duration(300).delay(100)} style={s.section}>
          <Text style={[s.sectionTitle, { color: theme.textPrimary }]}>الأدوات الرئيسية</Text>
          <View style={s.actionsGrid}>
            {QUICK_ACTIONS.map((action, i) => (
              <Pressable
                key={action.id}
                onPress={() => { Haptics.selectionAsync(); router.push(action.route as any); }}
                style={({ pressed }) => [
                  s.actionCard,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                  pressed && { opacity: 0.85, transform: [{ scale: 0.96 }] },
                ]}
              >
                <View style={[s.actionIconBg, { backgroundColor: action.color + '18' }]}>
                  <MaterialIcons name={action.icon as any} size={26} color={action.color} />
                </View>
                <Text style={[s.actionLabel, { color: theme.textPrimary }]} numberOfLines={2}>
                  {action.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>

        {/* Recent Activity */}
        <Animated.View entering={FadeInDown.duration(300).delay(150)} style={s.section}>
          <Text style={[s.sectionTitle, { color: theme.textPrimary }]}>آخر النشاطات</Text>
          {auditLogs.length === 0 ? (
            <View style={[s.emptyLog, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <MaterialIcons name="history" size={36} color={theme.textMuted} />
              <Text style={[s.emptyLogText, { color: theme.textMuted }]}>لا توجد نشاطات مسجّلة</Text>
            </View>
          ) : (
            auditLogs.map((log, i) => (
              <View key={log.id} style={[s.logRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <View style={[s.logDot, { backgroundColor: theme.primary }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.logAction, { color: theme.textPrimary }]}>{log.description || log.action}</Text>
                  <Text style={[s.logTime, { color: theme.textMuted }]}>
                    {new Date(log.created_at).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                <View style={[s.logChip, { backgroundColor: theme.primary + '15' }]}>
                  <Text style={[s.logChipText, { color: theme.primary }]}>{log.resource_type || 'نظام'}</Text>
                </View>
              </View>
            ))
          )}
        </Animated.View>

        {/* Platform Info */}
        <Animated.View entering={FadeInDown.duration(300).delay(200)} style={[s.infoCard, { backgroundColor: theme.surface, borderColor: theme.border, marginHorizontal: 16 }]}>
          <MaterialIcons name="info-outline" size={18} color={theme.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[s.infoTitle, { color: theme.textPrimary }]}>مستر جيشو v1.0.0</Text>
            <Text style={[s.infoSub, { color: theme.textMuted }]}>منصة أدوات الذكاء الاصطناعي العربية</Text>
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  centered: { alignItems: 'center', justifyContent: 'center', gap: 12 },
  headerGrad: { paddingBottom: 4 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  backCircle: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontFamily: 'Cairo_700Bold' },
  headerSub: { fontSize: 12, fontFamily: 'Cairo_400Regular', marginTop: 1 },
  adminBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999, borderWidth: 1, marginRight: 'auto' as any },
  adminBadgeText: { fontSize: 12, fontFamily: 'Cairo_600SemiBold' },
  themeBanner: { borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  themeBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  themeBannerLabel: { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontFamily: 'Cairo_400Regular' },
  themeBannerName: { fontSize: 15, color: '#FFF', fontFamily: 'Cairo_700Bold' },
  themeBannerBtn: { backgroundColor: '#FFF', borderRadius: 9999, paddingHorizontal: 14, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 4 },
  themeBannerBtnText: { fontSize: 12, fontFamily: 'Cairo_700Bold', color: theme.primary },
  statsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 20 },
  statCard: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 14, borderRadius: 14, borderWidth: 1 },
  statVal: { fontSize: 20, fontFamily: 'Cairo_700Bold' },
  statLabel: { fontSize: 10, fontFamily: 'Cairo_500Medium', textAlign: 'center' },
  section: { paddingHorizontal: 16, marginBottom: 20 },
  sectionTitle: { fontSize: 17, fontFamily: 'Cairo_700Bold', marginBottom: 12 },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionCard: { width: '30.5%', alignItems: 'center', gap: 8, paddingVertical: 16, paddingHorizontal: 8, borderRadius: 16, borderWidth: 1 },
  actionIconBg: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: 11, fontFamily: 'Cairo_600SemiBold', textAlign: 'center', lineHeight: 16 },
  logRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 8 },
  logDot: { width: 8, height: 8, borderRadius: 4 },
  logAction: { fontSize: 13, fontFamily: 'Cairo_500Medium' },
  logTime: { fontSize: 11, fontFamily: 'Cairo_400Regular', marginTop: 2 },
  logChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 9999 },
  logChipText: { fontSize: 10, fontFamily: 'Cairo_600SemiBold' },
  emptyLog: { alignItems: 'center', gap: 8, paddingVertical: 32, borderRadius: 14, borderWidth: 1 },
  emptyLogText: { fontSize: 13, fontFamily: 'Cairo_400Regular' },
  infoCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 14, borderWidth: 1 },
  infoTitle: { fontSize: 13, fontFamily: 'Cairo_600SemiBold' },
  infoSub: { fontSize: 11, fontFamily: 'Cairo_400Regular', marginTop: 2 },
  accessTitle: { fontSize: 20, fontFamily: 'Cairo_700Bold' },
  accessSub: { fontSize: 14, fontFamily: 'Cairo_400Regular' },
  backBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, marginTop: 8 },
  backBtnText: { fontSize: 14, fontFamily: 'Cairo_700Bold', color: '#FFF' },
});

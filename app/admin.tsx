import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useTheme } from '../contexts/ThemeContext';
import { useAlert, useAuth } from '@/template';
import {
  fetchPlatformStats, fetchPendingTools, fetchRecentActivity,
  updateToolStatus, checkIsAdmin, deleteToolAdmin,
} from '../services/adminService';
import { createNotification } from '../services/notificationsService';

type Tab = 'overview' | 'pending' | 'recent';

export default function AdminScreen() {
  const { theme } = useTheme();
  const { showAlert } = useAlert();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({ totalTools: 0, totalUsers: 0, totalVotes: 0, totalComments: 0 });
  const [pendingTools, setPendingTools] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<{ recentTools: any[]; recentComments: any[] }>({ recentTools: [], recentComments: [] });

  const s = useMemo(() => createStyles(theme), [theme]);

  const loadData = useCallback(async () => {
    const [statsData, pending, activity] = await Promise.all([
      fetchPlatformStats(),
      fetchPendingTools(),
      fetchRecentActivity(),
    ]);
    setStats(statsData);
    setPendingTools(pending);
    setRecentActivity(activity);
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    checkIsAdmin(user.id).then(admin => {
      setIsAdmin(admin);
      if (admin) loadData().finally(() => setLoading(false));
      else setLoading(false);
    });
  }, [user?.id, loadData]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleApprove = useCallback(async (tool: any) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await updateToolStatus(tool.id, 'approved');
    if (tool.submittedBy) {
      await createNotification({
        userId: tool.submittedBy,
        type: 'tool_approved',
        title: 'تمت الموافقة على أداتك',
        body: `تم قبول أداة "${tool.name}" ونشرها على المنصة`,
        toolId: tool.id,
      });
    }
    setPendingTools(prev => prev.filter(t => t.id !== tool.id));
    showAlert('تمت الموافقة', `تم نشر "${tool.name}" على المنصة`);
  }, [showAlert]);

  const handleReject = useCallback(async (tool: any) => {
    showAlert('رفض الأداة', `هل تريد رفض "${tool.name}"؟`, [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'رفض', style: 'destructive', onPress: async () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          await updateToolStatus(tool.id, 'rejected');
          if (tool.submittedBy) {
            await createNotification({
              userId: tool.submittedBy,
              type: 'tool_rejected',
              title: 'تم رفض أداتك',
              body: `للأسف، لم يتم قبول أداة "${tool.name}" في هذه المرحلة`,
              toolId: tool.id,
            });
          }
          setPendingTools(prev => prev.filter(t => t.id !== tool.id));
        }
      },
    ]);
  }, [showAlert]);

  if (loading) {
    return (
      <SafeAreaView edges={['top']} style={[s.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </SafeAreaView>
    );
  }

  if (!isAdmin) {
    return (
      <SafeAreaView edges={['top']} style={[s.container, { alignItems: 'center', justifyContent: 'center', gap: 12 }]}>
        <MaterialIcons name="admin-panel-settings" size={64} color={theme.textMuted} />
        <Text style={s.noAccessTitle}>غير مصرح بالوصول</Text>
        <Text style={s.noAccessSub}>هذه الصفحة مخصصة للمسؤولين فقط</Text>
        <Pressable onPress={() => router.back()} style={[s.backBtn, { marginTop: 8 }]}>
          <Text style={{ color: theme.primary, fontFamily: 'Cairo_600SemiBold', fontSize: 16 }}>رجوع</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'overview', label: 'نظرة عامة', icon: 'dashboard' },
    { id: 'pending', label: `قيد المراجعة (${pendingTools.length})`, icon: 'pending-actions' },
    { id: 'recent', label: 'النشاط الأخير', icon: 'history' },
  ];

  return (
    <SafeAreaView edges={['top']} style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <MaterialIcons name="arrow-forward" size={22} color={theme.textPrimary} />
        </Pressable>
        <View>
          <Text style={s.headerTitle}>لوحة التحكم</Text>
          <Text style={s.headerSub}>مرحباً بك، مسؤول</Text>
        </View>
        <View style={s.adminBadge}>
          <MaterialIcons name="verified-user" size={14} color="#FFF" />
          <Text style={s.adminBadgeText}>Admin</Text>
        </View>
      </View>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabsRow}>
        {tabs.map(t => (
          <Pressable key={t.id} style={[s.tabChip, tab === t.id && { backgroundColor: theme.primary }]}
            onPress={() => { Haptics.selectionAsync(); setTab(t.id); }}>
            <MaterialIcons name={t.icon as any} size={14} color={tab === t.id ? '#FFF' : theme.textSecondary} />
            <Text style={[s.tabChipText, tab === t.id && { color: '#FFF' }]}>{t.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />}
      >
        {/* Overview Tab */}
        {tab === 'overview' && (
          <>
            <Text style={s.sectionLabel}>إحصائيات المنصة</Text>
            <View style={s.statsGrid}>
              {[
                { icon: 'apps', label: 'الأدوات', value: stats.totalTools, color: theme.primary },
                { icon: 'people', label: 'المستخدمون', value: stats.totalUsers, color: theme.accent },
                { icon: 'arrow-upward', label: 'التصويتات', value: stats.totalVotes, color: theme.upvote },
                { icon: 'comment', label: 'التعليقات', value: stats.totalComments, color: '#A78BFA' },
              ].map(stat => (
                <View key={stat.label} style={s.statCard}>
                  <LinearGradient colors={[stat.color + '30', stat.color + '10']} style={s.statGrad}>
                    <MaterialIcons name={stat.icon as any} size={28} color={stat.color} />
                    <Text style={[s.statValue, { color: stat.color }]}>{stat.value.toLocaleString()}</Text>
                    <Text style={s.statLabel}>{stat.label}</Text>
                  </LinearGradient>
                </View>
              ))}
            </View>

            {pendingTools.length > 0 && (
              <View style={s.alertBanner}>
                <MaterialIcons name="pending-actions" size={20} color="#F59E0B" />
                <Text style={s.alertText}>{pendingTools.length} أداة تنتظر المراجعة</Text>
                <Pressable onPress={() => setTab('pending')}>
                  <Text style={s.alertLink}>مراجعة</Text>
                </Pressable>
              </View>
            )}

            <Text style={s.sectionLabel}>معلومات النظام</Text>
            <View style={s.infoCard}>
              {[
                { label: 'إصدار المنصة', value: '1.0.0' },
                { label: 'البيئة', value: 'OnSpace Cloud' },
                { label: 'الوضع', value: 'مفعّل' },
              ].map(item => (
                <View key={item.label} style={s.infoRow}>
                  <Text style={s.infoValue}>{item.value}</Text>
                  <Text style={s.infoLabel}>{item.label}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Pending Tab */}
        {tab === 'pending' && (
          <>
            <Text style={s.sectionLabel}>الأدوات قيد المراجعة ({pendingTools.length})</Text>
            {pendingTools.length === 0 ? (
              <View style={s.emptyState}>
                <MaterialIcons name="check-circle" size={56} color={theme.accent} />
                <Text style={s.emptyTitle}>لا توجد أدوات قيد المراجعة</Text>
                <Text style={s.emptySub}>جميع الأدوات المرسلة تمت معالجتها</Text>
              </View>
            ) : (
              pendingTools.map(tool => (
                <View key={tool.id} style={s.pendingCard}>
                  <View style={s.pendingHeader}>
                    <View style={[s.toolLogo, { backgroundColor: tool.logoColor + '20' }]}>
                      <MaterialIcons name={tool.logoIcon as any} size={22} color={tool.logoColor} />
                    </View>
                    <View style={s.toolInfo}>
                      <Text style={s.toolName}>{tool.name}</Text>
                      <Text style={s.toolCategory}>{tool.category} · {tool.pricing}</Text>
                    </View>
                    <View style={s.pendingBadge}>
                      <Text style={s.pendingBadgeText}>قيد المراجعة</Text>
                    </View>
                  </View>
                  <Text style={s.toolDesc} numberOfLines={3}>{tool.shortDescription}</Text>
                  {tool.url ? <Text style={s.toolUrl}>{tool.url}</Text> : null}
                  <View style={s.tagsRow}>
                    {(tool.tags || []).slice(0, 4).map((tag: string) => (
                      <View key={tag} style={s.tag}><Text style={s.tagText}>#{tag}</Text></View>
                    ))}
                  </View>
                  <View style={s.actionRow}>
                    <Pressable style={s.rejectBtn} onPress={() => handleReject(tool)}>
                      <MaterialIcons name="close" size={18} color={theme.error} />
                      <Text style={[s.actionBtnText, { color: theme.error }]}>رفض</Text>
                    </Pressable>
                    <Pressable style={{ flex: 1, borderRadius: 10, overflow: 'hidden' }} onPress={() => handleApprove(tool)}>
                      <LinearGradient colors={[theme.accent, theme.accentDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.approveBtn}>
                        <MaterialIcons name="check" size={18} color="#FFF" />
                        <Text style={[s.actionBtnText, { color: '#FFF' }]}>موافقة ونشر</Text>
                      </LinearGradient>
                    </Pressable>
                  </View>
                </View>
              ))
            )}
          </>
        )}

        {/* Recent Activity Tab */}
        {tab === 'recent' && (
          <>
            <Text style={s.sectionLabel}>الأدوات المضافة مؤخراً</Text>
            {recentActivity.recentTools.map((tool: any) => (
              <View key={tool.id} style={s.activityCard}>
                <View style={[s.activityIcon, { backgroundColor: tool.logo_color + '20' }]}>
                  <MaterialIcons name={tool.logo_icon as any} size={18} color={tool.logo_color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.activityTitle}>{tool.name}</Text>
                  <Text style={s.activitySub}>{tool.created_at?.split('T')[0]}</Text>
                </View>
                <View style={[s.statusBadge, { backgroundColor: tool.status === 'approved' ? theme.accent + '20' : tool.status === 'pending' ? '#F59E0B20' : theme.error + '20' }]}>
                  <Text style={[s.statusText, { color: tool.status === 'approved' ? theme.accent : tool.status === 'pending' ? '#F59E0B' : theme.error }]}>
                    {tool.status === 'approved' ? 'منشور' : tool.status === 'pending' ? 'قيد المراجعة' : 'مرفوض'}
                  </Text>
                </View>
              </View>
            ))}

            <Text style={[s.sectionLabel, { marginTop: 20 }]}>أحدث التعليقات</Text>
            {recentActivity.recentComments.map((comment: any) => (
              <View key={comment.id} style={s.commentCard}>
                <View style={s.commentAvatar}>
                  <Text style={s.commentAvatarText}>
                    {(comment.user_profiles?.username || comment.user_profiles?.email || 'م')[0]}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.commentUser}>{comment.user_profiles?.username || comment.user_profiles?.email || 'مستخدم'}</Text>
                  <Text style={s.commentText} numberOfLines={2}>{comment.text}</Text>
                  <Text style={s.commentDate}>{comment.created_at?.split('T')[0]}</Text>
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.border },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.border },
  headerTitle: { fontSize: 18, fontWeight: '700', fontFamily: 'Cairo_700Bold', color: theme.textPrimary },
  headerSub: { fontSize: 12, fontFamily: 'Cairo_400Regular', color: theme.textMuted },
  adminBadge: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: theme.primary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999 },
  adminBadgeText: { fontSize: 11, fontFamily: 'Cairo_700Bold', color: '#FFF' },
  tabsRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  tabChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 9999, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border },
  tabChipText: { fontSize: 12, fontFamily: 'Cairo_600SemiBold', color: theme.textSecondary },
  content: { paddingHorizontal: 16, paddingTop: 8 },
  sectionLabel: { fontSize: 14, fontFamily: 'Cairo_700Bold', color: theme.textMuted, marginBottom: 12, letterSpacing: 0.5 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  statCard: { width: '47%', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: theme.border },
  statGrad: { padding: 18, alignItems: 'center', gap: 6 },
  statValue: { fontSize: 28, fontWeight: '700', fontFamily: 'Cairo_700Bold' },
  statLabel: { fontSize: 12, fontFamily: 'Cairo_500Medium', color: theme.textMuted },
  alertBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F59E0B15', borderRadius: 12, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: '#F59E0B30' },
  alertText: { flex: 1, fontSize: 13, fontFamily: 'Cairo_600SemiBold', color: '#F59E0B', textAlign: 'right' },
  alertLink: { fontSize: 13, fontFamily: 'Cairo_700Bold', color: '#F59E0B' },
  infoCard: { backgroundColor: theme.surface, borderRadius: 14, borderWidth: 1, borderColor: theme.border, overflow: 'hidden', marginBottom: 20 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.border },
  infoLabel: { fontSize: 14, fontFamily: 'Cairo_500Medium', color: theme.textSecondary },
  infoValue: { fontSize: 14, fontFamily: 'Cairo_700Bold', color: theme.textPrimary },
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyTitle: { fontSize: 18, fontFamily: 'Cairo_600SemiBold', color: theme.textPrimary },
  emptySub: { fontSize: 13, fontFamily: 'Cairo_400Regular', color: theme.textMuted },
  pendingCard: { backgroundColor: theme.surface, borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: theme.border },
  pendingHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  toolLogo: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  toolInfo: { flex: 1 },
  toolName: { fontSize: 15, fontFamily: 'Cairo_700Bold', color: theme.textPrimary },
  toolCategory: { fontSize: 12, fontFamily: 'Cairo_400Regular', color: theme.textMuted },
  pendingBadge: { backgroundColor: '#F59E0B20', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 9999 },
  pendingBadgeText: { fontSize: 10, fontFamily: 'Cairo_600SemiBold', color: '#F59E0B' },
  toolDesc: { fontSize: 13, fontFamily: 'Cairo_400Regular', color: theme.textSecondary, textAlign: 'right', lineHeight: 20, marginBottom: 8 },
  toolUrl: { fontSize: 11, fontFamily: 'Cairo_400Regular', color: theme.primary, marginBottom: 8, textAlign: 'right' },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 9999, backgroundColor: theme.backgroundSecondary },
  tagText: { fontSize: 10, fontFamily: 'Cairo_500Medium', color: theme.textMuted },
  actionRow: { flexDirection: 'row', gap: 10 },
  rejectBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, borderColor: theme.error + '60' },
  approveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 },
  actionBtnText: { fontSize: 14, fontFamily: 'Cairo_600SemiBold' },
  activityCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: theme.surface, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: theme.border },
  activityIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  activityTitle: { fontSize: 14, fontFamily: 'Cairo_600SemiBold', color: theme.textPrimary },
  activitySub: { fontSize: 11, fontFamily: 'Cairo_400Regular', color: theme.textMuted, marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 9999 },
  statusText: { fontSize: 10, fontFamily: 'Cairo_600SemiBold' },
  commentCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: theme.surface, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: theme.border },
  commentAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center' },
  commentAvatarText: { fontSize: 14, fontFamily: 'Cairo_700Bold', color: '#FFF' },
  commentUser: { fontSize: 13, fontFamily: 'Cairo_600SemiBold', color: theme.textPrimary },
  commentText: { fontSize: 13, fontFamily: 'Cairo_400Regular', color: theme.textSecondary, marginTop: 2, textAlign: 'right' },
  commentDate: { fontSize: 10, fontFamily: 'Cairo_400Regular', color: theme.textMuted, marginTop: 4 },
  noAccessTitle: { fontSize: 22, fontFamily: 'Cairo_700Bold', color: theme.textPrimary },
  noAccessSub: { fontSize: 14, fontFamily: 'Cairo_400Regular', color: theme.textMuted },
});

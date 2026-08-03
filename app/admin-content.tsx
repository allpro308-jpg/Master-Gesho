/**
 * app/admin-content.tsx — Content Management
 * Manage tools from admin panel with status, actions, and stats
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  ActivityIndicator, TextInput, RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth, useAlert } from '@/template';
import { getSupabaseClient } from '@/template';
import { logAdminAction } from '../services/themeEngineService';

interface ContentTool {
  id: string;
  name: string;
  category: string;
  pricing: string;
  logoIcon: string;
  logoColor: string;
  status: 'approved' | 'pending' | 'rejected';
  votes: number;
  rating: number;
  ratingCount: number;
  views: number;
  developerName: string;
  createdAt: string;
  shortDescription: string;
}

const STATUS_CFG = {
  approved: { label: 'منشور', color: '#10B981', icon: 'check-circle' as const, bg: '#10B98115' },
  pending: { label: 'معلق', color: '#F59E0B', icon: 'pending-actions' as const, bg: '#F59E0B15' },
  rejected: { label: 'مرفوض', color: '#EF4444', icon: 'cancel' as const, bg: '#EF444415' },
};

type FilterStatus = 'all' | 'approved' | 'pending' | 'rejected';
type SortBy = 'newest' | 'votes' | 'rating';

export default function AdminContentScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [tools, setTools] = useState<ContentTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [sortBy, setSortBy] = useState<SortBy>('newest');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const s = useMemo(() => createStyles(theme), [theme]);

  useEffect(() => {
    if (!user?.id) { setIsAdmin(false); setLoading(false); return; }
    getSupabaseClient().from('user_profiles').select('is_admin').eq('id', user.id).single()
      .then(({ data: d }) => setIsAdmin(d?.is_admin || false));
  }, [user?.id]);

  const loadTools = useCallback(async () => {
    const { data } = await getSupabaseClient()
      .from('tools')
      .select('id, name, category, pricing, logo_icon, logo_color, status, votes, rating, rating_count, developer_name, created_at, short_description')
      .order('created_at', { ascending: false });
    setTools((data || []).map((t: any) => ({
      id: t.id, name: t.name, category: t.category,
      pricing: t.pricing || 'مجاني',
      logoIcon: t.logo_icon || 'smart-toy',
      logoColor: t.logo_color || '#3B82F6',
      status: (t.status || 'pending') as ContentTool['status'],
      votes: t.votes || 0,
      rating: t.rating || 0,
      ratingCount: t.rating_count || 0,
      views: 0,
      developerName: t.developer_name || '',
      createdAt: t.created_at || '',
      shortDescription: t.short_description || '',
    })));
  }, []);

  useEffect(() => {
    if (isAdmin === false) { setLoading(false); return; }
    if (isAdmin === true) {
      loadTools().finally(() => setLoading(false));
    }
  }, [isAdmin, loadTools]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadTools();
    setRefreshing(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [loadTools]);

  const handleStatusChange = useCallback(async (tool: ContentTool, newStatus: ContentTool['status']) => {
    if (!user?.id || !isAdmin) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setActionLoading(tool.id);
    const { error } = await getSupabaseClient()
      .from('tools').update({ status: newStatus }).eq('id', tool.id);
    if (error) {
      showAlert('خطأ', error.message);
    } else {
      setTools(prev => prev.map(t => t.id === tool.id ? { ...t, status: newStatus } : t));
      await logAdminAction(user.id, `tool_${newStatus}`, `تغيير حالة أداة: ${tool.name} → ${STATUS_CFG[newStatus].label}`, 'tool', tool.id);
    }
    setActionLoading(null);
  }, [user?.id, isAdmin, showAlert]);

  const handleDelete = useCallback(async (tool: ContentTool) => {
    if (!user?.id || !isAdmin) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    showAlert(
      'حذف الأداة',
      `هل تريد حذف "${tool.name}" نهائياً؟`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حذف', style: 'destructive',
          onPress: async () => {
            const { error } = await getSupabaseClient().from('tools').delete().eq('id', tool.id);
            if (!error) {
              setTools(prev => prev.filter(t => t.id !== tool.id));
              await logAdminAction(user.id!, 'delete_tool', `حذف أداة: ${tool.name}`, 'tool', tool.id);
            }
          },
        },
      ]
    );
  }, [user?.id, isAdmin, showAlert]);

  const filtered = useMemo(() => {
    let result = [...tools];
    if (filter !== 'all') result = result.filter(t => t.status === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(t =>
        t.name.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        t.developerName.toLowerCase().includes(q)
      );
    }
    switch (sortBy) {
      case 'votes': result.sort((a, b) => b.votes - a.votes); break;
      case 'rating': result.sort((a, b) => b.rating - a.rating); break;
      default: result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    return result;
  }, [tools, filter, search, sortBy]);

  const counts = useMemo(() => ({
    all: tools.length,
    approved: tools.filter(t => t.status === 'approved').length,
    pending: tools.filter(t => t.status === 'pending').length,
    rejected: tools.filter(t => t.status === 'rejected').length,
  }), [tools]);

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
        <Text style={[s.title, { color: theme.textPrimary }]}>وصول محدود</Text>
        <Pressable onPress={() => router.back()} style={[s.applyBtn, { backgroundColor: theme.primary }]}>
          <Text style={s.applyBtnText}>العودة</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={s.container}>
      {/* Header */}
      <View style={[s.header, { borderBottomColor: theme.border }]}>
        <Pressable onPress={() => router.back()} style={[s.iconBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <MaterialIcons name="arrow-forward" size={20} color={theme.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[s.title, { color: theme.textPrimary }]}>إدارة المحتوى</Text>
          <Text style={[s.sub, { color: theme.textMuted }]}>{filtered.length} / {tools.length} أداة</Text>
        </View>
        <Pressable
          onPress={() => router.push('/submit-tool' as any)}
          style={[s.addBtn, { backgroundColor: theme.primary }]}
        >
          <MaterialIcons name="add" size={16} color="#FFF" />
          <Text style={s.addBtnText}>إضافة</Text>
        </Pressable>
      </View>

      {/* Search */}
      <View style={[s.searchBar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <MaterialIcons name="search" size={18} color={theme.textMuted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="بحث في الأدوات..."
          placeholderTextColor={theme.textMuted}
          style={[s.searchInput, { color: theme.textPrimary }]}
          textAlign="right"
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')}>
            <MaterialIcons name="close" size={16} color={theme.textMuted} />
          </Pressable>
        )}
      </View>

      {/* Filter Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
        {(['all', 'approved', 'pending', 'rejected'] as FilterStatus[]).map(f => {
          const isActive = filter === f;
          const count = counts[f];
          const cfg = f === 'all' ? { label: 'الكل', color: theme.primary } : { ...STATUS_CFG[f] };
          return (
            <Pressable
              key={f}
              onPress={() => { Haptics.selectionAsync(); setFilter(f); }}
              style={[s.filterChip, {
                backgroundColor: isActive ? (f === 'all' ? theme.primary : STATUS_CFG[f]?.color || theme.primary) + '18' : theme.surface,
                borderColor: isActive ? (f === 'all' ? theme.primary : STATUS_CFG[f]?.color || theme.primary) + '60' : theme.border,
              }]}
            >
              <Text style={[s.filterChipText, { color: isActive ? (f === 'all' ? theme.primary : STATUS_CFG[f]?.color || theme.primary) : theme.textMuted }]}>
                {f === 'all' ? 'الكل' : STATUS_CFG[f].label}
              </Text>
              <View style={[s.filterCount, { backgroundColor: (f === 'all' ? theme.primary : STATUS_CFG[f]?.color || theme.primary) + '25' }]}>
                <Text style={[s.filterCountText, { color: f === 'all' ? theme.primary : STATUS_CFG[f]?.color || theme.primary }]}>{count}</Text>
              </View>
            </Pressable>
          );
        })}
        {/* Sort */}
        <View style={[s.sortDivider, { backgroundColor: theme.border }]} />
        {([['newest', 'الأحدث'], ['votes', 'الأصوات'], ['rating', 'التقييم']] as [SortBy, string][]).map(([val, label]) => (
          <Pressable
            key={val}
            onPress={() => { Haptics.selectionAsync(); setSortBy(val); }}
            style={[s.filterChip, { backgroundColor: sortBy === val ? theme.primary + '15' : theme.surface, borderColor: sortBy === val ? theme.primary + '50' : theme.border }]}
          >
            <MaterialIcons name={val === 'newest' ? 'schedule' : val === 'votes' ? 'arrow-upward' : 'star'} size={12} color={sortBy === val ? theme.primary : theme.textMuted} />
            <Text style={[s.filterChipText, { color: sortBy === val ? theme.primary : theme.textMuted }]}>{label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, paddingBottom: insets.bottom + 32, gap: 10 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />}
      >
        {filtered.length === 0 ? (
          <View style={[s.emptyState, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <MaterialIcons name="search-off" size={52} color={theme.textMuted} />
            <Text style={[s.emptyTitle, { color: theme.textPrimary }]}>لا توجد أدوات</Text>
            <Text style={[s.emptyDesc, { color: theme.textMuted }]}>
              {search ? 'حاول بحثاً مختلفاً' : 'لا توجد أدوات بهذا الفلتر'}
            </Text>
          </View>
        ) : (
          filtered.map((tool, i) => {
            const statusCfg = STATUS_CFG[tool.status];
            return (
              <Animated.View key={tool.id} entering={FadeInDown.duration(260).delay(Math.min(i * 30, 300))}>
                <View style={[s.toolCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  {/* Card Header */}
                  <View style={s.toolHeader}>
                    <View style={[s.toolLogo, { backgroundColor: tool.logoColor + '20' }]}>
                      <MaterialIcons name={tool.logoIcon as any} size={22} color={tool.logoColor} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.toolName, { color: theme.textPrimary }]} numberOfLines={1}>{tool.name}</Text>
                      <Text style={[s.toolMeta, { color: theme.textMuted }]}>{tool.category} · {tool.pricing}</Text>
                    </View>
                    <View style={[s.statusBadge, { backgroundColor: statusCfg.bg }]}>
                      <MaterialIcons name={statusCfg.icon} size={11} color={statusCfg.color} />
                      <Text style={[s.statusText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
                    </View>
                  </View>

                  {/* Description */}
                  {tool.shortDescription ? (
                    <Text style={[s.toolDesc, { color: theme.textSecondary }]} numberOfLines={2}>{tool.shortDescription}</Text>
                  ) : null}

                  {/* Stats */}
                  <View style={s.statsRow}>
                    <View style={s.statItem}>
                      <MaterialIcons name="arrow-upward" size={13} color={theme.primary} />
                      <Text style={[s.statValue, { color: theme.primary }]}>{tool.votes}</Text>
                      <Text style={[s.statLabel, { color: theme.textMuted }]}>صوت</Text>
                    </View>
                    <View style={s.statItem}>
                      <MaterialIcons name="star" size={13} color="#F59E0B" />
                      <Text style={[s.statValue, { color: '#F59E0B' }]}>{tool.rating.toFixed(1)}</Text>
                      <Text style={[s.statLabel, { color: theme.textMuted }]}>({tool.ratingCount})</Text>
                    </View>
                    {tool.developerName && (
                      <View style={s.statItem}>
                        <MaterialIcons name="person" size={13} color={theme.textMuted} />
                        <Text style={[s.statLabel, { color: theme.textMuted }]} numberOfLines={1}>{tool.developerName}</Text>
                      </View>
                    )}
                    <Text style={[s.dateText, { color: theme.textMuted }]}>
                      {new Date(tool.createdAt).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' })}
                    </Text>
                  </View>

                  {/* Action Buttons */}
                  {actionLoading === tool.id ? (
                    <View style={{ alignItems: 'center', paddingVertical: 8 }}>
                      <ActivityIndicator size="small" color={theme.primary} />
                    </View>
                  ) : (
                    <View style={s.actionsRow}>
                      {/* View */}
                      <Pressable
                        onPress={() => router.push(`/tool/${tool.id}` as any)}
                        style={[s.actionBtn, { backgroundColor: theme.background, borderColor: theme.border }]}
                      >
                        <MaterialIcons name="visibility" size={13} color={theme.textSecondary} />
                        <Text style={[s.actionBtnText, { color: theme.textSecondary }]}>عرض</Text>
                      </Pressable>

                      {/* Approve (if pending/rejected) */}
                      {tool.status !== 'approved' && (
                        <Pressable
                          onPress={() => handleStatusChange(tool, 'approved')}
                          style={[s.actionBtn, { backgroundColor: '#10B98115', borderColor: '#10B98140' }]}
                        >
                          <MaterialIcons name="check" size={13} color="#10B981" />
                          <Text style={[s.actionBtnText, { color: '#10B981' }]}>نشر</Text>
                        </Pressable>
                      )}

                      {/* Reject / Unpublish */}
                      {tool.status !== 'rejected' && (
                        <Pressable
                          onPress={() => handleStatusChange(tool, 'rejected')}
                          style={[s.actionBtn, { backgroundColor: '#F59E0B15', borderColor: '#F59E0B40' }]}
                        >
                          <MaterialIcons name="block" size={13} color="#F59E0B" />
                          <Text style={[s.actionBtnText, { color: '#F59E0B' }]}>إيقاف</Text>
                        </Pressable>
                      )}

                      {/* Delete */}
                      <Pressable
                        onPress={() => handleDelete(tool)}
                        style={[s.actionBtn, { backgroundColor: '#EF444415', borderColor: '#EF444440' }]}
                      >
                        <MaterialIcons name="delete" size={13} color="#EF4444" />
                        <Text style={[s.actionBtnText, { color: '#EF4444' }]}>حذف</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              </Animated.View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 17, fontFamily: 'Cairo_700Bold' },
  sub: { fontSize: 11, fontFamily: 'Cairo_400Regular', marginTop: 1 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  addBtnText: { fontSize: 13, fontFamily: 'Cairo_700Bold', color: '#FFF' },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, marginHorizontal: 16, marginVertical: 10 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: 'Cairo_400Regular', writingDirection: 'rtl' },
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 10, alignItems: 'center' },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 9999, borderWidth: 1 },
  filterChipText: { fontSize: 12, fontFamily: 'Cairo_600SemiBold' },
  filterCount: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  filterCountText: { fontSize: 10, fontFamily: 'Cairo_700Bold' },
  sortDivider: { width: 1, height: 20, marginHorizontal: 4 },
  toolCard: { borderRadius: 16, padding: 14, borderWidth: 1, gap: 10 },
  toolHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  toolLogo: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  toolName: { fontSize: 14, fontFamily: 'Cairo_700Bold' },
  toolMeta: { fontSize: 11, fontFamily: 'Cairo_400Regular', marginTop: 2 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 9999 },
  statusText: { fontSize: 10, fontFamily: 'Cairo_600SemiBold' },
  toolDesc: { fontSize: 12, fontFamily: 'Cairo_400Regular', lineHeight: 18 },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  statValue: { fontSize: 12, fontFamily: 'Cairo_700Bold' },
  statLabel: { fontSize: 11, fontFamily: 'Cairo_400Regular' },
  dateText: { fontSize: 10, fontFamily: 'Cairo_400Regular', marginLeft: 'auto' as any },
  actionsRow: { flexDirection: 'row', gap: 7, flexWrap: 'wrap' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9999, borderWidth: 1 },
  actionBtnText: { fontSize: 11, fontFamily: 'Cairo_600SemiBold' },
  emptyState: { alignItems: 'center', padding: 48, borderRadius: 16, borderWidth: 1, gap: 10 },
  emptyTitle: { fontSize: 16, fontFamily: 'Cairo_700Bold' },
  emptyDesc: { fontSize: 13, fontFamily: 'Cairo_400Regular', textAlign: 'center' },
  applyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, paddingHorizontal: 32, borderRadius: 14 },
  applyBtnText: { fontSize: 15, fontFamily: 'Cairo_700Bold', color: '#FFF' },
});

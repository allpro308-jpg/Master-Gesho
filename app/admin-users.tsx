/**
 * app/admin-users.tsx — User Management
 * Admin panel: list users, toggle admin role, view per-user stats
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

interface UserRow {
  id: string;
  username: string | null;
  email: string;
  is_admin: boolean;
  savedCount: number;
  votedCount: number;
  commentCount: number;
  joinedAt?: string;
}

type FilterRole = 'all' | 'admin' | 'user';
type SortBy = 'newest' | 'activity' | 'email';

export default function AdminUsersScreen() {
  const { theme } = useTheme();
  const { user: currentUser } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterRole>('all');
  const [sortBy, setSortBy] = useState<SortBy>('newest');
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const s = useMemo(() => createStyles(theme), [theme]);

  // Check admin
  useEffect(() => {
    if (!currentUser?.id) { setIsAdmin(false); setLoading(false); return; }
    getSupabaseClient()
      .from('user_profiles').select('is_admin').eq('id', currentUser.id).single()
      .then(({ data }) => setIsAdmin(data?.is_admin || false));
  }, [currentUser?.id]);

  const loadUsers = useCallback(async () => {
    const supabase = getSupabaseClient();

    // Fetch profiles
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id, username, email, is_admin')
      .order('id', { ascending: false });

    if (!profiles || profiles.length === 0) { setUsers([]); return; }

    // Fetch per-user counts in parallel
    const userIds = profiles.map((p: any) => p.id);

    const [savedRes, votedRes, commentRes] = await Promise.all([
      supabase.from('user_saved_tools').select('user_id').in('user_id', userIds),
      supabase.from('user_votes').select('user_id').in('user_id', userIds),
      supabase.from('comments').select('user_id').in('user_id', userIds),
    ]);

    // Aggregate counts
    const savedMap: Record<string, number> = {};
    const votedMap: Record<string, number> = {};
    const commentMap: Record<string, number> = {};

    (savedRes.data || []).forEach((r: any) => { savedMap[r.user_id] = (savedMap[r.user_id] || 0) + 1; });
    (votedRes.data || []).forEach((r: any) => { votedMap[r.user_id] = (votedMap[r.user_id] || 0) + 1; });
    (commentRes.data || []).forEach((r: any) => { commentMap[r.user_id] = (commentMap[r.user_id] || 0) + 1; });

    setUsers(profiles.map((p: any) => ({
      id: p.id,
      username: p.username,
      email: p.email,
      is_admin: p.is_admin || false,
      savedCount: savedMap[p.id] || 0,
      votedCount: votedMap[p.id] || 0,
      commentCount: commentMap[p.id] || 0,
    })));
  }, []);

  useEffect(() => {
    if (isAdmin === false) { setLoading(false); return; }
    if (isAdmin === true) {
      loadUsers().finally(() => setLoading(false));
    }
  }, [isAdmin, loadUsers]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadUsers();
    setRefreshing(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [loadUsers]);

  const handleToggleAdmin = useCallback(async (u: UserRow) => {
    if (!currentUser?.id || !isAdmin) return;
    if (u.id === currentUser.id) {
      showAlert('تنبيه', 'لا يمكنك تغيير صلاحيات حسابك الخاص');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const newVal = !u.is_admin;
    showAlert(
      newVal ? 'منح صلاحية المسؤول' : 'إلغاء صلاحية المسؤول',
      `هل تريد ${newVal ? 'منح' : 'إلغاء'} صلاحية المسؤول لـ "${u.email}"؟`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: newVal ? 'منح' : 'إلغاء', style: newVal ? 'default' : 'destructive',
          onPress: async () => {
            setTogglingId(u.id);
            const { error } = await getSupabaseClient()
              .from('user_profiles')
              .update({ is_admin: newVal })
              .eq('id', u.id);
            if (error) {
              showAlert('خطأ', error.message);
            } else {
              setUsers(prev => prev.map(x => x.id === u.id ? { ...x, is_admin: newVal } : x));
              await logAdminAction(
                currentUser.id!,
                newVal ? 'grant_admin' : 'revoke_admin',
                `${newVal ? 'منح' : 'إلغاء'} صلاحية المسؤول: ${u.email}`,
                'user',
                u.id,
              );
            }
            setTogglingId(null);
          },
        },
      ]
    );
  }, [currentUser?.id, isAdmin, showAlert]);

  const filtered = useMemo(() => {
    let result = [...users];
    if (filter === 'admin') result = result.filter(u => u.is_admin);
    else if (filter === 'user') result = result.filter(u => !u.is_admin);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(u =>
        u.email.toLowerCase().includes(q) ||
        (u.username || '').toLowerCase().includes(q)
      );
    }
    switch (sortBy) {
      case 'activity':
        result.sort((a, b) => (b.savedCount + b.votedCount + b.commentCount) - (a.savedCount + a.votedCount + a.commentCount));
        break;
      case 'email':
        result.sort((a, b) => a.email.localeCompare(b.email));
        break;
      default: break; // newest = DB order
    }
    return result;
  }, [users, filter, search, sortBy]);

  const counts = useMemo(() => ({
    all: users.length,
    admin: users.filter(u => u.is_admin).length,
    user: users.filter(u => !u.is_admin).length,
  }), [users]);

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
        <Text style={{ fontSize: 18, fontFamily: 'Cairo_700Bold', color: theme.textPrimary }}>وصول محدود</Text>
        <Pressable onPress={() => router.back()} style={[s.primaryBtn, { backgroundColor: theme.primary }]}>
          <Text style={s.primaryBtnText}>العودة</Text>
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
          <Text style={[s.title, { color: theme.textPrimary }]}>إدارة المستخدمين</Text>
          <Text style={[s.sub, { color: theme.textMuted }]}>{filtered.length} / {users.length} مستخدم</Text>
        </View>
      </View>

      {/* Search */}
      <View style={[s.searchBar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <MaterialIcons name="search" size={18} color={theme.textMuted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="بحث بالبريد الإلكتروني أو الاسم..."
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

      {/* Filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
        {([
          ['all', 'الكل', theme.primary],
          ['admin', 'المسؤولون', '#A78BFA'],
          ['user', 'المستخدمون', '#10B981'],
        ] as [FilterRole, string, string][]).map(([val, label, color]) => {
          const isActive = filter === val;
          return (
            <Pressable
              key={val}
              onPress={() => { Haptics.selectionAsync(); setFilter(val); }}
              style={[s.filterChip, {
                backgroundColor: isActive ? color + '18' : theme.surface,
                borderColor: isActive ? color + '60' : theme.border,
              }]}
            >
              <Text style={[s.filterChipText, { color: isActive ? color : theme.textMuted }]}>{label}</Text>
              <View style={[s.filterCount, { backgroundColor: color + '20' }]}>
                <Text style={[s.filterCountText, { color }]}>{counts[val]}</Text>
              </View>
            </Pressable>
          );
        })}
        <View style={[s.divider, { backgroundColor: theme.border }]} />
        {([
          ['newest', 'الأحدث', 'schedule'],
          ['activity', 'الأكثر نشاطاً', 'bolt'],
          ['email', 'أبجدياً', 'sort-by-alpha'],
        ] as [SortBy, string, string][]).map(([val, label, icon]) => (
          <Pressable
            key={val}
            onPress={() => { Haptics.selectionAsync(); setSortBy(val); }}
            style={[s.filterChip, {
              backgroundColor: sortBy === val ? theme.primary + '15' : theme.surface,
              borderColor: sortBy === val ? theme.primary + '50' : theme.border,
            }]}
          >
            <MaterialIcons name={icon as any} size={12} color={sortBy === val ? theme.primary : theme.textMuted} />
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
          <View style={[s.empty, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <MaterialIcons name="people-outline" size={52} color={theme.textMuted} />
            <Text style={{ fontSize: 16, fontFamily: 'Cairo_700Bold', color: theme.textPrimary }}>لا يوجد مستخدمون</Text>
            <Text style={{ fontSize: 13, fontFamily: 'Cairo_400Regular', color: theme.textMuted, textAlign: 'center' }}>
              {search ? 'جرب بحثاً مختلفاً' : 'لا توجد نتائج بهذا الفلتر'}
            </Text>
          </View>
        ) : (
          filtered.map((u, i) => {
            const displayName = u.username || u.email.split('@')[0];
            const initials = displayName.slice(0, 2).toUpperCase();
            const activityTotal = u.savedCount + u.votedCount + u.commentCount;
            const isCurrent = u.id === currentUser?.id;

            return (
              <Animated.View key={u.id} entering={FadeInDown.duration(260).delay(Math.min(i * 30, 300))}>
                <View style={[s.userCard, {
                  backgroundColor: theme.surface,
                  borderColor: u.is_admin ? theme.primary + '40' : theme.border,
                  borderWidth: u.is_admin ? 1.5 : 1,
                }]}>
                  {/* Avatar + Info */}
                  <View style={s.userHeader}>
                    <View style={[s.avatar, { backgroundColor: u.is_admin ? theme.primary + '25' : theme.primary + '15' }]}>
                      <Text style={[s.avatarText, { color: theme.primary }]}>{initials}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[s.userName, { color: theme.textPrimary }]} numberOfLines={1}>
                          {displayName}
                        </Text>
                        {isCurrent && (
                          <View style={[s.chip, { backgroundColor: theme.primary + '20' }]}>
                            <Text style={[s.chipText, { color: theme.primary }]}>أنت</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[s.userEmail, { color: theme.textMuted }]} numberOfLines={1}>{u.email}</Text>
                    </View>
                    {/* Admin Badge */}
                    {u.is_admin && (
                      <View style={[s.adminBadge, { backgroundColor: theme.primary + '18', borderColor: theme.primary + '40' }]}>
                        <MaterialIcons name="verified" size={12} color={theme.primary} />
                        <Text style={[s.adminBadgeText, { color: theme.primary }]}>مسؤول</Text>
                      </View>
                    )}
                  </View>

                  {/* Activity Stats */}
                  <View style={s.statsRow}>
                    {[
                      { icon: 'bookmark', val: u.savedCount, label: 'محفوظ', color: '#3B82F6' },
                      { icon: 'arrow-upward', val: u.votedCount, label: 'صوّت', color: '#10B981' },
                      { icon: 'chat-bubble', val: u.commentCount, label: 'علّق', color: '#A78BFA' },
                      { icon: 'bolt', val: activityTotal, label: 'إجمالي', color: '#F59E0B' },
                    ].map((st, si) => (
                      <View key={si} style={[s.statBubble, { backgroundColor: st.color + '12' }]}>
                        <MaterialIcons name={st.icon as any} size={11} color={st.color} />
                        <Text style={[s.statVal, { color: st.color }]}>{st.val}</Text>
                        <Text style={[s.statLabel, { color: theme.textMuted }]}>{st.label}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Toggle Admin */}
                  {!isCurrent && (
                    <Pressable
                      onPress={() => handleToggleAdmin(u)}
                      disabled={togglingId === u.id}
                      style={[s.toggleBtn, {
                        backgroundColor: u.is_admin ? '#EF444415' : theme.primary + '15',
                        borderColor: u.is_admin ? '#EF444440' : theme.primary + '40',
                        opacity: togglingId === u.id ? 0.6 : 1,
                      }]}
                    >
                      {togglingId === u.id
                        ? <ActivityIndicator size="small" color={u.is_admin ? '#EF4444' : theme.primary} />
                        : <>
                          <MaterialIcons
                            name={u.is_admin ? 'remove-moderator' : 'admin-panel-settings'}
                            size={14}
                            color={u.is_admin ? '#EF4444' : theme.primary}
                          />
                          <Text style={[s.toggleBtnText, { color: u.is_admin ? '#EF4444' : theme.primary }]}>
                            {u.is_admin ? 'إلغاء صلاحية المسؤول' : 'منح صلاحية المسؤول'}
                          </Text>
                        </>
                      }
                    </Pressable>
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
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, marginHorizontal: 16, marginVertical: 10 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: 'Cairo_400Regular', writingDirection: 'rtl' },
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 10, alignItems: 'center' },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 9999, borderWidth: 1 },
  filterChipText: { fontSize: 12, fontFamily: 'Cairo_600SemiBold' },
  filterCount: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  filterCountText: { fontSize: 10, fontFamily: 'Cairo_700Bold' },
  divider: { width: 1, height: 20, marginHorizontal: 4 },
  userCard: { borderRadius: 16, padding: 14, gap: 12 },
  userHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 16, fontFamily: 'Cairo_700Bold' },
  userName: { fontSize: 14, fontFamily: 'Cairo_700Bold', flex: 1 },
  userEmail: { fontSize: 11, fontFamily: 'Cairo_400Regular', marginTop: 2 },
  chip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 9999 },
  chipText: { fontSize: 9, fontFamily: 'Cairo_700Bold' },
  adminBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 9999, borderWidth: 1 },
  adminBadgeText: { fontSize: 10, fontFamily: 'Cairo_700Bold' },
  statsRow: { flexDirection: 'row', gap: 8 },
  statBubble: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 8, borderRadius: 10 },
  statVal: { fontSize: 14, fontFamily: 'Cairo_700Bold' },
  statLabel: { fontSize: 9, fontFamily: 'Cairo_400Regular' },
  toggleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  toggleBtnText: { fontSize: 13, fontFamily: 'Cairo_600SemiBold' },
  empty: { alignItems: 'center', padding: 48, borderRadius: 16, borderWidth: 1, gap: 10 },
  primaryBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  primaryBtnText: { fontSize: 14, fontFamily: 'Cairo_700Bold', color: '#FFF' },
});

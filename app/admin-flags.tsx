/**
 * app/admin-flags.tsx — Feature Flags Manager
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Switch, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth, useAlert } from '@/template';
import { getSupabaseClient } from '@/template';
import { fetchAllFlags, updateFeatureFlag, FeatureFlag } from '../services/remoteConfigService';
import { logAdminAction } from '../services/themeEngineService';

export default function FeatureFlagsScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  const s = useMemo(() => createStyles(theme), [theme]);

  useEffect(() => {
    if (!user?.id) { setIsAdmin(false); return; }
    getSupabaseClient().from('user_profiles').select('is_admin').eq('id', user.id).single()
      .then(({ data }) => setIsAdmin(data?.is_admin || false));
  }, [user?.id]);

  useEffect(() => {
    fetchAllFlags().then(data => { setFlags(data); setLoading(false); });
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return flags;
    const q = search.toLowerCase();
    return flags.filter(f => f.key.includes(q) || f.description.includes(q));
  }, [flags, search]);

  const handleToggle = useCallback(async (flag: FeatureFlag) => {
    if (!user?.id || !isAdmin) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setToggling(flag.key);
    const newVal = !flag.enabled;
    setFlags(prev => prev.map(f => f.key === flag.key ? { ...f, enabled: newVal } : f));
    const { error } = await updateFeatureFlag(flag.key, newVal, user.id);
    if (error) {
      setFlags(prev => prev.map(f => f.key === flag.key ? { ...f, enabled: flag.enabled } : f));
      showAlert('خطأ', error);
    } else {
      await logAdminAction(user.id, 'toggle_flag', `${newVal ? 'تفعيل' : 'تعطيل'} ميزة: ${flag.key}`, 'feature_flag', flag.key);
    }
    setToggling(null);
  }, [user?.id, isAdmin, showAlert]);

  if (loading || isAdmin === null) {
    return (
      <SafeAreaView edges={['top']} style={[s.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </SafeAreaView>
    );
  }

  const enabledCount = flags.filter(f => f.enabled).length;

  return (
    <SafeAreaView edges={['top']} style={s.container}>
      <View style={[s.header, { borderBottomColor: theme.border }]}>
        <Pressable onPress={() => router.back()} style={[s.iconBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <MaterialIcons name="arrow-forward" size={20} color={theme.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[s.title, { color: theme.textPrimary }]}>إشارات الميزات</Text>
          <Text style={[s.sub, { color: theme.textMuted }]}>{enabledCount}/{flags.length} ميزة مفعّلة</Text>
        </View>
        <View style={[s.badge, { backgroundColor: theme.primary + '15', borderColor: theme.primary + '30' }]}>
          <MaterialIcons name="toggle-on" size={14} color={theme.primary} />
          <Text style={[s.badgeText, { color: theme.primary }]}>{enabledCount}</Text>
        </View>
      </View>

      {/* Search */}
      <View style={[s.searchBar, { backgroundColor: theme.surface, borderColor: theme.border, marginHorizontal: 16, marginVertical: 10 }]}>
        <MaterialIcons name="search" size={18} color={theme.textMuted} />
        <TextInput
          value={search} onChangeText={setSearch}
          placeholder="بحث في الميزات..." placeholderTextColor={theme.textMuted}
          style={[s.searchInput, { color: theme.textPrimary }]}
          textAlign="right"
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')}>
            <MaterialIcons name="close" size={16} color={theme.textMuted} />
          </Pressable>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 32 }}>
        {filtered.map((flag, i) => (
          <Animated.View key={flag.key} entering={FadeInDown.duration(250).delay(i * 30)}>
            <View style={[s.flagCard, {
              backgroundColor: theme.surface, borderColor: theme.border,
              borderLeftColor: flag.enabled ? '#10B981' : theme.border,
              borderLeftWidth: flag.enabled ? 3 : 1,
            }]}>
              <View style={{ flex: 1 }}>
                <Text style={[s.flagKey, { color: theme.textPrimary }]}>{flag.key.replace(/_/g, ' ')}</Text>
                {flag.description ? (
                  <Text style={[s.flagDesc, { color: theme.textMuted }]}>{flag.description}</Text>
                ) : null}
                <View style={[s.statusPill, { backgroundColor: flag.enabled ? '#10B98115' : '#94A3B815' }]}>
                  <View style={[s.statusDot, { backgroundColor: flag.enabled ? '#10B981' : '#94A3B8' }]} />
                  <Text style={[s.statusTxt, { color: flag.enabled ? '#10B981' : '#94A3B8' }]}>
                    {flag.enabled ? 'مفعّل' : 'معطّل'}
                  </Text>
                </View>
              </View>
              {toggling === flag.key ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <Switch
                  value={flag.enabled}
                  onValueChange={() => handleToggle(flag)}
                  disabled={!isAdmin}
                  trackColor={{ false: theme.border, true: '#10B98160' }}
                  thumbColor={flag.enabled ? '#10B981' : theme.textMuted}
                />
              )}
            </View>
          </Animated.View>
        ))}

        {filtered.length === 0 && (
          <View style={s.emptyState}>
            <MaterialIcons name="search-off" size={48} color={theme.textMuted} />
            <Text style={[s.emptyText, { color: theme.textMuted }]}>لا توجد ميزات تطابق البحث</Text>
          </View>
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
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999, borderWidth: 1 },
  badgeText: { fontSize: 12, fontFamily: 'Cairo_700Bold' },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: 'Cairo_400Regular', writingDirection: 'rtl' },
  flagCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 8 },
  flagKey: { fontSize: 14, fontFamily: 'Cairo_600SemiBold', marginBottom: 3 },
  flagDesc: { fontSize: 12, fontFamily: 'Cairo_400Regular', marginBottom: 6, lineHeight: 18 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 9999, alignSelf: 'flex-start' },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusTxt: { fontSize: 11, fontFamily: 'Cairo_600SemiBold' },
  emptyState: { alignItems: 'center', paddingVertical: 48, gap: 10 },
  emptyText: { fontSize: 14, fontFamily: 'Cairo_500Medium' },
});

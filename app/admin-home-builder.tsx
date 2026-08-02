/**
 * app/admin-home-builder.tsx — Home Layout Builder
 * Reorder and enable/disable home page sections
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Switch, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth, useAlert } from '@/template';
import { getSupabaseClient } from '@/template';
import { fetchHomeSections, updateHomeLayout, HomeSection, DEFAULT_HOME_SECTIONS } from '../services/remoteConfigService';
import { logAdminAction } from '../services/themeEngineService';

const SECTION_ICONS: Record<string, string> = {
  search_bar: 'search', category_pills: 'category', smart_feed: 'auto-awesome',
  explore_more: 'rocket-launch', stats_bar: 'bar-chart', banner: 'campaign',
  trending: 'local-fire-department', editor_picks: 'verified', latest: 'schedule',
};
const SECTION_COLORS: Record<string, string> = {
  search_bar: '#3B82F6', category_pills: '#10B981', smart_feed: '#A78BFA',
  explore_more: '#F97316', stats_bar: '#F59E0B', banner: '#EC4899',
};

export default function HomeBuilderScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [sections, setSections] = useState<HomeSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const s = useMemo(() => createStyles(theme), [theme]);

  useEffect(() => {
    if (!user?.id) { setIsAdmin(false); return; }
    getSupabaseClient().from('user_profiles').select('is_admin').eq('id', user.id).single()
      .then(({ data }) => setIsAdmin(data?.is_admin || false));
  }, [user?.id]);

  useEffect(() => {
    fetchHomeSections().then(data => { setSections([...data]); setLoading(false); });
  }, []);

  const moveSection = useCallback((index: number, dir: 'up' | 'down') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSections(prev => {
      const arr = [...prev];
      const target = dir === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= arr.length) return prev;
      [arr[index], arr[target]] = [arr[target], arr[index]];
      return arr.map((s, i) => ({ ...s, order: i }));
    });
  }, []);

  const toggleSection = useCallback((id: string) => {
    setSections(prev => prev.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s));
  }, []);

  const handleSave = useCallback(async () => {
    if (!user?.id || !isAdmin) return;
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const { error } = await updateHomeLayout(sections, user.id);
    if (error) {
      showAlert('خطأ', error);
    } else {
      await logAdminAction(user.id, 'update_home_layout', 'تحديث ترتيب الصفحة الرئيسية', 'home_layout', 'main');
      showAlert('تم الحفظ', 'تم تطبيق تغييرات الصفحة الرئيسية');
    }
    setSaving(false);
  }, [user?.id, isAdmin, sections, showAlert]);

  const handleReset = useCallback(() => {
    Haptics.selectionAsync();
    setSections([...DEFAULT_HOME_SECTIONS]);
  }, []);

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
        <Text style={{ fontFamily: 'Cairo_700Bold', fontSize: 18, color: theme.textPrimary }}>وصول محدود</Text>
        <Pressable onPress={() => router.back()} style={[s.applyBtn, { backgroundColor: theme.primary }]}>
          <Text style={s.applyBtnText}>العودة</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={s.container}>
      <View style={[s.header, { borderBottomColor: theme.border }]}>
        <Pressable onPress={() => router.back()} style={[s.iconBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <MaterialIcons name="arrow-forward" size={20} color={theme.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[s.title, { color: theme.textPrimary }]}>منشئ الصفحة الرئيسية</Text>
          <Text style={[s.sub, { color: theme.textMuted }]}>رتّب وفعّل أقسام الصفحة الرئيسية</Text>
        </View>
        <Pressable onPress={handleReset} style={[s.resetBtn, { borderColor: theme.border }]}>
          <MaterialIcons name="refresh" size={16} color={theme.textSecondary} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 100 }}>
        {/* Info */}
        <View style={[s.infoBox, { backgroundColor: theme.primary + '12', borderColor: theme.primary + '30' }]}>
          <MaterialIcons name="info-outline" size={16} color={theme.primary} />
          <Text style={[s.infoText, { color: theme.textSecondary }]}>
            استخدم أزرار الأسهم لإعادة الترتيب، والمفتاح لإظهار/إخفاء القسم
          </Text>
        </View>

        {/* Sections List */}
        {sections.map((section, i) => {
          const icon = SECTION_ICONS[section.type] || 'widgets';
          const color = SECTION_COLORS[section.type] || theme.primary;
          return (
            <Animated.View key={section.id} entering={FadeInDown.duration(260).delay(i * 40)}>
              <View style={[s.sectionCard, {
                backgroundColor: section.enabled ? theme.surface : theme.background,
                borderColor: section.enabled ? theme.border : theme.border + '80',
                opacity: section.enabled ? 1 : 0.65,
              }]}>
                {/* Order indicator */}
                <View style={[s.orderBadge, { backgroundColor: color + '18' }]}>
                  <Text style={[s.orderNum, { color }]}>{i + 1}</Text>
                </View>

                {/* Icon */}
                <View style={[s.iconBg, { backgroundColor: color + '15' }]}>
                  <MaterialIcons name={icon as any} size={20} color={color} />
                </View>

                {/* Name */}
                <Text style={[s.sectionName, { color: section.enabled ? theme.textPrimary : theme.textMuted }]} numberOfLines={1}>
                  {section.title}
                </Text>

                {/* Controls */}
                <View style={s.controls}>
                  {/* Move Up */}
                  <Pressable
                    onPress={() => moveSection(i, 'up')}
                    disabled={i === 0}
                    style={[s.arrowBtn, { opacity: i === 0 ? 0.3 : 1 }]}
                  >
                    <MaterialIcons name="keyboard-arrow-up" size={18} color={theme.textSecondary} />
                  </Pressable>
                  {/* Move Down */}
                  <Pressable
                    onPress={() => moveSection(i, 'down')}
                    disabled={i === sections.length - 1}
                    style={[s.arrowBtn, { opacity: i === sections.length - 1 ? 0.3 : 1 }]}
                  >
                    <MaterialIcons name="keyboard-arrow-down" size={18} color={theme.textSecondary} />
                  </Pressable>
                  {/* Toggle */}
                  <Switch
                    value={section.enabled}
                    onValueChange={() => toggleSection(section.id)}
                    trackColor={{ false: theme.border, true: color + '60' }}
                    thumbColor={section.enabled ? color : theme.textMuted}
                    style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
                  />
                </View>
              </View>
            </Animated.View>
          );
        })}
      </ScrollView>

      {/* Save Button */}
      <View style={[s.footer, { borderTopColor: theme.border, paddingBottom: insets.bottom + 12 }]}>
        <Pressable
          onPress={handleSave}
          disabled={saving}
          style={[s.applyBtn, { backgroundColor: theme.primary }]}
        >
          {saving
            ? <ActivityIndicator size="small" color="#FFF" />
            : <>
              <MaterialIcons name="check" size={18} color="#FFF" />
              <Text style={s.applyBtnText}>تطبيق التغييرات</Text>
            </>
          }
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 17, fontFamily: 'Cairo_700Bold' },
  sub: { fontSize: 11, fontFamily: 'Cairo_400Regular', marginTop: 1 },
  resetBtn: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  infoBox: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 16 },
  infoText: { flex: 1, fontSize: 12, fontFamily: 'Cairo_400Regular', lineHeight: 18 },
  sectionCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, borderWidth: 1, marginBottom: 8 },
  orderBadge: { width: 28, height: 28, borderRadius: 9999, alignItems: 'center', justifyContent: 'center' },
  orderNum: { fontSize: 13, fontFamily: 'Cairo_700Bold' },
  iconBg: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  sectionName: { flex: 1, fontSize: 14, fontFamily: 'Cairo_600SemiBold' },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  arrowBtn: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  footer: { borderTopWidth: 1, paddingHorizontal: 16, paddingTop: 12 },
  applyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14 },
  applyBtnText: { fontSize: 15, fontFamily: 'Cairo_700Bold', color: '#FFF' },
});

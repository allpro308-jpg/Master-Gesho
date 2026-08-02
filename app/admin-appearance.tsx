/**
 * app/admin-appearance.tsx — Appearance Studio
 * Manage and activate themes
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth, useAlert } from '@/template';
import { getSupabaseClient } from '@/template';
import {
  fetchAllThemes, activateTheme, deleteTheme, publishTheme,
  AppTheme as DbAppTheme,
} from '../services/themeEngineService';

const STATUS_COLORS: Record<string, string> = {
  published: '#10B981', draft: '#F59E0B', archived: '#94A3B8',
};
const STATUS_LABELS: Record<string, string> = {
  published: 'منشور', draft: 'مسودة', archived: 'أرشيف',
};

export default function AppearanceStudio() {
  const { theme, applyDbTheme, activeDbThemeName } = useTheme();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [themes, setThemes] = useState<DbAppTheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState<string | null>(null);

  const s = useMemo(() => createStyles(theme), [theme]);

  useEffect(() => {
    if (!user?.id) { setIsAdmin(false); return; }
    getSupabaseClient().from('user_profiles').select('is_admin').eq('id', user.id).single()
      .then(({ data }) => setIsAdmin(data?.is_admin || false));
  }, [user?.id]);

  const load = useCallback(async () => {
    const data = await fetchAllThemes();
    setThemes(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleActivate = useCallback(async (t: DbAppTheme) => {
    if (!user?.id || !isAdmin) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setActivating(t.id);
    const { error } = await activateTheme(t.id, user.id);
    if (error) {
      showAlert('خطأ', error);
    } else {
      // Apply tokens to live theme
      applyDbTheme({ ...(t.tokens as any), _name: t.name });
      showAlert('تم التفعيل', `تم تفعيل ثيم "${t.name}" بنجاح`);
      await load();
    }
    setActivating(null);
  }, [user?.id, isAdmin, applyDbTheme, load, showAlert]);

  const handleDelete = useCallback(async (t: DbAppTheme) => {
    if (!user?.id || !isAdmin || t.isDefault) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    showAlert(
      'حذف الثيم',
      `هل تريد حذف "${t.name}"؟`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حذف', style: 'destructive',
          onPress: async () => {
            await deleteTheme(t.id, user.id!);
            await load();
          },
        },
      ]
    );
  }, [user?.id, isAdmin, load, showAlert]);

  const handlePublish = useCallback(async (t: DbAppTheme) => {
    if (!user?.id || !isAdmin) return;
    await publishTheme(t.id, user.id);
    await load();
  }, [user?.id, isAdmin, load]);

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
        <Pressable onPress={() => router.back()} style={[s.btn, { backgroundColor: theme.primary }]}>
          <Text style={s.btnText}>العودة</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const activeTheme = themes.find(t => t.isActive);

  return (
    <SafeAreaView edges={['top']} style={s.container}>
      {/* Header */}
      <View style={[s.header, { borderBottomColor: theme.border }]}>
        <Pressable onPress={() => router.back()} style={[s.iconBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <MaterialIcons name="arrow-forward" size={20} color={theme.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[s.title, { color: theme.textPrimary }]}>استوديو المظهر</Text>
          <Text style={[s.sub, { color: theme.textMuted }]}>{themes.length} ثيم متاح</Text>
        </View>
        <Pressable
          onPress={() => { Haptics.selectionAsync(); router.push('/admin-theme-builder' as any); }}
          style={[s.btn, { backgroundColor: theme.primary }]}
        >
          <MaterialIcons name="add" size={16} color="#FFF" />
          <Text style={s.btnText}>ثيم جديد</Text>
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}>
        {/* Active Theme Hero */}
        {activeTheme && (
          <Animated.View entering={FadeInDown.duration(300)} style={[s.activeCard, { borderColor: theme.primary + '50' }]}>
            <View style={s.activeCardTop}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {Object.values(activeTheme.tokens).slice(0, 5).map((color, i) => (
                  <View key={i} style={[s.colorDot, { backgroundColor: String(color), width: 22, height: 22 }]} />
                ))}
              </View>
              <View style={[s.activeBadge, { backgroundColor: '#10B98120', borderColor: '#10B98140' }]}>
                <MaterialIcons name="check-circle" size={13} color="#10B981" />
                <Text style={s.activeBadgeText}>مفعّل</Text>
              </View>
            </View>
            <Text style={[s.activeThemeName, { color: theme.textPrimary }]}>{activeTheme.name}</Text>
            <Text style={[s.activeThemeDesc, { color: theme.textMuted }]}>{activeTheme.description || 'الثيم النشط للمنصة'}</Text>
            <View style={s.activeCardActions}>
              <Pressable
                onPress={() => { Haptics.selectionAsync(); router.push((`/admin-theme-builder?id=${activeTheme.id}`) as any); }}
                style={[s.outlineBtn, { borderColor: theme.primary + '50' }]}
              >
                <MaterialIcons name="edit" size={14} color={theme.primary} />
                <Text style={[s.outlineBtnText, { color: theme.primary }]}>تعديل</Text>
              </Pressable>
            </View>
          </Animated.View>
        )}

        {/* All Themes */}
        <Text style={[s.sectionTitle, { color: theme.textPrimary }]}>جميع الثيمات</Text>
        {themes.map((t, i) => (
          <Animated.View key={t.id} entering={FadeInDown.duration(280).delay(i * 40)}>
            <View style={[s.themeCard, { backgroundColor: theme.surface, borderColor: t.isActive ? theme.primary + '50' : theme.border }]}>
              {/* Color Preview */}
              <View style={[s.colorPreview, { backgroundColor: t.tokens.background || '#F8FAFC' }]}>
                <View style={s.colorRow}>
                  {[t.tokens.primary, t.tokens.surface, t.tokens.textPrimary, t.tokens.border].map((c, ci) => (
                    <View key={ci} style={[s.colorChip, { backgroundColor: String(c) }]} />
                  ))}
                </View>
                {t.darkMode && (
                  <View style={s.darkBadge}>
                    <MaterialIcons name="dark-mode" size={11} color="#FFF" />
                  </View>
                )}
              </View>

              {/* Info */}
              <View style={s.themeInfo}>
                <View style={s.themeNameRow}>
                  <Text style={[s.themeName, { color: theme.textPrimary }]} numberOfLines={1}>{t.name}</Text>
                  <View style={[s.statusChip, { backgroundColor: (STATUS_COLORS[t.status] || '#94A3B8') + '20' }]}>
                    <Text style={[s.statusText, { color: STATUS_COLORS[t.status] || '#94A3B8' }]}>
                      {STATUS_LABELS[t.status] || t.status}
                    </Text>
                  </View>
                </View>
                {t.description ? (
                  <Text style={[s.themeDesc, { color: theme.textMuted }]} numberOfLines={1}>{t.description}</Text>
                ) : null}
                {/* Actions */}
                <View style={s.themeActions}>
                  {!t.isActive && (
                    <Pressable
                      onPress={() => handleActivate(t)}
                      disabled={activating === t.id}
                      style={[s.activateBtn, { backgroundColor: theme.primary }]}
                    >
                      {activating === t.id
                        ? <ActivityIndicator size="small" color="#FFF" />
                        : <>
                          <MaterialIcons name="check" size={13} color="#FFF" />
                          <Text style={s.activateBtnText}>تفعيل</Text>
                        </>
                      }
                    </Pressable>
                  )}
                  <Pressable
                    onPress={() => router.push((`/admin-theme-builder?id=${t.id}`) as any)}
                    style={[s.iconAction, { backgroundColor: theme.background, borderColor: theme.border }]}
                  >
                    <MaterialIcons name="edit" size={15} color={theme.textSecondary} />
                  </Pressable>
                  {t.status === 'draft' && (
                    <Pressable
                      onPress={() => handlePublish(t)}
                      style={[s.iconAction, { backgroundColor: '#10B98115', borderColor: '#10B98130' }]}
                    >
                      <MaterialIcons name="publish" size={15} color="#10B981" />
                    </Pressable>
                  )}
                  {!t.isDefault && (
                    <Pressable
                      onPress={() => handleDelete(t)}
                      style={[s.iconAction, { backgroundColor: '#EF444415', borderColor: '#EF444430' }]}
                    >
                      <MaterialIcons name="delete" size={15} color="#EF4444" />
                    </Pressable>
                  )}
                </View>
              </View>
            </View>
          </Animated.View>
        ))}
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
  btn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  btnText: { fontSize: 12, fontFamily: 'Cairo_700Bold', color: '#FFF' },
  activeCard: { borderRadius: 18, borderWidth: 2, padding: 16, marginBottom: 20, backgroundColor: theme.surface },
  activeCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  colorDot: { borderRadius: 9999 },
  activeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 9999, borderWidth: 1 },
  activeBadgeText: { fontSize: 11, fontFamily: 'Cairo_700Bold', color: '#10B981' },
  activeThemeName: { fontSize: 20, fontFamily: 'Cairo_700Bold', marginBottom: 4 },
  activeThemeDesc: { fontSize: 13, fontFamily: 'Cairo_400Regular', marginBottom: 12 },
  activeCardActions: { flexDirection: 'row', gap: 8 },
  outlineBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 9999, borderWidth: 1.5 },
  outlineBtnText: { fontSize: 12, fontFamily: 'Cairo_700Bold' },
  sectionTitle: { fontSize: 16, fontFamily: 'Cairo_700Bold', marginBottom: 12 },
  themeCard: { flexDirection: 'row', gap: 12, padding: 12, borderRadius: 16, borderWidth: 1, marginBottom: 10 },
  colorPreview: { width: 80, borderRadius: 12, padding: 8, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, justifyContent: 'center' },
  colorChip: { width: 14, height: 14, borderRadius: 3 },
  darkBadge: { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 9999, padding: 2 },
  themeInfo: { flex: 1, gap: 4 },
  themeNameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  themeName: { fontSize: 15, fontFamily: 'Cairo_700Bold', flex: 1 },
  statusChip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999 },
  statusText: { fontSize: 10, fontFamily: 'Cairo_600SemiBold' },
  themeDesc: { fontSize: 11, fontFamily: 'Cairo_400Regular' },
  themeActions: { flexDirection: 'row', gap: 6, marginTop: 4, alignItems: 'center' },
  activateBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 9999 },
  activateBtnText: { fontSize: 11, fontFamily: 'Cairo_700Bold', color: '#FFF' },
  iconAction: { width: 32, height: 32, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});

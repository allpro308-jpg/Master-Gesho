/**
 * app/appearance.tsx — User-facing Theme Picker
 * Browse and apply published themes with live preview
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  ActivityIndicator, Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useTheme } from '../contexts/ThemeContext';
import { useAlert } from '@/template';
import { fetchAllThemes, AppTheme as DbTheme } from '../services/themeEngineService';

function ThemePreview({ tokens, name }: { tokens: any; name: string }) {
  return (
    <View style={[tp.card, { backgroundColor: tokens.surface || '#FFF', borderColor: tokens.border || '#E2E8F0' }]}>
      <View style={[tp.header, { backgroundColor: tokens.primary }]}>
        <View style={[tp.headerDot, { backgroundColor: 'rgba(255,255,255,0.5)' }]} />
        <View style={[tp.headerBar, { backgroundColor: 'rgba(255,255,255,0.4)', flex: 1 }]} />
      </View>
      <View style={[tp.body, { backgroundColor: tokens.background || '#F8FAFC' }]}>
        <View style={[tp.textLine, { backgroundColor: tokens.textPrimary + '40', width: '70%' }]} />
        <View style={[tp.textLine, { backgroundColor: tokens.textSecondary + '30', width: '50%', height: 5 }]} />
        <View style={[tp.btnRow]}>
          <View style={[tp.btn, { backgroundColor: tokens.primary }]} />
          <View style={[tp.btnOutline, { borderColor: tokens.primary }]} />
        </View>
      </View>
    </View>
  );
}

const tp = StyleSheet.create({
  card: { borderRadius: 12, overflow: 'hidden', borderWidth: 1, width: 110, height: 90 },
  header: { height: 28, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8 },
  headerDot: { width: 8, height: 8, borderRadius: 4 },
  headerBar: { height: 6, borderRadius: 3 },
  body: { flex: 1, padding: 8, gap: 5, justifyContent: 'center' },
  textLine: { height: 6, borderRadius: 3 },
  btnRow: { flexDirection: 'row', gap: 5, marginTop: 2 },
  btn: { width: 36, height: 14, borderRadius: 7 },
  btnOutline: { width: 28, height: 14, borderRadius: 7, borderWidth: 1 },
});

export default function AppearanceScreen() {
  const { theme, applyDbTheme, clearDbTheme, activeDbThemeName } = useTheme();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [themes, setThemes] = useState<DbTheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewTheme, setPreviewTheme] = useState<DbTheme | null>(null);
  const [applying, setApplying] = useState<string | null>(null);

  const s = useMemo(() => createStyles(theme), [theme]);

  useEffect(() => {
    fetchAllThemes()
      .then(all => setThemes(all.filter(t => t.status === 'published')))
      .finally(() => setLoading(false));
  }, []);

  const handlePreview = useCallback((t: DbTheme) => {
    Haptics.selectionAsync();
    setPreviewTheme(t);
  }, []);

  const handleApply = useCallback((t: DbTheme) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setApplying(t.id);
    applyDbTheme({ ...(t.tokens as any), _name: t.name });
    setTimeout(() => {
      setApplying(null);
      setPreviewTheme(null);
      showAlert('تم تطبيق الثيم', `تم تطبيق ثيم "${t.name}" بنجاح ✨`);
    }, 400);
  }, [applyDbTheme, showAlert]);

  const handleReset = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    showAlert(
      'إعادة الضبط',
      'هل تريد العودة للثيم الافتراضي؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'إعادة ضبط', style: 'destructive',
          onPress: () => {
            clearDbTheme();
            showAlert('تم', 'تم إعادة الثيم للوضع الافتراضي');
          },
        },
      ]
    );
  }, [clearDbTheme, showAlert]);

  if (loading) {
    return (
      <SafeAreaView edges={['top']} style={[s.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={theme.primary} />
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
          <Text style={[s.title, { color: theme.textPrimary }]}>المظهر والثيمات</Text>
          <Text style={[s.sub, { color: theme.textMuted }]}>{themes.length} ثيم متاح</Text>
        </View>
        {activeDbThemeName && (
          <Pressable onPress={handleReset} style={[s.resetBtn, { borderColor: theme.border }]}>
            <MaterialIcons name="refresh" size={16} color={theme.textSecondary} />
            <Text style={[s.resetText, { color: theme.textSecondary }]}>إعادة ضبط</Text>
          </Pressable>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32, gap: 12 }}>
        {/* Active Theme Banner */}
        {activeDbThemeName && (
          <Animated.View entering={FadeInDown.duration(300)} style={[s.activeBanner, { backgroundColor: theme.primary + '15', borderColor: theme.primary + '40' }]}>
            <MaterialIcons name="check-circle" size={18} color={theme.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[s.activeBannerTitle, { color: theme.textPrimary }]}>الثيم النشط حالياً</Text>
              <Text style={[s.activeBannerName, { color: theme.primary }]}>{activeDbThemeName}</Text>
            </View>
            <Pressable onPress={handleReset} style={[s.activeBannerBtn, { borderColor: theme.error + '40' }]}>
              <Text style={[s.activeBannerBtnText, { color: theme.error }]}>إزالة</Text>
            </Pressable>
          </Animated.View>
        )}

        {/* Theme Grid */}
        <Text style={[s.sectionTitle, { color: theme.textPrimary }]}>اختر ثيماً</Text>
        <View style={s.grid}>
          {themes.map((t, i) => {
            const isActive = activeDbThemeName === t.name;
            return (
              <Animated.View key={t.id} entering={FadeInDown.duration(280).delay(i * 40)}>
                <Pressable
                  onPress={() => handlePreview(t)}
                  style={({ pressed }) => [
                    s.themeCard,
                    {
                      backgroundColor: theme.surface,
                      borderColor: isActive ? theme.primary : theme.border,
                      borderWidth: isActive ? 2 : 1,
                    },
                    pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
                  ]}
                >
                  {/* Preview */}
                  <View style={{ alignItems: 'center', marginBottom: 10 }}>
                    <ThemePreview tokens={t.tokens} name={t.name} />
                  </View>

                  {/* Name */}
                  <Text style={[s.themeName, { color: theme.textPrimary }]} numberOfLines={1}>{t.name}</Text>
                  {t.description ? (
                    <Text style={[s.themeDesc, { color: theme.textMuted }]} numberOfLines={1}>{t.description}</Text>
                  ) : null}

                  {/* Badges */}
                  <View style={s.badgeRow}>
                    {t.darkMode && (
                      <View style={[s.badge, { backgroundColor: '#334155' }]}>
                        <MaterialIcons name="dark-mode" size={10} color="#94A3B8" />
                        <Text style={[s.badgeText, { color: '#94A3B8' }]}>داكن</Text>
                      </View>
                    )}
                    {isActive && (
                      <View style={[s.badge, { backgroundColor: theme.primary + '25' }]}>
                        <MaterialIcons name="check" size={10} color={theme.primary} />
                        <Text style={[s.badgeText, { color: theme.primary }]}>مفعّل</Text>
                      </View>
                    )}
                  </View>

                  {/* Color chips */}
                  <View style={s.colorChips}>
                    {[t.tokens.primary, t.tokens.background, t.tokens.surface, t.tokens.textPrimary, t.tokens.border]
                      .filter(Boolean)
                      .slice(0, 5)
                      .map((color, ci) => (
                        <View key={ci} style={[s.colorChip, { backgroundColor: String(color) }]} />
                      ))}
                  </View>
                </Pressable>
              </Animated.View>
            );
          })}
        </View>

        {themes.length === 0 && (
          <View style={[s.empty, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <MaterialIcons name="palette" size={48} color={theme.textMuted} />
            <Text style={[s.emptyTitle, { color: theme.textPrimary }]}>لا توجد ثيمات منشورة</Text>
            <Text style={[s.emptyDesc, { color: theme.textMuted }]}>تواصل مع المسؤول لإضافة ثيمات</Text>
          </View>
        )}
      </ScrollView>

      {/* Preview Modal */}
      <Modal visible={!!previewTheme} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPreviewTheme(null)}>
        {previewTheme && (
          <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: previewTheme.tokens.background || '#F8FAFC' }}>
            {/* Modal Header */}
            <View style={[s.modalHeader, { borderBottomColor: previewTheme.tokens.border || '#E2E8F0', backgroundColor: previewTheme.tokens.surface || '#FFF' }]}>
              <Pressable onPress={() => setPreviewTheme(null)} style={{ padding: 4 }}>
                <MaterialIcons name="close" size={22} color={previewTheme.tokens.textPrimary || '#1E293B'} />
              </Pressable>
              <Text style={[s.modalTitle, { color: previewTheme.tokens.textPrimary || '#1E293B' }]}>{previewTheme.name}</Text>
              <View style={{ width: 30 }} />
            </View>

            <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
              {/* Color Tokens Preview */}
              <Animated.View entering={ZoomIn.springify().damping(14)}>
                <View style={{ backgroundColor: previewTheme.tokens.surface || '#FFF', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: previewTheme.tokens.border || '#E2E8F0', gap: 14 }}>
                  <Text style={{ fontSize: 16, fontFamily: 'Cairo_700Bold', color: previewTheme.tokens.textPrimary || '#1E293B', textAlign: 'center' }}>
                    معاينة الثيم
                  </Text>

                  {/* Simulated App Header */}
                  <View style={{ backgroundColor: previewTheme.tokens.primary, borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 14 }}>🤖</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontFamily: 'Cairo_700Bold', color: '#FFF' }}>مستر جيشو</Text>
                      <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.75)', fontFamily: 'Cairo_400Regular' }}>منصة الذكاء الاصطناعي</Text>
                    </View>
                  </View>

                  {/* Simulated Cards */}
                  {[1, 2].map(i => (
                    <View key={i} style={{ backgroundColor: previewTheme.tokens.card || previewTheme.tokens.surface || '#FFF', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: previewTheme.tokens.border || '#E2E8F0' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                        <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: previewTheme.tokens.primary + '20' }} />
                        <View style={{ flex: 1, gap: 5 }}>
                          <View style={{ height: 8, borderRadius: 4, backgroundColor: previewTheme.tokens.textPrimary + '40', width: '70%' }} />
                          <View style={{ height: 6, borderRadius: 3, backgroundColor: previewTheme.tokens.textSecondary + '30', width: '50%' }} />
                        </View>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        <View style={{ flex: 1, height: 30, borderRadius: 8, backgroundColor: previewTheme.tokens.primary }} />
                        <View style={{ width: 60, height: 30, borderRadius: 8, borderWidth: 1, borderColor: previewTheme.tokens.primary }} />
                      </View>
                    </View>
                  ))}

                  {/* Color Palette */}
                  <View style={{ gap: 8 }}>
                    <Text style={{ fontSize: 12, fontFamily: 'Cairo_600SemiBold', color: previewTheme.tokens.textMuted || '#94A3B8' }}>لوحة الألوان</Text>
                    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                      {[
                        { key: 'اللون الرئيسي', val: previewTheme.tokens.primary },
                        { key: 'الخلفية', val: previewTheme.tokens.background },
                        { key: 'السطح', val: previewTheme.tokens.surface },
                        { key: 'النص', val: previewTheme.tokens.textPrimary },
                        { key: 'الحدود', val: previewTheme.tokens.border },
                        { key: 'النجاح', val: previewTheme.tokens.success },
                      ].map((item, ci) => (
                        <View key={ci} style={{ alignItems: 'center', gap: 4 }}>
                          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: String(item.val), borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)' }} />
                          <Text style={{ fontSize: 9, fontFamily: 'Cairo_500Medium', color: previewTheme.tokens.textMuted || '#94A3B8', textAlign: 'center', maxWidth: 44 }}>{item.key}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              </Animated.View>
            </ScrollView>

            {/* Apply Button */}
            <View style={[s.modalFooter, { backgroundColor: previewTheme.tokens.surface || '#FFF', borderTopColor: previewTheme.tokens.border || '#E2E8F0', paddingBottom: insets.bottom + 16 }]}>
              {activeDbThemeName === previewTheme.name ? (
                <View style={[s.alreadyActive, { backgroundColor: previewTheme.tokens.success + '20', borderColor: previewTheme.tokens.success + '40' }]}>
                  <MaterialIcons name="check-circle" size={18} color={previewTheme.tokens.success || '#10B981'} />
                  <Text style={[s.alreadyActiveText, { color: previewTheme.tokens.success || '#10B981' }]}>هذا الثيم مطبّق حالياً</Text>
                </View>
              ) : (
                <Pressable
                  onPress={() => handleApply(previewTheme)}
                  disabled={!!applying}
                  style={[s.applyBtn, { backgroundColor: previewTheme.tokens.primary }]}
                >
                  {applying === previewTheme.id
                    ? <ActivityIndicator size="small" color="#FFF" />
                    : <>
                      <MaterialIcons name="palette" size={18} color="#FFF" />
                      <Text style={s.applyBtnText}>تطبيق هذا الثيم</Text>
                    </>
                  }
                </Pressable>
              )}
            </View>
          </SafeAreaView>
        )}
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontFamily: 'Cairo_700Bold' },
  sub: { fontSize: 11, fontFamily: 'Cairo_400Regular', marginTop: 1 },
  resetBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 9999, borderWidth: 1 },
  resetText: { fontSize: 12, fontFamily: 'Cairo_500Medium' },
  activeBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 14, borderWidth: 1 },
  activeBannerTitle: { fontSize: 11, fontFamily: 'Cairo_400Regular', marginBottom: 2 },
  activeBannerName: { fontSize: 14, fontFamily: 'Cairo_700Bold' },
  activeBannerBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 9999, borderWidth: 1 },
  activeBannerBtnText: { fontSize: 11, fontFamily: 'Cairo_600SemiBold' },
  sectionTitle: { fontSize: 16, fontFamily: 'Cairo_700Bold' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  themeCard: { width: 155, borderRadius: 16, padding: 12, gap: 6 },
  themeName: { fontSize: 13, fontFamily: 'Cairo_700Bold' },
  themeDesc: { fontSize: 10, fontFamily: 'Cairo_400Regular' },
  badgeRow: { flexDirection: 'row', gap: 5, flexWrap: 'wrap' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 9999 },
  badgeText: { fontSize: 9, fontFamily: 'Cairo_600SemiBold' },
  colorChips: { flexDirection: 'row', gap: 4, marginTop: 4 },
  colorChip: { width: 16, height: 16, borderRadius: 4, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)' },
  empty: { alignItems: 'center', padding: 40, gap: 10, borderRadius: 16, borderWidth: 1 },
  emptyTitle: { fontSize: 16, fontFamily: 'Cairo_700Bold' },
  emptyDesc: { fontSize: 13, fontFamily: 'Cairo_400Regular', textAlign: 'center' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  modalTitle: { fontSize: 16, fontFamily: 'Cairo_700Bold' },
  modalFooter: { paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1 },
  alreadyActive: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, borderRadius: 14, borderWidth: 1 },
  alreadyActiveText: { fontSize: 14, fontFamily: 'Cairo_600SemiBold' },
  applyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 15, borderRadius: 14 },
  applyBtnText: { fontSize: 15, fontFamily: 'Cairo_700Bold', color: '#FFF' },
});

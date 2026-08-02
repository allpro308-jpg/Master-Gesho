/**
 * app/admin-navigation.tsx — Navigation Builder
 * Configure tab bar navigation items
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
import { fetchNavItems, updateNavigation, NavItem } from '../services/remoteConfigService';
import { logAdminAction } from '../services/themeEngineService';

export default function NavigationBuilderScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [items, setItems] = useState<NavItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const s = useMemo(() => createStyles(theme), [theme]);

  useEffect(() => {
    if (!user?.id) { setIsAdmin(false); return; }
    getSupabaseClient().from('user_profiles').select('is_admin').eq('id', user.id).single()
      .then(({ data }) => setIsAdmin(data?.is_admin || false));
  }, [user?.id]);

  useEffect(() => {
    fetchNavItems().then(data => { setItems([...data]); setLoading(false); });
  }, []);

  const moveItem = useCallback((index: number, dir: 'up' | 'down') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setItems(prev => {
      const arr = [...prev];
      const target = dir === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= arr.length) return prev;
      [arr[index], arr[target]] = [arr[target], arr[index]];
      return arr.map((item, i) => ({ ...item, order: i }));
    });
  }, []);

  const toggleItem = useCallback((id: string) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, enabled: !item.enabled } : item));
  }, []);

  const updateLabel = useCallback((id: string, label: string) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, label } : item));
  }, []);

  const handleSave = useCallback(async () => {
    if (!user?.id || !isAdmin) return;
    const enabledCount = items.filter(i => i.enabled).length;
    if (enabledCount < 2) { showAlert('تحذير', 'يجب تفعيل عنصرين على الأقل في التنقل'); return; }
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const { error } = await updateNavigation(items, user.id);
    if (error) {
      showAlert('خطأ', error);
    } else {
      await logAdminAction(user.id, 'update_navigation', 'تحديث قائمة التنقل', 'navigation', 'main');
      showAlert('تم الحفظ', 'سيُطبَّق التغيير في الجلسة التالية');
    }
    setSaving(false);
  }, [user?.id, isAdmin, items, showAlert]);

  if (loading || isAdmin === null) {
    return (
      <SafeAreaView edges={['top']} style={[s.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={theme.primary} />
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
          <Text style={[s.title, { color: theme.textPrimary }]}>منشئ التنقل</Text>
          <Text style={[s.sub, { color: theme.textMuted }]}>خصّص شريط التبويبات</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 100 }}>
        <View style={[s.noteBox, { backgroundColor: '#F59E0B12', borderColor: '#F59E0B30' }]}>
          <MaterialIcons name="info-outline" size={15} color="#F59E0B" />
          <Text style={[s.noteText, { color: theme.textSecondary }]}>
            اضغط على اسم العنصر لتعديله. التغييرات تُطبَّق عند إعادة فتح التطبيق.
          </Text>
        </View>

        {items.map((item, i) => (
          <Animated.View key={item.id} entering={FadeInDown.duration(260).delay(i * 40)}>
            <View style={[s.itemCard, {
              backgroundColor: theme.surface, borderColor: theme.border,
              opacity: item.enabled ? 1 : 0.6,
            }]}>
              <View style={[s.itemIcon, { backgroundColor: theme.primary + '15' }]}>
                <MaterialIcons name={item.icon as any} size={22} color={theme.primary} />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                {editingId === item.id ? (
                  <TextInput
                    value={item.label}
                    onChangeText={v => updateLabel(item.id, v)}
                    onBlur={() => setEditingId(null)}
                    autoFocus
                    style={[s.labelInput, { color: theme.textPrimary, borderColor: theme.primary }]}
                    textAlign="right"
                    maxLength={12}
                  />
                ) : (
                  <Pressable onPress={() => setEditingId(item.id)}>
                    <Text style={[s.itemLabel, { color: theme.textPrimary }]}>{item.label}</Text>
                  </Pressable>
                )}
                <Text style={[s.itemRoute, { color: theme.textMuted }]}>{item.route}</Text>
              </View>
              <View style={s.itemControls}>
                <Pressable onPress={() => moveItem(i, 'up')} disabled={i === 0} style={[s.arrowBtn, { opacity: i === 0 ? 0.3 : 1 }]}>
                  <MaterialIcons name="keyboard-arrow-up" size={18} color={theme.textSecondary} />
                </Pressable>
                <Pressable onPress={() => moveItem(i, 'down')} disabled={i === items.length - 1} style={[s.arrowBtn, { opacity: i === items.length - 1 ? 0.3 : 1 }]}>
                  <MaterialIcons name="keyboard-arrow-down" size={18} color={theme.textSecondary} />
                </Pressable>
                <Switch
                  value={item.enabled}
                  onValueChange={() => toggleItem(item.id)}
                  trackColor={{ false: theme.border, true: theme.primary + '60' }}
                  thumbColor={item.enabled ? theme.primary : theme.textMuted}
                  style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                />
              </View>
            </View>
          </Animated.View>
        ))}

        {/* Preview */}
        <View style={[s.previewBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[s.previewTitle, { color: theme.textMuted }]}>معاينة شريط التنقل</Text>
          <View style={[s.navPreview, { backgroundColor: theme.tabBarBg, borderColor: theme.border }]}>
            {items.filter(i => i.enabled).map(item => (
              <View key={item.id} style={s.navPreviewItem}>
                <MaterialIcons name={item.icon as any} size={18} color={theme.textMuted} />
                <Text style={[s.navPreviewLabel, { color: theme.textMuted }]}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={[s.footer, { borderTopColor: theme.border, paddingBottom: insets.bottom + 12 }]}>
        <Pressable
          onPress={handleSave}
          disabled={saving}
          style={[s.saveBtn, { backgroundColor: theme.primary }]}
        >
          {saving ? <ActivityIndicator size="small" color="#FFF" />
            : <><MaterialIcons name="check" size={18} color="#FFF" /><Text style={s.saveBtnText}>حفظ إعدادات التنقل</Text></>}
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
  noteBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 16 },
  noteText: { flex: 1, fontSize: 12, fontFamily: 'Cairo_400Regular', lineHeight: 18 },
  itemCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, borderWidth: 1, marginBottom: 8 },
  itemIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  itemLabel: { fontSize: 15, fontFamily: 'Cairo_600SemiBold' },
  labelInput: { fontSize: 15, fontFamily: 'Cairo_600SemiBold', borderBottomWidth: 1.5, paddingBottom: 2 },
  itemRoute: { fontSize: 10, fontFamily: 'Cairo_400Regular' },
  itemControls: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  arrowBtn: { width: 26, height: 26, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  previewBox: { borderRadius: 14, borderWidth: 1, padding: 14, marginTop: 8 },
  previewTitle: { fontSize: 11, fontFamily: 'Cairo_500Medium', textAlign: 'center', marginBottom: 10 },
  navPreview: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  navPreviewItem: { alignItems: 'center', gap: 3 },
  navPreviewLabel: { fontSize: 9, fontFamily: 'Cairo_500Medium' },
  footer: { borderTopWidth: 1, paddingHorizontal: 16, paddingTop: 12 },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14 },
  saveBtnText: { fontSize: 15, fontFamily: 'Cairo_700Bold', color: '#FFF' },
});

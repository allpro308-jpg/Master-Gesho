/**
 * app/admin-banners.tsx — Banner Manager
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  TextInput, ActivityIndicator, Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth, useAlert } from '@/template';
import { getSupabaseClient } from '@/template';
import { fetchAllBanners, createBanner, updateBannerStatus, deleteBanner, Banner } from '../services/remoteConfigService';
import { logAdminAction } from '../services/themeEngineService';

const STATUS_COLORS: Record<string, string> = { published: '#10B981', draft: '#F59E0B', archived: '#94A3B8' };
const STATUS_LABELS: Record<string, string> = { published: 'نشط', draft: 'مسودة', archived: 'أرشيف' };
const PLACEMENTS = ['home', 'explore', 'category', 'article'];
const TYPES = ['ad', 'offer', 'alert', 'campaign'];

interface CreateForm {
  title: string; description: string; buttonText: string; buttonUrl: string;
  type: string; placement: string; priority: string; bgColor: string; textColor: string;
}

const EMPTY_FORM: CreateForm = {
  title: '', description: '', buttonText: 'اعرف المزيد', buttonUrl: '',
  type: 'ad', placement: 'home', priority: '0', bgColor: '#3B82F6', textColor: '#FFFFFF',
};

export default function BannersScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreateForm>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  const s = useMemo(() => createStyles(theme), [theme]);

  useEffect(() => {
    if (!user?.id) { setIsAdmin(false); return; }
    getSupabaseClient().from('user_profiles').select('is_admin').eq('id', user.id).single()
      .then(({ data }) => setIsAdmin(data?.is_admin || false));
  }, [user?.id]);

  const load = useCallback(async () => {
    const data = await fetchAllBanners();
    setBanners(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = useCallback(async () => {
    if (!user?.id || !isAdmin) return;
    if (!form.title.trim()) { showAlert('خطأ', 'يرجى إدخال عنوان البانر'); return; }
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const { id, error } = await createBanner({
      title: form.title, description: form.description,
      buttonText: form.buttonText, buttonUrl: form.buttonUrl || null,
      type: form.type, placement: form.placement,
      priority: parseInt(form.priority) || 0,
      bgColor: form.bgColor, textColor: form.textColor,
    }, user.id);
    if (error) {
      showAlert('خطأ', error);
    } else {
      await logAdminAction(user.id!, 'create_banner', `إنشاء بانر: ${form.title}`, 'banner', id!);
      setShowCreate(false);
      setForm({ ...EMPTY_FORM });
      await load();
    }
    setSaving(false);
  }, [user?.id, isAdmin, form, load, showAlert]);

  const handleToggleStatus = useCallback(async (banner: Banner) => {
    if (!user?.id || !isAdmin) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newStatus = banner.status === 'published' ? 'draft' : 'published';
    setBanners(prev => prev.map(b => b.id === banner.id ? { ...b, status: newStatus } : b));
    await updateBannerStatus(banner.id, newStatus);
  }, [user?.id, isAdmin]);

  const handleDelete = useCallback(async (banner: Banner) => {
    if (!user?.id || !isAdmin) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    showAlert(
      'حذف البانر',
      `هل تريد حذف "${banner.title}"؟`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حذف', style: 'destructive',
          onPress: async () => {
            await deleteBanner(banner.id);
            await logAdminAction(user.id!, 'delete_banner', `حذف بانر: ${banner.title}`, 'banner', banner.id);
            await load();
          },
        },
      ]
    );
  }, [user?.id, isAdmin, load, showAlert]);

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
          <Text style={[s.title, { color: theme.textPrimary }]}>البانرات والإعلانات</Text>
          <Text style={[s.sub, { color: theme.textMuted }]}>{banners.length} بانر</Text>
        </View>
        <Pressable
          onPress={() => { Haptics.selectionAsync(); setShowCreate(true); }}
          style={[s.addBtn, { backgroundColor: theme.primary }]}
        >
          <MaterialIcons name="add" size={18} color="#FFF" />
          <Text style={s.addBtnText}>إضافة</Text>
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}>
        {banners.length === 0 ? (
          <View style={s.emptyState}>
            <MaterialIcons name="campaign" size={64} color={theme.textMuted} />
            <Text style={[s.emptyTitle, { color: theme.textPrimary }]}>لا توجد بانرات</Text>
            <Text style={[s.emptyDesc, { color: theme.textMuted }]}>أنشئ أول بانر لعرضه للمستخدمين</Text>
            <Pressable onPress={() => setShowCreate(true)} style={[s.addBtn, { backgroundColor: theme.primary, marginTop: 16 }]}>
              <MaterialIcons name="add" size={16} color="#FFF" />
              <Text style={s.addBtnText}>إنشاء بانر</Text>
            </Pressable>
          </View>
        ) : (
          banners.map((banner, i) => (
            <Animated.View key={banner.id} entering={FadeInDown.duration(260).delay(i * 40)}>
              <View style={[s.bannerCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                {/* Preview */}
                <View style={[s.bannerPreview, { backgroundColor: banner.bgColor }]}>
                  <MaterialIcons name="campaign" size={24} color={banner.textColor} />
                  <Text style={[s.bannerPreviewTitle, { color: banner.textColor }]} numberOfLines={1}>
                    {banner.title}
                  </Text>
                </View>

                {/* Info */}
                <View style={s.bannerInfo}>
                  <View style={s.bannerTop}>
                    <Text style={[s.bannerTitle, { color: theme.textPrimary }]} numberOfLines={1}>{banner.title}</Text>
                    <View style={[s.statusChip, { backgroundColor: (STATUS_COLORS[banner.status] || '#94A3B8') + '20' }]}>
                      <Text style={[s.statusText, { color: STATUS_COLORS[banner.status] || '#94A3B8' }]}>
                        {STATUS_LABELS[banner.status] || banner.status}
                      </Text>
                    </View>
                  </View>
                  <Text style={[s.bannerMeta, { color: theme.textMuted }]}>
                    {banner.placement} · أولوية {banner.priority} · {banner.impressions} ظهور
                  </Text>
                  {/* Actions */}
                  <View style={s.bannerActions}>
                    <Pressable
                      onPress={() => handleToggleStatus(banner)}
                      style={[s.actionBtn, {
                        backgroundColor: banner.status === 'published' ? '#F59E0B15' : '#10B98115',
                        borderColor: banner.status === 'published' ? '#F59E0B40' : '#10B98140',
                      }]}
                    >
                      <MaterialIcons
                        name={banner.status === 'published' ? 'pause' : 'play-arrow'}
                        size={14}
                        color={banner.status === 'published' ? '#F59E0B' : '#10B981'}
                      />
                      <Text style={[s.actionBtnText, { color: banner.status === 'published' ? '#F59E0B' : '#10B981' }]}>
                        {banner.status === 'published' ? 'إيقاف' : 'نشر'}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handleDelete(banner)}
                      style={[s.actionBtn, { backgroundColor: '#EF444415', borderColor: '#EF444430' }]}
                    >
                      <MaterialIcons name="delete" size={14} color="#EF4444" />
                      <Text style={[s.actionBtnText, { color: '#EF4444' }]}>حذف</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            </Animated.View>
          ))
        )}
      </ScrollView>

      {/* Create Modal */}
      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView edges={['top']} style={[s.modal, { backgroundColor: theme.background }]}>
          <View style={[s.modalHeader, { borderBottomColor: theme.border }]}>
            <Pressable onPress={() => setShowCreate(false)}>
              <Text style={[s.modalCancel, { color: theme.textSecondary }]}>إلغاء</Text>
            </Pressable>
            <Text style={[s.modalTitle, { color: theme.textPrimary }]}>بانر جديد</Text>
            <Pressable onPress={handleCreate} disabled={saving}>
              {saving ? <ActivityIndicator size="small" color={theme.primary} />
                : <Text style={[s.modalSave, { color: theme.primary }]}>حفظ</Text>}
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
            {[
              { key: 'title' as const, label: 'العنوان *', placeholder: 'عنوان البانر' },
              { key: 'description' as const, label: 'الوصف', placeholder: 'وصف قصير' },
              { key: 'buttonText' as const, label: 'نص الزر', placeholder: 'اعرف المزيد' },
              { key: 'buttonUrl' as const, label: 'رابط الزر', placeholder: 'https://...' },
              { key: 'bgColor' as const, label: 'لون الخلفية', placeholder: '#3B82F6' },
              { key: 'textColor' as const, label: 'لون النص', placeholder: '#FFFFFF' },
              { key: 'priority' as const, label: 'الأولوية', placeholder: '0' },
            ].map(field => (
              <View key={field.key}>
                <Text style={[s.fieldLabel, { color: theme.textSecondary }]}>{field.label}</Text>
                <View style={[s.fieldInput, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <TextInput
                    value={form[field.key]}
                    onChangeText={v => setForm(prev => ({ ...prev, [field.key]: v }))}
                    placeholder={field.placeholder}
                    placeholderTextColor={theme.textMuted}
                    style={[s.inputText, { color: theme.textPrimary }]}
                    textAlign="right"
                    autoCapitalize="none"
                  />
                </View>
              </View>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>
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
  emptyState: { alignItems: 'center', paddingVertical: 64, gap: 8 },
  emptyTitle: { fontSize: 18, fontFamily: 'Cairo_700Bold' },
  emptyDesc: { fontSize: 13, fontFamily: 'Cairo_400Regular' },
  bannerCard: { borderRadius: 16, borderWidth: 1, overflow: 'hidden', marginBottom: 12 },
  bannerPreview: { height: 72, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 },
  bannerPreviewTitle: { fontSize: 14, fontFamily: 'Cairo_700Bold', flex: 1 },
  bannerInfo: { padding: 12, gap: 4 },
  bannerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bannerTitle: { fontSize: 14, fontFamily: 'Cairo_600SemiBold', flex: 1 },
  statusChip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999 },
  statusText: { fontSize: 10, fontFamily: 'Cairo_600SemiBold' },
  bannerMeta: { fontSize: 11, fontFamily: 'Cairo_400Regular' },
  bannerActions: { flexDirection: 'row', gap: 8, marginTop: 6 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9999, borderWidth: 1 },
  actionBtnText: { fontSize: 11, fontFamily: 'Cairo_600SemiBold' },
  modal: { flex: 1 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  modalTitle: { fontSize: 16, fontFamily: 'Cairo_700Bold' },
  modalCancel: { fontSize: 14, fontFamily: 'Cairo_500Medium' },
  modalSave: { fontSize: 14, fontFamily: 'Cairo_700Bold' },
  fieldLabel: { fontSize: 12, fontFamily: 'Cairo_600SemiBold', marginBottom: 6 },
  fieldInput: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, height: 44, justifyContent: 'center' },
  inputText: { fontSize: 14, fontFamily: 'Cairo_400Regular', writingDirection: 'rtl' },
});

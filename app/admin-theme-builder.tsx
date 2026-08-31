/**
 * app/admin-theme-builder.tsx — Theme Builder
 * Create & edit theme color tokens
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  TextInput, ActivityIndicator, Switch,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth, useAlert } from '@/template';
import { getSupabaseClient } from '@/template';
import {
  fetchThemeById, createTheme, updateThemeTokens, publishTheme,
  DEFAULT_TOKENS, DbThemeTokens,
} from '../services/themeEngineService';

interface TokenField {
  key: keyof DbThemeTokens;
  label: string;
  desc: string;
}

const TOKEN_FIELDS: TokenField[] = [
  { key: 'primary', label: 'اللون الرئيسي', desc: 'أزرار، روابط، تمييز' },
  { key: 'primaryDark', label: 'الرئيسي الداكن', desc: 'تدرج الزر الرئيسي' },
  { key: 'background', label: 'لون الخلفية', desc: 'خلفية الشاشة الرئيسية' },
  { key: 'surface', label: 'لون السطح', desc: 'خلفية البطاقات والنوافذ' },
  { key: 'card', label: 'لون البطاقة', desc: 'بطاقات المحتوى' },
  { key: 'textPrimary', label: 'النص الرئيسي', desc: 'العناوين والنصوص الأساسية' },
  { key: 'textSecondary', label: 'النص الثانوي', desc: 'النصوص الداعمة' },
  { key: 'textMuted', label: 'النص الخافت', desc: 'التواريخ والتلميحات' },
  { key: 'border', label: 'لون الحدود', desc: 'حدود البطاقات والمدخلات' },
  { key: 'tabBarBg', label: 'شريط التبويبات', desc: 'خلفية شريط التنقل' },
  { key: 'success', label: 'النجاح', desc: 'رسائل الإشعارات الإيجابية' },
  { key: 'warning', label: 'التحذير', desc: 'رسائل التحذير' },
  { key: 'error', label: 'الخطأ', desc: 'رسائل الأخطاء' },
];

function ColorRow({ field, value, onChange, theme }: {
  field: TokenField; value: string; onChange: (v: string) => void; theme: any;
}) {
  return (
    <View style={[cr.row, { borderColor: theme.border }]}>
      <View style={[cr.preview, { backgroundColor: value || '#CCC' }]}>
        {!value && <MaterialIcons name="format-color-fill" size={14} color="#999" />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[cr.label, { color: theme.textPrimary }]}>{field.label}</Text>
        <Text style={[cr.desc, { color: theme.textMuted }]}>{field.desc}</Text>
      </View>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="#000000"
        placeholderTextColor={theme.textMuted}
        style={[cr.input, { color: theme.textPrimary, backgroundColor: theme.background, borderColor: theme.border }]}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={7}
      />
    </View>
  );
}

const cr = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1 },
  preview: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  label: { fontSize: 13, fontFamily: 'Cairo_600SemiBold' },
  desc: { fontSize: 10, fontFamily: 'Cairo_400Regular', marginTop: 1 },
  input: { width: 90, height: 36, borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, fontSize: 12, fontFamily: 'Cairo_500Medium', textAlign: 'center' },
});

export default function ThemeBuilder() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!id);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [darkMode, setDarkMode] = useState(false);
  const [tokens, setTokens] = useState<DbThemeTokens>({ ...DEFAULT_TOKENS });
  // Schedule fields
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [showScheduleSection, setShowScheduleSection] = useState(false);
  const isEdit = !!id;

  const s = useMemo(() => createStyles(theme), [theme]);

  useEffect(() => {
    if (!user?.id) return;
    getSupabaseClient().from('user_profiles').select('is_admin').eq('id', user.id).single()
      .then(({ data }) => setIsAdmin(data?.is_admin || false));
  }, [user?.id]);

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    fetchThemeById(id).then(async t => {
      if (t) {
        setName(t.name);
        setDescription(t.description);
        setDarkMode(t.darkMode);
        setTokens(t.tokens);
        // Load schedule fields from DB
        const { data: raw } = await getSupabaseClient()
          .from('app_themes').select('start_at, end_at').eq('id', id).single();
        if (raw) {
          setStartAt(raw.start_at ? new Date(raw.start_at).toISOString().slice(0, 16) : '');
          setEndAt(raw.end_at ? new Date(raw.end_at).toISOString().slice(0, 16) : '');
        }
      }
      setLoading(false);
    });
  }, [id]);

  const updateToken = useCallback((key: keyof DbThemeTokens, val: string) => {
    setTokens(prev => ({ ...prev, [key]: val }));
  }, []);

  const saveSchedule = useCallback(async (themeId: string) => {
    const updates: any = {};
    if (startAt) updates.start_at = new Date(startAt).toISOString();
    else updates.start_at = null;
    if (endAt) updates.end_at = new Date(endAt).toISOString();
    else updates.end_at = null;
    if (Object.keys(updates).length > 0) {
      await getSupabaseClient().from('app_themes').update(updates).eq('id', themeId);
    }
  }, [startAt, endAt]);

  const handleSave = useCallback(async (publish = false) => {
    if (!user?.id || !isAdmin) return;
    if (!name.trim()) { showAlert('خطأ', 'يرجى إدخال اسم الثيم'); return; }
    // Validate schedule dates
    if (startAt && endAt && new Date(startAt) >= new Date(endAt)) {
      showAlert('خطأ في الجدولة', 'تاريخ الانتهاء يجب أن يكون بعد تاريخ البدء');
      return;
    }

    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (isEdit) {
      const { error } = await updateThemeTokens(id!, { name, description, darkMode, tokens }, user.id);
      if (error) { showAlert('خطأ', error); }
      else {
        await saveSchedule(id!);
        if (publish) {
          await publishTheme(id!, user.id);
          showAlert('تم النشر', startAt ? `تم نشر الثيم مجدولاً للبدء في ${new Date(startAt).toLocaleDateString('ar-EG')}` : 'تم نشر الثيم بنجاح');
        } else {
          showAlert('تم الحفظ', 'تم حفظ التغييرات والجدول الزمني');
        }
      }
    } else {
      const { id: newId, error } = await createTheme({ name, description, darkMode, tokens }, user.id);
      if (error) { showAlert('خطأ', error); }
      else {
        if (newId) await saveSchedule(newId);
        if (publish && newId) await publishTheme(newId, user.id);
        showAlert('تم', publish ? 'تم إنشاء الثيم ونشره' : 'تم إنشاء الثيم كمسودة');
        router.back();
      }
    }
    setSaving(false);
  }, [user?.id, isAdmin, name, description, darkMode, tokens, isEdit, id, router, showAlert, saveSchedule, startAt, endAt]);

  if (loading || isAdmin === null) {
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
        <Text style={[s.headerTitle, { color: theme.textPrimary }]}>
          {isEdit ? 'تعديل الثيم' : 'ثيم جديد'}
        </Text>
        <Pressable
          onPress={() => handleSave(false)}
          disabled={saving}
          style={[s.saveBtn, { borderColor: theme.primary + '60' }]}
        >
          {saving
            ? <ActivityIndicator size="small" color={theme.primary} />
            : <Text style={[s.saveBtnText, { color: theme.primary }]}>حفظ</Text>
          }
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 100 }}>
        {/* Theme Preview */}
        <Animated.View entering={FadeInDown.duration(300)} style={[s.previewCard, { backgroundColor: tokens.surface || '#FFF', borderColor: tokens.border || '#E2E8F0' }]}>
          <View style={[s.previewHeader, { backgroundColor: tokens.primary }]}>
            <Text style={s.previewTitle}>{name || 'اسم الثيم'}</Text>
          </View>
          <View style={s.previewBody}>
            <View style={[s.previewTextBlock, { backgroundColor: tokens.background || '#F8FAFC' }]}>
              <Text style={[s.previewH, { color: tokens.textPrimary || '#1E293B' }]}>مستر جيشو</Text>
              <Text style={[s.previewP, { color: tokens.textSecondary || '#475569' }]}>معاينة الثيم المخصص</Text>
            </View>
            <View style={[s.previewBtnRow]}>
              <View style={[s.previewBtn, { backgroundColor: tokens.primary }]}>
                <Text style={s.previewBtnText}>زر رئيسي</Text>
              </View>
              <View style={[s.previewOutline, { borderColor: tokens.primary }]}>
                <Text style={[s.previewOutlineText, { color: tokens.primary }]}>ثانوي</Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Meta */}
        <Animated.View entering={FadeInDown.duration(300).delay(60)} style={s.section}>
          <Text style={[s.sectionTitle, { color: theme.textPrimary }]}>معلومات الثيم</Text>
          <View style={[s.inputRow, { borderColor: theme.border, backgroundColor: theme.surface }]}>
            <MaterialIcons name="label" size={18} color={theme.textMuted} />
            <TextInput
              value={name} onChangeText={setName}
              placeholder="اسم الثيم" placeholderTextColor={theme.textMuted}
              style={[s.textInput, { color: theme.textPrimary }]}
              textAlign="right"
            />
          </View>
          <View style={[s.inputRow, { borderColor: theme.border, backgroundColor: theme.surface, marginTop: 8 }]}>
            <MaterialIcons name="description" size={18} color={theme.textMuted} />
            <TextInput
              value={description} onChangeText={setDescription}
              placeholder="وصف مختصر (اختياري)" placeholderTextColor={theme.textMuted}
              style={[s.textInput, { color: theme.textPrimary }]}
              textAlign="right"
            />
          </View>
          <View style={[s.toggleRow, { borderColor: theme.border, backgroundColor: theme.surface }]}>
            <View style={{ flex: 1 }}>
              <Text style={[s.toggleLabel, { color: theme.textPrimary }]}>وضع داكن</Text>
              <Text style={[s.toggleDesc, { color: theme.textMuted }]}>صمّم هذا الثيم للوضع الداكن</Text>
            </View>
            <Switch
              value={darkMode} onValueChange={setDarkMode}
              trackColor={{ false: theme.border, true: theme.primary + '60' }}
              thumbColor={darkMode ? theme.primary : theme.textMuted}
            />
          </View>
        </Animated.View>

        {/* ─── Schedule Section ─── */}
        <Animated.View entering={FadeInDown.duration(300).delay(80)} style={s.section}>
          <Pressable
            onPress={() => { Haptics.selectionAsync(); setShowScheduleSection(v => !v); }}
            style={[s.scheduleToggleRow, { backgroundColor: theme.surface, borderColor: theme.border }]}
          >
            <View style={[s.scheduleIconBg, { backgroundColor: '#F59E0B18' }]}>
              <MaterialIcons name="schedule" size={18} color="#F59E0B" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.toggleLabel, { color: theme.textPrimary }]}>جدولة الثيم</Text>
              <Text style={[s.toggleDesc, { color: theme.textMuted }]}>
                {startAt ? `يبدأ: ${new Date(startAt).toLocaleDateString('ar-EG')}` : 'تفعيل/إيقاف تلقائي حسب موعد'}
              </Text>
            </View>
            <MaterialIcons
              name={showScheduleSection ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
              size={22} color={theme.textMuted}
            />
          </Pressable>

          {showScheduleSection && (
            <Animated.View entering={FadeInDown.duration(240)} style={[s.scheduleCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              {/* Info banner */}
              <View style={[s.scheduleInfo, { backgroundColor: '#F59E0B12', borderColor: '#F59E0B30' }]}>
                <MaterialIcons name="info-outline" size={14} color="#F59E0B" />
                <Text style={{ fontSize: 11, fontFamily: 'Cairo_400Regular', color: theme.textSecondary, flex: 1, lineHeight: 18 }}>
                  عند النشر، يُفعَّل الثيم تلقائياً في تاريخ البدء ويُلغى في تاريخ الانتهاء عبر الـ Edge Function المجدولة.
                </Text>
              </View>

              {/* Start Date */}
              <View style={s.dateFieldGroup}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <MaterialIcons name="play-arrow" size={14} color="#10B981" />
                  <Text style={[s.dateLabel, { color: theme.textPrimary }]}>تاريخ البدء</Text>
                  {startAt ? (
                    <Pressable onPress={() => setStartAt('')} style={s.clearDateBtn}>
                      <MaterialIcons name="close" size={12} color="#EF4444" />
                    </Pressable>
                  ) : null}
                </View>
                <TextInput
                  value={startAt}
                  onChangeText={setStartAt}
                  placeholder="YYYY-MM-DDTHH:MM مثال: 2027-03-01T00:00"
                  placeholderTextColor={theme.textMuted}
                  style={[s.dateInput, { backgroundColor: theme.background, borderColor: startAt ? '#10B981' : theme.border, color: theme.textPrimary }]}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="numbers-and-punctuation"
                />
                {startAt && (() => {
                  try { return <Text style={[s.datePreview, { color: '#10B981' }]}>{new Date(startAt).toLocaleString('ar-EG', { dateStyle: 'full', timeStyle: 'short' })}</Text>; }
                  catch { return null; }
                })()}
              </View>

              {/* End Date */}
              <View style={s.dateFieldGroup}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <MaterialIcons name="stop" size={14} color="#EF4444" />
                  <Text style={[s.dateLabel, { color: theme.textPrimary }]}>تاريخ الانتهاء</Text>
                  {endAt ? (
                    <Pressable onPress={() => setEndAt('')} style={s.clearDateBtn}>
                      <MaterialIcons name="close" size={12} color="#EF4444" />
                    </Pressable>
                  ) : null}
                </View>
                <TextInput
                  value={endAt}
                  onChangeText={setEndAt}
                  placeholder="YYYY-MM-DDTHH:MM (اختياري — للعودة التلقائية)"
                  placeholderTextColor={theme.textMuted}
                  style={[s.dateInput, { backgroundColor: theme.background, borderColor: endAt ? '#EF4444' : theme.border, color: theme.textPrimary }]}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="numbers-and-punctuation"
                />
                {endAt && (() => {
                  try { return <Text style={[s.datePreview, { color: '#EF4444' }]}>{new Date(endAt).toLocaleString('ar-EG', { dateStyle: 'full', timeStyle: 'short' })}</Text>; }
                  catch { return null; }
                })()}
              </View>

              {/* Schedule summary */}
              {startAt && (
                <View style={[s.scheduleSummary, { backgroundColor: theme.primary + '10', borderColor: theme.primary + '30' }]}>
                  <MaterialIcons name="event" size={14} color={theme.primary} />
                  <Text style={{ fontSize: 12, fontFamily: 'Cairo_500Medium', color: theme.textSecondary, flex: 1 }}>
                    يُفعَّل الثيم في{' '}
                    <Text style={{ color: theme.primary, fontFamily: 'Cairo_700Bold' }}>
                      {(() => { try { return new Date(startAt).toLocaleDateString('ar-EG'); } catch { return startAt; } })()}
                    </Text>
                    {endAt ? (
                      <Text> ويعود في{' '}
                        <Text style={{ color: '#EF4444', fontFamily: 'Cairo_700Bold' }}>
                          {(() => { try { return new Date(endAt).toLocaleDateString('ar-EG'); } catch { return endAt; } })()}
                        </Text>
                      </Text>
                    ) : ' (بدون انتهاء تلقائي)'}
                  </Text>
                </View>
              )}
            </Animated.View>
          )}
        </Animated.View>

        {/* Color Tokens */}
        <Animated.View entering={FadeInDown.duration(300).delay(100)} style={s.section}>
          <Text style={[s.sectionTitle, { color: theme.textPrimary }]}>ألوان الثيم</Text>
          <View style={[s.colorSection, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            {TOKEN_FIELDS.map(field => (
              <ColorRow
                key={field.key}
                field={field}
                value={tokens[field.key] || ''}
                onChange={v => updateToken(field.key, v)}
                theme={theme}
              />
            ))}
          </View>
        </Animated.View>

        {/* Actions */}
        <View style={s.actionRow}>
          <Pressable
            onPress={() => handleSave(false)}
            disabled={saving}
            style={[s.draftBtn, { borderColor: theme.primary + '50', backgroundColor: theme.primary + '12' }]}
          >
            <MaterialIcons name="save" size={16} color={theme.primary} />
            <Text style={[s.draftBtnText, { color: theme.primary }]}>حفظ كمسودة</Text>
          </Pressable>
          <Pressable
            onPress={() => handleSave(true)}
            disabled={saving}
            style={[s.publishBtn, { backgroundColor: theme.primary }]}
          >
            <MaterialIcons name="publish" size={16} color="#FFF" />
            <Text style={s.publishBtnText}>نشر الثيم</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 18, fontFamily: 'Cairo_700Bold' },
  saveBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 9999, borderWidth: 1.5 },
  saveBtnText: { fontSize: 13, fontFamily: 'Cairo_700Bold' },
  previewCard: { borderRadius: 18, borderWidth: 1.5, overflow: 'hidden', marginBottom: 20 },
  previewHeader: { padding: 12 },
  previewTitle: { fontSize: 16, fontFamily: 'Cairo_700Bold', color: '#FFF' },
  previewBody: { padding: 12, gap: 10 },
  previewTextBlock: { padding: 10, borderRadius: 10 },
  previewH: { fontSize: 14, fontFamily: 'Cairo_700Bold' },
  previewP: { fontSize: 12, fontFamily: 'Cairo_400Regular', marginTop: 3 },
  previewBtnRow: { flexDirection: 'row', gap: 8 },
  previewBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 9999 },
  previewBtnText: { fontSize: 12, fontFamily: 'Cairo_700Bold', color: '#FFF' },
  previewOutline: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 9999, borderWidth: 1.5 },
  previewOutlineText: { fontSize: 12, fontFamily: 'Cairo_700Bold' },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontFamily: 'Cairo_700Bold', marginBottom: 10 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 48, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12 },
  textInput: { flex: 1, fontSize: 14, fontFamily: 'Cairo_400Regular', writingDirection: 'rtl' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, padding: 12, borderRadius: 12, borderWidth: 1 },
  toggleLabel: { fontSize: 14, fontFamily: 'Cairo_600SemiBold' },
  toggleDesc: { fontSize: 11, fontFamily: 'Cairo_400Regular', marginTop: 2 },
  // Schedule styles
  scheduleToggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1 },
  scheduleIconBg: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  scheduleCard: { borderRadius: 14, borderWidth: 1, padding: 14, marginTop: 8, gap: 14 },
  scheduleInfo: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 10, borderRadius: 10, borderWidth: 1 },
  dateFieldGroup: { gap: 4 },
  dateLabel: { fontSize: 13, fontFamily: 'Cairo_600SemiBold' },
  clearDateBtn: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#EF444415', alignItems: 'center', justifyContent: 'center' },
  dateInput: { height: 42, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, fontSize: 13, fontFamily: 'Cairo_400Regular' },
  datePreview: { fontSize: 11, fontFamily: 'Cairo_500Medium', marginTop: 3 },
  scheduleSummary: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 10, borderRadius: 10, borderWidth: 1 },
  colorSection: { borderRadius: 14, borderWidth: 1, paddingHorizontal: 12 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  draftBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 14, borderWidth: 1.5 },
  draftBtnText: { fontSize: 14, fontFamily: 'Cairo_700Bold' },
  publishBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 14 },
  publishBtnText: { fontSize: 14, fontFamily: 'Cairo_700Bold', color: '#FFF' },
});

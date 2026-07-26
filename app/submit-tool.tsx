import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useTheme } from '../contexts/ThemeContext';
import { useAlert, useAuth } from '@/template';
import { config } from '../constants/config';
import { submitTool } from '../services/toolsService';
import { useAppContext } from '../contexts/AppContext';

export default function SubmitToolScreen() {
  const { theme } = useTheme();
  const { showAlert } = useAlert();
  const { user } = useAuth();
  const { refreshTools } = useAppContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [pricing, setPricing] = useState('');
  const [url, setUrl] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [developerName, setDeveloperName] = useState(user?.username || user?.email?.split('@')[0] || '');
  const [developerBio, setDeveloperBio] = useState('');
  const [loading, setLoading] = useState(false);

  const s = useMemo(() => createStyles(theme), [theme]);

  const parsedTags = useMemo(() =>
    tagsInput.split(',').map(t => t.trim()).filter(Boolean).slice(0, 8),
    [tagsInput]
  );

  const handleSubmit = useCallback(async () => {
    if (!name.trim()) { showAlert('خطأ', 'يرجى إدخال اسم الأداة'); return; }
    if (!shortDescription.trim()) { showAlert('خطأ', 'يرجى إدخال وصف مختصر'); return; }
    if (!description.trim()) { showAlert('خطأ', 'يرجى إدخال الوصف التفصيلي'); return; }
    if (!category) { showAlert('خطأ', 'يرجى اختيار الفئة'); return; }
    if (!pricing) { showAlert('خطأ', 'يرجى اختيار التسعير'); return; }
    if (!developerName.trim()) { showAlert('خطأ', 'يرجى إدخال اسم المطور'); return; }
    if (!user?.id) { showAlert('خطأ', 'يجب تسجيل الدخول أولاً'); return; }

    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await submitTool({
        userId: user.id,
        name: name.trim(),
        shortDescription: shortDescription.trim(),
        description: description.trim(),
        category,
        pricing,
        tags: parsedTags,
        url: url.trim(),
        developerName: developerName.trim(),
        developerBio: developerBio.trim(),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      refreshTools();
      showAlert('تم الإرسال', 'تم إرسال الأداة بنجاح وستخضع للمراجعة قبل النشر', [
        { text: 'حسناً', onPress: () => router.back() },
      ]);
    } catch {
      showAlert('خطأ', 'حدث خطأ أثناء الإرسال، يرجى المحاولة مرة أخرى');
    } finally {
      setLoading(false);
    }
  }, [name, shortDescription, description, category, pricing, url, parsedTags, developerName, developerBio, user, showAlert, router]);

  return (
    <SafeAreaView edges={['top']} style={s.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {/* Header */}
        <View style={s.header}>
          <Pressable onPress={() => router.back()} style={s.backBtn}>
            <MaterialIcons name="arrow-forward" size={22} color={theme.textPrimary} />
          </Pressable>
          <Text style={s.headerTitle}>إضافة أداة جديدة</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 100 }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Review Badge */}
          <Animated.View entering={FadeInDown.duration(400)} style={s.reviewBanner}>
            <MaterialIcons name="pending-actions" size={20} color="#F59E0B" />
            <Text style={s.reviewText}>ستخضع الأداة للمراجعة قبل النشر على المنصة</Text>
          </Animated.View>

          {/* Section: Basic Info */}
          <Animated.View entering={FadeInDown.duration(400).delay(50)} style={s.section}>
            <Text style={s.sectionTitle}>المعلومات الأساسية</Text>

            <View style={s.field}>
              <Text style={s.label}>اسم الأداة *</Text>
              <View style={s.inputRow}>
                <MaterialIcons name="label" size={18} color={theme.textMuted} />
                <TextInput style={s.input} placeholder="مثال: ChatGPT Pro" placeholderTextColor={theme.textMuted}
                  value={name} onChangeText={setName} textAlign="right" />
              </View>
            </View>

            <View style={s.field}>
              <Text style={s.label}>وصف مختصر * (جملة واحدة)</Text>
              <View style={s.inputRow}>
                <MaterialIcons name="short-text" size={18} color={theme.textMuted} />
                <TextInput style={s.input} placeholder="وصف مختصر للأداة في 10 كلمات" placeholderTextColor={theme.textMuted}
                  value={shortDescription} onChangeText={setShortDescription} textAlign="right" maxLength={120} />
              </View>
            </View>

            <View style={s.field}>
              <Text style={s.label}>الوصف التفصيلي *</Text>
              <TextInput
                style={[s.inputRow, s.textArea]}
                placeholder="اشرح ما تفعله الأداة، مميزاتها الرئيسية، وكيف تفيد المستخدمين..."
                placeholderTextColor={theme.textMuted}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={5}
                textAlign="right"
                textAlignVertical="top"
              />
            </View>

            <View style={s.field}>
              <Text style={s.label}>رابط الأداة</Text>
              <View style={s.inputRow}>
                <MaterialIcons name="link" size={18} color={theme.textMuted} />
                <TextInput style={s.input} placeholder="https://example.com" placeholderTextColor={theme.textMuted}
                  value={url} onChangeText={setUrl} keyboardType="url" autoCapitalize="none" textAlign="right" />
              </View>
            </View>
          </Animated.View>

          {/* Section: Category */}
          <Animated.View entering={FadeInDown.duration(400).delay(100)} style={s.section}>
            <Text style={s.sectionTitle}>الفئة والتسعير</Text>

            <View style={s.field}>
              <Text style={s.label}>الفئة *</Text>
              <View style={s.chipGrid}>
                {config.categories.map(cat => {
                  const color = theme.categoryColors[cat] || theme.primary;
                  const selected = category === cat;
                  return (
                    <Pressable key={cat} style={[s.categoryChip, selected && { backgroundColor: color, borderColor: color }]}
                      onPress={() => { Haptics.selectionAsync(); setCategory(cat); }}>
                      <Text style={[s.categoryChipText, selected && { color: '#FFF' }]}>{cat}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={s.field}>
              <Text style={s.label}>التسعير *</Text>
              <View style={s.chipRow}>
                {config.pricingOptions.map(p => {
                  const selected = pricing === p;
                  return (
                    <Pressable key={p} style={[s.pricingChip, selected && { backgroundColor: theme.primary, borderColor: theme.primary }]}
                      onPress={() => { Haptics.selectionAsync(); setPricing(p); }}>
                      <Text style={[s.pricingChipText, selected && { color: '#FFF' }]}>{p}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </Animated.View>

          {/* Section: Tags */}
          <Animated.View entering={FadeInDown.duration(400).delay(150)} style={s.section}>
            <Text style={s.sectionTitle}>الوسوم</Text>
            <View style={s.field}>
              <Text style={s.label}>الوسوم (مفصولة بفاصلة، حتى 8)</Text>
              <View style={s.inputRow}>
                <MaterialIcons name="local-offer" size={18} color={theme.textMuted} />
                <TextInput style={s.input} placeholder="ذكاء اصطناعي, كتابة, محتوى" placeholderTextColor={theme.textMuted}
                  value={tagsInput} onChangeText={setTagsInput} textAlign="right" />
              </View>
              {parsedTags.length > 0 && (
                <View style={s.tagPreview}>
                  {parsedTags.map(tag => (
                    <View key={tag} style={s.tagPill}><Text style={s.tagPillText}>#{tag}</Text></View>
                  ))}
                </View>
              )}
            </View>
          </Animated.View>

          {/* Section: Developer */}
          <Animated.View entering={FadeInDown.duration(400).delay(200)} style={s.section}>
            <Text style={s.sectionTitle}>معلومات المطور</Text>

            <View style={s.field}>
              <Text style={s.label}>اسم المطور / الشركة *</Text>
              <View style={s.inputRow}>
                <MaterialIcons name="person" size={18} color={theme.textMuted} />
                <TextInput style={s.input} placeholder="اسمك أو اسم شركتك" placeholderTextColor={theme.textMuted}
                  value={developerName} onChangeText={setDeveloperName} textAlign="right" />
              </View>
            </View>

            <View style={s.field}>
              <Text style={s.label}>نبذة عن المطور</Text>
              <TextInput
                style={[s.inputRow, s.textAreaSmall]}
                placeholder="نبذة مختصرة عنك أو عن شركتك..."
                placeholderTextColor={theme.textMuted}
                value={developerBio}
                onChangeText={setDeveloperBio}
                multiline
                numberOfLines={3}
                textAlign="right"
                textAlignVertical="top"
              />
            </View>
          </Animated.View>
        </ScrollView>

        {/* Submit Button */}
        <View style={[s.footer, { paddingBottom: insets.bottom + 16 }]}>
          <Pressable onPress={handleSubmit} disabled={loading} style={{ borderRadius: 14, overflow: 'hidden' }}>
            <LinearGradient colors={[theme.primary, theme.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={[s.submitBtn, loading && { opacity: 0.6 }]}>
              {loading ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <>
                  <MaterialIcons name="send" size={20} color="#FFF" />
                  <Text style={s.submitText}>إرسال للمراجعة</Text>
                </>
              )}
            </LinearGradient>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.border },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.border },
  headerTitle: { fontSize: 18, fontWeight: '700', fontFamily: 'Cairo_700Bold', color: theme.textPrimary },
  content: { paddingHorizontal: 16, paddingTop: 16 },
  reviewBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F59E0B20', borderRadius: 12, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: '#F59E0B40' },
  reviewText: { flex: 1, fontSize: 13, fontFamily: 'Cairo_500Medium', color: '#F59E0B', textAlign: 'right' },
  section: { backgroundColor: theme.surface, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: theme.border },
  sectionTitle: { fontSize: 16, fontWeight: '700', fontFamily: 'Cairo_700Bold', color: theme.textPrimary, marginBottom: 16, textAlign: 'right' },
  field: { marginBottom: 14 },
  label: { fontSize: 12, fontFamily: 'Cairo_600SemiBold', color: theme.textSecondary, marginBottom: 6, textAlign: 'right' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.backgroundSecondary, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, borderWidth: 1, borderColor: theme.border },
  input: { flex: 1, fontSize: 15, fontFamily: 'Cairo_400Regular', color: theme.textPrimary, writingDirection: 'rtl' },
  textArea: { alignItems: 'flex-start', paddingVertical: 12, minHeight: 110 },
  textAreaSmall: { alignItems: 'flex-start', paddingVertical: 12, minHeight: 80, fontSize: 15, fontFamily: 'Cairo_400Regular', color: theme.textPrimary, writingDirection: 'rtl' },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 9999, backgroundColor: theme.backgroundSecondary, borderWidth: 1, borderColor: theme.border },
  categoryChipText: { fontSize: 12, fontFamily: 'Cairo_600SemiBold', color: theme.textSecondary },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pricingChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 9999, backgroundColor: theme.backgroundSecondary, borderWidth: 1, borderColor: theme.border },
  pricingChipText: { fontSize: 13, fontFamily: 'Cairo_600SemiBold', color: theme.textSecondary },
  tagPreview: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  tagPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999, backgroundColor: theme.primary + '20' },
  tagPillText: { fontSize: 11, fontFamily: 'Cairo_500Medium', color: theme.primary },
  footer: { paddingHorizontal: 16, paddingTop: 12, backgroundColor: theme.background, borderTopWidth: 1, borderTopColor: theme.border },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16 },
  submitText: { fontSize: 17, fontWeight: '700', fontFamily: 'Cairo_700Bold', color: '#FFF' },
});

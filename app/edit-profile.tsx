
import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator, Animated,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useTheme } from '../contexts/ThemeContext';
import { useAlert, useAuth } from '@/template';
import { getSupabaseClient } from '@/template';

export default function EditProfileScreen() {
  const { theme } = useTheme();
  const { showAlert } = useAlert();
  const { user, refreshSession } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const s = useMemo(() => createStyles(theme), [theme]);

  const [username, setUsername] = useState(user?.username || '');
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  // Success animation
  const checkScale = useRef(new Animated.Value(0)).current;
  const checkOpacity = useRef(new Animated.Value(0)).current;

  const displayName = user?.username || user?.email?.split('@')[0] || 'مستخدم';
  const initials = displayName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();

  const hasChanges = username.trim() !== (user?.username || '');

  const animateSuccess = useCallback(() => {
    setSaved(true);
    Animated.sequence([
      Animated.parallel([
        Animated.spring(checkScale, { toValue: 1, useNativeDriver: true, tension: 80, friction: 6 }),
        Animated.timing(checkOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]),
      Animated.delay(1600),
      Animated.parallel([
        Animated.timing(checkScale, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(checkOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]),
    ]).start(() => setSaved(false));
  }, [checkScale, checkOpacity]);

  const handleSave = useCallback(async () => {
    const trimmed = username.trim();
    if (!trimmed) {
      showAlert('خطأ', 'يرجى إدخال الاسم المعروض');
      return;
    }
    if (trimmed.length < 2) {
      showAlert('خطأ', 'يجب أن يكون الاسم حرفين على الأقل');
      return;
    }
    if (trimmed.length > 40) {
      showAlert('خطأ', 'يجب ألا يتجاوز الاسم 40 حرفاً');
      return;
    }
    if (!user?.id) {
      showAlert('خطأ', 'يجب تسجيل الدخول أولاً');
      return;
    }

    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('user_profiles')
        .update({ username: trimmed })
        .eq('id', user.id);

      if (error) {
        showAlert('خطأ', 'فشل حفظ التغييرات، يرجى المحاولة مرة أخرى');
        return;
      }

      await refreshSession();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      animateSuccess();
    } catch {
      showAlert('خطأ', 'حدث خطأ أثناء الحفظ');
    } finally {
      setLoading(false);
    }
  }, [username, user, showAlert, refreshSession, animateSuccess]);

  return (
    <SafeAreaView edges={['top']} style={s.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {/* Header */}
        <View style={s.header}>
          <Pressable onPress={() => router.back()} style={s.backBtn}>
            <MaterialIcons name="arrow-forward" size={22} color={theme.textPrimary} />
          </Pressable>
          <Text style={s.headerTitle}>تعديل الملف الشخصي</Text>
          <View style={{ width: 40 }} />
        </View> {/* This closing tag was missing */}

        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 24, paddingBottom: 24 }}>
          {/* Avatar */}
          <View style={s.avatarSection}>
            <LinearGradient
              colors={[theme.primaryDark, theme.primary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.avatarCircle}
            >
              <Text style={s.avatarText}>{initials || '؟'}</Text>
            </LinearGradient>
            <Text style={s.avatarHint}>الصورة الرمزية تعتمد على حرف الاسم</Text>
          </View>

          {/* Username Field */}
          <View style={s.card}>
            <Text style={s.sectionTitle}>البيانات الشخصية</Text>

            <View style={s.field}>
              <Text style={s.label}>الاسم المعروض</Text>
              <View style={[s.inputRow, username.length > 0 && s.inputRowActive]}>
                <MaterialIcons name="person" size={20} color={username.length > 0 ? theme.primary : theme.textMuted} />
                <TextInput
                  style={s.input}
                  value={username}
                  onChangeText={setUsername}
                  placeholder="أدخل اسمك المعروض"
                  placeholderTextColor={theme.textMuted}
                  textAlign="right"
                  maxLength={40}
                  autoCapitalize="words"
                  returnKeyType="done"
                  onSubmitEditing={handleSave}
                />
                {username.length > 0 ? (
                  <Pressable onPress={() => setUsername('')} hitSlop={8}>
                    <MaterialIcons name="close" size={16} color={theme.textMuted} />
                  </Pressable>
                ) : null}
              </View>
              <View style={s.fieldMeta}>
                <Text style={s.charCount}>{username.length}/40</Text>
                <Text style={s.fieldHint}>يظهر هذا الاسم على ملفك الشخصي والتعليقات</Text>
              </View>
            </View>

            {/* Email (Read-only) */}
            <View style={s.field}>
              <Text style={s.label}>البريد الإلكتروني</Text>
              <View style={s.inputRowReadonly}>
                <MaterialIcons name="email" size={20} color={theme.textMuted} />
                <Text style={s.readonlyText}>{user?.email || '-'}</Text>
                <View style={s.lockedBadge}>
                  <MaterialIcons name="lock" size={12} color={theme.textMuted} />
                  <Text style={s.lockedText}>محمي</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Change Password */}
          <Pressable style={s.changePassBtn} onPress={() => router.push('/change-password')}>
            <View style={[s.changePassIcon, { backgroundColor: '#F59E0B20' }]}>
              <MaterialIcons name="lock-reset" size={22} color="#F59E0B" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.changePassLabel}>تغيير كلمة المرور</Text>
              <Text style={s.changePassDesc}>عبر رمز OTP على بريدك الإلكتروني</Text>
            </View>
            <MaterialIcons name="chevron-left" size={20} color={theme.textMuted} />
          </Pressable>

          {/* Info Card */}
          <View style={s.infoCard}>
            <MaterialIcons name="info-outline" size={16} color={theme.primary} />
            <Text style={s.infoText}>تغيير الاسم لا يؤثر على بريدك الإلكتروني أو كلمة المرور</Text>
          </View>
        </ScrollView>

        {/* Save Button */}
        <View style={[s.footer, { paddingBottom: insets.bottom + 16 }]}>
          {/* Success indicator */}
          <Animated.View
            style={[s.successBanner, { opacity: checkOpacity, transform: [{ scale: checkScale }] }]}
            pointerEvents="none"
          >
            <MaterialIcons name="check-circle" size={20} color="#22C55E" />
            <Text style={s.successText}>تم حفظ التغييرات بنجاح</Text>
          </Animated.View>

          <Pressable
            onPress={handleSave}
            disabled={loading || !hasChanges}
            style={{ borderRadius: 14, overflow: 'hidden', opacity: (!hasChanges && !loading) ? 0.5 : 1 }}
          >
            <LinearGradient
              colors={saved ? ['#22C55E', '#16A34A'] : [theme.primary, theme.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[s.saveBtn, loading && { opacity: 0.7 }]}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : saved ? (
                <>
                  <MaterialIcons name="check" size={20} color="#FFF" />
                  <Text style={s.saveBtnText}>تم الحفظ</Text>
                </>
              ) : (
                <>
                  <MaterialIcons name="save" size={20} color="#FFF" />
                  <Text style={s.saveBtnText}>حفظ التغييرات</Text>
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
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: theme.border,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', fontFamily: 'Cairo_700Bold', color: theme.textPrimary },

  avatarSection: { alignItems: 'center', marginBottom: 28 },
  avatarCircle: {
    width: 88, height: 88, borderRadius: 44,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  avatarText: { fontSize: 32, fontWeight: '700', fontFamily: 'Cairo_700Bold', color: '#FFF' },
  avatarHint: { fontSize: 12, fontFamily: 'Cairo_400Regular', color: theme.textMuted },

  card: {
    backgroundColor: theme.surface, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: theme.border, marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 15, fontWeight: '700', fontFamily: 'Cairo_700Bold',
    color: theme.textPrimary, marginBottom: 16, textAlign: 'right',
  },

  field: { marginBottom: 14 },
  label: {
    fontSize: 12, fontFamily: 'Cairo_600SemiBold',
    color: theme.textSecondary, marginBottom: 6, textAlign: 'right',
  },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: theme.backgroundSecondary, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 12,
    borderWidth: 1.5, borderColor: theme.border,
  },
  inputRowActive: {
    borderColor: theme.primary,
    backgroundColor: theme.primary + '08',
  },
  input: {
    flex: 1, fontSize: 15, fontFamily: 'Cairo_400Regular',
    color: theme.textPrimary, writingDirection: 'rtl',
  },
  fieldMeta: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginTop: 6, paddingHorizontal: 2,
  },
  fieldHint: { fontSize: 11, fontFamily: 'Cairo_400Regular', color: theme.textMuted, flex: 1, textAlign: 'right' },
  charCount: { fontSize: 11, fontFamily: 'Cairo_500Medium', color: theme.textMuted },

  inputRowReadonly: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: theme.backgroundSecondary, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 12,
    borderWidth: 1.5, borderColor: theme.border, opacity: 0.65,
  },
  readonlyText: {
    flex: 1, fontSize: 15, fontFamily: 'Cairo_400Regular',
    color: theme.textSecondary, textAlign: 'right',
  },
  lockedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: theme.border, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 9999,
  },
  lockedText: { fontSize: 10, fontFamily: 'Cairo_500Medium', color: theme.textMuted },

  changePassBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: theme.surface, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: theme.border, marginBottom: 14,
  },
  changePassIcon: {
    width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
  },
  changePassLabel: {
    fontSize: 15, fontFamily: 'Cairo_600SemiBold', color: theme.textPrimary,
  },
  changePassDesc: {
    fontSize: 11, fontFamily: 'Cairo_400Regular', color: theme.textMuted, marginTop: 2,
  },
  infoCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: theme.primary + '12', borderRadius: 12,
    padding: 12, borderWidth: 1, borderColor: theme.primary + '25',
  },
  infoText: { flex: 1, fontSize: 12, fontFamily: 'Cairo_500Medium', color: theme.textSecondary, textAlign: 'right' },

  footer: {
    paddingHorizontal: 16, paddingTop: 12,
    backgroundColor: theme.background, borderTopWidth: 1, borderTopColor: theme.border,
    gap: 10,
  },
  successBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#22C55E18', borderRadius: 10, paddingVertical: 10,
    borderWidth: 1, borderColor: '#22C55E30',
  },
  successText: { fontSize: 14, fontFamily: 'Cairo_600SemiBold', color: '#22C55E' },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 16, borderRadius: 14,
  },
  saveBtnText: { fontSize: 17, fontWeight: '700', fontFamily: 'Cairo_700Bold', color: '#FFF' },
});

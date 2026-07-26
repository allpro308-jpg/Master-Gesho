import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useAuth, useAlert } from '@/template';
import { useTheme } from '../contexts/ThemeContext';

type AuthMode = 'login' | 'register' | 'otp';

export default function LoginScreen() {
  const { theme } = useTheme();
  const { sendOTP, verifyOTPAndLogin, signInWithPassword, operationLoading } = useAuth();
  const { showAlert } = useAlert();

  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const styles = useMemo(() => createStyles(theme), [theme]);

  const handleLogin = useCallback(async () => {
    if (!email.trim() || !password.trim()) {
      showAlert('خطأ', 'يرجى ملء جميع الحقول');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const { error } = await signInWithPassword(email.trim(), password);
    if (error) showAlert('خطأ', error);
  }, [email, password, signInWithPassword, showAlert]);

  const handleRegister = useCallback(async () => {
    if (!email.trim() || !password.trim() || !confirmPassword.trim()) {
      showAlert('خطأ', 'يرجى ملء جميع الحقول');
      return;
    }
    if (password !== confirmPassword) {
      showAlert('خطأ', 'كلمتا المرور غير متطابقتين');
      return;
    }
    if (password.length < 6) {
      showAlert('خطأ', 'كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const { error } = await sendOTP(email.trim());
    if (error) {
      showAlert('خطأ', error);
      return;
    }
    showAlert('تم', 'تم إرسال رمز التحقق إلى بريدك الإلكتروني');
    setMode('otp');
  }, [email, password, confirmPassword, sendOTP, showAlert]);

  const handleVerifyOTP = useCallback(async () => {
    if (!otp.trim()) {
      showAlert('خطأ', 'يرجى إدخال رمز التحقق');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const { error } = await verifyOTPAndLogin(email.trim(), otp.trim(), { password });
    if (error) showAlert('خطأ', error);
  }, [otp, email, password, verifyOTPAndLogin, showAlert]);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo & Welcome */}
          <Animated.View entering={FadeInDown.duration(500)} style={styles.logoSection}>
            <LinearGradient
              colors={[theme.primary, theme.primaryDark]}
              style={styles.logoCircle}
            >
              <MaterialIcons name="auto-awesome" size={36} color="#FFF" />
            </LinearGradient>
            <Text style={styles.appName}>مستر جيشو</Text>
            <Text style={styles.appTagline}>منصتك العربية لأدوات الذكاء الاصطناعي</Text>
          </Animated.View>

          {/* Title */}
          <Animated.View entering={FadeInDown.duration(500).delay(100)}>
            <Text style={styles.title}>
              {mode === 'login' ? 'تسجيل الدخول' : mode === 'register' ? 'حساب جديد' : 'رمز التحقق'}
            </Text>
            <Text style={styles.subtitle}>
              {mode === 'login'
                ? 'أدخل بياناتك للوصول لحسابك'
                : mode === 'register'
                  ? 'أنشئ حساباً جديداً للبدء'
                  : `أدخل الرمز المرسل إلى ${email}`}
            </Text>
          </Animated.View>

          {/* Form */}
          <Animated.View entering={FadeInUp.duration(500).delay(200)} style={styles.form}>
            {mode === 'otp' ? (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>رمز التحقق</Text>
                <View style={styles.inputContainer}>
                  <MaterialIcons name="pin" size={20} color={theme.textMuted} />
                  <TextInput
                    style={styles.input}
                    placeholder="0000"
                    placeholderTextColor={theme.textMuted}
                    value={otp}
                    onChangeText={setOtp}
                    keyboardType="number-pad"
                    textAlign="right"
                    maxLength={4}
                  />
                </View>
              </View>
            ) : (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>البريد الإلكتروني</Text>
                  <View style={styles.inputContainer}>
                    <MaterialIcons name="email" size={20} color={theme.textMuted} />
                    <TextInput
                      style={styles.input}
                      placeholder="name@example.com"
                      placeholderTextColor={theme.textMuted}
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      textAlign="right"
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>كلمة المرور</Text>
                  <View style={styles.inputContainer}>
                    <MaterialIcons name="lock" size={20} color={theme.textMuted} />
                    <TextInput
                      style={styles.input}
                      placeholder="••••••"
                      placeholderTextColor={theme.textMuted}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      textAlign="right"
                    />
                    <Pressable onPress={() => setShowPassword(!showPassword)} hitSlop={8}>
                      <MaterialIcons name={showPassword ? 'visibility' : 'visibility-off'} size={20} color={theme.textMuted} />
                    </Pressable>
                  </View>
                </View>

                {mode === 'register' && (
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>تأكيد كلمة المرور</Text>
                    <View style={styles.inputContainer}>
                      <MaterialIcons name="lock-outline" size={20} color={theme.textMuted} />
                      <TextInput
                        style={styles.input}
                        placeholder="••••••"
                        placeholderTextColor={theme.textMuted}
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        secureTextEntry={!showPassword}
                        textAlign="right"
                      />
                    </View>
                  </View>
                )}
              </>
            )}

            {/* Primary Button */}
            <Pressable
              onPress={mode === 'login' ? handleLogin : mode === 'register' ? handleRegister : handleVerifyOTP}
              disabled={operationLoading}
              style={{ borderRadius: 14, overflow: 'hidden', marginTop: 8 }}
            >
              <LinearGradient
                colors={[theme.primary, theme.primaryDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.primaryButton, operationLoading && { opacity: 0.6 }]}
              >
                {operationLoading ? (
                  <Text style={styles.primaryButtonText}>جارٍ التحميل...</Text>
                ) : (
                  <Text style={styles.primaryButtonText}>
                    {mode === 'login' ? 'دخول' : mode === 'register' ? 'إنشاء حساب' : 'تأكيد'}
                  </Text>
                )}
              </LinearGradient>
            </Pressable>

            {/* Switch Mode */}
            {mode !== 'otp' && (
              <View style={styles.switchRow}>
                <Text style={styles.switchText}>
                  {mode === 'login' ? 'ليس لديك حساب؟' : 'لديك حساب بالفعل؟'}
                </Text>
                <Pressable onPress={() => {
                  Haptics.selectionAsync();
                  setMode(mode === 'login' ? 'register' : 'login');
                  setOtp('');
                }}>
                  <Text style={styles.switchLink}>
                    {mode === 'login' ? 'سجّل الآن' : 'سجّل دخول'}
                  </Text>
                </Pressable>
              </View>
            )}

            {mode === 'otp' && (
              <Pressable onPress={() => setMode('register')} style={styles.backLink}>
                <MaterialIcons name="arrow-forward" size={16} color={theme.primary} />
                <Text style={[styles.switchLink, { marginLeft: 4 }]}>رجوع</Text>
              </Pressable>
            )}
          </Animated.View>

          {/* Footer */}
          <Text style={styles.footer}>© 2026 منصة مستر جيشو</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24, justifyContent: 'center', paddingVertical: 40 },
  logoSection: { alignItems: 'center', marginBottom: 32 },
  logoCircle: { width: 72, height: 72, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  appName: { fontSize: 28, fontWeight: '800', fontFamily: 'Cairo_700Bold', color: theme.textPrimary },
  appTagline: { fontSize: 14, fontFamily: 'Cairo_400Regular', color: theme.textMuted, marginTop: 4 },
  title: { fontSize: 24, fontWeight: '700', fontFamily: 'Cairo_700Bold', color: theme.textPrimary, textAlign: 'center', marginBottom: 6 },
  subtitle: { fontSize: 14, fontFamily: 'Cairo_400Regular', color: theme.textSecondary, textAlign: 'center', marginBottom: 28 },
  form: { gap: 16 },
  inputGroup: { gap: 6 },
  label: { fontSize: 13, fontFamily: 'Cairo_600SemiBold', color: theme.textSecondary, textAlign: 'right' },
  inputContainer: {
    flexDirection: 'row', alignItems: 'center', gap: 10, height: 52,
    backgroundColor: theme.surface, borderRadius: 14, paddingHorizontal: 14,
    borderWidth: 1, borderColor: theme.border,
  },
  input: { flex: 1, fontSize: 15, fontFamily: 'Cairo_400Regular', color: theme.textPrimary, writingDirection: 'rtl' },
  primaryButton: { paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { fontSize: 17, fontWeight: '700', fontFamily: 'Cairo_700Bold', color: '#FFF' },
  switchRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 8 },
  switchText: { fontSize: 14, fontFamily: 'Cairo_400Regular', color: theme.textMuted },
  switchLink: { fontSize: 14, fontFamily: 'Cairo_700Bold', color: theme.primary },
  backLink: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  footer: { fontSize: 11, fontFamily: 'Cairo_400Regular', color: theme.textMuted, textAlign: 'center', marginTop: 40, opacity: 0.6 },
});

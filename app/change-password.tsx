import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Animated,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useTheme } from '../contexts/ThemeContext';
import { useAlert, useAuth, getSupabaseClient } from '@/template';

type Step = 'request' | 'verify' | 'newPassword' | 'success';

export default function ChangePasswordScreen() {
  const { theme } = useTheme();
  const { showAlert } = useAlert();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const s = useMemo(() => createStyles(theme), [theme]);

  const [step, setStep] = useState<Step>('request');
  const [loading, setLoading] = useState(false);

  // Step 1 - email
  const email = user?.email || '';

  // Step 2 - OTP
  const [otp, setOtp] = useState('');
  const otpRefs = useRef<(TextInput | null)[]>([]);

  // Step 3 - new password
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Success animation
  const successScale = useRef(new Animated.Value(0)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;

  const animateSuccess = useCallback(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(successScale, { toValue: 1, useNativeDriver: true, tension: 80, friction: 6 }),
        Animated.timing(successOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]),
    ]).start();
  }, [successScale, successOpacity]);

  // Step 1: Send OTP
  const handleSendOTP = useCallback(async () => {
    if (!email) {
      showAlert('خطأ', 'البريد الإلكتروني غير متاح، يرجى تسجيل الدخول من جديد');
      return;
    }
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
      });
      if (error) {
        showAlert('خطأ', error.message || 'فشل إرسال الرمز');
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setOtp('');
      setStep('verify');
    } catch {
      showAlert('خطأ', 'حدث خطأ غير متوقع');
    } finally {
      setLoading(false);
    }
  }, [email, showAlert]);

  // Step 2: Verify OTP
  const handleVerifyOTP = useCallback(async () => {
    if (otp.length !== 4) {
      showAlert('خطأ', 'يرجى إدخال الرمز المكون من 4 أرقام');
      return;
    }
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: 'email',
      });
      if (error) {
        showAlert('رمز خاطئ', 'الرمز المدخل غير صحيح أو انتهت صلاحيته');
        setOtp('');
        otpRefs.current[0]?.focus();
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep('newPassword');
    } catch {
      showAlert('خطأ', 'حدث خطأ أثناء التحقق');
    } finally {
      setLoading(false);
    }
  }, [otp, email, showAlert]);

  // Step 3: Update password
  const handleUpdatePassword = useCallback(async () => {
    if (newPassword.length < 6) {
      showAlert('خطأ', 'يجب أن تكون كلمة المرور 6 أحرف على الأقل');
      return;
    }
    if (newPassword !== confirmPassword) {
      showAlert('خطأ', 'كلمة المرور وتأكيدها غير متطابقتين');
      return;
    }
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        showAlert('خطأ', error.message || 'فشل تحديث كلمة المرور');
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep('success');
      animateSuccess();
    } catch {
      showAlert('خطأ', 'حدث خطأ أثناء تحديث كلمة المرور');
    } finally {
      setLoading(false);
    }
  }, [newPassword, confirmPassword, showAlert, animateSuccess]);

  // OTP digit input handler
  const handleOtpChange = useCallback((text: string, index: number) => {
    const digit = text.replace(/[^0-9]/g, '').slice(-1);
    const otpArr = otp.split('');
    while (otpArr.length < 4) otpArr.push('');
    otpArr[index] = digit;
    const newOtp = otpArr.join('').slice(0, 4);
    setOtp(newOtp);
    if (digit && index < 3) {
      setTimeout(() => otpRefs.current[index + 1]?.focus(), 50);
    }
  }, [otp]);

  const handleOtpKeyPress = useCallback((key: string, index: number) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  }, [otp]);

  const passwordStrength = useMemo(() => {
    if (!newPassword) return null;
    if (newPassword.length < 6) return { label: 'ضعيفة', color: '#EF4444', width: '30%' };
    if (newPassword.length < 8) return { label: 'متوسطة', color: '#F59E0B', width: '60%' };
    const hasUpper = /[A-Z]/.test(newPassword);
    const hasNum = /[0-9]/.test(newPassword);
    const hasSpecial = /[^A-Za-z0-9]/.test(newPassword);
    if (hasUpper && hasNum && hasSpecial) return { label: 'قوية جداً', color: '#22C55E', width: '100%' };
    if (hasNum || hasSpecial) return { label: 'قوية', color: '#10B981', width: '80%' };
    return { label: 'متوسطة', color: '#F59E0B', width: '60%' };
  }, [newPassword]);

  const stepTitles: Record<Step, string> = {
    request: 'تغيير كلمة المرور',
    verify: 'التحقق من البريد',
    newPassword: 'كلمة المرور الجديدة',
    success: 'تم بنجاح',
  };

  return (
    <SafeAreaView edges={['top']} style={s.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {/* Header */}
        <View style={s.header}>
          <Pressable onPress={() => router.back()} style={s.backBtn}>
            <MaterialIcons name="arrow-forward" size={22} color={theme.textPrimary} />
          </Pressable>
          <Text style={s.headerTitle}>{stepTitles[step]}</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Step Indicator */}
        {step !== 'success' ? (
          <View style={s.stepIndicator}>
            {(['request', 'verify', 'newPassword'] as Step[]).map((s2, i) => {
              const stepIndex = ['request', 'verify', 'newPassword'].indexOf(step);
              const isDone = i < stepIndex;
              const isActive = s2 === step;
              return (
                <React.Fragment key={s2}>
                  <View style={[
                    s.stepDot,
                    isActive && { backgroundColor: theme.primary, width: 28 },
                    isDone && { backgroundColor: '#22C55E' },
                    !isActive && !isDone && { backgroundColor: theme.border },
                  ]}>
                    {isDone ? (
                      <MaterialIcons name="check" size={12} color="#FFF" />
                    ) : (
                      <Text style={s.stepDotText}>{i + 1}</Text>
                    )}
                  </View>
                  {i < 2 && (
                    <View style={[s.stepLine, isDone && { backgroundColor: '#22C55E' }]} />
                  )}
                </React.Fragment>
              );
            })}
          </View>
        ) : null}

        <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 24 }}>

          {/* ── STEP 1: Request OTP ── */}
          {step === 'request' && (
            <View style={s.card}>
              <View style={s.iconCircle}>
                <MaterialIcons name="lock-reset" size={32} color={theme.primary} />
              </View>
              <Text style={s.cardTitle}>إعادة تعيين كلمة المرور</Text>
              <Text style={s.cardDesc}>
                سنرسل رمز تحقق مؤلف من 4 أرقام إلى بريدك الإلكتروني
              </Text>

              <View style={s.emailBox}>
                <MaterialIcons name="email" size={18} color={theme.primary} />
                <Text style={s.emailText}>{email}</Text>
              </View>

              <View style={s.infoCard}>
                <MaterialIcons name="info-outline" size={14} color={theme.primary} />
                <Text style={s.infoText}>تأكد من وصولك إلى صندوق البريد الإلكتروني قبل المتابعة</Text>
              </View>
            </View>
          )}

          {/* ── STEP 2: Verify OTP ── */}
          {step === 'verify' && (
            <View style={s.card}>
              <View style={s.iconCircle}>
                <MaterialIcons name="mark-email-read" size={32} color={theme.primary} />
              </View>
              <Text style={s.cardTitle}>أدخل رمز التحقق</Text>
              <Text style={s.cardDesc}>
                أُرسل رمز مؤلف من 4 أرقام إلى{'\n'}
                <Text style={{ color: theme.primary, fontFamily: 'Cairo_600SemiBold' }}>{email}</Text>
              </Text>

              {/* OTP Boxes */}
              <View style={s.otpRow}>
                {[0, 1, 2, 3].map(i => (
                  <TextInput
                    key={i}
                    ref={ref => { otpRefs.current[i] = ref; }}
                    style={[
                      s.otpBox,
                      { borderColor: otp[i] ? theme.primary : theme.border, color: theme.textPrimary },
                      otp[i] && { backgroundColor: theme.primary + '10' },
                    ]}
                    value={otp[i] || ''}
                    onChangeText={text => handleOtpChange(text, i)}
                    onKeyPress={({ nativeEvent }) => handleOtpKeyPress(nativeEvent.key, i)}
                    keyboardType="number-pad"
                    maxLength={1}
                    textAlign="center"
                    selectTextOnFocus
                  />
                ))}
              </View>

              <Pressable onPress={() => { setOtp(''); setStep('request'); }} style={s.resendBtn}>
                <MaterialIcons name="refresh" size={14} color={theme.primary} />
                <Text style={s.resendText}>إرسال رمز جديد</Text>
              </Pressable>
            </View>
          )}

          {/* ── STEP 3: New Password ── */}
          {step === 'newPassword' && (
            <View style={s.card}>
              <View style={s.iconCircle}>
                <MaterialIcons name="lock-outline" size={32} color={theme.primary} />
              </View>
              <Text style={s.cardTitle}>أنشئ كلمة مرور جديدة</Text>
              <Text style={s.cardDesc}>يجب أن تكون 6 أحرف على الأقل</Text>

              {/* New Password */}
              <View style={s.field}>
                <Text style={s.label}>كلمة المرور الجديدة</Text>
                <View style={[s.inputRow, newPassword.length > 0 && { borderColor: theme.primary }]}>
                  <MaterialIcons name="lock" size={18} color={newPassword.length > 0 ? theme.primary : theme.textMuted} />
                  <TextInput
                    style={s.input}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry={!showNew}
                    placeholder="أدخل كلمة المرور الجديدة"
                    placeholderTextColor={theme.textMuted}
                    textAlign="right"
                    autoCapitalize="none"
                  />
                  <Pressable onPress={() => setShowNew(!showNew)} hitSlop={8}>
                    <MaterialIcons name={showNew ? 'visibility-off' : 'visibility'} size={18} color={theme.textMuted} />
                  </Pressable>
                </View>
                {/* Strength */}
                {passwordStrength ? (
                  <View style={s.strengthRow}>
                    <View style={s.strengthBarBg}>
                      <View style={[s.strengthBarFill, { width: passwordStrength.width as any, backgroundColor: passwordStrength.color }]} />
                    </View>
                    <Text style={[s.strengthLabel, { color: passwordStrength.color }]}>{passwordStrength.label}</Text>
                  </View>
                ) : null}
              </View>

              {/* Confirm Password */}
              <View style={s.field}>
                <Text style={s.label}>تأكيد كلمة المرور</Text>
                <View style={[
                  s.inputRow,
                  confirmPassword.length > 0 && {
                    borderColor: confirmPassword === newPassword ? '#22C55E' : '#EF4444'
                  }
                ]}>
                  <MaterialIcons
                    name="lock-outline"
                    size={18}
                    color={
                      confirmPassword.length > 0
                        ? confirmPassword === newPassword ? '#22C55E' : '#EF4444'
                        : theme.textMuted
                    }
                  />
                  <TextInput
                    style={s.input}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showConfirm}
                    placeholder="أعد إدخال كلمة المرور"
                    placeholderTextColor={theme.textMuted}
                    textAlign="right"
                    autoCapitalize="none"
                  />
                  <Pressable onPress={() => setShowConfirm(!showConfirm)} hitSlop={8}>
                    <MaterialIcons name={showConfirm ? 'visibility-off' : 'visibility'} size={18} color={theme.textMuted} />
                  </Pressable>
                </View>
                {confirmPassword.length > 0 && (
                  <View style={s.matchRow}>
                    <MaterialIcons
                      name={confirmPassword === newPassword ? 'check-circle' : 'cancel'}
                      size={14}
                      color={confirmPassword === newPassword ? '#22C55E' : '#EF4444'}
                    />
                    <Text style={[s.matchText, { color: confirmPassword === newPassword ? '#22C55E' : '#EF4444' }]}>
                      {confirmPassword === newPassword ? 'كلمتا المرور متطابقتان' : 'كلمتا المرور غير متطابقتين'}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* ── STEP 4: Success ── */}
          {step === 'success' && (
            <Animated.View style={[s.successCard, { opacity: successOpacity, transform: [{ scale: successScale }] }]}>
              <LinearGradient
                colors={['#22C55E20', '#10B98110']}
                style={s.successGrad}
              >
                <View style={s.successIcon}>
                  <MaterialIcons name="check-circle" size={64} color="#22C55E" />
                </View>
                <Text style={s.successTitle}>تم تغيير كلمة المرور</Text>
                <Text style={s.successDesc}>
                  تم تحديث كلمة مرورك بنجاح.{'\n'}يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.
                </Text>
              </LinearGradient>
            </Animated.View>
          )}
        </View>

        {/* Footer Action */}
        <View style={[s.footer, { paddingBottom: insets.bottom + 16 }]}>
          {step === 'request' && (
            <Pressable onPress={handleSendOTP} disabled={loading} style={{ borderRadius: 14, overflow: 'hidden' }}>
              <LinearGradient colors={[theme.primary, theme.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={[s.actionBtn, loading && { opacity: 0.7 }]}>
                {loading ? <ActivityIndicator color="#FFF" size="small" /> : (
                  <>
                    <MaterialIcons name="send" size={20} color="#FFF" />
                    <Text style={s.actionBtnText}>إرسال رمز التحقق</Text>
                  </>
                )}
              </LinearGradient>
            </Pressable>
          )}

          {step === 'verify' && (
            <Pressable onPress={handleVerifyOTP} disabled={loading || otp.length < 4} style={{ borderRadius: 14, overflow: 'hidden', opacity: otp.length < 4 ? 0.5 : 1 }}>
              <LinearGradient colors={[theme.primary, theme.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={[s.actionBtn, loading && { opacity: 0.7 }]}>
                {loading ? <ActivityIndicator color="#FFF" size="small" /> : (
                  <>
                    <MaterialIcons name="verified" size={20} color="#FFF" />
                    <Text style={s.actionBtnText}>تحقق من الرمز</Text>
                  </>
                )}
              </LinearGradient>
            </Pressable>
          )}

          {step === 'newPassword' && (
            <Pressable
              onPress={handleUpdatePassword}
              disabled={loading || newPassword.length < 6 || newPassword !== confirmPassword}
              style={{ borderRadius: 14, overflow: 'hidden', opacity: (newPassword.length < 6 || newPassword !== confirmPassword) ? 0.5 : 1 }}
            >
              <LinearGradient colors={['#22C55E', '#16A34A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={[s.actionBtn, loading && { opacity: 0.7 }]}>
                {loading ? <ActivityIndicator color="#FFF" size="small" /> : (
                  <>
                    <MaterialIcons name="lock-reset" size={20} color="#FFF" />
                    <Text style={s.actionBtnText}>تحديث كلمة المرور</Text>
                  </>
                )}
              </LinearGradient>
            </Pressable>
          )}

          {step === 'success' && (
            <Pressable onPress={() => router.back()} style={{ borderRadius: 14, overflow: 'hidden' }}>
              <LinearGradient colors={['#22C55E', '#16A34A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.actionBtn}>
                <MaterialIcons name="check" size={20} color="#FFF" />
                <Text style={s.actionBtnText}>العودة إلى الملف الشخصي</Text>
              </LinearGradient>
            </Pressable>
          )}
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

  // Step indicator
  stepIndicator: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 16, paddingVertical: 16, gap: 0,
  },
  stepDot: {
    width: 24, height: 24, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  stepDotText: { fontSize: 11, fontFamily: 'Cairo_700Bold', color: '#FFF' },
  stepLine: {
    flex: 1, height: 2, backgroundColor: theme.border, maxWidth: 60, marginHorizontal: 4,
  },

  // Card
  card: {
    backgroundColor: theme.surface, borderRadius: 20, padding: 24,
    borderWidth: 1, borderColor: theme.border, alignItems: 'center',
  },
  iconCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: theme.primary + '15',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  cardTitle: {
    fontSize: 20, fontFamily: 'Cairo_700Bold', color: theme.textPrimary,
    marginBottom: 8, textAlign: 'center',
  },
  cardDesc: {
    fontSize: 14, fontFamily: 'Cairo_400Regular', color: theme.textSecondary,
    textAlign: 'center', lineHeight: 22, marginBottom: 20,
  },

  // Email display
  emailBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: theme.primary + '12', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    borderWidth: 1, borderColor: theme.primary + '25',
    width: '100%', marginBottom: 14,
  },
  emailText: {
    flex: 1, fontSize: 14, fontFamily: 'Cairo_600SemiBold',
    color: theme.textPrimary, textAlign: 'right',
  },

  // Info
  infoCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: theme.background, borderRadius: 10,
    padding: 10, borderWidth: 1, borderColor: theme.border, width: '100%',
  },
  infoText: {
    flex: 1, fontSize: 12, fontFamily: 'Cairo_500Medium',
    color: theme.textSecondary, textAlign: 'right',
  },

  // OTP
  otpRow: { flexDirection: 'row', gap: 12, marginBottom: 20, justifyContent: 'center' },
  otpBox: {
    width: 58, height: 68, borderRadius: 14, borderWidth: 2,
    fontSize: 28, fontFamily: 'Cairo_700Bold',
    backgroundColor: theme.backgroundSecondary,
    textAlign: 'center',
  },
  resendBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 9999, borderWidth: 1, borderColor: theme.primary + '40',
    backgroundColor: theme.primary + '10',
  },
  resendText: { fontSize: 13, fontFamily: 'Cairo_600SemiBold', color: theme.primary },

  // Password fields
  field: { marginBottom: 16, width: '100%' },
  label: { fontSize: 12, fontFamily: 'Cairo_600SemiBold', color: theme.textSecondary, marginBottom: 6, textAlign: 'right' },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: theme.backgroundSecondary, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 12,
    borderWidth: 1.5, borderColor: theme.border,
  },
  input: {
    flex: 1, fontSize: 15, fontFamily: 'Cairo_400Regular',
    color: theme.textPrimary, writingDirection: 'rtl',
  },

  // Strength
  strengthRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  strengthBarBg: { flex: 1, height: 4, borderRadius: 2, backgroundColor: theme.border, overflow: 'hidden' },
  strengthBarFill: { height: '100%', borderRadius: 2 },
  strengthLabel: { fontSize: 11, fontFamily: 'Cairo_600SemiBold', minWidth: 55, textAlign: 'left' },

  // Match
  matchRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  matchText: { fontSize: 12, fontFamily: 'Cairo_500Medium' },

  // Success
  successCard: {
    borderRadius: 24, overflow: 'hidden',
    borderWidth: 1, borderColor: '#22C55E40',
  },
  successGrad: { padding: 32, alignItems: 'center', gap: 12 },
  successIcon: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: '#22C55E20',
    alignItems: 'center', justifyContent: 'center',
  },
  successTitle: { fontSize: 24, fontFamily: 'Cairo_700Bold', color: theme.textPrimary, textAlign: 'center' },
  successDesc: {
    fontSize: 14, fontFamily: 'Cairo_400Regular', color: theme.textSecondary,
    textAlign: 'center', lineHeight: 22,
  },

  // Footer
  footer: {
    paddingHorizontal: 16, paddingTop: 12,
    backgroundColor: theme.background, borderTopWidth: 1, borderTopColor: theme.border,
  },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 16, borderRadius: 14,
  },
  actionBtnText: { fontSize: 17, fontWeight: '700', fontFamily: 'Cairo_700Bold', color: '#FFF' },
});

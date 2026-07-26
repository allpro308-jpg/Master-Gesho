/**
 * about.tsx — Professional About Page
 * Includes: app info, legal, developer bio, user experience actions, changelog, FAQ
 */

import React, { useMemo, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, Linking, Share,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeIn, ZoomIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useTheme } from '../contexts/ThemeContext';

// ─── App meta ─────────────────────────────────────────────────────────────────
const APP_META = {
  name: 'مستر جيشو',
  version: '1.0.0',
  buildNumber: '100',
  releaseDate: '2026-06-09',
  environment: __DEV__ ? 'تطوير' : 'إنتاج',
};

// ─── Changelog ────────────────────────────────────────────────────────────────
const CHANGELOG = [
  {
    version: '1.0.0',
    date: '2026-06-09',
    changes: [
      'إطلاق التطبيق الرسمي بميزات الاكتشاف الذكي',
      'نظام إنجازات متكامل مع 20+ شارة',
      'بطاقة بصمة المستخدم القابلة للمشاركة',
      'إشعارات محلية ذكية لمتابعة التقدم',
      'صفحة المطور مع سيرة مستر جيشو',
    ],
  },
];

// ─── FAQ ─────────────────────────────────────────────────────────────────────
const FAQ_ITEMS = [
  {
    q: 'كيف أضيف أداة ذكاء اصطناعي؟',
    a: 'من صفحة حسابي → "إضافة أداة"، أدخل تفاصيل الأداة وانتظر مراجعة الفريق.',
  },
  {
    q: 'كيف تعمل الإنجازات؟',
    a: 'تُفتح الإنجازات تلقائياً عند تحقيق شروط معينة مثل حفظ أدوات أو التصويت أو بناء سلسلة نشاط يومية.',
  },
  {
    q: 'هل بيانات التطبيق محفوظة بشكل آمن؟',
    a: 'نعم، نستخدم خوادم مشفرة وبروتوكول HTTPS لضمان أمان بياناتك الكاملة.',
  },
  {
    q: 'كيف أشارك بصمتي مع الآخرين؟',
    a: 'من صفحة حسابي → تبويب "بصمتي" → زر "مشاركة بصمتي" لتوليد ملخص نصي أو بطاقة مرئية.',
  },
  {
    q: 'كيف أتواصل مع الدعم الفني؟',
    a: 'يمكنك مراسلتنا عبر البريد الإلكتروني أو الضغط على "إرسال بلاغ" في هذه الصفحة.',
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────
function InfoRow({
  icon, label, value, color,
}: {
  icon: string; label: string; value: string; color?: string;
}) {
  const { theme } = useTheme();
  return (
    <View style={ir.row}>
      <View style={[ir.iconBg, { backgroundColor: (color || theme.primary) + '18' }]}>
        <MaterialIcons name={icon as any} size={16} color={color || theme.primary} />
      </View>
      <Text style={[ir.label, { color: theme.textMuted }]}>{label}</Text>
      <Text style={[ir.value, { color: theme.textPrimary }]}>{value}</Text>
    </View>
  );
}

const ir = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  iconBg: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  label: { flex: 1, fontSize: 14, fontFamily: 'Cairo_500Medium' },
  value: { fontSize: 14, fontFamily: 'Cairo_600SemiBold' },
});

function ActionRow({
  icon, label, desc, color, onPress, chevron = true,
}: {
  icon: string; label: string; desc?: string; color?: string; onPress: () => void; chevron?: boolean;
}) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={() => { Haptics.selectionAsync(); onPress(); }}
      style={({ pressed }) => [ar.row, pressed && { opacity: 0.7 }]}
    >
      <View style={[ar.iconBg, { backgroundColor: (color || theme.primary) + '18' }]}>
        <MaterialIcons name={icon as any} size={18} color={color || theme.primary} />
      </View>
      <View style={ar.info}>
        <Text style={[ar.label, { color: theme.textPrimary }]}>{label}</Text>
        {desc ? <Text style={[ar.desc, { color: theme.textMuted }]}>{desc}</Text> : null}
      </View>
      {chevron && <MaterialIcons name="chevron-left" size={20} color={theme.textMuted} />}
    </Pressable>
  );
}

const ar = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
  iconBg: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1 },
  label: { fontSize: 15, fontFamily: 'Cairo_600SemiBold' },
  desc: { fontSize: 11, fontFamily: 'Cairo_400Regular', marginTop: 1 },
});

function Card({ children, style }: { children: React.ReactNode; style?: any }) {
  const { theme } = useTheme();
  return (
    <View style={[{ backgroundColor: theme.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: theme.border, marginBottom: 16 }, style]}>
      {children}
    </View>
  );
}

function CardHeader({ icon, title, color }: { icon: string; title: string; color?: string }) {
  const { theme } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: (color || theme.primary) + '18', alignItems: 'center', justifyContent: 'center' }}>
        <MaterialIcons name={icon as any} size={18} color={color || theme.primary} />
      </View>
      <Text style={{ fontSize: 16, fontFamily: 'Cairo_700Bold', color: theme.textPrimary }}>{title}</Text>
    </View>
  );
}

function Divider() {
  const { theme } = useTheme();
  return <View style={{ height: 1, backgroundColor: theme.border, marginVertical: 2 }} />;
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function AboutScreen() {
  const { theme, isDark } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const s = useMemo(() => createStyles(theme), [theme]);

  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [showChangelog, setShowChangelog] = useState(false);

  const handleShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await Share.share({
      title: 'مستر جيشو – أفضل أدوات الذكاء الاصطناعي',
      message:
        '🤖 اكتشف أفضل أدوات الذكاء الاصطناعي مع تطبيق مستر جيشو!\n' +
        'أكثر من 100 أداة ذكية في مكان واحد، مع نظام إنجازات وبصمة شخصية.\n' +
        'صُنع باحتراف من مستر جيشو 🇪🇬',
    });
  };

  const handleEmail = () => {
    Haptics.selectionAsync();
    Linking.openURL('mailto:support@mistergisho.app?subject=مراسلة من تطبيق مستر جيشو');
  };

  return (
    <SafeAreaView edges={['top']} style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <MaterialIcons name="arrow-forward" size={22} color={theme.textPrimary} />
        </Pressable>
        <Text style={s.headerTitle}>عن التطبيق</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 40 }}
      >
        {/* ── Hero ── */}
        <Animated.View entering={FadeInDown.duration(400)} style={{ marginBottom: 24, marginTop: 8 }}>
          <LinearGradient
            colors={isDark ? ['#1E3A5F', '#1E1B4B'] : ['#EFF6FF', '#F0FDF4']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.hero}
          >
            <Animated.View entering={ZoomIn.springify().damping(14).stiffness(160).delay(100)}>
              <LinearGradient
                colors={['#3B82F6', '#8B5CF6']}
                style={s.heroIcon}
              >
                <MaterialIcons name="auto-awesome" size={32} color="#FFF" />
              </LinearGradient>
            </Animated.View>
            <Text style={s.heroName}>{APP_META.name}</Text>
            <Text style={s.heroTagline}>منصة أدوات الذكاء الاصطناعي العربية</Text>
            <View style={s.versionRow}>
              <View style={s.versionChip}>
                <MaterialIcons name="verified" size={12} color="#22C55E" />
                <Text style={s.versionChipText}>v{APP_META.version}</Text>
              </View>
              <View style={[s.versionChip, { backgroundColor: (isDark ? '#F59E0B' : '#FEF3C7') + '80' }]}>
                <MaterialIcons name="build" size={12} color="#F59E0B" />
                <Text style={[s.versionChipText, { color: '#F59E0B' }]}>Build {APP_META.buildNumber}</Text>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* ── App Info ── */}
        <Animated.View entering={FadeInDown.duration(350).delay(80)}>
          <Card>
            <CardHeader icon="info" title="معلومات التطبيق" />
            <InfoRow icon="apps" label="اسم التطبيق" value={APP_META.name} />
            <Divider />
            <InfoRow icon="tag" label="الإصدار" value={APP_META.version} />
            <Divider />
            <InfoRow icon="build" label="رقم البناء" value={APP_META.buildNumber} />
            <Divider />
            <InfoRow icon="computer" label="بيئة التشغيل" value={APP_META.environment} color="#8B5CF6" />
            <Divider />
            <InfoRow icon="update" label="آخر تحديث" value={APP_META.releaseDate} color="#10B981" />
            <Divider />
            <InfoRow icon="phone-iphone" label="المنصة" value={Platform.OS === 'ios' ? 'iOS' : Platform.OS === 'android' ? 'Android' : 'Web'} color="#3B82F6" />
          </Card>
        </Animated.View>

        {/* ── User Experience ── */}
        <Animated.View entering={FadeInDown.duration(350).delay(120)}>
          <Card>
            <CardHeader icon="star" title="تجربتك مهمة لنا" color="#F59E0B" />
            <ActionRow
              icon="star-rate"
              label="قيّم التطبيق"
              desc="ساعدنا بتقييمك في المتجر"
              color="#F59E0B"
              onPress={() => {
                if (Platform.OS === 'ios') {
                  Linking.openURL('https://apps.apple.com/');
                } else {
                  Linking.openURL('market://details?id=com.mistergisho.app');
                }
              }}
            />
            <Divider />
            <ActionRow
              icon="share"
              label="شارك التطبيق"
              desc="أخبر أصدقاءك عن مستر جيشو"
              color="#3B82F6"
              onPress={handleShare}
            />
            <Divider />
            <ActionRow
              icon="bug-report"
              label="الإبلاغ عن مشكلة"
              desc="أخبرنا إذا واجهت خللاً تقنياً"
              color="#EF4444"
              onPress={handleEmail}
            />
            <Divider />
            <ActionRow
              icon="lightbulb"
              label="اقتراح ميزة جديدة"
              desc="فكرتك قد تكون التطبيق القادم"
              color="#10B981"
              onPress={handleEmail}
            />
            <Divider />
            <ActionRow
              icon="history"
              label="سجل التحديثات"
              desc="ما الجديد في كل إصدار"
              color="#8B5CF6"
              onPress={() => setShowChangelog(v => !v)}
            />
            {showChangelog && CHANGELOG.map((entry, i) => (
              <Animated.View key={i} entering={FadeIn.duration(250)} style={s.changelogEntry}>
                <View style={s.changelogHeader}>
                  <View style={s.changelogBadge}>
                    <Text style={s.changelogVersion}>v{entry.version}</Text>
                  </View>
                  <Text style={[s.changelogDate, { color: theme.textMuted }]}>{entry.date}</Text>
                </View>
                {entry.changes.map((c, ci) => (
                  <View key={ci} style={s.changelogItem}>
                    <View style={[s.changelogDot, { backgroundColor: theme.primary }]} />
                    <Text style={[s.changelogText, { color: theme.textSecondary }]}>{c}</Text>
                  </View>
                ))}
              </Animated.View>
            ))}
          </Card>
        </Animated.View>

        {/* ── FAQ ── */}
        <Animated.View entering={FadeInDown.duration(350).delay(160)}>
          <Card>
            <CardHeader icon="help" title="الأسئلة الشائعة" color="#06B6D4" />
            {FAQ_ITEMS.map((item, i) => (
              <View key={i}>
                {i > 0 && <Divider />}
                <Pressable
                  style={s.faqItem}
                  onPress={() => { Haptics.selectionAsync(); setOpenFaq(openFaq === i ? null : i); }}
                >
                  <View style={s.faqQuestion}>
                    <Text style={[s.faqQ, { color: theme.textPrimary }]}>{item.q}</Text>
                    <MaterialIcons
                      name={openFaq === i ? 'expand-less' : 'expand-more'}
                      size={20}
                      color={theme.textMuted}
                    />
                  </View>
                  {openFaq === i && (
                    <Animated.Text
                      entering={FadeIn.duration(200)}
                      style={[s.faqA, { color: theme.textSecondary }]}
                    >
                      {item.a}
                    </Animated.Text>
                  )}
                </Pressable>
              </View>
            ))}
          </Card>
        </Animated.View>

        {/* ── Legal ── */}
        <Animated.View entering={FadeInDown.duration(350).delay(200)}>
          <Card>
            <CardHeader icon="gavel" title="قانوني وخصوصية" color="#94A3B8" />
            <ActionRow
              icon="privacy-tip"
              label="سياسة الخصوصية"
              desc="كيف نحمي بياناتك"
              color="#3B82F6"
              onPress={() => Linking.openURL('https://mistergisho.app/privacy')}
            />
            <Divider />
            <ActionRow
              icon="description"
              label="شروط الاستخدام"
              desc="اتفاقية المستخدم"
              color="#8B5CF6"
              onPress={() => Linking.openURL('https://mistergisho.app/terms')}
            />
            <Divider />
            <ActionRow
              icon="source"
              label="المكتبات مفتوحة المصدر"
              desc="التراخيص والاعتمادات"
              color="#10B981"
              onPress={() => Linking.openURL('https://mistergisho.app/licenses')}
            />
          </Card>
        </Animated.View>

        {/* ── Developer ── */}
        <Animated.View entering={FadeInDown.duration(350).delay(240)}>
          <LinearGradient
            colors={['#3B82F6', '#8B5CF6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.devCard}
          >
            <View style={s.devCardInner}>
              <LinearGradient
                colors={['rgba(255,255,255,0.3)', 'rgba(255,255,255,0.15)']}
                style={s.devAvatar}
              >
                <Text style={{ fontSize: 24, fontFamily: 'Cairo_700Bold', color: '#FFF' }}>مج</Text>
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={s.devName}>مستر جيشو</Text>
                <Text style={s.devBio}>مصمم ومبرمج · المنوفية · مصر · منذ 2006</Text>
              </View>
              <Pressable
                onPress={() => { Haptics.selectionAsync(); router.push('/developer-info' as any); }}
                style={s.devBtn}
              >
                <Text style={s.devBtnText}>عرض</Text>
                <MaterialIcons name="arrow-back" size={14} color="#FFF" />
              </Pressable>
            </View>

            <View style={s.devContacts}>
              {[
                { icon: 'email',    label: 'البريد',   url: 'mailto:contact@mistergisho.app' },
                { icon: 'web',      label: 'الموقع',   url: 'https://mistergisho.app' },
                { icon: 'telegram', label: 'تيليجرام', url: 'https://t.me/mistergisho' },
              ].map(item => (
                <Pressable
                  key={item.label}
                  onPress={() => { Haptics.selectionAsync(); Linking.openURL(item.url); }}
                  style={s.devContact}
                >
                  <MaterialIcons name={item.icon as any} size={14} color="rgba(255,255,255,0.85)" />
                  <Text style={s.devContactLabel}>{item.label}</Text>
                </Pressable>
              ))}
            </View>
          </LinearGradient>
        </Animated.View>

        {/* ── Copyright ── */}
        <View style={s.copyright}>
          <Text style={[s.copyrightText, { color: theme.textMuted }]}>
            {'© 2026 مستر جيشو · جميع الحقوق محفوظة'}
          </Text>
          <Text style={[s.copyrightSub, { color: theme.textMuted }]}>
            صُنع بإتقان في مصر 🇪🇬
          </Text>
        </View>
      </ScrollView>
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
    backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontFamily: 'Cairo_700Bold', color: theme.textPrimary },

  // Hero
  hero: {
    borderRadius: 20, padding: 24,
    alignItems: 'center', gap: 10,
    borderWidth: 1, borderColor: theme.border,
  },
  heroIcon: {
    width: 72, height: 72, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  heroName: { fontSize: 24, fontFamily: 'Cairo_700Bold', color: theme.textPrimary },
  heroTagline: { fontSize: 13, fontFamily: 'Cairo_400Regular', color: theme.textMuted },
  versionRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  versionChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 9999,
    backgroundColor: '#22C55E15', borderWidth: 1, borderColor: '#22C55E30',
  },
  versionChipText: { fontSize: 12, fontFamily: 'Cairo_600SemiBold', color: '#22C55E' },

  // Changelog
  changelogEntry: {
    marginTop: 12, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: theme.border,
  },
  changelogHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  changelogBadge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999,
    backgroundColor: theme.primary + '20',
  },
  changelogVersion: { fontSize: 12, fontFamily: 'Cairo_700Bold', color: theme.primary },
  changelogDate: { fontSize: 12, fontFamily: 'Cairo_400Regular' },
  changelogItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  changelogDot: { width: 6, height: 6, borderRadius: 3, marginTop: 7, flexShrink: 0 },
  changelogText: { fontSize: 13, fontFamily: 'Cairo_400Regular', lineHeight: 20, flex: 1 },

  // FAQ
  faqItem: { paddingVertical: 12 },
  faqQuestion: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  faqQ: { flex: 1, fontSize: 14, fontFamily: 'Cairo_600SemiBold', lineHeight: 22 },
  faqA: {
    fontSize: 13, fontFamily: 'Cairo_400Regular', lineHeight: 22,
    marginTop: 8, paddingRight: 4,
  },

  // Developer card
  devCard: { borderRadius: 18, padding: 18, marginBottom: 16 },
  devCardInner: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  devAvatar: {
    width: 52, height: 52, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  devName: { fontSize: 18, fontFamily: 'Cairo_700Bold', color: '#FFF', marginBottom: 2 },
  devBio: { fontSize: 12, fontFamily: 'Cairo_400Regular', color: 'rgba(255,255,255,0.8)' },
  devBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 9999,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  devBtnText: { fontSize: 13, fontFamily: 'Cairo_600SemiBold', color: '#FFF' },
  devContacts: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  devContact: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 9999,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  devContactLabel: { fontSize: 12, fontFamily: 'Cairo_600SemiBold', color: 'rgba(255,255,255,0.9)' },

  // Copyright
  copyright: { alignItems: 'center', paddingTop: 8, paddingBottom: 16, gap: 4 },
  copyrightText: { fontSize: 12, fontFamily: 'Cairo_500Medium' },
  copyrightSub: { fontSize: 11, fontFamily: 'Cairo_400Regular', opacity: 0.7 },
});

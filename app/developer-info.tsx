import React, { useMemo } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Linking } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeIn, ZoomIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useTheme } from '../contexts/ThemeContext';

const SKILLS = [
  { icon: 'code', label: 'تطوير تطبيقات', color: '#3B82F6' },
  { icon: 'web', label: 'تصميم مواقع', color: '#10B981' },
  { icon: 'palette', label: 'تصميم جرافيك', color: '#EC4899' },
  { icon: 'storage', label: 'استضافة وخوادم', color: '#F59E0B' },
  { icon: 'security', label: 'أمن المعلومات', color: '#8B5CF6' },
  { icon: 'business', label: 'حلول الشركات', color: '#06B6D4' },
];

const COMPANIES = [
  { name: 'موقع جيران', icon: 'home', color: '#3B82F6' },
  { name: 'قوووة', icon: 'bolt', color: '#F59E0B' },
  { name: 'المصرية لاستضافات', icon: 'dns', color: '#10B981' },
  { name: 'التقنية الحديثة بالعباسية', icon: 'computer', color: '#8B5CF6' },
  { name: 'ابقي لاستضافات', icon: 'cloud', color: '#06B6D4' },
  { name: 'وعديد من الشركات', icon: 'business-center', color: '#EC4899' },
];

const TIMELINE = [
  { year: '2006', event: 'بداية مسيرة التصميم والبرمجة', icon: 'star', color: '#F59E0B' },
  { year: '2010+', event: 'العمل مع شركات عربية كبرى', icon: 'work', color: '#3B82F6' },
  { year: '2015+', event: 'تطوير حلول الاستضافة والخوادم', icon: 'dns', color: '#10B981' },
  { year: '2020+', event: 'تطوير التطبيقات والمنصات', icon: 'phone-android', color: '#8B5CF6' },
  { year: '2026', event: 'مستر جيشو – صنع بإتقان واحتراف', icon: 'rocket-launch', color: '#EF4444' },
];

export default function DeveloperInfoScreen() {
  const { theme, isDark } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const s = useMemo(() => createStyles(theme), [theme]);

  return (
    <SafeAreaView edges={['top']} style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <MaterialIcons name="arrow-forward" size={22} color={theme.textPrimary} />
        </Pressable>
        <Text style={s.headerTitle}>المبرمج</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      >
        {/* Hero Section */}
        <Animated.View entering={FadeInDown.duration(400)}>
          <LinearGradient
            colors={isDark ? ['#1E1B4B', '#312E81', '#1E3A5F'] : ['#EFF6FF', '#F0FDF4', '#FDF4FF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.heroSection}
          >
            {/* Avatar */}
            <Animated.View entering={ZoomIn.springify().damping(14).stiffness(150).delay(100)}>
              <LinearGradient
                colors={['#3B82F6', '#8B5CF6', '#EC4899']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.avatarContainer}
              >
                <Text style={s.avatarText}>مج</Text>
              </LinearGradient>
            </Animated.View>

            <Animated.View entering={FadeInDown.duration(400).delay(150)} style={{ alignItems: 'center' }}>
              <Text style={s.devName}>مستر جيشو</Text>
              <Text style={s.devTitle}>مصمم ومبرمج محترف</Text>

              {/* Location badge */}
              <View style={s.locationBadge}>
                <MaterialIcons name="location-on" size={14} color={theme.primary} />
                <Text style={s.locationText}>المنوفية · الباجور · مصر</Text>
              </View>

              {/* Experience badge */}
              <View style={s.expBadge}>
                <MaterialIcons name="verified" size={14} color="#22C55E" />
                <Text style={s.expText}>خبرة منذ 2006 (+20 سنة)</Text>
              </View>
            </Animated.View>
          </LinearGradient>
        </Animated.View>

        {/* Bio Card */}
        <Animated.View entering={FadeInDown.duration(350).delay(100)} style={[s.card, { marginTop: 20 }]}>
          <View style={s.cardHeader}>
            <View style={[s.cardIconBg, { backgroundColor: theme.primary + '20' }]}>
              <MaterialIcons name="person" size={18} color={theme.primary} />
            </View>
            <Text style={s.cardTitle}>نبذة شخصية</Text>
          </View>
          <Text style={s.bioText}>
            من مواليد محافظة المنوفية، مركز ومدينة الباجور. مصمم ومبرمج محترف بدأ مسيرته منذ عام 2006، وخاض خلال مسيرته تجارب ثرية مع كبرى الشركات العربية في مجال التقنية والبرمجة والتصميم، وقدّم حلولاً تقنية متميزة لعملاء من مختلف أنحاء الوطن العربي.
          </Text>
        </Animated.View>

        {/* Skills Grid */}
        <Animated.View entering={FadeInDown.duration(350).delay(150)} style={s.card}>
          <View style={s.cardHeader}>
            <View style={[s.cardIconBg, { backgroundColor: '#8B5CF620' }]}>
              <MaterialIcons name="auto-awesome" size={18} color="#8B5CF6" />
            </View>
            <Text style={s.cardTitle}>مجالات الخبرة</Text>
          </View>
          <View style={s.skillsGrid}>
            {SKILLS.map((skill, i) => (
              <Animated.View
                key={skill.label}
                entering={FadeIn.duration(300).delay(200 + i * 50)}
                style={[s.skillCard, { borderColor: skill.color + '30' }]}
              >
                <View style={[s.skillIcon, { backgroundColor: skill.color + '20' }]}>
                  <MaterialIcons name={skill.icon as any} size={20} color={skill.color} />
                </View>
                <Text style={s.skillLabel}>{skill.label}</Text>
              </Animated.View>
            ))}
          </View>
        </Animated.View>

        {/* Companies */}
        <Animated.View entering={FadeInDown.duration(350).delay(200)} style={s.card}>
          <View style={s.cardHeader}>
            <View style={[s.cardIconBg, { backgroundColor: '#10B98120' }]}>
              <MaterialIcons name="business" size={18} color="#10B981" />
            </View>
            <Text style={s.cardTitle}>أعمال وشركات</Text>
          </View>
          <View style={s.companiesList}>
            {COMPANIES.map((comp, i) => (
              <Animated.View
                key={comp.name}
                entering={FadeInDown.duration(280).delay(220 + i * 40)}
                style={s.companyRow}
              >
                <View style={[s.companyIcon, { backgroundColor: comp.color + '18' }]}>
                  <MaterialIcons name={comp.icon as any} size={18} color={comp.color} />
                </View>
                <Text style={s.companyName}>{comp.name}</Text>
                <MaterialIcons name="check-circle" size={14} color={comp.color} />
              </Animated.View>
            ))}
          </View>
        </Animated.View>

        {/* Timeline */}
        <Animated.View entering={FadeInDown.duration(350).delay(250)} style={s.card}>
          <View style={s.cardHeader}>
            <View style={[s.cardIconBg, { backgroundColor: '#F59E0B20' }]}>
              <MaterialIcons name="timeline" size={18} color="#F59E0B" />
            </View>
            <Text style={s.cardTitle}>المسيرة المهنية</Text>
          </View>
          <View style={s.timeline}>
            {TIMELINE.map((item, i) => (
              <Animated.View
                key={item.year}
                entering={FadeInDown.duration(280).delay(270 + i * 50)}
                style={s.timelineItem}
              >
                {/* Line */}
                {i < TIMELINE.length - 1 && (
                  <View style={[s.timelineLine, { backgroundColor: item.color + '40' }]} />
                )}
                <View style={[s.timelineDot, { backgroundColor: item.color }]}>
                  <MaterialIcons name={item.icon as any} size={12} color="#FFF" />
                </View>
                <View style={s.timelineContent}>
                  <Text style={[s.timelineYear, { color: item.color }]}>{item.year}</Text>
                  <Text style={s.timelineEvent}>{item.event}</Text>
                </View>
              </Animated.View>
            ))}
          </View>
        </Animated.View>

        {/* App credit */}
        <Animated.View entering={FadeInDown.duration(350).delay(300)}>
          <LinearGradient
            colors={['#3B82F6', '#8B5CF6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.creditCard}
          >
            <MaterialIcons name="apps" size={28} color="#FFF" />
            <View style={{ flex: 1 }}>
              <Text style={s.creditTitle}>مستر جيشو</Text>
              <Text style={s.creditSub}>تطبيق صُنع بإتقان واحتراف</Text>
            </View>
            <View style={s.creditBadge}>
              <Text style={s.creditBadgeText}>v1.0</Text>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Copyright */}
        <View style={s.copyright}>
          <Text style={s.copyrightText}>{'© 2026 مستر جيشو · جميع الحقوق محفوظة'}</Text>
          <Text style={s.copyrightSub}>تصميم وبرمجة مستر جيشو · المنوفية · مصر</Text>
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
  heroSection: {
    alignItems: 'center', paddingVertical: 36, paddingHorizontal: 20, gap: 16,
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
  },
  avatarContainer: {
    width: 100, height: 100, borderRadius: 50,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 12,
    elevation: 10,
  },
  avatarText: { fontSize: 36, fontFamily: 'Cairo_700Bold', color: '#FFF' },
  devName: { fontSize: 28, fontFamily: 'Cairo_700Bold', color: theme.textPrimary, textAlign: 'center' },
  devTitle: { fontSize: 15, fontFamily: 'Cairo_500Medium', color: theme.textSecondary, marginTop: 4 },
  locationBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 9999,
    backgroundColor: theme.primary + '15', borderWidth: 1, borderColor: theme.primary + '30',
    marginTop: 8,
  },
  locationText: { fontSize: 13, fontFamily: 'Cairo_500Medium', color: theme.primary },
  expBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 9999,
    backgroundColor: '#22C55E15', borderWidth: 1, borderColor: '#22C55E30',
    marginTop: 6,
  },
  expText: { fontSize: 13, fontFamily: 'Cairo_600SemiBold', color: '#22C55E' },

  // Cards
  card: {
    marginHorizontal: 16, marginBottom: 16,
    backgroundColor: theme.surface, borderRadius: 18,
    padding: 18, borderWidth: 1, borderColor: theme.border,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  cardIconBg: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 17, fontFamily: 'Cairo_700Bold', color: theme.textPrimary },

  // Bio
  bioText: {
    fontSize: 15, fontFamily: 'Cairo_400Regular', color: theme.textSecondary,
    lineHeight: 26, textAlign: 'right',
  },

  // Skills
  skillsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  skillCard: {
    width: '47%', flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: theme.backgroundSecondary, borderRadius: 12, padding: 12, borderWidth: 1,
  },
  skillIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  skillLabel: { fontSize: 13, fontFamily: 'Cairo_600SemiBold', color: theme.textPrimary, flex: 1 },

  // Companies
  companiesList: { gap: 0 },
  companyRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  companyIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  companyName: { flex: 1, fontSize: 14, fontFamily: 'Cairo_600SemiBold', color: theme.textPrimary },

  // Timeline
  timeline: { gap: 0 },
  timelineItem: { flexDirection: 'row', gap: 14, paddingBottom: 20, position: 'relative' },
  timelineLine: {
    position: 'absolute', right: 19, top: 28, width: 2, height: '100%',
  },
  timelineDot: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', marginTop: 2, flexShrink: 0,
  },
  timelineContent: { flex: 1, paddingTop: 2 },
  timelineYear: { fontSize: 13, fontFamily: 'Cairo_700Bold', marginBottom: 2 },
  timelineEvent: { fontSize: 14, fontFamily: 'Cairo_400Regular', color: theme.textSecondary },

  // Credit card
  creditCard: {
    marginHorizontal: 16, marginBottom: 16,
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 20, borderRadius: 18,
  },
  creditTitle: { fontSize: 18, fontFamily: 'Cairo_700Bold', color: '#FFF' },
  creditSub: { fontSize: 12, fontFamily: 'Cairo_400Regular', color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  creditBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999,
  },
  creditBadgeText: { fontSize: 12, fontFamily: 'Cairo_700Bold', color: '#FFF' },

  // Copyright
  copyright: { alignItems: 'center', paddingTop: 8, paddingBottom: 16, gap: 4 },
  copyrightText: { fontSize: 12, fontFamily: 'Cairo_500Medium', color: theme.textMuted },
  copyrightSub: { fontSize: 11, fontFamily: 'Cairo_400Regular', color: theme.textMuted, opacity: 0.7 },
});

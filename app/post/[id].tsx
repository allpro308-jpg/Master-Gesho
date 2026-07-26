/**
 * app/post/[id].tsx — مستر جيشو
 * Professional article view: title → cover image → content → reactions
 */

import React, { useMemo, useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, Share,
  Dimensions, Animated as RNAnimated,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import AnimatedRN, { FadeInDown, FadeIn, ZoomIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import { getPostById, formatPostDate, POST_CATEGORIES, PostSection } from '../../services/postsService';

const { width: W } = Dimensions.get('window');
const TJ  = 'Tajawal_400Regular';
const TJM = 'Tajawal_500Medium';
const TJB = 'Tajawal_700Bold';
const TJEB = 'Tajawal_800ExtraBold';

// ─── Reading Progress Bar ──────────────────────────────────────────────────────
function ProgressBar({ progress, color }: { progress: number; color: string }) {
  return (
    <View style={pb.track}>
      <View style={[pb.fill, { width: `${Math.min(100, Math.max(0, progress * 100))}%` as any, backgroundColor: color }]} />
    </View>
  );
}
const pb = StyleSheet.create({
  track: { height: 3, backgroundColor: 'rgba(0,0,0,0.08)', position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100 },
  fill: { height: '100%' },
});

// ─── Section Renderer ──────────────────────────────────────────────────────────
function RenderSection({ section, index, theme, catColor }: {
  section: PostSection; index: number; theme: any; catColor: string;
}) {
  const delay = Math.min(index * 45, 500);
  switch (section.type) {
    case 'heading':
      return (
        <AnimatedRN.View entering={FadeInDown.duration(280).delay(delay)}>
          <View style={[rs.headingRow, { borderRightColor: catColor }]}>
            <Text style={[rs.headingText, { color: theme.textPrimary }]}>{section.text}</Text>
          </View>
        </AnimatedRN.View>
      );
    case 'paragraph':
      return (
        <AnimatedRN.View entering={FadeInDown.duration(280).delay(delay)}>
          <Text style={[rs.paraText, { color: theme.textSecondary }]}>{section.text}</Text>
        </AnimatedRN.View>
      );
    case 'bullet':
      return (
        <AnimatedRN.View entering={FadeInDown.duration(280).delay(delay)} style={rs.bulletList}>
          {section.items?.map((item, i) => (
            <View key={i} style={rs.bulletItem}>
              <View style={[rs.bulletDot, { backgroundColor: catColor }]} />
              <Text style={[rs.bulletText, { color: theme.textSecondary }]}>{item}</Text>
            </View>
          ))}
        </AnimatedRN.View>
      );
    case 'highlight':
      return (
        <AnimatedRN.View entering={FadeInDown.duration(280).delay(delay)}>
          <LinearGradient
            colors={[(section.color || catColor) + '20', (section.color || catColor) + '08']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={[rs.highlight, { borderRightColor: section.color || catColor }]}
          >
            <MaterialIcons name="auto-awesome" size={15} color={section.color || catColor} style={{ marginBottom: 6 }} />
            <Text style={[rs.highlightText, { color: theme.textPrimary }]}>{section.text}</Text>
          </LinearGradient>
        </AnimatedRN.View>
      );
    case 'quote':
      return (
        <AnimatedRN.View entering={FadeInDown.duration(280).delay(delay)}>
          <View style={[rs.quote, { borderRightColor: catColor + '80', backgroundColor: theme.surface }]}>
            <Text style={[rs.quoteIcon, { color: catColor }]}>"</Text>
            <Text style={[rs.quoteText, { color: theme.textSecondary }]}>{section.text}</Text>
          </View>
        </AnimatedRN.View>
      );
    case 'divider':
      return <View style={[rs.divider, { backgroundColor: theme.border }]} />;
    default:
      return null;
  }
}

const rs = StyleSheet.create({
  headingRow: { borderRightWidth: 4, paddingRight: 12, paddingVertical: 4, marginVertical: 4 },
  headingText: { fontSize: 19, fontFamily: TJEB, lineHeight: 30, textAlign: 'right' },
  paraText: { fontSize: 15, fontFamily: TJ, lineHeight: 28, textAlign: 'right' },
  bulletList: { gap: 10 },
  bulletItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  bulletDot: { width: 8, height: 8, borderRadius: 4, marginTop: 10, flexShrink: 0 },
  bulletText: { flex: 1, fontSize: 15, fontFamily: TJ, lineHeight: 26, textAlign: 'right' },
  highlight: { borderRadius: 14, padding: 16, borderRightWidth: 4 },
  highlightText: { fontSize: 15, fontFamily: TJB, lineHeight: 26, textAlign: 'right' },
  quote: { borderRadius: 14, padding: 16, borderRightWidth: 3 },
  quoteIcon: { fontSize: 40, fontFamily: TJEB, lineHeight: 36, opacity: 0.6 },
  quoteText: { fontSize: 15, fontFamily: TJM, lineHeight: 26, textAlign: 'right', fontStyle: 'italic' },
  divider: { height: 1, marginVertical: 8 },
});

// ─── Reaction Button ───────────────────────────────────────────────────────────
const REACTIONS = [
  { emoji: '👍', label: 'مفيد', count: 0 },
  { emoji: '❤️', label: 'رائع', count: 0 },
  { emoji: '🔥', label: 'ممتاز', count: 0 },
  { emoji: '👏', label: 'إبداع', count: 0 },
  { emoji: '😍', label: 'أحبه', count: 0 },
];

function ReactionsBar({ catColor, theme }: { catColor: string; theme: any }) {
  const [reactions, setReactions] = useState(
    REACTIONS.map((r, i) => ({ ...r, count: Math.floor(Math.random() * 80) + 10, active: false }))
  );
  const toggle = (i: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setReactions(prev => prev.map((r, idx) =>
      idx === i ? { ...r, active: !r.active, count: r.active ? r.count - 1 : r.count + 1 } : r
    ));
  };
  return (
    <View style={rb.wrap}>
      <Text style={[rb.title, { color: theme.textPrimary }]}>تفاعل مع المنشور</Text>
      <View style={rb.row}>
        {reactions.map((r, i) => (
          <Pressable
            key={i}
            onPress={() => toggle(i)}
            style={[
              rb.btn,
              { backgroundColor: r.active ? catColor + '20' : theme.surface, borderColor: r.active ? catColor : theme.border },
            ]}
          >
            <Text style={rb.emoji}>{r.emoji}</Text>
            <Text style={[rb.count, { color: r.active ? catColor : theme.textMuted }]}>{r.count}</Text>
            <Text style={[rb.label, { color: r.active ? catColor : theme.textMuted }]}>{r.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
const rb = StyleSheet.create({
  wrap: { paddingHorizontal: 20, marginTop: 8, gap: 12 },
  title: { fontSize: 15, fontFamily: TJEB, textAlign: 'right' },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' },
  btn: {
    alignItems: 'center', gap: 3, paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 12, borderWidth: 1.5, minWidth: 58,
  },
  emoji: { fontSize: 22 },
  count: { fontSize: 13, fontFamily: TJB },
  label: { fontSize: 10, fontFamily: TJM },
});

// ─── Main Screen ───────────────────────────────────────────────────────────────
export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [liked, setLiked] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const post = useMemo(() => getPostById(id || ''), [id]);
  const category = useMemo(() => POST_CATEGORIES.find(c => c.id === post?.category), [post]);

  const handleScroll = useCallback((event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const max = contentSize.height - layoutMeasurement.height;
    if (max > 0) setScrollProgress(contentOffset.y / max);
  }, []);

  const handleShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!post) return;
    await Share.share({ title: post.title, message: `📖 ${post.title}\n\n${post.summary}\n\n🔗 مستر جيشو` });
  };

  if (!post) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center' }}>
        <MaterialIcons name="article" size={64} color={theme.textMuted} />
        <Text style={{ fontFamily: TJB, color: theme.textMuted, fontSize: 16, marginTop: 12 }}>المنشور غير موجود</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: theme.primary, borderRadius: 10 }}>
          <Text style={{ fontFamily: TJB, color: '#FFF', fontSize: 14 }}>العودة</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const catColor = post.categoryColor;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Reading progress */}
      <ProgressBar progress={scrollProgress} color={catColor} />

      {/* Header */}
      <View style={[ps.header, { borderBottomColor: theme.border }]}>
        <Pressable onPress={() => router.back()} style={[ps.iconBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <MaterialIcons name="arrow-forward" size={20} color={theme.textPrimary} />
        </Pressable>
        <View style={ps.headerActions}>
          <Pressable
            onPress={() => { Haptics.selectionAsync(); setLiked(v => !v); }}
            style={[ps.iconBtn, { backgroundColor: liked ? '#EF444420' : theme.surface, borderColor: liked ? '#EF444440' : theme.border }]}
          >
            <MaterialIcons name={liked ? 'favorite' : 'favorite-border'} size={18} color={liked ? '#EF4444' : theme.textMuted} />
          </Pressable>
          <Pressable
            onPress={() => { Haptics.selectionAsync(); setBookmarked(v => !v); }}
            style={[ps.iconBtn, { backgroundColor: bookmarked ? catColor + '20' : theme.surface, borderColor: bookmarked ? catColor + '40' : theme.border }]}
          >
            <MaterialIcons name={bookmarked ? 'bookmark' : 'bookmark-border'} size={18} color={bookmarked ? catColor : theme.textMuted} />
          </Pressable>
          <Pressable onPress={handleShare} style={[ps.iconBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <MaterialIcons name="share" size={18} color={theme.textMuted} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: insets.bottom + 48 }}
      >
        {/* ── Article Header ── */}
        <AnimatedRN.View entering={FadeInDown.duration(400)} style={ps.articleHeader}>
          {/* Category chip */}
          <AnimatedRN.View entering={ZoomIn.springify().damping(14).delay(80)}>
            <View style={[ps.catChip, { backgroundColor: catColor + '20', borderColor: catColor + '40' }]}>
              <MaterialIcons name={post.categoryIcon as any} size={14} color={catColor} />
              <Text style={[ps.catChipText, { color: catColor }]}>
                {category?.label || post.category}
              </Text>
            </View>
          </AnimatedRN.View>

          {/* Title (FIRST, before image) */}
          <AnimatedRN.View entering={FadeInDown.duration(360).delay(120)}>
            <Text style={[ps.title, { color: theme.textPrimary }]}>{post.title}</Text>
          </AnimatedRN.View>

          {/* Summary */}
          <AnimatedRN.View entering={FadeInDown.duration(340).delay(160)}>
            <Text style={[ps.summary, { color: theme.textSecondary }]}>{post.summary}</Text>
          </AnimatedRN.View>

          {/* Author + date row */}
          <AnimatedRN.View entering={FadeInDown.duration(300).delay(200)} style={ps.authorRow}>
            <View style={[ps.authorAvatar, { backgroundColor: catColor }]}>
              <Text style={ps.authorInitial}>مج</Text>
            </View>
            <View>
              <Text style={[ps.authorName, { color: theme.textPrimary }]}>{post.author}</Text>
              <Text style={[ps.authorDate, { color: theme.textMuted }]}>{formatPostDate(post.date)}</Text>
            </View>
            <View style={{ flex: 1 }} />
            <View style={[ps.verifiedBadge, { backgroundColor: catColor + '20', borderColor: catColor + '40' }]}>
              <MaterialIcons name="verified" size={12} color={catColor} />
              <Text style={[ps.verifiedText, { color: catColor }]}>موثّق</Text>
            </View>
          </AnimatedRN.View>
        </AnimatedRN.View>

        {/* ── Cover Image (right after title) ── */}
        <AnimatedRN.View entering={FadeInDown.duration(400).delay(240)} style={ps.coverWrap}>
          <Image
            source={{ uri: post.coverImage }}
            style={ps.coverImage}
            contentFit="cover"
            transition={400}
          />
          <LinearGradient
            colors={[catColor + '25', 'transparent']}
            style={[StyleSheet.absoluteFillObject, { borderRadius: 20 }]}
          />
        </AnimatedRN.View>

        {/* ── Stats row ── */}
        <AnimatedRN.View entering={FadeInDown.duration(300).delay(280)} style={ps.statsRow}>
          {[
            { icon: 'visibility', val: post.views.toLocaleString('ar-EG'), label: 'مشاهدة' },
            { icon: 'schedule', val: `${post.readTime} دق`, label: 'للقراءة' },
            { icon: 'format-size', val: `${post.wordCount}`, label: 'كلمة' },
            { icon: 'favorite-border', val: `${post.likes}`, label: 'إعجاب' },
            { icon: 'share', val: `${post.shares}`, label: 'مشاركة' },
          ].map((s, i) => (
            <View key={i} style={[ps.statItem, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <MaterialIcons name={s.icon as any} size={14} color={catColor} />
              <Text style={[ps.statVal, { color: theme.textPrimary }]}>{s.val}</Text>
              <Text style={[ps.statLabel, { color: theme.textMuted }]}>{s.label}</Text>
            </View>
          ))}
        </AnimatedRN.View>

        {/* ── Content Sections ── */}
        <View style={ps.content}>
          {post.sections.map((section, i) => (
            <RenderSection key={i} section={section} index={i} theme={theme} catColor={catColor} />
          ))}
        </View>

        {/* ── Tags ── */}
        <AnimatedRN.View entering={FadeInDown.duration(300).delay(300)} style={ps.tagsSection}>
          <Text style={[ps.tagsTitle, { color: theme.textPrimary }]}>الوسوم</Text>
          <View style={ps.tagsRow}>
            {post.tags.map(tag => (
              <View key={tag} style={[ps.tagChip, { backgroundColor: catColor + '12', borderColor: catColor + '30' }]}>
                <Text style={[ps.tagText, { color: catColor }]}>#{tag}</Text>
              </View>
            ))}
          </View>
        </AnimatedRN.View>

        {/* ── Reactions ── */}
        <AnimatedRN.View entering={FadeInDown.duration(300).delay(340)}>
          <View style={[ps.reactionsWrap, { borderColor: theme.border }]}>
            <ReactionsBar catColor={catColor} theme={theme} />
          </View>
        </AnimatedRN.View>

        {/* ── Author Card ── */}
        <AnimatedRN.View entering={FadeInDown.duration(340).delay(370)} style={{ paddingHorizontal: 20, marginTop: 8 }}>
          <LinearGradient
            colors={[catColor + '20', catColor + '08']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={[ps.authorCard, { borderColor: catColor + '30' }]}
          >
            <LinearGradient colors={[catColor, catColor + 'CC']} style={ps.authorCardAvatar}>
              <Text style={ps.authorCardInitial}>مج</Text>
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={[ps.authorCardName, { color: theme.textPrimary }]}>{post.author}</Text>
              <Text style={[ps.authorCardDesc, { color: theme.textMuted }]}>
                مصمم ومبرمج · المنوفية · الباجور · مصر
              </Text>
              <Text style={[ps.authorCardDesc, { color: theme.textMuted }]}>
                خبرة في البرمجة منذ 2006
              </Text>
            </View>
          </LinearGradient>
        </AnimatedRN.View>

        {/* ── Share CTA ── */}
        <AnimatedRN.View entering={FadeInDown.duration(300).delay(400)} style={{ paddingHorizontal: 20, marginTop: 16 }}>
          <Pressable
            onPress={handleShare}
            style={[ps.shareCTA, { backgroundColor: catColor + '15', borderColor: catColor + '40' }]}
          >
            <MaterialIcons name="share" size={20} color={catColor} />
            <Text style={[ps.shareCTAText, { color: catColor }]}>شارك هذا المنشور مع أصدقائك</Text>
            <MaterialIcons name="arrow-back" size={16} color={catColor} />
          </Pressable>
        </AnimatedRN.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const ps = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1,
  },
  iconBtn: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  headerActions: { flexDirection: 'row', gap: 8 },

  articleHeader: { padding: 20, paddingTop: 22, gap: 14 },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 9999, borderWidth: 1, alignSelf: 'flex-start' },
  catChipText: { fontSize: 12, fontFamily: TJB },

  title: { fontSize: 24, fontFamily: TJEB, lineHeight: 38, textAlign: 'right' },
  summary: { fontSize: 15, fontFamily: TJ, lineHeight: 26, textAlign: 'right' },

  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  authorAvatar: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  authorInitial: { fontSize: 15, fontFamily: TJB, color: '#FFF' },
  authorName: { fontSize: 14, fontFamily: TJB },
  authorDate: { fontSize: 12, fontFamily: TJ, marginTop: 1 },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 9999, borderWidth: 1 },
  verifiedText: { fontSize: 11, fontFamily: TJB },

  coverWrap: { marginHorizontal: 20, borderRadius: 20, overflow: 'hidden', marginBottom: 20 },
  coverImage: { width: '100%', height: W * 0.55, borderRadius: 20 },

  statsRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 20, flexWrap: 'wrap' },
  statItem: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, borderWidth: 1,
  },
  statVal: { fontSize: 12, fontFamily: TJB },
  statLabel: { fontSize: 10, fontFamily: TJ },

  content: { paddingHorizontal: 20, gap: 16, marginBottom: 24 },

  tagsSection: { paddingHorizontal: 20, gap: 8, marginBottom: 16 },
  tagsTitle: { fontSize: 15, fontFamily: TJEB, textAlign: 'right' },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagChip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 9999, borderWidth: 1 },
  tagText: { fontSize: 12, fontFamily: TJB },

  reactionsWrap: { borderTopWidth: 1, borderBottomWidth: 1, paddingVertical: 20, marginBottom: 16 },

  authorCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 16, borderWidth: 1 },
  authorCardAvatar: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  authorCardInitial: { fontSize: 20, fontFamily: TJB, color: '#FFF' },
  authorCardName: { fontSize: 16, fontFamily: TJEB },
  authorCardDesc: { fontSize: 12, fontFamily: TJ, marginTop: 2 },

  shareCTA: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14, borderWidth: 1.5, justifyContent: 'center' },
  shareCTAText: { flex: 1, fontSize: 15, fontFamily: TJB, textAlign: 'center' },
});

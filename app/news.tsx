/**
 * app/news.tsx — مستر جيشو
 * Professional posts feed: category breadcrumb + image cards + metadata
 */

import React, { useMemo, useState, useEffect } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import Animated, { FadeInDown, FadeIn, ZoomIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../contexts/ThemeContext';
import {
  MOCK_POSTS, POST_CATEGORIES, getPostsByCategory, formatPostDate, Post,
} from '../services/postsService';

const { width: W } = Dimensions.get('window');
const TJ = 'Tajawal_400Regular';
const TJM = 'Tajawal_500Medium';
const TJB = 'Tajawal_700Bold';
const TJEB = 'Tajawal_800ExtraBold';

const ALL_CATS = [
  { id: 'all', label: 'الكل', icon: 'apps', color: '#3B82F6', emoji: '🌐' },
  ...POST_CATEGORIES,
];

// ─── Category Tab ──────────────────────────────────────────────────────────────
function CatTab({ cat, active, onPress, theme }: any) {
  return (
    <Pressable
      onPress={() => { Haptics.selectionAsync(); onPress(); }}
      style={[
        st.catTab,
        active
          ? { backgroundColor: cat.color, borderColor: cat.color }
          : { backgroundColor: theme.surface, borderColor: theme.border },
      ]}
    >
      <MaterialIcons name={cat.icon as any} size={14} color={active ? '#FFF' : cat.color} />
      <Text style={[st.catTabText, { color: active ? '#FFF' : theme.textSecondary }]}>{cat.label}</Text>
    </Pressable>
  );
}

// ─── Post Card ─────────────────────────────────────────────────────────────────
function PostCard({ post, index, theme }: { post: Post; index: number; theme: any }) {
  const router = useRouter();
  const catLabel = POST_CATEGORIES.find(c => c.id === post.category)?.label || post.category;

  return (
    <Animated.View entering={FadeInDown.duration(340).delay(Math.min(index * 70, 500))}>
      <Pressable
        onPress={() => { Haptics.selectionAsync(); router.push(`/post/${post.id}` as any); }}
        style={[pc.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
      >
        {/* ── Cover Image ── */}
        <View style={pc.imageWrap}>
          <Image
            source={{ uri: post.thumbnail }}
            style={pc.image}
            contentFit="cover"
            transition={300}
          />
          {/* gradient overlay */}
          <View style={[pc.imageOverlay, { backgroundColor: 'rgba(0,0,0,0.28)' }]} />

          {/* category + featured chips on image */}
          <View style={pc.imageChips}>
            <View style={[pc.catChip, { backgroundColor: post.categoryColor }]}>
              <MaterialIcons name={post.categoryIcon as any} size={11} color="#FFF" />
              <Text style={pc.catChipText}>{catLabel}</Text>
            </View>
            {post.featured && (
              <View style={pc.featuredChip}>
                <MaterialIcons name="star" size={11} color="#F59E0B" />
                <Text style={pc.featuredChipText}>مميز</Text>
              </View>
            )}
          </View>

          {/* emoji top-right */}
          <View style={pc.emojiWrap}>
            <Text style={{ fontSize: 24 }}>{post.emoji}</Text>
          </View>
        </View>

        {/* ── Content ── */}
        <View style={pc.body}>
          <Text style={[pc.title, { color: theme.textPrimary }]} numberOfLines={2}>
            {post.title}
          </Text>
          <Text style={[pc.summary, { color: theme.textSecondary }]} numberOfLines={2}>
            {post.summary}
          </Text>

          {/* ── Metadata row ── */}
          <View style={pc.metaRow}>
            <View style={pc.metaItem}>
              <MaterialIcons name="visibility" size={12} color={theme.textMuted} />
              <Text style={[pc.metaText, { color: theme.textMuted }]}>
                {post.views.toLocaleString('ar-EG')}
              </Text>
            </View>
            <View style={pc.metaDot} />
            <View style={pc.metaItem}>
              <MaterialIcons name="schedule" size={12} color={theme.textMuted} />
              <Text style={[pc.metaText, { color: theme.textMuted }]}>{post.readTime} دق</Text>
            </View>
            <View style={pc.metaDot} />
            <View style={pc.metaItem}>
              <MaterialIcons name="format-size" size={12} color={theme.textMuted} />
              <Text style={[pc.metaText, { color: theme.textMuted }]}>{post.wordCount} كلمة</Text>
            </View>
            <View style={pc.metaDot} />
            <View style={pc.metaItem}>
              <MaterialIcons name="favorite-border" size={12} color={theme.textMuted} />
              <Text style={[pc.metaText, { color: theme.textMuted }]}>{post.likes}</Text>
            </View>
          </View>

          {/* ── Date + Read button ── */}
          <View style={pc.footer}>
            <Text style={[pc.date, { color: theme.textMuted }]}>{formatPostDate(post.date)}</Text>
            <View style={[pc.readBtn, { backgroundColor: post.categoryColor + '18', borderColor: post.categoryColor + '40' }]}>
              <Text style={[pc.readBtnText, { color: post.categoryColor }]}>اقرأ المنشور</Text>
              <MaterialIcons name="arrow-back" size={13} color={post.categoryColor} />
            </View>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ─── Featured Hero Card ────────────────────────────────────────────────────────
function HeroCard({ post, theme }: { post: Post; theme: any }) {
  const router = useRouter();
  const catLabel = POST_CATEGORIES.find(c => c.id === post.category)?.label || post.category;

  return (
    <Pressable
      onPress={() => { Haptics.selectionAsync(); router.push(`/post/${post.id}` as any); }}
      style={[hc.card, { borderColor: post.categoryColor + '40' }]}
    >
      <Image source={{ uri: post.coverImage }} style={hc.image} contentFit="cover" transition={300} />
      <View style={[hc.gradient, { backgroundColor: 'rgba(0,0,0,0.55)' }]} />

      <View style={hc.content}>
        <View style={hc.chips}>
          <View style={[hc.chip, { backgroundColor: post.categoryColor }]}>
            <MaterialIcons name={post.categoryIcon as any} size={12} color="#FFF" />
            <Text style={hc.chipText}>{catLabel}</Text>
          </View>
          <View style={hc.featuredChip}>
            <MaterialIcons name="star" size={12} color="#F59E0B" />
            <Text style={hc.featuredText}>مقال مميز</Text>
          </View>
        </View>
        <Text style={hc.title} numberOfLines={2}>{post.title}</Text>
        <Text style={hc.summary} numberOfLines={2}>{post.summary}</Text>
        <View style={hc.meta}>
          <MaterialIcons name="visibility" size={12} color="rgba(255,255,255,0.8)" />
          <Text style={hc.metaText}>{post.views.toLocaleString('ar-EG')}</Text>
          <Text style={hc.metaSep}>·</Text>
          <MaterialIcons name="schedule" size={12} color="rgba(255,255,255,0.8)" />
          <Text style={hc.metaText}>{post.readTime} دقائق</Text>
          <Text style={hc.metaSep}>·</Text>
          <Text style={hc.metaText}>{post.wordCount} كلمة</Text>
        </View>
      </View>
    </Pressable>
  );
}

const hc = StyleSheet.create({
  card: { marginHorizontal: 16, borderRadius: 20, overflow: 'hidden', borderWidth: 1, height: 260, marginBottom: 8 },
  image: { ...StyleSheet.absoluteFillObject },
  gradient: { ...StyleSheet.absoluteFillObject },
  content: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 18, gap: 8 },
  chips: { flexDirection: 'row', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999 },
  chipText: { fontSize: 11, fontFamily: TJB, color: '#FFF' },
  featuredChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 9999, backgroundColor: 'rgba(245,158,11,0.2)', borderWidth: 1, borderColor: '#F59E0B60' },
  featuredText: { fontSize: 10, fontFamily: TJB, color: '#F59E0B' },
  title: { fontSize: 18, fontFamily: TJEB, color: '#FFF', lineHeight: 28 },
  summary: { fontSize: 13, fontFamily: TJ, color: 'rgba(255,255,255,0.85)', lineHeight: 20 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 11, fontFamily: TJM, color: 'rgba(255,255,255,0.8)' },
  metaSep: { color: 'rgba(255,255,255,0.5)', fontSize: 10 },
});

// ─── Post Card Styles ──────────────────────────────────────────────────────────
const pc = StyleSheet.create({
  card: { borderRadius: 18, overflow: 'hidden', marginHorizontal: 16, marginBottom: 16, borderWidth: 1 },
  imageWrap: { height: 200, position: 'relative' },
  image: { width: '100%', height: '100%' },
  imageOverlay: { ...StyleSheet.absoluteFillObject },
  imageChips: { position: 'absolute', bottom: 12, right: 12, flexDirection: 'row', gap: 6 },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 9999 },
  catChipText: { fontSize: 11, fontFamily: TJB, color: '#FFF' },
  featuredChip: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 9999, backgroundColor: 'rgba(245,158,11,0.2)', borderWidth: 1, borderColor: '#F59E0B60' },
  featuredChipText: { fontSize: 10, fontFamily: TJB, color: '#F59E0B' },
  emojiWrap: { position: 'absolute', top: 12, left: 12, backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 10, padding: 6 },
  body: { padding: 14, gap: 8 },
  title: { fontSize: 17, fontFamily: TJEB, lineHeight: 28, textAlign: 'right' },
  summary: { fontSize: 13, fontFamily: TJ, lineHeight: 21, textAlign: 'right' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 2 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontSize: 11, fontFamily: TJM },
  metaDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#94A3B8' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  date: { fontSize: 11, fontFamily: TJM },
  readBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 9999, borderWidth: 1 },
  readBtnText: { fontSize: 13, fontFamily: TJB },
});

const st = StyleSheet.create({
  catTab: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 9999, borderWidth: 1.5 },
  catTabText: { fontSize: 12, fontFamily: TJM },
});

// ─── Main Screen ───────────────────────────────────────────────────────────────
export default function NewsScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { category: paramCategory } = useLocalSearchParams<{ category?: string }>();
  const [activeCategory, setActiveCategory] = useState<string>(paramCategory || 'all');

  useEffect(() => {
    if (paramCategory) setActiveCategory(paramCategory);
  }, [paramCategory]);

  const filteredPosts = useMemo(() => getPostsByCategory(activeCategory), [activeCategory]);
  const featuredPosts = useMemo(() => MOCK_POSTS.filter(p => p.featured), []);
  const activeCat = ALL_CATS.find(c => c.id === activeCategory);
  const totalCount = filteredPosts.length;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.background }}>

      {/* ── Header with breadcrumb ── */}
      <View style={[ns.header, { borderBottomColor: theme.border }]}>
        <Pressable
          onPress={() => router.back()}
          style={[ns.backBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
        >
          <MaterialIcons name="arrow-forward" size={20} color={theme.textPrimary} />
        </Pressable>

        <View style={ns.breadcrumb}>
          <Text style={[ns.breadcrumbRoot, { color: theme.primary }]}>مستر جيشو</Text>
          <MaterialIcons name="chevron-left" size={16} color={theme.textMuted} />
          <Text style={[ns.breadcrumbCurrent, { color: theme.textPrimary }]} numberOfLines={1}>
            {activeCat?.label || 'المنشورات'}
          </Text>
        </View>

        <View style={[ns.countBadge, { backgroundColor: theme.primary + '20', borderColor: theme.primary + '40' }]}>
          <Text style={[ns.countText, { color: theme.primary }]}>{totalCount}</Text>
        </View>
      </View>

      {/* ── Category filter tabs ── */}
      <View style={[ns.tabsWrap, { borderBottomColor: theme.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={ns.tabsScroll}>
          {ALL_CATS.map((cat) => (
            <CatTab
              key={cat.id}
              cat={cat}
              active={activeCategory === cat.id}
              onPress={() => setActiveCategory(cat.id)}
              theme={theme}
            />
          ))}
        </ScrollView>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: 20, paddingBottom: insets.bottom + 32 }}
      >

        {/* ── Featured hero cards (only when showing all) ── */}
        {activeCategory === 'all' && featuredPosts.length > 0 && (
          <Animated.View entering={FadeInDown.duration(350)}>
            <View style={ns.sectionHeader}>
              <MaterialIcons name="star" size={18} color="#F59E0B" />
              <Text style={[ns.sectionTitle, { color: theme.textPrimary }]}>المقالات المميزة</Text>
            </View>
            {featuredPosts.map(p => (
              <Animated.View key={p.id} entering={FadeIn.duration(350)}>
                <HeroCard post={p} theme={theme} />
              </Animated.View>
            ))}
            <View style={[ns.divider, { backgroundColor: theme.border }]} />
          </Animated.View>
        )}

        {/* ── All posts section ── */}
        <View style={ns.sectionHeader}>
          <MaterialIcons name="article" size={18} color={theme.textSecondary} />
          <Text style={[ns.sectionTitle, { color: theme.textPrimary }]}>
            {activeCategory === 'all' ? 'جميع المنشورات' : `${activeCat?.label} (${totalCount})`}
          </Text>
        </View>

        {filteredPosts.length === 0 ? (
          <Animated.View entering={FadeIn.duration(300)} style={ns.emptyBox}>
            <Text style={{ fontSize: 52 }}>📭</Text>
            <Text style={[ns.emptyTitle, { color: theme.textSecondary }]}>لا توجد منشورات في هذه الفئة</Text>
            <Text style={[ns.emptyHint, { color: theme.textMuted }]}>جرّب تصفح فئة أخرى</Text>
          </Animated.View>
        ) : (
          filteredPosts.map((post, i) => (
            <PostCard key={post.id} post={post} index={i} theme={theme} />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const ns = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
  },
  breadcrumb: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4, justifyContent: 'center' },
  breadcrumbRoot: { fontSize: 13, fontFamily: TJB },
  breadcrumbCurrent: { fontSize: 14, fontFamily: TJEB, maxWidth: 160 },
  countBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999, borderWidth: 1 },
  countText: { fontSize: 12, fontFamily: TJB },
  tabsWrap: { borderBottomWidth: 1, paddingVertical: 10 },
  tabsScroll: { paddingHorizontal: 16, gap: 8 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 16, marginBottom: 14,
  },
  sectionTitle: { fontSize: 17, fontFamily: TJEB },
  divider: { height: 1, marginHorizontal: 16, marginVertical: 20 },
  emptyBox: { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyTitle: { fontSize: 16, fontFamily: TJM },
  emptyHint: { fontSize: 13, fontFamily: TJ },
});

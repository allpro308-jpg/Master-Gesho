/**
 * app/(tabs)/index.tsx — مستر جيشو
 * Redesigned smart home feed: AI-powered mixed content (tools + posts)
 */

import React, { useState, useMemo, useCallback, memo } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  ActivityIndicator, Dimensions, Share,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeIn, ZoomIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';

import { useTheme } from '../../contexts/ThemeContext';
import { useNotifications } from '../../contexts/NotificationsContext';
import { useAppContext } from '../../contexts/AppContext';
import SearchBar from '../../components/SearchBar';
import { MOCK_POSTS, POST_CATEGORIES, formatPostDate } from '../../services/postsService';
import {
  buildUserPrefs, buildSmartFeed, buildExploreMore,
  FeedItem, ToolFeedItem, PostFeedItem,
} from '../../services/smartFeedService';

const { width: SW } = Dimensions.get('window');

// ─── Reason Badge ──────────────────────────────────────────────────────────────
const ReasonBadge = memo(({ reason, icon, color }: { reason: string; icon: string; color: string }) => (
  <View style={[rb.wrap, { backgroundColor: color + '18', borderColor: color + '35' }]}>
    <MaterialIcons name={icon as any} size={10} color={color} />
    <Text style={[rb.text, { color }]} numberOfLines={1}>{reason}</Text>
  </View>
));
const rb = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 9999, borderWidth: 1,
    maxWidth: 140,
  },
  text: { fontSize: 10, fontFamily: 'Cairo_600SemiBold' },
});

// ─── Feed Tool Card ────────────────────────────────────────────────────────────
const FeedToolCard = memo(({
  item, theme, index, onSave, onVote, isSaved, isVoted,
}: {
  item: ToolFeedItem; theme: any; index: number;
  onSave: (id: string) => void; onVote: (id: string) => void;
  isSaved: boolean; isVoted: boolean;
}) => {
  const router = useRouter();
  const tool = item.data;

  return (
    <Animated.View entering={FadeInDown.duration(320).delay(Math.min(index * 60, 600))}>
      <Pressable
        onPress={() => { Haptics.selectionAsync(); router.push(`/tool/${tool.id}` as any); }}
        style={({ pressed }) => [
          tc.card,
          { backgroundColor: theme.surface, borderColor: theme.border },
          pressed && { opacity: 0.92, transform: [{ scale: 0.985 }] },
        ]}
      >
        {/* Colored top accent line */}
        <View style={[tc.accent, { backgroundColor: tool.logoColor }]} />

        <View style={tc.body}>
          {/* Icon */}
          <View style={[tc.iconBg, { backgroundColor: tool.logoColor + '18' }]}>
            <MaterialIcons name={tool.logoIcon as any} size={30} color={tool.logoColor} />
          </View>

          {/* Info */}
          <View style={tc.info}>
            <View style={tc.titleRow}>
              <Text style={[tc.name, { color: theme.textPrimary }]} numberOfLines={1}>{tool.name}</Text>
              <ReasonBadge reason={item.reason} icon={item.reasonIcon} color={item.reasonColor} />
            </View>
            <Text style={[tc.desc, { color: theme.textSecondary }]} numberOfLines={2}>
              {tool.shortDescription}
            </Text>
            <View style={tc.metaRow}>
              <View style={[tc.catChip, { backgroundColor: (theme.categoryColors?.[tool.category] || tool.logoColor) + '15' }]}>
                <Text style={[tc.catText, { color: theme.categoryColors?.[tool.category] || tool.logoColor }]}>
                  {tool.category}
                </Text>
              </View>
              <View style={tc.ratingRow}>
                <MaterialIcons name="star" size={12} color="#F59E0B" />
                <Text style={[tc.ratingText, { color: theme.textSecondary }]}>{tool.rating}</Text>
              </View>
              <View style={[tc.pricingChip, { backgroundColor: tool.pricing === 'مجاني' ? '#10B98115' : '#F59E0B15' }]}>
                <Text style={[tc.pricingText, { color: tool.pricing === 'مجاني' ? '#10B981' : '#F59E0B' }]}>
                  {tool.pricing}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={[tc.footer, { borderTopColor: theme.border }]}>
          <View style={tc.voteRow}>
            <MaterialIcons name="arrow-upward" size={13} color={theme.textMuted} />
            <Text style={[tc.voteText, { color: theme.textMuted }]}>
              {tool.votes >= 1000 ? `${(tool.votes / 1000).toFixed(1)}k` : tool.votes}
            </Text>
          </View>
          <View style={tc.actions}>
            <Pressable
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onVote(tool.id); }}
              style={[tc.actionBtn, { backgroundColor: isVoted ? tool.logoColor + '20' : theme.background, borderColor: isVoted ? tool.logoColor + '50' : theme.border }]}
            >
              <MaterialIcons name="arrow-upward" size={14} color={isVoted ? tool.logoColor : theme.textMuted} />
              <Text style={[tc.actionText, { color: isVoted ? tool.logoColor : theme.textMuted }]}>
                صوّت
              </Text>
            </Pressable>
            <Pressable
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onSave(tool.id); }}
              style={[tc.actionBtn, { backgroundColor: isSaved ? tool.logoColor + '20' : theme.background, borderColor: isSaved ? tool.logoColor + '50' : theme.border }]}
            >
              <MaterialIcons name={isSaved ? 'bookmark' : 'bookmark-border'} size={14} color={isSaved ? tool.logoColor : theme.textMuted} />
              <Text style={[tc.actionText, { color: isSaved ? tool.logoColor : theme.textMuted }]}>
                {isSaved ? 'محفوظ' : 'احفظ'}
              </Text>
            </Pressable>
            <View style={[tc.exploreBtn, { backgroundColor: tool.logoColor }]}>
              <Text style={tc.exploreBtnText}>اكتشف</Text>
              <MaterialIcons name="arrow-back" size={13} color="#FFF" />
            </View>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
});

const tc = StyleSheet.create({
  card: {
    marginHorizontal: 16, marginBottom: 12, borderRadius: 18,
    borderWidth: 1, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  accent: { height: 3, width: '100%' },
  body: { flexDirection: 'row', gap: 12, padding: 14 },
  iconBg: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  info: { flex: 1, gap: 6 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  name: { fontSize: 15, fontFamily: 'Cairo_700Bold', flex: 1 },
  desc: { fontSize: 13, fontFamily: 'Cairo_400Regular', lineHeight: 20 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  catChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 9999 },
  catText: { fontSize: 10, fontFamily: 'Cairo_600SemiBold' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingText: { fontSize: 11, fontFamily: 'Cairo_600SemiBold' },
  pricingChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 9999 },
  pricingText: { fontSize: 10, fontFamily: 'Cairo_600SemiBold' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1 },
  voteRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  voteText: { fontSize: 12, fontFamily: 'Cairo_600SemiBold' },
  actions: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 9999, borderWidth: 1 },
  actionText: { fontSize: 11, fontFamily: 'Cairo_600SemiBold' },
  exploreBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 9999 },
  exploreBtnText: { fontSize: 11, fontFamily: 'Cairo_700Bold', color: '#FFF' },
});

// ─── Feed Post Card ────────────────────────────────────────────────────────────
const FeedPostCard = memo(({ item, theme, index }: { item: PostFeedItem; theme: any; index: number }) => {
  const router = useRouter();
  const post = item.data;
  const catLabel = POST_CATEGORIES.find(c => c.id === post.category)?.label || post.category;

  return (
    <Animated.View entering={FadeInDown.duration(340).delay(Math.min(index * 60, 600))}>
      <Pressable
        onPress={() => { Haptics.selectionAsync(); router.push(`/post/${post.id}` as any); }}
        style={({ pressed }) => [
          pc.card,
          { backgroundColor: theme.surface, borderColor: theme.border },
          pressed && { opacity: 0.92, transform: [{ scale: 0.985 }] },
        ]}
      >
        {/* Cover Image */}
        <View style={pc.imageWrap}>
          <Image
            source={{ uri: post.thumbnail }}
            style={pc.image}
            contentFit="cover"
            transition={300}
          />
          <View style={pc.imageOverlay} />

          {/* Chips on image */}
          <View style={pc.topChips}>
            <View style={[pc.catChip, { backgroundColor: post.categoryColor }]}>
              <MaterialIcons name={post.categoryIcon as any} size={11} color="#FFF" />
              <Text style={pc.catChipText}>{catLabel}</Text>
            </View>
            {post.featured && (
              <View style={pc.featuredChip}>
                <MaterialIcons name="star" size={11} color="#F59E0B" />
                <Text style={pc.featuredText}>مميز</Text>
              </View>
            )}
          </View>

          {/* Reason badge bottom-right */}
          <View style={pc.bottomRight}>
            <ReasonBadge reason={item.reason} icon={item.reasonIcon} color={item.reasonColor} />
          </View>

          {/* Emoji top-left */}
          <View style={pc.emojiWrap}>
            <Text style={{ fontSize: 20 }}>{post.emoji}</Text>
          </View>
        </View>

        {/* Content */}
        <View style={pc.body}>
          <Text style={[pc.title, { color: theme.textPrimary }]} numberOfLines={2}>{post.title}</Text>
          <Text style={[pc.summary, { color: theme.textSecondary }]} numberOfLines={1}>{post.summary}</Text>

          <View style={pc.footer}>
            <View style={pc.meta}>
              <MaterialIcons name="visibility" size={12} color={theme.textMuted} />
              <Text style={[pc.metaText, { color: theme.textMuted }]}>{post.views.toLocaleString('ar-EG')}</Text>
              <View style={pc.dot} />
              <MaterialIcons name="schedule" size={12} color={theme.textMuted} />
              <Text style={[pc.metaText, { color: theme.textMuted }]}>{post.readTime} دق</Text>
              <View style={pc.dot} />
              <MaterialIcons name="favorite-border" size={12} color={theme.textMuted} />
              <Text style={[pc.metaText, { color: theme.textMuted }]}>{post.likes}</Text>
            </View>
            <View style={[pc.readBtn, { backgroundColor: post.categoryColor + '15', borderColor: post.categoryColor + '40' }]}>
              <Text style={[pc.readBtnText, { color: post.categoryColor }]}>اقرأ</Text>
              <MaterialIcons name="arrow-back" size={12} color={post.categoryColor} />
            </View>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
});

const pc = StyleSheet.create({
  card: {
    marginHorizontal: 16, marginBottom: 12, borderRadius: 18,
    borderWidth: 1, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  imageWrap: { height: 190, position: 'relative' },
  image: { width: '100%', height: '100%' },
  imageOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.22)' },
  topChips: { position: 'absolute', top: 12, right: 12, flexDirection: 'row', gap: 6 },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 9999 },
  catChipText: { fontSize: 11, fontFamily: 'Cairo_700Bold', color: '#FFF' },
  featuredChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 9999,
    backgroundColor: 'rgba(245,158,11,0.2)', borderWidth: 1, borderColor: '#F59E0B60',
  },
  featuredText: { fontSize: 10, fontFamily: 'Cairo_700Bold', color: '#F59E0B' },
  bottomRight: { position: 'absolute', bottom: 12, right: 12 },
  emojiWrap: {
    position: 'absolute', top: 12, left: 12,
    backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 10, padding: 6,
  },
  body: { padding: 14, gap: 6 },
  title: { fontSize: 15, fontFamily: 'Cairo_700Bold', lineHeight: 24 },
  summary: { fontSize: 12, fontFamily: 'Cairo_400Regular', lineHeight: 18 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  metaText: { fontSize: 11, fontFamily: 'Cairo_500Medium' },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#94A3B8' },
  readBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 9999, borderWidth: 1 },
  readBtnText: { fontSize: 11, fontFamily: 'Cairo_700Bold' },
});

// ─── Compact New Tool Card (for Explore More) ─────────────────────────────────
const CompactToolCard = memo(({ tool, theme }: { tool: any; theme: any }) => {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => { Haptics.selectionAsync(); router.push(`/tool/${tool.id}` as any); }}
      style={[et.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
    >
      <View style={[et.iconBg, { backgroundColor: tool.logoColor + '18' }]}>
        <MaterialIcons name={tool.logoIcon as any} size={26} color={tool.logoColor} />
      </View>
      <Text style={[et.name, { color: theme.textPrimary }]} numberOfLines={1}>{tool.name}</Text>
      <View style={et.meta}>
        <MaterialIcons name="star" size={11} color="#F59E0B" />
        <Text style={[et.metaText, { color: theme.textMuted }]}>{tool.rating}</Text>
        {tool.isNew && (
          <View style={[et.newBadge, { backgroundColor: '#10B98118' }]}>
            <Text style={et.newBadgeText}>جديد</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
});

const et = StyleSheet.create({
  card: {
    width: 112, alignItems: 'center', gap: 8, paddingVertical: 14, paddingHorizontal: 8,
    borderRadius: 16, borderWidth: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  iconBg: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 11, fontFamily: 'Cairo_600SemiBold', textAlign: 'center', lineHeight: 16 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontSize: 10, fontFamily: 'Cairo_600SemiBold' },
  newBadge: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 9999 },
  newBadgeText: { fontSize: 9, fontFamily: 'Cairo_700Bold', color: '#10B981' },
});

// ─── Recent Post Row (for Explore More) ───────────────────────────────────────
const RecentPostRow = memo(({ post, theme }: { post: any; theme: any }) => {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => { Haptics.selectionAsync(); router.push(`/post/${post.id}` as any); }}
      style={[ep.row, { backgroundColor: theme.surface, borderColor: theme.border }]}
    >
      <Image source={{ uri: post.thumbnail }} style={ep.img} contentFit="cover" transition={200} />
      <View style={ep.content}>
        <Text style={[ep.title, { color: theme.textPrimary }]} numberOfLines={2}>{post.title}</Text>
        <View style={ep.meta}>
          <MaterialIcons name="visibility" size={11} color={theme.textMuted} />
          <Text style={[ep.metaText, { color: theme.textMuted }]}>{post.views.toLocaleString('ar-EG')}</Text>
          <Text style={[ep.metaDot, { color: theme.textMuted }]}>·</Text>
          <Text style={[ep.metaText, { color: theme.textMuted }]}>{post.readTime} دق</Text>
        </View>
      </View>
      <MaterialIcons name="arrow-back" size={16} color={theme.textMuted} />
    </Pressable>
  );
});

const ep = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 10, borderRadius: 14, borderWidth: 1, marginBottom: 8,
  },
  img: { width: 64, height: 64, borderRadius: 10, flexShrink: 0 },
  content: { flex: 1, gap: 4 },
  title: { fontSize: 13, fontFamily: 'Cairo_600SemiBold', lineHeight: 20 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 11, fontFamily: 'Cairo_400Regular' },
  metaDot: { fontSize: 10 },
});

// ─── Section Header ────────────────────────────────────────────────────────────
const SectionHeader = memo(({
  icon, iconColor, title, badge, onAction, actionLabel, theme,
}: {
  icon: string; iconColor: string; title: string; badge?: string;
  onAction?: () => void; actionLabel?: string; theme: any;
}) => (
  <View style={sh.row}>
    <View style={sh.left}>
      <View style={[sh.iconBg, { backgroundColor: iconColor + '18' }]}>
        <MaterialIcons name={icon as any} size={18} color={iconColor} />
      </View>
      <Text style={[sh.title, { color: theme.textPrimary }]}>{title}</Text>
      {badge ? (
        <View style={[sh.badge, { backgroundColor: iconColor + '20', borderColor: iconColor + '40' }]}>
          <Text style={[sh.badgeText, { color: iconColor }]}>{badge}</Text>
        </View>
      ) : null}
    </View>
    {onAction ? (
      <Pressable onPress={onAction}>
        <Text style={[sh.action, { color: theme.primary }]}>{actionLabel || 'عرض الكل'}</Text>
      </Pressable>
    ) : null}
  </View>
));
const sh = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 14 },
  left: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBg: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 17, fontFamily: 'Cairo_700Bold' },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999, borderWidth: 1 },
  badgeText: { fontSize: 10, fontFamily: 'Cairo_700Bold' },
  action: { fontSize: 13, fontFamily: 'Cairo_600SemiBold' },
});

// ─── Main Screen ───────────────────────────────────────────────────────────────
export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { theme } = useTheme();
  const { unreadCount } = useNotifications();
  const {
    tools, loading, searchQuery, setSearchQuery,
    savedToolIds, votedToolIds, toggleSaveTool, toggleVoteTool,
  } = useAppContext();

  const [showAll, setShowAll] = useState(false);

  // Build user preference profile
  const prefs = useMemo(
    () => buildUserPrefs(tools, savedToolIds, votedToolIds),
    [tools, savedToolIds, votedToolIds]
  );

  // Build smart mixed feed
  const allFeedItems = useMemo(
    () => buildSmartFeed(tools, MOCK_POSTS, prefs, savedToolIds),
    [tools, prefs, savedToolIds]
  );

  // Explore more data
  const { newTools, latestPosts } = useMemo(
    () => buildExploreMore(tools, MOCK_POSTS),
    [tools]
  );

  // Visible feed items (paginated)
  const visibleFeedItems = useMemo(
    () => (showAll ? allFeedItems : allFeedItems.slice(0, 10)),
    [allFeedItems, showAll]
  );

  // Search results
  const filteredTools = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return tools.filter(t =>
      t.name.toLowerCase().includes(q) ||
      t.shortDescription.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q) ||
      t.tags.some(tag => tag.toLowerCase().includes(q))
    );
  }, [tools, searchQuery]);

  const isSearching = searchQuery.trim().length > 0;
  const s = useMemo(() => createStyles(theme), [theme]);

  if (loading) {
    return (
      <SafeAreaView edges={['top']} style={[s.container, s.centered]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[s.loadingText, { color: theme.textMuted }]}>جارٍ تحميل المحتوى...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={s.container}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={s.header}>
          <View>
            <Text style={[s.logo, { color: theme.textPrimary }]}>مستر جيشو</Text>
            <Text style={[s.tagline, { color: theme.textMuted }]}>منصتك العربية لأدوات الذكاء الاصطناعي</Text>
          </View>
          <Pressable
            onPress={() => { Haptics.selectionAsync(); router.push('/(tabs)/notifications'); }}
            style={[s.notifBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
          >
            <MaterialIcons
              name={unreadCount > 0 ? 'notifications' : 'notifications-none'}
              size={22}
              color={unreadCount > 0 ? theme.primary : theme.textSecondary}
            />
            {unreadCount > 0 ? (
              <View style={s.notifBadge}>
                <Text style={s.notifBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        {/* ── Search Bar ── */}
        <View style={s.searchWrap}>
          <SearchBar value={searchQuery} onChangeText={setSearchQuery} />
        </View>

        {isSearching ? (
          /* ── Search Results ── */
          <View style={{ marginTop: 8 }}>
            <View style={[s.searchResultsHeader, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <MaterialIcons name="search" size={16} color={theme.primary} />
              <Text style={[s.searchResultsText, { color: theme.textPrimary }]}>
                {filteredTools.length} نتيجة لـ
                <Text style={{ color: theme.primary }}> "{searchQuery}"</Text>
              </Text>
            </View>
            {filteredTools.length === 0 ? (
              <Animated.View entering={FadeIn.duration(300)} style={s.emptyBox}>
                <MaterialIcons name="search-off" size={52} color={theme.textMuted} />
                <Text style={[s.emptyTitle, { color: theme.textSecondary }]}>لم يتم العثور على نتائج</Text>
                <Text style={[s.emptyHint, { color: theme.textMuted }]}>جرّب كلمات مفتاحية مختلفة</Text>
              </Animated.View>
            ) : (
              filteredTools.map((tool, i) => (
                <Animated.View key={tool.id} entering={FadeInDown.duration(280).delay(i * 40)}>
                  <Pressable
                    onPress={() => { Haptics.selectionAsync(); router.push(`/tool/${tool.id}` as any); }}
                    style={[s.searchCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
                  >
                    <View style={[s.searchIconBg, { backgroundColor: tool.logoColor + '18' }]}>
                      <MaterialIcons name={tool.logoIcon as any} size={24} color={tool.logoColor} />
                    </View>
                    <View style={s.searchInfo}>
                      <Text style={[s.searchName, { color: theme.textPrimary }]} numberOfLines={1}>{tool.name}</Text>
                      <Text style={[s.searchDesc, { color: theme.textSecondary }]} numberOfLines={1}>{tool.shortDescription}</Text>
                      <View style={s.searchMeta}>
                        <MaterialIcons name="star" size={11} color="#F59E0B" />
                        <Text style={[s.searchMetaText, { color: theme.textMuted }]}>{tool.rating}</Text>
                        <Text style={[s.searchMetaDot, { color: theme.textMuted }]}>·</Text>
                        <Text style={[s.searchMetaText, { color: theme.textMuted }]}>{tool.category}</Text>
                      </View>
                    </View>
                    <MaterialIcons name="arrow-back" size={18} color={theme.textMuted} />
                  </Pressable>
                </Animated.View>
              ))
            )}
          </View>
        ) : (
          <>
            {/* ── Category Quick Access ── */}
            <View style={s.catRow}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.catScroll}
              >
                {POST_CATEGORIES.map(cat => (
                  <Pressable
                    key={cat.id}
                    onPress={() => { Haptics.selectionAsync(); router.push({ pathname: '/news', params: { category: cat.id } } as any); }}
                    style={[s.catPill, { backgroundColor: cat.color + '12', borderColor: cat.color + '35' }]}
                  >
                    <Text style={{ fontSize: 14 }}>{cat.emoji}</Text>
                    <Text style={[s.catPillText, { color: cat.color }]}>{cat.label}</Text>
                  </Pressable>
                ))}
                <Pressable
                  onPress={() => { Haptics.selectionAsync(); router.push('/explore' as any); }}
                  style={[s.catPill, { backgroundColor: theme.primary + '12', borderColor: theme.primary + '35' }]}
                >
                  <MaterialIcons name="category" size={16} color={theme.primary} />
                  <Text style={[s.catPillText, { color: theme.primary }]}>تصفح الأدوات</Text>
                </Pressable>
                <Pressable
                  onPress={() => { Haptics.selectionAsync(); router.push('/tags' as any); }}
                  style={[s.catPill, { backgroundColor: '#A78BFA12', borderColor: '#A78BFA35' }]}
                >
                  <MaterialIcons name="tag" size={16} color="#A78BFA" />
                  <Text style={[s.catPillText, { color: '#A78BFA' }]}>الوسوم</Text>
                </Pressable>
              </ScrollView>
            </View>

            {/* ── AI Smart Feed: ✨ مقترح لك ── */}
            <View style={s.feedSection}>
              <SectionHeader
                icon="auto-awesome"
                iconColor="#A78BFA"
                title="مقترح لك"
                badge={prefs.hasInteractions ? 'AI مخصص' : undefined}
                theme={theme}
              />

              {/* AI description chip */}
              <Animated.View entering={FadeIn.duration(400)} style={s.aiChip}>
                <LinearGradient
                  colors={['#A78BFA18', '#3B82F618']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={s.aiChipGrad}
                >
                  <MaterialIcons name="psychology" size={14} color="#A78BFA" />
                  <Text style={[s.aiChipText, { color: theme.textSecondary }]}>
                    {prefs.hasInteractions
                      ? 'مرتّب بناءً على اهتماماتك وسجل تفاعلاتك'
                      : 'مرتّب بناءً على الجودة والرواج وحداثة المحتوى'}
                  </Text>
                </LinearGradient>
              </Animated.View>

              {/* Mixed feed items */}
              {visibleFeedItems.map((item, i) =>
                item.type === 'tool' ? (
                  <FeedToolCard
                    key={`tool-${item.data.id}`}
                    item={item as ToolFeedItem}
                    theme={theme}
                    index={i}
                    onSave={toggleSaveTool}
                    onVote={toggleVoteTool}
                    isSaved={savedToolIds.includes(item.data.id)}
                    isVoted={votedToolIds.includes(item.data.id)}
                  />
                ) : (
                  <FeedPostCard
                    key={`post-${item.data.id}`}
                    item={item as PostFeedItem}
                    theme={theme}
                    index={i}
                  />
                )
              )}

              {/* Show more / less button */}
              {allFeedItems.length > 10 && (
                <Pressable
                  onPress={() => { Haptics.selectionAsync(); setShowAll(v => !v); }}
                  style={[s.showMoreBtn, { borderColor: theme.primary + '40', backgroundColor: theme.primary + '10' }]}
                >
                  <MaterialIcons name={showAll ? 'keyboard-arrow-up' : 'keyboard-arrow-down'} size={20} color={theme.primary} />
                  <Text style={[s.showMoreText, { color: theme.primary }]}>
                    {showAll ? 'عرض أقل' : `عرض ${allFeedItems.length - 10} عنصر إضافي`}
                  </Text>
                </Pressable>
              )}
            </View>

            {/* ── Explore More: 🚀 استكشف المزيد ── */}
            <View style={[s.exploreSection, { borderTopColor: theme.border }]}>
              <SectionHeader
                icon="rocket-launch"
                iconColor="#F97316"
                title="استكشف المزيد"
                onAction={() => { Haptics.selectionAsync(); router.push('/explore' as any); }}
                actionLabel="عرض الكل"
                theme={theme}
              />

              {/* New & Trending tools */}
              {newTools.length > 0 && (
                <>
                  <View style={s.subHeader}>
                    <MaterialIcons name="fiber-new" size={14} color="#10B981" />
                    <Text style={[s.subHeaderText, { color: theme.textSecondary }]}>أدوات جديدة ورائجة</Text>
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={s.compactScroll}
                    style={{ marginBottom: 20 }}
                  >
                    {newTools.map(tool => (
                      <CompactToolCard key={tool.id} tool={tool} theme={theme} />
                    ))}
                  </ScrollView>
                </>
              )}

              {/* Latest posts */}
              {latestPosts.length > 0 && (
                <>
                  <View style={s.subHeader}>
                    <MaterialIcons name="article" size={14} color="#3B82F6" />
                    <Text style={[s.subHeaderText, { color: theme.textSecondary }]}>أحدث المنشورات</Text>
                    <Pressable onPress={() => { Haptics.selectionAsync(); router.push('/news' as any); }}>
                      <Text style={[s.subHeaderAction, { color: theme.primary }]}>الكل</Text>
                    </Pressable>
                  </View>
                  <View style={s.recentPostsList}>
                    {latestPosts.map(post => (
                      <RecentPostRow key={post.id} post={post} theme={theme} />
                    ))}
                  </View>
                </>
              )}
            </View>

            {/* ── Stats Bar ── */}
            <Animated.View entering={FadeInDown.duration(400).delay(200)} style={[s.statsBar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={s.statItem}>
                <Text style={[s.statVal, { color: theme.primary }]}>+{tools.length}</Text>
                <Text style={[s.statLabel, { color: theme.textMuted }]}>أداة ذكية</Text>
              </View>
              <View style={[s.statDivider, { backgroundColor: theme.border }]} />
              <View style={s.statItem}>
                <Text style={[s.statVal, { color: theme.primary }]}>{MOCK_POSTS.length}</Text>
                <Text style={[s.statLabel, { color: theme.textMuted }]}>مقال</Text>
              </View>
              <View style={[s.statDivider, { backgroundColor: theme.border }]} />
              <View style={s.statItem}>
                <Text style={[s.statVal, { color: theme.primary }]}>+15K</Text>
                <Text style={[s.statLabel, { color: theme.textMuted }]}>مستخدم</Text>
              </View>
            </Animated.View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const createStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  centered: { alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 12, fontSize: 14, fontFamily: 'Cairo_400Regular' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6,
  },
  logo: { fontSize: 24, fontFamily: 'Cairo_700Bold', fontWeight: '800', letterSpacing: -0.3 },
  tagline: { fontSize: 12, fontFamily: 'Cairo_400Regular', marginTop: 1 },
  notifBtn: {
    width: 44, height: 44, borderRadius: 22, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', position: 'relative',
  },
  notifBadge: {
    position: 'absolute', top: -3, right: -3, minWidth: 16, height: 16,
    borderRadius: 8, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
  },
  notifBadgeText: { fontSize: 9, fontWeight: '700', color: '#FFF' },

  // Search
  searchWrap: { paddingHorizontal: 16, paddingVertical: 10 },

  // Search results
  searchResultsHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginBottom: 12, padding: 12,
    borderRadius: 12, borderWidth: 1,
  },
  searchResultsText: { fontSize: 13, fontFamily: 'Cairo_500Medium' },
  searchCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 16, marginBottom: 8, padding: 12,
    borderRadius: 14, borderWidth: 1,
  },
  searchIconBg: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  searchInfo: { flex: 1, gap: 3 },
  searchName: { fontSize: 14, fontFamily: 'Cairo_700Bold' },
  searchDesc: { fontSize: 12, fontFamily: 'Cairo_400Regular' },
  searchMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  searchMetaText: { fontSize: 11, fontFamily: 'Cairo_400Regular' },
  searchMetaDot: { fontSize: 10 },
  emptyBox: { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyTitle: { fontSize: 16, fontFamily: 'Cairo_600SemiBold' },
  emptyHint: { fontSize: 13, fontFamily: 'Cairo_400Regular' },

  // Category pills
  catRow: { marginBottom: 6 },
  catScroll: { paddingHorizontal: 16, gap: 8 },
  catPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 9999, borderWidth: 1,
  },
  catPillText: { fontSize: 12, fontFamily: 'Cairo_600SemiBold' },

  // Smart Feed section
  feedSection: { marginTop: 20 },
  aiChip: { marginHorizontal: 16, marginBottom: 16, borderRadius: 10, overflow: 'hidden' },
  aiChipGrad: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8 },
  aiChipText: { fontSize: 12, fontFamily: 'Cairo_400Regular', flex: 1 },

  showMoreBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginHorizontal: 16, marginTop: 4, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5,
  },
  showMoreText: { fontSize: 13, fontFamily: 'Cairo_600SemiBold' },

  // Explore More section
  exploreSection: { marginTop: 24, borderTopWidth: 1, paddingTop: 24 },
  subHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, marginBottom: 12,
  },
  subHeaderText: { fontSize: 13, fontFamily: 'Cairo_600SemiBold', flex: 1 },
  subHeaderAction: { fontSize: 12, fontFamily: 'Cairo_600SemiBold' },
  compactScroll: { paddingHorizontal: 16, gap: 10 },
  recentPostsList: { paddingHorizontal: 16 },

  // Stats bar
  statsBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginHorizontal: 16, marginTop: 24, paddingVertical: 18,
    borderRadius: 16, borderWidth: 1,
  },
  statItem: { flex: 1, alignItems: 'center', gap: 2 },
  statVal: { fontSize: 22, fontFamily: 'Cairo_700Bold', fontWeight: '800' },
  statLabel: { fontSize: 11, fontFamily: 'Cairo_500Medium' },
  statDivider: { width: 1, height: 28 },
});

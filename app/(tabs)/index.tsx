import React, { useMemo } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, Dimensions } from 'react-native';
const SCREEN_WIDTH = Dimensions.get('window').width;
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import { useNotifications } from '../../contexts/NotificationsContext';
import { config } from '../../constants/config';
import { MOCK_POSTS, POST_CATEGORIES, formatPostDate } from '../../services/postsService';
import { useAppContext } from '../../contexts/AppContext';
import ToolCard from '../../components/ToolCard';
import SearchBar from '../../components/SearchBar';

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { theme } = useTheme();
  const {
    searchQuery, setSearchQuery, tools, loading,
    getTrendingTools, getNewTools, getEditorPicks, getRecommendedTools, getPersonalizedRecommendations,
    savedToolIds, votedToolIds,
  } = useAppContext();
  const { unreadCount } = useNotifications();

  const trending = useMemo(() => getTrendingTools(), [getTrendingTools]);
  const newTools = useMemo(() => getNewTools(), [getNewTools]);
  const editorPicks = useMemo(() => getEditorPicks(), [getEditorPicks]);
  const recommended = useMemo(() => getRecommendedTools(), [getRecommendedTools]);
  const personalized = useMemo(() => getPersonalizedRecommendations(), [getPersonalizedRecommendations]);
  const hasInteractions = savedToolIds.length > 0 || votedToolIds.length > 0;

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

  const categoryIconMap: Record<string, string> = {
    'كتابة بالذكاء': 'edit', 'أدوات الصور': 'image', 'أدوات البيانات': 'analytics',
    'أدوات المطورين': 'code', 'أدوات مالية': 'account-balance', 'الإنتاجية': 'task-alt',
    'التصميم': 'palette', 'التسويق': 'campaign',
  };

  if (loading) {
    return (
      <SafeAreaView edges={['top']} style={[s.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={s.container}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: insets.bottom + 16 }} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <View>
            <Text style={s.logo}>مستر جيشو</Text>
            <Text style={s.tagline}>منصتك العربية لأدوات الذكاء الاصطناعي</Text>
          </View>
          <Pressable style={s.notifButton} onPress={() => { Haptics.selectionAsync(); router.push('/(tabs)/notifications'); }}>
            <MaterialIcons name={unreadCount > 0 ? 'notifications' : 'notifications-none'} size={24} color={unreadCount > 0 ? theme.primary : theme.textSecondary} />
            {unreadCount > 0 ? (
              <View style={[s.notifBadge, { backgroundColor: '#EF4444' }]}>
                <Text style={s.notifBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        <View style={s.searchRow}><SearchBar value={searchQuery} onChangeText={setSearchQuery} /></View>

        {isSearching ? (
          <View style={s.section}>
            <Text style={s.sectionTitle}>{filteredTools.length} نتيجة لـ "{searchQuery}"</Text>
            <View style={s.verticalList}>
              {filteredTools.map(tool => <ToolCard key={tool.id} tool={tool} variant="vertical" />)}
              {filteredTools.length === 0 && (
                <View style={s.emptySearch}>
                  <MaterialIcons name="search-off" size={48} color={theme.textMuted} />
                  <Text style={s.emptyText}>لم يتم العثور على أدوات</Text>
                  <Text style={s.emptySubtext}>جرّب كلمات مفتاحية مختلفة</Text>
                </View>
              )}
            </View>
          </View>
        ) : (
          <>
            {/* ── Category Grid ── */}
            <View style={s.catGridSection}>
              <View style={s.sectionHeader}>
                <View style={s.sectionTitleRow}>
                  <MaterialIcons name="category" size={20} color={theme.primary} />
                  <Text style={s.sectionTitle}>تصفح الفئات</Text>
                </View>
              </View>
              <View style={s.catGrid}>
                {POST_CATEGORIES.map((cat, i) => (
                  <Pressable
                    key={cat.id}
                    onPress={() => { Haptics.selectionAsync(); router.push({ pathname: '/news', params: { category: cat.id } } as any); }}
                    style={[s.catGridItem, { backgroundColor: cat.color + '12', borderColor: cat.color + '30' }]}
                  >
                    <View style={[s.catGridIconBg, { backgroundColor: cat.color + '20' }]}>
                      <MaterialIcons name={cat.icon as any} size={30} color={cat.color} />
                    </View>
                    <Text style={[s.catGridLabel, { color: cat.color }]}>{cat.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <Pressable style={s.heroBanner}>
              <Image source={require('../../assets/images/hero-banner.png')} style={StyleSheet.absoluteFill} contentFit="cover" />
              <LinearGradient colors={['transparent', theme.background + 'D9', theme.background + 'FA']} style={StyleSheet.absoluteFill} />
              <View style={s.heroContent}>
                <View style={s.heroBadge}>
                  <MaterialIcons name="auto-awesome" size={12} color={theme.primary} />
                  <Text style={s.heroBadgeText}>مميز</Text>
                </View>
                <Text style={s.heroTitle}>أدوات ذكاء اصطناعي لكل سير عمل</Text>
                <Text style={s.heroSubtitle}>اكتشف +{tools.length} أداة عبر {config.categories.length} فئات</Text>
              </View>
            </Pressable>

            <View style={s.chipContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipScroll}>
                {config.categories.map(cat => (
                  <Pressable key={cat} style={[s.chip, { borderColor: (theme.categoryColors[cat] || theme.primary) + '50' }]}
                    onPress={() => { Haptics.selectionAsync(); router.push('/explore'); }}>
                    <MaterialIcons name={(categoryIconMap[cat] || 'category') as any} size={14} color={theme.categoryColors[cat] || theme.primary} />
                    <Text style={[s.chipText, { color: theme.categoryColors[cat] || theme.primary }]}>{cat}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            <View style={s.section}>
              <View style={s.sectionHeader}>
                <View style={s.sectionTitleRow}>
                  <MaterialIcons name="local-fire-department" size={22} color={theme.trending} />
                  <Text style={s.sectionTitle}>الأكثر رواجاً الآن</Text>
                </View>
                <Pressable onPress={() => router.push('/explore')}><Text style={s.seeAll}>عرض الكل</Text></Pressable>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.horizontalScroll}>
                {trending.map((tool, idx) => <ToolCard key={tool.id} tool={tool} variant="horizontal" width={260} index={idx} />)}
              </ScrollView>
            </View>

            <View style={s.section}>
              <View style={s.sectionHeader}>
                <View style={s.sectionTitleRow}>
                  <MaterialIcons name="verified" size={20} color={theme.primary} />
                  <Text style={s.sectionTitle}>اختيارات المحرر</Text>
                </View>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.horizontalScroll}>
                {editorPicks.map((tool, idx) => <ToolCard key={tool.id} tool={tool} variant="horizontal" width={260} index={idx} />)}
              </ScrollView>
            </View>

            {newTools.length > 0 && (
              <View style={s.section}>
                <View style={s.sectionHeader}>
                  <View style={s.sectionTitleRow}>
                    <MaterialIcons name="fiber-new" size={22} color={theme.accent} />
                    <Text style={s.sectionTitle}>جديد هذا الأسبوع</Text>
                  </View>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.horizontalScroll}>
                  {newTools.map((tool, idx) => <ToolCard key={tool.id} tool={tool} variant="compact" width={160} index={idx} />)}
                </ScrollView>
              </View>
            )}

            {/* Personalized Recommendations — multiple groups */}
            {hasInteractions && personalized.groups.length > 0 ? (
              personalized.groups.slice(0, 3).map((group, gIdx) => (
                <View key={group.tag} style={s.section}>
                  <View style={s.sectionHeader}>
                    <View style={s.sectionTitleRow}>
                      <MaterialIcons name="auto-awesome" size={18} color="#A78BFA" />
                      <Text style={s.sectionTitle} numberOfLines={1}>
                        لأنك أحببت{' '}
                        <Text style={{ color: '#A78BFA' }}>{group.tag}</Text>
                      </Text>
                    </View>
                    {gIdx === 0 && (
                      <Pressable onPress={() => router.push('/explore' as any)}>
                        <Text style={s.seeAll}>عرض الكل</Text>
                      </Pressable>
                    )}
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.horizontalScroll}>
                    {group.tools.slice(0, 8).map((tool, idx) => (
                      <ToolCard key={tool.id} tool={tool} variant="horizontal" width={240} index={idx} />
                    ))}
                  </ScrollView>
                </View>
              ))
            ) : (
              /* Fallback: single section for non-interacted users */
              <View style={s.section}>
                <View style={s.sectionHeader}>
                  <View style={s.sectionTitleRow}>
                    <MaterialIcons name="recommend" size={22} color="#A78BFA" />
                    <Text style={s.sectionTitle}>اقتراحات AI لك</Text>
                  </View>
                  <Pressable onPress={() => router.push('/explore' as any)}>
                    <Text style={s.seeAll}>عرض الكل</Text>
                  </Pressable>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.horizontalScroll}>
                  {recommended.slice(0, 8).map((tool, idx) => (
                    <ToolCard key={tool.id} tool={tool} variant="horizontal" width={240} index={idx} />
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Tags Explorer shortcut */}
            <Pressable style={[s.section, { paddingHorizontal: 16 }]} onPress={() => { Haptics.selectionAsync(); router.push('/tags' as any); }}>
              <LinearGradient
                colors={[theme.primary + '18', '#A78BFA18']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={s.tagsShortcut}
              >
                <View style={[s.tagsShortcutIcon, { backgroundColor: theme.primary + '20' }]}>
                  <MaterialIcons name="tag" size={22} color={theme.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.tagsShortcutTitle}>استكشاف بالوسوم</Text>
                  <Text style={s.tagsShortcutSub}>تصفح الأدوات عبر الوسوم الأكثر شيوعاً</Text>
                </View>
                <MaterialIcons name="arrow-back" size={18} color={theme.primary} />
              </LinearGradient>
            </Pressable>

            {/* AI Picks vertical list */}
            {!hasInteractions && (
              <View style={s.section}>
                <View style={s.sectionHeader}>
                  <View style={s.sectionTitleRow}>
                    <MaterialIcons name="psychology" size={22} color="#A78BFA" />
                    <Text style={s.sectionTitle}>أفضل الأدوات تقييماً</Text>
                  </View>
                </View>
                <View style={s.verticalList}>
                  {recommended.slice(0, 5).map((tool, idx) => <ToolCard key={tool.id} tool={tool} variant="vertical" index={idx} />)}
                </View>
              </View>
            )}

                    {/* ── News Section ── */}
            <View style={s.section}>
              <View style={s.sectionHeader}>
                <View style={s.sectionTitleRow}>
                  <MaterialIcons name="article" size={20} color={theme.primary} />
                  <Text style={s.sectionTitle}>المنشورات والأخبار</Text>
                </View>
                <Pressable onPress={() => { Haptics.selectionAsync(); router.push('/news' as any); }}>
                  <Text style={s.seeAll}>عرض الكل</Text>
                </Pressable>
              </View>

              {/* Category Icons Row */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 10, paddingBottom: 4 }} style={{ marginBottom: 14 }}>
                {POST_CATEGORIES.map((cat, i) => (
                  <Pressable
                    key={cat.id}
                    onPress={() => { Haptics.selectionAsync(); router.push({ pathname: '/news', params: { category: cat.id } } as any); }}
                    style={[s.newsCatBtn, { backgroundColor: cat.color + '14', borderColor: cat.color + '35' }]}
                  >
                    <View style={[s.newsCatIconBg, { backgroundColor: cat.color + '22' }]}>
                      <MaterialIcons name={cat.icon as any} size={20} color={cat.color} />
                    </View>
                    <Text style={[s.newsCatEmoji]}>{cat.emoji}</Text>
                    <Text style={[s.newsCatLabel, { color: cat.color }]}>{cat.label}</Text>
                  </Pressable>
                ))}
              </ScrollView>

              {/* Latest 3 posts */}
              <View style={{ paddingHorizontal: 16, gap: 10 }}>
                {MOCK_POSTS.slice(0, 3).map(post => (
                  <Pressable
                    key={post.id}
                    onPress={() => { Haptics.selectionAsync(); router.push(`/post/${post.id}` as any); }}
                    style={[s.newsPostCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
                  >
                    <View style={[s.newsPostEmoji, { backgroundColor: post.categoryColor + '15', borderColor: post.categoryColor + '25' }]}>
                      <Text style={{ fontSize: 22 }}>{post.emoji}</Text>
                    </View>
                    <View style={{ flex: 1, gap: 4 }}>
                      <View style={[s.newsPostCat, { backgroundColor: post.categoryColor + '18' }]}>
                        <MaterialIcons name={post.categoryIcon as any} size={10} color={post.categoryColor} />
                        <Text style={[s.newsPostCatText, { color: post.categoryColor }]}>{POST_CATEGORIES.find(c => c.id === post.category)?.label}</Text>
                      </View>
                      <Text style={[s.newsPostTitle, { color: theme.textPrimary }]} numberOfLines={2}>{post.title}</Text>
                      <Text style={[s.newsPostMeta, { color: theme.textMuted }]}>{post.readTime} دق · {post.views.toLocaleString('ar-EG')} مشاهدة</Text>
                    </View>
                    <MaterialIcons name="arrow-back" size={16} color={theme.textMuted} />
                  </Pressable>
                ))}
              </View>

              {/* See all posts button */}
              <Pressable
                onPress={() => { Haptics.selectionAsync(); router.push('/news' as any); }}
                style={[s.newsAllBtn, { borderColor: theme.primary + '40', backgroundColor: theme.primary + '10', marginHorizontal: 16, marginTop: 10 }]}
              >
                <MaterialIcons name="feed" size={16} color={theme.primary} />
                <Text style={[s.newsAllBtnText, { color: theme.primary }]}>استعرض جميع المنشورات ({MOCK_POSTS.length})</Text>
                <MaterialIcons name="arrow-back" size={14} color={theme.primary} />
              </Pressable>
            </View>

            <View style={s.statsBar}>
              <View style={s.statItem}><Text style={s.statValue}>+{tools.length}</Text><Text style={s.statLabel}>أداة ذكية</Text></View>
              <View style={s.statDivider} />
              <View style={s.statItem}><Text style={s.statValue}>{config.categories.length}</Text><Text style={s.statLabel}>فئات</Text></View>
              <View style={s.statDivider} />
              <View style={s.statItem}><Text style={s.statValue}>+15K</Text><Text style={s.statLabel}>مستخدمين</Text></View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  logo: { fontSize: 26, fontWeight: '800', fontFamily: 'Cairo_700Bold', color: theme.textPrimary, letterSpacing: -0.5 },
  tagline: { fontSize: 13, fontFamily: 'Cairo_400Regular', color: theme.textMuted, marginTop: 1 },
  notifButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.border, position: 'relative' },
  notifBadge: { position: 'absolute', top: -2, right: -2, minWidth: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  notifBadgeText: { fontSize: 9, fontWeight: '700', color: '#FFF' },
  searchRow: { paddingHorizontal: 16, paddingVertical: 12 },
  heroBanner: { marginHorizontal: 16, height: 180, borderRadius: 16, overflow: 'hidden', justifyContent: 'flex-end', marginBottom: 8 },
  heroContent: { padding: 16 },
  heroBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: theme.primary + '20', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999, alignSelf: 'flex-start', marginBottom: 8 },
  heroBadgeText: { fontSize: 11, fontFamily: 'Cairo_700Bold', color: theme.primary, letterSpacing: 0.5 },
  heroTitle: { fontSize: 22, fontWeight: '800', fontFamily: 'Cairo_700Bold', color: theme.textPrimary, marginBottom: 4, textAlign: 'left' },
  heroSubtitle: { fontSize: 13, fontFamily: 'Cairo_400Regular', color: theme.textSecondary, textAlign: 'left' },
  chipContainer: { marginTop: 4, marginBottom: 8 },
  chipScroll: { paddingHorizontal: 16, gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 9999, backgroundColor: theme.surface, borderWidth: 1 },
  chipText: { fontSize: 12, fontFamily: 'Cairo_600SemiBold' },
  section: { marginTop: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { fontSize: 18, fontWeight: '700', fontFamily: 'Cairo_700Bold', color: theme.textPrimary },
  seeAll: { fontSize: 13, fontFamily: 'Cairo_600SemiBold', color: theme.primary },
  horizontalScroll: { paddingHorizontal: 16, gap: 12 },
  verticalList: { paddingHorizontal: 16, gap: 12 },

  tagsShortcut: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14, borderRadius: 14,
    borderWidth: 1, borderColor: theme.primary + '30',
  },
  tagsShortcutIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tagsShortcutTitle: { fontSize: 15, fontFamily: 'Cairo_700Bold', color: theme.textPrimary },
  tagsShortcutSub: { fontSize: 12, fontFamily: 'Cairo_400Regular', color: theme.textMuted, marginTop: 2 },
  statsBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginHorizontal: 16, marginTop: 28, paddingVertical: 20, backgroundColor: theme.surface, borderRadius: 16, borderWidth: 1, borderColor: theme.border },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '700', fontFamily: 'Cairo_700Bold', color: theme.primary },
  statLabel: { fontSize: 11, fontFamily: 'Cairo_500Medium', color: theme.textMuted, marginTop: 2, letterSpacing: 0.5 },
  statDivider: { width: 1, height: 32, backgroundColor: theme.border },
  emptySearch: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyText: { fontSize: 16, fontFamily: 'Cairo_600SemiBold', color: theme.textSecondary },
  emptySubtext: { fontSize: 13, fontFamily: 'Cairo_400Regular', color: theme.textMuted },

  // Category Grid
  catGridSection: { marginTop: 16, marginBottom: 4 },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 10 },
  catGridItem: {
    width: (SCREEN_WIDTH - 32 - 30) / 4,
    borderRadius: 16, borderWidth: 1,
    alignItems: 'center', paddingVertical: 14, paddingHorizontal: 4, gap: 8,
  },
  catGridIconBg: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  catGridLabel: { fontSize: 11, fontFamily: 'Cairo_600SemiBold', textAlign: 'center', lineHeight: 16 },

  // News section
  newsCatBtn: {
    alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 12,
    borderRadius: 16, borderWidth: 1, minWidth: 72,
  },
  newsCatIconBg: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  newsCatEmoji: { fontSize: 10, position: 'absolute', top: 8, right: 8 },
  newsCatLabel: { fontSize: 11, fontFamily: 'Cairo_600SemiBold', textAlign: 'center' },
  newsPostCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12, borderRadius: 14, borderWidth: 1,
  },
  newsPostEmoji: { width: 50, height: 50, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  newsPostCat: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 9999, alignSelf: 'flex-start' },
  newsPostCatText: { fontSize: 10, fontFamily: 'Cairo_600SemiBold' },
  newsPostTitle: { fontSize: 13, fontFamily: 'Cairo_600SemiBold', lineHeight: 20 },
  newsPostMeta: { fontSize: 10, fontFamily: 'Cairo_400Regular' },
  newsAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1.5, justifyContent: 'center' },
  newsAllBtnText: { fontSize: 14, fontFamily: 'Cairo_600SemiBold', flex: 1, textAlign: 'center' },
});

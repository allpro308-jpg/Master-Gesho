import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeIn, useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../contexts/ThemeContext';
import { useAppContext } from '../contexts/AppContext';
import ToolCard from '../components/ToolCard';

// ── Types ────────────────────────────────────────────────────────────────────
interface TagInfo {
  tag: string;
  count: number;
  weight: number; // 1–5 (font size tier)
  color: string;
}

type ModeType = 'OR' | 'AND';

const TAG_COLORS = [
  '#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444',
  '#06B6D4', '#EC4899', '#14B8A6', '#F97316', '#6366F1',
];

// ── Tag Font Helpers ──────────────────────────────────────────────────────────
const tagFontSize = (weight: number) => {
  switch (weight) {
    case 5: return 22;
    case 4: return 18;
    case 3: return 15;
    case 2: return 13;
    default: return 11;
  }
};

const tagPaddingH = (weight: number) => {
  switch (weight) {
    case 5: return 18;
    case 4: return 14;
    case 3: return 12;
    default: return 10;
  }
};

// ── Mode Toggle ───────────────────────────────────────────────────────────────
function ModeToggle({ mode, onChange }: { mode: ModeType; onChange: (m: ModeType) => void }) {
  const { theme } = useTheme();
  return (
    <View style={[modeS.container, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      {(['OR', 'AND'] as ModeType[]).map(m => {
        const active = mode === m;
        return (
          <Pressable
            key={m}
            onPress={() => { onChange(m); Haptics.selectionAsync(); }}
            style={[modeS.tab, active && { backgroundColor: theme.primary }]}
          >
            <Text style={[modeS.label, active ? { color: '#FFF', fontFamily: 'Cairo_700Bold' } : { color: theme.textSecondary }]}>
              {m === 'OR' ? 'أو (OR)' : 'و (AND)'}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const modeS = StyleSheet.create({
  container: {
    flexDirection: 'row', borderRadius: 10, borderWidth: 1, overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  tab: { paddingHorizontal: 14, paddingVertical: 7 },
  label: { fontSize: 12, fontFamily: 'Cairo_500Medium' },
});

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function TagsScreen() {
  const { theme } = useTheme();
  const { tools } = useAppContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const s = useMemo(() => createStyles(theme), [theme]);

  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagSearch, setTagSearch] = useState('');
  const [mode, setMode] = useState<ModeType>('OR');

  // ── Build tag cloud ──────────────────────────────────────────────────────
  const tagData = useMemo<TagInfo[]>(() => {
    const counts: Record<string, number> = {};
    tools.forEach(tool => {
      tool.tags.forEach(tag => { counts[tag] = (counts[tag] || 0) + 1; });
    });

    const sorted = Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 80);

    if (sorted.length === 0) return [];

    const maxCount = sorted[0][1];
    const minCount = sorted[sorted.length - 1][1];

    return sorted.map(([tag, count], i) => {
      const normalised = maxCount === minCount ? 0.5 : (count - minCount) / (maxCount - minCount);
      const weight = Math.round(normalised * 4) + 1;
      return { tag, count, weight, color: TAG_COLORS[i % TAG_COLORS.length] };
    });
  }, [tools]);

  // ── Filtered tag cloud by search ─────────────────────────────────────────
  const visibleTags = useMemo(() => {
    const q = tagSearch.trim().toLowerCase();
    if (!q) return tagData;
    return tagData.filter(t => t.tag.toLowerCase().includes(q));
  }, [tagData, tagSearch]);

  // ── Filtered tools for selected tags ─────────────────────────────────────
  const filteredTools = useMemo(() => {
    if (selectedTags.length === 0) return [];
    if (mode === 'AND') {
      return tools.filter(t => selectedTags.every(tag => t.tags.includes(tag)));
    }
    // OR
    return tools.filter(t => selectedTags.some(tag => t.tags.includes(tag)));
  }, [tools, selectedTags, mode]);

  const handleTagPress = useCallback((tag: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedTags(prev => {
      if (prev.includes(tag)) return prev.filter(t => t !== tag);
      return [...prev, tag];
    });
  }, []);

  const clearAll = useCallback(() => {
    setSelectedTags([]);
    setTagSearch('');
    Haptics.selectionAsync();
  }, []);

  const removeTag = useCallback((tag: string) => {
    Haptics.selectionAsync();
    setSelectedTags(prev => prev.filter(t => t !== tag));
  }, []);

  const colorOf = (tag: string) => tagData.find(t => t.tag === tag)?.color || theme.primary;

  return (
    <SafeAreaView edges={['top']} style={s.container}>
      {/* ── Header ── */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <MaterialIcons name="arrow-forward" size={22} color={theme.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>استكشاف بالوسوم</Text>
          <Text style={s.headerSub}>{tagData.length} وسم · {tools.length} أداة</Text>
        </View>
        {selectedTags.length > 0 && (
          <Pressable onPress={clearAll} style={s.clearBtn}>
            <MaterialIcons name="close" size={15} color={theme.error} />
            <Text style={[s.clearBtnText, { color: theme.error }]}>مسح</Text>
          </Pressable>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>

        {/* ── Search Bar ── */}
        <View style={s.searchSection}>
          <View style={[s.searchBar, tagSearch.length > 0 && { borderColor: theme.primary }]}>
            <MaterialIcons name="search" size={18} color={tagSearch.length > 0 ? theme.primary : theme.textMuted} />
            <TextInput
              style={[s.searchInput, { color: theme.textPrimary }]}
              value={tagSearch}
              onChangeText={setTagSearch}
              placeholder="ابحث في الوسوم..."
              placeholderTextColor={theme.textMuted}
              textAlign="right"
              autoCorrect={false}
            />
            {tagSearch.length > 0 && (
              <Pressable onPress={() => setTagSearch('')} hitSlop={8}>
                <View style={s.searchClear}>
                  <MaterialIcons name="close" size={12} color={theme.textMuted} />
                </View>
              </Pressable>
            )}
          </View>
          {/* Results count for search */}
          {tagSearch.length > 0 && (
            <Animated.View entering={FadeIn.duration(200)}>
              <Text style={s.searchResultCount}>
                {visibleTags.length} وسم من {tagData.length}
              </Text>
            </Animated.View>
          )}
        </View>

        {/* ── Selected Tags Strip ── */}
        {selectedTags.length > 0 && (
          <Animated.View entering={FadeInDown.duration(300)} style={s.selectedStrip}>
            <View style={s.selectedStripHeader}>
              <View style={s.selectedStripLeft}>
                <MaterialIcons name="filter-list" size={16} color={theme.primary} />
                <Text style={[s.selectedStripTitle, { color: theme.primary }]}>
                  {selectedTags.length} وسوم محددة
                </Text>
              </View>
              {/* AND / OR Toggle */}
              {selectedTags.length > 1 && (
                <ModeToggle mode={mode} onChange={setMode} />
              )}
            </View>

            {/* Selected tags pills */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.selectedPills}>
              {selectedTags.map(tag => {
                const color = colorOf(tag);
                return (
                  <Pressable
                    key={tag}
                    onPress={() => removeTag(tag)}
                    style={[s.selectedPill, { backgroundColor: color, borderColor: color }]}
                  >
                    <Text style={s.selectedPillText}>#{tag}</Text>
                    <MaterialIcons name="close" size={13} color="#FFF" />
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Combined results summary */}
            {selectedTags.length > 1 && (
              <LinearGradient
                colors={[theme.primary + '15', theme.primary + '05']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={s.resultSummary}
              >
                <MaterialIcons name="apps" size={16} color={theme.primary} />
                <Text style={s.resultSummaryText}>
                  <Text style={{ color: theme.primary, fontFamily: 'Cairo_700Bold' }}>{filteredTools.length} أداة </Text>
                  {mode === 'AND' ? 'تحتوي على جميع الوسوم المحددة' : 'تحتوي على وسم واحد على الأقل'}
                </Text>
              </LinearGradient>
            )}
          </Animated.View>
        )}

        {/* ── Tag Cloud ── */}
        <View style={s.cloudSection}>
          <View style={s.sectionHeaderRow}>
            <MaterialIcons name="tag" size={20} color={theme.primary} />
            <Text style={s.sectionTitle}>
              {tagSearch.length > 0 ? `نتائج البحث (${visibleTags.length})` : 'الوسوم الأكثر استخداماً'}
            </Text>
          </View>
          {!tagSearch && (
            <Text style={s.cloudHint}>
              {selectedTags.length === 0
                ? 'انقر على وسم لعرض الأدوات المرتبطة به · حدد أكثر من وسم للتصفية المركّبة'
                : `حدّد وسوماً إضافية لتضييق النتائج (${mode === 'AND' ? 'يجب توفر كل الوسوم' : 'كفاية وسم واحد'})`}
            </Text>
          )}

          {visibleTags.length === 0 ? (
            <View style={s.noTagsState}>
              <MaterialIcons name="search-off" size={36} color={theme.textMuted} />
              <Text style={s.noTagsText}>لا توجد وسوم تطابق "{tagSearch}"</Text>
            </View>
          ) : (
            <Animated.View entering={FadeIn.duration(400)} style={s.tagCloud}>
              {visibleTags.map((item, index) => {
                const isSelected = selectedTags.includes(item.tag);
                return (
                  <Animated.View
                    key={item.tag}
                    entering={FadeInDown.duration(300).delay(Math.min(index * 12, 400))}
                  >
                    <Pressable
                      onPress={() => handleTagPress(item.tag)}
                      style={[
                        s.tagChip,
                        {
                          paddingHorizontal: tagPaddingH(item.weight),
                          paddingVertical: item.weight >= 4 ? 9 : 6,
                          borderColor: item.color + (isSelected ? 'FF' : '50'),
                          backgroundColor: isSelected ? item.color : item.color + '12',
                          borderWidth: isSelected ? 2 : 1.5,
                        },
                      ]}
                    >
                      {isSelected && (
                        <MaterialIcons name="check" size={tagFontSize(item.weight) - 2} color="#FFF" />
                      )}
                      <Text
                        style={[
                          s.tagChipText,
                          {
                            fontSize: tagFontSize(item.weight),
                            color: isSelected ? '#FFF' : item.color,
                            fontFamily:
                              item.weight >= 4
                                ? 'Cairo_700Bold'
                                : item.weight === 3
                                ? 'Cairo_600SemiBold'
                                : 'Cairo_500Medium',
                          },
                        ]}
                      >
                        #{item.tag}
                      </Text>
                      {/* Count badge */}
                      {(isSelected || item.weight >= 4) && (
                        <View
                          style={[
                            s.tagCountBadge,
                            { backgroundColor: isSelected ? '#FFFFFF35' : item.color + '25' },
                          ]}
                        >
                          <Text
                            style={[
                              s.tagCountText,
                              { color: isSelected ? '#FFF' : item.color },
                            ]}
                          >
                            {item.count}
                          </Text>
                        </View>
                      )}
                    </Pressable>
                  </Animated.View>
                );
              })}
            </Animated.View>
          )}
        </View>

        {/* ── Results Section ── */}
        {selectedTags.length > 0 && (
          <Animated.View entering={FadeInDown.duration(350)} style={s.resultsSection}>
            {/* Header */}
            <View style={s.resultHeader}>
              <View style={s.resultTitleRow}>
                {selectedTags.slice(0, 3).map(tag => (
                  <View
                    key={tag}
                    style={[s.resultTagBadge, { backgroundColor: colorOf(tag) + '20' }]}
                  >
                    <Text style={[s.resultTagText, { color: colorOf(tag) }]}>#{tag}</Text>
                  </View>
                ))}
                {selectedTags.length > 3 && (
                  <Text style={[s.resultTagText, { color: theme.textMuted }]}>+{selectedTags.length - 3}</Text>
                )}
              </View>
              <Text style={s.resultCount}>{filteredTools.length} أداة</Text>
            </View>

            {filteredTools.length === 0 ? (
              <View style={s.emptyState}>
                <MaterialIcons
                  name={mode === 'AND' ? 'join-inner' : 'search-off'}
                  size={40}
                  color={theme.textMuted}
                />
                <Text style={s.emptyText}>
                  {mode === 'AND'
                    ? 'لا توجد أدوات تحتوي على جميع هذه الوسوم معاً'
                    : 'لا توجد أدوات بهذه الوسوم'}
                </Text>
                <Pressable
                  onPress={() => setMode(mode === 'AND' ? 'OR' : 'AND')}
                  style={[s.switchModeBtn, { borderColor: theme.primary + '40', backgroundColor: theme.primary + '10' }]}
                >
                  <Text style={[s.switchModeBtnText, { color: theme.primary }]}>
                    جرّب وضع {mode === 'AND' ? 'OR (أو)' : 'AND (و)'}
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View style={s.toolsList}>
                {filteredTools.map((tool, idx) => (
                  <Animated.View
                    key={tool.id}
                    entering={FadeInDown.duration(280).delay(Math.min(idx * 40, 500))}
                  >
                    <ToolCard tool={tool} variant="vertical" />
                  </Animated.View>
                ))}
              </View>
            )}
          </Animated.View>
        )}

        {/* ── Stats when nothing selected ── */}
        {selectedTags.length === 0 && !tagSearch && (
          <View style={s.statsSection}>
            <Text style={s.statsSectionTitle}>أكثر الوسوم انتشاراً</Text>
            <View style={s.statsGrid}>
              {tagData.slice(0, 6).map((item, idx) => (
                <Pressable
                  key={item.tag}
                  style={[s.statCard, { borderColor: item.color + '30' }]}
                  onPress={() => handleTagPress(item.tag)}
                >
                  <Animated.View entering={FadeInDown.duration(300).delay(idx * 60)}>
                    <View style={[s.statBar, { backgroundColor: item.color + '20' }]}>
                      <View
                        style={[
                          s.statBarFill,
                          {
                            backgroundColor: item.color,
                            width: `${Math.round((item.count / tagData[0].count) * 100)}%` as any,
                          },
                        ]}
                      />
                    </View>
                    <Text style={[s.statTag, { color: item.color }]}>#{item.tag}</Text>
                    <Text style={s.statCount}>{item.count} أداة</Text>
                  </Animated.View>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: theme.border, gap: 10,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: theme.border,
  },
  headerTitle: {
    fontSize: 18, fontWeight: '700', fontFamily: 'Cairo_700Bold',
    color: theme.textPrimary,
  },
  headerSub: {
    fontSize: 11, fontFamily: 'Cairo_400Regular',
    color: theme.textMuted, marginTop: 1,
  },
  clearBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: 9999,
    backgroundColor: theme.error + '10', borderWidth: 1, borderColor: theme.error + '30',
  },
  clearBtnText: { fontSize: 12, fontFamily: 'Cairo_600SemiBold' },

  // Search
  searchSection: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: theme.surface, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1.5, borderColor: theme.border,
  },
  searchInput: {
    flex: 1, fontSize: 14, fontFamily: 'Cairo_400Regular',
    height: 24, writingDirection: 'rtl',
  },
  searchClear: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: theme.border, alignItems: 'center', justifyContent: 'center',
  },
  searchResultCount: {
    fontSize: 11, fontFamily: 'Cairo_400Regular', color: theme.textMuted,
    textAlign: 'right', marginTop: 6, marginBottom: 2,
  },

  // Selected strip
  selectedStrip: {
    marginHorizontal: 16, marginTop: 12, marginBottom: 4,
    backgroundColor: theme.surface, borderRadius: 14,
    borderWidth: 1, borderColor: theme.primary + '30',
    padding: 12, gap: 10,
  },
  selectedStripHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  selectedStripLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  selectedStripTitle: { fontSize: 13, fontFamily: 'Cairo_700Bold' },
  selectedPills: { gap: 8, paddingBottom: 2 },
  selectedPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 9999, borderWidth: 1,
  },
  selectedPillText: { fontSize: 12, fontFamily: 'Cairo_700Bold', color: '#FFF' },
  resultSummary: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10,
    borderWidth: 1, borderColor: theme.primary + '20',
  },
  resultSummaryText: {
    fontSize: 13, fontFamily: 'Cairo_500Medium', color: theme.textSecondary, flex: 1,
  },

  // Cloud
  cloudSection: { paddingHorizontal: 16, paddingTop: 16 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  sectionTitle: { fontSize: 17, fontFamily: 'Cairo_700Bold', color: theme.textPrimary },
  cloudHint: {
    fontSize: 12, fontFamily: 'Cairo_400Regular', color: theme.textMuted,
    marginBottom: 14, lineHeight: 18,
  },
  noTagsState: { alignItems: 'center', paddingVertical: 28, gap: 8 },
  noTagsText: { fontSize: 14, fontFamily: 'Cairo_500Medium', color: theme.textMuted },

  tagCloud: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center',
    backgroundColor: theme.surface, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: theme.border,
  },
  tagChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 9999 },
  tagChipText: { letterSpacing: 0.2 },
  tagCountBadge: {
    minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5,
    alignItems: 'center', justifyContent: 'center',
  },
  tagCountText: { fontSize: 10, fontFamily: 'Cairo_700Bold' },

  // Results
  resultsSection: { paddingHorizontal: 16, paddingTop: 20 },
  resultHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 6,
  },
  resultTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', flex: 1 },
  resultTagBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 9999 },
  resultTagText: { fontSize: 13, fontFamily: 'Cairo_700Bold' },
  resultCount: {
    fontSize: 13, fontFamily: 'Cairo_600SemiBold', color: theme.textMuted, flexShrink: 0,
  },
  toolsList: { gap: 12 },
  emptyState: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyText: {
    fontSize: 14, fontFamily: 'Cairo_500Medium', color: theme.textMuted,
    textAlign: 'center', maxWidth: 280,
  },
  switchModeBtn: {
    paddingHorizontal: 16, paddingVertical: 9, borderRadius: 9999, borderWidth: 1,
  },
  switchModeBtnText: { fontSize: 13, fontFamily: 'Cairo_600SemiBold' },

  // Stats
  statsSection: { paddingHorizontal: 16, paddingTop: 24 },
  statsSectionTitle: {
    fontSize: 15, fontFamily: 'Cairo_700Bold', color: theme.textPrimary, marginBottom: 14,
  },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: {
    width: '47%', backgroundColor: theme.surface,
    borderRadius: 14, padding: 14, borderWidth: 1, gap: 8,
  },
  statBar: { height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 4 },
  statBarFill: { height: '100%', borderRadius: 3 },
  statTag: { fontSize: 13, fontFamily: 'Cairo_700Bold' },
  statCount: { fontSize: 11, fontFamily: 'Cairo_400Regular', color: theme.textMuted },
});

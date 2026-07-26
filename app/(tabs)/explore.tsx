import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, Modal, Switch,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { FlashList } from '@shopify/flash-list';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, { FadeInDown, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import { config } from '../../constants/config';
import { categoryIcons } from '../../services/mockData';
import { useAppContext } from '../../contexts/AppContext';
import ToolCard from '../../components/ToolCard';
import SearchAutocomplete from '../../components/SearchAutocomplete';

const FILTER_STORAGE_KEY = '@explore_filters';

interface FilterState {
  pricing: string[]; // [] = all
  minRating: number; // 0 = all
  newOnly: boolean;
  developer: string; // '' = all
}

const DEFAULT_FILTERS: FilterState = {
  pricing: [],
  minRating: 0,
  newOnly: false,
  developer: '',
};

function isDefaultFilters(f: FilterState) {
  return f.pricing.length === 0 && f.minRating === 0 && !f.newOnly && f.developer === '';
}

function activeFilterCount(f: FilterState) {
  let count = 0;
  if (f.pricing.length > 0) count++;
  if (f.minRating > 0) count++;
  if (f.newOnly) count++;
  if (f.developer !== '') count++;
  return count;
}

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { tools, selectedCategory, setSelectedCategory, searchQuery, setSearchQuery } = useAppContext();
  const router = useRouter();

  const handleSelectTool = useCallback((toolId: string, _name: string) => {
    router.push(`/tool/${toolId}` as any);
    setSearchQuery('');
  }, [router, setSearchQuery]);

  const handleSelectCategory = useCallback((category: string) => {
    setSelectedCategory(category);
    setSearchQuery('');
  }, [setSelectedCategory, setSearchQuery]);
  const [sortBy, setSortBy] = useState('trending');
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [draftFilters, setDraftFilters] = useState<FilterState>(DEFAULT_FILTERS);

  // Load persisted filters on mount
  useEffect(() => {
    AsyncStorage.getItem(FILTER_STORAGE_KEY).then(raw => {
      if (raw) {
        try { setFilters(JSON.parse(raw)); } catch {}
      }
    });
  }, []);

  const persistFilters = useCallback((f: FilterState) => {
    AsyncStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(f));
  }, []);

  const allCategories = ['الكل', ...config.categories];
  const s = useMemo(() => createStyles(theme), [theme]);

  // Unique developers list
  const developerList = useMemo(() => {
    const names = [...new Set(tools.map(t => t.developerName))].sort();
    return names;
  }, [tools]);

  const filtered = useMemo(() => {
    let result = selectedCategory === 'الكل' ? [...tools] : tools.filter(t => t.category === selectedCategory);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t =>
        t.name.toLowerCase().includes(q) ||
        t.shortDescription.toLowerCase().includes(q) ||
        t.tags.some(tag => tag.toLowerCase().includes(q))
      );
    }
    // Pricing filter
    if (filters.pricing.length > 0) {
      result = result.filter(t => filters.pricing.includes(t.pricing));
    }
    // Rating filter
    if (filters.minRating > 0) {
      result = result.filter(t => t.rating >= filters.minRating);
    }
    // New only
    if (filters.newOnly) {
      result = result.filter(t => t.isNew);
    }
    // Developer filter
    if (filters.developer !== '') {
      result = result.filter(t => t.developerName === filters.developer);
    }
    // Sort
    switch (sortBy) {
      case 'trending': return result.sort((a, b) => (b.votes * 2 + b.ratingCount) - (a.votes * 2 + a.ratingCount));
      case 'newest': return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      case 'top-rated': return result.sort((a, b) => b.rating - a.rating);
      case 'most-voted': return result.sort((a, b) => b.votes - a.votes);
      default: return result;
    }
  }, [tools, selectedCategory, searchQuery, sortBy, filters]);

  const openFilterModal = useCallback(() => {
    setDraftFilters({ ...filters });
    setShowFilterModal(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [filters]);

  const applyFilters = useCallback(() => {
    setFilters(draftFilters);
    persistFilters(draftFilters);
    setShowFilterModal(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [draftFilters, persistFilters]);

  const resetFilters = useCallback(() => {
    setDraftFilters(DEFAULT_FILTERS);
  }, []);

  const clearAllFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    persistFilters(DEFAULT_FILTERS);
    Haptics.selectionAsync();
  }, [persistFilters]);

  const togglePricing = useCallback((p: string) => {
    setDraftFilters(prev => ({
      ...prev,
      pricing: prev.pricing.includes(p) ? prev.pricing.filter(x => x !== p) : [...prev.pricing, p],
    }));
    Haptics.selectionAsync();
  }, []);

  const activeCount = activeFilterCount(filters);
  const hasActiveFilters = activeCount > 0;

  // Active filter tags for display
  const activeFilterTags = useMemo(() => {
    const tags: { label: string; onRemove: () => void }[] = [];
    if (filters.pricing.length > 0) {
      filters.pricing.forEach(p => tags.push({
        label: p,
        onRemove: () => {
          const next = { ...filters, pricing: filters.pricing.filter(x => x !== p) };
          setFilters(next);
          persistFilters(next);
        },
      }));
    }
    if (filters.minRating > 0) {
      tags.push({
        label: `${filters.minRating}★+`,
        onRemove: () => { const next = { ...filters, minRating: 0 }; setFilters(next); persistFilters(next); },
      });
    }
    if (filters.newOnly) {
      tags.push({
        label: 'جديد',
        onRemove: () => { const next = { ...filters, newOnly: false }; setFilters(next); persistFilters(next); },
      });
    }
    if (filters.developer !== '') {
      tags.push({
        label: filters.developer,
        onRemove: () => { const next = { ...filters, developer: '' }; setFilters(next); persistFilters(next); },
      });
    }
    return tags;
  }, [filters, persistFilters]);

  const isListView = !!(searchQuery.trim() || selectedCategory !== 'الكل' || hasActiveFilters);

  return (
    <SafeAreaView edges={['top']} style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>تصفح</Text>
        <Text style={s.subtitle}>{tools.length} أداة عبر {config.categories.length} فئات</Text>
      </View>
      <View style={[s.searchRow, { zIndex: 100 }]}>
        <View style={{ flex: 1 }}>
          <SearchAutocomplete
            value={searchQuery}
            onChangeText={setSearchQuery}
            tools={tools}
            onSelectTool={handleSelectTool}
            onSelectCategory={handleSelectCategory}
            placeholder="ابحث عن الأدوات والفئات..."
          />
        </View>
        <Pressable onPress={openFilterModal} style={[s.filterBtn, hasActiveFilters && { backgroundColor: theme.primary, borderColor: theme.primary }]}>
          <MaterialIcons name="tune" size={20} color={hasActiveFilters ? '#FFF' : theme.textSecondary} />
          {activeCount > 0 && (
            <View style={s.filterBadge}>
              <Text style={s.filterBadgeText}>{activeCount}</Text>
            </View>
          )}
        </Pressable>
      </View>

      {/* Active filter tags */}
      {activeFilterTags.length > 0 && (
        <Animated.View entering={FadeInDown.duration(250)}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.activeTagsRow}>
            <Pressable onPress={clearAllFilters} style={s.clearAllBtn}>
              <MaterialIcons name="close" size={12} color={theme.error} />
              <Text style={[s.clearAllText, { color: theme.error }]}>مسح الكل</Text>
            </Pressable>
            {activeFilterTags.map(tag => (
              <Pressable key={tag.label} onPress={() => { tag.onRemove(); Haptics.selectionAsync(); }} style={s.activeTag}>
                <Text style={s.activeTagText}>{tag.label}</Text>
                <MaterialIcons name="close" size={12} color={theme.primary} />
              </Pressable>
            ))}
          </ScrollView>
        </Animated.View>
      )}

      {!isListView ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}>
          <View style={s.categoryGrid}>
            {config.categories.map(cat => {
              const color = theme.categoryColors[cat] || theme.primary;
              const count = tools.filter(t => t.category === cat).length;
              return (
                <Pressable key={cat} style={[s.categoryCard, { borderColor: color + '30' }]}
                  onPress={() => { Haptics.selectionAsync(); setSelectedCategory(cat); }}>
                  <View style={[s.categoryIcon, { backgroundColor: color + '20' }]}>
                    <MaterialIcons name={categoryIcons[cat] as any} size={22} color={color} />
                  </View>
                  <Text style={s.categoryName} numberOfLines={1}>{cat}</Text>
                  <Text style={s.categoryCount}>{count} أداة</Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      ) : (
        <>
          <View style={s.filtersRow}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterChips}>
              {allCategories.map(cat => {
                const active = selectedCategory === cat;
                const color = cat === 'الكل' ? theme.primary : (theme.categoryColors[cat] || theme.primary);
                return (
                  <Pressable key={cat} style={[s.filterChip, active && { backgroundColor: color, borderColor: color }]}
                    onPress={() => { Haptics.selectionAsync(); setSelectedCategory(cat); }}>
                    <Text style={[s.filterChipText, active && { color: '#FFF' }]}>{cat}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
          <View style={s.sortRow}>
            <Text style={s.resultCount}>{filtered.length} أداة</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.sortChips}>
              {config.sortOptions.map(opt => (
                <Pressable key={opt.id} style={[s.sortChip, sortBy === opt.id && { backgroundColor: theme.primary + '20' }]}
                  onPress={() => { Haptics.selectionAsync(); setSortBy(opt.id); }}>
                  <Text style={[s.sortChipText, sortBy === opt.id && { color: theme.primary, fontFamily: 'Cairo_700Bold' }]}>{opt.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
          <View style={{ flex: 1 }}>
            <FlashList
              data={filtered}
              renderItem={({ item }) => <ToolCard tool={item} variant="vertical" />}
              estimatedItemSize={120}
              keyExtractor={item => item.id}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 16 }}
              ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
              ListEmptyComponent={
                <View style={s.emptyState}>
                  <MaterialIcons name="search-off" size={48} color={theme.textMuted} />
                  <Text style={s.emptyTitle}>لم يتم العثور على أدوات</Text>
                  <Text style={s.emptySubtitle}>جرّب تغيير معايير الفلترة</Text>
                </View>
              }
            />
          </View>
        </>
      )}

      {/* Filter Modal */}
      <Modal visible={showFilterModal} transparent animationType="fade" onRequestClose={() => setShowFilterModal(false)}>
        <Pressable style={s.modalOverlay} onPress={() => setShowFilterModal(false)}>
          <Animated.View
            entering={SlideInDown.springify().damping(20).stiffness(200)}
            exiting={SlideOutDown.duration(200)}
            style={[s.modalSheet, { paddingBottom: insets.bottom + 16 }]}
            onStartShouldSetResponder={() => true}
          >
            {/* Modal Header */}
            <View style={s.modalHandle} />
            <View style={s.modalHeader}>
              <Pressable onPress={resetFilters} style={s.modalResetBtn}>
                <Text style={s.modalResetText}>إعادة ضبط</Text>
              </Pressable>
              <Text style={s.modalTitle}>فلترة متقدمة</Text>
              <Pressable onPress={() => setShowFilterModal(false)} style={s.modalCloseBtn}>
                <MaterialIcons name="close" size={20} color={theme.textSecondary} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 480 }}>
              {/* Pricing */}
              <View style={s.filterSection}>
                <Text style={s.filterSectionTitle}>التسعير</Text>
                <View style={s.chipRow}>
                  {config.pricingOptions.map(p => {
                    const selected = draftFilters.pricing.includes(p);
                    return (
                      <Pressable key={p} onPress={() => togglePricing(p)}
                        style={[s.modalChip, selected && { backgroundColor: theme.primary, borderColor: theme.primary }]}>
                        <Text style={[s.modalChipText, selected && { color: '#FFF' }]}>{p}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Min Rating */}
              <View style={s.filterSection}>
                <Text style={s.filterSectionTitle}>الحد الأدنى للتقييم</Text>
                <View style={s.chipRow}>
                  {[0, 3, 4, 4.5].map(r => {
                    const label = r === 0 ? 'الكل' : `${r}★+`;
                    const selected = draftFilters.minRating === r;
                    return (
                      <Pressable key={r} onPress={() => { setDraftFilters(prev => ({ ...prev, minRating: r })); Haptics.selectionAsync(); }}
                        style={[s.modalChip, selected && { backgroundColor: theme.star, borderColor: theme.star }]}>
                        <Text style={[s.modalChipText, selected && { color: '#FFF' }]}>{label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* New Only */}
              <View style={s.filterSection}>
                <View style={s.switchRow}>
                  <View>
                    <Text style={s.filterSectionTitle}>الأدوات الجديدة فقط</Text>
                    <Text style={s.filterSectionSub}>عرض الأدوات المضافة مؤخراً</Text>
                  </View>
                  <Switch
                    value={draftFilters.newOnly}
                    onValueChange={v => { setDraftFilters(prev => ({ ...prev, newOnly: v })); Haptics.selectionAsync(); }}
                    trackColor={{ false: theme.border, true: theme.primary + '70' }}
                    thumbColor={draftFilters.newOnly ? theme.primary : '#F8FAFC'}
                  />
                </View>
              </View>

              {/* Developer */}
              <View style={s.filterSection}>
                <Text style={s.filterSectionTitle}>المطور</Text>
                <View style={s.chipRow}>
                  <Pressable
                    onPress={() => { setDraftFilters(prev => ({ ...prev, developer: '' })); Haptics.selectionAsync(); }}
                    style={[s.modalChip, draftFilters.developer === '' && { backgroundColor: theme.primary, borderColor: theme.primary }]}>
                    <Text style={[s.modalChipText, draftFilters.developer === '' && { color: '#FFF' }]}>الكل</Text>
                  </Pressable>
                  {developerList.map(dev => {
                    const selected = draftFilters.developer === dev;
                    return (
                      <Pressable key={dev}
                        onPress={() => { setDraftFilters(prev => ({ ...prev, developer: prev.developer === dev ? '' : dev })); Haptics.selectionAsync(); }}
                        style={[s.modalChip, selected && { backgroundColor: theme.primary, borderColor: theme.primary }]}>
                        <Text style={[s.modalChipText, selected && { color: '#FFF' }]} numberOfLines={1}>{dev}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </ScrollView>

            {/* Apply Button */}
            <View style={s.modalFooter}>
              <Pressable onPress={applyFilters} style={s.applyBtn}>
                <MaterialIcons name="check" size={18} color="#FFF" />
                <Text style={s.applyBtnText}>
                  تطبيق الفلاتر{activeFilterCount(draftFilters) > 0 ? ` (${activeFilterCount(draftFilters)})` : ''}
                </Text>
              </Pressable>
            </View>
          </Animated.View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  title: { fontSize: 28, fontWeight: '700', fontFamily: 'Cairo_700Bold', color: theme.textPrimary },
  subtitle: { fontSize: 13, fontFamily: 'Cairo_400Regular', color: theme.textMuted, marginTop: 2 },
  searchRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  filterBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' },
  filterBadge: { position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  filterBadgeText: { fontSize: 9, fontWeight: '700', color: '#FFF' },
  activeTagsRow: { paddingHorizontal: 16, paddingBottom: 8, gap: 6, alignItems: 'center' },
  activeTag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 9999, backgroundColor: theme.primary + '15', borderWidth: 1, borderColor: theme.primary + '30' },
  activeTagText: { fontSize: 11, fontFamily: 'Cairo_600SemiBold', color: theme.primary },
  clearAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 9999, backgroundColor: theme.error + '10', borderWidth: 1, borderColor: theme.error + '25' },
  clearAllText: { fontSize: 11, fontFamily: 'Cairo_600SemiBold' },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 10, paddingBottom: 16 },
  categoryCard: { width: '47%', backgroundColor: theme.surface, borderRadius: 12, padding: 16, borderWidth: 1 },
  categoryIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  categoryName: { fontSize: 16, fontWeight: '600', fontFamily: 'Cairo_600SemiBold', color: theme.textPrimary, marginBottom: 2 },
  categoryCount: { fontSize: 11, fontFamily: 'Cairo_500Medium', color: theme.textMuted },
  filtersRow: { marginBottom: 4 },
  filterChips: { paddingHorizontal: 16, gap: 8 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 9999, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border },
  filterChipText: { fontSize: 12, fontFamily: 'Cairo_600SemiBold', color: theme.textSecondary },
  sortRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 12 },
  resultCount: { fontSize: 13, fontFamily: 'Cairo_600SemiBold', color: theme.textMuted },
  sortChips: { gap: 6 },
  sortChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 9999 },
  sortChipText: { fontSize: 11, fontFamily: 'Cairo_500Medium', color: theme.textMuted },
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyTitle: { fontSize: 16, fontFamily: 'Cairo_600SemiBold', color: theme.textSecondary },
  emptySubtitle: { fontSize: 13, fontFamily: 'Cairo_400Regular', color: theme.textMuted },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: '#00000055', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: theme.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 10, paddingHorizontal: 20 },
  modalHandle: { width: 36, height: 4, backgroundColor: theme.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  modalTitle: { fontSize: 17, fontWeight: '700', fontFamily: 'Cairo_700Bold', color: theme.textPrimary },
  modalResetBtn: { paddingHorizontal: 10, paddingVertical: 6 },
  modalResetText: { fontSize: 13, fontFamily: 'Cairo_600SemiBold', color: theme.primary },
  modalCloseBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.backgroundSecondary, alignItems: 'center', justifyContent: 'center' },
  filterSection: { marginBottom: 22 },
  filterSectionTitle: { fontSize: 14, fontFamily: 'Cairo_700Bold', color: theme.textPrimary, marginBottom: 10 },
  filterSectionSub: { fontSize: 11, fontFamily: 'Cairo_400Regular', color: theme.textMuted, marginTop: -6, marginBottom: 0 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  modalChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 9999, backgroundColor: theme.backgroundSecondary, borderWidth: 1.5, borderColor: theme.border, maxWidth: 180 },
  modalChipText: { fontSize: 13, fontFamily: 'Cairo_600SemiBold', color: theme.textSecondary },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalFooter: { paddingTop: 16, borderTopWidth: 1, borderTopColor: theme.border },
  applyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: theme.primary, borderRadius: 14, paddingVertical: 15 },
  applyBtnText: { fontSize: 16, fontFamily: 'Cairo_700Bold', color: '#FFF' },
});

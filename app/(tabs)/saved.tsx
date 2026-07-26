import React, { useMemo, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, TextInput, Modal,
  ScrollView, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import Animated, { FadeInDown, FadeIn, ZoomIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../contexts/ThemeContext';
import { useAppContext } from '../../contexts/AppContext';
import { useAlert } from '@/template';
import ToolCard from '../../components/ToolCard';
import { Tool } from '../../services/mockData';

// ── Types ──────────────────────────────────────────────────────────────────
interface ToolList {
  id: string;
  name: string;
  emoji: string;
  toolIds: string[];
  createdAt: string;
}

const EMOJI_OPTIONS = ['📌', '⭐', '🔥', '💡', '🛠️', '🚀', '💎', '📚', '🎯', '🤖'];

const DEFAULT_LIST: ToolList = {
  id: 'default',
  name: 'المحفوظات',
  emoji: '🔖',
  toolIds: [],
  createdAt: new Date().toISOString(),
};

// ── Component ──────────────────────────────────────────────────────────────
export default function SavedScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { tools, savedToolIds, toggleSaveTool } = useAppContext();
  const { showAlert } = useAlert();
  const s = useMemo(() => createStyles(theme), [theme]);

  // ── State ──────────────────────────────────────────────────────────────
  const [lists, setLists] = useState<ToolList[]>([DEFAULT_LIST]);
  const [activeListId, setActiveListId] = useState<string>('default');

  // New list modal
  const [showNewListModal, setShowNewListModal] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newListEmoji, setNewListEmoji] = useState('📌');

  // Add-to-list modal
  const [showAddToListModal, setShowAddToListModal] = useState(false);
  const [pendingToolId, setPendingToolId] = useState<string | null>(null);

  // Selection mode
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const savedTools = useMemo(
    () => tools.filter(t => savedToolIds.includes(t.id)),
    [tools, savedToolIds],
  );

  const activeList = useMemo(
    () => lists.find(l => l.id === activeListId) || lists[0],
    [lists, activeListId],
  );

  // Tools shown in active list
  const visibleTools = useMemo(() => {
    if (activeListId === 'default') return savedTools;
    return savedTools.filter(t => activeList?.toolIds.includes(t.id));
  }, [activeListId, savedTools, activeList]);

  // ── List Management ───────────────────────────────────────────────────
  const createList = useCallback(() => {
    const name = newListName.trim();
    if (!name) return;
    const newList: ToolList = {
      id: `list_${Date.now()}`,
      name,
      emoji: newListEmoji,
      toolIds: [],
      createdAt: new Date().toISOString(),
    };
    setLists(prev => [...prev, newList]);
    setActiveListId(newList.id);
    setNewListName('');
    setNewListEmoji('📌');
    setShowNewListModal(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [newListName, newListEmoji]);

  const deleteList = useCallback((listId: string) => {
    if (listId === 'default') return;
    showAlert('حذف القائمة', 'هل تريد حذف هذه القائمة؟ لن تُحذف الأدوات من المحفوظات.', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حذف', style: 'destructive', onPress: () => {
          setLists(prev => prev.filter(l => l.id !== listId));
          if (activeListId === listId) setActiveListId('default');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        },
      },
    ]);
  }, [activeListId, showAlert]);

  const addToolToList = useCallback((listId: string, toolId: string) => {
    setLists(prev => prev.map(l =>
      l.id === listId && !l.toolIds.includes(toolId)
        ? { ...l, toolIds: [...l.toolIds, toolId] }
        : l,
    ));
    setShowAddToListModal(false);
    setPendingToolId(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const removeToolFromList = useCallback((toolId: string) => {
    if (activeListId === 'default') {
      // Remove from all saves
      toggleSaveTool(toolId);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      setLists(prev => prev.map(l =>
        l.id === activeListId
          ? { ...l, toolIds: l.toolIds.filter(id => id !== toolId) }
          : l,
      ));
      Haptics.selectionAsync();
    }
  }, [activeListId, toggleSaveTool]);

  // ── Selection Mode ────────────────────────────────────────────────────
  const toggleSelection = useCallback((toolId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(toolId) ? next.delete(toolId) : next.add(toolId);
      Haptics.selectionAsync();
      return next;
    });
  }, []);

  const addSelectionToList = useCallback((listId: string) => {
    setLists(prev => prev.map(l => {
      if (l.id !== listId) return l;
      const merged = [...new Set([...l.toolIds, ...Array.from(selectedIds)])];
      return { ...l, toolIds: merged };
    }));
    setSelectionMode(false);
    setSelectedIds(new Set());
    setShowAddToListModal(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [selectedIds]);

  const cancelSelection = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  // ── Render helpers ────────────────────────────────────────────────────
  const renderToolItem = useCallback(({ item, index }: { item: Tool; index: number }) => {
    const isSelected = selectedIds.has(item.id);
    return (
      <Animated.View entering={FadeInDown.duration(300).delay(index * 40)}>
        <Pressable
          onLongPress={() => {
            setSelectionMode(true);
            toggleSelection(item.id);
          }}
          onPress={() => selectionMode ? toggleSelection(item.id) : undefined}
          style={[s.toolItemWrapper, isSelected && { opacity: 0.85 }]}
        >
          {/* Selection overlay */}
          {selectionMode && (
            <View style={[s.selectionOverlay, isSelected && { backgroundColor: theme.primary + '20' }]}>
              <View style={[s.checkbox, isSelected && { backgroundColor: theme.primary, borderColor: theme.primary }]}>
                {isSelected && <MaterialIcons name="check" size={14} color="#FFF" />}
              </View>
            </View>
          )}

          <ToolCard tool={item} variant="vertical" />

          {/* Action buttons row */}
          {!selectionMode && (
            <View style={s.toolActions}>
              <Pressable
                style={s.toolActionBtn}
                onPress={() => { setPendingToolId(item.id); setShowAddToListModal(true); }}
                hitSlop={6}
              >
                <MaterialIcons name="playlist-add" size={16} color={theme.primary} />
                <Text style={s.toolActionText}>إضافة لقائمة</Text>
              </Pressable>
              <Pressable
                style={[s.toolActionBtn, { borderColor: theme.error + '30', backgroundColor: theme.error + '08' }]}
                onPress={() => removeToolFromList(item.id)}
                hitSlop={6}
              >
                <MaterialIcons
                  name={activeListId === 'default' ? 'bookmark-remove' : 'remove-circle-outline'}
                  size={16}
                  color={theme.error}
                />
                <Text style={[s.toolActionText, { color: theme.error }]}>
                  {activeListId === 'default' ? 'إلغاء الحفظ' : 'إزالة من القائمة'}
                </Text>
              </Pressable>
            </View>
          )}
        </Pressable>
      </Animated.View>
    );
  }, [selectedIds, selectionMode, activeListId, theme, toggleSelection, removeToolFromList]);

  // ── Main UI ───────────────────────────────────────────────────────────
  return (
    <SafeAreaView edges={['top']} style={s.container}>
      {/* Header */}
      <View style={s.header}>
        {selectionMode ? (
          <>
            <Pressable onPress={cancelSelection} style={s.headerBtn}>
              <MaterialIcons name="close" size={20} color={theme.textSecondary} />
            </Pressable>
            <Text style={s.title}>{selectedIds.size} محدد</Text>
            <Pressable
              onPress={() => setShowAddToListModal(true)}
              disabled={selectedIds.size === 0}
              style={[s.headerBtn, { backgroundColor: theme.primary, borderColor: theme.primary, opacity: selectedIds.size === 0 ? 0.4 : 1 }]}
            >
              <MaterialIcons name="playlist-add" size={18} color="#FFF" />
            </Pressable>
          </>
        ) : (
          <>
            <View style={s.headerLeft}>
              <Text style={s.title}>المحفوظات</Text>
              <View style={s.countBadge}>
                <Text style={s.countText}>{savedTools.length}</Text>
              </View>
            </View>
            <Pressable
              onPress={() => { setShowNewListModal(true); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              style={s.newListBtn}
            >
              <MaterialIcons name="create-new-folder" size={18} color={theme.primary} />
              <Text style={s.newListBtnText}>قائمة جديدة</Text>
            </Pressable>
          </>
        )}
      </View>

      {/* Lists Tab Bar */}
      {lists.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.listsBar}
        >
          {lists.map(list => {
            const active = list.id === activeListId;
            const count = list.id === 'default'
              ? savedTools.length
              : savedTools.filter(t => list.toolIds.includes(t.id)).length;
            return (
              <Pressable
                key={list.id}
                onPress={() => { setActiveListId(list.id); Haptics.selectionAsync(); }}
                onLongPress={() => list.id !== 'default' && deleteList(list.id)}
                style={[s.listTab, active && { backgroundColor: theme.primary, borderColor: theme.primary }]}
              >
                <Text style={s.listTabEmoji}>{list.emoji}</Text>
                <Text style={[s.listTabName, active && { color: '#FFF', fontFamily: 'Cairo_700Bold' }]}>
                  {list.name}
                </Text>
                <View style={[s.listTabBadge, active && { backgroundColor: '#FFFFFF30' }]}>
                  <Text style={[s.listTabBadgeText, active && { color: '#FFF' }]}>{count}</Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {/* Long-press hint */}
      {!selectionMode && savedTools.length > 0 && (
        <Animated.View entering={FadeIn.duration(400)} style={s.hintBanner}>
          <MaterialIcons name="touch-app" size={13} color={theme.textMuted} />
          <Text style={s.hintBannerText}>اضغط مطولاً على أداة لتحديدها وإضافتها لقائمة</Text>
        </Animated.View>
      )}

      {/* Tool List */}
      {visibleTools.length > 0 ? (
        <FlashList
          data={visibleTools}
          renderItem={renderToolItem}
          estimatedItemSize={160}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 16, paddingTop: 4 }}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        />
      ) : (
        <View style={s.emptyContainer}>
          {activeListId === 'default' ? (
            <>
              <Image
                source={require('../../assets/images/empty-saved.png')}
                style={s.emptyImage}
                contentFit="contain"
              />
              <Text style={s.emptyTitle}>لا توجد أدوات محفوظة بعد</Text>
              <Text style={s.emptySubtitle}>
                انقر على أيقونة الإشارة المرجعية على أي أداة لحفظها للوصول السريع لاحقاً
              </Text>
              <View style={s.hintRow}>
                <MaterialIcons name="bookmark-border" size={18} color={theme.primary} />
                <Text style={s.hintText}>ابحث عن هذه الأيقونة على بطاقات الأدوات</Text>
              </View>
            </>
          ) : (
            <>
              <View style={s.emptyListIconBg}>
                <Text style={{ fontSize: 40 }}>{activeList?.emoji}</Text>
              </View>
              <Text style={s.emptyTitle}>القائمة فارغة</Text>
              <Text style={s.emptySubtitle}>
                احفظ أدوات وأضفها لهذه القائمة عبر زر "إضافة لقائمة"
              </Text>
              <Pressable
                style={[s.emptyActionBtn, { backgroundColor: theme.primary }]}
                onPress={() => setActiveListId('default')}
              >
                <MaterialIcons name="apps" size={16} color="#FFF" />
                <Text style={s.emptyActionText}>عرض كل المحفوظات</Text>
              </Pressable>
            </>
          )}
        </View>
      )}

      {/* ── New List Modal ── */}
      <Modal
        visible={showNewListModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowNewListModal(false)}
      >
        <Pressable style={s.modalOverlay} onPress={() => setShowNewListModal(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ width: '100%' }}>
            <Animated.View
              entering={FadeInDown.springify().damping(20).stiffness(180)}
              style={[s.modalSheet, { paddingBottom: insets.bottom + 20 }]}
              onStartShouldSetResponder={() => true}
            >
              <View style={s.modalHandle} />
              <Text style={s.modalTitle}>إنشاء قائمة جديدة</Text>

              {/* Emoji Picker */}
              <Text style={s.modalLabel}>اختر أيقونة</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.emojiRow}>
                {EMOJI_OPTIONS.map(e => (
                  <Pressable
                    key={e}
                    onPress={() => { setNewListEmoji(e); Haptics.selectionAsync(); }}
                    style={[s.emojiBtn, newListEmoji === e && { backgroundColor: theme.primary + '25', borderColor: theme.primary }]}
                  >
                    <Text style={s.emojiText}>{e}</Text>
                  </Pressable>
                ))}
              </ScrollView>

              {/* List Name Input */}
              <Text style={s.modalLabel}>اسم القائمة</Text>
              <View style={[s.modalInput, newListName.length > 0 && { borderColor: theme.primary }]}>
                <Text style={s.modalInputEmoji}>{newListEmoji}</Text>
                <TextInput
                  style={[s.modalInputText, { color: theme.textPrimary }]}
                  value={newListName}
                  onChangeText={setNewListName}
                  placeholder="مثال: أدوات التصميم المفضلة"
                  placeholderTextColor={theme.textMuted}
                  textAlign="right"
                  maxLength={30}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={createList}
                />
              </View>

              <Pressable
                onPress={createList}
                disabled={!newListName.trim()}
                style={[s.modalCreateBtn, !newListName.trim() && { opacity: 0.5 }]}
              >
                <LinearGradientFallback color={theme.primary}>
                  <MaterialIcons name="add" size={20} color="#FFF" />
                  <Text style={s.modalCreateBtnText}>إنشاء القائمة</Text>
                </LinearGradientFallback>
              </Pressable>
            </Animated.View>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      {/* ── Add to List Modal ── */}
      <Modal
        visible={showAddToListModal}
        transparent
        animationType="slide"
        onRequestClose={() => { setShowAddToListModal(false); setPendingToolId(null); }}
      >
        <Pressable
          style={s.modalOverlay}
          onPress={() => { setShowAddToListModal(false); setPendingToolId(null); }}
        >
          <Animated.View
            entering={FadeInDown.springify().damping(20).stiffness(180)}
            style={[s.modalSheet, { paddingBottom: insets.bottom + 20 }]}
            onStartShouldSetResponder={() => true}
          >
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>
              {selectionMode
                ? `إضافة ${selectedIds.size} أدوات إلى قائمة`
                : 'إضافة إلى قائمة'}
            </Text>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 320 }}>
              {lists.filter(l => l.id !== 'default').length === 0 ? (
                <View style={s.noListsHint}>
                  <MaterialIcons name="folder-open" size={36} color={theme.textMuted} />
                  <Text style={s.noListsText}>لا توجد قوائم بعد</Text>
                  <Text style={s.noListsSubText}>أنشئ قائمة أولاً لتنظيم أدواتك</Text>
                </View>
              ) : (
                lists.filter(l => l.id !== 'default').map(list => {
                  const alreadyIn = pendingToolId ? list.toolIds.includes(pendingToolId) : false;
                  return (
                    <Pressable
                      key={list.id}
                      onPress={() => {
                        if (selectionMode) addSelectionToList(list.id);
                        else if (pendingToolId) addToolToList(list.id, pendingToolId);
                      }}
                      style={({ pressed }) => [
                        s.listPickerItem,
                        pressed && { backgroundColor: theme.backgroundSecondary },
                        alreadyIn && { opacity: 0.5 },
                      ]}
                      disabled={alreadyIn}
                    >
                      <Text style={s.listPickerEmoji}>{list.emoji}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={s.listPickerName}>{list.name}</Text>
                        <Text style={s.listPickerCount}>
                          {alreadyIn ? 'موجودة بالفعل' : `${list.toolIds.length} أداة`}
                        </Text>
                      </View>
                      {alreadyIn ? (
                        <MaterialIcons name="check-circle" size={20} color={theme.primary} />
                      ) : (
                        <MaterialIcons name="add-circle-outline" size={20} color={theme.primary} />
                      )}
                    </Pressable>
                  );
                })
              )}
            </ScrollView>

            {/* Create new list shortcut */}
            <Pressable
              onPress={() => {
                setShowAddToListModal(false);
                setPendingToolId(null);
                setTimeout(() => setShowNewListModal(true), 300);
              }}
              style={s.createListShortcut}
            >
              <View style={[s.createListShortcutIcon, { backgroundColor: theme.primary + '15' }]}>
                <MaterialIcons name="create-new-folder" size={20} color={theme.primary} />
              </View>
              <Text style={[s.createListShortcutText, { color: theme.primary }]}>إنشاء قائمة جديدة</Text>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

// Simple gradient wrapper fallback (uses View with primary color)
function LinearGradientFallback({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: color, borderRadius: 14, paddingVertical: 15 }}>
      {children}
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 26, fontWeight: '700', fontFamily: 'Cairo_700Bold', color: theme.textPrimary },
  countBadge: { backgroundColor: theme.primary + '20', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 9999 },
  countText: { fontSize: 12, fontFamily: 'Cairo_700Bold', color: theme.primary },
  headerBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border,
    alignItems: 'center', justifyContent: 'center',
  },
  newListBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
    backgroundColor: theme.primary + '12', borderWidth: 1, borderColor: theme.primary + '30',
  },
  newListBtnText: { fontSize: 13, fontFamily: 'Cairo_600SemiBold', color: theme.primary },

  // Lists bar
  listsBar: { paddingHorizontal: 16, paddingBottom: 10, gap: 8, alignItems: 'center' },
  listTab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 9999,
    backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border,
  },
  listTabEmoji: { fontSize: 14 },
  listTabName: { fontSize: 13, fontFamily: 'Cairo_600SemiBold', color: theme.textSecondary },
  listTabBadge: {
    minWidth: 20, height: 20, borderRadius: 10,
    backgroundColor: theme.backgroundSecondary, paddingHorizontal: 5,
    alignItems: 'center', justifyContent: 'center',
  },
  listTabBadgeText: { fontSize: 10, fontFamily: 'Cairo_700Bold', color: theme.textMuted },

  // Hint banner
  hintBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginHorizontal: 16, marginBottom: 8, paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: theme.surface, borderRadius: 8, borderWidth: 1, borderColor: theme.border,
  },
  hintBannerText: { fontSize: 11, fontFamily: 'Cairo_400Regular', color: theme.textMuted, flex: 1 },

  // Tool item
  toolItemWrapper: { position: 'relative' },
  selectionOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 10, borderRadius: 14, alignItems: 'flex-end',
    padding: 12, borderWidth: 2, borderColor: theme.primary + '40',
  },
  checkbox: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 2, borderColor: theme.border,
    backgroundColor: theme.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  toolActions: {
    flexDirection: 'row', gap: 8, marginTop: 6, marginBottom: 2,
  },
  toolActionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingVertical: 7, borderRadius: 9, borderWidth: 1,
    borderColor: theme.primary + '30', backgroundColor: theme.primary + '08',
  },
  toolActionText: {
    fontSize: 11, fontFamily: 'Cairo_600SemiBold', color: theme.primary,
  },

  // Empty state
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, paddingBottom: 80 },
  emptyImage: { width: 180, height: 180, marginBottom: 24 },
  emptyListIconBg: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'center', marginBottom: 16,
    borderWidth: 1, borderColor: theme.border,
  },
  emptyTitle: { fontSize: 20, fontFamily: 'Cairo_600SemiBold', color: theme.textPrimary, marginBottom: 8, textAlign: 'center' },
  emptySubtitle: { fontSize: 14, fontFamily: 'Cairo_400Regular', color: theme.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 20 },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.surface, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: theme.border },
  hintText: { fontSize: 13, fontFamily: 'Cairo_400Regular', color: theme.textSecondary },
  emptyActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingVertical: 11, borderRadius: 12 },
  emptyActionText: { fontSize: 14, fontFamily: 'Cairo_600SemiBold', color: '#FFF' },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: '#00000055', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: theme.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 10, paddingHorizontal: 20,
  },
  modalHandle: { width: 36, height: 4, backgroundColor: theme.border, borderRadius: 2, alignSelf: 'center', marginBottom: 18 },
  modalTitle: { fontSize: 18, fontFamily: 'Cairo_700Bold', color: theme.textPrimary, textAlign: 'center', marginBottom: 20 },
  modalLabel: { fontSize: 13, fontFamily: 'Cairo_600SemiBold', color: theme.textSecondary, marginBottom: 10, textAlign: 'right' },

  // New list modal
  emojiRow: { gap: 10, marginBottom: 20, paddingBottom: 4 },
  emojiBtn: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: theme.backgroundSecondary, borderWidth: 1.5, borderColor: theme.border,
  },
  emojiText: { fontSize: 22 },
  modalInput: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: theme.backgroundSecondary, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1.5, borderColor: theme.border, marginBottom: 20,
  },
  modalInputEmoji: { fontSize: 20 },
  modalInputText: { flex: 1, fontSize: 15, fontFamily: 'Cairo_400Regular', writingDirection: 'rtl' },
  modalCreateBtn: { borderRadius: 14, overflow: 'hidden', marginTop: 4 },
  modalCreateBtnText: { fontSize: 16, fontFamily: 'Cairo_700Bold', color: '#FFF' },

  // Add to list modal
  noListsHint: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  noListsText: { fontSize: 16, fontFamily: 'Cairo_600SemiBold', color: theme.textPrimary },
  noListsSubText: { fontSize: 13, fontFamily: 'Cairo_400Regular', color: theme.textMuted },
  listPickerItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  listPickerEmoji: { fontSize: 24, width: 36, textAlign: 'center' },
  listPickerName: { fontSize: 15, fontFamily: 'Cairo_600SemiBold', color: theme.textPrimary },
  listPickerCount: { fontSize: 11, fontFamily: 'Cairo_400Regular', color: theme.textMuted, marginTop: 2 },
  createListShortcut: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginTop: 14, paddingVertical: 14, paddingHorizontal: 4,
    borderTopWidth: 1, borderTopColor: theme.border,
  },
  createListShortcutIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  createListShortcutText: { fontSize: 15, fontFamily: 'Cairo_600SemiBold' },
});

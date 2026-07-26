import React, { useMemo, useCallback, useState, useRef } from 'react';
import {
  View, Text, Pressable, StyleSheet, Animated,
  PanResponder, Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import { useNotifications } from '../../contexts/NotificationsContext';
import { Notification } from '../../services/mockData';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.35;

const NOTIFICATION_ICONS: Record<string, { icon: string; color: string; label: string }> = {
  vote:          { icon: 'arrow-upward',  color: '#F97316', label: 'التصويتات' },
  comment:       { icon: 'comment',        color: '#3B82F6', label: 'التعليقات' },
  tool_approved: { icon: 'check-circle',  color: '#22C55E', label: 'الأدوات'   },
  tool_rejected: { icon: 'cancel',         color: '#EF4444', label: 'الأدوات'   },
  follow:        { icon: 'person-add',     color: '#A78BFA', label: 'المتابعة'  },
};

// ── Swipeable Notification Item ──────────────────────────────────────────────
function SwipeableNotifItem({
  notif,
  onPress,
  onDelete,
}: {
  notif: Notification;
  onPress: (n: Notification) => void;
  onDelete: (id: string) => void;
}) {
  const { theme } = useTheme();
  const translateX = useRef(new Animated.Value(0)).current;
  const deleteOpacity = useRef(new Animated.Value(0)).current;

  const iconInfo = NOTIFICATION_ICONS[notif.type] || { icon: 'notifications', color: '#3B82F6', label: 'أخرى' };

  const timeAgo = useMemo(() => {
    const diff = Date.now() - new Date(notif.createdAt).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'الآن';
    if (mins < 60) return `منذ ${mins} د`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `منذ ${hrs} س`;
    const days = Math.floor(hrs / 24);
    return `منذ ${days} يوم`;
  }, [notif.createdAt]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 10 && Math.abs(gs.dy) < 20,
      onPanResponderMove: (_, gs) => {
        // Only allow left swipe (negative dx in RTL, positive in LTR — using positive for delete direction)
        if (gs.dx < 0) {
          translateX.setValue(gs.dx);
          deleteOpacity.setValue(Math.min(1, Math.abs(gs.dx) / SWIPE_THRESHOLD));
        }
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dx < -SWIPE_THRESHOLD) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          Animated.timing(translateX, { toValue: -SCREEN_WIDTH, duration: 250, useNativeDriver: true }).start(() => {
            onDelete(notif.id);
          });
        } else {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
          Animated.timing(deleteOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  return (
    <View style={s.swipeWrapper}>
      {/* Delete background */}
      <Animated.View style={[s.deleteBackground, { opacity: deleteOpacity }]}>
        <MaterialIcons name="delete-outline" size={26} color="#FFF" />
        <Text style={s.deleteLabel}>حذف</Text>
      </Animated.View>

      <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
        <Pressable
          onPress={() => onPress(notif)}
          style={[
            s.notifCard,
            {
              backgroundColor: notif.isRead ? theme.surface : iconInfo.color + '08',
              borderColor: notif.isRead ? theme.border : iconInfo.color + '30',
            },
          ]}
        >
          {!notif.isRead && <View style={[s.unreadDot, { backgroundColor: iconInfo.color }]} />}
          <View style={[s.notifIcon, { backgroundColor: iconInfo.color + '20' }]}>
            <MaterialIcons name={iconInfo.icon as any} size={22} color={iconInfo.color} />
          </View>
          <View style={s.notifContent}>
            <Text
              style={[
                s.notifTitle,
                { color: theme.textPrimary, fontFamily: notif.isRead ? 'Cairo_500Medium' : 'Cairo_700Bold' },
              ]}
              numberOfLines={1}
            >
              {notif.title}
            </Text>
            <Text style={[s.notifBody, { color: theme.textSecondary }]} numberOfLines={2}>
              {notif.body}
            </Text>
            <Text style={[s.notifTime, { color: theme.textMuted }]}>{timeAgo}</Text>
          </View>
          {notif.toolId ? (
            <MaterialIcons name="chevron-left" size={20} color={theme.textMuted} />
          ) : null}
        </Pressable>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  swipeWrapper: { position: 'relative', marginBottom: 10 },
  deleteBackground: {
    position: 'absolute', top: 0, bottom: 0, right: 0, left: 0,
    backgroundColor: '#EF4444', borderRadius: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end',
    paddingRight: 20, gap: 8,
  },
  deleteLabel: { fontSize: 14, fontFamily: 'Cairo_700Bold', color: '#FFF' },
  notifCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    padding: 14, borderRadius: 14, borderWidth: 1, position: 'relative',
  },
  unreadDot: {
    position: 'absolute', top: 14, right: 14,
    width: 8, height: 8, borderRadius: 4,
  },
  notifIcon: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  notifContent: { flex: 1 },
  notifTitle: { fontSize: 14, marginBottom: 3 },
  notifBody: { fontSize: 13, fontFamily: 'Cairo_400Regular', lineHeight: 20, textAlign: 'right' },
  notifTime: { fontSize: 11, fontFamily: 'Cairo_400Regular', marginTop: 6 },
});

// ── Group separator ──────────────────────────────────────────────────────────
function GroupHeader({ label, count, color }: { label: string; count: number; color: string }) {
  const { theme } = useTheme();
  return (
    <View style={[gh.row, { borderColor: color + '30', backgroundColor: color + '10' }]}>
      <View style={[gh.dot, { backgroundColor: color }]} />
      <Text style={[gh.label, { color: theme.textPrimary }]}>{label}</Text>
      <View style={[gh.badge, { backgroundColor: color + '25' }]}>
        <Text style={[gh.badgeText, { color }]}>{count}</Text>
      </View>
    </View>
  );
}

const gh = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
    borderWidth: 1, marginBottom: 10,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { flex: 1, fontSize: 13, fontFamily: 'Cairo_700Bold' },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999 },
  badgeText: { fontSize: 11, fontFamily: 'Cairo_700Bold' },
});

// ── Type Tab ─────────────────────────────────────────────────────────────────
type FilterType = 'all' | 'vote' | 'comment' | 'follow' | 'tool_approved' | 'tool_rejected';

const TYPE_TABS: { id: FilterType; label: string; icon: string }[] = [
  { id: 'all',          label: 'الكل',     icon: 'notifications' },
  { id: 'vote',         label: 'تصويت',   icon: 'arrow-upward'  },
  { id: 'comment',      label: 'تعليق',   icon: 'comment'       },
  { id: 'follow',       label: 'متابعة',  icon: 'person-add'    },
  { id: 'tool_approved',label: 'مقبول',   icon: 'check-circle'  },
  { id: 'tool_rejected',label: 'مرفوض',   icon: 'cancel'        },
];

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function NotificationsScreen() {
  const { theme } = useTheme();
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const cs = useMemo(() => createStyles(theme), [theme]);

  // Local dismissed set (soft-delete without backend)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  const visibleNotifs = useMemo(
    () => notifications.filter(n => !dismissed.has(n.id)),
    [notifications, dismissed],
  );

  const filteredNotifs = useMemo(() => {
    if (activeFilter === 'all') return visibleNotifs;
    return visibleNotifs.filter(n => n.type === activeFilter);
  }, [visibleNotifs, activeFilter]);

  // Group by type
  type GroupedItem =
    | { type: 'header'; groupKey: string; label: string; count: number; color: string }
    | { type: 'notif'; notif: Notification };

  const listData = useMemo<GroupedItem[]>(() => {
    if (activeFilter !== 'all') {
      return filteredNotifs.map(n => ({ type: 'notif', notif: n }));
    }

    // Group by notification type
    const groups: Record<string, Notification[]> = {};
    filteredNotifs.forEach(n => {
      const key = n.type;
      if (!groups[key]) groups[key] = [];
      groups[key].push(n);
    });

    const result: GroupedItem[] = [];
    Object.entries(groups).forEach(([key, items]) => {
      const info = NOTIFICATION_ICONS[key] || { color: '#3B82F6', label: 'أخرى' };
      result.push({ type: 'header', groupKey: key, label: info.label, count: items.length, color: info.color });
      items.forEach(n => result.push({ type: 'notif', notif: n }));
    });
    return result;
  }, [filteredNotifs, activeFilter]);

  const handleNotifPress = useCallback((notif: Notification) => {
    Haptics.selectionAsync();
    if (!notif.isRead) markRead(notif.id);
    if (notif.toolId) router.push(`/tool/${notif.toolId}` as any);
  }, [markRead, router]);

  const handleDelete = useCallback((id: string) => {
    setDismissed(prev => new Set([...prev, id]));
  }, []);

  const unreadVisible = useMemo(
    () => visibleNotifs.filter(n => !n.isRead).length,
    [visibleNotifs],
  );

  const renderItem = useCallback(({ item }: { item: GroupedItem }) => {
    if (item.type === 'header') {
      return <GroupHeader label={item.label} count={item.count} color={item.color} />;
    }
    return (
      <SwipeableNotifItem
        notif={item.notif}
        onPress={handleNotifPress}
        onDelete={handleDelete}
      />
    );
  }, [handleNotifPress, handleDelete]);

  return (
    <SafeAreaView edges={['top']} style={cs.container}>
      {/* Header */}
      <View style={cs.header}>
        <Pressable onPress={() => router.back()} style={cs.backBtn}>
          <MaterialIcons name="arrow-forward" size={22} color={theme.textPrimary} />
        </Pressable>
        <View style={{ alignItems: 'center' }}>
          <Text style={cs.headerTitle}>الإشعارات</Text>
          {unreadVisible > 0 && (
            <Text style={[cs.unreadLabel, { color: theme.primary }]}>{unreadVisible} غير مقروء</Text>
          )}
        </View>
        {unreadVisible > 0 ? (
          <Pressable onPress={() => { Haptics.selectionAsync(); markAllRead(); }} style={cs.markAllBtn}>
            <MaterialIcons name="done-all" size={16} color={theme.primary} />
            <Text style={cs.markAllText}>قراءة الكل</Text>
          </Pressable>
        ) : (
          <View style={{ width: 80 }} />
        )}
      </View>

      {/* Type Filter Tabs */}
      {visibleNotifs.length > 0 && (
        <View style={{ height: 46 }}>
          <FlashList
            data={TYPE_TABS}
            horizontal
            estimatedItemSize={80}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 6 }}
            renderItem={({ item: tab }) => {
              const active = activeFilter === tab.id;
              const info = NOTIFICATION_ICONS[tab.id] || { color: theme.primary };
              const count = tab.id === 'all'
                ? visibleNotifs.length
                : visibleNotifs.filter(n => n.type === tab.id).length;
              if (count === 0 && tab.id !== 'all') return null;
              return (
                <Pressable
                  key={tab.id}
                  onPress={() => { Haptics.selectionAsync(); setActiveFilter(tab.id); }}
                  style={[
                    cs.typeTab,
                    active && { backgroundColor: (info.color || theme.primary), borderColor: (info.color || theme.primary) },
                    { marginRight: 8 },
                  ]}
                >
                  <MaterialIcons
                    name={tab.icon as any}
                    size={13}
                    color={active ? '#FFF' : theme.textSecondary}
                  />
                  <Text style={[cs.typeTabText, active && { color: '#FFF', fontFamily: 'Cairo_700Bold' }]}>
                    {tab.label}
                  </Text>
                  {count > 0 && (
                    <View style={[cs.typeTabBadge, active && { backgroundColor: '#FFFFFF30' }]}>
                      <Text style={[cs.typeTabBadgeText, active && { color: '#FFF' }]}>{count}</Text>
                    </View>
                  )}
                </Pressable>
              );
            }}
            keyExtractor={item => item.id}
          />
        </View>
      )}

      {/* Swipe hint */}
      {visibleNotifs.length > 0 && (
        <View style={cs.swipeHint}>
          <MaterialIcons name="swipe-left" size={13} color={theme.textMuted} />
          <Text style={cs.swipeHintText}>اسحب يساراً لحذف الإشعار</Text>
        </View>
      )}

      {/* Notifications List */}
      {listData.length === 0 ? (
        <View style={cs.emptyState}>
          <View style={cs.emptyIconBg}>
            <MaterialIcons name="notifications-none" size={48} color={theme.textMuted} />
          </View>
          <Text style={cs.emptyTitle}>
            {activeFilter === 'all' ? 'لا توجد إشعارات' : 'لا توجد إشعارات من هذا النوع'}
          </Text>
          <Text style={cs.emptySub}>
            {activeFilter === 'all'
              ? 'ستظهر هنا الإشعارات عند تفاعل أحدهم مع أدواتك'
              : 'جرّب تصفية أخرى'}
          </Text>
        </View>
      ) : (
        <FlashList
          data={listData}
          renderItem={renderItem}
          estimatedItemSize={90}
          keyExtractor={item => item.type === 'header' ? `header_${item.groupKey}` : item.notif.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: insets.bottom + 24 }}
          showsVerticalScrollIndicator={false}
        />
      )}
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
  unreadLabel: { fontSize: 11, fontFamily: 'Cairo_400Regular', marginTop: 1 },
  markAllBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: 9999,
    backgroundColor: theme.primary + '15',
  },
  markAllText: { fontSize: 12, fontFamily: 'Cairo_600SemiBold', color: theme.primary },

  typeTab: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9999,
    backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border,
  },
  typeTabText: { fontSize: 12, fontFamily: 'Cairo_500Medium', color: theme.textSecondary },
  typeTabBadge: {
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: theme.backgroundSecondary, paddingHorizontal: 4,
    alignItems: 'center', justifyContent: 'center',
  },
  typeTabBadgeText: { fontSize: 10, fontFamily: 'Cairo_700Bold', color: theme.textMuted },

  swipeHint: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    marginHorizontal: 16, marginTop: 6, marginBottom: 4,
    paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: theme.surface, borderRadius: 8,
    borderWidth: 1, borderColor: theme.border,
    alignSelf: 'flex-start',
  },
  swipeHintText: { fontSize: 11, fontFamily: 'Cairo_400Regular', color: theme.textMuted },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 12 },
  emptyIconBg: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  emptyTitle: { fontSize: 20, fontFamily: 'Cairo_600SemiBold', color: theme.textPrimary, textAlign: 'center' },
  emptySub: { fontSize: 14, fontFamily: 'Cairo_400Regular', color: theme.textMuted, textAlign: 'center', lineHeight: 22 },
});

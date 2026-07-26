import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Share, Pressable as RNPressable } from 'react-native';
import { View, Text, ScrollView, Pressable, TextInput, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeInDown, FadeInUp,
  useSharedValue, useAnimatedStyle, withSpring, withSequence,
} from 'react-native-reanimated';
import { useTheme } from '../../contexts/ThemeContext';
import { useAppContext } from '../../contexts/AppContext';
import ToolCard from '../../components/ToolCard';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function ToolDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const {
    getToolById, toggleSaveTool, toggleVoteTool, rateTool, addComment, loadComments,
    isToolSaved, isToolVoted, getUserRating, tools, toolComments,
  } = useAppContext();

  const tool = getToolById(id);
  const [commentText, setCommentText] = useState('');
  const [showAllComments, setShowAllComments] = useState(false);

  const saved = isToolSaved(id);
  const voted = isToolVoted(id);
  const userRating = getUserRating(id);
  const comments = toolComments[id] || [];

  useEffect(() => { if (id) loadComments(id); }, [id, loadComments]);

  const voteScale = useSharedValue(1);
  const saveScale = useSharedValue(1);
  const starScales = [useSharedValue(1), useSharedValue(1), useSharedValue(1), useSharedValue(1), useSharedValue(1)];
  const launchScale = useSharedValue(1);

  const voteAnimStyle = useAnimatedStyle(() => ({ transform: [{ scale: voteScale.value }] }));
  const saveAnimStyle = useAnimatedStyle(() => ({ transform: [{ scale: saveScale.value }] }));
  const launchAnimStyle = useAnimatedStyle(() => ({ transform: [{ scale: launchScale.value }] }));
  const starAnimStyles = starScales.map(s => useAnimatedStyle(() => ({ transform: [{ scale: s.value }] })));

  const relatedTools = useMemo(() => tools.filter(t => t.category === tool?.category && t.id !== id).slice(0, 6), [tools, tool, id]);

  // Rating distribution from all user ratings (approx from ratingCount + rating average)
  const ratingDistribution = useMemo(() => {
    if (!tool) return [];
    // Simulate distribution from avg + count (real data would come from DB)
    const avg = tool.rating;
    const count = tool.ratingCount;
    if (count === 0) return [1, 2, 3, 4, 5].map(s => ({ star: s, count: 0, pct: 0 }));
    // Weight distribution around the average
    const weights: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const gaussianWeight = (star: number) => Math.exp(-0.5 * Math.pow((star - avg) / 0.9, 2));
    const totalW = [1, 2, 3, 4, 5].reduce((acc, s) => acc + gaussianWeight(s), 0);
    [1, 2, 3, 4, 5].forEach(s => { weights[s] = Math.round((gaussianWeight(s) / totalW) * count); });
    const maxCount = Math.max(...Object.values(weights), 1);
    return [5, 4, 3, 2, 1].map(s => ({
      star: s, count: weights[s], pct: Math.round((weights[s] / maxCount) * 100),
    }));
  }, [tool]);

  const recommendationPct = useMemo(() => {
    if (!tool || tool.ratingCount === 0) return 0;
    return Math.round(Math.min(100, Math.max(0, ((tool.rating - 1) / 4) * 100)));
  }, [tool]);
  const s = useMemo(() => createStyles(theme), [theme]);

  if (!tool) {
    return (
      <SafeAreaView edges={['top']} style={[s.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <MaterialIcons name="error-outline" size={48} color={theme.textMuted} />
        <Text style={{ color: theme.textSecondary, marginTop: 12, fontSize: 16, fontFamily: 'Cairo_400Regular' }}>الأداة غير موجودة</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: theme.primary, fontSize: 16, fontFamily: 'Cairo_600SemiBold' }}>رجوع</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const catColor = theme.categoryColors[tool.category] || theme.primary;
  const displayedComments = showAllComments ? comments : comments.slice(0, 3);

  const handleSubmitComment = useCallback(() => {
    if (!commentText.trim()) return;
    addComment(id, commentText.trim());
    setCommentText('');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [commentText, id, addComment]);

  const handleRate = useCallback((rating: number) => {
    const idx = rating - 1;
    starScales[idx].value = withSequence(withSpring(1.5, { damping: 8, stiffness: 400 }), withSpring(0.9, { damping: 8, stiffness: 400 }), withSpring(1, { damping: 10, stiffness: 300 }));
    rateTool(id, rating);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [id, rateTool]);

  const handleVotePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    voteScale.value = withSequence(withSpring(1.3, { damping: 8, stiffness: 400 }), withSpring(0.85, { damping: 8, stiffness: 400 }), withSpring(1, { damping: 10, stiffness: 300 }));
    toggleVoteTool(id);
  }, [id, toggleVoteTool]);

  const handleShare = useCallback(async () => {
    Haptics.selectionAsync();
    try {
      await Share.share({
        title: tool?.name || '',
        message: `${tool?.name}\n${tool?.shortDescription}${tool?.url ? '\n' + tool.url : ''}`,
        url: tool?.url || undefined,
      });
    } catch {}
  }, [tool]);

  const handleSavePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    saveScale.value = withSequence(withSpring(1.4, { damping: 8, stiffness: 400 }), withSpring(0.85, { damping: 8, stiffness: 400 }), withSpring(1, { damping: 10, stiffness: 300 }));
    toggleSaveTool(id);
  }, [id, toggleSaveTool]);

  return (
    <SafeAreaView edges={['top']} style={s.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 100 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={s.topBar}>
            <Pressable onPress={() => router.back()} style={s.backButton}>
              <MaterialIcons name="arrow-forward" size={22} color={theme.textPrimary} />
            </Pressable>
            <View style={s.topActions}>
              <Animated.View style={saveAnimStyle}>
                <Pressable onPress={handleSavePress} style={s.topAction}>
                  <MaterialIcons name={saved ? 'bookmark' : 'bookmark-border'} size={22} color={saved ? theme.primary : theme.textSecondary} />
                </Pressable>
              </Animated.View>
              <Pressable onPress={handleShare} style={s.topAction}>
                <MaterialIcons name="share" size={22} color={theme.textSecondary} />
              </Pressable>
            </View>
          </View>

          <Animated.View entering={FadeInDown.duration(400)} style={s.heroSection}>
            <View style={[s.logoHero, { backgroundColor: tool.logoColor + '20' }]}>
              <MaterialIcons name={tool.logoIcon as any} size={40} color={tool.logoColor} />
            </View>
            <Text style={s.toolName}>{tool.name}</Text>
            <View style={s.metaRow}>
              <View style={[s.categoryBadgeLarge, { backgroundColor: catColor + '20' }]}><Text style={[s.categoryTextLarge, { color: catColor }]}>{tool.category}</Text></View>
              <View style={[s.pricingBadgeLarge, { backgroundColor: tool.pricing === 'مجاني' ? theme.accent + '20' : tool.pricing === 'مفتوح المصدر' ? theme.primary + '20' : theme.warning + '20' }]}>
                <Text style={[s.pricingTextLarge, { color: tool.pricing === 'مجاني' ? theme.accent : tool.pricing === 'مفتوح المصدر' ? theme.primary : theme.warning }]}>{tool.pricing}</Text>
              </View>
            </View>
            <Pressable onPress={() => router.push(`/developer/${encodeURIComponent(tool.developerName)}` as any)}>
              <Text style={[s.developerName, { color: theme.primary, textDecorationLine: 'underline' }]}>بواسطة {tool.developerName}</Text>
            </Pressable>
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(400).delay(100)} style={s.statsSection}>
            <View style={s.statBox}><MaterialIcons name="star" size={20} color={theme.star} /><Text style={s.statBoxValue}>{tool.rating}</Text><Text style={s.statBoxLabel}>{tool.ratingCount} تقييم</Text></View>
            <View style={s.statDivider} />
            <View style={s.statBox}><MaterialIcons name="arrow-upward" size={20} color={theme.upvote} /><Text style={s.statBoxValue}>{tool.votes}</Text><Text style={s.statBoxLabel}>تصويت</Text></View>
            <View style={s.statDivider} />
            <View style={s.statBox}><MaterialIcons name="comment" size={20} color={theme.primary} /><Text style={s.statBoxValue}>{comments.length}</Text><Text style={s.statBoxLabel}>تعليق</Text></View>
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(400).delay(200)} style={s.actionsRow}>
            <AnimatedPressable style={[s.voteButtonLarge, voted && { backgroundColor: theme.upvote, borderColor: theme.upvote }, voteAnimStyle]} onPress={handleVotePress}>
              <MaterialIcons name="arrow-upward" size={22} color={voted ? '#FFF' : theme.upvote} />
              <Text style={[s.voteButtonText, voted && { color: '#FFF' }]}>{voted ? 'تم التصويت' : 'صوّت'} · {tool.votes}</Text>
            </AnimatedPressable>
            <AnimatedPressable style={[s.launchButton, launchAnimStyle]}
              onPressIn={() => { launchScale.value = withSpring(0.95, { damping: 15, stiffness: 300 }); }}
              onPressOut={() => { launchScale.value = withSpring(1, { damping: 15, stiffness: 300 }); }}>
              <LinearGradient colors={[theme.primary, theme.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.launchGradient}>
                <MaterialIcons name="launch" size={18} color="#FFF" /><Text style={s.launchText}>زيارة الأداة</Text>
              </LinearGradient>
            </AnimatedPressable>
          </Animated.View>

          <View style={s.descSection}>
            <Text style={s.sectionTitle}>نبذة</Text>
            <Text style={s.description}>{tool.description}</Text>
            <View style={s.tagsRow}>{tool.tags.map(tag => <View key={tag} style={s.tag}><Text style={s.tagText}>#{tag}</Text></View>)}</View>
          </View>

          <View style={s.screenshotSection}>
            <Text style={[s.sectionTitle, { paddingHorizontal: 16 }]}>لقطات الشاشة</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.screenshotScroll}>
              {tool.screenshots.map((ss, i) => <Image key={i} source={{ uri: ss }} style={s.screenshot} contentFit="cover" />)}
            </ScrollView>
          </View>

          {/* ── Rating Statistics ── */}
          {tool.ratingCount > 0 && (
            <Animated.View entering={FadeInDown.duration(400).delay(250)} style={s.statsSection}>
              <Text style={s.sectionTitle}>إحصائيات التقييم</Text>

              {/* Recommendation badge */}
              <View style={[s.recBadge, { backgroundColor: recommendationPct >= 75 ? '#22C55E15' : '#F59E0B15', borderColor: recommendationPct >= 75 ? '#22C55E40' : '#F59E0B40' }]}>
                <MaterialIcons
                  name={recommendationPct >= 75 ? 'thumb-up' : 'thumbs-up-down'}
                  size={18}
                  color={recommendationPct >= 75 ? '#22C55E' : '#F59E0B'}
                />
                <Text style={[s.recPct, { color: recommendationPct >= 75 ? '#22C55E' : '#F59E0B' }]}>
                  {recommendationPct}% يوصون بهذه الأداة
                </Text>
              </View>

              {/* Bar chart */}
              <View style={s.barChart}>
                {ratingDistribution.map(item => (
                  <View key={item.star} style={s.barRow}>
                    <View style={s.barStarRow}>
                      <Text style={s.barStar}>{item.star}</Text>
                      <MaterialIcons name="star" size={11} color={t.star} />
                    </View>
                    <View style={s.barBg}>
                      <View
                        style={[
                          s.barFill,
                          {
                            width: `${item.pct}%` as any,
                            backgroundColor: item.star >= 4 ? '#22C55E' : item.star === 3 ? '#F59E0B' : '#EF4444',
                          },
                        ]}
                      />
                    </View>
                    <Text style={s.barCount}>{item.count}</Text>
                  </View>
                ))}
              </View>

              {/* Summary row */}
              <View style={s.statsSummaryRow}>
                <View style={s.statsSummaryItem}>
                  <Text style={[s.statsSummaryVal, { color: t.star }]}>{tool.rating}</Text>
                  <Text style={s.statsSummaryLabel}>متوسط</Text>
                </View>
                <View style={s.statsSumDivider} />
                <View style={s.statsSummaryItem}>
                  <Text style={[s.statsSummaryVal, { color: t.primary }]}>{tool.ratingCount}</Text>
                  <Text style={s.statsSummaryLabel}>تقييم</Text>
                </View>
                <View style={s.statsSumDivider} />
                <View style={s.statsSummaryItem}>
                  <Text style={[s.statsSummaryVal, { color: '#22C55E' }]}>{recommendationPct}%</Text>
                  <Text style={s.statsSummaryLabel}>توصية</Text>
                </View>
              </View>
            </Animated.View>
          )}

          <Animated.View entering={FadeInUp.duration(400).delay(300)} style={s.rateSection}>
            <Text style={s.sectionTitle}>قيّم هذه الأداة</Text>
            <View style={s.starsRow}>
              {[1, 2, 3, 4, 5].map((star, idx) => (
                <Animated.View key={star} style={starAnimStyles[idx]}>
                  <Pressable onPress={() => handleRate(star)} hitSlop={6}>
                    <MaterialIcons name={star <= userRating ? 'star' : 'star-border'} size={36} color={star <= userRating ? theme.star : theme.textMuted} />
                  </Pressable>
                </Animated.View>
              ))}
            </View>
            {userRating > 0 ? <Text style={s.ratedText}>قيّمت هذه الأداة {userRating}/5</Text> : null}
          </Animated.View>

          <View style={s.commentsSection}>
            <Text style={s.sectionTitle}>التعليقات ({comments.length})</Text>
            <View style={s.commentInput}>
              <TextInput style={s.commentTextInput} placeholder="اكتب تعليقاً..." placeholderTextColor={theme.textMuted} value={commentText} onChangeText={setCommentText} multiline textAlign="right" />
              <Pressable onPress={handleSubmitComment} style={[s.sendButton, !commentText.trim() && { opacity: 0.4 }]} disabled={!commentText.trim()}>
                <MaterialIcons name="send" size={20} color="#FFF" />
              </Pressable>
            </View>
            {displayedComments.map(comment => (
              <View key={comment.id} style={s.commentCard}>
                <View style={s.commentHeader}>
                  <View style={s.commentAvatar}><Text style={s.commentAvatarText}>{comment.userName.split(' ').map(n => n[0]).join('')}</Text></View>
                  <View><Text style={s.commentName}>{comment.userName}</Text><Text style={s.commentDate}>{comment.createdAt}</Text></View>
                </View>
                <Text style={s.commentTextStyle}>{comment.text}</Text>
              </View>
            ))}
            {comments.length > 3 ? (
              <Pressable onPress={() => setShowAllComments(!showAllComments)}>
                <Text style={s.showMoreText}>{showAllComments ? 'عرض أقل' : `عرض جميع التعليقات (${comments.length})`}</Text>
              </Pressable>
            ) : null}
          </View>

          <View style={s.developerSection}>
            <Text style={s.sectionTitle}>المطور</Text>
            <View style={s.developerCard}>
              <View style={s.devAvatar}><Text style={s.devAvatarText}>{tool.developerName.split(' ').map(n => n[0]).join('').slice(0, 2)}</Text></View>
              <View style={s.devInfo}>
                <Pressable onPress={() => router.push(`/developer/${encodeURIComponent(tool.developerName)}` as any)}>
                  <Text style={[s.devName, { color: theme.primary }]}>{tool.developerName}</Text>
                </Pressable>
                <Text style={s.devBio}>{tool.developerBio}</Text>
                <View style={s.devMeta}>
                  <View style={s.devStat}><MaterialIcons name="apps" size={14} color={theme.textMuted} /><Text style={s.devStatText}>{tool.developerToolsCount} أدوات</Text></View>
                  <View style={s.devStat}><MaterialIcons name="people" size={14} color={theme.textMuted} /><Text style={s.devStatText}>{tool.developerFollowers.toLocaleString()} متابع</Text></View>
                </View>
              </View>
            </View>
          </View>

          {relatedTools.length > 0 ? (
            <View style={s.relatedSection}>
              <Text style={[s.sectionTitle, { paddingHorizontal: 16 }]}>أدوات مشابهة</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.relatedScroll}>
                {relatedTools.map(t => <ToolCard key={t.id} tool={t} variant="compact" width={160} />)}
              </ScrollView>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (t: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.background },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: t.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: t.border },
  topActions: { flexDirection: 'row', gap: 8 },
  topAction: { width: 40, height: 40, borderRadius: 20, backgroundColor: t.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: t.border },
  heroSection: { alignItems: 'center', paddingHorizontal: 16, paddingVertical: 20 },
  logoHero: { width: 80, height: 80, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  toolName: { fontSize: 26, fontWeight: '800', fontFamily: 'Cairo_700Bold', color: t.textPrimary, textAlign: 'center', marginBottom: 10 },
  metaRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  categoryBadgeLarge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 9999 },
  categoryTextLarge: { fontSize: 12, fontFamily: 'Cairo_600SemiBold' },
  pricingBadgeLarge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 9999 },
  pricingTextLarge: { fontSize: 12, fontFamily: 'Cairo_600SemiBold' },
  developerName: { fontSize: 13, fontFamily: 'Cairo_400Regular', color: t.textMuted },
  statsSection: { flexDirection: 'row', marginHorizontal: 16, backgroundColor: t.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: t.border, marginBottom: 16 },
  statBox: { flex: 1, alignItems: 'center', gap: 4 },
  statBoxValue: { fontSize: 24, fontWeight: '700', fontFamily: 'Cairo_700Bold', color: t.textPrimary },
  statBoxLabel: { fontSize: 11, fontFamily: 'Cairo_500Medium', color: t.textMuted },
  statDivider: { width: 1, backgroundColor: t.border },
  actionsRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 12, marginBottom: 24 },
  voteButtonLarge: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 12, borderWidth: 2, borderColor: t.upvote },
  voteButtonText: { fontSize: 16, fontFamily: 'Cairo_600SemiBold', color: t.upvote },
  launchButton: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  launchGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14 },
  launchText: { fontSize: 16, fontFamily: 'Cairo_600SemiBold', color: '#FFF' },
  descSection: { paddingHorizontal: 16, marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '700', fontFamily: 'Cairo_700Bold', color: t.textPrimary, marginBottom: 12 },
  description: { fontSize: 15, fontFamily: 'Cairo_400Regular', color: t.textSecondary, lineHeight: 26, textAlign: 'right' },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999, backgroundColor: t.surface, borderWidth: 1, borderColor: t.border },
  tagText: { fontSize: 11, fontFamily: 'Cairo_500Medium', color: t.textMuted },
  screenshotSection: { marginBottom: 24 },
  screenshotScroll: { paddingHorizontal: 16, gap: 12 },
  screenshot: { width: 280, height: 175, borderRadius: 12, backgroundColor: t.surface },
  statsSection: { paddingHorizontal: 16, marginBottom: 24 },
  recBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
    borderWidth: 1, marginBottom: 16,
  },
  recPct: { fontSize: 14, fontFamily: 'Cairo_600SemiBold' },
  barChart: { gap: 8, marginBottom: 16 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barStarRow: { flexDirection: 'row', alignItems: 'center', gap: 2, width: 24 },
  barStar: { fontSize: 11, fontFamily: 'Cairo_700Bold', color: t.textSecondary },
  barBg: {
    flex: 1, height: 10, borderRadius: 5,
    backgroundColor: t.border, overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 5, minWidth: 4 },
  barCount: { fontSize: 11, fontFamily: 'Cairo_500Medium', color: t.textMuted, width: 24, textAlign: 'right' },
  statsSummaryRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: t.surface, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: t.border,
  },
  statsSummaryItem: { flex: 1, alignItems: 'center', gap: 2 },
  statsSummaryVal: { fontSize: 20, fontFamily: 'Cairo_700Bold' },
  statsSummaryLabel: { fontSize: 11, fontFamily: 'Cairo_500Medium', color: t.textMuted },
  statsSumDivider: { width: 1, height: 28, backgroundColor: t.border },
  rateSection: { paddingHorizontal: 16, marginBottom: 24, alignItems: 'center' },
  starsRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  ratedText: { fontSize: 13, fontFamily: 'Cairo_600SemiBold', color: t.star, marginTop: 8 },
  commentsSection: { paddingHorizontal: 16, marginBottom: 24 },
  commentInput: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginBottom: 16, backgroundColor: t.surface, borderRadius: 12, borderWidth: 1, borderColor: t.border, paddingHorizontal: 12, paddingVertical: 8 },
  commentTextInput: { flex: 1, fontSize: 15, fontFamily: 'Cairo_400Regular', color: t.textPrimary, maxHeight: 80, minHeight: 36, writingDirection: 'rtl' },
  sendButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: t.primary, alignItems: 'center', justifyContent: 'center' },
  commentCard: { backgroundColor: t.surface, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: t.border },
  commentHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  commentAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: t.primaryDark, alignItems: 'center', justifyContent: 'center' },
  commentAvatarText: { fontSize: 12, fontWeight: '700', fontFamily: 'Cairo_700Bold', color: '#FFF' },
  commentName: { fontSize: 13, fontFamily: 'Cairo_600SemiBold', color: t.textPrimary },
  commentDate: { fontSize: 11, fontFamily: 'Cairo_500Medium', color: t.textMuted },
  commentTextStyle: { fontSize: 15, fontFamily: 'Cairo_400Regular', color: t.textSecondary, lineHeight: 24, textAlign: 'right' },
  showMoreText: { fontSize: 13, fontFamily: 'Cairo_600SemiBold', color: t.primary, textAlign: 'center', paddingVertical: 8 },
  developerSection: { paddingHorizontal: 16, marginBottom: 24 },
  developerCard: { flexDirection: 'row', gap: 14, backgroundColor: t.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: t.border },
  devAvatar: { width: 52, height: 52, borderRadius: 14, backgroundColor: t.primaryDark, alignItems: 'center', justifyContent: 'center' },
  devAvatarText: { fontSize: 18, fontWeight: '700', fontFamily: 'Cairo_700Bold', color: '#FFF' },
  devInfo: { flex: 1 },
  devName: { fontSize: 16, fontFamily: 'Cairo_600SemiBold', color: t.textPrimary, marginBottom: 2 },
  devBio: { fontSize: 13, fontFamily: 'Cairo_400Regular', color: t.textSecondary, marginBottom: 8 },
  devMeta: { flexDirection: 'row', gap: 16 },
  devStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  devStatText: { fontSize: 11, fontFamily: 'Cairo_500Medium', color: t.textMuted },
  relatedSection: { marginBottom: 12 },
  relatedScroll: { paddingHorizontal: 16, gap: 12 },
});

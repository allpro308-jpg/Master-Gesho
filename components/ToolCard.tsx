import React, { useCallback, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  runOnJS,
} from 'react-native-reanimated';
import { useTheme } from '../contexts/ThemeContext';
import { Tool } from '../services/mockData';
import { useAppContext } from '../contexts/AppContext';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface ToolCardProps {
  tool: Tool;
  variant?: 'horizontal' | 'vertical' | 'compact';
  width?: number;
  index?: number;
}

function ToolCardInner({ tool, variant = 'vertical', width, index = 0 }: ToolCardProps) {
  const router = useRouter();
  const { theme } = useTheme();
  const { toggleSaveTool, toggleVoteTool, isToolSaved, isToolVoted } = useAppContext();
  const saved = isToolSaved(tool.id);
  const voted = isToolVoted(tool.id);

  const cardScale = useSharedValue(1);
  const voteScale = useSharedValue(1);
  const saveScale = useSharedValue(1);

  const cardAnimatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: cardScale.value }] }));
  const voteAnimatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: voteScale.value }] }));
  const saveAnimatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: saveScale.value }] }));

  const doNavigate = useCallback(() => { router.push(`/tool/${tool.id}`); }, [router, tool.id]);
  const handlePressIn = useCallback(() => { cardScale.value = withSpring(0.97, { damping: 15, stiffness: 300 }); }, []);
  const handlePressOut = useCallback(() => { cardScale.value = withSpring(1, { damping: 15, stiffness: 300 }); }, []);
  const handlePress = useCallback(() => { Haptics.selectionAsync(); runOnJS(doNavigate)(); }, [doNavigate]);

  const handleSave = useCallback((e: any) => {
    e.stopPropagation();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    saveScale.value = withSequence(withSpring(1.4, { damping: 8, stiffness: 400 }), withSpring(0.85, { damping: 8, stiffness: 400 }), withSpring(1, { damping: 10, stiffness: 300 }));
    toggleSaveTool(tool.id);
  }, [tool.id, toggleSaveTool]);

  const handleVote = useCallback((e: any) => {
    e.stopPropagation();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    voteScale.value = withSequence(withSpring(1.3, { damping: 8, stiffness: 400 }), withSpring(0.85, { damping: 8, stiffness: 400 }), withSpring(1, { damping: 10, stiffness: 300 }));
    toggleVoteTool(tool.id);
  }, [tool.id, toggleVoteTool]);

  const enterDelay = Math.min(index * 60, 400);
  const catColor = theme.categoryColors[tool.category] || theme.primary;

  const s = useMemo(() => createStyles(theme), [theme]);

  if (variant === 'compact') {
    return (
      <Animated.View entering={FadeInUp.delay(enterDelay).duration(400).springify().damping(14)}>
        <AnimatedPressable onPress={handlePress} onPressIn={handlePressIn} onPressOut={handlePressOut} style={[s.compactCard, { width: width || 160 }, cardAnimatedStyle]}>
          <View style={[s.logoSmall, { backgroundColor: tool.logoColor + '20' }]}>
            <MaterialIcons name={tool.logoIcon as any} size={20} color={tool.logoColor} />
          </View>
          <Text style={s.compactName} numberOfLines={1}>{tool.name}</Text>
          <Text style={s.compactCategory}>{tool.category}</Text>
          <View style={s.compactFooter}>
            <MaterialIcons name="star" size={12} color={theme.star} />
            <Text style={s.compactRating}>{tool.rating}</Text>
            <Animated.View style={[s.compactVotes, voteAnimatedStyle]}>
              <Pressable onPress={handleVote} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                <MaterialIcons name="arrow-upward" size={11} color={voted ? theme.upvote : theme.textMuted} />
                <Text style={[s.compactVoteText, voted && { color: theme.upvote }]}>{tool.votes}</Text>
              </Pressable>
            </Animated.View>
          </View>
        </AnimatedPressable>
      </Animated.View>
    );
  }

  if (variant === 'horizontal') {
    return (
      <Animated.View entering={FadeInUp.delay(enterDelay).duration(400).springify().damping(14)}>
        <AnimatedPressable onPress={handlePress} onPressIn={handlePressIn} onPressOut={handlePressOut} style={[s.horizontalCard, { width: width || 260 }, cardAnimatedStyle]}>
          <View style={s.horizontalTop}>
            <View style={[s.logoMedium, { backgroundColor: tool.logoColor + '20' }]}>
              <MaterialIcons name={tool.logoIcon as any} size={24} color={tool.logoColor} />
            </View>
            <Animated.View style={voteAnimatedStyle}>
              <Pressable onPress={handleVote} hitSlop={8} style={[s.voteChip, voted && { backgroundColor: theme.upvote, borderColor: theme.upvote }]}>
                <MaterialIcons name="arrow-upward" size={14} color={voted ? '#FFF' : theme.upvote} />
                <Text style={[s.voteChipText, voted && { color: '#FFF' }]}>{tool.votes}</Text>
              </Pressable>
            </Animated.View>
          </View>
          <Text style={s.horizontalName} numberOfLines={1}>{tool.name}</Text>
          <Text style={s.horizontalDesc} numberOfLines={2}>{tool.shortDescription}</Text>
          <View style={s.horizontalFooter}>
            <View style={[s.categoryBadge, { backgroundColor: catColor + '20' }]}>
              <Text style={[s.categoryText, { color: catColor }]}>{tool.category}</Text>
            </View>
            <View style={s.ratingRow}>
              <MaterialIcons name="star" size={14} color={theme.star} />
              <Text style={s.ratingText}>{tool.rating}</Text>
            </View>
          </View>
        </AnimatedPressable>
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={FadeInUp.delay(enterDelay).duration(400).springify().damping(14)}>
      <AnimatedPressable onPress={handlePress} onPressIn={handlePressIn} onPressOut={handlePressOut} style={[s.verticalCard, cardAnimatedStyle]}>
        <View style={s.verticalRow}>
          <View style={[s.logoLarge, { backgroundColor: tool.logoColor + '20' }]}>
            <MaterialIcons name={tool.logoIcon as any} size={28} color={tool.logoColor} />
          </View>
          <View style={s.verticalInfo}>
            <View style={s.verticalHeader}>
              <Text style={s.verticalName} numberOfLines={1}>{tool.name}</Text>
              {tool.isNew ? <View style={s.newBadge}><Text style={s.newBadgeText}>جديد</Text></View> : null}
            </View>
            <Text style={s.verticalDesc} numberOfLines={2}>{tool.shortDescription}</Text>
            <View style={s.verticalMeta}>
              <View style={[s.categoryBadge, { backgroundColor: catColor + '20' }]}>
                <Text style={[s.categoryText, { color: catColor }]}>{tool.category}</Text>
              </View>
              <View style={s.ratingRow}>
                <MaterialIcons name="star" size={14} color={theme.star} />
                <Text style={s.ratingText}>{tool.rating}</Text>
                <Text style={s.ratingCount}>({tool.ratingCount})</Text>
              </View>
              <View style={[s.pricingBadge, { backgroundColor: tool.pricing === 'مجاني' ? theme.accent + '20' : tool.pricing === 'مفتوح المصدر' ? theme.primary + '20' : theme.warning + '20' }]}>
                <Text style={[s.pricingText, { color: tool.pricing === 'مجاني' ? theme.accent : tool.pricing === 'مفتوح المصدر' ? theme.primary : theme.warning }]}>{tool.pricing}</Text>
              </View>
            </View>
          </View>
          <View style={s.verticalActions}>
            <Animated.View style={voteAnimatedStyle}>
              <Pressable onPress={handleVote} hitSlop={8} style={[s.voteButton, voted && { backgroundColor: theme.upvote, borderColor: theme.upvote }]}>
                <MaterialIcons name="arrow-upward" size={18} color={voted ? '#FFF' : theme.upvote} />
                <Text style={[s.voteText, voted && { color: '#FFF' }]}>{tool.votes}</Text>
              </Pressable>
            </Animated.View>
            <Animated.View style={saveAnimatedStyle}>
              <Pressable onPress={handleSave} hitSlop={8}>
                <MaterialIcons name={saved ? 'bookmark' : 'bookmark-border'} size={22} color={saved ? theme.primary : theme.textMuted} />
              </Pressable>
            </Animated.View>
          </View>
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}

const ToolCard = React.memo(ToolCardInner);
export default ToolCard;

const createStyles = (theme: any) => StyleSheet.create({
  compactCard: { backgroundColor: theme.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: theme.border },
  logoSmall: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  compactName: { fontSize: 16, fontWeight: '600', fontFamily: 'Cairo_600SemiBold', color: theme.textPrimary, marginBottom: 2, textAlign: 'right' },
  compactCategory: { fontSize: 11, fontWeight: '500', fontFamily: 'Cairo_500Medium', color: theme.textMuted, marginBottom: 10, textAlign: 'right' },
  compactFooter: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  compactRating: { fontSize: 11, fontFamily: 'Cairo_500Medium', color: theme.star, marginRight: 8 },
  compactVotes: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  compactVoteText: { fontSize: 11, fontFamily: 'Cairo_500Medium', color: theme.textMuted },
  horizontalCard: { backgroundColor: theme.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: theme.border },
  horizontalTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  logoMedium: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  voteChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 9999, borderWidth: 1.5, borderColor: theme.upvote },
  voteChipText: { fontSize: 13, fontWeight: '700', fontFamily: 'Cairo_700Bold', color: theme.upvote },
  horizontalName: { fontSize: 16, fontWeight: '600', fontFamily: 'Cairo_600SemiBold', color: theme.textPrimary, marginBottom: 4, textAlign: 'right' },
  horizontalDesc: { fontSize: 13, fontFamily: 'Cairo_400Regular', color: theme.textSecondary, lineHeight: 18, marginBottom: 12, textAlign: 'right' },
  horizontalFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  categoryBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 9999 },
  categoryText: { fontSize: 11, fontWeight: '500', fontFamily: 'Cairo_500Medium' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingText: { fontSize: 13, fontFamily: 'Cairo_600SemiBold', color: theme.star },
  ratingCount: { fontSize: 11, fontFamily: 'Cairo_500Medium', color: theme.textMuted },
  verticalCard: { backgroundColor: theme.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: theme.border },
  verticalRow: { flexDirection: 'row', gap: 12 },
  logoLarge: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  verticalInfo: { flex: 1 },
  verticalHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  verticalName: { fontSize: 16, fontWeight: '600', fontFamily: 'Cairo_600SemiBold', color: theme.textPrimary, flex: 1, textAlign: 'right' },
  newBadge: { backgroundColor: theme.accent + '20', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  newBadgeText: { fontSize: 9, fontWeight: '800', fontFamily: 'Cairo_700Bold', color: theme.accent, letterSpacing: 0.5 },
  verticalDesc: { fontSize: 13, fontFamily: 'Cairo_400Regular', color: theme.textSecondary, lineHeight: 18, marginBottom: 8, textAlign: 'right' },
  verticalMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  pricingBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 9999 },
  pricingText: { fontSize: 11, fontFamily: 'Cairo_500Medium' },
  verticalActions: { alignItems: 'center', gap: 12 },
  voteButton: { alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1.5, borderColor: theme.upvote, minWidth: 52 },
  voteText: { fontSize: 12, fontWeight: '700', fontFamily: 'Cairo_700Bold', color: theme.upvote, marginTop: 1 },
});

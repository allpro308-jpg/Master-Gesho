/**
 * profile.tsx — Production-grade profile with advanced settings,
 * achievement showcase, notification prefs, accessibility, shareable footprint card.
 */

import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, Pressable, Switch, StyleSheet,
  ActivityIndicator, Dimensions, Share, Modal, Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import ViewShot, { captureRef } from 'react-native-view-shot';
import QRCode from 'react-native-qrcode-svg';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeInDown, FadeIn, ZoomIn,
  useSharedValue, useAnimatedStyle,
  withTiming, withDelay, withSequence, withRepeat, Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import { useAppContext } from '../../contexts/AppContext';
import { useAuth, useAlert } from '@/template';
import { useAchievements } from '../../contexts/AchievementsContext';
import { fetchUserSubmittedTools } from '../../services/toolsService';
import { Tool } from '../../services/mockData';
import { TIER_COLORS, TIER_LABELS, NotificationSettings } from '../../services/achievementsService';

const SCREEN_WIDTH = Dimensions.get('window').width;
const DISMISSED_MILESTONES_KEY = '@nextools_dismissed_milestones';

// ─── Milestone thresholds ─────────────────────────────────────────────────────
const MILESTONES = [10, 25, 50, 100, 200];

// ─── Confetti colors ──────────────────────────────────────────────────────────
const CONFETTI_COLORS = ['#3B82F6','#8B5CF6','#10B981','#F59E0B','#EF4444','#EC4899','#06B6D4','#F97316'];

// ─── Motivational messages per category ──────────────────────────────────────
const CAT_MESSAGES: Record<string, string> = {
  'كتابة بالذكاء': 'قلمك الرقمي لا يتوقف! قلم الذكاء الاصطناعي في يدك',
  'أدوات الصور': 'عينك الفنية تختار الأفضل! مصمم المستقبل بينك',
  'أدوات البيانات': 'الأرقام تحكي قصصها لك! عقل تحليلي من الطراز الأول',
  'أدوات المطورين': 'الكود يجري في دمك! مطور النخبة في بناء المستقبل',
  'أدوات مالية': 'استثماراتك الذكية تبدأ بأدوات ذكية! خبير مالي رقمي',
  'الإنتاجية': 'الوقت ذهب وأنت تعرف قيمته! منتج بلا حدود',
  'التصميم': 'الجمال في كل نقرة تختارها! ذوقك الإبداعي لا مثيل له',
  'التسويق': 'كلمتك تصل لملايين! مسوق رقمي استراتيجي',
};
const DEFAULT_MESSAGE = 'أنت من بناة عالم الذكاء الاصطناعي! استمر في الاستكشاف';

// ─── Palette ──────────────────────────────────────────────────────────────────
const CAT_PALETTE = ['#3B82F6','#8B5CF6','#10B981','#F59E0B','#EF4444','#06B6D4'];
const TAG_PALETTE = ['#A78BFA','#34D399','#FB923C','#60A5FA','#F472B6','#4ADE80','#FBBF24','#F87171','#38BDF8','#E879F9'];

// ─── Confetti Particle ────────────────────────────────────────────────────────
function ConfettiParticle({ color, delay, startX, targetX, targetY, size = 7 }: any) {
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const opacity = useSharedValue(0);
  const rotate = useSharedValue(0);
  useEffect(() => {
    opacity.value = withDelay(delay, withSequence(withTiming(1,{duration:200}), withDelay(600, withTiming(0,{duration:400}))));
    x.value = withDelay(delay, withTiming(targetX,{duration:900, easing: Easing.out(Easing.quad)}));
    y.value = withDelay(delay, withTiming(targetY,{duration:900, easing: Easing.out(Easing.quad)}));
    rotate.value = withDelay(delay, withRepeat(withTiming(360,{duration:600}), 2));
  }, []);
  const style = useAnimatedStyle(() => ({
    transform: [{translateX: x.value},{translateY: y.value},{rotate:`${rotate.value}deg`}],
    opacity: opacity.value,
  }));
  return (
    <Animated.View style={[{position:'absolute',width:size,height:size,borderRadius:size*0.3,backgroundColor:color,left:startX},style]} />
  );
}

function ConfettiBurst({ active }: { active: boolean }) {
  const particles = useMemo(() => Array.from({length:26},(_,i)=>{
    const angle=(i/26)*2*Math.PI, dist=55+Math.random()*65;
    return {key:i,color:CONFETTI_COLORS[i%CONFETTI_COLORS.length],delay:Math.floor(Math.random()*220),startX:80+Math.random()*80,targetX:Math.cos(angle)*dist,targetY:Math.sin(angle)*dist+10,size:5+Math.floor(Math.random()*5)};
  }),[]);
  if (!active) return null;
  return (
    <View style={{position:'absolute',top:8,left:0,right:0,height:130,overflow:'visible',pointerEvents:'none'}}>
      {particles.map(p=><ConfettiParticle key={p.key} {...p} />)}
    </View>
  );
}

// ─── Milestone definitions ─────────────────────────────────────────────────────
const MILESTONE_ICONS: Record<number,string> = {10:'🌟',25:'🏅',50:'🥈',100:'🥇',200:'🏆'};
const MILESTONE_LABELS: Record<number,string> = {10:'عاشر تفاعل',25:'خمسة وعشرون',50:'خمسون',100:'مئة تفاعل',200:'مئتا تفاعل'};

// ─── MilestoneBadge (AsyncStorage-backed) ─────────────────────────────────────
function MilestoneBadge({ totalInteractions, topCategory }: { totalInteractions:number; topCategory:string }) {
  const milestone = MILESTONES.slice().reverse().find(m=>totalInteractions>=m);
  const [dismissed,setDismissed] = useState(true);
  const [confettiKey,setConfettiKey] = useState(0);
  const [showConfetti,setShowConfetti] = useState(false);
  const scaleVal = useSharedValue(0.88);
  useEffect(()=>{
    if (!milestone) return;
    AsyncStorage.getItem(DISMISSED_MILESTONES_KEY).then(raw=>{
      const list:number[] = raw?JSON.parse(raw):[];
      if (!list.includes(milestone)) {
        setDismissed(false);
        scaleVal.value = withSequence(withTiming(1.05,{duration:380,easing:Easing.out(Easing.back(2))}),withTiming(1,{duration:200}));
        setConfettiKey(k=>k+1);
        setShowConfetti(true);
        const t=setTimeout(()=>setShowConfetti(false),1500);
        return ()=>clearTimeout(t);
      }
    });
  },[milestone]);
  const handleDismiss = useCallback(()=>{
    if (!milestone) return;
    AsyncStorage.getItem(DISMISSED_MILESTONES_KEY).then(raw=>{
      const list:number[] = raw?JSON.parse(raw):[];
      if (!list.includes(milestone)) { list.push(milestone); AsyncStorage.setItem(DISMISSED_MILESTONES_KEY, JSON.stringify(list)); }
    });
    setDismissed(true); Haptics.selectionAsync();
  },[milestone]);
  const badgeStyle = useAnimatedStyle(()=>({transform:[{scale:scaleVal.value}]}));
  if (!milestone||dismissed) return null;
  const message = CAT_MESSAGES[topCategory]||DEFAULT_MESSAGE;
  const icon = MILESTONE_ICONS[milestone]||'🌟';
  const label = MILESTONE_LABELS[milestone]||`${milestone} تفاعل`;
  const nextMilestone = MILESTONES.find(m=>m>totalInteractions);
  return (
    <Animated.View entering={ZoomIn.springify().damping(16).stiffness(180).delay(160)} style={{position:'relative'}}>
      <Animated.View style={[{borderRadius:20,overflow:'hidden'},badgeStyle]}>
        <LinearGradient colors={['#7C3AED','#3B82F6','#06B6D4']} start={{x:0,y:0}} end={{x:1,y:1}} style={ms.gradient}>
          <Pressable onPress={handleDismiss} style={ms.dismissBtn} hitSlop={10}>
            <MaterialIcons name="close" size={13} color="rgba(255,255,255,0.75)" />
          </Pressable>
          <View style={ms.topRow}>
            <Text style={{fontSize:40}}>{icon}</Text>
            <View style={{flex:1,gap:4}}>
              <View style={ms.badgeChip}><MaterialIcons name="verified" size={12} color="#FFF" /><Text style={ms.badgeChipText}>إنجاز مكتمل</Text></View>
              <Text style={ms.milestoneTitle}>تجاوزت الـ{label}!</Text>
            </View>
          </View>
          <View style={ms.messageBox}><Text style={ms.messageText}>{message}</Text></View>
          <View style={ms.progressRow}>
            <Text style={ms.progressLeft}>{totalInteractions} تفاعل</Text>
            <View style={ms.dotsRow}>{MILESTONES.map(m=><View key={m} style={[ms.dot,totalInteractions>=m?{backgroundColor:'#FFF',width:12,height:12}:{backgroundColor:'rgba(255,255,255,0.28)'}]} />)}</View>
            <Text style={ms.progressRight}>{nextMilestone?`التالي: ${nextMilestone}`:'الذروة!'}</Text>
          </View>
        </LinearGradient>
      </Animated.View>
      <ConfettiBurst key={confettiKey} active={showConfetti} />
    </Animated.View>
  );
}

const ms = StyleSheet.create({
  gradient:{borderRadius:20,padding:18,gap:0},
  dismissBtn:{position:'absolute',top:12,left:12,zIndex:10,width:26,height:26,borderRadius:13,backgroundColor:'rgba(255,255,255,0.18)',alignItems:'center',justifyContent:'center'},
  topRow:{flexDirection:'row',alignItems:'center',gap:14,marginBottom:14},
  badgeChip:{flexDirection:'row',alignItems:'center',gap:4,backgroundColor:'rgba(255,255,255,0.2)',borderRadius:9999,paddingHorizontal:8,paddingVertical:3,alignSelf:'flex-start'},
  badgeChipText:{fontSize:11,fontFamily:'Cairo_600SemiBold',color:'#FFF'},
  milestoneTitle:{fontSize:17,fontFamily:'Cairo_700Bold',color:'#FFF'},
  messageBox:{backgroundColor:'rgba(255,255,255,0.15)',borderRadius:12,paddingHorizontal:14,paddingVertical:10,marginBottom:14},
  messageText:{fontSize:14,fontFamily:'Cairo_500Medium',color:'#FFF',textAlign:'center',lineHeight:22},
  progressRow:{flexDirection:'row',alignItems:'center',gap:8,backgroundColor:'rgba(0,0,0,0.15)',borderRadius:10,paddingHorizontal:12,paddingVertical:8},
  progressLeft:{fontSize:11,fontFamily:'Cairo_700Bold',color:'#FFF',minWidth:60},
  dotsRow:{flex:1,flexDirection:'row',justifyContent:'center',alignItems:'center',gap:6},
  dot:{width:10,height:10,borderRadius:5},
  progressRight:{fontSize:11,fontFamily:'Cairo_600SemiBold',color:'rgba(255,255,255,0.82)',textAlign:'right',minWidth:52},
});

// ─── AnimatedBar ──────────────────────────────────────────────────────────────
function AnimatedBar({ pct, color, delay }: { pct:number; color:string; delay:number }) {
  const width = useSharedValue(0);
  useEffect(()=>{ width.value = withDelay(delay, withTiming(pct,{duration:700})); },[pct]);
  const animStyle = useAnimatedStyle(()=>({width:`${width.value}%` as any}));
  return (
    <View style={{height:8,borderRadius:4,backgroundColor:color+'25',overflow:'hidden'}}>
      <Animated.View style={[{height:'100%',borderRadius:4,backgroundColor:color},animStyle]} />
    </View>
  );
}

// ─── Donut Ring (single animated ring, hooks-safe) ───────────────────────────
function DonutRing({ color, size, ringSize, borderWidth, delay, targetOpacity = 1 }: { color:string; size:number; ringSize:number; borderWidth:number; delay:number; targetOpacity?:number }) {
  const scale = useSharedValue(0.88);
  const opacity = useSharedValue(0);
  useEffect(() => {
    scale.value = withDelay(delay, withTiming(1, { duration: 700 }));
    opacity.value = withDelay(delay, withTiming(targetOpacity, { duration: 600 }));
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={[style, { position: 'absolute', width: ringSize, height: ringSize, borderRadius: ringSize / 2, borderWidth, borderColor: color }]} />
  );
}

// ─── Simple visual donut ──────────────────────────────────────────────────────
function SimpleDonut({ data, size=130, strokeWidth=18 }: { data:{pct:number;color:string}[]; size?:number; strokeWidth?:number }) {
  const slices = data.slice(0, 6);
  return (
    <View style={{width:size,height:size,alignItems:'center',justifyContent:'center'}}>
      {slices.map((seg, i) => {
        const ringSize = size - i * strokeWidth * 0.6;
        const bw = i === 0 ? strokeWidth : strokeWidth * 0.5;
        return (
          <DonutRing
            key={i}
            color={seg.color}
            size={size}
            ringSize={ringSize}
            borderWidth={bw}
            delay={i * 80}
            targetOpacity={0.8 - i * 0.1}
          />
        );
      })}
    </View>
  );
}

// ─── MilestonesProgressCard ───────────────────────────────────────────────────
function MilestonesProgressCard({ totalInteractions, theme }: { totalInteractions:number; theme:any }) {
  const nextMilestone = MILESTONES.find(m=>m>totalInteractions);
  const prevMilestone = MILESTONES.slice().reverse().find(m=>m<=totalInteractions)||0;
  const progress = nextMilestone ? Math.round(((totalInteractions-prevMilestone)/(nextMilestone-prevMilestone))*100) : 100;
  const progressWidth = useSharedValue(0);
  useEffect(()=>{ progressWidth.value = withDelay(200,withTiming(progress,{duration:900})); },[progress]);
  const progressStyle = useAnimatedStyle(()=>({width:`${progressWidth.value}%` as any}));
  return (
    <Animated.View entering={FadeInDown.duration(350).delay(280)} style={[mpc.card,{backgroundColor:theme.surface,borderColor:theme.border}]}>
      <View style={mpc.header}>
        <View style={[mpc.iconBg,{backgroundColor:'#F59E0B20'}]}><MaterialIcons name="military-tech" size={18} color="#F59E0B" /></View>
        <Text style={[mpc.title,{color:theme.textPrimary}]}>مسار الإنجازات</Text>
        <Text style={[mpc.sub,{color:theme.textMuted}]}>{totalInteractions} تفاعل</Text>
      </View>
      {nextMilestone ? (
        <View style={mpc.progressSection}>
          <View style={mpc.progressLabelRow}>
            <Text style={[mpc.progressLabel,{color:theme.textMuted}]}>نحو {MILESTONE_ICONS[nextMilestone]} الـ{nextMilestone}</Text>
            <Text style={[mpc.progressPct,{color:theme.primary}]}>{progress}%</Text>
          </View>
          <View style={[mpc.progressTrack,{backgroundColor:theme.border}]}>
            <Animated.View style={[mpc.progressFill,{backgroundColor:theme.primary},progressStyle]} />
          </View>
          <Text style={[mpc.progressHint,{color:theme.textMuted}]}>{nextMilestone-totalInteractions} تفاعل متبقٍ</Text>
        </View>
      ) : (
        <View style={[mpc.maxBadge,{backgroundColor:'#22C55E15',borderColor:'#22C55E30'}]}>
          <Text style={{fontSize:20}}>🏆</Text>
          <Text style={[mpc.maxText,{color:'#22C55E'}]}>وصلت لأعلى مستوى! مبروك</Text>
        </View>
      )}
      <View style={mpc.milestonesList}>
        {MILESTONES.map((m,i)=>{
          const done=totalInteractions>=m;
          const isCurrent=prevMilestone===m&&!!nextMilestone;
          return (
            <View key={m} style={mpc.milestoneRow}>
              {i<MILESTONES.length-1&&<View style={[mpc.connector,{backgroundColor:totalInteractions>=MILESTONES[i+1]?'#22C55E':theme.border}]} />}
              <View style={[mpc.dot,{backgroundColor:done?'#22C55E':isCurrent?theme.primary:theme.border,borderWidth:isCurrent?2:0,borderColor:theme.primary}]}>
                {done?<MaterialIcons name="check" size={12} color="#FFF" />:<View style={{width:8,height:8,borderRadius:4,backgroundColor:isCurrent?'#FFF':theme.border}} />}
              </View>
              <View style={[mpc.content,{opacity:done?1:0.55}]}>
                <Text style={{fontSize:20}}>{MILESTONE_ICONS[m]}</Text>
                <View style={{flex:1}}>
                  <Text style={[mpc.milVal,{color:done?theme.textPrimary:theme.textMuted}]}>{m} تفاعل</Text>
                  <Text style={[mpc.milLabel,{color:theme.textMuted}]}>{MILESTONE_LABELS[m]}</Text>
                </View>
                {done&&<View style={mpc.doneBadge}><Text style={mpc.doneBadgeText}>✓ مكتمل</Text></View>}
                {isCurrent&&!done&&<View style={[mpc.doneBadge,{backgroundColor:theme.primary+'20'}]}><Text style={[mpc.doneBadgeText,{color:theme.primary}]}>جارٍ</Text></View>}
              </View>
            </View>
          );
        })}
      </View>
    </Animated.View>
  );
}

const mpc = StyleSheet.create({
  card:{borderRadius:16,padding:16,borderWidth:1},
  header:{flexDirection:'row',alignItems:'center',gap:8,marginBottom:16},
  iconBg:{width:36,height:36,borderRadius:10,alignItems:'center',justifyContent:'center'},
  title:{flex:1,fontSize:16,fontFamily:'Cairo_700Bold'},
  sub:{fontSize:12,fontFamily:'Cairo_400Regular'},
  progressSection:{marginBottom:18,gap:6},
  progressLabelRow:{flexDirection:'row',justifyContent:'space-between'},
  progressLabel:{fontSize:13,fontFamily:'Cairo_500Medium'},
  progressPct:{fontSize:13,fontFamily:'Cairo_700Bold'},
  progressTrack:{height:8,borderRadius:4,overflow:'hidden'},
  progressFill:{height:'100%',borderRadius:4},
  progressHint:{fontSize:11,fontFamily:'Cairo_400Regular',textAlign:'right'},
  maxBadge:{flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:14,paddingVertical:10,borderRadius:12,borderWidth:1,marginBottom:16},
  maxText:{fontSize:14,fontFamily:'Cairo_700Bold'},
  milestonesList:{gap:0,marginTop:4},
  milestoneRow:{flexDirection:'row',alignItems:'flex-start',gap:10,paddingVertical:8,position:'relative'},
  connector:{position:'absolute',left:11,top:30,width:2,height:20},
  dot:{width:24,height:24,borderRadius:12,alignItems:'center',justifyContent:'center',marginTop:6,flexShrink:0},
  content:{flex:1,flexDirection:'row',alignItems:'center',gap:10,paddingVertical:4},
  milVal:{fontSize:14,fontFamily:'Cairo_700Bold'},
  milLabel:{fontSize:11,fontFamily:'Cairo_400Regular',marginTop:1},
  doneBadge:{paddingHorizontal:8,paddingVertical:3,borderRadius:9999,backgroundColor:'#22C55E20'},
  doneBadgeText:{fontSize:10,fontFamily:'Cairo_600SemiBold',color:'#22C55E'},
});

// ─── Achievement Mini Card ─────────────────────────────────────────────────────
function AchievementMini({ ach, theme }: { ach:any; theme:any }) {
  const tierColor = TIER_COLORS[ach.tier] || theme.primary;
  return (
    <View style={[am.card, { backgroundColor: theme.surface, borderColor: tierColor + '40', borderWidth: 1.5 }]}>
      <Text style={{ fontSize: 22 }}>{ach.icon}</Text>
      <Text style={[am.title, { color: theme.textPrimary }]} numberOfLines={1}>{ach.title}</Text>
      <View style={[am.badge, { backgroundColor: tierColor + '20' }]}>
        <Text style={[am.badgeText, { color: tierColor }]}>{TIER_LABELS[ach.tier]}</Text>
      </View>
    </View>
  );
}

const am = StyleSheet.create({
  card: { borderRadius: 12, padding: 12, alignItems: 'center', gap: 5, width: 100 },
  title: { fontSize: 11, fontFamily: 'Cairo_600SemiBold', textAlign: 'center' },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 9999 },
  badgeText: { fontSize: 9, fontFamily: 'Cairo_700Bold' },
});

// ─── FootprintSection ─────────────────────────────────────────────────────────
function FootprintSection({ data, theme, s, router, userName, levelInfo, unlockedAchievements, streakData }: any) {
  const cardRef = useRef<any>(null);
  const [exportingPng, setExportingPng] = useState(false);
  const personaEmoji = !data ? '🤖' : data.cats[0]?.name?.includes('صور') ? '🎨' : data.cats[0]?.name?.includes('مطور') ? '💻' : data.cats[0]?.name?.includes('كتاب') ? '✍️' : data.cats[0]?.name?.includes('مال') ? '💰' : data.cats[0]?.name?.includes('إنتاج') ? '⚡' : '🤖';
  const personaTitle = data?.cats?.[0]?.name ? `محبّ أدوات ${data.cats[0].name}` : 'مستكشف الذكاء الاصطناعي';

  const handleExportPng = useCallback(async () => {
    if (exportingPng || !data) return;
    setExportingPng(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const uri = await captureRef(cardRef, { format: 'png', quality: 1.0, result: 'tmpfile' });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'مشاركة بصمتي' });
      } else {
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status === 'granted') {
          await MediaLibrary.saveToLibraryAsync(uri);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }
    } catch (e) { console.warn('PNG export error', e); }
    finally { setExportingPng(false); }
  }, [exportingPng, data]);

  const handleShare = useCallback(async () => {
    if (!data) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const topCats = data.cats.slice(0,3).map((c:any) => `${c.name} (${c.pct}%)`).join(' · ');
    const topTags = data.tags.slice(0,5).map((t:any) => `#${t.name}`).join(' ');
    await Share.share({ message: `🤖 بصمتي في مستر جيشو\n━━━━━━━━━━━━━━━━━━\n${userName ? `👤 ${userName}\n` : ''}⚡ ${data.totalInteractions} تفاعل مع ${data.uniqueTools} أداة\n📂 الفئات: ${topCats}\n🏷️ الوسوم: ${topTags}\n🚀 تطبيق مستر جيشو` });
  }, [data, userName]);

  if (!data) {
    return (
      <View style={s.fpContainer}>
        <View style={s.fpEmptyBox}>
          <View style={s.fpEmptyIconBg}><MaterialIcons name="fingerprint" size={44} color={theme.textMuted} /></View>
          <Text style={s.fpEmptyTitle}>لا توجد بصمة بعد</Text>
          <Text style={s.fpEmptySub}>تفاعل مع الأدوات (حفظ، تصويت، تقييم) لنرسم لك تحليلاً دقيقاً</Text>
          <Pressable onPress={()=>router.push('/(tabs)/explore')} style={[s.emptyBtn,{backgroundColor:theme.primary,marginTop:8}]}>
            <MaterialIcons name="explore" size={16} color="#FFF" />
            <Text style={s.emptyBtnText}>استكشف الأدوات</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // (hooks already declared above early return)


  return (
    <View style={s.fpContainer}>
      {/* Hidden card for PNG export */}
      <View style={{ position: 'absolute', top: -9999, left: -9999, opacity: 0 }} pointerEvents="none">
        <FootprintShareCard
          ref={cardRef}
          data={data}
          userName={userName}
          level={levelInfo}
          achievements={unlockedAchievements}
          streak={streakData?.currentStreak || 0}
        />
      </View>

      {data.totalInteractions>=10&&<MilestoneBadge totalInteractions={data.totalInteractions} topCategory={data.cats[0]?.name||''} />}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Pressable onPress={handleShare} style={[s.fpShareBtn,{flex:1,borderColor:theme.primary+'50',backgroundColor:theme.primary+'10'}]}>
          <MaterialIcons name="share" size={16} color={theme.primary} />
          <Text style={[s.fpShareText,{color:theme.primary,fontSize:13}]}>مشاركة نصاً</Text>
        </Pressable>
        <Pressable
          onPress={handleExportPng}
          disabled={exportingPng}
          style={[s.fpShareBtn,{flex:1,borderColor:'#A78BFA50',backgroundColor:'#A78BFA10',opacity:exportingPng?0.6:1}]}
        >
          {exportingPng
            ? <ActivityIndicator size="small" color="#A78BFA" />
            : <MaterialIcons name="image" size={16} color="#A78BFA" />
          }
          <Text style={[s.fpShareText,{color:'#A78BFA',fontSize:13}]}>تصدير PNG</Text>
        </Pressable>
      </View>
      <Animated.View entering={FadeInDown.duration(300)} style={s.fpSummaryRow}>
        {[
          {icon:'apps',val:data.uniqueTools,label:'أداة تفاعلت معها',color:theme.primary},
          {icon:'bolt',val:data.totalInteractions,label:'إجمالي التفاعلات',color:'#F59E0B'},
          {icon:'category',val:data.cats.length,label:'فئات مختلفة',color:'#A78BFA'},
        ].map((item,i)=>(
          <View key={i} style={[s.fpSumCard,{borderColor:item.color+'40'}]}>
            <View style={[s.fpSumIconBg,{backgroundColor:item.color+'20'}]}><MaterialIcons name={item.icon as any} size={18} color={item.color} /></View>
            <Text style={[s.fpSumValue,{color:item.color}]}>{item.val}</Text>
            <Text style={s.fpSumLabel}>{item.label}</Text>
          </View>
        ))}
      </Animated.View>
      <MilestonesProgressCard totalInteractions={data.totalInteractions} theme={theme} />
      <Animated.View entering={FadeInDown.duration(350).delay(80)} style={s.fpCard}>
        <View style={s.fpCardHeader}>
          <View style={[s.fpSumIconBg,{backgroundColor:theme.primary+'15',width:34,height:34}]}><MaterialIcons name="pie-chart" size={18} color={theme.primary} /></View>
          <Text style={s.fpCardTitle}>الفئات المفضلة</Text>
          <Text style={s.fpCardSubtitle}>مرتبة بالاهتمام</Text>
        </View>
        <View style={s.fpPieRow}>
          <View style={s.fpDonutWrapper}>
            <SimpleDonut data={data.cats.map((c:any,i:number)=>({pct:c.pct,color:CAT_PALETTE[i%CAT_PALETTE.length]}))} size={128} strokeWidth={16} />
            <View style={s.fpDonutCenter}>
              <Text style={s.fpDonutValue}>{data.cats[0]?.pct??0}%</Text>
              <Text style={s.fpDonutLabel}>{data.cats[0]?.name?.slice(0,6)??''}</Text>
            </View>
          </View>
          <View style={s.fpLegend}>
            {data.cats.slice(0,5).map((cat:any,i:number)=>(
              <Animated.View key={cat.name} entering={FadeIn.duration(300).delay(100+i*60)} style={s.fpLegendItem}>
                <View style={[s.fpLegendDot,{backgroundColor:CAT_PALETTE[i%CAT_PALETTE.length]}]} />
                <Text style={s.fpLegendName} numberOfLines={1}>{cat.name}</Text>
                <Text style={[s.fpLegendPct,{color:CAT_PALETTE[i%CAT_PALETTE.length]}]}>{cat.pct}%</Text>
              </Animated.View>
            ))}
          </View>
        </View>
      </Animated.View>
      <Animated.View entering={FadeInDown.duration(350).delay(140)} style={s.fpCard}>
        <View style={s.fpCardHeader}>
          <View style={[s.fpSumIconBg,{backgroundColor:'#10B98115',width:34,height:34}]}><MaterialIcons name="bar-chart" size={18} color="#10B981" /></View>
          <Text style={s.fpCardTitle}>توزيع الفئات</Text>
        </View>
        <View style={s.fpBarList}>
          {data.cats.map((cat:any,i:number)=>(
            <Animated.View key={cat.name} entering={FadeInDown.duration(280).delay(i*50)} style={s.fpBarItem}>
              <View style={s.fpBarTopRow}>
                <View style={{flexDirection:'row',alignItems:'center',gap:6}}>
                  <View style={{width:8,height:8,borderRadius:4,backgroundColor:CAT_PALETTE[i%CAT_PALETTE.length]}} />
                  <Text style={s.fpBarName}>{cat.name}</Text>
                </View>
                <Text style={[s.fpBarCount,{color:CAT_PALETTE[i%CAT_PALETTE.length]}]}>{cat.pct}%</Text>
              </View>
              <AnimatedBar pct={cat.pct} color={CAT_PALETTE[i%CAT_PALETTE.length]} delay={i*60} />
            </Animated.View>
          ))}
        </View>
      </Animated.View>
      <Animated.View entering={FadeInDown.duration(350).delay(200)} style={s.fpCard}>
        <View style={s.fpCardHeader}>
          <View style={[s.fpSumIconBg,{backgroundColor:'#A78BFA15',width:34,height:34}]}><MaterialIcons name="tag" size={18} color="#A78BFA" /></View>
          <Text style={s.fpCardTitle}>الوسوم الأكثر تفاعلاً</Text>
          <Text style={s.fpCardSubtitle}>{data.tags.length} وسم</Text>
        </View>
        <View style={s.fpTagsCloud}>
          {data.tags.map((tag:any,i:number)=>{
            const color=TAG_PALETTE[i%TAG_PALETTE.length];
            const fontSize=tag.pct>=20?14:tag.pct>=10?13:11;
            return (
              <Animated.View key={tag.name} entering={FadeInDown.duration(280).delay(Math.min(i*35,500))}>
                <Pressable onPress={()=>router.push('/tags')} style={[s.fpTagChip,{borderColor:color+'60',backgroundColor:color+'12'}]}>
                  <Text style={[s.fpTagName,{color,fontSize,fontFamily:tag.pct>=15?'Cairo_700Bold':'Cairo_500Medium'}]}>#{tag.name}</Text>
                  <View style={[s.fpTagBadge,{backgroundColor:color+'25'}]}><Text style={[s.fpTagBadgeText,{color}]}>{tag.count}</Text></View>
                </Pressable>
              </Animated.View>
            );
          })}
        </View>
      </Animated.View>
      <Animated.View entering={FadeInDown.duration(350).delay(260)} style={s.fpPersonaCard}>
        <LinearGradient colors={[theme.primary+'20','#A78BFA18']} start={{x:0,y:0}} end={{x:1,y:0}} style={s.fpPersonaInner}>
          <View style={[s.fpPersonaIconBg,{backgroundColor:theme.primary+'25'}]}><Text style={{fontSize:26}}>{personaEmoji}</Text></View>
          <View style={{flex:1}}>
            <Text style={s.fpPersonaTitle}>{personaTitle}</Text>
            <Text style={s.fpPersonaSub}>
              تهتم بـ {data.cats.slice(0,2).map((c:any)=>c.name).join(' و ')}
              {data.tags[0]?<Text> · وأهم وسوماتك <Text style={{color:TAG_PALETTE[0],fontFamily:'Cairo_700Bold'}}>#{data.tags[0]?.name}</Text></Text>:null}
            </Text>
          </View>
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

// ─── Time Picker Modal ────────────────────────────────────────────────────────
function TimePickerModal({ visible, hour, minute, onSave, onClose, theme }: {
  visible: boolean; hour: number; minute: number;
  onSave: (h: number, m: number) => void; onClose: () => void; theme: any;
}) {
  const [selHour, setSelHour] = useState(hour);
  const [selMin, setSelMin] = useState(minute);
  const HOURS = Array.from({ length: 24 }, (_, i) => i);
  const MINS = [0, 15, 30, 45];
  return (
    <Modal transparent visible={visible} animationType="fade" statusBarTranslucent>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }} onPress={onClose}>
        <Pressable onPress={() => {}} style={{ backgroundColor: theme.surface, borderRadius: 20, padding: 20, width: '100%', borderWidth: 1, borderColor: theme.border }}>
          <Text style={{ fontSize: 16, fontFamily: 'Cairo_700Bold', color: theme.textPrimary, marginBottom: 16, textAlign: 'center' }}>وقت التذكير اليومي</Text>
          <View style={{ flexDirection: 'row', gap: 16, marginBottom: 20 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, fontFamily: 'Cairo_500Medium', color: theme.textMuted, marginBottom: 8, textAlign: 'center' }}>الساعة</Text>
              <ScrollView style={{ maxHeight: 160 }} showsVerticalScrollIndicator={false}>
                {HOURS.map(h => (
                  <Pressable key={h} onPress={() => { setSelHour(h); Haptics.selectionAsync(); }}
                    style={{ paddingVertical: 8, alignItems: 'center', borderRadius: 8, backgroundColor: selHour === h ? theme.primary + '20' : 'transparent', marginBottom: 2 }}>
                    <Text style={{ fontSize: 14, fontFamily: selHour === h ? 'Cairo_700Bold' : 'Cairo_400Regular', color: selHour === h ? theme.primary : theme.textSecondary }}>{String(h).padStart(2, '0')}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, fontFamily: 'Cairo_500Medium', color: theme.textMuted, marginBottom: 8, textAlign: 'center' }}>الدقيقة</Text>
              {MINS.map(m => (
                <Pressable key={m} onPress={() => { setSelMin(m); Haptics.selectionAsync(); }}
                  style={{ paddingVertical: 12, alignItems: 'center', borderRadius: 8, backgroundColor: selMin === m ? theme.primary + '20' : 'transparent', marginBottom: 6 }}>
                  <Text style={{ fontSize: 14, fontFamily: selMin === m ? 'Cairo_700Bold' : 'Cairo_400Regular', color: selMin === m ? theme.primary : theme.textSecondary }}>{String(m).padStart(2, '0')}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <View style={{ alignItems: 'center', marginBottom: 12 }}>
            <View style={{ backgroundColor: theme.primary + '15', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: theme.primary + '40' }}>
              <Text style={{ fontSize: 28, fontFamily: 'Cairo_700Bold', color: theme.primary }}>{String(selHour).padStart(2,'0')}:{String(selMin).padStart(2,'0')}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable onPress={onClose} style={{ flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: theme.backgroundSecondary, alignItems: 'center' }}>
              <Text style={{ fontSize: 14, fontFamily: 'Cairo_600SemiBold', color: theme.textSecondary }}>إلغاء</Text>
            </Pressable>
            <Pressable onPress={() => { onSave(selHour, selMin); onClose(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }}
              style={{ flex: 2, paddingVertical: 12, borderRadius: 10, backgroundColor: theme.primary, alignItems: 'center' }}>
              <Text style={{ fontSize: 14, fontFamily: 'Cairo_700Bold', color: '#FFF' }}>حفظ الوقت</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── QR Code Modal ────────────────────────────────────────────────────────────
function QRCodeModal({ visible, userName, onClose, theme }: {
  visible: boolean; userName: string; onClose: () => void; theme: any;
}) {
  const qrUrl = `https://mistergisho.app/user/${encodeURIComponent(userName)}`;
  const qrRef = useRef<any>(null);
  const handleShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await Share.share({
      message: `👤 تابعني في مستر جيشو!
📱 ${qrUrl}`,
      url: qrUrl,
    });
  };
  return (
    <Modal transparent visible={visible} animationType="slide" statusBarTranslucent>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }} onPress={onClose}>
        <Pressable onPress={() => {}} style={{ backgroundColor: theme.surface, borderRadius: 24, padding: 24, width: '100%', alignItems: 'center', gap: 16, borderWidth: 1, borderColor: theme.border }}>
          <Animated.View entering={ZoomIn.springify().damping(14)}>
            <LinearGradient colors={['#3B82F6', '#8B5CF6']} style={{ width: 60, height: 60, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }}>
              <MaterialIcons name="qr-code-2" size={32} color="#FFF" />
            </LinearGradient>
          </Animated.View>
          <Text style={{ fontSize: 18, fontFamily: 'Cairo_700Bold', color: theme.textPrimary }}>رمز QR الشخصي</Text>
          <Text style={{ fontSize: 13, fontFamily: 'Cairo_400Regular', color: theme.textMuted, textAlign: 'center' }}>{userName}</Text>
          <Animated.View entering={ZoomIn.springify().damping(12).delay(120)} style={{ padding: 16, backgroundColor: '#FFF', borderRadius: 16 }}>
            <QRCode
              value={qrUrl}
              size={180}
              color="#1E293B"
              backgroundColor="#FFFFFF"
              logo={undefined}
            />
          </Animated.View>
          <Text style={{ fontSize: 11, fontFamily: 'Cairo_400Regular', color: theme.textMuted, textAlign: 'center', maxWidth: 220 }} numberOfLines={2}>{qrUrl}</Text>
          <View style={{ flexDirection: 'row', gap: 10, width: '100%' }}>
            <Pressable onPress={onClose} style={{ flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: theme.backgroundSecondary, alignItems: 'center' }}>
              <Text style={{ fontSize: 14, fontFamily: 'Cairo_600SemiBold', color: theme.textSecondary }}>إغلاق</Text>
            </Pressable>
            <Pressable onPress={handleShare} style={{ flex: 2, paddingVertical: 12, borderRadius: 12, backgroundColor: theme.primary, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
              <MaterialIcons name="share" size={16} color="#FFF" />
              <Text style={{ fontSize: 14, fontFamily: 'Cairo_700Bold', color: '#FFF' }}>مشاركة الرمز</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Footprint Share Card (captured as PNG) ───────────────────────────────────
const FootprintShareCard = React.forwardRef<View, {
  data: any; userName: string; level: any; achievements: any[]; streak: number;
}>(function FootprintShareCard({ data, userName, level, achievements, streak }, cardRef) {
  const CAT_COLORS = ['#3B82F6','#8B5CF6','#10B981','#F59E0B','#EF4444','#06B6D4'];
  return (
    <View ref={cardRef} style={{ width: 340, backgroundColor: '#0B1120', borderRadius: 24, padding: 20, gap: 14 }}>
      {/* Header */}
      <LinearGradient colors={['#3B82F6','#8B5CF6','#EC4899']} start={{x:0,y:0}} end={{x:1,y:1}} style={{ borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 22, fontFamily: 'Cairo_700Bold', color: '#FFF' }}>
            {userName.slice(0,2)}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontFamily: 'Cairo_700Bold', color: '#FFF' }}>{userName}</Text>
          <Text style={{ fontSize: 12, fontFamily: 'Cairo_400Regular', color: 'rgba(255,255,255,0.8)' }}>المستوى {level.level} · {level.title}</Text>
        </View>
        <View style={{ alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 }}>
          <Text style={{ fontSize: 18 }}>🔥</Text>
          <Text style={{ fontSize: 12, fontFamily: 'Cairo_700Bold', color: '#FFF' }}>{streak}</Text>
        </View>
      </LinearGradient>

      {/* Stats row */}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {[
          { label: 'تفاعل', value: data.totalInteractions, color: '#F59E0B' },
          { label: 'أداة', value: data.uniqueTools, color: '#3B82F6' },
          { label: 'إنجاز', value: achievements.length, color: '#A78BFA' },
        ].map((s, i) => (
          <View key={i} style={{ flex: 1, backgroundColor: '#1E293B', borderRadius: 12, padding: 10, alignItems: 'center', gap: 2 }}>
            <Text style={{ fontSize: 20, fontFamily: 'Cairo_700Bold', color: s.color }}>{s.value}</Text>
            <Text style={{ fontSize: 10, fontFamily: 'Cairo_400Regular', color: '#64748B' }}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Categories */}
      <View style={{ backgroundColor: '#1E293B', borderRadius: 14, padding: 12, gap: 8 }}>
        <Text style={{ fontSize: 13, fontFamily: 'Cairo_700Bold', color: '#F8FAFC', marginBottom: 4 }}>الفئات المفضلة</Text>
        {data.cats.slice(0, 4).map((cat: any, i: number) => (
          <View key={cat.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: CAT_COLORS[i % CAT_COLORS.length] }} />
            <Text style={{ flex: 1, fontSize: 12, fontFamily: 'Cairo_500Medium', color: '#94A3B8' }}>{cat.name}</Text>
            <Text style={{ fontSize: 12, fontFamily: 'Cairo_700Bold', color: CAT_COLORS[i % CAT_COLORS.length] }}>{cat.pct}%</Text>
          </View>
        ))}
      </View>

      {/* Tags */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {data.tags.slice(0, 6).map((tag: any, i: number) => (
          <View key={tag.name} style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999, backgroundColor: '#A78BFA18', borderWidth: 1, borderColor: '#A78BFA40' }}>
            <Text style={{ fontSize: 10, fontFamily: 'Cairo_600SemiBold', color: '#A78BFA' }}>#{tag.name}</Text>
          </View>
        ))}
      </View>

      {/* Footer */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, borderTopWidth: 1, borderTopColor: '#1E293B' }}>
        <Text style={{ fontSize: 11, fontFamily: 'Cairo_700Bold', color: '#3B82F6' }}>مستر جيشو</Text>
        <Text style={{ fontSize: 10, fontFamily: 'Cairo_400Regular', color: '#475569' }}>
          {new Date().toLocaleDateString('ar-EG')}
        </Text>
        <Text style={{ fontSize: 10, fontFamily: 'Cairo_400Regular', color: '#475569' }}>mistergisho.app</Text>
      </View>
    </View>
  );
});

// ─── Notification Settings Card ───────────────────────────────────────────────
function NotifSettingsCard({ theme, s }: { theme:any; s:any }) {
  const { notifSettings, updateNotifSettings, sendTestNotification, scheduleDailyReminder } = useAchievements();
  const [local, setLocal] = useState(notifSettings);
  const [showTimePicker, setShowTimePicker] = useState(false);
  useEffect(()=>{ setLocal(notifSettings); },[notifSettings]);
  const update = (patch: Partial<NotificationSettings>) => {
    const next = {...local,...patch};
    setLocal(next);
    updateNotifSettings(next);
    Haptics.selectionAsync();
  };
  const handleSaveTime = (h: number, m: number) => {
    const next = {...local, reminderHour: h, reminderMinute: m};
    setLocal(next);
    updateNotifSettings(next);
    scheduleDailyReminder(h, m);
  };

  return (
    <>
      <TimePickerModal
        visible={showTimePicker}
        hour={local.reminderHour ?? 9}
        minute={local.reminderMinute ?? 0}
        onSave={handleSaveTime}
        onClose={() => setShowTimePicker(false)}
        theme={theme}
      />
      <Animated.View entering={FadeInDown.duration(320)} style={[s.settingsGroupCard, { marginBottom: 0 }]}>
        <SwitchRow icon="notifications" label="الإشعارات" desc="تفعيل/إيقاف جميع الإشعارات" value={local.enabled} onToggle={v=>update({enabled:v})} theme={theme} />
        <Divider theme={theme} />
        <SwitchRow icon="emoji-events" label="إشعارات الإنجازات" desc="يُرسَل فور تحقيق إنجاز" value={local.achievementAlerts} onToggle={v=>update({achievementAlerts:v})} theme={theme} disabled={!local.enabled} />
        <Divider theme={theme} />
        <SwitchRow icon="wb-sunny" label="تحفيز يومي" desc="رسالة تحفيزية حسب سلسلة نشاطك" value={local.dailyMotivation} onToggle={v=>update({dailyMotivation:v})} theme={theme} disabled={!local.enabled} />
        {local.dailyMotivation && local.enabled && (
          <>
            <Pressable
              onPress={() => { Haptics.selectionAsync(); setShowTimePicker(true); }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 4, marginRight: 4 }}
            >
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: theme.backgroundSecondary, alignItems: 'center', justifyContent: 'center' }}>
                <MaterialIcons name="schedule" size={18} color={theme.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontFamily: 'Cairo_600SemiBold', color: theme.textPrimary }}>وقت التذكير</Text>
                <Text style={{ fontSize: 11, fontFamily: 'Cairo_400Regular', color: theme.textMuted, marginTop: 1 }}>يومياً في الوقت المحدد</Text>
              </View>
              <View style={{ backgroundColor: theme.primary + '18', borderWidth: 1, borderColor: theme.primary + '40', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 }}>
                <Text style={{ fontSize: 15, fontFamily: 'Cairo_700Bold', color: theme.primary }}>
                  {String(local.reminderHour ?? 9).padStart(2,'0')}:{String(local.reminderMinute ?? 0).padStart(2,'0')}
                </Text>
              </View>
            </Pressable>
            <Divider theme={theme} />
          </>
        )}
        <SwitchRow icon="local-fire-department" label="تذكير السلسلة" desc="حافظ على نشاطك اليومي" value={local.streakReminders} onToggle={v=>update({streakReminders:v})} theme={theme} disabled={!local.enabled} />
        <Divider theme={theme} />
        <Pressable onPress={()=>{ Haptics.selectionAsync(); sendTestNotification(); }} style={s.testNotifBtn}>
          <MaterialIcons name="preview" size={16} color={theme.primary} />
          <Text style={[s.testNotifText,{color:theme.primary}]}>معاينة الإشعار</Text>
        </Pressable>
      </Animated.View>
    </>
  );
}

function SwitchRow({icon,label,desc,value,onToggle,theme,disabled=false}:{icon:string;label:string;desc:string;value:boolean;onToggle:(v:boolean)=>void;theme:any;disabled?:boolean}) {
  return (
    <View style={{flexDirection:'row',alignItems:'center',paddingVertical:12,gap:12,opacity:disabled?0.45:1}}>
      <View style={{width:36,height:36,borderRadius:10,backgroundColor:theme.backgroundSecondary,alignItems:'center',justifyContent:'center'}}>
        <MaterialIcons name={icon as any} size={18} color={theme.textSecondary} />
      </View>
      <View style={{flex:1}}>
        <Text style={{fontSize:15,fontFamily:'Cairo_600SemiBold',color:theme.textPrimary}}>{label}</Text>
        <Text style={{fontSize:11,fontFamily:'Cairo_400Regular',color:theme.textMuted,marginTop:1}}>{desc}</Text>
      </View>
      <Switch value={value} onValueChange={disabled?undefined:onToggle} disabled={disabled} trackColor={{false:'#CBD5E1',true:theme.primary+'60'}} thumbColor={value?theme.primary:'#F8FAFC'} />
    </View>
  );
}

function Divider({ theme }: { theme:any }) {
  return <View style={{height:1,backgroundColor:theme.border}} />;
}

// ─── Tab types ────────────────────────────────────────────────────────────────
type ProfileTab = 'activity' | 'footprint' | 'submitted' | 'badges';

const STATUS_CONFIG: Record<string,{label:string;color:string;icon:any}> = {
  pending:  {label:'قيد المراجعة',color:'#F59E0B',icon:'pending-actions'},
  approved: {label:'منشور',       color:'#22C55E',icon:'check-circle'},
  rejected: {label:'مرفوض',       color:'#EF4444',icon:'cancel'},
};

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark, toggleTheme } = useTheme();
  const { savedToolIds, votedToolIds, userRatings } = useAppContext();
  const { user, logout } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const s = useMemo(()=>createStyles(theme),[theme]);
  const {
    unlockedAchievements, totalPoints, levelInfo, streakData, unreadNotifCount,
  } = useAchievements();

  const [activeTab, setActiveTab] = useState<ProfileTab>('activity');
  const [submittedTools, setSubmittedTools] = useState<Tool[]>([]);
  const [submittedLoading, setSubmittedLoading] = useState(false);
  const { tools } = useAppContext();

  // ── Footprint data ──────────────────────────────────────────────────────────
  const footprintData = useMemo(()=>{
    const interactedIds=[...new Set([...votedToolIds,...savedToolIds])];
    const ratedIds=Object.keys(userRatings);
    const allIds=[...new Set([...interactedIds,...ratedIds])];
    if (allIds.length===0) return null;
    const catCount:Record<string,number>={};
    const tagCount:Record<string,number>={};
    allIds.forEach(id=>{
      const tool=tools.find(t=>t.id===id);
      if (!tool) return;
      const w=(savedToolIds.includes(id)?3:0)+(votedToolIds.includes(id)?2:0)+(userRatings[id]?1:0);
      catCount[tool.category]=(catCount[tool.category]||0)+w;
      tool.tags.forEach(tag=>{tagCount[tag]=(tagCount[tag]||0)+w;});
    });
    const totalCat=Object.values(catCount).reduce((a,b)=>a+b,0)||1;
    const totalTag=Object.values(tagCount).reduce((a,b)=>a+b,0)||1;
    const sortedCats=Object.entries(catCount).sort(([,a],[,b])=>b-a).slice(0,6).map(([name,count])=>({name,count,pct:Math.round((count/totalCat)*100)}));
    const sortedTags=Object.entries(tagCount).sort(([,a],[,b])=>b-a).slice(0,8).map(([name,count])=>({name,count,pct:Math.round((count/totalTag)*100)}));
    const totalInteractions=savedToolIds.length+votedToolIds.length+Object.keys(userRatings).length;
    return {cats:sortedCats,tags:sortedTags,totalInteractions,uniqueTools:allIds.length};
  },[tools,savedToolIds,votedToolIds,userRatings]);

  const loadSubmitted = useCallback(async()=>{
    if (!user?.id) return;
    setSubmittedLoading(true);
    const t=await fetchUserSubmittedTools(user.id);
    setSubmittedTools(t);
    setSubmittedLoading(false);
  },[user?.id]);

  useEffect(()=>{ if (activeTab==='submitted') loadSubmitted(); },[activeTab,loadSubmitted]);

  const submittedStats = useMemo(()=>({
    pending:  submittedTools.filter(t=>t.status==='pending').length,
    approved: submittedTools.filter(t=>t.status==='approved').length,
    rejected: submittedTools.filter(t=>t.status==='rejected').length,
  }),[submittedTools]);

  const stats = [
    {icon:'bookmark' as const,label:'محفوظ',value:savedToolIds.length,color:theme.primary},
    {icon:'arrow-upward' as const,label:'صوّت',value:votedToolIds.length,color:theme.upvote},
    {icon:'star' as const,label:'قيّم',value:Object.keys(userRatings).length,color:theme.star},
  ];

  const handleLogout = async()=>{
    showAlert('تسجيل الخروج','هل أنت متأكد من تسجيل الخروج؟',[
      {text:'إلغاء',style:'cancel'},
      {text:'خروج',style:'destructive',onPress:async()=>{
        const {error}=await logout();
        if (error) showAlert('خطأ',error);
      }},
    ]);
  };

  const displayName = user?.username||user?.email?.split('@')[0]||'مستخدم';
  const initials = displayName.split(' ').map((n:string)=>n[0]).join('').slice(0,2);

  const [showQR, setShowQR] = useState(false);

  // ─── Settings groups (organized) ──────────────────────────────────────────
  const accountSettings = [
    {icon:'person',label:'تعديل الملف الشخصي',desc:'الاسم والبريد الإلكتروني',action:()=>router.push('/edit-profile')},
    {icon:'shield',label:'الخصوصية والأمان',desc:'كلمة المرور، تسجيل الخروج',action:()=>router.push('/change-password')},
    {icon:'admin-panel-settings',label:'لوحة التحكم',desc:'إدارة المنصة',action:()=>router.push('/admin')},
  ];
  const developerSettings = [
    {icon:'add-circle',label:'إضافة أداة',desc:'شارك أداتك مع المجتمع',action:()=>router.push('/submit-tool')},
    {icon:'code',label:'الوصول لـ API',desc:'المفاتيح والتوثيق',action:()=>Haptics.selectionAsync()},
  ];
  const appSettings = [
    {icon:'info',label:'عن التطبيق',desc:'الإصدار، القانوني، المطور',action:()=>router.push('/about')},
    {icon:'person-pin',label:'صفحة مستر جيشو',desc:'تعرف على المبرمج',action:()=>router.push('/developer-info')},
    {icon:'emoji-events',label:'الإنجازات',desc:`${unlockedAchievements.length} إنجاز مكتمل · ${totalPoints} نقطة`,action:()=>router.push('/achievements')},
  ];

  return (
    <SafeAreaView edges={['top']} style={s.container}>
      <ScrollView contentContainerStyle={{paddingBottom:insets.bottom+16}} showsVerticalScrollIndicator={false}>

        {/* QR Modal */}
        <QRCodeModal
          visible={showQR}
          userName={displayName}
          onClose={() => setShowQR(false)}
          theme={theme}
        />

        {/* ── Profile Header ── */}
        <View style={s.profileSection}>
          <Pressable onPress={() => { Haptics.selectionAsync(); setShowQR(true); }} style={{ position: 'relative' }}>
            <LinearGradient colors={[theme.primaryDark,theme.primary]} start={{x:0,y:0}} end={{x:1,y:1}} style={s.avatarContainer}>
              <Text style={s.avatarText}>{initials}</Text>
            </LinearGradient>
            <View style={[s.qrBadge,{backgroundColor:theme.surface,borderColor:theme.border}]}>
              <MaterialIcons name="qr-code" size={11} color={theme.primary} />
            </View>
          </Pressable>
          <Text style={s.userName}>{displayName}</Text>
          <Text style={s.userEmail}>{user?.email||''}</Text>
          {/* Level badge */}
          <Pressable onPress={()=>{Haptics.selectionAsync();setActiveTab('badges');}} style={s.levelRow}>
            <LinearGradient colors={['#3B82F6','#8B5CF6']} start={{x:0,y:0}} end={{x:1,y:0}} style={s.levelBadge}>
              <MaterialIcons name="auto-awesome" size={13} color="#FFF" />
              <Text style={s.levelText}>المستوى {levelInfo.level} · {levelInfo.title}</Text>
            </LinearGradient>
            {streakData.currentStreak > 0 && (
              <View style={s.streakPill}>
                <Text style={{fontSize:13}}>🔥</Text>
                <Text style={[s.streakPillText,{color:'#F97316'}]}>{streakData.currentStreak} يوم</Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* ── Tabs ── */}
        <View style={s.profileTabs}>
          {(['activity','footprint','badges','submitted'] as ProfileTab[]).map(tab=>(
            <Pressable key={tab} style={[s.profileTab,activeTab===tab&&{borderBottomColor:theme.primary,borderBottomWidth:2}]}
              onPress={()=>{Haptics.selectionAsync();setActiveTab(tab);}}>
              <Text style={[s.profileTabText,activeTab===tab&&{color:theme.primary,fontFamily:'Cairo_700Bold'}]}>
                {tab==='activity'?'نشاطي':tab==='footprint'?'بصمتي':tab==='badges'?'شاراتي':'أدواتي'}
              </Text>
              {tab==='submitted'&&submittedTools.length>0&&<View style={[s.tabBadge,{backgroundColor:theme.primary}]}><Text style={s.tabBadgeText}>{submittedTools.length}</Text></View>}
              {tab==='footprint'&&footprintData&&<View style={[s.tabBadge,{backgroundColor:'#A78BFA'}]}><Text style={s.tabBadgeText}>{footprintData.uniqueTools}</Text></View>}
              {tab==='badges'&&unlockedAchievements.length>0&&<View style={[s.tabBadge,{backgroundColor:'#F59E0B'}]}><Text style={s.tabBadgeText}>{unlockedAchievements.length}</Text></View>}
            </Pressable>
          ))}
        </View>

        {/* ── Tab: Badges / Achievements ── */}
        {activeTab==='badges'&&(
          <View style={{paddingHorizontal:16,paddingTop:16,gap:16}}>
            {/* Level card */}
            <LinearGradient colors={['#3B82F6','#8B5CF6','#EC4899']} start={{x:0,y:0}} end={{x:1,y:1}} style={s.levelCard}>
              <View style={{flexDirection:'row',alignItems:'center',gap:12}}>
                <View style={s.levelIconBg}><Text style={s.levelIconText}>{levelInfo.level}</Text></View>
                <View style={{flex:1}}>
                  <Text style={s.levelCardTitle}>{levelInfo.title}</Text>
                  <Text style={s.levelCardSub}>{totalPoints} نقطة · {unlockedAchievements.length} إنجاز</Text>
                </View>
                <View style={s.streakCard}>
                  <Text style={{fontSize:18}}>🔥</Text>
                  <Text style={s.streakCardText}>{streakData.currentStreak}</Text>
                </View>
              </View>
              <View style={s.levelProgress}>
                <View style={{flexDirection:'row',justifyContent:'space-between',marginBottom:4}}>
                  <Text style={s.levelProgressLabel}>نحو المستوى {levelInfo.level+1}</Text>
                  <Text style={s.levelProgressPct}>{levelInfo.progress}%</Text>
                </View>
                <View style={s.levelProgressTrack}>
                  <View style={[s.levelProgressFill,{width:`${levelInfo.progress}%` as any}]} />
                </View>
              </View>
            </LinearGradient>

            {/* Recent unlocked */}
            {unlockedAchievements.length > 0 && (
              <View>
                <Text style={[s.sectionLabelMini,{color:theme.textMuted}]}>آخر الإنجازات المكتملة</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:10,paddingTop:8}}>
                  {unlockedAchievements.slice(0,8).map(ach=>(
                    <AchievementMini key={ach.id} ach={ach} theme={theme} />
                  ))}
                </ScrollView>
              </View>
            )}

            {/* View all button */}
            <Pressable onPress={()=>{Haptics.selectionAsync();router.push('/achievements');}} style={[s.viewAllBtn,{borderColor:theme.primary+'40',backgroundColor:theme.primary+'10'}]}>
              <MaterialIcons name="emoji-events" size={18} color={theme.primary} />
              <Text style={[s.viewAllBtnText,{color:theme.primary}]}>عرض جميع الإنجازات ({([] as any[]).concat(unlockedAchievements).length})</Text>
              <MaterialIcons name="arrow-back" size={16} color={theme.primary} />
            </Pressable>

            {/* Notification Settings inline */}
            <View>
              <Text style={[s.sectionLabelMini,{color:theme.textMuted,marginBottom:8}]}>إعدادات الإشعارات</Text>
              <View style={[s.settingsGroupCard,{marginBottom:0}]}>
                <NotifSettingsCard theme={theme} s={s} />
              </View>
            </View>
          </View>
        )}

        {/* ── Tab: Footprint ── */}
        {activeTab==='footprint'&&(
          <FootprintSection
            data={footprintData} theme={theme} s={s} router={router} userName={displayName}
            levelInfo={levelInfo} unlockedAchievements={unlockedAchievements} streakData={streakData}
          />
        )}

        {/* ── Tab: Submitted Tools ── */}
        {activeTab==='submitted'&&(
          <View style={{paddingHorizontal:16,paddingTop:14}}>
            {submittedTools.length>0&&(
              <View style={s.submittedSummary}>
                {(Object.keys(STATUS_CONFIG) as (keyof typeof STATUS_CONFIG)[]).map(key=>{
                  const cfg=STATUS_CONFIG[key];
                  return (
                    <View key={key} style={s.summaryStat}>
                      <View style={[s.summaryIconBg,{backgroundColor:cfg.color+'20'}]}><MaterialIcons name={cfg.icon} size={16} color={cfg.color} /></View>
                      <Text style={[s.summaryValue,{color:cfg.color}]}>{submittedStats[key as 'pending'|'approved'|'rejected']}</Text>
                      <Text style={s.summaryLabel}>{cfg.label}</Text>
                    </View>
                  );
                })}
              </View>
            )}
            {submittedLoading?(
              <ActivityIndicator size="large" color={theme.primary} style={{marginTop:48}} />
            ):submittedTools.length===0?(
              <View style={s.emptySubmitted}>
                <View style={s.emptyIconBg}><MaterialIcons name="add-circle-outline" size={44} color={theme.textMuted} /></View>
                <Text style={s.emptyTitle}>لم تُرسِل أي أداة بعد</Text>
                <Text style={s.emptySubtitle}>شارك أداتك مع المجتمع</Text>
                <Pressable style={[s.emptyBtn,{backgroundColor:theme.primary}]} onPress={()=>router.push('/submit-tool')}>
                  <MaterialIcons name="add" size={16} color="#FFF" /><Text style={s.emptyBtnText}>إضافة أداة</Text>
                </Pressable>
              </View>
            ):(
              submittedTools.map(tool=>{
                const statusKey=(tool.status||'pending') as keyof typeof STATUS_CONFIG;
                const status=STATUS_CONFIG[statusKey]||STATUS_CONFIG['pending'];
                return (
                  <View key={tool.id} style={s.submittedCard}>
                    <View style={s.submittedHeader}>
                      <View style={[s.submittedLogo,{backgroundColor:tool.logoColor+'20'}]}><MaterialIcons name={tool.logoIcon as any} size={22} color={tool.logoColor} /></View>
                      <View style={{flex:1}}>
                        <Text style={s.submittedName} numberOfLines={1}>{tool.name}</Text>
                        <Text style={s.submittedCategory}>{tool.category} · {tool.pricing}</Text>
                      </View>
                      <View style={[s.statusBadge,{backgroundColor:status.color+'18'}]}>
                        <MaterialIcons name={status.icon} size={12} color={status.color} />
                        <Text style={[s.statusText,{color:status.color}]}>{status.label}</Text>
                      </View>
                    </View>
                    <Text style={s.submittedDesc} numberOfLines={2}>{tool.shortDescription}</Text>
                    <View style={s.submittedStatsRow}>
                      <View style={s.submittedStat}><MaterialIcons name="arrow-upward" size={13} color={theme.upvote} /><Text style={[s.submittedStatVal,{color:theme.upvote}]}>{tool.votes}</Text><Text style={s.submittedStatLabel}>تصويت</Text></View>
                      <View style={s.submittedStat}><MaterialIcons name="star" size={13} color={theme.star} /><Text style={[s.submittedStatVal,{color:theme.star}]}>{tool.rating}</Text><Text style={s.submittedStatLabel}>تقييم</Text></View>
                      {tool.status==='approved'&&<Pressable style={s.viewBtn} onPress={()=>router.push(`/tool/${tool.id}` as any)}><Text style={[s.viewBtnText,{color:theme.primary}]}>عرض</Text><MaterialIcons name="arrow-back" size={12} color={theme.primary} /></Pressable>}
                    </View>
                    {tool.tags.length>0&&<View style={s.tagsRow}>{tool.tags.slice(0,4).map(tag=><View key={tag} style={s.tag}><Text style={s.tagText}>#{tag}</Text></View>)}</View>}
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* ── Tab: Activity ── */}
        {activeTab==='activity'&&(
          <>
            <View style={s.statsRow}>
              {stats.map((stat,i)=>(
                <View key={i} style={s.statCard}>
                  <View style={[s.statIconBg,{backgroundColor:stat.color+'20'}]}><MaterialIcons name={stat.icon} size={20} color={stat.color} /></View>
                  <Text style={[s.statValue,{color:stat.color}]}>{stat.value}</Text>
                  <Text style={s.statLabel}>{stat.label}</Text>
                </View>
              ))}
            </View>

            {/* Theme Toggle */}
            <View style={s.themeSection}>
              <View style={s.themeCard}>
                <View style={s.themeLeft}>
                  <View style={[s.themeIcon,{backgroundColor:(isDark?'#FBBF24':'#6366F1')+'20'}]}>
                    <MaterialIcons name={isDark?'dark-mode':'light-mode'} size={22} color={isDark?'#FBBF24':'#6366F1'} />
                  </View>
                  <View>
                    <Text style={s.themeLabel}>المظهر</Text>
                    <Text style={s.themeDesc}>{isDark?'الوضع الداكن':'الوضع الفاتح'}</Text>
                  </View>
                </View>
                <Switch value={isDark} onValueChange={()=>{Haptics.selectionAsync();toggleTheme();}} trackColor={{false:'#CBD5E1',true:theme.primary+'60'}} thumbColor={isDark?theme.primary:'#F8FAFC'} />
              </View>
            </View>

            {/* Quick Action */}
            <View style={s.quickActions}>
              <Pressable style={s.submitButton} onPress={()=>router.push('/submit-tool')}>
                <LinearGradient colors={[theme.accent,theme.accentDark]} start={{x:0,y:0}} end={{x:1,y:0}} style={s.submitGradient}>
                  <MaterialIcons name="add-circle" size={20} color="#FFF" />
                  <Text style={s.submitText}>أضف أداتك</Text>
                </LinearGradient>
              </Pressable>
            </View>

            {/* ── Organized Settings ── */}
            {/* Account */}
            <View style={s.settingsGroup}>
              <Text style={s.groupTitle}>الحساب</Text>
              <View style={s.settingsGroupCard}>
                {accountSettings.map((item,i)=>(
                  <React.Fragment key={item.label}>
                    {i>0&&<View style={[s.settingsDivider,{backgroundColor:theme.border}]} />}
                    <Pressable style={s.settingsItem} onPress={item.action}>
                      <View style={s.settingsIcon}><MaterialIcons name={item.icon as any} size={20} color={theme.textSecondary} /></View>
                      <View style={s.settingsInfo}><Text style={s.settingsLabel}>{item.label}</Text><Text style={s.settingsDesc}>{item.desc}</Text></View>
                      <MaterialIcons name="chevron-left" size={22} color={theme.textMuted} />
                    </Pressable>
                  </React.Fragment>
                ))}
              </View>
            </View>

            {/* Developer */}
            <View style={s.settingsGroup}>
              <Text style={s.groupTitle}>المطور</Text>
              <View style={s.settingsGroupCard}>
                {developerSettings.map((item,i)=>(
                  <React.Fragment key={item.label}>
                    {i>0&&<View style={[s.settingsDivider,{backgroundColor:theme.border}]} />}
                    <Pressable style={s.settingsItem} onPress={item.action}>
                      <View style={s.settingsIcon}><MaterialIcons name={item.icon as any} size={20} color={theme.textSecondary} /></View>
                      <View style={s.settingsInfo}><Text style={s.settingsLabel}>{item.label}</Text><Text style={s.settingsDesc}>{item.desc}</Text></View>
                      <MaterialIcons name="chevron-left" size={22} color={theme.textMuted} />
                    </Pressable>
                  </React.Fragment>
                ))}
              </View>
            </View>

            {/* App */}
            <View style={s.settingsGroup}>
              <Text style={s.groupTitle}>التطبيق</Text>
              <View style={s.settingsGroupCard}>
                {appSettings.map((item,i)=>(
                  <React.Fragment key={item.label}>
                    {i>0&&<View style={[s.settingsDivider,{backgroundColor:theme.border}]} />}
                    <Pressable style={s.settingsItem} onPress={item.action}>
                      <View style={s.settingsIcon}><MaterialIcons name={item.icon as any} size={20} color={theme.textSecondary} /></View>
                      <View style={s.settingsInfo}><Text style={s.settingsLabel}>{item.label}</Text><Text style={s.settingsDesc}>{item.desc}</Text></View>
                      <MaterialIcons name="chevron-left" size={22} color={theme.textMuted} />
                    </Pressable>
                  </React.Fragment>
                ))}
              </View>
            </View>

            {/* Logout */}
            <View style={s.logoutSection}>
              <Pressable style={s.logoutButton} onPress={handleLogout}>
                <MaterialIcons name="logout" size={20} color={theme.error} />
                <Text style={s.logoutText}>تسجيل الخروج</Text>
              </Pressable>
            </View>

            {/* Footer */}
            <View style={s.versionRow}>
              <Text style={s.versionText}>مستر جيشو الإصدار 1.0.0</Text>
              <Text style={s.versionCopyright}>{'© 2026 مستر جيشو'}</Text>
              <Pressable onPress={()=>{Haptics.selectionAsync();router.push('/developer-info' as any);}} style={[s.developerLink,{borderColor:theme.primary+'35',backgroundColor:theme.primary+'10'}]}>
                <MaterialIcons name="code" size={14} color={theme.primary} />
                <Text style={[s.developerLinkText,{color:theme.primary}]}>تصميم وبرمجة مستر جيشو</Text>
                <MaterialIcons name="chevron-left" size={14} color={theme.primary} />
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container:{flex:1,backgroundColor:theme.background},
  profileSection:{alignItems:'center',paddingTop:20,paddingBottom:16,paddingHorizontal:16},
  avatarContainer:{width:80,height:80,borderRadius:40,alignItems:'center',justifyContent:'center',marginBottom:14},
  qrBadge:{position:'absolute',bottom:-2,right:-2,width:22,height:22,borderRadius:11,borderWidth:1,alignItems:'center',justifyContent:'center'},
  avatarText:{fontSize:28,fontFamily:'Cairo_700Bold',color:'#FFF'},
  userName:{fontSize:20,fontFamily:'Cairo_600SemiBold',color:theme.textPrimary,marginBottom:4},
  userEmail:{fontSize:13,fontFamily:'Cairo_400Regular',color:theme.textMuted,marginBottom:8},
  levelRow:{flexDirection:'row',alignItems:'center',gap:8,marginTop:4},
  levelBadge:{flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:12,paddingVertical:6,borderRadius:9999},
  levelText:{fontSize:12,fontFamily:'Cairo_600SemiBold',color:'#FFF'},
  streakPill:{flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:10,paddingVertical:5,borderRadius:9999,backgroundColor:'#F9730015',borderWidth:1,borderColor:'#F9730030'},
  streakPillText:{fontSize:12,fontFamily:'Cairo_600SemiBold'},
  profileTabs:{flexDirection:'row',borderBottomWidth:1,borderBottomColor:theme.border,marginHorizontal:16,marginBottom:4},
  profileTab:{flex:1,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,paddingVertical:12,borderBottomWidth:2,borderBottomColor:'transparent'},
  profileTabText:{fontSize:13,fontFamily:'Cairo_600SemiBold',color:theme.textMuted},
  tabBadge:{minWidth:18,height:18,borderRadius:9,paddingHorizontal:4,alignItems:'center',justifyContent:'center'},
  tabBadgeText:{fontSize:10,fontFamily:'Cairo_700Bold',color:'#FFF'},
  // Level card
  levelCard:{borderRadius:20,padding:18,gap:14,marginHorizontal:0},
  levelIconBg:{width:52,height:52,borderRadius:14,backgroundColor:'rgba(255,255,255,0.25)',alignItems:'center',justifyContent:'center'},
  levelIconText:{fontSize:22,fontFamily:'Cairo_700Bold',color:'#FFF'},
  levelCardTitle:{fontSize:18,fontFamily:'Cairo_700Bold',color:'#FFF'},
  levelCardSub:{fontSize:12,fontFamily:'Cairo_400Regular',color:'rgba(255,255,255,0.8)'},
  streakCard:{backgroundColor:'rgba(255,255,255,0.2)',borderRadius:12,paddingHorizontal:12,paddingVertical:8,alignItems:'center',gap:2},
  streakCardText:{fontSize:14,fontFamily:'Cairo_700Bold',color:'#FFF'},
  levelProgress:{gap:0},
  levelProgressLabel:{fontSize:12,fontFamily:'Cairo_500Medium',color:'rgba(255,255,255,0.8)'},
  levelProgressPct:{fontSize:12,fontFamily:'Cairo_700Bold',color:'#FFF'},
  levelProgressTrack:{height:8,borderRadius:4,backgroundColor:'rgba(255,255,255,0.25)',overflow:'hidden'},
  levelProgressFill:{height:'100%',borderRadius:4,backgroundColor:'#FFF'},
  sectionLabelMini:{fontSize:12,fontFamily:'Cairo_600SemiBold',letterSpacing:0.5},
  viewAllBtn:{flexDirection:'row',alignItems:'center',gap:8,paddingVertical:13,paddingHorizontal:16,borderRadius:12,borderWidth:1.5,justifyContent:'center'},
  viewAllBtnText:{fontSize:14,fontFamily:'Cairo_600SemiBold',flex:1},
  // Stats
  statsRow:{flexDirection:'row',paddingHorizontal:16,gap:12,marginTop:16,marginBottom:20},
  statCard:{flex:1,backgroundColor:theme.surface,borderRadius:12,padding:14,alignItems:'center',borderWidth:1,borderColor:theme.border},
  statIconBg:{width:36,height:36,borderRadius:10,alignItems:'center',justifyContent:'center',marginBottom:8},
  statValue:{fontSize:24,fontFamily:'Cairo_700Bold',marginBottom:2},
  statLabel:{fontSize:11,fontFamily:'Cairo_500Medium',color:theme.textMuted},
  // Theme
  themeSection:{paddingHorizontal:16,marginBottom:20},
  themeCard:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',backgroundColor:theme.surface,borderRadius:12,padding:14,borderWidth:1,borderColor:theme.border},
  themeLeft:{flexDirection:'row',alignItems:'center',gap:12},
  themeIcon:{width:40,height:40,borderRadius:10,alignItems:'center',justifyContent:'center'},
  themeLabel:{fontSize:16,fontFamily:'Cairo_600SemiBold',color:theme.textPrimary},
  themeDesc:{fontSize:12,fontFamily:'Cairo_400Regular',color:theme.textMuted},
  // Quick actions
  quickActions:{paddingHorizontal:16,marginBottom:24},
  submitButton:{borderRadius:12,overflow:'hidden'},
  submitGradient:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,paddingVertical:14},
  submitText:{fontSize:16,fontFamily:'Cairo_600SemiBold',color:'#FFF'},
  // Settings
  settingsGroup:{paddingHorizontal:16,marginBottom:20},
  groupTitle:{fontSize:11,fontFamily:'Cairo_500Medium',color:theme.textMuted,letterSpacing:1,marginBottom:8,marginLeft:4},
  settingsGroupCard:{backgroundColor:theme.surface,borderRadius:12,borderWidth:1,borderColor:theme.border,overflow:'hidden',padding:4},
  settingsItem:{flexDirection:'row',alignItems:'center',padding:12,gap:12},
  settingsDivider:{height:1,marginHorizontal:12},
  settingsIcon:{width:36,height:36,borderRadius:10,backgroundColor:theme.backgroundSecondary,alignItems:'center',justifyContent:'center'},
  settingsInfo:{flex:1},
  settingsLabel:{fontSize:15,fontFamily:'Cairo_600SemiBold',color:theme.textPrimary,marginBottom:1},
  settingsDesc:{fontSize:11,fontFamily:'Cairo_500Medium',color:theme.textMuted},
  // Notif settings
  testNotifBtn:{flexDirection:'row',alignItems:'center',gap:6,paddingVertical:12,paddingHorizontal:4,justifyContent:'center'},
  testNotifText:{fontSize:14,fontFamily:'Cairo_600SemiBold'},
  // Logout
  logoutSection:{paddingHorizontal:16,marginBottom:20},
  logoutButton:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,paddingVertical:14,backgroundColor:theme.surface,borderRadius:12,borderWidth:1,borderColor:theme.error+'30'},
  logoutText:{fontSize:16,fontFamily:'Cairo_600SemiBold',color:theme.error},
  // Version
  versionRow:{alignItems:'center',paddingTop:12,paddingBottom:16,gap:6},
  versionText:{fontSize:11,fontFamily:'Cairo_400Regular',color:theme.textMuted},
  versionCopyright:{fontSize:11,fontFamily:'Cairo_400Regular',color:theme.textMuted,opacity:0.6},
  developerLink:{flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:14,paddingVertical:8,borderRadius:9999,borderWidth:1,marginTop:2},
  developerLinkText:{fontSize:13,fontFamily:'Cairo_600SemiBold'},
  // Footprint
  fpContainer:{paddingHorizontal:16,paddingTop:16,gap:20},
  fpShareBtn:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,paddingVertical:13,borderRadius:12,borderWidth:1.5},
  fpShareText:{fontSize:15,fontFamily:'Cairo_600SemiBold'},
  fpEmptyBox:{alignItems:'center',paddingVertical:64,gap:12},
  fpEmptyIconBg:{width:96,height:96,borderRadius:48,backgroundColor:theme.surface,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:theme.border},
  fpEmptyTitle:{fontSize:18,fontFamily:'Cairo_600SemiBold',color:theme.textPrimary,textAlign:'center'},
  fpEmptySub:{fontSize:13,fontFamily:'Cairo_400Regular',color:theme.textMuted,textAlign:'center',maxWidth:260,lineHeight:20},
  fpSummaryRow:{flexDirection:'row',gap:10},
  fpSumCard:{flex:1,backgroundColor:theme.surface,borderRadius:14,padding:14,alignItems:'center',gap:4,borderWidth:1,borderColor:theme.border},
  fpSumIconBg:{width:40,height:40,borderRadius:12,alignItems:'center',justifyContent:'center',marginBottom:2},
  fpSumValue:{fontSize:22,fontFamily:'Cairo_700Bold'},
  fpSumLabel:{fontSize:11,fontFamily:'Cairo_400Regular',color:theme.textMuted,textAlign:'center'},
  fpCard:{backgroundColor:theme.surface,borderRadius:16,padding:16,borderWidth:1,borderColor:theme.border},
  fpCardHeader:{flexDirection:'row',alignItems:'center',gap:8,marginBottom:16},
  fpCardTitle:{fontSize:16,fontFamily:'Cairo_700Bold',color:theme.textPrimary,flex:1},
  fpCardSubtitle:{fontSize:11,fontFamily:'Cairo_400Regular',color:theme.textMuted},
  fpPieRow:{flexDirection:'row',alignItems:'center',gap:16},
  fpDonutWrapper:{position:'relative',alignItems:'center',justifyContent:'center'},
  fpDonutCenter:{position:'absolute',alignItems:'center',justifyContent:'center'},
  fpDonutValue:{fontSize:20,fontFamily:'Cairo_700Bold',color:theme.textPrimary},
  fpDonutLabel:{fontSize:9,fontFamily:'Cairo_400Regular',color:theme.textMuted,marginTop:-2},
  fpLegend:{flex:1,gap:6},
  fpLegendItem:{flexDirection:'row',alignItems:'center',gap:8},
  fpLegendDot:{width:10,height:10,borderRadius:5},
  fpLegendName:{flex:1,fontSize:12,fontFamily:'Cairo_500Medium',color:theme.textSecondary},
  fpLegendPct:{fontSize:12,fontFamily:'Cairo_700Bold'},
  fpBarList:{gap:10},
  fpBarItem:{gap:4},
  fpBarTopRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  fpBarName:{fontSize:13,fontFamily:'Cairo_500Medium',color:theme.textSecondary},
  fpBarCount:{fontSize:12,fontFamily:'Cairo_700Bold'},
  fpTagsCloud:{flexDirection:'row',flexWrap:'wrap',gap:8},
  fpTagChip:{flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:12,paddingVertical:6,borderRadius:9999,borderWidth:1.5},
  fpTagName:{fontSize:12},
  fpTagBadge:{minWidth:20,height:20,borderRadius:10,paddingHorizontal:4,alignItems:'center',justifyContent:'center'},
  fpTagBadgeText:{fontSize:9,fontFamily:'Cairo_700Bold'},
  fpPersonaCard:{borderRadius:16,overflow:'hidden',borderWidth:1,borderColor:theme.primary+'40'},
  fpPersonaInner:{flexDirection:'row',alignItems:'center',gap:14,padding:16},
  fpPersonaIconBg:{width:52,height:52,borderRadius:14,alignItems:'center',justifyContent:'center'},
  fpPersonaTitle:{fontSize:15,fontFamily:'Cairo_700Bold',color:theme.textPrimary},
  fpPersonaSub:{fontSize:12,fontFamily:'Cairo_400Regular',color:theme.textSecondary,marginTop:3,lineHeight:18},
  // Submitted
  submittedSummary:{flexDirection:'row',backgroundColor:theme.surface,borderRadius:14,padding:14,marginBottom:16,borderWidth:1,borderColor:theme.border},
  summaryStat:{flex:1,alignItems:'center',gap:4},
  summaryIconBg:{width:32,height:32,borderRadius:8,alignItems:'center',justifyContent:'center'},
  summaryValue:{fontSize:20,fontFamily:'Cairo_700Bold'},
  summaryLabel:{fontSize:10,fontFamily:'Cairo_500Medium',color:theme.textMuted,textAlign:'center'},
  submittedCard:{backgroundColor:theme.surface,borderRadius:16,padding:14,marginBottom:12,borderWidth:1,borderColor:theme.border},
  submittedHeader:{flexDirection:'row',alignItems:'center',gap:10,marginBottom:8},
  submittedLogo:{width:44,height:44,borderRadius:12,alignItems:'center',justifyContent:'center'},
  submittedName:{fontSize:15,fontFamily:'Cairo_700Bold',color:theme.textPrimary},
  submittedCategory:{fontSize:11,fontFamily:'Cairo_400Regular',color:theme.textMuted,marginTop:2},
  statusBadge:{flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:8,paddingVertical:4,borderRadius:9999},
  statusText:{fontSize:10,fontFamily:'Cairo_600SemiBold'},
  submittedDesc:{fontSize:13,fontFamily:'Cairo_400Regular',color:theme.textSecondary,textAlign:'right',lineHeight:20,marginBottom:10},
  submittedStatsRow:{flexDirection:'row',alignItems:'center',gap:14,marginBottom:8},
  submittedStat:{flexDirection:'row',alignItems:'center',gap:3},
  submittedStatVal:{fontSize:13,fontFamily:'Cairo_700Bold'},
  submittedStatLabel:{fontSize:11,fontFamily:'Cairo_400Regular',color:theme.textMuted},
  viewBtn:{flexDirection:'row',alignItems:'center',gap:2,marginLeft:'auto'},
  viewBtnText:{fontSize:12,fontFamily:'Cairo_600SemiBold'},
  tagsRow:{flexDirection:'row',flexWrap:'wrap',gap:6},
  tag:{paddingHorizontal:8,paddingVertical:3,borderRadius:9999,backgroundColor:theme.backgroundSecondary},
  tagText:{fontSize:10,fontFamily:'Cairo_500Medium',color:theme.textMuted},
  emptySubmitted:{alignItems:'center',paddingVertical:48,gap:10},
  emptyIconBg:{width:88,height:88,borderRadius:44,backgroundColor:theme.surface,alignItems:'center',justifyContent:'center',marginBottom:4},
  emptyTitle:{fontSize:18,fontFamily:'Cairo_600SemiBold',color:theme.textPrimary},
  emptySubtitle:{fontSize:13,fontFamily:'Cairo_400Regular',color:theme.textMuted},
  emptyBtn:{flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:20,paddingVertical:10,borderRadius:10,marginTop:6},
  emptyBtnText:{fontSize:14,fontFamily:'Cairo_600SemiBold',color:'#FFF'},
});

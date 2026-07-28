/**
 * smartFeedService.ts — مستر جيشو
 * AI-powered content scoring & mixed feed builder (Tools + Posts)
 */
import { Tool } from './mockData';
import { Post } from './postsService';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ToolFeedItem {
  type: 'tool';
  data: Tool;
  score: number;
  reason: string;
  reasonIcon: string;
  reasonColor: string;
}

export interface PostFeedItem {
  type: 'post';
  data: Post;
  score: number;
  reason: string;
  reasonIcon: string;
  reasonColor: string;
}

export type FeedItem = ToolFeedItem | PostFeedItem;

export interface UserPrefs {
  categories: Map<string, number>;
  tags: Map<string, number>;
  hasInteractions: boolean;
}

// ─── Build User Preference Profile ───────────────────────────────────────────

export function buildUserPrefs(
  tools: Tool[],
  savedIds: string[],
  votedIds: string[]
): UserPrefs {
  const interactedIds = [...new Set([...savedIds, ...votedIds])];
  const interactedTools = interactedIds
    .map(id => tools.find(t => t.id === id))
    .filter(Boolean) as Tool[];

  const categories = new Map<string, number>();
  const tags = new Map<string, number>();

  interactedTools.forEach(t => {
    const weight = savedIds.includes(t.id) ? 2 : 1;
    categories.set(t.category, (categories.get(t.category) || 0) + weight);
    t.tags.forEach(tag => tags.set(tag, (tags.get(tag) || 0) + weight));
  });

  return { categories, tags, hasInteractions: interactedTools.length > 0 };
}

// ─── Score Tools ──────────────────────────────────────────────────────────────

function scoreTools(
  tools: Tool[],
  prefs: UserPrefs,
  savedIds: string[]
): ToolFeedItem[] {
  const now = Date.now();
  const dayMs = 86_400_000;

  return tools.map(t => {
    const ageDays = (now - new Date(t.createdAt).getTime()) / dayMs;
    const recency = Math.max(0, 21 - ageDays) * 1.4;
    const catBonus = (prefs.categories.get(t.category) || 0) * 18;
    const tagBonus = t.tags.reduce((sum, tag) => sum + (prefs.tags.get(tag) || 0) * 6, 0);
    // Push already-saved tools down so users discover new content
    const savedPenalty = savedIds.includes(t.id) ? -200 : 0;
    const quality = Math.min(t.votes, 600) * 0.22 + t.rating * 18;
    const signals =
      (t.trending ? 30 : 0) +
      (t.editorPick ? 24 : 0) +
      (t.isNew ? 20 : 0) +
      (t.featured ? 14 : 0);

    const score = quality + recency + catBonus + tagBonus + savedPenalty + signals;

    let reason = 'مقترح لك';
    let reasonIcon = 'auto-awesome';
    let reasonColor = '#A78BFA';

    if (catBonus > 20) {
      reason = `لأنك أحببت ${t.category}`;
      reasonIcon = 'favorite';
      reasonColor = '#EC4899';
    } else if (t.trending) {
      reason = 'الأكثر رواجاً';
      reasonIcon = 'local-fire-department';
      reasonColor = '#F97316';
    } else if (t.editorPick) {
      reason = 'اختيار المحررين';
      reasonIcon = 'verified';
      reasonColor = '#3B82F6';
    } else if (t.isNew) {
      reason = 'جديد هذا الأسبوع';
      reasonIcon = 'fiber-new';
      reasonColor = '#10B981';
    }

    return { type: 'tool' as const, data: t, score, reason, reasonIcon, reasonColor };
  });
}

// ─── Score Posts ──────────────────────────────────────────────────────────────

function scorePosts(posts: Post[], prefs: UserPrefs): PostFeedItem[] {
  const now = Date.now();
  const dayMs = 86_400_000;

  return posts.map(p => {
    const ageDays = (now - new Date(p.date).getTime()) / dayMs;
    const recency = Math.max(0, 30 - ageDays) * 1.1;
    const catBonus = (prefs.categories.get(p.category) || 0) * 15;
    const tagBonus = p.tags.reduce((sum, tag) => sum + (prefs.tags.get(tag) || 0) * 4, 0);
    const quality = Math.min(p.views, 6000) * 0.005 + p.likes * 0.15;
    const featuredBonus = p.featured ? 40 : 0;

    const score = quality + recency + catBonus + tagBonus + featuredBonus;

    let reason = 'مقال جديد';
    let reasonIcon = 'article';
    let reasonColor = '#64748B';

    if (p.featured) {
      reason = 'مقال مميز';
      reasonIcon = 'star';
      reasonColor = '#F59E0B';
    } else if (catBonus > 16) {
      reason = `لأنك أحببت ${p.category}`;
      reasonIcon = 'favorite';
      reasonColor = '#EC4899';
    } else if (ageDays < 3) {
      reason = 'نشر مؤخراً';
      reasonIcon = 'schedule';
      reasonColor = '#10B981';
    }

    return { type: 'post' as const, data: p, score, reason, reasonIcon, reasonColor };
  });
}

// ─── Build Mixed Smart Feed ───────────────────────────────────────────────────

export function buildSmartFeed(
  tools: Tool[],
  posts: Post[],
  prefs: UserPrefs,
  savedIds: string[]
): FeedItem[] {
  const sortedTools = scoreTools(tools, prefs, savedIds)
    .sort((a, b) => b.score - a.score)
    .slice(0, 18);

  const sortedPosts = scorePosts(posts, prefs)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  // Interleave pattern: 2 tools → 1 post → repeat
  const merged: FeedItem[] = [];
  let ti = 0;
  let pi = 0;

  while (ti < sortedTools.length || pi < sortedPosts.length) {
    if (ti < sortedTools.length) merged.push(sortedTools[ti++]);
    if (ti < sortedTools.length) merged.push(sortedTools[ti++]);
    if (pi < sortedPosts.length) merged.push(sortedPosts[pi++]);
  }

  return merged;
}

// ─── Build "Explore More" Data ────────────────────────────────────────────────

export function buildExploreMore(
  tools: Tool[],
  posts: Post[]
): { newTools: Tool[]; latestPosts: Post[] } {
  const newTools = [...tools]
    .filter(t => t.isNew || t.trending)
    .sort((a, b) => b.votes - a.votes)
    .slice(0, 10);

  const latestPosts = [...posts]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 3);

  return { newTools, latestPosts };
}

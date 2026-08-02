/**
 * remoteConfigService.ts — مستر جيشو
 * Home layout, navigation, feature flags, banners
 */
import { getSupabaseClient } from '@/template';

export interface HomeSection {
  id: string; type: string; title: string; enabled: boolean; order: number;
}
export interface NavItem {
  id: string; label: string; icon: string; route: string; enabled: boolean; order: number;
}
export interface FeatureFlag {
  id: string; key: string; enabled: boolean; description: string; updatedAt: string;
}
export interface Banner {
  id: string; title: string; description: string; imageUrl: string | null;
  buttonText: string; buttonUrl: string | null; type: string; placement: string;
  status: string; priority: number; bgColor: string; textColor: string;
  impressions: number; clicks: number; createdAt: string;
}

export const DEFAULT_HOME_SECTIONS: HomeSection[] = [
  { id: 'search', type: 'search_bar', title: 'شريط البحث', enabled: true, order: 0 },
  { id: 'categories', type: 'category_pills', title: 'الفئات السريعة', enabled: true, order: 1 },
  { id: 'smart_feed', type: 'smart_feed', title: '✨ مقترح لك', enabled: true, order: 2 },
  { id: 'explore_more', type: 'explore_more', title: '🚀 استكشف المزيد', enabled: true, order: 3 },
  { id: 'stats', type: 'stats_bar', title: 'إحصائيات المنصة', enabled: true, order: 4 },
];

let _cacheTime = 0;
const CACHE_TTL = 3 * 60 * 1000;
export function invalidateConfigCache() { _cacheTime = 0; }

export async function fetchHomeSections(): Promise<HomeSection[]> {
  const { data } = await getSupabaseClient()
    .from('home_layout_config').select('sections').eq('id', 'main').maybeSingle();
  return data?.sections
    ? (data.sections as HomeSection[]).sort((a, b) => a.order - b.order)
    : DEFAULT_HOME_SECTIONS;
}

export async function fetchAllFlags(): Promise<FeatureFlag[]> {
  const { data } = await getSupabaseClient()
    .from('feature_flags').select('*').order('key');
  return (data || []).map((f: any) => ({
    id: f.id, key: f.key, enabled: f.enabled,
    description: f.description || '', updatedAt: f.updated_at || '',
  }));
}

export async function fetchFlagsMap(): Promise<Record<string, boolean>> {
  const { data } = await getSupabaseClient().from('feature_flags').select('key, enabled');
  const map: Record<string, boolean> = {};
  (data || []).forEach((f: any) => { map[f.key] = f.enabled; });
  return map;
}

export async function updateFeatureFlag(key: string, enabled: boolean, userId: string): Promise<{ error: string | null }> {
  const { error } = await getSupabaseClient().from('feature_flags')
    .update({ enabled, updated_by: userId, updated_at: new Date().toISOString() }).eq('key', key);
  invalidateConfigCache();
  return { error: error?.message || null };
}

export async function updateHomeLayout(sections: HomeSection[], userId: string): Promise<{ error: string | null }> {
  const { error } = await getSupabaseClient().from('home_layout_config')
    .upsert({ id: 'main', sections, updated_by: userId, updated_at: new Date().toISOString() });
  return { error: error?.message || null };
}

export async function updateNavigation(items: NavItem[], userId: string): Promise<{ error: string | null }> {
  const { error } = await getSupabaseClient().from('navigation_config')
    .upsert({ id: 'main', items, updated_by: userId, updated_at: new Date().toISOString() });
  return { error: error?.message || null };
}

export async function fetchNavItems(): Promise<NavItem[]> {
  const { data } = await getSupabaseClient()
    .from('navigation_config').select('items').eq('id', 'main').maybeSingle();
  return data?.items
    ? (data.items as NavItem[]).sort((a, b) => a.order - b.order)
    : [
      { id: 'home', label: 'اكتشف', icon: 'explore', route: '/(tabs)/', enabled: true, order: 0 },
      { id: 'explore', label: 'تصفح', icon: 'category', route: '/(tabs)/explore', enabled: true, order: 1 },
      { id: 'saved', label: 'المحفوظات', icon: 'bookmark', route: '/(tabs)/saved', enabled: true, order: 2 },
      { id: 'notifications', label: 'إشعارات', icon: 'notifications', route: '/(tabs)/notifications', enabled: true, order: 3 },
      { id: 'profile', label: 'حسابي', icon: 'person', route: '/(tabs)/profile', enabled: true, order: 4 },
    ];
}

export async function fetchAllBanners(): Promise<Banner[]> {
  const { data } = await getSupabaseClient()
    .from('banners').select('*').order('priority', { ascending: false });
  return (data || []).map(mapBanner);
}

export async function createBanner(bannerData: Partial<Banner>, userId: string): Promise<{ id: string | null; error: string | null }> {
  const { data: result, error } = await getSupabaseClient().from('banners').insert({
    title: bannerData.title, description: bannerData.description || '',
    button_text: bannerData.buttonText || 'اعرف المزيد',
    button_url: bannerData.buttonUrl || null,
    type: bannerData.type || 'ad', placement: bannerData.placement || 'home',
    status: 'draft', priority: bannerData.priority || 0,
    bg_color: bannerData.bgColor || '#3B82F6', text_color: bannerData.textColor || '#FFFFFF',
    created_by: userId,
  }).select('id').single();
  if (error) return { id: null, error: error.message };
  return { id: result.id, error: null };
}

export async function updateBannerStatus(id: string, status: string): Promise<{ error: string | null }> {
  const { error } = await getSupabaseClient().from('banners')
    .update({ status, updated_at: new Date().toISOString() }).eq('id', id);
  return { error: error?.message || null };
}

export async function deleteBanner(id: string): Promise<{ error: string | null }> {
  const { error } = await getSupabaseClient().from('banners').delete().eq('id', id);
  return { error: error?.message || null };
}

function mapBanner(row: any): Banner {
  return {
    id: row.id, title: row.title, description: row.description || '',
    imageUrl: row.image_url, buttonText: row.button_text || 'اعرف المزيد',
    buttonUrl: row.button_url, type: row.type || 'ad', placement: row.placement || 'home',
    status: row.status || 'draft', priority: row.priority || 0,
    bgColor: row.bg_color || '#3B82F6', textColor: row.text_color || '#FFFFFF',
    impressions: row.impressions || 0, clicks: row.clicks || 0, createdAt: row.created_at || '',
  };
}

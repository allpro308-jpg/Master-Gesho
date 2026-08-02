/**
 * themeEngineService.ts — مستر جيشو
 * Dynamic theme management with database persistence
 */
import { getSupabaseClient } from '@/template';

export interface DbThemeTokens {
  primary: string;
  primaryDark: string;
  background: string;
  surface: string;
  card: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  tabBarBg: string;
  success: string;
  warning: string;
  error: string;
  info: string;
}

export interface AppTheme {
  id: string;
  name: string;
  slug: string;
  description: string;
  isActive: boolean;
  isDefault: boolean;
  darkMode: boolean;
  status: 'draft' | 'published' | 'archived';
  tokens: DbThemeTokens;
  createdAt: string;
}

export const DEFAULT_TOKENS: DbThemeTokens = {
  primary: '#3B82F6', primaryDark: '#1D4ED8',
  background: '#F8FAFC', surface: '#FFFFFF', card: '#FFFFFF',
  textPrimary: '#1E293B', textSecondary: '#475569', textMuted: '#94A3B8',
  border: '#E2E8F0', tabBarBg: '#FFFFFF',
  success: '#10B981', warning: '#F59E0B', error: '#EF4444', info: '#3B82F6',
};

function mapRow(row: any): AppTheme {
  return {
    id: row.id, name: row.name, slug: row.slug || '',
    description: row.description || '', isActive: row.is_active || false,
    isDefault: row.is_default || false, darkMode: row.dark_mode || false,
    status: row.status || 'draft',
    tokens: { ...DEFAULT_TOKENS, ...(row.tokens || {}) },
    createdAt: row.created_at || '',
  };
}

export async function fetchAllThemes(): Promise<AppTheme[]> {
  const { data } = await getSupabaseClient()
    .from('app_themes').select('*').order('created_at', { ascending: false });
  return (data || []).map(mapRow);
}

export async function fetchActiveTheme(): Promise<AppTheme | null> {
  const { data } = await getSupabaseClient()
    .from('app_themes').select('*').eq('is_active', true).eq('status', 'published').maybeSingle();
  return data ? mapRow(data) : null;
}

export async function fetchThemeById(id: string): Promise<AppTheme | null> {
  const { data } = await getSupabaseClient()
    .from('app_themes').select('*').eq('id', id).maybeSingle();
  return data ? mapRow(data) : null;
}

export async function activateTheme(themeId: string, userId: string): Promise<{ error: string | null }> {
  const s = getSupabaseClient();
  await s.from('app_themes').update({ is_active: false }).not('id', 'is', null);
  const { error } = await s.from('app_themes')
    .update({ is_active: true, status: 'published', published_at: new Date().toISOString() })
    .eq('id', themeId);
  if (!error) await logAdminAction(userId, 'activate_theme', `تفعيل ثيم: ${themeId}`, 'theme', themeId);
  return { error: error?.message || null };
}

export async function createTheme(
  data: { name: string; description?: string; darkMode?: boolean; tokens?: Partial<DbThemeTokens> },
  userId: string
): Promise<{ id: string | null; error: string | null }> {
  const slug = `${data.name.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}`;
  const { data: result, error } = await getSupabaseClient().from('app_themes').insert({
    name: data.name, slug, description: data.description || '',
    dark_mode: data.darkMode || false, status: 'draft',
    tokens: { ...DEFAULT_TOKENS, ...(data.tokens || {}) },
    is_active: false, is_default: false, created_by: userId,
  }).select('id').single();
  if (error) return { id: null, error: error.message };
  await logAdminAction(userId, 'create_theme', `إنشاء ثيم: ${data.name}`, 'theme', result.id);
  return { id: result.id, error: null };
}

export async function updateThemeTokens(
  themeId: string,
  updates: { name?: string; description?: string; darkMode?: boolean; tokens?: Partial<DbThemeTokens> },
  userId: string
): Promise<{ error: string | null }> {
  const updateData: any = { updated_at: new Date().toISOString() };
  if (updates.name) updateData.name = updates.name;
  if (updates.description !== undefined) updateData.description = updates.description;
  if (updates.darkMode !== undefined) updateData.dark_mode = updates.darkMode;
  if (updates.tokens) {
    const { data: cur } = await getSupabaseClient().from('app_themes').select('tokens').eq('id', themeId).single();
    updateData.tokens = { ...DEFAULT_TOKENS, ...(cur?.tokens || {}), ...updates.tokens };
  }
  const { error } = await getSupabaseClient().from('app_themes').update(updateData).eq('id', themeId);
  if (!error) await logAdminAction(userId, 'update_theme', `تحديث ثيم: ${themeId}`, 'theme', themeId);
  return { error: error?.message || null };
}

export async function publishTheme(themeId: string, userId: string): Promise<{ error: string | null }> {
  const { error } = await getSupabaseClient().from('app_themes')
    .update({ status: 'published', published_at: new Date().toISOString() }).eq('id', themeId);
  if (!error) await logAdminAction(userId, 'publish_theme', `نشر ثيم: ${themeId}`, 'theme', themeId);
  return { error: error?.message || null };
}

export async function deleteTheme(themeId: string, userId: string): Promise<{ error: string | null }> {
  const { error } = await getSupabaseClient().from('app_themes').delete().eq('id', themeId);
  if (!error) await logAdminAction(userId, 'delete_theme', `حذف ثيم: ${themeId}`, 'theme', themeId);
  return { error: error?.message || null };
}

export async function logAdminAction(
  userId: string, action: string, description: string,
  resourceType?: string, resourceId?: string
): Promise<void> {
  try {
    await getSupabaseClient().from('admin_audit_logs').insert({
      user_id: userId, action, description,
      resource_type: resourceType || null, resource_id: resourceId || null,
    });
  } catch {}
}

export async function fetchAuditLogs(limit = 15): Promise<any[]> {
  const { data } = await getSupabaseClient()
    .from('admin_audit_logs').select('*')
    .order('created_at', { ascending: false }).limit(limit);
  return data || [];
}

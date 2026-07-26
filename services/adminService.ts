import { getSupabaseClient } from '@/template';
import { Tool } from './mockData';

const supabase = getSupabaseClient();

function mapDbTool(row: any): Tool & { status: string; submittedBy: string } {
  return {
    id: row.id,
    name: row.name,
    shortDescription: row.short_description,
    description: row.description,
    category: row.category,
    logoColor: row.logo_color,
    logoIcon: row.logo_icon,
    rating: parseFloat(row.rating) || 0,
    ratingCount: row.rating_count || 0,
    votes: row.votes || 0,
    developerName: row.developer_name,
    developerBio: row.developer_bio,
    developerToolsCount: row.developer_tools_count,
    developerFollowers: row.developer_followers,
    tags: row.tags || [],
    pricing: row.pricing,
    url: row.url || '',
    screenshots: row.screenshots || [],
    featured: row.featured,
    isNew: row.is_new,
    trending: row.trending,
    editorPick: row.editor_pick,
    createdAt: row.created_at,
    status: row.status,
    submittedBy: row.submitted_by,
  };
}

export async function fetchPendingTools(): Promise<(Tool & { status: string; submittedBy: string })[]> {
  const { data, error } = await supabase
    .from('tools')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) { console.error('fetchPendingTools error:', error); return []; }
  return (data || []).map(mapDbTool);
}

export async function fetchAllToolsAdmin(): Promise<(Tool & { status: string; submittedBy: string })[]> {
  const { data, error } = await supabase
    .from('tools')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) { console.error('fetchAllToolsAdmin error:', error); return []; }
  return (data || []).map(mapDbTool);
}

export async function updateToolStatus(toolId: string, status: 'approved' | 'rejected') {
  const { error } = await supabase.from('tools').update({ status }).eq('id', toolId);
  if (error) { console.error('updateToolStatus error:', error); throw error; }
}

export async function fetchPlatformStats() {
  const [toolsRes, usersRes, votesRes, commentsRes] = await Promise.all([
    supabase.from('tools').select('*', { count: 'exact', head: true }),
    supabase.from('user_profiles').select('*', { count: 'exact', head: true }),
    supabase.from('user_votes').select('*', { count: 'exact', head: true }),
    supabase.from('comments').select('*', { count: 'exact', head: true }),
  ]);
  return {
    totalTools: toolsRes.count || 0,
    totalUsers: usersRes.count || 0,
    totalVotes: votesRes.count || 0,
    totalComments: commentsRes.count || 0,
  };
}

export async function fetchRecentActivity() {
  const { data: recentTools } = await supabase
    .from('tools')
    .select('id, name, status, created_at, logo_icon, logo_color')
    .order('created_at', { ascending: false })
    .limit(5);

  const { data: recentComments } = await supabase
    .from('comments')
    .select('id, text, created_at, tool_id, user_profiles(username, email)')
    .order('created_at', { ascending: false })
    .limit(5);

  return { recentTools: recentTools || [], recentComments: recentComments || [] };
}

export async function checkIsAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('is_admin')
    .eq('id', userId)
    .single();
  if (error) return false;
  return data?.is_admin || false;
}

export async function deleteToolAdmin(toolId: string) {
  const { error } = await supabase.from('tools').delete().eq('id', toolId);
  if (error) throw error;
}

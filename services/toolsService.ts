import { getSupabaseClient } from '@/template';
import { Tool, Comment } from './mockData';

const supabase = getSupabaseClient();

function mapDbTool(row: any): Tool {
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

export async function fetchTools(): Promise<Tool[]> {
  const { data, error } = await supabase
    .from('tools')
    .select('*')
    .eq('status', 'approved')
    .order('created_at', { ascending: false });
  if (error) { console.error('fetchTools error:', error); return []; }
  return (data || []).map(mapDbTool);
}

export async function fetchSavedToolIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase.from('user_saved_tools').select('tool_id').eq('user_id', userId);
  if (error) { console.error('fetchSavedToolIds error:', error); return []; }
  return (data || []).map((r: any) => r.tool_id);
}

export async function fetchVotedToolIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase.from('user_votes').select('tool_id').eq('user_id', userId);
  if (error) { console.error('fetchVotedToolIds error:', error); return []; }
  return (data || []).map((r: any) => r.tool_id);
}

export async function fetchUserRatings(userId: string): Promise<Record<string, number>> {
  const { data, error } = await supabase.from('user_ratings').select('tool_id, rating').eq('user_id', userId);
  if (error) { console.error('fetchUserRatings error:', error); return {}; }
  const map: Record<string, number> = {};
  (data || []).forEach((r: any) => { map[r.tool_id] = r.rating; });
  return map;
}

export async function fetchComments(toolId: string): Promise<Comment[]> {
  const { data, error } = await supabase
    .from('comments')
    .select('id, user_id, text, created_at, user_profiles(username, email)')
    .eq('tool_id', toolId)
    .order('created_at', { ascending: false });
  if (error) { console.error('fetchComments error:', error); return []; }
  return (data || []).map((r: any) => ({
    id: r.id,
    userId: r.user_id,
    userName: r.user_profiles?.username || r.user_profiles?.email || 'مستخدم',
    text: r.text,
    createdAt: r.created_at?.split('T')[0] || '',
  }));
}

export async function toggleSave(userId: string, toolId: string, isSaved: boolean) {
  if (isSaved) {
    await supabase.from('user_saved_tools').delete().eq('user_id', userId).eq('tool_id', toolId);
  } else {
    await supabase.from('user_saved_tools').insert({ user_id: userId, tool_id: toolId });
  }
}

export async function toggleVote(userId: string, toolId: string, isVoted: boolean) {
  if (isVoted) {
    await supabase.from('user_votes').delete().eq('user_id', userId).eq('tool_id', toolId);
    await supabase.rpc('increment_votes', { tool_id: toolId, amount: -1 }).catch(() => {});
  } else {
    await supabase.from('user_votes').insert({ user_id: userId, tool_id: toolId });
    await supabase.rpc('increment_votes', { tool_id: toolId, amount: 1 }).catch(() => {});
  }
}

export async function upsertRating(userId: string, toolId: string, rating: number) {
  await supabase.from('user_ratings').upsert(
    { user_id: userId, tool_id: toolId, rating, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,tool_id' }
  );
  // Recalculate tool rating from all user ratings
  await supabase.rpc('update_tool_rating', { p_tool_id: toolId }).catch(() => {});
}

export async function addCommentToDb(userId: string, toolId: string, text: string) {
  const { data, error } = await supabase
    .from('comments')
    .insert({ user_id: userId, tool_id: toolId, text })
    .select('id, user_id, text, created_at')
    .single();
  if (error) { console.error('addComment error:', error); return null; }
  return data;
}

export async function submitTool(params: {
  userId: string;
  name: string;
  shortDescription: string;
  description: string;
  category: string;
  pricing: string;
  tags: string[];
  url: string;
  developerName: string;
  developerBio: string;
}) {
  const id = `user_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const { error } = await supabase.from('tools').insert({
    id,
    name: params.name,
    short_description: params.shortDescription,
    description: params.description,
    category: params.category,
    pricing: params.pricing,
    tags: params.tags,
    url: params.url,
    developer_name: params.developerName,
    developer_bio: params.developerBio,
    submitted_by: params.userId,
    status: 'pending',
    logo_icon: 'smart-toy',
    logo_color: '#3B82F6',
    rating: 0,
    rating_count: 0,
    votes: 0,
    screenshots: [],
    developer_tools_count: 1,
    developer_followers: 0,
    trending: false,
    featured: false,
    editor_pick: false,
    is_new: true,
  });
  if (error) { console.error('submitTool error:', error); throw error; }
  return id;
}

export async function fetchUserSubmittedTools(userId: string): Promise<Tool[]> {
  const { data, error } = await supabase
    .from('tools')
    .select('*')
    .eq('submitted_by', userId)
    .order('created_at', { ascending: false });
  if (error) { console.error('fetchUserSubmittedTools error:', error); return []; }
  return (data || []).map(mapDbTool);
}

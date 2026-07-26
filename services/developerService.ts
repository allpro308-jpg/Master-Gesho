import { getSupabaseClient } from '@/template';
import { Tool } from './mockData';
import { createNotification } from './notificationsService';

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

export async function fetchDeveloperTools(developerName: string): Promise<Tool[]> {
  const { data, error } = await supabase
    .from('tools')
    .select('*')
    .eq('developer_name', developerName)
    .eq('status', 'approved')
    .order('created_at', { ascending: false });
  if (error) { console.error('fetchDeveloperTools error:', error); return []; }
  return (data || []).map(mapDbTool);
}

export async function fetchDeveloperFollowersCount(developerName: string): Promise<number> {
  const { count, error } = await supabase
    .from('developer_follows')
    .select('*', { count: 'exact', head: true })
    .eq('developer_name', developerName);
  if (error) return 0;
  return count || 0;
}

export async function checkIsFollowing(followerId: string, developerName: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('developer_follows')
    .select('id')
    .eq('follower_id', followerId)
    .eq('developer_name', developerName)
    .maybeSingle();
  if (error) return false;
  return !!data;
}

export async function followDeveloper(followerId: string, developerName: string) {
  await supabase.from('developer_follows').insert({ follower_id: followerId, developer_name: developerName });

  // Find the developer's user profile to notify them
  try {
    // Look up any tool by this developer to find their submitted_by id
    const { data: toolRow } = await supabase
      .from('tools')
      .select('submitted_by, developer_name')
      .eq('developer_name', developerName)
      .not('submitted_by', 'is', null)
      .limit(1)
      .maybeSingle();

    if (toolRow?.submitted_by && toolRow.submitted_by !== followerId) {
      await createNotification({
        userId: toolRow.submitted_by,
        type: 'follow',
        title: 'متابع جديد',
        body: `قام مستخدم جديد بمتابعتك على منصة مستر جيشو`,
        actorId: followerId,
      });
    }
  } catch (e) {
    console.error('followDeveloper notification error:', e);
  }
}

export async function unfollowDeveloper(followerId: string, developerName: string) {
  await supabase.from('developer_follows').delete().eq('follower_id', followerId).eq('developer_name', developerName);
}

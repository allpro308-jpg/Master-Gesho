import { getSupabaseClient } from '@/template';
import { Notification } from './mockData';

const supabase = getSupabaseClient();

function mapNotification(row: any): Notification {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    body: row.body,
    toolId: row.tool_id,
    actorId: row.actor_id,
    isRead: row.is_read,
    createdAt: row.created_at,
  };
}

export async function fetchNotifications(userId: string): Promise<Notification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) { console.error('fetchNotifications error:', error); return []; }
  return (data || []).map(mapNotification);
}

export async function markNotificationRead(id: string) {
  await supabase.from('notifications').update({ is_read: true }).eq('id', id);
}

export async function markAllNotificationsRead(userId: string) {
  await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false);
}

export async function createNotification(params: {
  userId: string;
  type: Notification['type'];
  title: string;
  body: string;
  toolId?: string;
  actorId?: string;
}) {
  const { error } = await supabase.from('notifications').insert({
    user_id: params.userId,
    type: params.type,
    title: params.title,
    body: params.body,
    tool_id: params.toolId || null,
    actor_id: params.actorId || null,
  });
  if (error) console.error('createNotification error:', error);
}

export async function fetchUnreadCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);
  if (error) return 0;
  return count || 0;
}

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/template';
import { getSupabaseClient } from '@/template';
import { Notification } from '../services/mockData';
import {
  fetchNotifications, markNotificationRead, markAllNotificationsRead, fetchUnreadCount,
} from '../services/notificationsService';

interface NotificationsContextType {
  notifications: Notification[];
  unreadCount: number;
  pendingToolsCount: number;
  loadNotifications: () => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
}

const NotificationsContext = createContext<NotificationsContextType>({} as NotificationsContextType);

const LAST_PENDING_CHECK_KEY = '@nextools_last_pending_seen';

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingToolsCount, setPendingToolsCount] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);

  const loadNotifications = useCallback(() => {
    if (!user?.id) return;
    fetchNotifications(user.id).then(setNotifications);
    fetchUnreadCount(user.id).then(setUnreadCount);
  }, [user?.id]);

  // Check if user is admin
  useEffect(() => {
    if (!user?.id) { setIsAdmin(false); return; }
    getSupabaseClient()
      .from('user_profiles').select('is_admin').eq('id', user.id).single()
      .then(({ data }) => setIsAdmin(data?.is_admin || false));
  }, [user?.id]);

  // Poll pending tools count for admins
  const checkPendingTools = useCallback(async () => {
    if (!isAdmin) return;
    const { count } = await getSupabaseClient()
      .from('tools').select('id', { count: 'exact', head: true }).eq('status', 'pending');
    setPendingToolsCount(count || 0);
  }, [isAdmin]);

  useEffect(() => {
    if (!user?.id) {
      setNotifications([]);
      setUnreadCount(0);
      setPendingToolsCount(0);
      return;
    }
    loadNotifications();
    // Poll every 30 seconds
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [user?.id, loadNotifications]);

  useEffect(() => {
    if (!isAdmin) return;
    checkPendingTools();
    const interval = setInterval(checkPendingTools, 60000);
    return () => clearInterval(interval);
  }, [isAdmin, checkPendingTools]);

  const markRead = useCallback(async (id: string) => {
    await markNotificationRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  const markAllRead = useCallback(async () => {
    if (!user?.id) return;
    await markAllNotificationsRead(user.id);
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    setUnreadCount(0);
  }, [user?.id]);

  return (
    <NotificationsContext.Provider value={{ notifications, unreadCount, pendingToolsCount, loadNotifications, markRead, markAllRead }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationsContext);

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/template';
import { Notification } from '../services/mockData';
import {
  fetchNotifications, markNotificationRead, markAllNotificationsRead, fetchUnreadCount,
} from '../services/notificationsService';

interface NotificationsContextType {
  notifications: Notification[];
  unreadCount: number;
  loadNotifications: () => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
}

const NotificationsContext = createContext<NotificationsContextType>({} as NotificationsContextType);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadNotifications = useCallback(() => {
    if (!user?.id) return;
    fetchNotifications(user.id).then(setNotifications);
    fetchUnreadCount(user.id).then(setUnreadCount);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    loadNotifications();
    // Poll every 30 seconds
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [user?.id, loadNotifications]);

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
    <NotificationsContext.Provider value={{ notifications, unreadCount, loadNotifications, markRead, markAllRead }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationsContext);

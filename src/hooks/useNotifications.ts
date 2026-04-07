import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTeamMember } from '@/hooks/useTeamMember';
import { isToday } from 'date-fns';

export type NotificationType = 'email' | 'lead' | 'opportunity' | 'project' | 'closed' | 'system';

export interface Notification {
  id: string;
  team_member_id: string;
  type: NotificationType;
  title: string;
  description: string | null;
  link_url: string | null;
  is_read: boolean;
  created_at: string;
}

export interface GroupedNotifications {
  today: Notification[];
  earlier: Notification[];
}

export const useNotifications = () => {
  const { teamMember } = useTeamMember();
  const queryClient = useQueryClient();
  const [activeFilter, setActiveFilter] = useState<NotificationType | 'all'>('all');
  const teamMemberId = teamMember?.id;

  // Fetch notifications
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications', teamMemberId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching notifications:', error);
        return [];
      }
      return data as Notification[];
    },
    enabled: !!teamMemberId,
    staleTime: 30_000,
  });

  // Realtime subscription
  useEffect(() => {
    if (!teamMemberId) return;

    const channel = supabase
      .channel('notifications-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `team_member_id=eq.${teamMemberId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['notifications', teamMemberId] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [teamMemberId, queryClient]);

  // Mark single notification as read
  const markAsRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);
      if (error) throw error;
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ['notifications', teamMemberId] });
      const previous = queryClient.getQueryData<Notification[]>(['notifications', teamMemberId]);
      queryClient.setQueryData<Notification[]>(['notifications', teamMemberId], (old) =>
        old?.map((n) => n.id === id ? { ...n, is_read: true } : n) ?? []
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['notifications', teamMemberId], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', teamMemberId] });
    },
  });

  // Mark all as read
  const markAllAsRead = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any)
        .from('notifications')
        .update({ is_read: true })
        .eq('is_read', false);
      if (error) throw error;
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['notifications', teamMemberId] });
      const previous = queryClient.getQueryData<Notification[]>(['notifications', teamMemberId]);
      queryClient.setQueryData<Notification[]>(['notifications', teamMemberId], (old) =>
        old?.map((n) => ({ ...n, is_read: true })) ?? []
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['notifications', teamMemberId], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', teamMemberId] });
    },
  });

  // Derived state
  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.is_read).length,
    [notifications]
  );

  const filteredNotifications = useMemo(() => {
    if (activeFilter === 'all') return notifications;
    return notifications.filter((n) => n.type === activeFilter);
  }, [notifications, activeFilter]);

  const groupedNotifications = useMemo<GroupedNotifications>(() => {
    const today: Notification[] = [];
    const earlier: Notification[] = [];
    for (const n of filteredNotifications) {
      if (isToday(new Date(n.created_at))) {
        today.push(n);
      } else {
        earlier.push(n);
      }
    }
    return { today, earlier };
  }, [filteredNotifications]);

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead: (id: string) => markAsRead.mutate(id),
    markAllAsRead: () => markAllAsRead.mutate(),
    activeFilter,
    setActiveFilter,
    filteredNotifications,
    groupedNotifications,
  };
};

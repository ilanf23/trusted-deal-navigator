import { Bell, Mail, TrendingUp, Handshake, FolderKanban, UserCheck, AlertCircle, CheckCheck } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNotifications, type NotificationType, type Notification } from '@/hooks/useNotifications';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const TYPE_CONFIG: Record<NotificationType, { icon: typeof Mail; color: string; bg: string }> = {
  email: { icon: Mail, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20' },
  lead: { icon: UserCheck, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
  opportunity: { icon: TrendingUp, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20' },
  project: { icon: FolderKanban, color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-900/20' },
  closed: { icon: Handshake, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20' },
  system: { icon: AlertCircle, color: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-50 dark:bg-gray-900/20' },
};

const FILTER_BUTTONS: { key: NotificationType | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'email', label: 'Emails' },
  { key: 'lead', label: 'Leads' },
  { key: 'opportunity', label: 'Opps' },
  { key: 'project', label: 'Projects' },
  { key: 'closed', label: 'Closed' },
  { key: 'system', label: 'System' },
];

function formatTime(dateStr: string) {
  return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
}

function NotificationItem({
  notification,
  index,
  onRead,
  onNavigate,
}: {
  notification: Notification;
  index: number;
  onRead: (id: string) => void;
  onNavigate: (url: string) => void;
}) {
  const config = TYPE_CONFIG[notification.type];
  const Icon = config.icon;

  const handleClick = () => {
    if (!notification.is_read) onRead(notification.id);
    if (notification.link_url) onNavigate(notification.link_url);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15, delay: index * 0.02 }}
    >
      <button
        onClick={handleClick}
        className="w-full flex items-start gap-3 px-4 py-3 hover:bg-muted/40 transition-colors text-left"
      >
        {/* Unread dot */}
        <div className="flex items-center pt-2.5 shrink-0 w-2">
          {!notification.is_read && (
            <span className="block w-[6px] h-[6px] rounded-full bg-blue-500" />
          )}
        </div>

        {/* Type icon */}
        <div className={`mt-0.5 shrink-0 w-8 h-8 rounded-lg ${config.bg} flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${config.color}`} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className={`text-[13px] font-medium truncate ${notification.is_read ? 'text-muted-foreground' : 'text-foreground'}`}>
              {notification.title}
            </span>
            <span className="text-[11px] text-muted-foreground/70 whitespace-nowrap shrink-0">
              {formatTime(notification.created_at)}
            </span>
          </div>
          {notification.description && (
            <p className="text-[12px] text-muted-foreground/80 mt-0.5 line-clamp-1">
              {notification.description}
            </p>
          )}
        </div>
      </button>
    </motion.div>
  );
}

function NotificationGroup({
  label,
  notifications,
  startIndex,
  onRead,
  onNavigate,
}: {
  label: string;
  notifications: Notification[];
  startIndex: number;
  onRead: (id: string) => void;
  onNavigate: (url: string) => void;
}) {
  if (notifications.length === 0) return null;
  return (
    <div>
      <div className="px-4 pt-3 pb-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
          {label}
        </span>
      </div>
      <AnimatePresence mode="popLayout">
        {notifications.map((n, i) => (
          <NotificationItem
            key={n.id}
            notification={n}
            index={startIndex + i}
            onRead={onRead}
            onNavigate={onNavigate}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

const NotificationBell = () => {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const {
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    activeFilter,
    setActiveFilter,
    groupedNotifications,
    filteredNotifications,
  } = useNotifications();

  const handleNavigate = (url: string) => {
    setIsOpen(false);
    navigate(url);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-10 w-10 md:h-11 md:w-11 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        >
          <Bell className="h-5 w-5 md:h-6 md:w-6" />
          {unreadCount > 0 && (
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-blue-500 ring-2 ring-blue-500/20" />
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[460px] p-0 rounded-xl shadow-xl border border-border/40"
      >
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-border/40">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <span className="text-[11px] text-muted-foreground">
                  {unreadCount} unread
                </span>
              )}
              <button
                onClick={markAllAsRead}
                disabled={unreadCount === 0}
                className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-default transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </button>
            </div>
          </div>

          {/* Filter pills */}
          <div className="flex gap-1 flex-wrap">
            {FILTER_BUTTONS.map((f) => {
              const isActive = activeFilter === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() => setActiveFilter(f.key)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                    isActive
                      ? 'bg-foreground/8 text-foreground'
                      : 'text-muted-foreground/70 hover:text-muted-foreground hover:bg-muted/50'
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Notification list */}
        <ScrollArea className="h-[420px]">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-5 h-5 border-2 border-muted-foreground/20 border-t-muted-foreground/60 rounded-full animate-spin" />
            </div>
          ) : filteredNotifications.length === 0 ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <Bell className="w-5 h-5 text-muted-foreground/50" />
              </div>
              <p className="text-sm font-medium text-foreground/80">All caught up</p>
              <p className="text-[12px] text-muted-foreground/60 mt-1">
                {activeFilter === 'all'
                  ? 'No notifications yet'
                  : `No ${activeFilter} notifications`}
              </p>
            </div>
          ) : (
            <div className="py-1">
              <NotificationGroup
                label="Today"
                notifications={groupedNotifications.today}
                startIndex={0}
                onRead={markAsRead}
                onNavigate={handleNavigate}
              />
              <NotificationGroup
                label="Earlier"
                notifications={groupedNotifications.earlier}
                startIndex={groupedNotifications.today.length}
                onRead={markAsRead}
                onNavigate={handleNavigate}
              />
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;

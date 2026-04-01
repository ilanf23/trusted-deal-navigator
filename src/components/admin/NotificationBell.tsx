import { useState, useMemo } from 'react';
import { Bell, Mail, TrendingUp, Handshake, FolderKanban, UserCheck } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

type NotificationType = 'email' | 'lead' | 'opportunity' | 'project' | 'closed';

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  description: string;
  time: string;
}

const TYPE_CONFIG: Record<NotificationType, { icon: typeof Mail; color: string; bg: string }> = {
  email: { icon: Mail, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/30' },
  lead: { icon: UserCheck, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
  opportunity: { icon: TrendingUp, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/30' },
  project: { icon: FolderKanban, color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-100 dark:bg-violet-900/30' },
  closed: { icon: Handshake, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/30' },
};

const TYPE_LABELS: Record<NotificationType, string> = {
  email: 'Email',
  lead: 'Lead Activity',
  opportunity: 'Opportunity',
  project: 'Project',
  closed: 'Closed Deal',
};

// Demo notifications — will be replaced with live data
const DEMO_NOTIFICATIONS: Notification[] = [
  { id: '1', type: 'email', title: 'New email from John Rivera', description: 'RE: SBA 7(a) loan documents — updated financials attached', time: '2m ago' },
  { id: '2', type: 'closed', title: '$2.3M SBA 7(a) Closed', description: 'Logistics company · Dallas, TX — funded and closed', time: '8m ago' },
  { id: '3', type: 'lead', title: 'New lead assigned', description: 'Premier Auto Group — $1.2M equipment financing request', time: '15m ago' },
  { id: '4', type: 'opportunity', title: 'Deal moved to underwriting', description: 'Coastal Medical Partners — $3.1M CRE refinance', time: '22m ago' },
  { id: '5', type: 'email', title: 'New email from Sarah Chen', description: 'Appraisal report ready for Riverside Plaza', time: '30m ago' },
  { id: '6', type: 'project', title: 'Project milestone reached', description: 'Greenfield Distribution — Phase 2 site inspection complete', time: '45m ago' },
  { id: '7', type: 'lead', title: 'Lead status changed', description: 'TechVenture Labs moved from Prospect to Qualified', time: '1h ago' },
  { id: '8', type: 'closed', title: '$1.8M CRE Refinance Closed', description: 'Medical office · Orlando, FL — settlement confirmed', time: '1h ago' },
  { id: '9', type: 'email', title: 'New email from Mike Torres', description: 'Updated P&L statements for Q4 review', time: '1.5h ago' },
  { id: '10', type: 'opportunity', title: 'New opportunity created', description: 'Harbor View Hotels — $4.5M construction loan', time: '2h ago' },
  { id: '11', type: 'lead', title: 'Follow-up reminder', description: 'Apex Manufacturing — last contact 5 days ago', time: '2h ago' },
  { id: '12', type: 'project', title: 'Document uploaded', description: 'Summit Retail Group — Phase 1 environmental report', time: '3h ago' },
  { id: '13', type: 'email', title: 'New email from Lisa Park', description: 'Question about bridge loan term sheet', time: '3h ago' },
  { id: '14', type: 'closed', title: '$950K Working Capital Closed', description: 'E-commerce retailer · Los Angeles, CA', time: '4h ago' },
  { id: '15', type: 'opportunity', title: 'Deal stage updated', description: 'Metro Fitness Centers — moved to Committee Review', time: '4h ago' },
];

const NotificationBell = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [hasBeenOpened, setHasBeenOpened] = useState(false);
  const [activeFilter, setActiveFilter] = useState<NotificationType | 'all'>('all');

  const unreadCount = DEMO_NOTIFICATIONS.length;

  const filteredNotifications = useMemo(() => {
    if (activeFilter === 'all') return DEMO_NOTIFICATIONS;
    return DEMO_NOTIFICATIONS.filter((n) => n.type === activeFilter);
  }, [activeFilter]);

  const typeCounts = useMemo(() => {
    const counts: Partial<Record<NotificationType, number>> = {};
    for (const n of DEMO_NOTIFICATIONS) {
      counts[n.type] = (counts[n.type] || 0) + 1;
    }
    return counts;
  }, []);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open && !hasBeenOpened) {
      setHasBeenOpened(true);
    }
  };

  const showBadge = !hasBeenOpened && unreadCount > 0;
  const badgeText = unreadCount > 99 ? '99+' : String(unreadCount);

  const filterButtons: { key: NotificationType | 'all'; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'email', label: 'Emails' },
    { key: 'lead', label: 'Leads' },
    { key: 'opportunity', label: 'Opps' },
    { key: 'project', label: 'Projects' },
    { key: 'closed', label: 'Closed' },
  ];

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-10 w-10 md:h-11 md:w-11 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
          aria-label={`Notifications${showBadge ? ` (${unreadCount} unread)` : ''}`}
        >
          <Bell className="h-5 w-5 md:h-6 md:w-6" />
          {showBadge && (
            <span className="absolute -top-1 -right-1 min-w-[22px] h-[22px] px-1.5 flex items-center justify-center rounded-full bg-[#8B1A1A] text-white text-[11px] font-bold leading-none shadow-lg animate-in zoom-in-50 duration-200">
              {badgeText}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[400px] p-0 rounded-xl shadow-2xl border border-border/60"
      >
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-border/60">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
            <span className="text-xs text-muted-foreground">{DEMO_NOTIFICATIONS.length} updates</span>
          </div>

          {/* Filter pills */}
          <div className="flex gap-1.5 flex-wrap">
            {filterButtons.map((f) => {
              const isActive = activeFilter === f.key;
              const count = f.key === 'all' ? DEMO_NOTIFICATIONS.length : (typeCounts[f.key] || 0);
              return (
                <button
                  key={f.key}
                  onClick={() => setActiveFilter(f.key)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                    isActive
                      ? 'bg-foreground text-background'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {f.label} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Notification list */}
        <ScrollArea className="max-h-[400px]">
          <div className="py-1">
            {filteredNotifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No notifications in this category
              </div>
            ) : (
              filteredNotifications.map((notification) => {
                const config = TYPE_CONFIG[notification.type];
                const Icon = config.icon;

                return (
                  <div
                    key={notification.id}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer border-b border-border/30 last:border-b-0"
                  >
                    <div className={`mt-0.5 shrink-0 w-8 h-8 rounded-lg ${config.bg} flex items-center justify-center`}>
                      <Icon className={`w-4 h-4 ${config.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-foreground truncate">
                          {notification.title}
                        </span>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                          {notification.time}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                        {notification.description}
                      </p>
                      <span className={`inline-block mt-1 text-[10px] font-medium px-1.5 py-0.5 rounded ${config.bg} ${config.color}`}>
                        {TYPE_LABELS[notification.type]}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;

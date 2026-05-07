import { useEffect } from 'react';
import { useAdminTopBar } from '@/contexts/AdminTopBarContext';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Code2,
  Zap,
  Phone,
  Mail,
  Calendar,
  Bell,
  FileText,
  MessageSquare,
  Bot,
  Webhook,
  Database,
  Send,
  Star,
  Users,
  Target,
  Clock,
  Newspaper,
} from 'lucide-react';

interface Automation {
  name: string;
  description: string;
  triggers: string[];
  actions: string[];
  edgeFunctions: string[];
  status: 'active' | 'beta' | 'planned';
  category: 'calls' | 'email' | 'leads' | 'calendar' | 'newsletter' | 'ai';
}

const automations: Automation[] = [
  {
    name: 'Call-to-Lead Automation',
    description: 'When a lead is created from call history, AI analyzes the transcript, generates a 1-10 rating, creates a follow-up task, and drafts a personalized email in Gmail.',
    triggers: ['Lead created from call history', 'User confirms automation dialog'],
    actions: [
      'AI analyzes call transcript',
      'Generates call rating (1-10)',
      'Creates follow-up task in tasks',
      'Drafts personalized email in Gmail',
      'Sends rating notification to Adam & Brad',
      'Stores rating in call_rating_notifications table',
    ],
    edgeFunctions: ['call-to-lead-automation', 'gmail-mailbox', 'gmail-write'],
    status: 'active',
    category: 'calls',
  },
  {
    name: 'Gmail Nudge System',
    description: 'Identifies leads assigned to the user with no activity in 7+ days and provides one-click buttons to generate AI-powered follow-up email drafts.',
    triggers: ['Lead updated_at older than 7 days', 'User clicks nudge button'],
    actions: [
      'Queries leads with stale updated_at',
      'Creates follow-up email draft via Gmail API',
      'Updates lead updated_at to prevent repeated nudges',
    ],
    edgeFunctions: ['gmail-mailbox', 'gmail-write'],
    status: 'active',
    category: 'email',
  },
  {
    name: 'Twilio Call Integration',
    description: 'Full telephony integration allowing inbound/outbound calls with automatic recording, transcription, and lead association.',
    triggers: ['Outbound call initiated', 'Inbound call received', 'Call completed'],
    actions: [
      'Generates Twilio access token for browser dialer',
      'Handles inbound call routing',
      'Records all calls automatically',
      'Transcribes calls using Twilio/AI',
      'Associates calls with leads by phone number',
      'Stores communications in communications',
    ],
    edgeFunctions: ['twilio-token', 'twilio-call', 'twilio-inbound', 'twilio-voice', 'twilio-call-status', 'twilio-transcription', 'retry-call-transcription'],
    status: 'active',
    category: 'calls',
  },
  {
    name: 'SMS Messaging',
    description: 'Send and receive SMS messages to/from leads via Twilio integration.',
    triggers: ['User sends SMS from app', 'Inbound SMS received'],
    actions: [
      'Sends SMS via Twilio API',
      'Logs SMS in communications table',
    ],
    edgeFunctions: ['twilio-sms'],
    status: 'active',
    category: 'calls',
  },
  {
    name: 'Gmail OAuth Integration',
    description: 'Full Gmail integration for reading inbox, sending emails, creating drafts, starring, archiving, and trashing messages.',
    triggers: ['User connects Gmail account', 'User performs email action'],
    actions: [
      'OAuth authentication flow',
      'Lists inbox/sent/drafts/starred',
      'Sends emails',
      'Creates drafts',
      'Archives/trashes messages',
      'Marks as read/unread',
    ],
    edgeFunctions: ['gmail-auth', 'gmail-mailbox', 'gmail-write'],
    status: 'active',
    category: 'email',
  },
  {
    name: 'AI Email Chat Assistant',
    description: 'AI-powered email composition assistant that helps draft professional emails based on lead context.',
    triggers: ['User opens AI email assistant', 'User provides prompt'],
    actions: [
      'Generates email content using AI',
      'Considers lead context and history',
      'Provides editable draft',
    ],
    edgeFunctions: ['ai-email-chat'],
    status: 'active',
    category: 'ai',
  },
  {
    name: 'AI Lender Program Advisor',
    description: 'AI assistant that answers questions about lender programs and suggests best-fit options based on lead requirements.',
    triggers: ['User asks question about lender programs'],
    actions: [
      'Queries lender_programs table',
      'Analyzes lead requirements (loan amount, type, etc.)',
      'Provides program recommendations',
    ],
    edgeFunctions: ['lender-program-assistant'],
    status: 'active',
    category: 'ai',
  },
  {
    name: 'Google Calendar Sync',
    description: 'Two-way sync between app appointments and Google Calendar.',
    triggers: ['User connects Google Calendar', 'Appointment created/updated'],
    actions: [
      'OAuth authentication with Google',
      'Syncs appointments to Google Calendar',
      'Pulls events from Google Calendar',
    ],
    edgeFunctions: ['google-calendar-auth', 'google-calendar-sync'],
    status: 'active',
    category: 'calendar',
  },
  {
    name: 'Newsletter System',
    description: 'Full newsletter campaign management with tracking for opens, clicks, and unsubscribes.',
    triggers: ['Campaign scheduled/sent', 'Subscriber opens/clicks email'],
    actions: [
      'Sends newsletters to subscriber list',
      'Tracks open events',
      'Tracks click events',
      'Handles unsubscribe requests',
      'Webhook for email events',
    ],
    edgeFunctions: ['send-newsletter', 'newsletter-track', 'newsletter-webhook'],
    status: 'active',
    category: 'newsletter',
  },
  {
    name: 'Pre-qualification Email',
    description: 'Sends pre-qualification questionnaire link to leads with unique token for tracking.',
    triggers: ['User sends questionnaire from lead detail'],
    actions: [
      'Generates unique questionnaire token',
      'Sends email with questionnaire link',
      'Tracks questionnaire completion',
    ],
    edgeFunctions: ['send-prequalification-email'],
    status: 'active',
    category: 'leads',
  },
  {
    name: 'AI Lead Email Generation',
    description: 'Generates personalized email content for leads based on their profile and stage.',
    triggers: ['User requests AI email for lead'],
    actions: [
      'Analyzes lead profile and responses',
      'Generates contextual email content',
    ],
    edgeFunctions: ['generate-lead-email'],
    status: 'active',
    category: 'ai',
  },
  {
    name: 'Call Rating Notifications',
    description: 'Automated notifications sent to admins when calls are rated, with transcript previews and lead details.',
    triggers: ['Call rated by AI'],
    actions: [
      'Stores rating in call_rating_notifications',
      'Sends email notification to Adam & Brad',
      'Displays in Messages > Call Ratings tab',
    ],
    edgeFunctions: ['call-to-lead-automation'],
    status: 'active',
    category: 'calls',
  },
];

const categoryConfig = {
  calls: { icon: Phone, color: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400' },
  email: { icon: Mail, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400' },
  leads: { icon: Users, color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-400' },
  calendar: { icon: Calendar, color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400' },
  newsletter: { icon: Newspaper, color: 'bg-pink-100 text-pink-700 dark:bg-pink-900/50 dark:text-pink-400' },
  ai: { icon: Bot, color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-400' },
};

const statusConfig = {
  active: { label: 'Active', color: 'bg-green-500' },
  beta: { label: 'Beta', color: 'bg-amber-500' },
  planned: { label: 'Planned', color: 'bg-slate-400' },
};

const DevNotes = () => {
  const { setPageTitle } = useAdminTopBar();
  useEffect(() => {
    setPageTitle('Dev Notes');
    return () => { setPageTitle(null); };
  }, []);

  const groupedAutomations = automations.reduce((acc, automation) => {
    if (!acc[automation.category]) {
      acc[automation.category] = [];
    }
    acc[automation.category].push(automation);
    return acc;
  }, {} as Record<string, Automation[]>);

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Zap className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{automations.length}</p>
                  <p className="text-xs text-muted-foreground">Automations</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/50">
                  <Webhook className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">20</p>
                  <p className="text-xs text-muted-foreground">Edge Functions</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/50">
                  <Database className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">25+</p>
                  <p className="text-xs text-muted-foreground">Database Tables</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/50">
                  <Bot className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">4</p>
                  <p className="text-xs text-muted-foreground">AI Integrations</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Automations by Category */}
        <ScrollArea className="h-[calc(100vh-320px)]">
          <div className="space-y-6 pr-4">
            {Object.entries(groupedAutomations).map(([category, items]) => {
              const config = categoryConfig[category as keyof typeof categoryConfig];
              const Icon = config.icon;

              return (
                <div key={category}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`p-1.5 rounded ${config.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <h2 className="text-lg font-semibold capitalize">{category}</h2>
                    <Badge variant="outline" className="text-xs">
                      {items.length} automation{items.length > 1 ? 's' : ''}
                    </Badge>
                  </div>

                  <div className="grid gap-4">
                    {items.map((automation) => (
                      <Card key={automation.name}>
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between">
                            <div>
                              <CardTitle className="text-base flex items-center gap-2">
                                {automation.name}
                                <span
                                  className={`w-2 h-2 rounded-full ${statusConfig[automation.status].color}`}
                                  title={statusConfig[automation.status].label}
                                />
                              </CardTitle>
                              <CardDescription className="mt-1">
                                {automation.description}
                              </CardDescription>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1.5">
                              Triggers
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {automation.triggers.map((trigger) => (
                                <Badge
                                  key={trigger}
                                  variant="secondary"
                                  className="text-xs font-normal"
                                >
                                  {trigger}
                                </Badge>
                              ))}
                            </div>
                          </div>

                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1.5">
                              Actions
                            </p>
                            <ul className="space-y-1">
                              {automation.actions.map((action, idx) => (
                                <li
                                  key={idx}
                                  className="text-xs text-muted-foreground flex items-start gap-2"
                                >
                                  <span className="text-primary mt-0.5">→</span>
                                  {action}
                                </li>
                              ))}
                            </ul>
                          </div>

                          <Separator />

                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1.5">
                              Edge Functions
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {automation.edgeFunctions.map((fn) => (
                                <code
                                  key={fn}
                                  className="text-[10px] px-1.5 py-0.5 bg-muted rounded font-mono"
                                >
                                  {fn}
                                </code>
                              ))}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    </AdminLayout>
  );
};

export default DevNotes;

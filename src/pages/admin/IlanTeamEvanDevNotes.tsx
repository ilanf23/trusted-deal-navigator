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
  Bot,
  Webhook,
  Database,
  Users,
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
      'Creates follow-up task in evan_tasks',
      'Drafts personalized email in Gmail',
      'Sends rating notification to Adam & Brad via email',
      'Stores rating in call_rating_notifications table',
    ],
    edgeFunctions: ['call-to-lead-automation', 'gmail-api'],
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
    edgeFunctions: ['gmail-api'],
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
      'Stores communications in evan_communications',
    ],
    edgeFunctions: ['twilio-token', 'twilio-call', 'twilio-inbound', 'twilio-voice', 'twilio-call-status', 'twilio-transcription', 'retry-call-transcription'],
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

const IlanTeamEvanDevNotes = () => {
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
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <Code2 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Evan's Dev Notes</h1>
            <p className="text-sm text-muted-foreground">
              Development notes and automations documented by Evan
            </p>
          </div>
        </div>

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
                  <p className="text-2xl font-bold">10</p>
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
                  <p className="text-2xl font-bold">2</p>
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

export default IlanTeamEvanDevNotes;

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { STAGE_LABELS } from '@/constants/appConfig';
import EvanLayout from '@/components/evan/EvanLayout';
import { differenceInDays, format, formatDistanceToNow } from 'date-fns';
import {
  ArrowLeft, Building2, DollarSign, User, Tag, Phone, Mail,
  MapPin, ChevronDown, ChevronRight, Plus, MoreHorizontal,
  MessageSquare, CheckCircle2, FileText, Calendar, Users,
  Briefcase, GitBranch, Clock, Activity, Loader2,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type ActivityTab = 'note' | 'log';

// ─── Data hooks ───────────────────────────────────────────────────────────────

function useLeadDetail(leadId: string) {
  return useQuery({
    queryKey: ['lead-detail', leadId],
    enabled: !!leadId,
    queryFn: async () => {
      const [
        { data: lead, error: leadErr },
        { data: activities },
        { data: tasks },
        { data: phones },
        { data: emails },
        { data: addresses },
        { data: milestones },
        { data: waitingOn },
        { data: contacts },
      ] = await Promise.all([
        supabase.from('leads').select('*').eq('id', leadId).single(),
        supabase.from('lead_activities').select('*').eq('lead_id', leadId).order('created_at', { ascending: false }),
        supabase.from('lead_tasks').select('*').eq('lead_id', leadId).order('due_date', { ascending: true }),
        supabase.from('lead_phones').select('*').eq('lead_id', leadId),
        supabase.from('lead_emails').select('*').eq('lead_id', leadId),
        supabase.from('lead_addresses').select('*').eq('lead_id', leadId),
        supabase.from('deal_milestones').select('*').eq('lead_id', leadId),
        supabase.from('deal_waiting_on').select('*').eq('lead_id', leadId),
        supabase.from('lead_contacts').select('*').eq('lead_id', leadId),
      ]);

      if (leadErr) throw leadErr;

      // Fetch owner name
      let ownerName: string | null = null;
      if (lead?.assigned_to) {
        const { data: tm } = await supabase
          .from('team_members')
          .select('name')
          .eq('id', lead.assigned_to)
          .single();
        ownerName = tm?.name ?? null;
      }

      return {
        lead: lead!,
        activities: activities ?? [],
        tasks: tasks ?? [],
        phones: phones ?? [],
        emails: emails ?? [],
        addresses: addresses ?? [],
        milestones: milestones ?? [],
        waitingOn: waitingOn ?? [],
        contacts: contacts ?? [],
        ownerName,
      };
    },
  });
}

// ─── Helper components ────────────────────────────────────────────────────────

const SectionHeader = ({ label, count, collapsible = true, open, onToggle }: {
  label: string;
  count?: number;
  collapsible?: boolean;
  open?: boolean;
  onToggle?: () => void;
}) => (
  <button
    onClick={onToggle}
    style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      width: '100%', padding: '10px 0', background: 'none', border: 'none',
      cursor: collapsible ? 'pointer' : 'default', borderBottom: '1px solid #F0EFF8',
    }}
  >
    <span style={{ fontSize: '12px', fontWeight: 700, color: '#6B6B8A', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
      {label}{count !== undefined ? ` (${count})` : ''}
    </span>
    {collapsible && (
      open ? <ChevronDown size={14} color="#999" /> : <ChevronRight size={14} color="#999" />
    )}
  </button>
);

const FieldRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div style={{ display: 'flex', alignItems: 'flex-start', padding: '8px 0', borderBottom: '1px solid #F8F7FC', gap: '12px' }}>
    <span style={{ width: '140px', flexShrink: 0, fontSize: '12px', color: '#888', paddingTop: '2px', fontWeight: 500 }}>
      {label}
    </span>
    <div style={{ flex: 1, fontSize: '13px', color: '#1A1A2E', minWidth: 0 }}>
      {children}
    </div>
  </div>
);

const EmptyFieldValue = ({ placeholder }: { placeholder: string }) => (
  <span style={{ color: '#BBBBBB', fontStyle: 'italic' }}>{placeholder}</span>
);

const TagPill = ({ text }: { text: string }) => (
  <span style={{
    background: '#F0EEF8', color: '#4A3A7A', borderRadius: '12px',
    fontSize: '11px', padding: '2px 10px', marginRight: '4px', marginBottom: '4px',
    display: 'inline-block', whiteSpace: 'nowrap',
  }}>
    {text}
  </span>
);

const StatCard = ({ label, value, sub }: { label: string; value: string | number; sub?: string }) => (
  <div style={{
    flex: 1, textAlign: 'center', padding: '12px 8px',
    borderRight: '1px solid #F0EFF8',
  }}>
    <div style={{ fontSize: '20px', fontWeight: 700, color: '#1A1A2E' }}>{value}</div>
    <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>{label}</div>
    {sub && <div style={{ fontSize: '11px', color: '#3D2B6B', marginTop: '1px' }}>{sub}</div>}
  </div>
);

const RelatedItem = ({ icon: Icon, label, count, open, onToggle }: {
  icon: React.ComponentType<{ size?: number; color?: string }>;
  label: string;
  count: number;
  open: boolean;
  onToggle: () => void;
}) => (
  <div>
    <button
      onClick={onToggle}
      style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        width: '100%', padding: '10px 16px', background: 'none',
        border: 'none', borderBottom: '1px solid #F0EFF8', cursor: 'pointer',
      }}
    >
      <Icon size={15} color="#7B5EA7" />
      <span style={{ flex: 1, fontSize: '13px', color: '#1A1A2E', textAlign: 'left' }}>{label}</span>
      <span style={{
        fontSize: '11px', fontWeight: 600, color: '#7B5EA7',
        background: '#F0EEF8', borderRadius: '10px', padding: '1px 7px',
      }}>{count}</span>
      {open ? <ChevronDown size={13} color="#999" /> : <ChevronRight size={13} color="#999" />}
    </button>
    {open && count === 0 && (
      <div style={{ padding: '10px 16px 10px 39px', fontSize: '12px', color: '#BBBBBB', fontStyle: 'italic' }}>
        None yet
      </div>
    )}
  </div>
);

// ─── Left Panel ───────────────────────────────────────────────────────────────

const LeftPanel = ({ data }: { data: ReturnType<typeof useLeadDetail>['data'] }) => {
  const [coreOpen, setCoreOpen] = useState(true);
  const [contactOpen, setContactOpen] = useState(true);
  const [dealOpen, setDealOpen] = useState(true);

  if (!data) return null;
  const { lead, phones, emails, addresses, contacts, milestones, waitingOn } = data;
  const tags = (lead.tags as string[]) ?? [];

  return (
    <div style={{
      width: '300px', flexShrink: 0, borderRight: '1px solid #EEEDF6',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Sticky lead name / badge header */}
      <div style={{
        padding: '20px 20px 16px', borderBottom: '1px solid #EEEDF6', flexShrink: 0,
        background: 'white',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '50%', background: '#EDE9F8',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <DollarSign size={20} color="#7B5EA7" />
          </div>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#1A1A2E' }}>{lead.name}</div>
            {lead.company_name && (
              <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>{lead.company_name}</div>
            )}
          </div>
        </div>
        <span style={{
          display: 'inline-block', background: '#EDE9F8', color: '#5B3FA8',
          borderRadius: '8px', fontSize: '11px', fontWeight: 600, padding: '3px 10px',
        }}>
          {STAGE_LABELS[lead.status] ?? lead.status}
        </span>
      </div>

      {/* Scrollable fields */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 80px' }}>

        {/* Core Fields */}
        <SectionHeader label="Deal Properties" open={coreOpen} onToggle={() => setCoreOpen(v => !v)} />
        {coreOpen && (
          <>
            <FieldRow label="Stage">
              <span style={{ background: '#EDE9F8', color: '#5B3FA8', borderRadius: '6px', padding: '2px 10px', fontSize: '12px', fontWeight: 600 }}>
                {STAGE_LABELS[lead.status] ?? lead.status}
              </span>
            </FieldRow>
            <FieldRow label="Opportunity Name">
              {lead.name}
            </FieldRow>
            <FieldRow label="Company">
              {lead.company_name ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Building2 size={13} color="#7B5EA7" />
                  {lead.company_name}
                </div>
              ) : <EmptyFieldValue placeholder="Add company" />}
            </FieldRow>
            <FieldRow label="Source">
              {lead.source ? (
                <span style={{ background: '#F0EEF8', color: '#4A3A7A', borderRadius: '6px', padding: '2px 8px', fontSize: '12px' }}>
                  {lead.source}
                </span>
              ) : <EmptyFieldValue placeholder="Add source" />}
            </FieldRow>
            <FieldRow label="Tags">
              {tags.length > 0
                ? <div style={{ display: 'flex', flexWrap: 'wrap' }}>{tags.map(t => <TagPill key={t} text={t} />)}</div>
                : <EmptyFieldValue placeholder="Add tags" />}
            </FieldRow>
            <FieldRow label="Created">
              {lead.created_at ? format(new Date(lead.created_at), 'MMM d, yyyy') : '—'}
            </FieldRow>
            <FieldRow label="Last Updated">
              {lead.updated_at ? format(new Date(lead.updated_at), 'MMM d, yyyy') : '—'}
            </FieldRow>
            <FieldRow label="Assigned To">
              {data.ownerName ?? <EmptyFieldValue placeholder="Unassigned" />}
            </FieldRow>
          </>
        )}

        {/* Contact Fields */}
        <SectionHeader label="Contact Info" open={contactOpen} onToggle={() => setContactOpen(v => !v)} />
        {contactOpen && (
          <>
            {contacts.length > 0 && (
              <FieldRow label="Primary Contact">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <User size={13} color="#7B5EA7" />
                  {contacts.find(c => c.is_primary)?.name ?? contacts[0]?.name}
                </div>
              </FieldRow>
            )}
            {phones.map((p, i) => (
              <FieldRow key={p.id} label={i === 0 ? 'Phone' : ''}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Phone size={13} color="#7B5EA7" />
                  <a href={`tel:${p.number}`} style={{ color: '#3D2B6B', textDecoration: 'none' }}>{p.number}</a>
                  {p.type && <span style={{ color: '#AAAAAA', fontSize: '11px' }}>({p.type})</span>}
                </div>
              </FieldRow>
            ))}
            {emails.map((e, i) => (
              <FieldRow key={e.id} label={i === 0 ? 'Email' : ''}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Mail size={13} color="#7B5EA7" />
                  <a href={`mailto:${e.email}`} style={{ color: '#3D2B6B', textDecoration: 'none' }}>{e.email}</a>
                </div>
              </FieldRow>
            ))}
            {addresses.map((a, i) => (
              <FieldRow key={a.id} label={i === 0 ? 'Address' : ''}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MapPin size={13} color="#7B5EA7" />
                  <span>{[a.street, a.city, a.state, a.zip].filter(Boolean).join(', ')}</span>
                </div>
              </FieldRow>
            ))}
            {phones.length === 0 && emails.length === 0 && addresses.length === 0 && contacts.length === 0 && (
              <div style={{ padding: '12px 0', color: '#BBBBBB', fontSize: '12px', fontStyle: 'italic' }}>No contact info on file</div>
            )}
          </>
        )}

        {/* Deal-specific Fields */}
        <SectionHeader label="Deal Details" open={dealOpen} onToggle={() => setDealOpen(v => !v)} />
        {dealOpen && (
          <>
            <FieldRow label="#UW">
              {(lead as any).uw_number ?? <EmptyFieldValue placeholder="Add #UW" />}
            </FieldRow>
            <FieldRow label="Waiting On">
              {waitingOn.length > 0
                ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>{waitingOn.map(w => <TagPill key={w.id} text={w.item} />)}</div>
                : <EmptyFieldValue placeholder="Nothing pending" />}
            </FieldRow>
            <FieldRow label="Milestones">
              {milestones.length > 0
                ? milestones.map(m => (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <CheckCircle2 size={13} color={m.completed ? '#27AE60' : '#CCC'} />
                    <span style={{ color: m.completed ? '#27AE60' : '#555', textDecoration: m.completed ? 'line-through' : 'none' }}>
                      {m.title}
                    </span>
                  </div>
                ))
                : <EmptyFieldValue placeholder="No milestones" />}
            </FieldRow>
            <FieldRow label="Weekly's">
              {(lead as any).flagged_for_weekly
                ? <span style={{ color: '#27AE60', fontWeight: 600 }}>Yes</span>
                : <EmptyFieldValue placeholder="Not flagged" />}
            </FieldRow>
          </>
        )}
      </div>

      {/* Add field footer */}
      <div style={{
        padding: '12px 16px', borderTop: '1px solid #EEEDF6', flexShrink: 0, background: 'white',
      }}>
        <button style={{
          display: 'flex', alignItems: 'center', gap: '6px', width: '100%',
          background: 'none', border: '1px dashed #D8D6EE', borderRadius: '8px',
          padding: '8px 12px', color: '#888', fontSize: '13px', cursor: 'pointer',
        }}>
          <Plus size={14} color="#7B5EA7" />
          Add new field
        </button>
      </div>
    </div>
  );
};

// ─── Center Panel ─────────────────────────────────────────────────────────────

const CenterPanel = ({ data }: { data: ReturnType<typeof useLeadDetail>['data'] }) => {
  const [activityTab, setActivityTab] = useState<ActivityTab>('note');
  const [noteText, setNoteText] = useState('');

  if (!data) return null;
  const { lead, activities } = data;

  const now = new Date();
  const lastActivity = lead.last_activity_at ? new Date(lead.last_activity_at) : null;
  const inactiveDays = lastActivity ? differenceInDays(now, lastActivity) : null;
  const daysInStage = lead.updated_at ? differenceInDays(now, new Date(lead.updated_at)) : null;

  const activityTypeIcon = (type: string) => {
    switch (type) {
      case 'call': return <Phone size={13} color="#7B5EA7" />;
      case 'email': return <Mail size={13} color="#7B5EA7" />;
      case 'meeting': return <Calendar size={13} color="#7B5EA7" />;
      case 'note': return <MessageSquare size={13} color="#7B5EA7" />;
      default: return <Activity size={13} color="#7B5EA7" />;
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
      {/* Stats bar */}
      <div style={{
        display: 'flex', borderBottom: '1px solid #EEEDF6', background: '#FAFAFA', flexShrink: 0,
      }}>
        <StatCard label="Interactions" value={activities.length} />
        <StatCard
          label="Last Contacted"
          value={lastActivity ? format(lastActivity, 'M/d/yy') : '—'}
        />
        <StatCard
          label="Inactive Days"
          value={inactiveDays ?? '—'}
          sub={inactiveDays !== null && inactiveDays > 14 ? 'Overdue' : undefined}
        />
        <StatCard
          label="Days in Stage"
          value={daysInStage ?? '—'}
        />
      </div>

      {/* Note / Log tabs */}
      <div style={{
        padding: '16px 20px', borderBottom: '1px solid #EEEDF6', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          {(['note', 'log'] as ActivityTab[]).map(t => (
            <button
              key={t}
              onClick={() => setActivityTab(t)}
              style={{
                padding: '6px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 500,
                border: activityTab === t ? '1px solid #7B5EA7' : '1px solid #E0DFF0',
                background: activityTab === t ? '#F0EEF8' : 'white',
                color: activityTab === t ? '#3D2B6B' : '#666',
                cursor: 'pointer',
              }}
            >
              {t === 'note' ? 'Create Note' : 'Log Activity'}
            </button>
          ))}
        </div>
        <textarea
          value={noteText}
          onChange={e => setNoteText(e.target.value)}
          placeholder={activityTab === 'note' ? 'Write a note…' : 'Log a call, meeting, or email…'}
          rows={3}
          style={{
            width: '100%', border: '1px solid #E0DFF0', borderRadius: '8px',
            padding: '10px 12px', fontSize: '13px', resize: 'vertical', outline: 'none',
            fontFamily: 'inherit', color: '#1A1A2E', boxSizing: 'border-box',
          }}
        />
        {noteText.trim() && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
            <button
              onClick={() => setNoteText('')}
              style={{
                background: '#3D2B6B', color: 'white', border: 'none', borderRadius: '8px',
                padding: '7px 18px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              }}
            >
              Save
            </button>
          </div>
        )}
      </div>

      {/* Activity feed */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        {activities.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '60px 20px', color: '#BBBBBB', gap: '12px',
          }}>
            <Activity size={32} color="#DDD" />
            <div style={{ fontSize: '14px' }}>No activity yet</div>
            <div style={{ fontSize: '12px', textAlign: 'center' }}>
              Log a call, send an email, or create a note to track progress.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
            {activities.map((act) => (
              <div
                key={act.id}
                style={{
                  display: 'flex', gap: '12px', padding: '14px 0',
                  borderBottom: '1px solid #F5F4FB',
                }}
              >
                <div style={{
                  width: '32px', height: '32px', borderRadius: '50%',
                  background: '#EDE9F8', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', flexShrink: 0, marginTop: '2px',
                }}>
                  {activityTypeIcon((act as any).type ?? 'activity')}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#1A1A2E' }}>
                      {(act as any).title ?? (act as any).type ?? 'Activity'}
                    </span>
                    <span style={{ fontSize: '11px', color: '#AAA' }}>
                      {act.created_at ? formatDistanceToNow(new Date(act.created_at), { addSuffix: true }) : ''}
                    </span>
                  </div>
                  {(act as any).description && (
                    <div style={{ fontSize: '13px', color: '#555', lineHeight: 1.5 }}>{(act as any).description}</div>
                  )}
                  {(act as any).body && (
                    <div style={{ fontSize: '13px', color: '#555', lineHeight: 1.5 }}>{(act as any).body}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Right Panel ──────────────────────────────────────────────────────────────

const RightPanel = ({ data }: { data: ReturnType<typeof useLeadDetail>['data'] }) => {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    people: true, companies: false, tasks: true, files: false,
    calendar: false, projects: false, pipeline: false,
  });

  const toggle = (key: string) => setOpenSections(p => ({ ...p, [key]: !p[key] }));

  if (!data) return null;
  const { contacts, tasks } = data;
  const companyName = data.lead.company_name;

  const openTasks = tasks.filter(t => !(t as any).completed);

  return (
    <div style={{
      width: '240px', flexShrink: 0, borderLeft: '1px solid #EEEDF6',
      overflowY: 'auto', background: '#FAFAFA',
    }}>
      <div style={{ padding: '14px 16px 6px', fontSize: '11px', fontWeight: 700, color: '#9999B3', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
        Related Records
      </div>

      <RelatedItem icon={Users} label="People" count={contacts.length} open={openSections.people} onToggle={() => toggle('people')} />
      {openSections.people && contacts.length > 0 && (
        <div style={{ padding: '4px 16px 8px 39px' }}>
          {contacts.map(c => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 0', fontSize: '12px', color: '#333' }}>
              <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#E0DDF8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <User size={12} color="#7B5EA7" />
              </div>
              <span>{c.name}</span>
              {c.is_primary && <span style={{ fontSize: '10px', color: '#7B5EA7', fontWeight: 600 }}>Primary</span>}
            </div>
          ))}
        </div>
      )}

      <RelatedItem icon={Building2} label="Companies" count={companyName ? 1 : 0} open={openSections.companies} onToggle={() => toggle('companies')} />
      {openSections.companies && companyName && (
        <div style={{ padding: '4px 16px 8px 39px', fontSize: '12px', color: '#333' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 0' }}>
            <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#E0DDF8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Building2 size={12} color="#7B5EA7" />
            </div>
            {companyName}
          </div>
        </div>
      )}

      <RelatedItem icon={CheckCircle2} label="Tasks" count={tasks.length} open={openSections.tasks} onToggle={() => toggle('tasks')} />
      {openSections.tasks && tasks.length > 0 && (
        <div style={{ padding: '4px 16px 8px 39px' }}>
          {tasks.map(t => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', padding: '5px 0', fontSize: '12px', color: '#333' }}>
              <CheckCircle2 size={13} color={(t as any).completed ? '#27AE60' : '#CCC'} style={{ marginTop: '1px', flexShrink: 0 }} />
              <div>
                <div style={{ textDecoration: (t as any).completed ? 'line-through' : 'none', color: (t as any).completed ? '#AAA' : '#333' }}>
                  {(t as any).title}
                </div>
                {(t as any).due_date && (
                  <div style={{ fontSize: '11px', color: '#AAA' }}>{format(new Date((t as any).due_date), 'MMM d')}</div>
                )}
              </div>
            </div>
          ))}
          {openTasks.length > 0 && (
            <button style={{ marginTop: '6px', fontSize: '11px', color: '#7B5EA7', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              <Plus size={11} style={{ verticalAlign: 'middle' }} /> Add task
            </button>
          )}
        </div>
      )}

      <RelatedItem icon={FileText} label="Files" count={0} open={openSections.files} onToggle={() => toggle('files')} />
      <RelatedItem icon={Calendar} label="Calendar Events" count={0} open={openSections.calendar} onToggle={() => toggle('calendar')} />
      <RelatedItem icon={Briefcase} label="Projects" count={0} open={openSections.projects} onToggle={() => toggle('projects')} />
      <RelatedItem icon={GitBranch} label="Pipeline Records" count={0} open={openSections.pipeline} onToggle={() => toggle('pipeline')} />
    </div>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

const UnderwritingOpportunityDetail = () => {
  const { leadId } = useParams<{ leadId: string }>();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useLeadDetail(leadId ?? '');

  const handleBack = () => navigate('/admin/evan/pipeline/underwriting');

  return (
    <EvanLayout>
      <div style={{
        display: 'flex', flexDirection: 'column', height: 'calc(100vh - 130px)',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        background: 'white',
      }}>
        {/* Top bar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 20px', borderBottom: '1px solid #EEEDF6', flexShrink: 0, background: 'white',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={handleBack}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                background: 'none', border: '1px solid #E0DFF0', borderRadius: '8px',
                padding: '7px 12px', fontSize: '13px', color: '#555', cursor: 'pointer', fontWeight: 500,
              }}
            >
              <ArrowLeft size={14} />
              Back to Underwriting
            </button>
            {data && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#888' }}>
                <span>Underwriting</span>
                <ChevronRight size={13} color="#CCC" />
                <span style={{ color: '#1A1A2E', fontWeight: 600 }}>{data.lead.name}</span>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button style={{
              background: '#3D2B6B', color: 'white', border: 'none', borderRadius: '8px',
              padding: '8px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
            }}>
              Follow
            </button>
            <button style={{ background: 'none', border: '1px solid #E0DFF0', borderRadius: '8px', padding: '7px 10px', cursor: 'pointer' }}>
              <MoreHorizontal size={16} color="#666" />
            </button>
          </div>
        </div>

        {/* Body */}
        {isLoading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
            <Loader2 size={24} color="#7B5EA7" style={{ animation: 'spin 1s linear infinite' }} />
            <span style={{ fontSize: '14px', color: '#888' }}>Loading opportunity…</span>
          </div>
        ) : isError || !data ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#1A1A2E' }}>Opportunity not found</div>
            <button onClick={handleBack} style={{ color: '#3D2B6B', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px' }}>
              ← Return to Underwriting
            </button>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            <LeftPanel data={data} />
            <CenterPanel data={data} />
            <RightPanel data={data} />
          </div>
        )}
      </div>
    </EvanLayout>
  );
};

export default UnderwritingOpportunityDetail;

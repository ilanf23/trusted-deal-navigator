// supabase/functions/_shared/aiAgent/context.ts
// Builds the markdown context string passed to the AI assistant chat prompt.
// Shared by ai-assistant-chat edge function.

import { createClient } from "../supabase.ts";

export async function buildChatContext(
  supabase: ReturnType<typeof createClient>,
  scopedMemberId: string | undefined,
  displayName: string,
): Promise<string> {
  if (!scopedMemberId) return "";

  // Fetch the scoped team member's data for context
  let contextData = "";

  const { data: leads } = await supabase
    .from("leads")
    .select("id, name, company_name, status, email, phone, updated_at, notes, source, tags, next_action, waiting_on")
    .eq("assigned_to", scopedMemberId)
    .order("updated_at", { ascending: false })
    .limit(50);

  // Fetch pending tasks
  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, title, description, status, priority, due_date, is_completed, lead_id, tags, user_id")
    .eq("is_completed", false)
    .order("due_date", { ascending: true })
    .limit(30);

  // Fetch recent communications WITH TRANSCRIPTS
  const { data: communications } = await supabase
    .from("communications")
    .select("id, lead_id, communication_type, direction, created_at, content, duration_seconds, transcript, status, phone_number")
    .order("created_at", { ascending: false })
    .limit(50);

  // Fetch notes
  const { data: notes } = await supabase
    .from("notes")
    .select("id, content, is_pinned, created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  // Fetch upcoming appointments
  const { data: appointments } = await supabase
    .from("appointments")
    .select("id, title, start_time, end_time, description, lead_id, appointment_type")
    .gte("start_time", new Date().toISOString())
    .order("start_time", { ascending: true })
    .limit(20);

  // Fetch lead responses (questionnaire data)
  const { data: leadResponses } = await supabase
    .from("lead_responses")
    .select("lead_id, loan_amount, loan_type, funding_purpose, annual_revenue, business_type, borrower_credit_score, submitted_at")
    .order("submitted_at", { ascending: false })
    .limit(30);

  // Fetch email threads metadata
  const { data: emailThreads } = await supabase
    .from("email_threads")
    .select("id, thread_id, subject, lead_id, waiting_on, next_action, last_message_date, sla_breached")
    .order("last_message_date", { ascending: false })
    .limit(20);

  // Build context string
  contextData = `
## ${displayName}'s CRM Data (Current as of ${new Date().toISOString()})

### Leads (${leads?.length || 0} total)
${leads?.map(l => `- **${l.name}**${l.company_name ? ` (${l.company_name})` : ''}: Status: ${l.status}, Source: ${l.source || 'unknown'}${l.next_action ? `, Next: ${l.next_action}` : ''}${l.waiting_on ? `, Waiting on: ${l.waiting_on}` : ''}${l.notes ? `, Notes: ${l.notes.substring(0, 150)}` : ''}`).join('\n') || 'No leads found'}

### Pipeline Summary
${(() => {
  const statusCounts: Record<string, number> = {};
  leads?.forEach(l => {
    statusCounts[l.status] = (statusCounts[l.status] || 0) + 1;
  });
  return Object.entries(statusCounts).map(([status, count]) => `- ${status}: ${count} leads`).join('\n') || 'No data';
})()}

### Pending Tasks (${tasks?.length || 0} total)
${tasks?.map(t => {
  const lead = leads?.find(l => l.id === t.lead_id);
  const dueStr = t.due_date ? `Due: ${new Date(t.due_date).toLocaleDateString()}` : 'No due date';
  return `- [${t.priority?.toUpperCase() || 'MEDIUM'}] ${t.title}${lead ? ` (${lead.name})` : ''} - ${dueStr}${t.tags?.length ? ` [${t.tags.join(', ')}]` : ''}`;
}).join('\n') || 'No pending tasks'}

### Overdue Tasks
${tasks?.filter(t => t.due_date && new Date(t.due_date) < new Date()).map(t => {
  const lead = leads?.find(l => l.id === t.lead_id);
  return `- ${t.title}${lead ? ` (${lead.name})` : ''} - Was due: ${new Date(t.due_date!).toLocaleDateString()}`;
}).join('\n') || 'No overdue tasks'}

### Upcoming Appointments
${appointments?.map(a => {
  const lead = leads?.find(l => l.id === a.lead_id);
  return `- ${new Date(a.start_time).toLocaleString()}: ${a.title}${lead ? ` with ${lead.name}` : ''}${a.appointment_type ? ` (${a.appointment_type})` : ''}`;
}).join('\n') || 'No upcoming appointments'}

### Recent Communications (last 50)
${communications?.map(c => {
  const lead = leads?.find(l => l.id === c.lead_id);
  const hasTranscript = c.transcript && c.transcript.length > 0;
  return `- ${new Date(c.created_at).toLocaleDateString()}: ${c.communication_type} (${c.direction}) ${lead ? `with ${lead.name}` : c.phone_number || 'unknown'}${c.duration_seconds ? ` - ${Math.round(c.duration_seconds / 60)} min` : ''}${hasTranscript ? ' [HAS TRANSCRIPT]' : ''}`;
}).join('\n') || 'No recent communications'}

### Call Transcripts (Recent calls with transcripts)
${communications?.filter(c => c.transcript && c.transcript.length > 50).slice(0, 10).map(c => {
  const lead = leads?.find(l => l.id === c.lead_id);
  return `
#### Call with ${lead?.name || c.phone_number || 'Unknown'} on ${new Date(c.created_at).toLocaleDateString()} (${c.direction})
${c.transcript!.substring(0, 1000)}${c.transcript!.length > 1000 ? '...[truncated]' : ''}
`;
}).join('\n') || 'No transcripts available'}

### Lead Questionnaire Data
${leadResponses?.map(r => {
  const lead = leads?.find(l => l.id === r.lead_id);
  return `- ${lead?.name || 'Unknown'}: Loan: $${r.loan_amount?.toLocaleString() || 'N/A'}, Type: ${r.loan_type || 'N/A'}, Purpose: ${r.funding_purpose || 'N/A'}, Revenue: ${r.annual_revenue || 'N/A'}, Credit: ${r.borrower_credit_score || 'N/A'}`;
}).join('\n') || 'No questionnaire responses'}

### Email Threads Needing Attention
${emailThreads?.filter(e => e.sla_breached || e.waiting_on).map(e => {
  const lead = leads?.find(l => l.id === e.lead_id);
  return `- "${e.subject}" ${lead ? `(${lead.name})` : ''}: ${e.waiting_on ? `Waiting on: ${e.waiting_on}` : ''}${e.sla_breached ? ' ⚠️ SLA BREACHED' : ''}`;
}).join('\n') || 'All email threads up to date'}

### Leads Needing Follow-up (no activity in 7+ days)
${(() => {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const staleLeads = leads?.filter(l => new Date(l.updated_at) < sevenDaysAgo && l.status !== 'funded');
  return staleLeads?.map(l => `- ${l.name}${l.company_name ? ` (${l.company_name})` : ''}: Last activity ${Math.floor((Date.now() - new Date(l.updated_at).getTime()) / (1000 * 60 * 60 * 24))} days ago`).join('\n') || 'All leads are up to date';
})()}

### Pinned Notes
${notes?.filter(n => n.is_pinned).map(n => `- ${n.content.substring(0, 200)}`).join('\n') || 'No pinned notes'}

### Recent Notes
${notes?.slice(0, 5).map(n => `- ${new Date(n.created_at).toLocaleDateString()}: ${n.content.substring(0, 150)}${n.content.length > 150 ? '...' : ''}`).join('\n') || 'No recent notes'}
`;

  // Fetch Dropbox files linked to leads for AI context
  const { data: dropboxFiles } = await supabase
    .from("dropbox_files")
    .select("name, dropbox_path_display, lead_id, lead_name, extracted_text, size, modified_at")
    .not("lead_id", "is", null)
    .eq("is_folder", false)
    .order("modified_at", { ascending: false })
    .limit(30);

  if (dropboxFiles && dropboxFiles.length > 0) {
    contextData += `\n### Dropbox Files Linked to Leads (${dropboxFiles.length} files)
${dropboxFiles.map(f => {
  const textPreview = f.extracted_text ? f.extracted_text.substring(0, 200) + '...' : 'No text extracted';
  return `- **${f.name}** (${f.lead_name || 'Unknown lead'}): ${f.dropbox_path_display}${f.extracted_text ? `\n  Content preview: ${textPreview}` : ''}`;
}).join('\n')}
`;
  }

  return contextData;
}

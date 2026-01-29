-- Persisted outbox for Move Forward (source-of-truth)
create table if not exists public.outbound_emails (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  flow_id text not null,
  source text not null default 'move_forward',
  lead_id uuid null references public.leads(id) on delete set null,

  to_email text not null,
  subject text not null,
  body_html text not null default '',
  body_plain text not null default '',

  gmail_message_id text null,
  gmail_thread_id text null,
  reply_thread_id text null,
  reply_in_reply_to text null,

  status text not null default 'queued',
  error text null,
  sent_at timestamptz null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists outbound_emails_flow_id_uidx on public.outbound_emails(flow_id);
create index if not exists outbound_emails_user_status_idx on public.outbound_emails(user_id, status);
create index if not exists outbound_emails_lead_idx on public.outbound_emails(lead_id);

alter table public.outbound_emails enable row level security;

-- RLS: users can only access their own outbound emails
create policy "Outbound emails are readable by owner"
on public.outbound_emails
for select
using (auth.uid() = user_id);

create policy "Outbound emails are insertable by owner"
on public.outbound_emails
for insert
with check (auth.uid() = user_id);

create policy "Outbound emails are updatable by owner"
on public.outbound_emails
for update
using (auth.uid() = user_id);

create policy "Outbound emails are deletable by owner"
on public.outbound_emails
for delete
using (auth.uid() = user_id);

-- Keep updated_at in sync
drop trigger if exists trg_outbound_emails_updated_at on public.outbound_emails;
create trigger trg_outbound_emails_updated_at
before update on public.outbound_emails
for each row
execute function public.update_updated_at_column();

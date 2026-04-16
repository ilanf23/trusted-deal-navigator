do $$
declare
  cnt_ot int;
  cnt_et int;
  cnt_ht int;
begin
  select count(*) into cnt_ot from public.outbound_emails where gmail_thread_id is not null;
  select count(*) into cnt_et from public.email_threads;
  select count(*) into cnt_ht from public.hidden_email_threads;
  raise notice 'outbound_emails.gmail_thread_id non-null count=%', cnt_ot;
  raise notice 'email_threads count=%', cnt_et;
  raise notice 'hidden_email_threads count=%', cnt_ht;
end$$;

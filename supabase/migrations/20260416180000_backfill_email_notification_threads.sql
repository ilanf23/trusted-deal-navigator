-- outbound_emails.gmail_thread_id is empty in this project. Try the
-- email_threads table (populated by the CRM triage flow) as the source
-- of real Gmail thread IDs for email-type notifications.

update public.notifications
set target_id = (select thread_id
                 from public.email_threads
                 order by last_message_date desc nulls last, created_at desc nulls last
                 limit 1),
    link_url = null
where type = 'email'
  and target_id is null
  and exists (select 1 from public.email_threads);

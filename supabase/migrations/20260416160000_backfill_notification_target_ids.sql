-- Backfill target_id on every seeded notification so
-- trg_notifications_set_link_url builds item-specific URLs.
-- link_url is cleared in the same UPDATE to force the trigger to recompute.

update public.notifications
set target_id = (select id::text from public.people order by created_at desc limit 1),
    link_url = null
where type = 'lead'
  and exists (select 1 from public.people);

update public.notifications
set target_id = (select id::text from public.potential order by created_at desc limit 1),
    link_url = null
where type in ('opportunity', 'closed')
  and exists (select 1 from public.potential);

update public.notifications
set target_id = (select id::text from public.entity_projects order by created_at desc limit 1),
    link_url = null
where type = 'project'
  and exists (select 1 from public.entity_projects);

update public.notifications
set target_id = (select gmail_thread_id
                 from public.outbound_emails
                 where gmail_thread_id is not null
                 order by created_at desc
                 limit 1),
    link_url = null
where type = 'email'
  and exists (select 1 from public.outbound_emails where gmail_thread_id is not null);

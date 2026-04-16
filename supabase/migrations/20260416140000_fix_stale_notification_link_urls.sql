-- Existing seeded notifications point at routes that were removed or redirect
-- to /admin/dashboard. Rewrite them to the current section URLs by type.

update public.notifications
set link_url = case type
  when 'email'       then '/admin/gmail'
  when 'lead'        then '/admin/contacts/people'
  when 'opportunity' then '/admin/pipeline/potential'
  when 'closed'      then '/admin/pipeline/potential'
  when 'project'     then '/admin/pipeline/projects'
  else null
end
where coalesce(link_url, '') not like '/admin/gmail%'
  and coalesce(link_url, '') not like '/admin/contacts/people%'
  and coalesce(link_url, '') not like '/admin/pipeline/%';

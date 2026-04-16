-- Auto-populate notifications.link_url so NotificationBell click-through lands somewhere real.
-- Client-side equivalent of the URL map lives in src/lib/notificationLinks.ts.

alter table public.notifications
  add column if not exists target_id text;

create or replace function public.notifications_set_link_url()
returns trigger
language plpgsql
as $$
begin
  if new.link_url is not null and new.link_url <> '' then
    return new;
  end if;

  new.link_url := case new.type
    when 'email' then
      case when new.target_id is not null
        then '/admin/gmail?thread=' || new.target_id
        else '/admin/gmail'
      end
    when 'lead' then
      case when new.target_id is not null
        then '/admin/contacts/people/expanded-view/' || new.target_id
        else '/admin/contacts/people'
      end
    when 'opportunity' then
      case when new.target_id is not null
        then '/admin/pipeline/potential/expanded-view/' || new.target_id
        else '/admin/pipeline/potential'
      end
    when 'closed' then
      case when new.target_id is not null
        then '/admin/pipeline/potential/expanded-view/' || new.target_id
        else '/admin/pipeline/potential'
      end
    when 'project' then
      case when new.target_id is not null
        then '/admin/pipeline/projects/expanded-view/' || new.target_id
        else '/admin/pipeline/projects'
      end
    else null
  end;

  return new;
end;
$$;

drop trigger if exists trg_notifications_set_link_url on public.notifications;
create trigger trg_notifications_set_link_url
  before insert or update of type, target_id, link_url
  on public.notifications
  for each row
  execute function public.notifications_set_link_url();

update public.notifications
set link_url = case type
  when 'email'       then '/admin/gmail'
  when 'lead'        then '/admin/contacts/people'
  when 'opportunity' then '/admin/pipeline/potential'
  when 'closed'      then '/admin/pipeline/potential'
  when 'project'     then '/admin/pipeline/projects'
  else null
end
where link_url is null or link_url = '';

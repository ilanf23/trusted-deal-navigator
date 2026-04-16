do $$
declare r record;
begin
  for r in
    select type, title, target_id, link_url
    from public.notifications
    where type = 'email'
  loop
    raise notice 'email type=% title=% target_id=% link_url=%', r.type, r.title, r.target_id, r.link_url;
  end loop;
end$$;

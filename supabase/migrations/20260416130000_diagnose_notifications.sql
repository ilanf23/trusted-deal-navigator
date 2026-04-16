do $$
declare
  r record;
begin
  raise notice '--- notifications link_url distribution ---';
  for r in
    select
      type,
      coalesce(link_url, '<NULL>') as link_url,
      count(*) as c
    from public.notifications
    group by type, link_url
    order by type, link_url
  loop
    raise notice 'type=% link_url=% count=%', r.type, r.link_url, r.c;
  end loop;

  raise notice '--- sample of 5 rows ---';
  for r in
    select id, type, title, link_url from public.notifications order by created_at desc limit 5
  loop
    raise notice 'id=% type=% title=% link_url=%', r.id, r.type, r.title, r.link_url;
  end loop;
end$$;

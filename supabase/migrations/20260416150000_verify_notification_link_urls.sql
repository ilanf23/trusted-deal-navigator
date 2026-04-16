do $$
declare r record;
begin
  raise notice '--- post-fix link_url distribution ---';
  for r in
    select type, coalesce(link_url, '<NULL>') as link_url, count(*) as c
    from public.notifications
    group by type, link_url
    order by type, link_url
  loop
    raise notice 'type=% link_url=% count=%', r.type, r.link_url, r.c;
  end loop;
end$$;

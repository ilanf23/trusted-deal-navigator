do $$
declare r record;
begin
  raise notice '--- post-backfill notifications ---';
  for r in
    select type, title, target_id, link_url
    from public.notifications
    order by type, created_at desc
  loop
    raise notice 'type=% title=% target_id=% link_url=%', r.type, r.title, r.target_id, r.link_url;
  end loop;
end$$;

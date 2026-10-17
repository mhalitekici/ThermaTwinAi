-- Apply once using Supabase SQL Editor or supabase db push. Never expose service_role to Vite.
create table public.regions (
  id text primary key, name text not null, latitude double precision not null,
  longitude double precision not null, bounds jsonb not null, active boolean not null default true
);
insert into public.regions values ('akkuyu', 'Akkuyu açıkları, Mersin', 36.05, 33.55,
  '[35.95,33.40,36.15,33.70]', true);

create table public.subscriptions (
  user_id uuid not null references auth.users(id) on delete cascade,
  region_id text not null references public.regions(id),
  active boolean not null default true, created_at timestamptz not null default now(),
  primary key (user_id,region_id)
);
create table public.observations (
  region_id text not null references public.regions(id), observed_on date not null,
  sst_c double precision not null check (sst_c between -2 and 40),
  dataset_id text not null, retrieved_at timestamptz not null,
  primary key(region_id,observed_on,dataset_id)
);
create table public.forecasts (
  region_id text not null references public.regions(id), origin_date date not null,
  horizon_days integer not null check(horizon_days between 1 and 3),
  target_date date not null, sst_c double precision not null,
  lower_c double precision not null, upper_c double precision not null,
  dataset_id text not null, method text not null,
  check(target_date = origin_date + horizon_days), check(lower_c <= sst_c and sst_c <= upper_c),
  primary key(region_id,origin_date,horizon_days,dataset_id)
);
create table public.snapshots (
  region_id text not null references public.regions(id), mode text not null check(mode in ('live','replay')),
  payload jsonb not null, updated_at timestamptz not null default now(), primary key(region_id,mode)
);
create table public.alerts (
  id uuid primary key default gen_random_uuid(), region_id text not null references public.regions(id),
  mode text not null check(mode in ('live','replay')), kind text not null check(kind in ('observed','predicted')),
  event_date date not null, last_seen date not null, dataset_id text not null,
  risk text not null check(risk in ('watch','high')), report jsonb not null,
  created_at timestamptz not null default now(), unique(region_id,mode,kind,event_date,dataset_id)
);
create table public.deliveries (
  id uuid primary key default gen_random_uuid(), alert_id uuid not null references public.alerts(id),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check(status in ('pending','sending','sent','failed','uncertain')),
  payload jsonb not null, attempts integer not null default 0,
  first_attempt_at timestamptz, lease_until timestamptz, claim_token uuid,
  provider_id text, error text, sent_at timestamptz, created_at timestamptz not null default now(),
  unique(alert_id,user_id)
);
create index deliveries_user_idx on public.deliveries(user_id,created_at desc);
create index alerts_episode_idx on public.alerts(region_id,mode,kind,dataset_id,last_seen desc);
create table public.monitor_runs (
  id uuid primary key default gen_random_uuid(), checked_at timestamptz not null default now(),
  status text not null, detail text, observation_date date
);

alter table public.regions enable row level security;
alter table public.subscriptions enable row level security;
alter table public.observations enable row level security;
alter table public.forecasts enable row level security;
alter table public.snapshots enable row level security;
alter table public.alerts enable row level security;
alter table public.deliveries enable row level security;
alter table public.monitor_runs enable row level security;

grant usage on schema public to anon, authenticated, service_role;
grant select on public.regions, public.observations, public.forecasts, public.snapshots to anon, authenticated;
grant select, insert, update, delete on public.subscriptions to authenticated;
grant select on public.alerts, public.deliveries to authenticated;
grant all on all tables in schema public to service_role;
create policy regions_read on public.regions for select using(active);
create policy observations_read on public.observations for select using(true);
create policy forecasts_read on public.forecasts for select using(true);
create policy snapshots_read on public.snapshots for select using(true);
create policy subscriptions_read on public.subscriptions for select to authenticated using(user_id = (select auth.uid()));
create policy subscriptions_insert on public.subscriptions for insert to authenticated
  with check(user_id = (select auth.uid()) and exists(select 1 from public.regions where id=region_id and active));
create policy subscriptions_update on public.subscriptions for update to authenticated
  using(user_id = (select auth.uid())) with check(user_id = (select auth.uid()));
create policy subscriptions_delete on public.subscriptions for delete to authenticated using(user_id = (select auth.uid()));
create policy deliveries_read on public.deliveries for select to authenticated using(user_id = (select auth.uid()));
create policy alerts_read on public.alerts for select to authenticated
  using(exists(select 1 from public.deliveries d where d.alert_id=alerts.id and d.user_id=(select auth.uid())));

-- A continuous event produces one immutable report. Three quiet days allow a new episode.
create function public.register_alert(p_event jsonb) returns public.alerts
language plpgsql security definer set search_path = public, pg_temp as $$
declare result public.alerts; event_day date := (p_event->>'event_date')::date;
begin
  perform pg_advisory_xact_lock(hashtextextended(
    (p_event->>'region_id') || (p_event->>'mode') || (p_event->>'kind') || (p_event->>'dataset_id'),0));
  select * into result from public.alerts where region_id=p_event->>'region_id'
    and mode=p_event->>'mode' and kind=p_event->>'kind' and dataset_id=p_event->>'dataset_id'
    and event_day between event_date and last_seen + 3 order by last_seen desc limit 1;
  if found then
    update public.alerts set last_seen=greatest(last_seen,event_day) where id=result.id returning * into result;
    return result;
  end if;
  insert into public.alerts(region_id,mode,kind,event_date,last_seen,dataset_id,risk,report)
    values(p_event->>'region_id',p_event->>'mode',p_event->>'kind',event_day,event_day,
      p_event->>'dataset_id',p_event->>'risk',p_event->'report')
    on conflict(region_id,mode,kind,event_date,dataset_id) do update set last_seen=excluded.last_seen
    returning * into result;
  return result;
end $$;

-- Claim and freeze payload atomically. The same Resend idempotency key and body survive retries.
create function public.claim_delivery(p_alert uuid, p_user uuid, p_payload jsonb) returns setof public.deliveries
language plpgsql security definer set search_path = public, pg_temp as $$
declare a public.alerts; d public.deliveries;
begin
  select * into a from public.alerts where id=p_alert;
  if not found or not exists(select 1 from public.subscriptions s join auth.users u on u.id=s.user_id
    where s.user_id=p_user and s.region_id=a.region_id and s.active and u.email_confirmed_at is not null) then
    return;
  end if;
  insert into public.deliveries(alert_id,user_id,payload) values(p_alert,p_user,p_payload)
    on conflict(alert_id,user_id) do nothing;
  select * into d from public.deliveries where alert_id=p_alert and user_id=p_user for update;
  if d.status in ('sent','uncertain') or d.lease_until > now() then return; end if;
  if d.first_attempt_at < now() - interval '23 hours' then
    update public.deliveries set status='uncertain',error='Retry window expired; reconcile with provider' where id=d.id;
    return;
  end if;
  return query update public.deliveries set status='sending', attempts=attempts+1,
    first_attempt_at=coalesce(first_attempt_at,now()), lease_until=now()+interval '5 minutes',claim_token=gen_random_uuid()
    where id=d.id returning *;
end $$;
revoke all on function public.register_alert(jsonb) from public, anon, authenticated;
revoke all on function public.claim_delivery(uuid,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.register_alert(jsonb) to service_role;
grant execute on function public.claim_delivery(uuid,uuid,jsonb) to service_role;

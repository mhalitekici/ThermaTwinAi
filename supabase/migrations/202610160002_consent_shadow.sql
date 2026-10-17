-- Additive upgrade. Existing subscriptions do NOT imply email consent.
alter table public.subscriptions
  add column email_enabled boolean not null default false,
  add column consent_version text,
  add column consented_at timestamptz,
  add column updated_at timestamptz not null default now(),
  add constraint subscription_email_consent check (
    not email_enabled or (active and consented_at is not null and consent_version = 'observed-info-v1'));

create table public.subscription_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  region_id text not null references public.regions(id),
  action text not null, consent_version text, created_at timestamptz not null default now()
);
alter table public.subscription_events enable row level security;
grant select on public.subscription_events to authenticated;
grant all on public.subscription_events to service_role;
create policy subscription_events_own on public.subscription_events for select to authenticated
  using(user_id = (select auth.uid()));
revoke insert, update, delete on public.subscriptions from authenticated;

create function public.manage_subscription(p_action text, p_consent boolean default false)
returns public.subscriptions language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := auth.uid(); result public.subscriptions;
begin
  if uid is null or not exists(select 1 from auth.users where id=uid and email_confirmed_at is not null) then
    raise exception 'Verified email required' using errcode='42501';
  end if;
  if p_action is null or p_action not in ('subscribe','email_on','email_off','cancel') then
    raise exception 'Invalid action' using errcode='22023';
  end if;
  if not exists(select 1 from public.regions where id='akkuyu' and active) then
    raise exception 'Region unavailable';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text || ':akkuyu:subscription',0));
  if p_action='subscribe' then
    insert into public.subscriptions(user_id,region_id,active,email_enabled,consent_version,consented_at)
      values(uid,'akkuyu',true,coalesce(p_consent,false),case when p_consent then 'observed-info-v1' end,case when p_consent then now() end)
      on conflict(user_id,region_id) do update set active=true,email_enabled=excluded.email_enabled,
        consent_version=excluded.consent_version,consented_at=excluded.consented_at,updated_at=now()
      returning * into result;
  else
    if p_action='email_on' and p_consent is distinct from true then raise exception 'Explicit consent required' using errcode='22023'; end if;
    update public.subscriptions set
      active=case when p_action='cancel' then false else active end,
      email_enabled=(p_action='email_on'),
      consent_version=case when p_action='email_on' then 'observed-info-v1' end,
      consented_at=case when p_action='email_on' then now() end,updated_at=now()
      where user_id=uid and region_id='akkuyu' and (p_action<>'email_on' or active)
      returning * into result;
  end if;
  if result.user_id is not null then
    insert into public.subscription_events(user_id,region_id,action,consent_version)
      values(uid,'akkuyu',p_action,result.consent_version);
  end if;
  return result;
end $$;
revoke all on function public.manage_subscription(text,boolean) from public, anon;
grant execute on function public.manage_subscription(text,boolean) to authenticated;

alter table public.alerts add column episode_key text;
alter table public.alerts drop constraint alerts_risk_check;
alter table public.alerts add constraint alerts_risk_check
  check(risk in ('normal','watch','high') and (kind<>'observed' or risk in ('watch','high')));
create unique index alerts_stable_episode on public.alerts(region_id,mode,kind,dataset_id,episode_key) where episode_key is not null;

create or replace function public.register_alert(p_event jsonb) returns public.alerts
language plpgsql security definer set search_path = public, pg_temp as $$
declare result public.alerts; event_day date := (p_event->>'event_date')::date; episode text := nullif(p_event->>'episode_key','');
begin
  perform pg_advisory_xact_lock(hashtextextended(
    (p_event->>'region_id') || (p_event->>'mode') || (p_event->>'kind') || (p_event->>'dataset_id'),0));
  select * into result from public.alerts where region_id=p_event->>'region_id'
    and mode=p_event->>'mode' and kind=p_event->>'kind' and dataset_id=p_event->>'dataset_id'
    and ((episode is not null and episode_key=episode)
      or (episode is null and event_day between event_date and last_seen+3))
    order by last_seen desc limit 1;
  if found then
    update public.alerts set last_seen=greatest(last_seen,event_day) where id=result.id returning * into result;
    return result;
  end if;
  insert into public.alerts(region_id,mode,kind,event_date,last_seen,dataset_id,risk,report,episode_key)
    values(p_event->>'region_id',p_event->>'mode',p_event->>'kind',event_day,event_day,
      p_event->>'dataset_id',p_event->>'risk',p_event->'report',episode)
    on conflict(region_id,mode,kind,event_date,dataset_id) do update set last_seen=greatest(alerts.last_seen,excluded.last_seen)
    returning * into result;
  return result;
end $$;

alter table public.deliveries drop constraint deliveries_status_check;
alter table public.deliveries add constraint deliveries_status_check
  check(status in ('pending','sending','sent','failed','uncertain','shadow','skipped'));
alter table public.deliveries add column dispatch_mode text not null default 'shadow'
  check(dispatch_mode in ('shadow','test','live'));
-- Historical accepted messages keep their delivery namespace.
update public.deliveries set dispatch_mode='live' where status<>'shadow';
alter table public.deliveries drop constraint deliveries_alert_id_user_id_key;
alter table public.deliveries add unique(alert_id,user_id,dispatch_mode);

drop function public.claim_delivery(uuid,uuid,jsonb);
create function public.claim_delivery(p_alert uuid,p_user uuid,p_payload jsonb,p_dispatch_mode text default 'shadow')
returns setof public.deliveries language plpgsql security definer set search_path = public, pg_temp as $$
declare a public.alerts; d public.deliveries;
begin
  if p_dispatch_mode not in ('shadow','test','live') then raise exception 'Invalid dispatch mode'; end if;
  select * into a from public.alerts where id=p_alert;
  if not found then return; end if;
  if not exists(select 1 from public.subscriptions s join auth.users u on u.id=s.user_id
    where s.user_id=p_user and s.region_id=a.region_id and s.active and s.email_enabled
      and s.consent_version='observed-info-v1' and s.consented_at is not null and u.email_confirmed_at is not null) then
    update public.deliveries set status='skipped',lease_until=null,error='Consent inactive'
      where alert_id=p_alert and user_id=p_user and dispatch_mode=p_dispatch_mode and status in ('pending','failed','sending');
    return;
  end if;
  if p_dispatch_mode='shadow' then
    return query insert into public.deliveries(alert_id,user_id,payload,status,dispatch_mode)
      values(p_alert,p_user,p_payload,'shadow','shadow') on conflict(alert_id,user_id,dispatch_mode) do nothing returning *;
    return;
  end if;
  insert into public.deliveries(alert_id,user_id,payload,dispatch_mode) values(p_alert,p_user,p_payload,p_dispatch_mode)
    on conflict(alert_id,user_id,dispatch_mode) do nothing;
  select * into d from public.deliveries where alert_id=p_alert and user_id=p_user and dispatch_mode=p_dispatch_mode for update;
  if d.status in ('sent','uncertain','skipped') or d.lease_until > now() then return; end if;
  if d.first_attempt_at < now()-interval '23 hours' then
    update public.deliveries set status='uncertain',lease_until=null,error='Retry window expired; reconcile with provider' where id=d.id;
    return;
  end if;
  return query update public.deliveries set status='sending',attempts=attempts+1,
    first_attempt_at=coalesce(first_attempt_at,now()),lease_until=now()+interval '5 minutes',claim_token=gen_random_uuid()
    where id=d.id returning *;
end $$;
revoke all on function public.claim_delivery(uuid,uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.claim_delivery(uuid,uuid,jsonb,text) to service_role;

alter table public.monitor_runs add column run_key text unique,
  add column dispatch_mode text not null default 'shadow', add column finished_at timestamptz;
-- Deliberately no authenticated/anon monitor-run policy: operational history is server-only.

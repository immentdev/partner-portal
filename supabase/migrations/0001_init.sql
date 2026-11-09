-- Partner Portal BAC × Imment
-- Autore: Giuseppe Pistoia · © Imment S.r.l.
-- Schema dedicato `partner` per coesistere col progetto Supabase Imment (FundOps/CF).
-- In Dashboard → Settings → API → Exposed schemas: aggiungere `partner`.

create schema if not exists partner;
create schema if not exists app;

grant usage on schema partner to postgres, anon, authenticated, service_role;
grant usage on schema app to postgres, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Enum (schema partner)
-- ---------------------------------------------------------------------------

do $$ begin
  create type partner.app_role as enum (
    'super_admin', 'imment_admin', 'bac_nazionale', 'bac_locale'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type partner.referral_outcome as enum (
    'pending', 'accepted', 'rejected', 'existing'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type partner.referral_sync_status as enum (
    'pending', 'synced', 'stalled', 'cancelled'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type partner.anomaly_type as enum (
    'sla_validation', 'possible_duplicate', 'unlinked_deal', 'deal_out_of_window',
    'fee_decreased', 'fee_unpaid', 'sync_stalled', 'stage_regression', 'dispute'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type partner.anomaly_status as enum (
    'open', 'assigned', 'resolved', 'dismissed'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type partner.macrostate as enum (
    'in_valutazione', 'non_accettato', 'proposta_inviata',
    'incarico_attivo', 'chiuso_non_acquisito'
  );
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Tabelle
-- ---------------------------------------------------------------------------

create table if not exists partner.partner_orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  mokapen_company_id bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists partner.territories (
  id uuid primary key default gen_random_uuid(),
  partner_org_id uuid not null references partner.partner_orgs (id),
  name text not null,
  code text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists territories_partner_org_id_idx
  on partner.territories (partner_org_id);

create table if not exists partner.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  role partner.app_role not null,
  partner_org_id uuid references partner.partner_orgs (id),
  territory_id uuid references partner.territories (id),
  mokapen_contact_id bigint,
  is_emergency boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_bac_locale_needs_territory check (
    role <> 'bac_locale' or territory_id is not null
  ),
  constraint profiles_bac_needs_org check (
    role not in ('bac_locale', 'bac_nazionale') or partner_org_id is not null
  )
);

create index if not exists profiles_role_idx on partner.profiles (role);
create index if not exists profiles_territory_id_idx on partner.profiles (territory_id);
create index if not exists profiles_partner_org_id_idx on partner.profiles (partner_org_id);

create table if not exists partner.referrals (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  partner_org_id uuid not null references partner.partner_orgs (id),
  territory_id uuid not null references partner.territories (id),
  created_by uuid not null references partner.profiles (id),
  company_name text not null,
  vat_number text not null,
  website text,
  contact_name text not null,
  contact_email text not null,
  contact_phone text,
  product text,
  relationship_nature text,
  notes text,
  outcome partner.referral_outcome not null default 'pending',
  outcome_at timestamptz,
  window_end timestamptz,
  macrostate partner.macrostate not null default 'in_valutazione',
  sync_status partner.referral_sync_status not null default 'pending',
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists referrals_territory_id_idx on partner.referrals (territory_id);
create index if not exists referrals_partner_org_id_idx on partner.referrals (partner_org_id);
create index if not exists referrals_vat_number_idx on partner.referrals (vat_number);

create table if not exists partner.referral_deals (
  id uuid primary key default gen_random_uuid(),
  referral_id uuid not null references partner.referrals (id),
  mokapen_deal_id bigint not null unique,
  is_primary boolean not null default false,
  deal_amount numeric(14, 2),
  mokapen_status_id integer,
  mokapen_status_title text,
  mokapen_stage_raw jsonb,
  fee_partner numeric(14, 2),
  currency text,
  signed_at timestamptz,
  cashed_at timestamptz,
  eligible boolean,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists referral_deals_referral_id_idx
  on partner.referral_deals (referral_id);

create unique index if not exists referral_deals_one_primary_idx
  on partner.referral_deals (referral_id)
  where is_primary;

create table if not exists partner.deal_stage_events (
  id uuid primary key default gen_random_uuid(),
  referral_deal_id uuid not null references partner.referral_deals (id),
  mokapen_status_id integer not null,
  mokapen_status_title text not null,
  macrostate partner.macrostate not null,
  previous_macrostate partner.macrostate,
  created_at timestamptz not null default now()
);

create index if not exists deal_stage_events_referral_deal_id_idx
  on partner.deal_stage_events (referral_deal_id, created_at desc);

create table if not exists partner.anomalies (
  id uuid primary key default gen_random_uuid(),
  type partner.anomaly_type not null,
  status partner.anomaly_status not null default 'open',
  title text not null,
  detail text,
  referral_id uuid references partner.referrals (id),
  referral_deal_id uuid references partner.referral_deals (id),
  assignee_id uuid references partner.profiles (id),
  due_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists partner.disputes (
  id uuid primary key default gen_random_uuid(),
  referral_id uuid not null references partner.referrals (id),
  opened_by uuid not null references partner.profiles (id),
  reason text not null,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create table if not exists partner.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references partner.profiles (id),
  action text not null,
  entity_type text not null,
  entity_id text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_created_at_idx on partner.audit_log (created_at desc);

create table if not exists partner.sync_state (
  id text primary key default 'mokapen',
  last_webhook_at timestamptz,
  last_reconcile_at timestamptz,
  last_error text,
  updated_at timestamptz not null default now()
);

insert into partner.sync_state (id)
values ('mokapen')
on conflict (id) do nothing;

create table if not exists partner.statements (
  id uuid primary key default gen_random_uuid(),
  partner_org_id uuid not null references partner.partner_orgs (id),
  period_start date not null,
  period_end date not null,
  status text not null default 'draft',
  approved_at timestamptz,
  approved_by uuid references partner.profiles (id),
  created_at timestamptz not null default now()
);

create table if not exists partner.payments (
  id uuid primary key default gen_random_uuid(),
  partner_org_id uuid not null references partner.partner_orgs (id),
  statement_id uuid references partner.statements (id),
  amount numeric(14, 2) not null,
  paid_at date not null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists partner.territory_attributions (
  id uuid primary key default gen_random_uuid(),
  statement_id uuid not null references partner.statements (id),
  territory_id uuid not null references partner.territories (id),
  amount numeric(14, 2) not null,
  created_at timestamptz not null default now()
);

create or replace view partner.v_deal_fees
with (security_invoker = true)
as
select
  rd.id,
  rd.referral_id,
  rd.mokapen_deal_id,
  rd.is_primary,
  rd.fee_partner,
  rd.currency,
  rd.signed_at,
  rd.cashed_at,
  rd.eligible,
  rd.last_synced_at,
  case when rd.cashed_at is not null then coalesce(rd.fee_partner, 0) else 0 end as fee_maturata,
  case when rd.cashed_at is null then coalesce(rd.fee_partner, 0) else 0 end as fee_prevista
from partner.referral_deals rd;

-- ---------------------------------------------------------------------------
-- Helper
-- ---------------------------------------------------------------------------

create or replace function app.pp_current_profile()
returns partner.profiles
language sql
stable
security definer
set search_path = partner, public
as $$
  select p.* from partner.profiles p where p.id = auth.uid();
$$;

revoke all on function app.pp_current_profile() from public;
grant execute on function app.pp_current_profile() to authenticated, service_role;

create or replace function app.pp_is_imment_staff()
returns boolean
language sql
stable
security definer
set search_path = partner, public
as $$
  select exists (
    select 1 from partner.profiles p
    where p.id = auth.uid() and p.role in ('super_admin', 'imment_admin')
  );
$$;

revoke all on function app.pp_is_imment_staff() from public;
grant execute on function app.pp_is_imment_staff() to authenticated, service_role;

create or replace function app.pp_can_read_referral(p_partner_org_id uuid, p_territory_id uuid)
returns boolean
language sql
stable
security definer
set search_path = partner, public
as $$
  select exists (
    select 1 from partner.profiles p
    where p.id = auth.uid()
      and (
        p.role in ('super_admin', 'imment_admin')
        or (p.role = 'bac_nazionale' and p.partner_org_id = p_partner_org_id)
        or (p.role = 'bac_locale' and p.territory_id = p_territory_id)
      )
  );
$$;

revoke all on function app.pp_can_read_referral(uuid, uuid) from public;
grant execute on function app.pp_can_read_referral(uuid, uuid) to authenticated, service_role;

create or replace function app.pp_audit_log_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception 'partner.audit_log is append-only';
end;
$$;

drop trigger if exists audit_log_no_update on partner.audit_log;
create trigger audit_log_no_update
  before update on partner.audit_log
  for each row execute function app.pp_audit_log_append_only();

drop trigger if exists audit_log_no_delete on partner.audit_log;
create trigger audit_log_no_delete
  before delete on partner.audit_log
  for each row execute function app.pp_audit_log_append_only();

create or replace function app.pp_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists partner_orgs_updated_at on partner.partner_orgs;
create trigger partner_orgs_updated_at
  before update on partner.partner_orgs
  for each row execute function app.pp_set_updated_at();

drop trigger if exists territories_updated_at on partner.territories;
create trigger territories_updated_at
  before update on partner.territories
  for each row execute function app.pp_set_updated_at();

drop trigger if exists profiles_updated_at on partner.profiles;
create trigger profiles_updated_at
  before update on partner.profiles
  for each row execute function app.pp_set_updated_at();

drop trigger if exists referrals_updated_at on partner.referrals;
create trigger referrals_updated_at
  before update on partner.referrals
  for each row execute function app.pp_set_updated_at();

drop trigger if exists referral_deals_updated_at on partner.referral_deals;
create trigger referral_deals_updated_at
  before update on partner.referral_deals
  for each row execute function app.pp_set_updated_at();

drop trigger if exists anomalies_updated_at on partner.anomalies;
create trigger anomalies_updated_at
  before update on partner.anomalies
  for each row execute function app.pp_set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table partner.partner_orgs enable row level security;
alter table partner.territories enable row level security;
alter table partner.profiles enable row level security;
alter table partner.referrals enable row level security;
alter table partner.referral_deals enable row level security;
alter table partner.deal_stage_events enable row level security;
alter table partner.anomalies enable row level security;
alter table partner.disputes enable row level security;
alter table partner.audit_log enable row level security;
alter table partner.sync_state enable row level security;
alter table partner.statements enable row level security;
alter table partner.payments enable row level security;
alter table partner.territory_attributions enable row level security;

drop policy if exists partner_orgs_select on partner.partner_orgs;
create policy partner_orgs_select on partner.partner_orgs
  for select to authenticated
  using (
    app.pp_is_imment_staff()
    or id = (select partner_org_id from app.pp_current_profile())
  );

drop policy if exists territories_select on partner.territories;
create policy territories_select on partner.territories
  for select to authenticated
  using (
    app.pp_is_imment_staff()
    or (
      (select role from app.pp_current_profile()) = 'bac_nazionale'
      and partner_org_id = (select partner_org_id from app.pp_current_profile())
    )
    or (
      (select role from app.pp_current_profile()) = 'bac_locale'
      and id = (select territory_id from app.pp_current_profile())
    )
  );

drop policy if exists profiles_select on partner.profiles;
create policy profiles_select on partner.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or app.pp_is_imment_staff()
    or (
      (select role from app.pp_current_profile()) = 'bac_nazionale'
      and partner_org_id = (select partner_org_id from app.pp_current_profile())
    )
  );

drop policy if exists referrals_select on partner.referrals;
create policy referrals_select on partner.referrals
  for select to authenticated
  using (app.pp_can_read_referral(partner_org_id, territory_id));

drop policy if exists referral_deals_select on partner.referral_deals;
create policy referral_deals_select on partner.referral_deals
  for select to authenticated
  using (
    exists (
      select 1 from partner.referrals r
      where r.id = referral_id
        and app.pp_can_read_referral(r.partner_org_id, r.territory_id)
    )
  );

drop policy if exists deal_stage_events_select on partner.deal_stage_events;
create policy deal_stage_events_select on partner.deal_stage_events
  for select to authenticated
  using (
    exists (
      select 1
      from partner.referral_deals rd
      join partner.referrals r on r.id = rd.referral_id
      where rd.id = referral_deal_id
        and app.pp_can_read_referral(r.partner_org_id, r.territory_id)
    )
  );

drop policy if exists anomalies_select on partner.anomalies;
create policy anomalies_select on partner.anomalies
  for select to authenticated
  using (
    app.pp_is_imment_staff()
    or (
      (select role from app.pp_current_profile()) = 'bac_nazionale'
      and (
        referral_id is null
        or exists (
          select 1 from partner.referrals r
          where r.id = referral_id
            and r.partner_org_id = (select partner_org_id from app.pp_current_profile())
        )
      )
    )
  );

drop policy if exists disputes_select on partner.disputes;
create policy disputes_select on partner.disputes
  for select to authenticated
  using (
    exists (
      select 1 from partner.referrals r
      where r.id = referral_id
        and app.pp_can_read_referral(r.partner_org_id, r.territory_id)
    )
  );

drop policy if exists audit_log_select on partner.audit_log;
create policy audit_log_select on partner.audit_log
  for select to authenticated
  using (app.pp_is_imment_staff() or actor_id = auth.uid());

drop policy if exists sync_state_select on partner.sync_state;
create policy sync_state_select on partner.sync_state
  for select to authenticated
  using (
    exists (
      select 1 from partner.profiles p
      where p.id = auth.uid() and p.role = 'super_admin'
    )
  );

drop policy if exists statements_select on partner.statements;
create policy statements_select on partner.statements
  for select to authenticated
  using (
    app.pp_is_imment_staff()
    or (
      (select role from app.pp_current_profile()) = 'bac_nazionale'
      and partner_org_id = (select partner_org_id from app.pp_current_profile())
    )
  );

drop policy if exists payments_select on partner.payments;
create policy payments_select on partner.payments
  for select to authenticated
  using (
    app.pp_is_imment_staff()
    or (
      (select role from app.pp_current_profile()) = 'bac_nazionale'
      and partner_org_id = (select partner_org_id from app.pp_current_profile())
    )
  );

drop policy if exists territory_attributions_select on partner.territory_attributions;
create policy territory_attributions_select on partner.territory_attributions
  for select to authenticated
  using (
    app.pp_is_imment_staff()
    or exists (
      select 1 from partner.statements s
      where s.id = statement_id
        and (select role from app.pp_current_profile()) = 'bac_nazionale'
        and s.partner_org_id = (select partner_org_id from app.pp_current_profile())
    )
  );

-- ---------------------------------------------------------------------------
-- Privilegi colonna
-- ---------------------------------------------------------------------------

revoke all on all tables in schema partner from anon, authenticated;
grant select on table partner.partner_orgs to authenticated;
grant select on table partner.territories to authenticated;
grant select on table partner.profiles to authenticated;
grant select on table partner.referrals to authenticated;
grant select on table partner.deal_stage_events to authenticated;
grant select on table partner.anomalies to authenticated;
grant select on table partner.disputes to authenticated;
grant select on table partner.audit_log to authenticated;
grant select on table partner.sync_state to authenticated;
grant select on table partner.statements to authenticated;
grant select on table partner.payments to authenticated;
grant select on table partner.territory_attributions to authenticated;
grant select on table partner.v_deal_fees to authenticated;

grant select (
  id, referral_id, mokapen_deal_id, is_primary, fee_partner, currency,
  signed_at, cashed_at, eligible, last_synced_at, created_at, updated_at
) on table partner.referral_deals to authenticated;

grant all on all tables in schema partner to service_role;
grant all on all sequences in schema partner to service_role;
grant all on all routines in schema app to service_role;

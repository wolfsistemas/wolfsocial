-- Local robot bridge (WhatsApp Web / whatsapp-web.js) - pull-only queue.
-- The robot runs on the user's own machine and only makes outbound HTTPS calls.
-- It never exposes a port. Multi-tenant + RLS.

-- ---------------------------------------------------------------------------
-- Robot devices (one row per machine/agent the tenant authorises)
-- ---------------------------------------------------------------------------
create table if not exists public.robot_devices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  status text not null default 'active' check (status in ('active', 'disabled')),
  last_seen_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists robot_devices_tenant_idx
  on public.robot_devices (tenant_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Robot device secrets (token hash). RLS has no policy on purpose: only the
-- service role (Edge Functions) can read it, so the hash is never exposed.
-- ---------------------------------------------------------------------------
create table if not exists public.robot_device_secrets (
  device_id uuid primary key references public.robot_devices(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists robot_device_secrets_hash_idx
  on public.robot_device_secrets (token_hash);

-- ---------------------------------------------------------------------------
-- Outbox: messages the tenant wants the local robot to send.
-- pull-only: the robot claims rows, sends locally and acks the result.
-- ---------------------------------------------------------------------------
create table if not exists public.wa_outbox (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  device_id uuid references public.robot_devices(id) on delete set null,
  to_phone text not null,
  body text,
  kind text not null default 'text' check (kind in ('text', 'media')),
  media_url text,
  status text not null default 'queued'
    check (status in ('queued', 'sending', 'sent', 'failed', 'canceled')),
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  last_error text,
  scheduled_at timestamptz not null default now(),
  claimed_at timestamptz,
  sent_at timestamptz,
  source text not null default 'wolfsocial',
  payload jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists wa_outbox_tenant_status_idx
  on public.wa_outbox (tenant_id, status, scheduled_at);

create index if not exists wa_outbox_device_status_idx
  on public.wa_outbox (device_id, status, scheduled_at);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
drop trigger if exists robot_devices_touch on public.robot_devices;
create trigger robot_devices_touch before update on public.robot_devices
  for each row execute function public.touch_updated_at();

drop trigger if exists wa_outbox_touch on public.wa_outbox;
create trigger wa_outbox_touch before update on public.wa_outbox
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.robot_devices enable row level security;
alter table public.robot_device_secrets enable row level security;
alter table public.wa_outbox enable row level security;

drop policy if exists robot_devices_all on public.robot_devices;
create policy robot_devices_all on public.robot_devices
  for all using (public.is_member(tenant_id)) with check (public.is_member(tenant_id));

-- no policy for robot_device_secrets: service role only.

drop policy if exists wa_outbox_all on public.wa_outbox;
create policy wa_outbox_all on public.wa_outbox
  for all using (public.is_member(tenant_id)) with check (public.is_member(tenant_id));

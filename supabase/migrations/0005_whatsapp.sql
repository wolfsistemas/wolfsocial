-- WhatsApp Cloud API integration (v1)
-- Per-tenant WhatsApp Business number + message log. Multi-tenant + RLS.

-- ---------------------------------------------------------------------------
-- WhatsApp accounts (one connected number per tenant, manual credentials)
-- ---------------------------------------------------------------------------
create table if not exists public.whatsapp_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  waba_id text,
  phone_number_id text not null,
  display_phone text,
  verified_name text,
  access_token_enc text,
  status text not null default 'connected'
    check (status in ('connected', 'error', 'revoked')),
  notify_enabled boolean not null default false,
  alert_phone text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists whatsapp_accounts_tenant_phone_idx
  on public.whatsapp_accounts (tenant_id, phone_number_id);

create index if not exists whatsapp_accounts_tenant_idx
  on public.whatsapp_accounts (tenant_id, created_at desc);

-- ---------------------------------------------------------------------------
-- WhatsApp message log (inbound from webhook, outbound from send)
-- ---------------------------------------------------------------------------
create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  account_id uuid references public.whatsapp_accounts(id) on delete set null,
  meta_message_id text unique,
  direction text not null check (direction in ('in', 'out')),
  wa_from text,
  wa_to text,
  kind text not null default 'text',
  body text,
  status text,
  error text,
  payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists whatsapp_messages_tenant_idx
  on public.whatsapp_messages (tenant_id, created_at desc);

create index if not exists whatsapp_messages_account_idx
  on public.whatsapp_messages (account_id, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
drop trigger if exists whatsapp_accounts_touch on public.whatsapp_accounts;
create trigger whatsapp_accounts_touch before update on public.whatsapp_accounts
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.whatsapp_accounts enable row level security;
alter table public.whatsapp_messages enable row level security;

drop policy if exists whatsapp_accounts_all on public.whatsapp_accounts;
create policy whatsapp_accounts_all on public.whatsapp_accounts
  for all using (public.is_member(tenant_id)) with check (public.is_member(tenant_id));

drop policy if exists whatsapp_messages_all on public.whatsapp_messages;
create policy whatsapp_messages_all on public.whatsapp_messages
  for all using (public.is_member(tenant_id)) with check (public.is_member(tenant_id));

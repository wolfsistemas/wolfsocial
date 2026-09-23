-- WolfSocial initial schema
-- Multi-tenant ready: every tenant-scoped table carries tenant_id + RLS.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Core: tenants and memberships
-- ---------------------------------------------------------------------------
create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner',
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

-- Membership check used by RLS. SECURITY DEFINER avoids recursive RLS.
create or replace function public.is_member(target_tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships m
    where m.tenant_id = target_tenant and m.user_id = auth.uid()
  );
$$;

-- Auto-provision a tenant + owner membership for each new user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_tenant uuid;
begin
  insert into public.tenants (name, slug)
  values (coalesce(split_part(new.email, '@', 1), 'Meu espaco'), 't-' || replace(new.id::text, '-', ''))
  returning id into new_tenant;

  insert into public.memberships (tenant_id, user_id, role)
  values (new_tenant, new.id, 'owner');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Social accounts (Instagram)
-- ---------------------------------------------------------------------------
create table if not exists public.social_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  platform text not null default 'instagram',
  auth_path text not null default 'facebook' check (auth_path in ('facebook', 'instagram')),
  ig_user_id text not null,
  username text,
  account_type text,
  fb_page_id text,
  access_token_enc text not null,
  token_expires_at timestamptz,
  scopes text[],
  status text not null default 'connected'
    check (status in ('connected', 'expired', 'revoked', 'error')),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, ig_user_id)
);

-- ---------------------------------------------------------------------------
-- Media library (Supabase Storage public bucket "media")
-- ---------------------------------------------------------------------------
create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  storage_path text not null,
  public_url text not null,
  kind text not null default 'image' check (kind in ('image', 'video')),
  mime_type text,
  size_bytes bigint,
  width int,
  height int,
  duration_seconds numeric,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Posts and items
-- ---------------------------------------------------------------------------
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  account_id uuid not null references public.social_accounts(id) on delete cascade,
  kind text not null check (kind in ('image', 'carousel', 'reels', 'story')),
  caption text,
  location_id text,
  collaborators text[],
  share_to_feed boolean not null default true,
  cover_url text,
  thumb_offset_ms int,
  scheduled_at timestamptz not null default now(),
  status text not null default 'scheduled'
    check (status in ('draft', 'scheduled', 'publishing', 'published', 'failed', 'canceled')),
  ig_media_id text,
  ig_container_id text,
  attempts int not null default 0,
  idempotency_key text not null default gen_random_uuid()::text,
  last_error text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists posts_due_idx
  on public.posts (scheduled_at)
  where status = 'scheduled';

create table if not exists public.post_items (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  media_asset_id uuid not null references public.media_assets(id) on delete restrict,
  position int not null default 0,
  alt_text text,
  created_at timestamptz not null default now()
);

create table if not exists public.publish_logs (
  id bigint generated always as identity primary key,
  post_id uuid not null references public.posts(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  level text not null default 'info',
  message text not null,
  payload jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Ads (prepared, not used yet)
-- ---------------------------------------------------------------------------
create table if not exists public.ad_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  meta_ad_account_id text not null,
  name text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  unique (tenant_id, meta_ad_account_id)
);

create table if not exists public.ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  ad_account_id uuid not null references public.ad_accounts(id) on delete cascade,
  name text not null,
  objective text,
  status text not null default 'paused',
  daily_budget_cents bigint,
  meta_campaign_id text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists social_accounts_touch on public.social_accounts;
create trigger social_accounts_touch before update on public.social_accounts
  for each row execute function public.touch_updated_at();

drop trigger if exists posts_touch on public.posts;
create trigger posts_touch before update on public.posts
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.tenants enable row level security;
alter table public.memberships enable row level security;
alter table public.social_accounts enable row level security;
alter table public.media_assets enable row level security;
alter table public.posts enable row level security;
alter table public.post_items enable row level security;
alter table public.publish_logs enable row level security;
alter table public.ad_accounts enable row level security;
alter table public.ad_campaigns enable row level security;

drop policy if exists tenants_select on public.tenants;
create policy tenants_select on public.tenants
  for select using (public.is_member(id));

drop policy if exists memberships_select on public.memberships;
create policy memberships_select on public.memberships
  for select using (public.is_member(tenant_id));

drop policy if exists social_accounts_all on public.social_accounts;
create policy social_accounts_all on public.social_accounts
  for all using (public.is_member(tenant_id)) with check (public.is_member(tenant_id));

drop policy if exists media_assets_all on public.media_assets;
create policy media_assets_all on public.media_assets
  for all using (public.is_member(tenant_id)) with check (public.is_member(tenant_id));

drop policy if exists posts_all on public.posts;
create policy posts_all on public.posts
  for all using (public.is_member(tenant_id)) with check (public.is_member(tenant_id));

drop policy if exists post_items_all on public.post_items;
create policy post_items_all on public.post_items
  for all
  using (exists (select 1 from public.posts p where p.id = post_id and public.is_member(p.tenant_id)))
  with check (exists (select 1 from public.posts p where p.id = post_id and public.is_member(p.tenant_id)));

drop policy if exists publish_logs_all on public.publish_logs;
create policy publish_logs_all on public.publish_logs
  for all using (public.is_member(tenant_id)) with check (public.is_member(tenant_id));

drop policy if exists ad_accounts_all on public.ad_accounts;
create policy ad_accounts_all on public.ad_accounts
  for all using (public.is_member(tenant_id)) with check (public.is_member(tenant_id));

drop policy if exists ad_campaigns_all on public.ad_campaigns;
create policy ad_campaigns_all on public.ad_campaigns
  for all using (public.is_member(tenant_id)) with check (public.is_member(tenant_id));

-- ---------------------------------------------------------------------------
-- Storage bucket for media (public read, tenant-scoped write)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

drop policy if exists media_public_read on storage.objects;
create policy media_public_read on storage.objects
  for select using (bucket_id = 'media');

drop policy if exists media_tenant_write on storage.objects;
create policy media_tenant_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'media'
    and public.is_member(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists media_tenant_update on storage.objects;
create policy media_tenant_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'media'
    and public.is_member(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists media_tenant_delete on storage.objects;
create policy media_tenant_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'media'
    and public.is_member(((storage.foldername(name))[1])::uuid)
  );

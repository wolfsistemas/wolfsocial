-- WolfSocial completeness pack
-- Adds: tenant preferences, caption templates, notifications, post insights,
-- link-in-bio, team invites and data-deletion tracking. Multi-tenant + RLS.

-- ---------------------------------------------------------------------------
-- Tenant preferences
-- ---------------------------------------------------------------------------
alter table public.tenants
  add column if not exists timezone text not null default 'America/Sao_Paulo';
alter table public.tenants
  add column if not exists alert_webhook_url text;
alter table public.tenants
  add column if not exists daily_publish_limit int not null default 50;

-- ---------------------------------------------------------------------------
-- Caption templates (+ hashtag sets)
-- ---------------------------------------------------------------------------
create table if not exists public.caption_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  body text not null default '',
  hashtags text not null default '',
  kind text check (kind in ('image', 'carousel', 'reels', 'story')),
  created_at timestamptz not null default now()
);

create index if not exists caption_templates_tenant_idx
  on public.caption_templates (tenant_id, created_at desc);

-- ---------------------------------------------------------------------------
-- In-app notifications
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  level text not null default 'info' check (level in ('info', 'warn', 'error')),
  title text not null,
  message text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_tenant_idx
  on public.notifications (tenant_id, read, created_at desc);

-- ---------------------------------------------------------------------------
-- Post insights (lifetime metrics per published media)
-- ---------------------------------------------------------------------------
create table if not exists public.post_insights (
  post_id uuid primary key references public.posts(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  impressions bigint,
  reach bigint,
  likes bigint,
  comments bigint,
  saves bigint,
  shares bigint,
  fetched_at timestamptz not null default now()
);

create index if not exists post_insights_tenant_idx
  on public.post_insights (tenant_id, fetched_at desc);

-- ---------------------------------------------------------------------------
-- Link in bio
-- ---------------------------------------------------------------------------
create table if not exists public.bio_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  label text not null,
  url text not null,
  position int not null default 0,
  clicks int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists bio_links_tenant_idx
  on public.bio_links (tenant_id, position);

-- ---------------------------------------------------------------------------
-- Team invites
-- ---------------------------------------------------------------------------
create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  email text not null,
  role text not null default 'editor'
    check (role in ('owner', 'admin', 'editor', 'viewer')),
  token uuid not null default gen_random_uuid() unique,
  revoked_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists invites_tenant_idx
  on public.invites (tenant_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Data deletion tracking (Meta Data Deletion Callback)
-- ---------------------------------------------------------------------------
create table if not exists public.data_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  meta_user_id text,
  confirmation_code text not null unique,
  status text not null default 'received',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Helpers (SECURITY DEFINER)
-- ---------------------------------------------------------------------------

-- Accept an invite: links the signed-in user (matching the invite email) to the
-- tenant with the invite role.
create or replace function public.accept_invite(invite_token uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.invites;
  uid uuid := auth.uid();
  user_email text;
begin
  if uid is null then
    raise exception 'Precisa estar autenticado.';
  end if;
  select email into user_email from auth.users where id = uid;

  select * into inv
  from public.invites
  where token = invite_token and accepted_at is null and revoked_at is null;

  if inv.id is null then
    raise exception 'Convite invalido ou ja utilizado.';
  end if;
  if lower(inv.email) <> lower(coalesce(user_email, '')) then
    raise exception 'Este convite pertence a outro email.';
  end if;

  insert into public.memberships (tenant_id, user_id, role)
  values (inv.tenant_id, uid, inv.role)
  on conflict (tenant_id, user_id) do update set role = excluded.role;

  update public.invites set accepted_at = now() where id = inv.id;
  return inv.tenant_id;
end;
$$;

grant execute on function public.accept_invite(uuid) to authenticated;

-- List members with their emails (memberships has no email column).
create or replace function public.list_tenant_members(p_tenant uuid)
returns table (
  user_id uuid,
  email text,
  role text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select m.user_id, u.email::text, m.role, m.created_at
  from public.memberships m
  join auth.users u on u.id = m.user_id
  where m.tenant_id = p_tenant and public.is_member(p_tenant)
  order by m.created_at asc;
$$;

grant execute on function public.list_tenant_members(uuid) to authenticated;

-- Public link-in-bio payload by tenant slug (safe, read-only projection).
create or replace function public.get_public_bio(p_slug text)
returns table (tenant_name text, links jsonb)
language sql
stable
security definer
set search_path = public
as $$
  select t.name,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', b.id,
          'label', b.label,
          'url', b.url,
          'position', b.position
        ) order by b.position
      ),
      '[]'::jsonb
    )
  from public.tenants t
  left join public.bio_links b on b.tenant_id = t.id
  where t.slug = p_slug
  group by t.id, t.name;
$$;

grant execute on function public.get_public_bio(text) to anon, authenticated;

-- Count a click on a public bio link.
create or replace function public.increment_bio_click(p_link uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.bio_links set clicks = clicks + 1 where id = p_link;
$$;

grant execute on function public.increment_bio_click(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.caption_templates enable row level security;
alter table public.notifications enable row level security;
alter table public.post_insights enable row level security;
alter table public.bio_links enable row level security;
alter table public.invites enable row level security;
alter table public.data_deletion_requests enable row level security;

drop policy if exists caption_templates_all on public.caption_templates;
create policy caption_templates_all on public.caption_templates
  for all using (public.is_member(tenant_id)) with check (public.is_member(tenant_id));

drop policy if exists notifications_all on public.notifications;
create policy notifications_all on public.notifications
  for all using (public.is_member(tenant_id)) with check (public.is_member(tenant_id));

drop policy if exists post_insights_all on public.post_insights;
create policy post_insights_all on public.post_insights
  for all using (public.is_member(tenant_id)) with check (public.is_member(tenant_id));

drop policy if exists bio_links_all on public.bio_links;
create policy bio_links_all on public.bio_links
  for all using (public.is_member(tenant_id)) with check (public.is_member(tenant_id));

drop policy if exists invites_all on public.invites;
create policy invites_all on public.invites
  for all using (public.is_member(tenant_id)) with check (public.is_member(tenant_id));

-- data_deletion_requests is only written/read by the service role (no policy).

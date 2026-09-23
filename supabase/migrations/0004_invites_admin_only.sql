-- Restrict team invite management to owners/admins.
-- Non-admins keep read access to members (via list_tenant_members), but cannot
-- list or create invites.

create or replace function public.is_tenant_admin(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships m
    where m.tenant_id = target
      and m.user_id = auth.uid()
      and m.role in ('owner', 'admin')
  );
$$;

grant execute on function public.is_tenant_admin(uuid) to authenticated;

drop policy if exists invites_all on public.invites;
drop policy if exists invites_admin_all on public.invites;
create policy invites_admin_all on public.invites
  for all
  using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id));

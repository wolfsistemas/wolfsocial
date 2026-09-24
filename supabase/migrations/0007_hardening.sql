-- Hardening: privilege escalation via invites, idempotency, publishing index
-- and safe storage path parsing.

-- ---------------------------------------------------------------------------
-- Safe uuid cast (used by storage policies; returns null instead of raising)
-- ---------------------------------------------------------------------------
create or replace function public.try_uuid(value text)
returns uuid
language plpgsql
immutable
as $$
begin
  return value::uuid;
exception when others then
  return null;
end;
$$;

grant execute on function public.try_uuid(text) to authenticated, anon;

-- ---------------------------------------------------------------------------
-- Invites: never grant the "owner" role, never demote an existing owner.
-- ---------------------------------------------------------------------------
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
  if inv.role = 'owner' then
    raise exception 'Convites nao podem conceder o papel de proprietario.';
  end if;

  insert into public.memberships (tenant_id, user_id, role)
  values (inv.tenant_id, uid, inv.role)
  on conflict (tenant_id, user_id) do update set role = excluded.role
    where public.memberships.role <> 'owner';

  update public.invites set accepted_at = now() where id = inv.id;
  return inv.tenant_id;
end;
$$;

grant execute on function public.accept_invite(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Posts: enforce idempotency keys and speed up the stale-publishing sweep.
-- ---------------------------------------------------------------------------
create unique index if not exists posts_tenant_idempotency_idx
  on public.posts (tenant_id, idempotency_key);

create index if not exists posts_publishing_updated_idx
  on public.posts (updated_at) where status = 'publishing';

-- ---------------------------------------------------------------------------
-- Storage: parse the tenant folder safely (no hard cast errors).
-- ---------------------------------------------------------------------------
drop policy if exists media_tenant_write on storage.objects;
create policy media_tenant_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'media'
    and public.is_member(public.try_uuid((storage.foldername(name))[1]))
  );

drop policy if exists media_tenant_update on storage.objects;
create policy media_tenant_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'media'
    and public.is_member(public.try_uuid((storage.foldername(name))[1]))
  );

drop policy if exists media_tenant_delete on storage.objects;
create policy media_tenant_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'media'
    and public.is_member(public.try_uuid((storage.foldername(name))[1]))
  );

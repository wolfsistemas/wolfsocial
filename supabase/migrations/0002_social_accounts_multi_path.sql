-- Allow the same Instagram account to be connected through both login paths:
--   * auth_path = 'instagram' -> Instagram Business Login (used for publishing)
--   * auth_path = 'facebook'  -> Facebook Login for Business (Pages / ads)
-- Without this, connecting via Facebook would overwrite the Instagram row.

alter table public.social_accounts
  drop constraint if exists social_accounts_tenant_id_ig_user_id_key;

create unique index if not exists social_accounts_tenant_auth_path_ig_idx
  on public.social_accounts (tenant_id, auth_path, ig_user_id);

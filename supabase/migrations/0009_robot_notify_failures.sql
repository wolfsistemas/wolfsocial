-- Preference for the local robot (WhatsApp Web) alerts.
-- When true, only failures/warnings are forwarded; successful publications
-- are not sent to WhatsApp. Configured in the WolfSocial UI (robot section).

alter table public.robot_devices
  add column if not exists notify_only_failures boolean not null default false;

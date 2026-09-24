-- Notification settings for the local robot (WhatsApp Web).
-- Publication alerts are queued into `wa_outbox` and sent by the robot to the
-- tenant's own number. Configured in the WolfSocial UI (robot section).

alter table public.robot_devices
  add column if not exists alert_phone text,
  add column if not exists notify_enabled boolean not null default false;

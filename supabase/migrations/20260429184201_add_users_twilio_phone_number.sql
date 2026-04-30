-- Per-user Twilio configuration: each calling-enabled user owns one Twilio phone number.
-- A null value means the user is not yet set up for calling and should not register a Twilio Device.
alter table public.users
  add column if not exists twilio_phone_number text;

create unique index if not exists users_twilio_phone_number_unique
  on public.users (twilio_phone_number)
  where twilio_phone_number is not null;

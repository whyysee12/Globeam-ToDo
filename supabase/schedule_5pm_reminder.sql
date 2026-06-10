-- ============================================
-- Schedule 5 PM IST (11:30 UTC) daily email reminder
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Enable pg_cron and pg_net extensions (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Schedule the Edge Function to run at 5:00 PM IST (11:30 UTC) every day
SELECT cron.schedule(
  'daily-5pm-reminder',         -- job name
  '30 11 * * *',                -- 11:30 UTC = 5:00 PM IST
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/send-5pm-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- To verify it's scheduled:
-- SELECT * FROM cron.job;

-- To unschedule:
-- SELECT cron.unschedule('daily-5pm-reminder');

-- To test the cron job manually (run immediately):
-- SELECT net.http_post(
--   url := 'https://fnumcsrdzuqydhgrsieq.supabase.co/functions/v1/send-5pm-reminder',
--   headers := jsonb_build_object(
--     'Content-Type', 'application/json',
--     'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
--   ),
--   body := '{}'::jsonb
-- );

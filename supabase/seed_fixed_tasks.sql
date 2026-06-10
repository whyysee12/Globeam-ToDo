-- Add fixed daily work. Rows with assigned_to = NULL appear for every employee.
-- Run this in Supabase SQL Editor after your schema exists.

INSERT INTO public.fixed_tasks (title, description, priority, assigned_to)
VALUES
  ('Check assigned client messages', 'Review pending customer conversations and reply where needed.', 'high', NULL),
  ('Update daily work status', 'Move each active task to pending, in progress, or completed before end of day.', 'medium', NULL),
  ('Submit end-of-day summary', 'Record completed work, blockers, and follow-ups.', 'medium', NULL)
ON CONFLICT DO NOTHING;

-- To assign fixed work to one employee only, replace the email below and run:
--
-- INSERT INTO public.fixed_tasks (title, description, priority, assigned_to)
-- SELECT
--   'Prepare sales follow-up list',
--   'Review yesterday''s leads and prepare today''s follow-ups.',
--   'high',
--   profiles.id
-- FROM public.profiles
-- WHERE profiles.id = (
--   SELECT users.id
--   FROM auth.users
--   WHERE users.email = 'employee@example.com'
-- );

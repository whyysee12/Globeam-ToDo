-- Run this in the Supabase SQL editor if signup shows:
-- "Database error saving new user"

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    new.id,
    COALESCE(NULLIF(new.raw_user_meta_data->>'full_name', ''), split_part(new.email, '@', 1), 'New user'),
    CASE
      WHEN new.raw_user_meta_data->>'role' IN ('admin', 'employee')
        THEN (new.raw_user_meta_data->>'role')::public.user_role
      ELSE 'employee'::public.user_role
    END
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

ALTER TABLE public.fixed_tasks
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

ALTER TABLE public.daily_tasks
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

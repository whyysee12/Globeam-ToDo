-- Create custom types
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE user_role AS ENUM ('admin', 'employee');
CREATE TYPE task_priority AS ENUM ('high', 'medium', 'low');
CREATE TYPE task_status AS ENUM ('pending', 'in_progress', 'completed');

-- Create profiles table (extends auth.users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  role user_role DEFAULT 'employee'::user_role NOT NULL,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Profile Policies
CREATE POLICY "Public profiles are viewable by everyone." ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile." ON profiles FOR UPDATE USING (auth.uid() = id);

-- Trigger to create profile on signup
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

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Create fixed_tasks table
CREATE TABLE fixed_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  priority task_priority DEFAULT 'medium'::task_priority NOT NULL,
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL, -- Null means all employees
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE fixed_tasks ENABLE ROW LEVEL SECURITY;
-- Admin can do everything. Employees can only read.
CREATE POLICY "Admins can manage fixed tasks" ON fixed_tasks FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Employees can read fixed tasks" ON fixed_tasks FOR SELECT USING (
  auth.uid() IS NOT NULL
);

-- Create daily_tasks table
CREATE TABLE daily_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  fixed_task_id UUID REFERENCES fixed_tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  remark TEXT,
  priority task_priority DEFAULT 'medium'::task_priority NOT NULL,
  status task_status DEFAULT 'pending'::task_status NOT NULL,
  due_date DATE,
  task_type VARCHAR(20) DEFAULT 'today' CHECK (task_type IN ('today', 'fixed', 'regular')),
  is_custom BOOLEAN DEFAULT false NOT NULL,
  date DATE DEFAULT CURRENT_DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_daily_tasks_user_id ON daily_tasks(user_id);
CREATE INDEX idx_daily_tasks_date ON daily_tasks(date);
CREATE INDEX idx_daily_tasks_due_date ON daily_tasks(due_date);
CREATE INDEX idx_daily_tasks_status ON daily_tasks(status);
CREATE INDEX idx_daily_tasks_priority ON daily_tasks(priority);
CREATE INDEX idx_daily_tasks_task_type ON daily_tasks(task_type);

ALTER TABLE daily_tasks ENABLE ROW LEVEL SECURITY;
-- Users can manage their own daily tasks
CREATE POLICY "Users can manage their own tasks" ON daily_tasks FOR ALL USING (
  auth.uid() = user_id
);
-- Admins can read all daily tasks
CREATE POLICY "Admins can read all tasks" ON daily_tasks FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

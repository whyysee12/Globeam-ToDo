-- ============================================
-- Migration: user_fixed_tasks (employee picks their own fixed tasks)
-- ============================================

-- Junction table: which employee has opted into which fixed task
CREATE TABLE IF NOT EXISTS user_fixed_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  fixed_task_id UUID REFERENCES fixed_tasks(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, fixed_task_id)
);

-- Enable RLS
ALTER TABLE user_fixed_tasks ENABLE ROW LEVEL SECURITY;

-- Users can manage their own subscriptions
CREATE POLICY "Users can manage their own fixed task subscriptions"
  ON user_fixed_tasks FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admins can read all subscriptions
CREATE POLICY "Admins can read all subscriptions"
  ON user_fixed_tasks FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

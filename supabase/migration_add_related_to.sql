-- Add related_to column to daily_tasks
ALTER TABLE daily_tasks 
ADD COLUMN related_to TEXT;

-- Create index for filtering by related_to
CREATE INDEX idx_daily_tasks_related_to ON daily_tasks(related_to);

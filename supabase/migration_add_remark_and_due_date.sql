-- Add remark and task_type columns to daily_tasks
ALTER TABLE daily_tasks 
ADD COLUMN remark TEXT,
ADD COLUMN task_type VARCHAR(20) DEFAULT 'today' CHECK (task_type IN ('today', 'fixed', 'regular'));

-- Rename due_time to due_date and change type from TIME to DATE
ALTER TABLE daily_tasks 
RENAME COLUMN due_time TO due_date;

ALTER TABLE daily_tasks
ALTER COLUMN due_date TYPE DATE USING NULL;

-- Create index on due_date for better query performance
CREATE INDEX idx_daily_tasks_due_date ON daily_tasks(due_date);
CREATE INDEX idx_daily_tasks_date ON daily_tasks(date);

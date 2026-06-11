# 🔧 Fix: Apply Database Migration to Supabase

## Problem
The app code expects `due_date` column but your Supabase database still has `due_time`. You need to run the migration to add new columns.

## Solution: Run Migration on Supabase

### Step 1: Open Supabase SQL Editor
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your **Globeam** project
3. Click **SQL Editor** (left sidebar)
4. Click **New Query**

### Step 2: Copy & Paste Migration SQL

Copy this exact SQL and paste into the SQL editor:

```sql
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
```

### Step 3: Execute Query
1. Click **Run** button (or press `Ctrl+Enter`)
2. Wait for success message
3. Check that no errors appear

### Step 4: Verify Migration
In SQL Editor, run this query to verify:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'daily_tasks' 
ORDER BY ordinal_position;
```

You should see these new columns:
- ✅ `remark` (TEXT)
- ✅ `task_type` (VARCHAR)
- ✅ `due_date` (DATE) - instead of `due_time`

### Step 5: Test the App
1. Refresh your browser
2. Go to home page
3. Error should be gone! ✅

---

## What This Migration Does

| Change | Old | New | Reason |
|--------|-----|-----|--------|
| **Due Schedule** | `due_time` (TIME) | `due_date` (DATE) | Better for multi-day planning |
| **Work Type** | None | `remark` (TEXT) | Add custom work category |
| **Task Category** | None | `task_type` (VARCHAR) | Classify today/regular/fixed |
| **Performance** | No indexes | Added indexes | Faster queries |

---

## If You Get an Error

### Error: "Column already exists"
→ The migration already ran. Skip to Step 5.

### Error: "Cannot rename column"
→ Your PostgreSQL version might not support it. Run this instead:

```sql
-- Alternative migration for older PostgreSQL
ALTER TABLE daily_tasks ADD COLUMN due_date DATE;
UPDATE daily_tasks SET due_date = NULL;
-- Keep due_time for backward compatibility
ALTER TABLE daily_tasks 
ADD COLUMN remark TEXT,
ADD COLUMN task_type VARCHAR(20) DEFAULT 'today' CHECK (task_type IN ('today', 'fixed', 'regular'));
CREATE INDEX idx_daily_tasks_due_date ON daily_tasks(due_date);
CREATE INDEX idx_daily_tasks_date ON daily_tasks(date);
```

### Error: "Permission denied"
→ Make sure you're logged in with admin account in Supabase

---

## Need Help?

1. **Still seeing error after migration?** 
   - Clear browser cache (Ctrl+Shift+Delete)
   - Refresh page

2. **Migration failed?**
   - Check Supabase status page
   - Try running each statement separately

3. **All else fails?**
   - Contact support with the error message

---

## Timeline

After running migration:
- ⏱️ Immediate: App works with new columns
- ⏱️ Within 1 min: Indexes are created
- ⏱️ Within 5 min: Cache updates across CDN

**Total time to fix: ~2 minutes** ⚡

---

Good luck! Once migration completes, all features will work perfectly! 🚀

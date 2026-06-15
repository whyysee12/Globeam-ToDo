import { format } from 'date-fns';
import { supabase } from './supabase';

export type TaskPriority = 'high' | 'medium' | 'low';
export type TaskStatus = 'pending' | 'in_progress' | 'completed';
export type TaskType = 'today' | 'fixed' | 'regular';

export interface DailyTask {
  id: string;
  user_id: string;
  fixed_task_id: string | null;
  title: string;
  description: string | null;
  remark: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  due_date: string | null;
  task_type: TaskType;
  related_to: string | null;
  is_custom: boolean;
  date: string;
  created_at: string;
}

export interface FixedTask {
  id: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  assigned_to: string | null;
  created_by: string | null;
  created_at: string;
}

export interface NewTaskInput {
  title: string;
  description?: string;
  remark?: string;
  priority: TaskPriority;
  due_date?: string;
  task_type?: TaskType;
  related_to?: string;
  date?: string;
}

export const todayKey = () => format(new Date(), 'yyyy-MM-dd');

export async function fetchFixedTasks(userId: string) {
  const { data, error } = await supabase
    .from('fixed_tasks')
    .select('*')
    .or(`assigned_to.is.null,assigned_to.eq.${userId}`)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as FixedTask[];
}

export async function fetchTasks(userId: string, date = todayKey()) {
  const { data, error } = await supabase
    .from('daily_tasks')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as DailyTask[];
}

export async function fetchTasksByDateRange(userId: string, startDate: string, endDate: string) {
  const { data, error } = await supabase
    .from('daily_tasks')
    .select('*')
    .eq('user_id', userId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: false })
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as DailyTask[];
}

const ensurePromiseCache: { [key: string]: Promise<DailyTask[]> } = {};

export async function ensureDailyFixedTasks(userId: string, date = todayKey()) {
  const cacheKey = `${userId}:${date}`;
  if (ensurePromiseCache[cacheKey] !== undefined) {
    return ensurePromiseCache[cacheKey];
  }

  const promise = (async () => {
    const [fixedTasks, rawExistingDailyTasks] = await Promise.all([
      fetchFixedTasks(userId),
      fetchTasks(userId, date),
    ]);

    // Clean up any existing duplicate fixed tasks from the database (e.g. from previous race conditions)
    const seenFixedTaskIds = new Set<string>();
    const duplicateIdsToDelete: string[] = [];
    let existingDailyTasks = rawExistingDailyTasks;

    rawExistingDailyTasks.forEach((task) => {
      if (task.fixed_task_id) {
        if (seenFixedTaskIds.has(task.fixed_task_id)) {
          duplicateIdsToDelete.push(task.id);
        } else {
          seenFixedTaskIds.add(task.fixed_task_id);
        }
      }
    });

    if (duplicateIdsToDelete.length > 0) {
      await supabase.from('daily_tasks').delete().in('id', duplicateIdsToDelete);
      existingDailyTasks = rawExistingDailyTasks.filter(
        (task) => !duplicateIdsToDelete.includes(task.id),
      );
    }

    const existingFixedTaskIds = new Set(
      existingDailyTasks
        .map((task) => task.fixed_task_id)
        .filter((id): id is string => Boolean(id)),
    );

    const missingFixedTasks = fixedTasks.filter((task) => !existingFixedTaskIds.has(task.id));

    if (!missingFixedTasks.length) {
      return existingDailyTasks;
    }

    const { error } = await supabase.from('daily_tasks').insert(
      missingFixedTasks.map((task) => ({
        user_id: userId,
        fixed_task_id: task.id,
        title: task.title,
        description: task.description,
        priority: task.priority,
        status: 'pending' as TaskStatus,
        due_date: null,
        task_type: 'fixed' as TaskType,
        is_custom: false,
        date,
      })),
    );

    if (error) throw error;
    return fetchTasks(userId, date);
  })();

  ensurePromiseCache[cacheKey] = promise;
  try {
    return await promise;
  } finally {
    delete ensurePromiseCache[cacheKey];
  }
}

export async function fetchTodayTasks(userId: string) {
  return ensureDailyFixedTasks(userId);
}

function stripRelatedTo(payload: Record<string, unknown>) {
  const sanitized = { ...payload };
  delete sanitized.related_to;
  return sanitized;
}

function shouldRetryWithoutRelatedTo(error: unknown) {
  return (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof (error as { message?: string }).message === 'string' &&
    /(related_to).*schema cache/i.test((error as { message: string }).message)
  );
}

export async function createTask(userId: string, task: NewTaskInput) {
  const payload: Record<string, unknown> = {
    user_id: userId,
    title: task.title.trim(),
    description: task.description?.trim() || null,
    remark: task.remark?.trim() || null,
    priority: task.priority,
    due_date: task.due_date || null,
    task_type: task.task_type || 'today',
    related_to: task.related_to?.trim() || null,
    date: task.date ?? todayKey(),
    is_custom: true,
  };

  const insertRow = async (row: Record<string, unknown>) =>
    supabase.from('daily_tasks').insert(row).select('*').single();

  let { data, error } = await insertRow(payload);
  if (error && shouldRetryWithoutRelatedTo(error)) {
    ({ data, error } = await insertRow(stripRelatedTo(payload)));
  }

  if (error) throw error;
  return data as DailyTask;
}

export async function updateTask(id: string, task: Partial<NewTaskInput>) {
  const updates: Record<string, unknown> = {};
  if (task.title !== undefined) updates.title = task.title.trim();
  if (task.description !== undefined) updates.description = task.description?.trim() || null;
  if (task.remark !== undefined) updates.remark = task.remark?.trim() || null;
  if (task.priority !== undefined) updates.priority = task.priority;
  if (task.due_date !== undefined) updates.due_date = task.due_date || null;
  if (task.task_type !== undefined) updates.task_type = task.task_type;
  if (task.related_to !== undefined) updates.related_to = task.related_to?.trim() || null;

  const updateRow = async (row: Record<string, unknown>) =>
    supabase.from('daily_tasks').update(row).eq('id', id).select('*').single();

  let { data, error } = await updateRow(updates);
  if (error && shouldRetryWithoutRelatedTo(error)) {
    ({ data, error } = await updateRow(stripRelatedTo(updates)));
  }

  if (error) throw error;
  return data as DailyTask;
}

export async function updateTaskStatus(id: string, status: TaskStatus) {
  const { data, error } = await supabase
    .from('daily_tasks')
    .update({ status })
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return data as DailyTask;
}

export async function deleteTask(id: string) {
  const { error } = await supabase.from('daily_tasks').delete().eq('id', id);
  if (error) throw error;
}

// Fixed Tasks Management (Admin only)
export interface NewFixedTaskInput {
  title: string;
  description?: string;
  priority: TaskPriority;
  assigned_to?: string | null;
}

export async function fetchAllFixedTasks() {
  const { data, error } = await supabase
    .from('fixed_tasks')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as FixedTask[];
}

export async function createFixedTask(userId: string, task: NewFixedTaskInput) {
  const { data, error } = await supabase
    .from('fixed_tasks')
    .insert({
      title: task.title.trim(),
      description: task.description?.trim() || null,
      priority: task.priority,
      assigned_to: task.assigned_to || null,
      created_by: userId,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as FixedTask;
}

export async function updateFixedTask(id: string, task: Partial<NewFixedTaskInput>) {
  const updates: Record<string, unknown> = {};
  if (task.title !== undefined) updates.title = task.title.trim();
  if (task.description !== undefined) updates.description = task.description?.trim() || null;
  if (task.priority !== undefined) updates.priority = task.priority;
  if ('assigned_to' in task) updates.assigned_to = task.assigned_to || null;

  const { data, error } = await supabase
    .from('fixed_tasks')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return data as FixedTask;
}

export async function deleteFixedTask(id: string) {
  const { error } = await supabase.from('fixed_tasks').delete().eq('id', id);
  if (error) throw error;
}

// Excel Export Functions
export function exportTasksToCSV(tasks: DailyTask[], fileName = 'tasks.csv'): void {
  const headers = ['Date', 'Task Title', 'Description', 'Remark', 'Priority', 'Status', 'Type', 'Due Date', 'Created At'];
  
  const rows = tasks.map(task => [
    task.date,
    task.title,
    task.description || '',
    task.remark || '',
    task.priority,
    task.status,
    task.task_type,
    task.due_date || '',
    new Date(task.created_at).toLocaleDateString(),
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportTasksToExcel(tasks: DailyTask[], fileName = 'tasks.xlsx'): void {
  // Create a simple Excel-like format using CSV that Excel can open
  // For a more robust solution, consider using a library like xlsx
  exportTasksToCSV(tasks, fileName);
}

import { format } from 'date-fns';
import { supabase } from './supabase';

export type TaskPriority = 'high' | 'medium' | 'low';
export type TaskStatus = 'pending' | 'in_progress' | 'completed';

export interface DailyTask {
  id: string;
  user_id: string;
  fixed_task_id: string | null;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  due_time: string | null;
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
  priority: TaskPriority;
  due_time?: string;
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
    .order('due_time', { ascending: true, nullsFirst: false })
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
        due_time: null,
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

export async function createTask(userId: string, task: NewTaskInput) {
  const { data, error } = await supabase
    .from('daily_tasks')
    .insert({
      user_id: userId,
      title: task.title.trim(),
      description: task.description?.trim() || null,
      priority: task.priority,
      due_time: task.due_time || null,
      date: task.date ?? todayKey(),
      is_custom: true,
    })
    .select('*')
    .single();

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

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { CheckCircle2, Circle, Loader2, Plus, RefreshCcw, Trash2 } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { useAuth } from '../context/auth';
import { createTask, deleteTask, fetchTodayTasks, updateTaskStatus } from '../lib/tasks';
import type { DailyTask, TaskPriority, TaskStatus } from '../lib/tasks';

const statusOptions: { label: string; value: TaskStatus }[] = [
  { label: 'Pending', value: 'pending' },
  { label: 'In progress', value: 'in_progress' },
  { label: 'Completed', value: 'completed' },
];

const priorityOptions: { label: string; value: TaskPriority }[] = [
  { label: 'High', value: 'high' },
  { label: 'Medium', value: 'medium' },
  { label: 'Low', value: 'low' },
];

const statusIcons = {
  pending: Circle,
  in_progress: RefreshCcw,
  completed: CheckCircle2,
};

const statusStyles = {
  pending: 'text-amber-600 dark:text-amber-300',
  in_progress: 'text-brand-600 dark:text-brand-300',
  completed: 'text-emerald-600 dark:text-emerald-300',
};

const priorityStyles = {
  high: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900',
  medium: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900',
  low: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900',
};

function TaskCard({
  task,
  onStatusChange,
  onDelete,
  busy,
}: {
  task: DailyTask;
  onStatusChange: (task: DailyTask, status: TaskStatus) => void;
  onDelete: (task: DailyTask) => void;
  busy: boolean;
}) {
  const StatusIcon = statusIcons[task.status];

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusIcon className={`h-4 w-4 ${statusStyles[task.status]}`} />
            <h3 className="text-base font-semibold text-gray-950 dark:text-white">{task.title}</h3>
            <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${priorityStyles[task.priority]}`}>
              {task.priority}
            </span>
          </div>
          {task.description && <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{task.description}</p>}
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span>{task.is_custom ? 'Custom task' : 'Fixed task'}</span>
            {task.due_time && <span>Due {task.due_time.slice(0, 5)}</span>}
          </div>
        </div>
        <Button aria-label={`Delete ${task.title}`} variant="ghost" size="sm" disabled={busy} onClick={() => onDelete(task)}>
          <Trash2 className="h-4 w-4 text-red-500" />
        </Button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {statusOptions.map((option) => (
          <Button
            key={option.value}
            type="button"
            variant={task.status === option.value ? 'secondary' : 'outline'}
            size="sm"
            disabled={busy || task.status === option.value}
            onClick={() => onStatusChange(task, option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

export default function Tasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueTime, setDueTime] = useState('');

  const groupedTasks = useMemo(() => {
    return statusOptions.map((status) => ({
      ...status,
      tasks: tasks.filter((task) => task.status === status.value),
    }));
  }, [tasks]);

  const loadTasks = useCallback(async () => {
    if (!user) return;
    setError(null);
    setLoading(true);
    try {
      setTasks(await fetchTodayTasks(user.id));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    let isMounted = true;
    fetchTodayTasks(user.id)
      .then((nextTasks) => {
        if (isMounted) setTasks(nextTasks);
      })
      .catch((err: Error) => {
        if (isMounted) setError(err.message);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [user]);

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (!user || !title.trim()) return;

    setSaving(true);
    setError(null);
    try {
      const created = await createTask(user.id, {
        title,
        description,
        priority,
        due_time: dueTime,
      });
      setTasks((current) => [...current, created]);
      setTitle('');
      setDescription('');
      setPriority('medium');
      setDueTime('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (task: DailyTask, status: TaskStatus) => {
    setBusyId(task.id);
    setError(null);
    try {
      const updated = await updateTaskStatus(task.id, status);
      setTasks((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (task: DailyTask) => {
    setBusyId(task.id);
    setError(null);
    try {
      await deleteTask(task.id);
      setTasks((current) => current.filter((item) => item.id !== task.id));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6 lg:p-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-brand-600 dark:text-brand-300">My tasks</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-gray-950 dark:text-white">Manage today&apos;s work</h1>
          <p className="mt-2 text-gray-500 dark:text-gray-400">Create custom tasks, update progress, and keep fixed daily work visible.</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={loadTasks} disabled={loading}>
          <RefreshCcw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{error}</div>}

      <Card>
        <CardHeader>
          <CardTitle>Add a task</CardTitle>
          <CardDescription>Custom tasks are added to your list for today.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 lg:grid-cols-[1fr_1fr_160px_140px_auto]" onSubmit={handleCreate}>
            <Input label="Title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Follow up with client" required />
            <Input label="Description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Optional details" />
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Priority</label>
              <select
                className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                value={priority}
                onChange={(event) => setPriority(event.target.value as TaskPriority)}
              >
                {priorityOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
            <Input label="Due time" type="time" value={dueTime} onChange={(event) => setDueTime(event.target.value)} />
            <div className="flex items-end">
              <Button type="submit" className="w-full gap-2" isLoading={saving}>
                <Plus className="h-4 w-4" /> Add
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-brand-500" /></div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {groupedTasks.map((group) => (
            <section key={group.value} className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{group.label}</h2>
                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">{group.tasks.length}</span>
              </div>
              {group.tasks.length ? (
                group.tasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    busy={busyId === task.id}
                    onStatusChange={handleStatusChange}
                    onDelete={handleDelete}
                  />
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                  Nothing here yet.
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Plus, Trash2, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { useAuth } from '../context/auth';
import { createFixedTask, deleteFixedTask, fetchAllFixedTasks } from '../lib/tasks';
import type { FixedTask, TaskPriority } from '../lib/tasks';

const priorityOptions: { label: string; value: TaskPriority }[] = [
  { label: 'High', value: 'high' },
  { label: 'Medium', value: 'medium' },
  { label: 'Low', value: 'low' },
];

const priorityStyles = {
  high: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900',
  medium: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900',
  low: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900',
};

function FixedTaskCard({
  task,
  onDelete,
  busy,
}: {
  task: FixedTask;
  onDelete: (task: FixedTask) => void;
  busy: boolean;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-gray-950 dark:text-white">{task.title}</h3>
            <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${priorityStyles[task.priority]}`}>
              {task.priority}
            </span>
          </div>
          {task.description && <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{task.description}</p>}
          <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            {task.assigned_to ? 'Assigned to specific employee' : 'Assigned to all employees'}
          </div>
        </div>
        <Button
          aria-label={`Delete ${task.title}`}
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => onDelete(task)}
        >
          <Trash2 className="h-4 w-4 text-red-500" />
        </Button>
      </div>
    </div>
  );
}

export default function FixedTasks() {
  const { user, profile } = useAuth();
  const [tasks, setTasks] = useState<FixedTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');

  const isAdmin = profile?.role === 'admin';

  const loadTasks = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      setTasks(await fetchAllFixedTasks());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    fetchAllFixedTasks()
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
  }, []);

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (!user || !title.trim()) return;

    setSaving(true);
    setError(null);
    try {
      const created = await createFixedTask(user.id, {
        title,
        description,
        priority,
      });
      setTasks((current) => [created, ...current]);
      setTitle('');
      setDescription('');
      setPriority('medium');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (task: FixedTask) => {
    setBusyId(task.id);
    setError(null);
    try {
      await deleteFixedTask(task.id);
      setTasks((current) => current.filter((item) => item.id !== task.id));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  if (!isAdmin) {
    return (
      <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6 lg:p-8">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-300" />
            <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
              You don't have permission to manage fixed tasks. Only administrators can access this feature.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6 lg:p-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-brand-600 dark:text-brand-300">Fixed Tasks</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-gray-950 dark:text-white">
            Manage daily tasks
          </h1>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            Create fixed tasks that will appear in employees' daily task lists.
          </p>
        </div>
        <Button variant="outline" className="gap-2" onClick={loadTasks} disabled={loading}>
          <Loader2 className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Add a daily fixed task</CardTitle>
          <CardDescription>These tasks will automatically appear for all employees every day.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 lg:grid-cols-[1fr_1fr_160px_auto]" onSubmit={handleCreate}>
            <Input
              label="Title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g., Check daily emails"
              required
            />
            <Input
              label="Description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Optional details"
            />
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Priority</label>
              <select
                className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                value={priority}
                onChange={(event) => setPriority(event.target.value as TaskPriority)}
              >
                {priorityOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <Button type="submit" className="w-full gap-2" isLoading={saving}>
                <Plus className="h-4 w-4" /> Add
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
        </div>
      ) : (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Fixed Tasks
            </h2>
            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
              {tasks.length}
            </span>
          </div>
          {tasks.length ? (
            <div className="grid gap-3">
              {tasks.map((task) => (
                <FixedTaskCard
                  key={task.id}
                  task={task}
                  busy={busyId === task.id}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-gray-300 p-12 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
              <p className="mb-2 font-medium">No fixed tasks yet</p>
              <p>Create a task above to get started.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, CircleDashed, Clock3, Loader2, Plus, TimerReset } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { useAuth } from '../context/auth';
import { fetchTodayTasks } from '../lib/tasks';
import type { DailyTask } from '../lib/tasks';

const statusLabels = {
  pending: 'Pending',
  in_progress: 'In progress',
  completed: 'Completed',
};

const priorityStyles = {
  high: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900',
  medium: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900',
  low: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900',
};

function TaskRow({ task }: { task: DailyTask }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-gray-100 py-4 last:border-0 dark:border-gray-800">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate text-sm font-semibold text-gray-950 dark:text-white">{task.title}</h3>
          <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${priorityStyles[task.priority]}`}>
            {task.priority}
          </span>
        </div>
        {task.description && <p className="mt-1 line-clamp-2 text-sm text-gray-500 dark:text-gray-400">{task.description}</p>}
      </div>
      <div className="shrink-0 text-right text-xs text-gray-500 dark:text-gray-400">
        <div>{statusLabels[task.status]}</div>
        {task.due_time && <div className="mt-1">{task.due_time.slice(0, 5)}</div>}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    fetchTodayTasks(user.id)
      .then(setTasks)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [user]);

  const stats = useMemo(() => {
    const completed = tasks.filter((task) => task.status === 'completed').length;
    const inProgress = tasks.filter((task) => task.status === 'in_progress').length;
    const pending = tasks.filter((task) => task.status === 'pending').length;
    const progress = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;

    return { completed, inProgress, pending, progress };
  }, [tasks]);



  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6 lg:p-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-brand-600 dark:text-brand-300">Today</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-gray-950 dark:text-white">Daily task overview</h1>
          <p className="mt-2 text-gray-500 dark:text-gray-400">Track the work that needs attention before the day closes.</p>
        </div>
        <Link to="/tasks">
          <Button className="gap-2">
            <Plus className="h-4 w-4" /> Add task
          </Button>
        </Link>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{error}</div>}

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total tasks</CardDescription>
            <CardTitle className="text-3xl">{loading ? '-' : tasks.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Completed</CardDescription>
            <CardTitle className="flex items-center gap-2 text-3xl"><CheckCircle2 className="h-6 w-6 text-emerald-500" /> {stats.completed}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>In progress</CardDescription>
            <CardTitle className="flex items-center gap-2 text-3xl"><TimerReset className="h-6 w-6 text-brand-500" /> {stats.inProgress}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Pending</CardDescription>
            <CardTitle className="flex items-center gap-2 text-3xl"><CircleDashed className="h-6 w-6 text-amber-500" /> {stats.pending}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <CardTitle>Task progress</CardTitle>
            <CardDescription>{stats.progress}% of today&apos;s work is complete</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-3 rounded-full bg-gray-100 dark:bg-gray-800">
              <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${stats.progress}%` }} />
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {(['pending', 'in_progress', 'completed'] as const).map((status) => (
                <div key={status} className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
                  <p className="text-sm text-gray-500 dark:text-gray-400">{statusLabels[status]}</p>
                  <p className="mt-2 text-2xl font-semibold text-gray-950 dark:text-white">{tasks.filter((task) => task.status === status).length}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Clock3 className="h-5 w-5 text-brand-500" /> Upcoming</CardTitle>
            <CardDescription>Next tasks by due time</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex h-32 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-brand-500" /></div>
            ) : tasks.length ? (
              tasks.slice(0, 5).map((task) => <TaskRow key={task.id} task={task} />)
            ) : (
              <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                No tasks scheduled for today.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Circle, CircleDashed, Download, Loader2, Plus, RefreshCcw, TimerReset, ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { useAuth } from '../context/auth';
import { exportTasksToCSV, fetchTasksByDateRange, updateTask, updateTaskStatus, type DailyTask, type TaskPriority, type TaskType, type TaskStatus } from '../lib/tasks';
import { format, subDays } from 'date-fns';

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

const priorityOptions: { label: string; value: TaskPriority }[] = [
  { label: 'High', value: 'high' },
  { label: 'Medium', value: 'medium' },
  { label: 'Low', value: 'low' },
];

const taskTypeOptions: { label: string; value: TaskType }[] = [
  { label: "Today's Task", value: 'today' },
  { label: 'Regular Task', value: 'regular' },
  { label: 'Fixed Task', value: 'fixed' },
];

function TaskRow({ task, onStatusChange, onEdit, busy }: { task: DailyTask; onStatusChange: (task: DailyTask, status: TaskStatus) => void; onEdit?: (task: DailyTask) => void; busy: boolean; }) {
  return (
    <div className="flex flex-col gap-3 border-b border-gray-100 py-4 last:border-0 dark:border-gray-800">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-gray-950 dark:text-white">{task.title}</h3>
            <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${priorityStyles[task.priority]}`}>
              {task.priority}
            </span>
          </div>
          {task.description && <p className="mt-1 line-clamp-2 text-sm text-gray-500 dark:text-gray-400">{task.description}</p>}
          {task.remark && <p className="mt-1 text-xs italic text-gray-600 dark:text-gray-300">💡 {task.remark}</p>}
        </div>
        <div className="shrink-0 text-right text-xs text-gray-500 dark:text-gray-400">
          <div>{statusLabels[task.status]}</div>
          {task.due_date && <div className="mt-1">{task.due_date}</div>}
        </div>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        {task.status !== 'pending' && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => onStatusChange(task, 'pending')}
          >
            Pending
          </Button>
        )}
        {task.status !== 'in_progress' && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => onStatusChange(task, 'in_progress')}
          >
            Start
          </Button>
        )}
        {task.status !== 'completed' && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => onStatusChange(task, 'completed')}
          >
            Complete
          </Button>
        )}
        {onEdit && (
          <Button
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={() => onEdit(task)}
          >
            Edit
          </Button>
        )}
      </div>
    </div>
  );
}

type SortOption = 'latest' | 'priority-high' | 'priority-low' | 'name';
type FilterOption = 'all' | 'high' | 'medium' | 'low' | 'today' | 'fixed' | 'regular';

export default function Dashboard() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [sortBy, setSortBy] = useState<SortOption>('latest');
  const [filterBy, setFilterBy] = useState<FilterOption>('all');
  const [exportLoading, setExportLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<DailyTask | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [remark, setRemark] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueDate, setDueDate] = useState('');
  const [taskType, setTaskType] = useState<TaskType>('today');
  const dateStr = format(currentDate, 'yyyy-MM-dd');
  const isToday = format(new Date(), 'yyyy-MM-dd') === dateStr;

  useEffect(() => {
    if (!user) return;

    setLoading(true);
    setError(null);

    fetchTasksByDateRange(user.id, '1970-01-01', dateStr)
      .then((allTasks) => {
        const carryOverTasks = allTasks.filter(
          (task) => task.date === dateStr || task.status === 'pending',
        );
        setTasks(carryOverTasks);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [user, dateStr]);

  const filteredAndSortedTasks = useMemo(() => {
    let filtered = [...tasks];

    // Apply filter
    if (filterBy !== 'all') {
      if (filterBy === 'high' || filterBy === 'medium' || filterBy === 'low') {
        filtered = filtered.filter(task => task.priority === filterBy);
      } else if (filterBy === 'today' || filterBy === 'fixed' || filterBy === 'regular') {
        filtered = filtered.filter(task => task.task_type === filterBy);
      }
    }

    // Apply sort
    if (sortBy === 'priority-high') {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      filtered.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
    } else if (sortBy === 'priority-low') {
      const priorityOrder = { low: 0, medium: 1, high: 2 };
      filtered.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
    } else if (sortBy === 'name') {
      filtered.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === 'latest') {
      filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    return filtered;
  }, [tasks, sortBy, filterBy]);

  const statusGroups = useMemo(() => {
    const groups: { label: string; value: TaskStatus; icon: typeof Circle; iconColor: string; tasks: DailyTask[] }[] = [
      { label: 'Pending', value: 'pending', icon: CircleDashed, iconColor: 'text-amber-500', tasks: [] },
      { label: 'In Progress', value: 'in_progress', icon: RefreshCcw, iconColor: 'text-brand-500', tasks: [] },
      { label: 'Completed', value: 'completed', icon: CheckCircle2, iconColor: 'text-emerald-500', tasks: [] },
    ];
    for (const task of filteredAndSortedTasks) {
      const group = groups.find(g => g.value === task.status);
      if (group) group.tasks.push(task);
    }
    return groups;
  }, [filteredAndSortedTasks]);

  const stats = useMemo(() => {
    const completed = tasks.filter((task) => task.status === 'completed').length;
    const inProgress = tasks.filter((task) => task.status === 'in_progress').length;
    const pending = tasks.filter((task) => task.status === 'pending').length;
    const progress = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;

    return { completed, inProgress, pending, progress };
  }, [tasks]);

  const resetEditForm = () => {
    setTitle('');
    setDescription('');
    setRemark('');
    setPriority('medium');
    setDueDate('');
    setTaskType('today');
  };

  const handleEditClick = (task: DailyTask) => {
    setEditingTask(task);
    setTitle(task.title);
    setDescription(task.description || '');
    setRemark(task.remark || '');
    setPriority(task.priority);
    setDueDate(task.due_date || '');
    setTaskType(task.task_type);
  };

  const handleCancelEdit = () => {
    setEditingTask(null);
    resetEditForm();
  };

  const handleUpdateTask = async () => {
    if (!editingTask) return;
    setBusyId(editingTask.id);
    setError(null);

    try {
      const updated = await updateTask(editingTask.id, {
        title,
        description,
        remark,
        priority,
        due_date: dueDate,
        task_type: taskType,
      });
      setTasks((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setEditingTask(null);
      resetEditForm();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
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

  const handlePreviousDay = () => {
    setCurrentDate(subDays(currentDate, 1));
  };

  const handleNextDay = () => {
    const nextDate = new Date(currentDate);
    nextDate.setDate(nextDate.getDate() + 1);
    const today = new Date();
    if (nextDate <= today) {
      setCurrentDate(nextDate);
    }
  };

  const handleTodayClick = () => {
    setCurrentDate(new Date());
  };

  const handleExport = () => {
    setExportLoading(true);
    try {
      const fileName = `tasks-${dateStr}.csv`;
      exportTasksToCSV(tasks, fileName);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setExportLoading(false);
    }
  };

  const handleExportAll = () => {
    setExportLoading(true);
    try {
      const fileName = `tasks-summary.csv`;
      exportTasksToCSV(filteredAndSortedTasks, fileName);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6 lg:p-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-brand-600 dark:text-brand-300">{isToday ? 'Today' : 'History'}</p>
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

      {/* Date Navigation */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between gap-4">
            <Button variant="outline" size="sm" onClick={handlePreviousDay}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1 text-center">
              <input
                type="date"
                value={dateStr}
                onChange={(e) => setCurrentDate(new Date(e.target.value))}
                className="mx-auto rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNextDay}
              disabled={format(new Date(currentDate).setDate(currentDate.getDate() + 1), 'yyyy-MM-dd') > format(new Date(), 'yyyy-MM-dd')}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            {!isToday && (
              <Button variant="outline" size="sm" onClick={handleTodayClick}>
                Today
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Filter and Sort */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              >
                <option value="latest">Latest</option>
                <option value="name">Name (A-Z)</option>
                <option value="priority-high">Priority (High to Low)</option>
                <option value="priority-low">Priority (Low to High)</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Filter By</label>
              <select
                value={filterBy}
                onChange={(e) => setFilterBy(e.target.value as FilterOption)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              >
                <option value="all">All Tasks</option>
                <option value="high">High Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="low">Low Priority</option>
                <option value="today">Today's Tasks</option>
                <option value="regular">Regular Tasks</option>
                <option value="fixed">Fixed Tasks</option>
              </select>
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={handleExport} disabled={exportLoading || tasks.length === 0} className="w-full gap-2">
                <Download className="h-4 w-4" /> Export Day
              </Button>
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={handleExportAll} disabled={exportLoading || filteredAndSortedTasks.length === 0} className="w-full gap-2" variant="outline">
                <Download className="h-4 w-4" /> Export All
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {editingTask && (
        <Card>
          <CardHeader>
            <CardTitle>Edit previous task</CardTitle>
            <CardDescription>Update the task details for the selected date.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 lg:grid-cols-2">
              <Input label="Title" value={title} onChange={(event) => setTitle(event.target.value)} />
              <Input label="Description" value={description} onChange={(event) => setDescription(event.target.value)} />
              <Input label="Remark" value={remark} onChange={(event) => setRemark(event.target.value)} />
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Task Type</label>
                <select
                  value={taskType}
                  onChange={(event) => setTaskType(event.target.value as TaskType)}
                  className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                >
                  {taskTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Priority</label>
                <select
                  value={priority}
                  onChange={(event) => setPriority(event.target.value as TaskPriority)}
                  className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                >
                  {priorityOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <Input label="Due Date" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" onClick={handleUpdateTask} disabled={busyId === editingTask.id}>
                Save changes
              </Button>
              <Button type="button" variant="outline" onClick={handleCancelEdit}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

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

      {/* Task Progress */}
      <Card>
        <CardHeader>
          <CardTitle>Task progress</CardTitle>
          <CardDescription>{stats.progress}% of {isToday ? "today's" : "this day's"} work is complete</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-3 rounded-full bg-gray-100 dark:bg-gray-800">
            <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${stats.progress}%` }} />
          </div>
        </CardContent>
      </Card>

      {/* Grouped Task Columns: Pending / In Progress / Completed */}
      {loading ? (
        <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-brand-500" /></div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {statusGroups.map((group) => {
            const Icon = group.icon;
            return (
              <section key={group.value} className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    <Icon className={`h-4 w-4 ${group.iconColor}`} />
                    {group.label}
                  </h2>
                  <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">{group.tasks.length}</span>
                </div>
                {group.tasks.length ? (
                  <div className="space-y-3 max-h-[60vh] overflow-auto pr-1">
                    {group.tasks.map((task) => (
                      <Card key={task.id}>
                        <CardContent className="pt-4">
                          <TaskRow task={task} onStatusChange={handleStatusChange} onEdit={handleEditClick} busy={busyId === task.id} />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                    Nothing here yet.
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

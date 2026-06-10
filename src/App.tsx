import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/auth';
import { LayoutDashboard, ListChecks, Loader2, LogOut, Settings } from 'lucide-react';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import Dashboard from './pages/Dashboard';
import Tasks from './pages/Tasks';
import FixedTasks from './pages/FixedTasks';
import { fetchTodayTasks } from './lib/tasks';

// Protected Route Wrapper
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-brand-600 w-8 h-8" /></div>;
  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

// Basic Layout
const Layout = ({ children }: { children: React.ReactNode }) => {
  const { signOut, user, profile } = useAuth();
  const baseNavItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/tasks', label: 'My Tasks', icon: ListChecks },
  ];
  
  const navItems = profile?.role === 'admin' 
    ? [...baseNavItems, { to: '/fixed-tasks', label: 'Daily Tasks', icon: Settings }]
    : baseNavItems;
  
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 lg:flex">
      <aside className="border-b border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:flex-col lg:border-b-0 lg:border-r lg:p-6">
        <div className="mb-4 flex items-center gap-3 text-xl font-bold text-brand-600 dark:text-brand-400 lg:mb-8">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white shadow-md">G</span>
          <span>Globeam</span>
        </div>
        <nav className="flex gap-2 overflow-x-auto lg:flex-1 lg:flex-col">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  [
                    'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/50 dark:text-brand-300'
                      : 'text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800',
                  ].join(' ')
                }
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-gray-200 pt-4 dark:border-gray-800 lg:mt-auto lg:block">
          <div className="truncate px-2 text-sm text-gray-600 dark:text-gray-400">{user?.email}</div>
          <button onClick={signOut} className="mt-0 flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:hover:bg-red-900/20 lg:mt-2">
            <LogOut className="h-4 w-4" /> Sign Out
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1">
        {children}
      </main>
    </div>
  );
};

function AppRoutes() {
  const { session, loading, user } = useAuth();

  // Notification Permission Request + clear stale localStorage on startup
  useEffect(() => {
    if (session && typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
      // Clear stale localStorage flag if it's a new day
      const todayStr = new Date().toISOString().slice(0, 10);
      const lastSent = localStorage.getItem('last_5pm_notification_date');
      if (lastSent && lastSent !== todayStr) {
        localStorage.removeItem('last_5pm_notification_date');
        console.log('[Notification] Cleared stale notification flag from:', lastSent);
      }
    }
  }, [session]);

  // 5 PM Daily Reminder Notification
  useEffect(() => {
    if (!user) return;

    const checkReminder = async () => {
      const now = new Date();
      const hour = now.getHours();
      // Only fire during 5 PM hour (17:00 - 17:59)
      if (hour !== 17) return;

      const todayStr = now.toISOString().slice(0, 10);
      const lastSent = localStorage.getItem('last_5pm_notification_date');
      if (lastSent === todayStr) {
        return; // Already notified today
      }

      console.log('[Notification] 5 PM check triggered. Permission:', Notification.permission);

      if (!('Notification' in window)) {
        console.warn('[Notification] Notifications not supported.');
        return;
      }

      if (Notification.permission !== 'granted') {
        console.warn('[Notification] Permission not granted:', Notification.permission);
        return;
      }

      try {
        const tasks = await fetchTodayTasks(user.id);
        const pendingTasks = tasks.filter((task) => task.status !== 'completed');
        console.log('[Notification] Pending tasks count:', pendingTasks.length);

        if (pendingTasks.length > 0) {
          localStorage.setItem('last_5pm_notification_date', todayStr);
          const taskList = pendingTasks.map((t) => t.title).join(', ');
          new Notification('⏰ Ye kaam reh gya h complete kro!', {
            body: `${pendingTasks.length} pending: ${taskList}`,
            icon: '/favicon.svg',
            requireInteraction: true,
          });
          console.log('[Notification] Notification fired successfully!');
        } else {
          console.log('[Notification] All tasks completed, skipping notification.');
        }
      } catch (err) {
        console.error('[Notification] Failed to fetch tasks:', err);
      }
    };

    // Check immediately and then every minute
    checkReminder();
    const intervalId = setInterval(checkReminder, 60000);

    return () => clearInterval(intervalId);
  }, [user]);
  
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950"><Loader2 className="animate-spin text-brand-600 w-8 h-8" /></div>;

  return (
    <Routes>
      <Route path="/login" element={session ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/register" element={session ? <Navigate to="/" replace /> : <Register />} />
      <Route path="/forgot-password" element={session ? <Navigate to="/" replace /> : <ForgotPassword />} />
      
      <Route path="/" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
      <Route path="/tasks" element={<ProtectedRoute><Layout><Tasks /></Layout></ProtectedRoute>} />
      <Route path="/fixed-tasks" element={<ProtectedRoute><Layout><FixedTasks /></Layout></ProtectedRoute>} />
      
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

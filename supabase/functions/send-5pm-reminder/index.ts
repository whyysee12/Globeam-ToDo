import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') ?? 'reminders@yourdomain.com';

interface Profile {
  id: string;
  full_name: string;
  email: string;
}

interface DailyTask {
  title: string;
  priority: 'high' | 'medium' | 'low';
  status: string;
  due_time: string | null;
}

Deno.serve(async (req) => {
  // Allow manual trigger via POST as well as cron
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // 1. Fetch all users with their emails from auth.users joined with profiles
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('id, full_name')
      .not('id', 'is', null);

    if (usersError) throw usersError;
    if (!users || users.length === 0) {
      return new Response(JSON.stringify({ message: 'No users found' }), { status: 200 });
    }

    // 2. Get auth emails for each user (service role can access auth.users)
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    if (authError) throw authError;

    const emailMap = new Map(authUsers.users.map((u) => [u.id, u.email ?? '']));

    const today = new Date().toISOString().slice(0, 10);
    const results: { user: string; status: string }[] = [];

    // 3. For each user, fetch pending tasks and send email
    for (const user of users as Profile[]) {
      const email = emailMap.get(user.id);
      if (!email) continue;

      const { data: tasks, error: tasksError } = await supabase
        .from('daily_tasks')
        .select('title, priority, status, due_time')
        .eq('user_id', user.id)
        .eq('date', today)
        .neq('status', 'completed');

      if (tasksError) {
        console.error(`Error fetching tasks for ${email}:`, tasksError);
        results.push({ user: email, status: 'error fetching tasks' });
        continue;
      }

      const pendingTasks = (tasks ?? []) as DailyTask[];
      if (pendingTasks.length === 0) {
        results.push({ user: email, status: 'all tasks completed, skipped' });
        continue;
      }

      // 4. Build the email HTML
      const priorityEmoji: Record<string, string> = {
        high: '🔴',
        medium: '🟡',
        low: '🟢',
      };
      const statusEmoji: Record<string, string> = {
        pending: '⏳',
        in_progress: '🔄',
      };

      const taskRows = pendingTasks
        .map(
          (t) => `
          <tr>
            <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;">
              ${priorityEmoji[t.priority] ?? ''} ${t.title}
            </td>
            <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:center;">
              <span style="background:${t.priority === 'high' ? '#fee2e2' : t.priority === 'medium' ? '#fef9c3' : '#dcfce7'};
                color:${t.priority === 'high' ? '#b91c1c' : t.priority === 'medium' ? '#92400e' : '#166534'};
                padding:2px 8px;border-radius:9999px;font-size:12px;font-weight:600;">
                ${t.priority}
              </span>
            </td>
            <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:center;color:#6b7280;font-size:13px;">
              ${statusEmoji[t.status] ?? ''} ${t.status.replace('_', ' ')}
            </td>
            <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:center;color:#6b7280;font-size:13px;">
              ${t.due_time ? t.due_time.slice(0, 5) : '—'}
            </td>
          </tr>`
        )
        .join('');

      const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:32px 36px;">
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="width:40px;height:40px;background:rgba(255,255,255,0.2);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px;">⏰</div>
        <div>
          <div style="color:rgba(255,255,255,0.8);font-size:13px;font-weight:500;letter-spacing:0.5px;">GLOBEAM · 5 PM REMINDER</div>
          <div style="color:#ffffff;font-size:22px;font-weight:700;margin-top:2px;">Aaj ka kaam baaki hai!</div>
        </div>
      </div>
    </div>

    <!-- Body -->
    <div style="padding:32px 36px;">
      <p style="margin:0 0 8px;font-size:16px;color:#374151;">Hi <strong>${user.full_name}</strong> 👋</p>
      <p style="margin:0 0 24px;color:#6b7280;font-size:14px;line-height:1.6;">
        Din khatam hone se pehle, <strong>${pendingTasks.length} task${pendingTasks.length > 1 ? 's' : ''}</strong> abhi bhi pending hain. 
        Inhe aaj hi complete karo!
      </p>

      <!-- Task Table -->
      <table style="width:100%;border-collapse:collapse;background:#f9fafb;border-radius:12px;overflow:hidden;">
        <thead>
          <tr style="background:#f3f4f6;">
            <th style="padding:10px 12px;text-align:left;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Task</th>
            <th style="padding:10px 12px;text-align:center;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Priority</th>
            <th style="padding:10px 12px;text-align:center;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Status</th>
            <th style="padding:10px 12px;text-align:center;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Due</th>
          </tr>
        </thead>
        <tbody>
          ${taskRows}
        </tbody>
      </table>

      <!-- CTA Button -->
      <div style="text-align:center;margin-top:28px;">
        <a href="${SUPABASE_URL.replace('.supabase.co', '')}" 
           style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:600;font-size:15px;letter-spacing:0.3px;">
          ✅ Tasks Complete Karo →
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="padding:20px 36px;border-top:1px solid #f0f0f0;text-align:center;">
      <p style="margin:0;font-size:12px;color:#9ca3af;">
        Yeh reminder Globeam ne bheja hai • Aaj: ${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
      </p>
    </div>
  </div>
</body>
</html>`;

      // 5. Send via Resend
      const resendResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `Globeam Reminders <${FROM_EMAIL}>`,
          to: [email],
          subject: `⏰ ${pendingTasks.length} task${pendingTasks.length > 1 ? 's' : ''} pending — complete karo!`,
          html,
        }),
      });

      if (resendResponse.ok) {
        results.push({ user: email, status: 'email sent' });
        console.log(`✅ Email sent to ${email}`);
      } else {
        const err = await resendResponse.text();
        results.push({ user: email, status: `resend error: ${err}` });
        console.error(`❌ Resend error for ${email}:`, err);
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err) {
    console.error('Fatal error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

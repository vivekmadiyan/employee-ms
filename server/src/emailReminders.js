import { query } from './db.js';
import { sendWorkspaceEmail } from './email.js';

export async function sendDailyTaskReminders(emailOptions) {
  const { rows } = await query(`
    WITH candidates AS (
      SELECT u.id, u.first_name, u.email, local_clock.today, workload.overdue, workload.due, workload.task_id
      FROM users u JOIN companies c ON c.id=u.company_id
      CROSS JOIN LATERAL (
        SELECT (now() AT TIME ZONE c.time_zone)::date AS today,
               (now() AT TIME ZONE c.time_zone)::time AS local_time
      ) local_clock
      CROSS JOIN LATERAL (
        SELECT COUNT(*) FILTER (WHERE t.task_date<to_char(local_clock.today, 'YYYY-MM-DD'))::int AS overdue,
               COUNT(*) FILTER (WHERE t.task_date=to_char(local_clock.today, 'YYYY-MM-DD'))::int AS due,
               CASE WHEN COUNT(*)=1 THEN MIN(t.id) END AS task_id
        FROM tasks t WHERE t.company_id=u.company_id AND t.assigned_to=u.id
          AND t.archived_at IS NULL AND t.status IN ('new','active')
          AND t.task_date<=to_char(local_clock.today, 'YYYY-MM-DD')
      ) workload
      WHERE c.active AND u.active AND u.role='employee' AND u.task_reminder_email
        AND (u.task_reminder_day IS NULL OR u.task_reminder_day<local_clock.today)
        AND local_clock.local_time>=TIME '09:00' AND local_clock.local_time<TIME '20:00'
        AND (workload.overdue>0 OR workload.due>0)
      ORDER BY u.task_reminder_day NULLS FIRST, u.id LIMIT 20
      FOR UPDATE OF u SKIP LOCKED
    )
    UPDATE users u SET task_reminder_day=candidates.today FROM candidates WHERE u.id=candidates.id
    RETURNING candidates.id,candidates.email,candidates.first_name AS "firstName",candidates.overdue,candidates.due,candidates.task_id
  `);

  // A daily claim survives restarts and prevents another worker from sending the same reminder.
  for (let start = 0; start < rows.length; start += 4) {
    await Promise.all(rows.slice(start, start + 4).map(async account => {
      try {
        await sendWorkspaceEmail({
          ...emailOptions,
          ...(account.task_id && { workspaceUrl: `${emailOptions.workspaceUrl.replace(/\/+$/, '')}/?task=${account.task_id}` }),
          recipientEmail: account.email,
          recipientName: account.firstName,
          subject: 'Your daily EmployeeMS task reminder',
          message: `Tasks due today: ${account.due}. Overdue tasks: ${account.overdue}.`
        });
      } catch (error) {
        console.error('Task reminder email failed:', { userId: account.id, code: error.code || 'provider_error' });
      }
    }));
  }
}

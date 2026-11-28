import { query } from './db.js';

export const workspaceBriefPrompt = 'Give me my workspace brief.';

export async function readWorkspaceBrief(user, today) {
  const { rows } = await query(
    `WITH reviewable AS (
       SELECT id FROM users WHERE company_id=$1 AND role='employee' AND active=true
         AND ($4::boolean OR manager_id=$2)
     ), task_totals AS (
       SELECT COUNT(*) FILTER (WHERE status IN ('new','active') AND task_date<$3::text)::int AS overdue,
              COUNT(*) FILTER (WHERE status IN ('new','active') AND task_date=$3::text)::int AS "dueToday",
              COUNT(*) FILTER (WHERE status='failed')::int AS blocked
       FROM tasks WHERE company_id=$1 AND archived_at IS NULL AND ($4 OR assigned_to=$2)
     )
     SELECT task_totals.*,
       ($4 OR EXISTS (SELECT 1 FROM reviewable)) AS "canReviewLeave",
       (SELECT COUNT(*)::int FROM leave_requests l JOIN reviewable u ON u.id=l.user_id
         WHERE l.company_id=$1 AND l.status='pending') AS "pendingApprovals",
       (SELECT COUNT(DISTINCT l.user_id)::int FROM leave_requests l JOIN reviewable u ON u.id=l.user_id
         WHERE l.company_id=$1 AND l.status='approved' AND l.end_date >= ($3::text)::date
           AND l.start_date <= ($3::text)::date + 6) AS "peopleAway",
       (SELECT COUNT(*)::int FROM leave_requests WHERE company_id=$1 AND user_id=$2
         AND status='pending') AS "myPendingLeave"
     FROM task_totals`,
    [user.companyId, user.id, today, user.role === 'admin']
  );
  return { ...rows[0], today };
}

export function formatWorkspaceBrief(brief, role, today) {
  const tasks = role === 'admin' ? 'Workspace tasks' : 'My tasks';
  const lines = [
    `Workspace brief for ${today}`,
    `${tasks}: ${brief.overdue} overdue, ${brief.dueToday} due today, ${brief.blocked} marked needs attention.`
  ];
  if (brief.canReviewLeave) {
    lines.push(`Leave requests awaiting review: ${brief.pendingApprovals}. People with approved time off in the next 7 days (including today): ${brief.peopleAway}.`);
  }
  if (role !== 'admin') lines.push(`My pending time-off requests: ${brief.myPendingLeave}.`);
  return lines.join('\n\n');
}

import { pool } from './db.js';

async function readSnapshot(read) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const report = await read(client.query.bind(client));
    await client.query('COMMIT');
    return report;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

const completionActivitySql = `WITH dates AS (
  SELECT $2::date AS period_start, ($3::date+1) AS period_end,
    ($2::date-($3::date-$2::date+1)) AS previous_start
), bounds AS (
  SELECT dates.*,
    (period_start::timestamp AT TIME ZONE $5) AS period_start_at,
    (period_end::timestamp AT TIME ZONE $5) AS period_end_at,
    (previous_start::timestamp AT TIME ZONE $5) AS previous_start_at
  FROM dates
)
SELECT coverage.started_at AS "coverageStartedAt",
  TO_CHAR(b.previous_start,'YYYY-MM-DD') AS "previousFrom",
  TO_CHAR(b.period_start-1,'YYYY-MM-DD') AS "previousTo",
  CASE WHEN b.period_end_at<=coverage.started_at OR b.period_start_at>=NOW() THEN 'unavailable'
    WHEN b.period_start_at<coverage.started_at OR b.period_end_at>NOW() THEN 'partial' ELSE 'complete' END AS "currentCoverage",
  CASE WHEN b.period_start_at<=coverage.started_at OR b.previous_start_at>=NOW() THEN 'unavailable'
    WHEN b.previous_start_at<coverage.started_at OR b.period_start_at>NOW() THEN 'partial' ELSE 'complete' END AS "previousCoverage",
  COUNT(DISTINCT e.task_id) FILTER (WHERE e.occurred_at>=b.period_start_at)::int AS "currentCompleted",
  COUNT(DISTINCT e.task_id) FILTER (WHERE e.occurred_at<b.period_start_at)::int AS "previousCompleted"
FROM bounds b CROSS JOIN task_report_coverage coverage
LEFT JOIN task_status_events e ON e.company_id=$1 AND e.to_status='completed'
  AND e.occurred_at>=b.previous_start_at AND e.occurred_at<b.period_end_at AND e.occurred_at<=NOW()
  AND e.occurred_at>=coverage.started_at
  AND ($4::integer IS NULL OR e.assigned_to=$4)
GROUP BY coverage.started_at,b.period_start,b.period_end_at,b.period_start_at,b.previous_start,b.previous_start_at`;

function formatCompletionActivity(activity, range) {
  if (!activity) return null;
  const period = (from, to, count, coverage) => ({ from, to, completed: coverage === 'unavailable' ? null : count, coverage });
  return {
    coverageStartedAt: activity.coverageStartedAt,
    current: period(range.from, range.to, activity.currentCompleted, activity.currentCoverage),
    previous: period(activity.previousFrom, activity.previousTo, activity.previousCompleted, activity.previousCoverage)
  };
}

export function readTaskReport(companyId, range, { employeeId, includeAssignees = true, timeZone = 'UTC' } = {}) {
  return readSnapshot(async query => {
    const params = [companyId, range.from, range.to, employeeId ?? null, timeZone];
    const scope = `t.company_id=$1 AND t.archived_at IS NULL
      AND t.created_at >= ($2::date::timestamp AT TIME ZONE $5)
      AND t.created_at < (($3::date+1)::timestamp AT TIME ZONE $5)
      AND ($4::integer IS NULL OR t.assigned_to=$4)`;
    const overdue = `t.status IN ('new','active') AND t.task_date<TO_CHAR(NOW() AT TIME ZONE $5,'YYYY-MM-DD')`;

    const summary = await query(
      `SELECT COUNT(*)::int AS "totalTasks",
         COUNT(*) FILTER (WHERE t.status='new')::int AS "newTasks",
         COUNT(*) FILTER (WHERE t.status='active')::int AS "activeTasks",
         COUNT(*) FILTER (WHERE t.status='completed')::int AS "completedTasks",
         COUNT(*) FILTER (WHERE t.status='failed')::int AS "failedTasks",
         COUNT(*) FILTER (WHERE ${overdue})::int AS "overdueTasks"
       FROM tasks t WHERE ${scope}`,
      params
    );
    const statuses = await query(`SELECT t.status,COUNT(*)::int AS count FROM tasks t WHERE ${scope} GROUP BY t.status`, params);
    const priorities = await query(`SELECT t.priority,COUNT(*)::int AS count FROM tasks t WHERE ${scope} GROUP BY t.priority`, params);
    const categories = await query(
      `SELECT t.category,COUNT(*)::int AS count FROM tasks t WHERE ${scope} GROUP BY t.category ORDER BY count DESC,t.category ASC LIMIT 10`,
      params
    );
    const assignees = includeAssignees ? await query(
      `SELECT t.assigned_to AS "assigneeId",COALESCE(u.first_name,'Former employee') AS "assigneeName",
         COALESCE(u.active,false) AS active,COUNT(*)::int AS "totalTasks",
         COUNT(*) FILTER (WHERE t.status='completed')::int AS "completedTasks",
         COUNT(*) FILTER (WHERE ${overdue})::int AS "overdueTasks"
       FROM tasks t LEFT JOIN users u ON u.id=t.assigned_to AND u.company_id=t.company_id
       WHERE ${scope} GROUP BY t.assigned_to,u.first_name,u.active ORDER BY "totalTasks" DESC,"assigneeName" ASC`,
      params
    ) : { rows: [] };
    const completion = await query(completionActivitySql, params);
    return {
      range, timeZone, completionActivity: formatCompletionActivity(completion.rows[0], range),
      summary: summary.rows[0], statusBreakdown: statuses.rows, priorityBreakdown: priorities.rows,
      categoryBreakdown: categories.rows, assigneeBreakdown: assignees.rows
    };
  });
}

export function readWorkforceReport(companyId) {
  return readSnapshot(async query => {
    const headcount = await query(
      `SELECT COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE active=true)::int AS "activeEmployees",
         COUNT(*) FILTER (WHERE active=false)::int AS "inactiveEmployees"
       FROM users WHERE company_id=$1 AND role='employee'`,
      [companyId]
    );
    const departments = await query(
      `SELECT department,COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE active=true)::int AS active,
         COUNT(*) FILTER (WHERE active=false)::int AS inactive
       FROM users WHERE company_id=$1 AND role='employee'
       GROUP BY department ORDER BY total DESC,department`,
      [companyId]
    );
    const onboarding = await query(
      `SELECT t.status,COUNT(*)::int AS count
       FROM employee_onboarding o
       JOIN tasks t ON t.company_id=o.company_id AND t.assigned_to=o.employee_id AND t.category='Onboarding'
       WHERE o.company_id=$1 AND t.archived_at IS NULL
       GROUP BY t.status ORDER BY t.status`,
      [companyId]
    );
    const offboarding = await query(
      `SELECT status,COUNT(*)::int AS count FROM employee_offboardings
       WHERE company_id=$1 GROUP BY status ORDER BY status`,
      [companyId]
    );
    const leave = await query(
      `SELECT status,COUNT(*)::int AS count FROM leave_requests
       WHERE company_id=$1 AND created_at >= NOW() - INTERVAL '12 months'
       GROUP BY status ORDER BY status`,
      [companyId]
    );
    return {
      headcount: headcount.rows[0], departments: departments.rows, onboardingTasks: onboarding.rows,
      offboardingPlans: offboarding.rows, leaveRequestsLast12Months: leave.rows
    };
  });
}

const statusNames = {
  new: 'New', active: 'In progress', completed: 'Completed', failed: 'Needs attention',
  in_progress: 'In progress', pending: 'Pending', approved: 'Approved', rejected: 'Declined', cancelled: 'Cancelled'
};

const statusRows = rows => rows.map(({ status, count }) => ({ label: statusNames[status] || status, count }));

export function formatTaskAiReport(report, isAdmin) {
  const { range, summary, statusBreakdown, priorityBreakdown, categoryBreakdown } = report;
  return {
    kind: 'tasks',
    title: isAdmin ? 'Workspace task report' : 'My task report',
    period: `${range.from} to ${range.to} by task creation date`,
    metrics: [
      { label: 'Total tasks', value: summary.totalTasks },
      { label: 'Completed', value: summary.completedTasks },
      { label: 'In progress', value: summary.activeTasks },
      { label: 'Overdue', value: summary.overdueTasks },
      { label: 'New', value: summary.newTasks },
      { label: 'Needs attention', value: summary.failedTasks }
    ],
    sections: [
      { title: 'Status breakdown', rows: statusRows(statusBreakdown) },
      {
        title: 'Priority breakdown',
        rows: priorityBreakdown.map(({ priority, count }) => ({ label: priority === 'high' ? 'High' : priority === 'low' ? 'Low' : 'Medium', count }))
      },
      { title: 'Top categories', rows: categoryBreakdown.map(({ category, count }) => ({ label: category, count })) }
    ]
  };
}

export function formatWorkforceAiReport(report) {
  const { headcount, departments, onboardingTasks, offboardingPlans, leaveRequestsLast12Months } = report;
  return {
    kind: 'workforce',
    title: 'Workforce overview',
    period: 'Current workforce and leave requests filed in the last 12 months',
    metrics: [
      { label: 'Total employees', value: headcount.total },
      { label: 'Active employees', value: headcount.activeEmployees },
      { label: 'Inactive employees', value: headcount.inactiveEmployees },
      { label: 'Leave requests (12 months)', value: leaveRequestsLast12Months.reduce((sum, row) => sum + row.count, 0) }
    ],
    sections: [
      { title: 'Headcount by department', rows: departments.map(({ department, total }) => ({ label: department, count: total })) },
      { title: 'Onboarding tasks', rows: statusRows(onboardingTasks) },
      { title: 'Offboarding plans', rows: statusRows(offboardingPlans) },
      { title: 'Leave requests (12 months)', rows: statusRows(leaveRequestsLast12Months) }
    ]
  };
}

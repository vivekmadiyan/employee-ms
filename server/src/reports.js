import { query } from './db.js';

export async function readTaskReport(companyId, range, { employeeId, includeAssignees = true } = {}) {
  const params = [companyId, range.from, range.to];
  let scope = "t.company_id=$1 AND t.archived_at IS NULL AND t.created_at >= $2::date AND t.created_at < ($3::date + INTERVAL '1 day')";
  if (employeeId != null) {
    params.push(employeeId);
    scope += ' AND t.assigned_to=$4';
  }

  const [summary, statuses, priorities, categories, assignees] = await Promise.all([
    query(
      `SELECT COUNT(*)::int AS "totalTasks",
         COUNT(*) FILTER (WHERE t.status='new')::int AS "newTasks",
         COUNT(*) FILTER (WHERE t.status='active')::int AS "activeTasks",
         COUNT(*) FILTER (WHERE t.status='completed')::int AS "completedTasks",
         COUNT(*) FILTER (WHERE t.status='failed')::int AS "failedTasks",
         COUNT(*) FILTER (WHERE t.status IN ('new','active') AND t.task_date<CURRENT_DATE::text)::int AS "overdueTasks"
       FROM tasks t WHERE ${scope}`,
      params
    ),
    query(`SELECT t.status,COUNT(*)::int AS count FROM tasks t WHERE ${scope} GROUP BY t.status`, params),
    query(`SELECT t.priority,COUNT(*)::int AS count FROM tasks t WHERE ${scope} GROUP BY t.priority`, params),
    query(
      `SELECT t.category,COUNT(*)::int AS count FROM tasks t WHERE ${scope} GROUP BY t.category ORDER BY count DESC,t.category ASC LIMIT 10`,
      params
    ),
    includeAssignees ? query(
      `SELECT t.assigned_to AS "assigneeId",COALESCE(u.first_name,'Former employee') AS "assigneeName",
         COALESCE(u.active,false) AS active,COUNT(*)::int AS "totalTasks",
         COUNT(*) FILTER (WHERE t.status='completed')::int AS "completedTasks",
         COUNT(*) FILTER (WHERE t.status IN ('new','active') AND t.task_date<CURRENT_DATE::text)::int AS "overdueTasks"
       FROM tasks t LEFT JOIN users u ON u.id=t.assigned_to AND u.company_id=t.company_id
       WHERE ${scope} GROUP BY t.assigned_to,u.first_name,u.active ORDER BY "totalTasks" DESC,"assigneeName" ASC`,
      params
    ) : { rows: [] }
  ]);
  return {
    range, summary: summary.rows[0], statusBreakdown: statuses.rows, priorityBreakdown: priorities.rows,
    categoryBreakdown: categories.rows, assigneeBreakdown: assignees.rows
  };
}

export async function readWorkforceReport(companyId) {
  const [headcount, departments, onboarding, offboarding, leave] = await Promise.all([
    query(
      `SELECT COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE active=true)::int AS "activeEmployees",
         COUNT(*) FILTER (WHERE active=false)::int AS "inactiveEmployees"
       FROM users WHERE company_id=$1 AND role='employee'`,
      [companyId]
    ),
    query(
      `SELECT department,COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE active=true)::int AS active,
         COUNT(*) FILTER (WHERE active=false)::int AS inactive
       FROM users WHERE company_id=$1 AND role='employee'
       GROUP BY department ORDER BY total DESC,department`,
      [companyId]
    ),
    query(
      `SELECT t.status,COUNT(*)::int AS count
       FROM employee_onboarding o
       JOIN tasks t ON t.company_id=o.company_id AND t.assigned_to=o.employee_id AND t.category='Onboarding'
       WHERE o.company_id=$1 AND t.archived_at IS NULL
       GROUP BY t.status ORDER BY t.status`,
      [companyId]
    ),
    query(
      `SELECT status,COUNT(*)::int AS count FROM employee_offboardings
       WHERE company_id=$1 GROUP BY status ORDER BY status`,
      [companyId]
    ),
    query(
      `SELECT status,COUNT(*)::int AS count FROM leave_requests
       WHERE company_id=$1 AND created_at >= NOW() - INTERVAL '12 months'
       GROUP BY status ORDER BY status`,
      [companyId]
    )
  ]);
  return {
    headcount: headcount.rows[0], departments: departments.rows, onboardingTasks: onboarding.rows,
    offboardingPlans: offboarding.rows, leaveRequestsLast12Months: leave.rows
  };
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

import React, { useCallback, useEffect, useState } from 'react';
import { FaPeopleGroup } from 'react-icons/fa6';
import { getWorkforceReportApi } from '../../api';

const statusLabel = status => ({
  new: 'New',
  active: 'In progress',
  completed: 'Completed',
  failed: 'Needs attention',
  in_progress: 'In progress',
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Declined',
  cancelled: 'Cancelled'
}[status] || status);

function SummaryCard({ label, value, tone }) {
  return (
    <article className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs">
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-extrabold tabular-nums ${tone}`}>{value}</p>
    </article>
  );
}

function StatusList({ title, rows }) {
  return (
    <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs">
      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">{title}</h3>
      {rows.length ? (
        <ul className="mt-3 divide-y divide-slate-100">
          {rows.map(row => (
            <li key={row.status} className="flex items-center justify-between gap-3 py-2 text-xs">
              <span className="font-medium text-slate-600">{statusLabel(row.status)}</span>
              <span className="font-bold tabular-nums text-slate-900">{row.count}</span>
            </li>
          ))}
        </ul>
      ) : <p className="mt-3 text-xs text-slate-400">No records yet.</p>}
    </section>
  );
}

export default function WorkforceReports() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      setReport(await getWorkforceReportApi());
      setError('');
    } catch (requestError) {
      setError(requestError.message || 'Could not load workforce reporting.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReport();
    window.addEventListener('ems:workspace-updated', loadReport);
    return () => window.removeEventListener('ems:workspace-updated', loadReport);
  }, [loadReport]);

  return (
    <section className="dashboard-card overflow-hidden rounded-2xl shadow-sm" aria-labelledby="workforce-report-heading">
      <div className="flex items-center gap-3 border-b border-slate-100 p-5 sm:p-6">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
          <FaPeopleGroup aria-hidden="true" />
        </span>
        <div>
          <h2 id="workforce-report-heading" className="dashboard-card-heading text-slate-900">Workforce overview</h2>
          <p className="mt-0.5 text-xs text-slate-500">Company-scoped headcount and people-workflow totals.</p>
        </div>
      </div>

      {error && <p role="alert" className="mx-5 mt-4 rounded-xl border border-rose-100 bg-rose-50 p-3 text-xs text-rose-700 sm:mx-6">{error}</p>}
      {loading ? (
        <p role="status" className="p-8 text-center text-xs text-slate-500">Loading workforce overview…</p>
      ) : report ? (
        <div className="space-y-5 p-5 sm:p-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <SummaryCard label="Employees" value={report.headcount.total} tone="text-slate-900" />
            <SummaryCard label="Active accounts" value={report.headcount.activeEmployees} tone="text-emerald-700" />
            <SummaryCard label="Inactive accounts" value={report.headcount.inactiveEmployees} tone="text-slate-600" />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Headcount by department</h3>
              {report.departments.length ? (
                <ul className="mt-3 divide-y divide-slate-100">
                  {report.departments.map(row => (
                    <li key={row.department} className="flex items-center justify-between gap-3 py-2 text-xs">
                      <span className="font-medium text-slate-600">{row.department}</span>
                      <span className="font-bold tabular-nums text-slate-900">
                        {row.active} active · {row.inactive} inactive
                      </span>
                    </li>
                  ))}
                </ul>
              ) : <p className="mt-3 text-xs text-slate-400">No employee records yet.</p>}
            </section>
            <StatusList title="Onboarding tasks" rows={report.onboardingTasks} />
            <StatusList title="Offboarding plans" rows={report.offboardingPlans} />
            <StatusList title="Leave requests · last 12 months" rows={report.leaveRequestsLast12Months} />
          </div>
        </div>
      ) : null}
    </section>
  );
}

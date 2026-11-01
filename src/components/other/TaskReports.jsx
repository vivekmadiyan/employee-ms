import React, { useCallback, useEffect, useState } from 'react';
import { FaChartColumn, FaDownload } from 'react-icons/fa6';
import { getTaskReportApi } from '../../api';

const localDate = date => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const defaultRange = () => {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 29);
  return { from: localDate(from), to: localDate(to) };
};
const csvCell = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
const statusNames = { new: 'New', active: 'In progress', completed: 'Completed', failed: 'Needs attention' };
const priorityNames = { high: 'High', medium: 'Medium', low: 'Low' };

function Breakdown({ title, rows, labelFor, total, tone = 'bg-indigo-500' }) {
  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-bold text-slate-800">{title}</h3>
      {rows.length ? (
        <ul className="mt-4 space-y-4">
          {rows.map((row, index) => {
            const count = Number(row.count);
            const width = total ? Math.max((count / total) * 100, count ? 3 : 0) : 0;
            return (
              <li key={`${labelFor(row)}-${index}`}>
                <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                  <span className="truncate font-medium text-slate-600">{labelFor(row)}</span>
                  <span className="shrink-0 font-bold tabular-nums text-slate-800">{count}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full rounded-full ${tone}`} style={{ width: `${width}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      ) : <p className="mt-4 text-xs text-slate-500">No task data in this period.</p>}
    </section>
  );
}

export default function TaskReports() {
  const [range, setRange] = useState(defaultRange);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      setReport(await getTaskReportApi(range));
      setError('');
    } catch (requestError) {
      setError(requestError.message || 'Could not load task reporting.');
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  useEffect(() => {
    window.addEventListener('ems:workspace-updated', loadReport);
    return () => window.removeEventListener('ems:workspace-updated', loadReport);
  }, [loadReport]);

  const updateRange = event => {
    const { name, value } = event.target;
    setRange(current => ({ ...current, [name]: value }));
  };

  const downloadCsv = () => {
    if (!report) return;
    const rows = [
      ['EmployeeMS task report'],
      ['Created from', report.range.from],
      ['Created through', report.range.to],
      [],
      ['Summary', 'Tasks'],
      ['Total tasks', report.summary.totalTasks],
      ['New', report.summary.newTasks],
      ['In progress', report.summary.activeTasks],
      ['Completed', report.summary.completedTasks],
      ['Needs attention', report.summary.failedTasks],
      ['Overdue open tasks', report.summary.overdueTasks],
      [],
      ['Status', 'Tasks'],
      ...report.statusBreakdown.map(row => [statusNames[row.status] || row.status, row.count]),
      [],
      ['Priority', 'Tasks'],
      ...report.priorityBreakdown.map(row => [priorityNames[row.priority] || row.priority, row.count]),
      [],
      ['Category', 'Tasks'],
      ...report.categoryBreakdown.map(row => [row.category, row.count]),
      [],
      ['Employee', 'Active account', 'Assigned tasks', 'Completed', 'Overdue']
    ];
    rows.push(...report.assigneeBreakdown.map(row => [
      row.assigneeName,
      row.active ? 'Yes' : 'No',
      row.totalTasks,
      row.completedTasks,
      row.overdueTasks
    ]));
    const csv = rows.map(row => row.map(csvCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `employeems-task-report-${report.range.from}-to-${report.range.to}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const summary = report?.summary;
  const completionRate = summary?.totalTasks
    ? Math.round((summary.completedTasks / summary.totalTasks) * 100)
    : 0;

  return (
    <section className="dashboard-section space-y-4" aria-labelledby="task-reports-heading">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:flex-row sm:items-end sm:justify-between sm:p-6">
        <div>
          <div className="flex items-center gap-2 text-indigo-600">
            <FaChartColumn aria-hidden="true" />
            <p className="text-[10px] font-bold uppercase tracking-[0.14em]">Workspace insights</p>
          </div>
          <h2 id="task-reports-heading" className="mt-1 text-lg font-bold tracking-tight text-slate-900">Task reports</h2>
          <p className="mt-1 text-xs text-slate-500">Current task outcomes for tasks created within the selected period.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-[10px] font-semibold text-slate-500">
            Created from
            <input type="date" name="from" value={range.from} max={range.to} onChange={updateRange} className="mt-1 block rounded-lg border border-slate-200 px-2.5 py-2 text-xs text-slate-700" />
          </label>
          <label className="text-[10px] font-semibold text-slate-500">
            Created through
            <input type="date" name="to" value={range.to} min={range.from} onChange={updateRange} className="mt-1 block rounded-lg border border-slate-200 px-2.5 py-2 text-xs text-slate-700" />
          </label>
          <button type="button" onClick={downloadCsv} disabled={!report || loading} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
            <FaDownload aria-hidden="true" /> Export CSV
          </button>
        </div>
      </div>

      {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}
      {loading && !report ? (
        <p role="status" className="rounded-2xl border border-slate-100 bg-white p-8 text-center text-xs text-slate-500">Loading task report…</p>
      ) : report && (
        <>
          <p className="text-[10px] text-slate-500" aria-live="polite">
            {loading ? 'Updating report… ' : ''}Showing tasks created {report.range.from} through {report.range.to}. Archived tasks are excluded.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ['Tasks in period', summary.totalTasks, 'bg-indigo-50 text-indigo-700'],
              ['Completed', `${completionRate}%`, 'bg-emerald-50 text-emerald-700'],
              ['In progress', summary.activeTasks, 'bg-sky-50 text-sky-700'],
              ['Overdue open', summary.overdueTasks, summary.overdueTasks ? 'bg-rose-50 text-rose-700' : 'bg-slate-50 text-slate-600']
            ].map(([label, value, style]) => (
              <article key={label} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
                <p className={`mt-3 inline-flex rounded-xl px-3 py-1.5 text-2xl font-bold tabular-nums ${style}`}>{value}</p>
              </article>
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Breakdown title="Task status" rows={report.statusBreakdown} labelFor={row => statusNames[row.status] || row.status} total={summary.totalTasks} tone="bg-indigo-500" />
            <Breakdown title="Priority mix" rows={report.priorityBreakdown} labelFor={row => priorityNames[row.priority] || row.priority} total={summary.totalTasks} tone="bg-amber-500" />
            <Breakdown title="Top categories" rows={report.categoryBreakdown} labelFor={row => row.category} total={summary.totalTasks} tone="bg-cyan-500" />
            <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
              <div className="border-b border-slate-100 p-5">
                <h3 className="text-sm font-bold text-slate-800">Team workload</h3>
                <p className="mt-1 text-[10px] text-slate-500">Tasks created in this period by current assignee.</p>
              </div>
              {report.assigneeBreakdown.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[440px] text-left text-xs">
                    <thead className="bg-slate-50 text-[9px] font-bold uppercase tracking-wider text-slate-500">
                      <tr><th scope="col" className="px-4 py-3">Employee</th><th scope="col" className="px-3 py-3">Assigned</th><th scope="col" className="px-3 py-3">Completed</th><th scope="col" className="px-4 py-3">Overdue</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {report.assigneeBreakdown.map(row => (
                        <tr key={row.assigneeId}>
                          <td className="px-4 py-3 font-semibold text-slate-700">{row.assigneeName}{!row.active && <span className="ml-1 text-[9px] font-medium text-slate-400">(inactive)</span>}</td>
                          <td className="px-3 py-3 tabular-nums text-slate-600">{row.totalTasks}</td>
                          <td className="px-3 py-3 tabular-nums text-emerald-700">{row.completedTasks}</td>
                          <td className={`px-4 py-3 tabular-nums ${row.overdueTasks ? 'font-bold text-rose-600' : 'text-slate-600'}`}>{row.overdueTasks}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p className="p-5 text-xs text-slate-500">No assigned tasks in this period.</p>}
            </section>
          </div>
        </>
      )}
    </section>
  );
}

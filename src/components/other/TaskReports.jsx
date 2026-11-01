import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FaChartColumn, FaDownload } from 'react-icons/fa6';
import { getTaskReportApi } from '../../api';
import PdfExportButton from './PdfExportButton';

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
    <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs">
      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">{title}</h3>
      {rows.length ? (
        <ul className="mt-4 space-y-3.5">
          {rows.map((row, index) => {
            const count = Number(row.count);
            const width = total ? Math.max((count / total) * 100, count ? 4 : 0) : 0;
            return (
              <li key={`${labelFor(row)}-${index}`}>
                <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                  <span className="truncate font-semibold text-slate-700">{labelFor(row)}</span>
                  <span className="shrink-0 font-bold tabular-nums text-slate-900">{count}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full rounded-full transition-all duration-500 ${tone}`} style={{ width: `${width}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      ) : <p className="mt-4 text-xs text-slate-400">No task data recorded in this period.</p>}
    </section>
  );
}

export default function TaskReports() {
  const reportRef = useRef(null);
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
    <section ref={reportRef} className="dashboard-section space-y-4" aria-labelledby="task-reports-heading">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm sm:flex-row sm:items-end sm:justify-between sm:p-6">
        <div>
          <div className="flex items-center gap-1.5 text-indigo-600">
            <FaChartColumn aria-hidden="true" className="text-xs" />
            <p className="text-[10px] font-bold uppercase tracking-wider">Analytics & Trends</p>
          </div>
          <h2 id="task-reports-heading" className="mt-1 text-base sm:text-lg font-bold tracking-tight text-slate-900">Task Performance Reports</h2>
          <p className="mt-0.5 text-xs text-slate-500">Outcomes and velocity for deliverables created within the selected date window.</p>
        </div>
        <div className="print-export-control flex flex-wrap items-end gap-2.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            From
            <input 
              type="date" 
              name="from" 
              value={range.from} 
              max={range.to} 
              onChange={updateRange} 
              className="mt-1 block rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 shadow-xs focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" 
            />
          </label>
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            To
            <input 
              type="date" 
              name="to" 
              value={range.to} 
              min={range.from} 
              onChange={updateRange} 
              className="mt-1 block rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 shadow-xs focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" 
            />
          </label>
          <button 
            type="button" 
            onClick={downloadCsv} 
            disabled={!report || loading} 
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-xs transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FaDownload aria-hidden="true" className="text-xs text-slate-400" /> 
            <span>Export CSV</span>
          </button>
          <PdfExportButton targetRef={reportRef} />
        </div>
      </div>

      {error && <p role="alert" className="rounded-xl border border-rose-100 bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}

      {loading && !report ? (
        <div role="status" className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-400">
          <span className="mx-auto block h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent mb-2" />
          <p className="text-xs">Compiling reporting insights…</p>
        </div>
      ) : report && (
        <div className="space-y-4 animate-fade-in">
          <p className="text-[11px] text-slate-500" aria-live="polite">
            {loading ? 'Updating report… ' : ''}Analyzing tasks created {report.range.from} through {report.range.to}.
          </p>
          <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ['Tasks Created', summary.totalTasks, 'text-indigo-600', 'bg-indigo-50/70 border-indigo-100'],
              ['Completion Rate', `${completionRate}%`, 'text-emerald-600', 'bg-emerald-50/70 border-emerald-100'],
              ['In Progress', summary.activeTasks, 'text-violet-600', 'bg-violet-50/70 border-violet-100'],
              ['Overdue Open', summary.overdueTasks, summary.overdueTasks ? 'text-rose-600' : 'text-slate-700', summary.overdueTasks ? 'bg-rose-50/70 border-rose-100' : 'bg-slate-50/70 border-slate-200']
            ].map(([label, value, textColor, cardBg]) => (
              <article key={label} className={`rounded-2xl border p-4 sm:p-5 shadow-xs ${cardBg}`}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
                <p className={`mt-2 text-2xl sm:text-3xl font-extrabold tracking-tight tabular-nums ${textColor}`}>{value}</p>
              </article>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Breakdown title="Status Breakdown" rows={report.statusBreakdown} labelFor={row => statusNames[row.status] || row.status} total={summary.totalTasks} tone="bg-indigo-600" />
            <Breakdown title="Priority Distribution" rows={report.priorityBreakdown} labelFor={row => priorityNames[row.priority] || row.priority} total={summary.totalTasks} tone="bg-amber-500" />
            <Breakdown title="Deliverable Categories" rows={report.categoryBreakdown} labelFor={row => row.category} total={summary.totalTasks} tone="bg-sky-500" />
            
            <section className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs">
              <div className="border-b border-slate-100 p-5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Team Workload Distribution</h3>
                <p className="mt-0.5 text-[11px] text-slate-400">Assigned task distribution during this period.</p>
              </div>
              {report.assigneeBreakdown.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[440px] text-left text-xs">
                    <thead className="bg-slate-50/70 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100">
                      <tr>
                        <th scope="col" className="px-4 py-2.5">Employee</th>
                        <th scope="col" className="px-3 py-2.5 text-center">Assigned</th>
                        <th scope="col" className="px-3 py-2.5 text-center">Completed</th>
                        <th scope="col" className="px-4 py-2.5 text-center">Overdue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {report.assigneeBreakdown.map(row => (
                        <tr key={row.assigneeId} className="hover:bg-slate-50/60">
                          <td className="px-4 py-3 font-semibold text-slate-800">
                            {row.assigneeName}
                            {!row.active && <span className="ml-1 text-[10px] font-normal text-slate-400">(inactive)</span>}
                          </td>
                          <td className="px-3 py-3 text-center tabular-nums text-slate-700">{row.totalTasks}</td>
                          <td className="px-3 py-3 text-center tabular-nums font-semibold text-emerald-700">{row.completedTasks}</td>
                          <td className={`px-4 py-3 text-center tabular-nums ${row.overdueTasks ? 'font-bold text-rose-600' : 'text-slate-500'}`}>
                            {row.overdueTasks}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p className="p-8 text-center text-xs text-slate-400">No assigned deliverables in this timeframe.</p>}
            </section>
          </div>
        </div>
      )}
    </section>
  );
}

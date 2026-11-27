import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { FaBoxArchive, FaMagnifyingGlass, FaRotateLeft, FaFilter, FaPenToSquare, FaPlay } from 'react-icons/fa6';
import { archiveTaskApi, bulkUpdateTasksApi, getTaskPageApi, updateTaskApi } from '../../api';
import { AuthContext } from '../../context/AuthProvider';
import TaskComments from './TaskComments';
import CalendarExportButton from './CalendarExportButton';
import './TaskManagement.css';

const statusNames = { new: 'New', active: 'In progress', completed: 'Completed', failed: 'Needs attention' };
const statusStyles = {
  new: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200/50',
  active: 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200/50',
  completed: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/50',
  failed: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200/50'
};
const taskStatus = task => task.completed ? 'completed' : task.failed ? 'failed' : task.active ? 'active' : 'new';
const taskPageSize = 50;
const defaultFilters = { q: '', status: '', priority: '', assignee: '', dueAfter: '', dueBefore: '' };
function readSavedView(storageKey) {
  if (!storageKey) return null;
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey));
    if (!stored || !stored.filters) return null;
    const filters = Object.fromEntries(Object.entries(defaultFilters).map(([name, fallback]) => [name, typeof stored.filters[name] === 'string' ? stored.filters[name] : fallback]));
    return { filters, includeArchived: stored.includeArchived === true };
  } catch {
    return null;
  }
}
const emailStatusText = status => status === 'sent'
  ? 'sent'
  : status === 'not_configured'
    ? 'not configured'
    : status === 'no_recipients'
      ? 'not sent (no other active recipients)'
      : `failed (${status})`;
const toForm = task => ({
  taskTitle: task.taskTitle,
  taskDescription: task.taskDescription,
  taskDate: task.taskDate,
  category: task.category,
  assignedTo: String(task.assignedTo),
  priority: task.priority || 'medium'
});

export default function TaskManagement({ initialTaskId, taskSource }) {
  const { userData, refresh, updateTaskStatus, currentUser } = useContext(AuthContext);
  const storageKey = currentUser?.companyId && currentUser?.id ? `ems_task_view_${currentUser.companyId}_${currentUser.id}` : null;
  const [savedView, setSavedView] = useState(() => readSavedView(storageKey));
  const [tasks, setTasks] = useState([]);
  const [filters, setFilters] = useState(() => ({
    taskId: initialTaskId || '', ...defaultFilters
  }));
  const [includeArchived, setIncludeArchived] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkPriority, setBulkPriority] = useState('medium');
  const request = useRef(null);
  const criteria = useRef({ filters, includeArchived, page });

  useEffect(() => {
    setSavedView(readSavedView(storageKey));
  }, [storageKey]);

  const loadTasks = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const { filters, includeArchived, page } = criteria.current;
    setLoading(true);
    try {
      const result = await getTaskPageApi({
        ...filters,
        includeArchived: includeArchived ? 'true' : 'false', page, pageSize: taskPageSize
      }, { signal: controller.signal });
      if (controller.signal.aborted) return;
      const lastPage = Math.max(1, Math.ceil(result.total / taskPageSize));
      if (page > lastPage) {
        setPage(lastPage);
        return;
      }
      setTasks(result.tasks);
      setTotal(result.total);
      setTruncated(Boolean(result.truncated));
      setSelectedIds(current => new Set(result.tasks.filter(task => current.has(task.id)).map(task => task.id)));
      setError('');
    } catch (requestError) {
      if (!controller.signal.aborted) setError(requestError.message || 'Could not load tasks.');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    criteria.current = { filters, includeArchived, page };
    const timer = window.setTimeout(loadTasks, filters.q ? 250 : 0);
    return () => {
      window.clearTimeout(timer);
      request.current?.abort();
    };
  }, [loadTasks, filters, includeArchived, page]);

  useEffect(() => {
    window.addEventListener('ems:workspace-updated', loadTasks);
    return () => window.removeEventListener('ems:workspace-updated', loadTasks);
  }, [loadTasks]);

  const startEdit = (task, clearAssignee = false) => {
    setEditingId(task.id);
    setEditForm({ ...toForm(task), ...(clearAssignee && { assignedTo: '' }) });
    setError('');
    setNotice('');
  };

  const saveEdit = async event => {
    event.preventDefault();
    setBusyId(editingId);
    setError('');
    setNotice('');
    try {
      const previousTask = tasks.find(task => task.id === editingId);
      const restoreArchived = previousTask?.archived === true;
      const updated = await updateTaskApi(editingId, { ...editForm, assignedTo: Number(editForm.assignedTo), restoreArchived });
      setEditingId(null);
      setEditForm(null);
      const emailAction = previousTask?.assignedTo !== Number(editForm.assignedTo) ? 'reassigned' : 'updated';
      const emailNotes = [];
      if (updated.emailStatus) emailNotes.push(`${emailAction} email ${emailStatusText(updated.emailStatus)}`);
      if (updated.dueDateEmailStatus) emailNotes.push(`due-date email ${emailStatusText(updated.dueDateEmailStatus)}`);
      const message = restoreArchived ? 'Task reassigned and restored' : 'Task updated';
      setNotice(emailNotes.length ? `${message}; ${emailNotes.join('; ')}.` : `${message}.`);
      await loadTasks();
      try {
        await refresh();
      } catch (refreshError) {
        setError(`Task updated, but the team summary could not refresh: ${refreshError.message}`);
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyId(null);
    }
  };

  const toggleArchive = async task => {
    setBusyId(task.id);
    setError('');
    setNotice('');
    try {
      const archived = !task.archived;
      await archiveTaskApi(task.id, archived);
      setNotice(archived ? 'Task archived.' : 'Task restored.');
      await loadTasks();
      try {
        await refresh();
      } catch (refreshError) {
        setError(`Task status changed, but the team summary could not refresh: ${refreshError.message}`);
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyId(null);
    }
  };

  const resumeTask = async task => {
    setBusyId(task.id);
    setError('');
    setNotice('');
    try {
      await updateTaskStatus(task.id, 'active', 'failed');
      await loadTasks();
      setNotice('Task moved to In progress.');
    } catch (requestError) {
      setError(requestError.message || 'Could not resume this task.');
    } finally {
      setBusyId(null);
    }
  };

  const updateFilter = event => {
    const { name, value } = event.target;
    resetPage(1);
    setFilters(current => ({ ...current, taskId: '', [name]: value }));
  };

  function resetPage(nextPage) {
    request.current?.abort();
    setLoading(true);
    setTasks([]);
    setSelectedIds(new Set());
    setEditingId(null);
    setEditForm(null);
    setError('');
    setPage(nextPage);
  }

  const saveView = () => {
    const { q, status, priority, assignee, dueAfter, dueBefore } = filters;
    const view = { filters: { q, status, priority, assignee, dueAfter, dueBefore }, includeArchived };
    try {
      localStorage.setItem(storageKey, JSON.stringify(view));
      setSavedView(view);
      setNotice('Task view saved on this browser.');
    } catch {
      setError('Could not save your task view on this browser.');
    }
  };

  const restoreView = () => {
    if (!savedView) return;
    resetPage(1);
    setFilters({ taskId: '', ...savedView.filters });
    setIncludeArchived(savedView.includeArchived);
    setNotice('Saved task view restored.');
  };

  const clearView = () => {
    try {
      localStorage.removeItem(storageKey);
      setSavedView(null);
      setNotice('Saved task view cleared.');
    } catch {
      setError('Could not clear your saved task view.');
    }
  };

  const runBulkAction = async (action, priority) => {
    const taskIds = [...selectedIds];
    if (!taskIds.length) return;
    setBusyId('bulk');
    setError('');
    setNotice('');
    try {
      const result = await bulkUpdateTasksApi({ taskIds, action, ...(priority ? { priority } : {}) });
      setSelectedIds(new Set());
      const actionLabel = action === 'priority' ? 'updated' : action === 'archive' ? 'archived' : 'restored';
      const skipped = action === 'restore'
        ? 'already restored, unavailable, or assigned to an inactive employee. Reassign open work before restoring it'
        : 'unavailable or already in that state';
      setNotice(`${result.updatedCount} of ${result.requestedCount} selected task${result.requestedCount === 1 ? '' : 's'} ${actionLabel}${result.skippedCount ? `. Skipped ${result.skippedCount} ${result.skippedCount === 1 ? 'task' : 'tasks'} ${skipped}` : ''}.`);
      await loadTasks();
      try {
        await refresh();
      } catch (refreshError) {
        setError(`Tasks were updated, but the team summary could not refresh: ${refreshError.message}`);
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyId(null);
    }
  };

  const toggleTaskSelection = (taskId, selected) => {
    setSelectedIds(current => {
      const next = new Set(current);
      if (selected && next.size < taskPageSize) next.add(taskId);
      else next.delete(taskId);
      return next;
    });
  };

  const activeEmployees = (userData || []).filter(employee => employee.active);
  const employeesById = new Map((userData || []).map(employee => [employee.id, employee]));
  const allVisibleSelected = tasks.length > 0 && tasks.every(task => selectedIds.has(task.id));
  const pageCount = Math.max(1, Math.ceil(total / taskPageSize));

  return (
    <section className="dashboard-card overflow-hidden rounded-2xl shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6 bg-white">
        <div>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-indigo-600">
            <FaFilter className="text-[10px]" /> Pipeline
          </span>
          <h2 className="dashboard-card-heading mt-1 text-slate-900">Task Management</h2>
          <p className="mt-0.5 text-xs text-slate-500">Filter, edit assignments, prioritize, and manage task lifecycle.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <CalendarExportButton tasks={tasks} label={pageCount > 1 ? 'Add this page to calendar' : undefined} />
          <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 cursor-pointer">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={event => { resetPage(1); setIncludeArchived(event.target.checked); }}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span>Show archived</span>
          </label>
        </div>
      </div>

      {filters.taskId && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3 sm:px-6">
          <p className="text-sm font-semibold text-slate-700">{taskSource ? `Viewing a task from ${taskSource}` : 'Viewing a single task'}</p>
          <button type="button" className="workspace-action workspace-action--secondary"
            onClick={() => { resetPage(1); setFilters(current => ({ ...current, taskId: '' })); }}>
            Show all tasks
          </button>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-4 bg-slate-50/50">
        <label className="relative sm:col-span-2">
          <span className="sr-only">Search tasks</span>
          <FaMagnifyingGlass aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400" />
          <input 
            name="q" 
            value={filters.q} 
            onChange={updateFilter} 
            maxLength={120} 
            placeholder="Search tasks, descriptions, or categories…" 
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 placeholder-slate-400 shadow-xs focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" 
          />
        </label>

        <label>
          <span className="sr-only">Filter by status</span>
          <select 
            name="status" 
            value={filters.status} 
            onChange={updateFilter} 
            className="w-full rounded-xl border border-slate-200 bg-white py-2 text-xs text-slate-900 shadow-xs focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="">All statuses</option>
            {Object.entries(statusNames).map(([value, name]) => <option key={value} value={value}>{name}</option>)}
          </select>
        </label>

        <label>
          <span className="sr-only">Filter by priority</span>
          <select 
            name="priority" 
            value={filters.priority} 
            onChange={updateFilter} 
            className="w-full rounded-xl border border-slate-200 bg-white py-2 text-xs text-slate-900 shadow-xs focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="">All priorities</option>
            <option value="high">High priority</option>
            <option value="medium">Medium priority</option>
            <option value="low">Low priority</option>
          </select>
        </label>

        <label className="sm:col-span-2 lg:col-span-2">
          <span className="sr-only">Filter by employee</span>
          <select 
            name="assignee" 
            value={filters.assignee} 
            onChange={updateFilter} 
            className="w-full rounded-xl border border-slate-200 bg-white py-2 text-xs text-slate-900 shadow-xs focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="">All teammates</option>
            {(userData || []).map(employee => (
              <option key={employee.id} value={employee.id}>
                {employee.firstName} {employee.active ? '' : '(inactive)'}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="mb-1 block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Due After</span>
          <input 
            type="date" 
            name="dueAfter" 
            value={filters.dueAfter} 
            onChange={updateFilter} 
            className="w-full rounded-xl border border-slate-200 bg-white py-1.5 px-3 text-xs text-slate-900 shadow-xs focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" 
          />
        </label>

        <label>
          <span className="mb-1 block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Due Before</span>
          <input 
            type="date" 
            name="dueBefore" 
            value={filters.dueBefore} 
            onChange={updateFilter} 
            className="w-full rounded-xl border border-slate-200 bg-white py-1.5 px-3 text-xs text-slate-900 shadow-xs focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" 
          />
        </label>
        {storageKey && (
          <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-4">
            <button type="button" className="workspace-action workspace-action--secondary" disabled={Boolean(filters.taskId) || busyId !== null} onClick={saveView}>Save current view</button>
            {savedView && (
              <>
                <button type="button" className="workspace-action workspace-action--secondary" disabled={busyId !== null} onClick={restoreView}>Restore saved view</button>
                <button type="button" className="workspace-action workspace-action--secondary" onClick={clearView}>Clear saved view</button>
              </>
            )}
          </div>
        )}
      </div>

      {error && <p role="alert" className="mx-5 mb-4 rounded-xl border border-rose-100 bg-rose-50 p-3 text-xs text-rose-700 sm:mx-6">{error}</p>}
      {notice && <p role="status" className="mx-5 mb-4 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-xs text-emerald-800 sm:mx-6">{notice}</p>}

      {tasks.length > 0 && !loading && (
        <nav aria-label="Task pages" className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-5 py-3 text-xs text-slate-700 sm:px-6">
          <p role="status">Showing {(page - 1) * taskPageSize + 1}–{(page - 1) * taskPageSize + tasks.length} of {truncated ? 'at least ' : ''}{total} matching {total === 1 ? 'task' : 'tasks'}</p>
          {pageCount > 1 && (
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="workspace-action workspace-action--secondary" onClick={() => resetPage(page - 1)} disabled={page === 1 || busyId !== null}>Previous</button>
              <span>Page {page} of {pageCount}</span>
              <button type="button" className="workspace-action workspace-action--secondary" onClick={() => resetPage(page + 1)} disabled={page === pageCount || busyId !== null}>Next</button>
            </div>
          )}
        </nav>
      )}

      {/* Bulk Action Bar */}
      {tasks.length > 0 && !loading && (
        <div className="flex flex-col gap-3 border-t border-slate-100 bg-indigo-50/40 px-5 py-3 sm:flex-row sm:items-center sm:px-6">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <label className="inline-flex min-h-10 items-center gap-2">
              <input
                type="checkbox"
                aria-label="Select all visible tasks"
                checked={allVisibleSelected}
                onChange={event => setSelectedIds(event.target.checked ? new Set(tasks.slice(0, taskPageSize).map(task => task.id)) : new Set())}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              Select page
            </label>
            <span>· {selectedIds.size} selected</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button 
              type="button" 
              onClick={() => runBulkAction('archive')} 
              disabled={!selectedIds.size || busyId !== null}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 disabled:opacity-50"
            >
              <FaBoxArchive aria-hidden="true" className="text-xs text-slate-400" />
              <span>Archive</span>
            </button>
            <button 
              type="button" 
              onClick={() => runBulkAction('restore')} 
              disabled={!selectedIds.size || busyId !== null}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 disabled:opacity-50"
            >
              <FaRotateLeft aria-hidden="true" className="text-xs text-slate-400" />
              <span>Restore</span>
            </button>
            <label className="sr-only" htmlFor="bulk-task-priority">Set priority for selected tasks</label>
            <select 
              id="bulk-task-priority" 
              value={bulkPriority} 
              onChange={event => setBulkPriority(event.target.value)} 
              className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 shadow-xs"
            >
              <option value="high">High priority</option>
              <option value="medium">Medium priority</option>
              <option value="low">Low priority</option>
            </select>
            <button 
              type="button" 
              onClick={() => runBulkAction('priority', bulkPriority)} 
              disabled={!selectedIds.size || busyId !== null}
              className="rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50"
            >
              Apply Priority
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div role="status" className="border-t border-slate-100 p-10 text-center text-slate-400">
          <span className="mx-auto block h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent mb-2" />
          <p className="text-xs">Loading tasks…</p>
        </div>
      ) : !tasks.length ? (
        <div className="border-t border-slate-100 p-10 text-center text-slate-400">
          <p className="text-sm font-medium">{error ? 'Task results could not be loaded.' : 'No tasks match these filters.'}</p>
          {error && <button type="button" className="workspace-action workspace-action--secondary mt-3" onClick={loadTasks}>Retry</button>}
        </div>
      ) : (
        <div className="border-t border-slate-100 sm:overflow-x-auto">
          <table role="table" aria-label="Matching tasks" className="task-hub-table w-full text-left sm:min-w-[760px]">
            <thead role="rowgroup" className="sr-only sm:not-sr-only">
              <tr role="row" className="bg-slate-50/70 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <th scope="col" role="columnheader" className="px-4 py-3"><span className="sr-only">Selection</span></th>
                <th scope="col" role="columnheader" className="px-5 py-3 sm:px-6">Task</th>
                <th scope="col" role="columnheader" className="px-4 py-3">Owner</th>
                <th scope="col" role="columnheader" className="px-4 py-3">Due</th>
                <th scope="col" role="columnheader" className="px-4 py-3">Priority</th>
                <th scope="col" role="columnheader" className="px-4 py-3">Status</th>
                <th scope="col" role="columnheader" className="px-5 py-3 sm:px-6">Actions</th>
              </tr>
            </thead>
            <tbody role="rowgroup" className="divide-y divide-slate-100 bg-white text-xs">
              {tasks.map(task => {
                const status = taskStatus(task);
                const assignee = employeesById.get(task.assignedTo);
                const needsNewAssignee = !assignee?.active && (task.archived ? task.newTask || task.active : task.failed);
                return (
                  <React.Fragment key={task.id}>
                    <tr role="row" className={`task-hub-row ${task.archived ? 'bg-slate-50/70 opacity-70' : 'hover:bg-slate-50/60 transition-colors'}`}>
                      <td role="cell" className="task-hub-select px-4 py-3.5">
                        <input 
                          type="checkbox" 
                          aria-label={`Select ${task.taskTitle}`} 
                          checked={selectedIds.has(task.id)} 
                          onChange={event => toggleTaskSelection(task.id, event.target.checked)} 
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" 
                        />
                      </td>
                      <td role="cell" className="task-hub-summary max-w-[280px] px-5 py-3.5 sm:px-6">
                        <p className="truncate text-xs font-bold text-slate-900">{task.taskTitle}</p>
                        <p title={task.taskDescription} className="mt-0.5 max-w-[240px] truncate text-[11px] text-slate-500">{task.taskDescription}</p>
                        <p className="mt-1 truncate text-[10px] text-indigo-600 font-semibold">{task.category}{task.archived ? ' · Archived' : ''}</p>
                      </td>
                      <td role="cell" className="px-4 py-3.5 text-xs font-medium text-slate-700">
                        <span className="task-hub-meta sm:hidden" aria-hidden="true">Owner</span>
                        {assignee?.firstName || 'Former employee'}
                        {assignee && !assignee.active && <span className="block text-[10px] text-slate-500">Inactive</span>}
                      </td>
                      <td role="cell" className={`whitespace-nowrap px-4 py-3.5 text-xs ${task.overdue ? 'font-bold text-rose-600' : 'text-slate-600'}`}>
                        <span className="task-hub-meta sm:hidden" aria-hidden="true">Due</span>
                        {task.taskDate}
                        {task.overdue && <span className="ml-1.5 inline-block rounded-sm bg-rose-100 px-1 py-0.5 text-[9px] uppercase font-extrabold text-rose-700">Overdue</span>}
                      </td>
                      <td role="cell" className="px-4 py-3.5 text-xs capitalize text-slate-600">
                        <span className="task-hub-meta sm:hidden" aria-hidden="true">Priority</span>
                        <span className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold ${
                          task.priority === 'high' ? 'bg-rose-50 text-rose-700' : task.priority === 'medium' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {task.priority || 'medium'}
                        </span>
                      </td>
                      <td role="cell" className="px-4 py-3.5">
                        <span className="task-hub-meta sm:hidden" aria-hidden="true">Status</span>
                        <span className={`whitespace-nowrap rounded-lg px-2.5 py-1 text-[10px] font-bold ${statusStyles[status]}`}>
                          {statusNames[status]}
                        </span>
                      </td>
                      <td role="cell" className="task-hub-actions px-5 py-3.5 sm:px-6">
                        <div className="flex items-center gap-2.5">
                          {(!task.archived || needsNewAssignee) && (
                            <button 
                              type="button" 
                              onClick={() => startEdit(task, !assignee?.active)}
                              disabled={busyId !== null}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800"
                            >
                              <FaPenToSquare className="text-[10px]" />
                              <span>{task.archived ? 'Reassign and restore' : needsNewAssignee ? 'Reassign' : 'Edit'}</span>
                            </button>
                          )}
                          {!task.archived && status === 'failed' && !needsNewAssignee && (
                            <button type="button" onClick={() => resumeTask(task)} disabled={busyId !== null}
                              className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-bold text-indigo-600 hover:text-indigo-800 disabled:opacity-50">
                              <FaPlay className="text-[10px]" aria-hidden="true" /> Resume work
                            </button>
                          )}
                          {(!task.archived || !needsNewAssignee) && <button
                            type="button" 
                            onClick={() => toggleArchive(task)} 
                            disabled={busyId !== null}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-slate-800 disabled:opacity-50"
                          >
                            {task.archived ? <FaRotateLeft className="text-[10px]" aria-hidden="true" /> : <FaBoxArchive className="text-[10px]" aria-hidden="true" />}
                            <span>{task.archived ? 'Restore' : 'Archive'}</span>
                          </button>}
                        </div>
                        {!task.archived && needsNewAssignee && <p className="mt-1 text-[10px] text-slate-500">Reassign to an active employee to resume.</p>}
                      </td>
                    </tr>
                    {editingId === task.id && editForm && (
                      <tr role="row" className="task-hub-detail">
                        <td role="cell" colSpan={7} className="border-t border-b border-indigo-100 bg-indigo-50/50 p-5 sm:px-6 animate-fade-in">
                          <form onSubmit={saveEdit} className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
                            <label className="text-xs font-bold text-slate-700 sm:col-span-2 lg:col-span-1">Title
                              <input 
                                required 
                                minLength={2} 
                                maxLength={160} 
                                value={editForm.taskTitle} 
                                onChange={event => setEditForm(current => ({ ...current, taskTitle: event.target.value }))} 
                                className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2 text-xs" 
                              />
                            </label>
                            <label className="text-xs font-bold text-slate-700">Assignee
                              <select 
                                required 
                                value={editForm.assignedTo} 
                                onChange={event => setEditForm(current => ({ ...current, assignedTo: event.target.value }))} 
                                className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2 text-xs"
                              >
                                <option value="">Select an active employee</option>
                                {activeEmployees.map(employee => <option key={employee.id} value={employee.id}>{employee.firstName}</option>)}
                              </select>
                            </label>
                            <label className="text-xs font-bold text-slate-700">Due date
                              <input 
                                type="date" 
                                required 
                                value={editForm.taskDate} 
                                onChange={event => setEditForm(current => ({ ...current, taskDate: event.target.value }))} 
                                className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2 text-xs" 
                              />
                            </label>
                            <label className="text-xs font-bold text-slate-700">Category
                              <input 
                                required 
                                minLength={2} 
                                maxLength={80} 
                                value={editForm.category} 
                                onChange={event => setEditForm(current => ({ ...current, category: event.target.value }))} 
                                className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2 text-xs" 
                              />
                            </label>
                            <label className="text-xs font-bold text-slate-700">Priority
                              <select 
                                value={editForm.priority} 
                                onChange={event => setEditForm(current => ({ ...current, priority: event.target.value }))} 
                                className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2 text-xs"
                              >
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                              </select>
                            </label>
                            <label className="text-xs font-bold text-slate-700 sm:col-span-2 lg:col-span-3">Description
                              <textarea 
                                required 
                                minLength={2} 
                                maxLength={4000} 
                                rows={3} 
                                value={editForm.taskDescription} 
                                onChange={event => setEditForm(current => ({ ...current, taskDescription: event.target.value }))} 
                                className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs" 
                              />
                            </label>
                            <div className="flex gap-2 sm:col-span-2 lg:col-span-3">
                              <button 
                                type="submit" 
                                disabled={busyId === task.id} 
                                className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50"
                              >
                                {busyId === task.id ? 'Saving…' : task.archived ? 'Reassign and restore' : 'Save Changes'}
                              </button>
                              <button 
                                type="button" 
                                onClick={() => { setEditingId(null); setEditForm(null); }} 
                                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                              >
                                Cancel
                              </button>
                            </div>
                          </form>
                        </td>
                      </tr>
                    )}
                    {!task.archived && (
                      <tr role="row" className="task-hub-detail">
                        <td role="cell" colSpan={7} className="px-5 pb-3.5 sm:px-6 bg-white/40">
                          <div className="max-w-2xl">
                            <TaskComments taskId={task.id} />
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
          {tasks.length === 200 && (
            <p className="border-t border-slate-100 px-5 py-3 text-[11px] text-slate-500">
              Showing the first 200 results. Narrow your search to find other tasks.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

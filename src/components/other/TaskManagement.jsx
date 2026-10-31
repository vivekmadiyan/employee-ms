import React, { useCallback, useContext, useEffect, useState } from 'react';
import { FaBoxArchive, FaMagnifyingGlass, FaRotateLeft } from 'react-icons/fa6';
import { archiveTaskApi, getTasksApi, updateTaskApi } from '../../api';
import { AuthContext } from '../../context/AuthProvider';
import TaskComments from './TaskComments';

const statusNames = { new: 'New', active: 'In progress', completed: 'Completed', failed: 'Needs attention' };
const statusStyles = {
  new: 'bg-sky-50 text-sky-700',
  active: 'bg-indigo-50 text-indigo-700',
  completed: 'bg-emerald-50 text-emerald-700',
  failed: 'bg-rose-50 text-rose-700'
};
const taskStatus = task => task.completed ? 'completed' : task.failed ? 'failed' : task.active ? 'active' : 'new';
const toForm = task => ({
  taskTitle: task.taskTitle,
  taskDescription: task.taskDescription,
  taskDate: task.taskDate,
  category: task.category,
  assignedTo: String(task.assignedTo),
  priority: task.priority || 'medium'
});

export default function TaskManagement() {
  const { userData, refresh } = useContext(AuthContext);
  const [tasks, setTasks] = useState([]);
  const [filters, setFilters] = useState({ q: '', status: '', priority: '', assignee: '', dueAfter: '', dueBefore: '' });
  const [includeArchived, setIncludeArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getTasksApi({
        ...filters,
        includeArchived: includeArchived ? 'true' : 'false'
      });
      setTasks(result);
      setError('');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [filters, includeArchived]);

  useEffect(() => {
    const timer = window.setTimeout(loadTasks, filters.q ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [loadTasks, filters.q]);

  const startEdit = task => {
    setEditingId(task.id);
    setEditForm(toForm(task));
    setError('');
    setNotice('');
  };

  const saveEdit = async event => {
    event.preventDefault();
    setBusyId(editingId);
    setError('');
    setNotice('');
    try {
      const updated = await updateTaskApi(editingId, { ...editForm, assignedTo: Number(editForm.assignedTo) });
      setEditingId(null);
      setEditForm(null);
      setNotice(updated.emailStatus
        ? updated.emailSent
          ? 'Task reassigned and an email was sent to the new owner.'
          : updated.emailStatus === 'not_configured'
            ? 'Task reassigned, but assignment email is not configured.'
            : `Task reassigned, but email delivery failed (${updated.emailStatus}).`
        : 'Task updated.');
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
    const action = task.archived ? 'restore' : 'archive';
    if (!window.confirm(`${action === 'archive' ? 'Archive' : 'Restore'} “${task.taskTitle}”?`)) return;
    setBusyId(task.id);
    setError('');
    setNotice('');
    try {
      await archiveTaskApi(task.id, !task.archived);
      setNotice(task.archived ? 'Task restored.' : 'Task archived.');
      await loadTasks();
      try {
        await refresh();
      } catch (refreshError) {
        setError(`Task ${action}d, but the team summary could not refresh: ${refreshError.message}`);
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyId(null);
    }
  };

  const updateFilter = event => {
    const { name, value } = event.target;
    setFilters(current => ({ ...current, [name]: value }));
  };

  const activeEmployees = (userData || []).filter(employee => employee.active);

  return (
    <section className="dashboard-card overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-600">Stay in control</p>
          <h2 className="dashboard-card-heading mt-1">Task management</h2>
          <p className="mt-1 text-xs text-slate-500">Search, prioritize, update, and archive team work.</p>
        </div>
        <label className="inline-flex min-h-9 items-center gap-2 self-start text-xs font-semibold text-slate-600 sm:self-auto">
          <input type="checkbox" checked={includeArchived} onChange={event => setIncludeArchived(event.target.checked)} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
          Show archived
        </label>
      </div>

      <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-4">
        <label className="relative sm:col-span-2">
          <span className="sr-only">Search tasks</span>
          <FaMagnifyingGlass aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400" />
          <input name="q" value={filters.q} onChange={updateFilter} maxLength="120" placeholder="Search title, description, or category" className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-xs" />
        </label>
        <label>
          <span className="sr-only">Filter by status</span>
          <select name="status" value={filters.status} onChange={updateFilter} className="w-full rounded-lg border border-slate-200 py-2.5 text-xs">
            <option value="">All statuses</option>
            {Object.entries(statusNames).map(([value, name]) => <option key={value} value={value}>{name}</option>)}
          </select>
        </label>
        <label>
          <span className="sr-only">Filter by priority</span>
          <select name="priority" value={filters.priority} onChange={updateFilter} className="w-full rounded-lg border border-slate-200 py-2.5 text-xs">
            <option value="">All priorities</option>
            <option value="high">High priority</option><option value="medium">Medium priority</option><option value="low">Low priority</option>
          </select>
        </label>
        <label>
          <span className="sr-only">Filter by employee</span>
          <select name="assignee" value={filters.assignee} onChange={updateFilter} className="w-full rounded-lg border border-slate-200 py-2.5 text-xs">
            <option value="">All employees</option>
            {(userData || []).map(employee => <option key={employee.id} value={employee.id}>{employee.firstName}{employee.active ? '' : ' (inactive)'}</option>)}
          </select>
        </label>
        <label>
          <span className="mb-1 block text-[10px] font-semibold text-slate-500">Due on or after</span>
          <input type="date" name="dueAfter" value={filters.dueAfter} onChange={updateFilter} className="w-full rounded-lg border border-slate-200 py-2 text-xs" />
        </label>
        <label>
          <span className="mb-1 block text-[10px] font-semibold text-slate-500">Due on or before</span>
          <input type="date" name="dueBefore" value={filters.dueBefore} onChange={updateFilter} className="w-full rounded-lg border border-slate-200 py-2 text-xs" />
        </label>
      </div>

      {error && <p role="alert" className="mx-5 mb-4 rounded-lg bg-rose-50 p-3 text-xs text-rose-700 sm:mx-6">{error}</p>}
      {notice && <p role="status" className="mx-5 mb-4 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800 sm:mx-6">{notice}</p>}

      {loading ? (
        <p role="status" className="border-t border-slate-100 p-8 text-center text-xs text-slate-500">Loading tasks…</p>
      ) : !tasks.length ? (
        <p className="border-t border-slate-100 p-8 text-center text-xs text-slate-500">No tasks match these filters.</p>
      ) : (
        <div className="overflow-x-auto border-t border-slate-100">
          <table className="min-w-[760px] w-full text-left">
            <thead><tr className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <th scope="col" className="px-5 py-3 sm:px-6">Task</th><th scope="col" className="px-4 py-3">Owner</th><th scope="col" className="px-4 py-3">Due</th><th scope="col" className="px-4 py-3">Priority</th><th scope="col" className="px-4 py-3">Status</th><th scope="col" className="px-5 py-3 sm:px-6">Actions</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {tasks.map(task => {
                const status = taskStatus(task);
                const assignee = (userData || []).find(employee => employee.id === task.assignedTo);
                return (
                  <React.Fragment key={task.id}>
                    <tr className={task.archived ? 'bg-slate-50/70 opacity-70' : 'hover:bg-slate-50/70'}>
                      <td className="max-w-[260px] px-5 py-4 sm:px-6">
                        <p className="truncate text-xs font-bold text-slate-800">{task.taskTitle}</p>
                        <p title={task.taskDescription} className="mt-1 max-w-[220px] truncate text-[10px] text-slate-500">{task.taskDescription}</p>
                        <p className="mt-1 truncate text-[10px] text-slate-400">{task.category}{task.archived ? ' · Archived' : ''}</p>
                      </td>
                      <td className="px-4 py-4 text-xs text-slate-600">{assignee?.firstName || 'Former employee'}</td>
                      <td className={`whitespace-nowrap px-4 py-4 text-xs ${task.overdue ? 'font-bold text-rose-600' : 'text-slate-600'}`}>{task.taskDate}{task.overdue && <span className="ml-1 text-[9px] uppercase">Overdue</span>}</td>
                      <td className="px-4 py-4 text-xs capitalize text-slate-600">{task.priority || 'medium'}</td>
                      <td className="px-4 py-4"><span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-bold ${statusStyles[status]}`}>{statusNames[status]}</span></td>
                      <td className="px-5 py-4 sm:px-6">
                        <div className="flex items-center gap-3">
                          {!task.archived && <button type="button" onClick={() => startEdit(task)} className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800">Edit</button>}
                          <button type="button" onClick={() => toggleArchive(task)} disabled={busyId === task.id} className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 disabled:opacity-50">
                            {task.archived ? <FaRotateLeft aria-hidden="true" /> : <FaBoxArchive aria-hidden="true" />}
                            {task.archived ? 'Restore' : 'Archive'}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {editingId === task.id && editForm && (
                      <tr>
                        <td colSpan="6" className="bg-indigo-50/40 px-5 py-4 sm:px-6">
                          <form onSubmit={saveEdit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            <label className="text-[10px] font-bold text-slate-600 sm:col-span-2 lg:col-span-1">Title
                              <input required minLength="2" maxLength="160" value={editForm.taskTitle} onChange={event => setEditForm(current => ({ ...current, taskTitle: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-xs" />
                            </label>
                            <label className="text-[10px] font-bold text-slate-600">Assignee
                              <select required value={editForm.assignedTo} onChange={event => setEditForm(current => ({ ...current, assignedTo: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-xs">
                                {activeEmployees.map(employee => <option key={employee.id} value={employee.id}>{employee.firstName}</option>)}
                              </select>
                            </label>
                            <label className="text-[10px] font-bold text-slate-600">Due date
                              <input type="date" required value={editForm.taskDate} onChange={event => setEditForm(current => ({ ...current, taskDate: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-xs" />
                            </label>
                            <label className="text-[10px] font-bold text-slate-600">Category
                              <input required minLength="2" maxLength="80" value={editForm.category} onChange={event => setEditForm(current => ({ ...current, category: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-xs" />
                            </label>
                            <label className="text-[10px] font-bold text-slate-600">Priority
                              <select value={editForm.priority} onChange={event => setEditForm(current => ({ ...current, priority: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-xs">
                                <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
                              </select>
                            </label>
                            <label className="text-[10px] font-bold text-slate-600 sm:col-span-2 lg:col-span-3">Description
                              <textarea required minLength="2" maxLength="4000" rows="3" value={editForm.taskDescription} onChange={event => setEditForm(current => ({ ...current, taskDescription: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-xs" />
                            </label>
                            <div className="flex gap-2 sm:col-span-2 lg:col-span-3">
                              <button type="submit" disabled={busyId === task.id} className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{busyId === task.id ? 'Saving…' : 'Save task'}</button>
                              <button type="button" onClick={() => { setEditingId(null); setEditForm(null); }} className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600">Cancel</button>
                            </div>
                          </form>
                        </td>
                      </tr>
                    )}
                    {!task.archived && <tr>
                      <td colSpan="6" className="px-5 pb-3 sm:px-6">
                        <div className="max-w-3xl"><TaskComments taskId={task.id} /></div>
                      </td>
                    </tr>}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
          {tasks.length === 200 && <p className="border-t border-slate-100 px-5 py-3 text-[10px] text-slate-500">Showing the first 200 results. Narrow your search to find other tasks.</p>}
        </div>
      )}
    </section>
  );
}

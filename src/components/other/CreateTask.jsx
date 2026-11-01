import React, { useContext, useState } from 'react';
import { FaListCheck, FaPlus } from 'react-icons/fa6';
import { AuthContext } from '../../context/AuthProvider';
import { createTaskApi } from '../../api';

const CreateTask = () => {
  const { userData, dataError, refresh } = useContext(AuthContext);
  const activeEmployees = userData?.filter(employee => employee.active) || [];
  const [busy, setBusy] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskDate, setTaskDate] = useState('');
  const [assignTo, setAssignTo] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('medium');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(null);

  const submitHandler = async (e) => {
    e.preventDefault(); setError(''); setNotice(null); setBusy(true);
    const title = taskTitle.trim(), description = taskDescription.trim(), taskCategory = category.trim();
    if (!title || !description || !taskDate || !taskCategory || !assignTo) {
      setError('Please complete all required fields.');
      setBusy(false);
      return;
    }
    try {
      const created = await createTaskApi({ taskTitle: title, taskDescription: description, taskDate, category: taskCategory, assignedTo: assignTo, priority });
      const employee = activeEmployees.find(person => String(person.id) === String(assignTo));
      setNotice({
        success: Boolean(created.emailSent),
        message: created.emailSent
          ? `Task assigned to ${employee?.firstName || 'employee'} and email sent to ${employee?.email}.`
          : created.emailStatus === 'not_configured'
            ? 'Task created successfully! (Email notifications are not configured).'
            : `Task created, but notification email could not be sent (${created.emailStatus || 'unknown error'}).`
      });
      setTaskTitle(''); setCategory(''); setAssignTo(''); setTaskDate(''); setTaskDescription(''); setPriority('medium');
      try {
        await refresh();
      } catch (refreshError) {
        console.error('Task was created but employee data failed to refresh:', refreshError);
        setError('Task created successfully, but the list could not refresh. Use Retry to reload employees.');
      }
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  if (userData === null) {
    return (
      <div className="dashboard-card p-8 text-center">
        {dataError ? (
          <>
            <p role="alert" className="text-sm font-semibold text-rose-600">{dataError}</p>
            <button 
              type="button" 
              onClick={() => refresh().catch(error => console.error('Retrying employee load failed:', error))} 
              className="mt-3 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700"
            >
              Retry loading employees
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center py-4">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent mb-2" />
            <p role="status" className="text-xs text-slate-400">Loading team…</p>
          </div>
        )}
      </div>
    );
  }

  if (activeEmployees.length === 0) {
    return (
      <div className="dashboard-card border-dashed p-8 text-center">
        <span className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
          <FaListCheck />
        </span>
        <h3 className="text-base font-bold text-slate-800">
          {userData.length ? 'Reactivate a teammate to assign tasks' : 'Invite your first teammate'}
        </h3>
        <p className="mt-1 text-xs text-slate-500">Tasks can only be assigned to active team members.</p>
      </div>
    );
  }

  return (
    <div className="dashboard-card rounded-2xl p-5 sm:p-6 shadow-sm">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-indigo-600">
            <FaListCheck className="text-[10px]" /> Delegation
          </span>
          <h2 className="dashboard-card-heading mt-1 text-slate-900">Create a Task</h2>
          <p className="mt-0.5 text-xs text-slate-500">Assign work, establish clear deadlines, and set priority.</p>
        </div>
      </div>

      <form onSubmit={submitHandler} className="space-y-4">
        {error && (
          <div role="alert" className="rounded-xl border border-rose-100 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700">
            {error}
            {dataError && (
              <button 
                type="button" 
                onClick={() => refresh().catch(retryError => console.error('Retrying employee load failed:', retryError))} 
                className="ml-2 font-bold underline"
              >
                Retry
              </button>
            )}
          </div>
        )}

        {notice && (
          <p role="status" className={`rounded-xl border px-3.5 py-2.5 text-xs font-medium ${
            notice.success 
              ? 'border-emerald-100 bg-emerald-50 text-emerald-800' 
              : 'border-amber-100 bg-amber-50 text-amber-900'
          }`}>
            {notice.message}
          </p>
        )}

        <div>
          <label htmlFor="task-title" className="block text-xs font-bold text-slate-700 mb-1">
            Task Title <span className="text-rose-500">*</span>
          </label>
          <input 
            id="task-title" 
            value={taskTitle} 
            onChange={(e) => setTaskTitle(e.target.value)} 
            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 shadow-xs focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" 
            type="text" 
            placeholder="e.g. Design authentication modal" 
            required 
          />
        </div>

        <div>
          <label htmlFor="assign-to" className="block text-xs font-bold text-slate-700 mb-1">
            Assign To <span className="text-rose-500">*</span>
          </label>
          <select 
            id="assign-to" 
            value={assignTo} 
            onChange={(e) => setAssignTo(e.target.value)} 
            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 shadow-xs focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" 
            required
          >
            <option value="" disabled>Choose an employee…</option>
            {activeEmployees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.firstName} {employee.department ? `(${employee.department})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <div>
            <label htmlFor="task-date" className="block text-xs font-bold text-slate-700 mb-1">
              Due Date <span className="text-rose-500">*</span>
            </label>
            <input 
              id="task-date" 
              value={taskDate} 
              onChange={(e) => setTaskDate(e.target.value)} 
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 shadow-xs focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" 
              type="date" 
              required 
            />
          </div>
          <div>
            <label htmlFor="task-category" className="block text-xs font-bold text-slate-700 mb-1">
              Category <span className="text-rose-500">*</span>
            </label>
            <input 
              id="task-category" 
              value={category} 
              onChange={(e) => setCategory(e.target.value)} 
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 shadow-xs focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" 
              type="text" 
              placeholder="e.g. Design, Frontend, Sales" 
              required 
            />
          </div>
        </div>

        <div>
          <label htmlFor="task-priority" className="block text-xs font-bold text-slate-700 mb-1">
            Priority Level
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'low', label: 'Low', color: 'border-slate-200 hover:border-slate-300' },
              { id: 'medium', label: 'Medium', color: 'border-amber-200 hover:border-amber-300' },
              { id: 'high', label: 'High', color: 'border-rose-200 hover:border-rose-300' },
            ].map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPriority(p.id)}
                className={`rounded-xl border py-2 text-xs font-bold transition-all ${
                  priority === p.id 
                    ? p.id === 'high' ? 'bg-rose-50 border-rose-400 text-rose-700 shadow-xs' : p.id === 'medium' ? 'bg-amber-50 border-amber-400 text-amber-800 shadow-xs' : 'bg-slate-100 border-slate-400 text-slate-800 shadow-xs'
                    : 'bg-white text-slate-500 ' + p.color
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="task-description" className="block text-xs font-bold text-slate-700 mb-1">
            Task Description <span className="text-rose-500">*</span>
          </label>
          <textarea 
            id="task-description" 
            value={taskDescription} 
            onChange={(e) => setTaskDescription(e.target.value)} 
            rows={3}
            placeholder="Add requirements, context, and expected deliverable details…" 
            className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-900 placeholder-slate-400 shadow-xs focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" 
            required 
          />
        </div>

        <button 
          type="submit" 
          disabled={busy} 
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 py-2.5 px-4 text-xs font-bold text-white shadow-sm shadow-indigo-600/25 transition-all hover:from-indigo-500 hover:to-indigo-600 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
        >
          <FaPlus className="text-[10px]" />
          <span>{busy ? 'Creating task…' : 'Create Task'}</span>
        </button>
      </form>
    </div>
  );
};

export default CreateTask;

import React, { useContext, useState } from 'react';
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

  const submitHandler = async (e) => {
    e.preventDefault(); setError(''); setBusy(true);
    const title=taskTitle.trim(), description=taskDescription.trim(), taskCategory=category.trim();
    if (!title || !description || !taskDate || !taskCategory || !assignTo) { setError('Please complete all fields.'); setBusy(false); return; }
    try {
      await createTaskApi({ taskTitle:title, taskDescription:description, taskDate, category:taskCategory, assignedTo:assignTo, priority });
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
      <div className="dashboard-card p-6 text-center">
        {dataError ? (
          <>
            <p role="alert" className="text-sm text-danger">{dataError}</p>
            <button type="button" onClick={() => refresh().catch(error => console.error('Retrying employee load failed:', error))} className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white">
              Retry loading employees
            </button>
          </>
        ) : <p role="status" className="text-neutral-400">Loading employees…</p>}
      </div>
    );
  }

  if (activeEmployees.length === 0) {
    return (
      <div className="dashboard-card border-dashed p-6 text-center">
        <h2 className="text-lg font-bold text-neutral-700">{userData.length ? 'Reactivate a teammate to assign tasks' : 'Invite your first employee'}</h2>
        <p className="mt-2 text-sm text-neutral-500">Tasks can only be assigned to active employees.</p>
      </div>
    );
  }

  return (
    <div className="dashboard-card p-5 sm:p-6">
      <div className="mb-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-600">Plan the work</p>
        <h2 className="dashboard-card-heading mt-1">Create a task</h2>
        <p className="mt-1 text-xs leading-5 text-slate-500">Set a clear owner, deadline, and priority.</p>
      </div>
      <form onSubmit={submitHandler} className="space-y-4">
        {error && (
          <div role="alert" className="rounded-md bg-danger-light px-3 py-2 text-sm text-danger">
            {error}
            {dataError && <button type="button" onClick={() => refresh().catch(retryError => console.error('Retrying employee load failed:', retryError))} className="ml-2 font-semibold underline">Retry</button>}
          </div>
        )}

        <div>
          <label htmlFor="task-title" className="block text-xs font-bold text-slate-600">Task title</label>
          <input id="task-title" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm focus:border-primary focus:ring-primary" type="text" placeholder="Make a UI design" required />
        </div>

        <div>
          <label htmlFor="assign-to" className="block text-xs font-bold text-slate-600">Assign to</label>
          <select id="assign-to" value={assignTo} onChange={(e) => setAssignTo(e.target.value)} className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm focus:border-primary focus:ring-primary" required>
            <option value="" disabled>Select an employee</option>
            {activeEmployees.map((employee) => (
              <option key={employee.id} value={employee.id}>{employee.firstName}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="task-date" className="block text-xs font-bold text-slate-600">Due date</label>
            <input id="task-date" value={taskDate} onChange={(e) => setTaskDate(e.target.value)} className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm focus:border-primary focus:ring-primary" type="date" required />
          </div>
          <div>
            <label htmlFor="task-category" className="block text-xs font-bold text-slate-600">Category</label>
            <input id="task-category" value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm focus:border-primary focus:ring-primary" type="text" placeholder="design, dev, etc" required />
          </div>
        </div>

        <div>
          <label htmlFor="task-priority" className="block text-xs font-bold text-slate-600">Priority</label>
          <select id="task-priority" value={priority} onChange={(e) => setPriority(e.target.value)} className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm focus:border-primary focus:ring-primary">
            <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
          </select>
        </div>

        <div>
          <label htmlFor="task-description" className="block text-xs font-bold text-slate-600">Description</label>
          <textarea id="task-description" value={taskDescription} onChange={(e) => setTaskDescription(e.target.value)} className="mt-1 block h-28 w-full rounded-md border-neutral-300 shadow-sm focus:border-primary focus:ring-primary" required />
        </div>

        <button type="submit" disabled={busy} className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary-focus focus:ring-offset-2 disabled:opacity-60">
          {busy ? 'Creating…' : 'Create task'}
        </button>
      </form>
    </div>
  );
};

export default CreateTask;

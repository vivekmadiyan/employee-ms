import React, { useContext, useState } from 'react';
import { AuthContext } from '../../context/AuthProvider';
import { createTaskApi } from '../../api';

const CreateTask = () => {
  const { userData, refresh } = useContext(AuthContext);
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
      await refresh();
      setTaskTitle(''); setCategory(''); setAssignTo(''); setTaskDate(''); setTaskDescription(''); setPriority('medium');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  if (!userData) {
    return (
      <div className="rounded-xl border border-neutral-300 bg-white p-6 text-center text-neutral-400 shadow-sm">
        Loading...
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-neutral-300 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-bold text-neutral-500">Create a New Task</h2>
      <form onSubmit={submitHandler} className="mt-6 space-y-4">
        {error && (
          <div role="alert" className="rounded-md bg-danger-light px-3 py-2 text-sm text-danger">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="task-title" className="block text-sm font-medium text-neutral-500">Task Title</label>
          <input id="task-title" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm focus:border-primary focus:ring-primary" type="text" placeholder="Make a UI design" required />
        </div>

        <div>
          <label htmlFor="assign-to" className="block text-sm font-medium text-neutral-500">Assign To</label>
          <select id="assign-to" value={assignTo} onChange={(e) => setAssignTo(e.target.value)} className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm focus:border-primary focus:ring-primary" required>
            <option value="" disabled>Select an employee</option>
            {userData.map((employee) => (
              <option key={employee.id} value={employee.id}>{employee.firstName}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="task-date" className="block text-sm font-medium text-neutral-500">Date</label>
            <input id="task-date" value={taskDate} onChange={(e) => setTaskDate(e.target.value)} className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm focus:border-primary focus:ring-primary" type="date" required />
          </div>
          <div>
            <label htmlFor="task-category" className="block text-sm font-medium text-neutral-500">Category</label>
            <input id="task-category" value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm focus:border-primary focus:ring-primary" type="text" placeholder="design, dev, etc" required />
          </div>
        </div>

        <div>
          <label htmlFor="task-priority" className="block text-sm font-medium text-neutral-500">Priority</label>
          <select id="task-priority" value={priority} onChange={(e) => setPriority(e.target.value)} className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm focus:border-primary focus:ring-primary">
            <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
          </select>
        </div>

        <div>
          <label htmlFor="task-description" className="block text-sm font-medium text-neutral-500">Description</label>
          <textarea id="task-description" value={taskDescription} onChange={(e) => setTaskDescription(e.target.value)} className="mt-1 block h-28 w-full rounded-md border-neutral-300 shadow-sm focus:border-primary focus:ring-primary" required />
        </div>

        <button type="submit" disabled={busy} className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary-focus focus:ring-offset-2 disabled:opacity-60">
          {busy ? 'Creating…' : 'Create Task'}
        </button>
      </form>
    </div>
  );
};

export default CreateTask;

import React, { useContext, useState } from 'react';
import { FaCalendarDay, FaFlag } from 'react-icons/fa6';
import { AuthContext } from '../../context/AuthProvider';
import TaskComments from '../other/TaskComments';

const priorityConfig = {
  high: { label: 'High Priority', tone: 'bg-rose-50 text-rose-700 border-rose-200' },
  medium: { label: 'Medium', tone: 'bg-amber-50 text-amber-700 border-amber-200' },
  low: { label: 'Low', tone: 'bg-slate-50 text-slate-600 border-slate-200' },
};

const NewTask = ({ data }) => {
  const { updateTaskStatus } = useContext(AuthContext);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleAccept = async () => {
    setBusy(true);
    setError('');
    try {
      await updateTaskStatus(data.id, 'active');
    } catch (requestError) {
      setError(requestError.message || 'Could not accept this task. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const priority = priorityConfig[data.priority] || priorityConfig.medium;

  return (
    <div className="task-card flex flex-col justify-between rounded-2xl border border-sky-200/90 bg-white p-5 shadow-sm transition-all hover:shadow-md hover:border-sky-300">
      <div>
        {/* Badges Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="inline-flex rounded-lg bg-sky-50 px-2.5 py-1 text-[11px] font-bold text-sky-700">
              {data.category || 'General'}
            </span>
            <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-semibold ${priority.tone}`}>
              <FaFlag className="text-[9px]" />
              <span>{priority.label}</span>
            </span>
          </div>

          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400">
            <FaCalendarDay className="text-[10px]" />
            <span>{data.taskDate}</span>
          </span>
        </div>

        {/* Content */}
        <div className="py-3.5">
          <h3 className="text-base font-bold text-slate-900 leading-snug">{data.taskTitle}</h3>
          <p className="mt-2 text-xs leading-relaxed text-slate-500 whitespace-pre-wrap">{data.taskDescription}</p>
        </div>
      </div>

      <div className="pt-2">
        {error && <p role="alert" className="mb-2.5 rounded-lg bg-rose-50 p-2 text-xs text-rose-700">{error}</p>}
        
        <button
          type="button"
          onClick={handleAccept}
          disabled={busy}
          className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm shadow-indigo-600/25 transition-all hover:from-indigo-500 hover:to-indigo-600 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? 'Accepting…' : 'Accept Task'}
        </button>

        <TaskComments taskId={data.id} />
      </div>
    </div>
  );
};

export default NewTask;

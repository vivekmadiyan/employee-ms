import React, { useContext, useState } from 'react';
import { FaCalendarDay, FaCheck, FaFlag, FaTriangleExclamation } from 'react-icons/fa6';
import { AuthContext } from '../../context/AuthProvider';
import TaskComments from '../other/TaskComments';

const priorityConfig = {
  high: { label: 'High Priority', tone: 'bg-rose-50 text-rose-700 border-rose-200' },
  medium: { label: 'Medium', tone: 'bg-amber-50 text-amber-700 border-amber-200' },
  low: { label: 'Low', tone: 'bg-slate-50 text-slate-600 border-slate-200' },
};

const AcceptTask = ({ data }) => {
  const { updateTaskStatus } = useContext(AuthContext);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const updateStatus = async status => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const updated = await updateTaskStatus(data.id, status);
      if (updated.emailStatus && updated.emailStatus !== 'sent') {
        setNotice(updated.emailStatus === 'not_configured'
          ? 'Task updated; email notifications are not configured.'
          : updated.emailStatus === 'no_recipients'
            ? 'Task updated; no other active task participants were available to email.'
            : `Task updated, but email delivery failed (${updated.emailStatus}).`);
      }
    } catch (requestError) {
      setError(requestError.message || 'Could not update this task. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const priority = priorityConfig[data.priority] || priorityConfig.medium;

  return (
    <div className="task-card flex flex-col justify-between rounded-2xl border-2 border-indigo-500/80 bg-white p-5 shadow-sm shadow-indigo-500/5 transition-all hover:shadow-md">
      <div>
        {/* Badges Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="inline-flex rounded-lg bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-700">
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
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-block h-2 w-2 rounded-full bg-indigo-600 animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">In Progress</span>
          </div>
          <h3 className="text-base font-bold text-slate-900 leading-snug">{data.taskTitle}</h3>
          <p className="mt-2 text-xs leading-relaxed text-slate-500 whitespace-pre-wrap">{data.taskDescription}</p>
        </div>
      </div>

      <div className="pt-2">
        {error && <p role="alert" className="mb-2.5 rounded-lg bg-rose-50 p-2 text-xs text-rose-700">{error}</p>}
        {notice && <p role="status" className="mb-2.5 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">{notice}</p>}

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => updateStatus('completed')}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2.5 text-xs font-bold text-white shadow-sm shadow-emerald-600/20 transition-all hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FaCheck className="text-[11px]" />
            <span>{busy ? 'Saving…' : 'Completed'}</span>
          </button>
          
          <button
            type="button"
            disabled={busy}
            onClick={() => updateStatus('failed')}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-bold text-rose-700 transition-all hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FaTriangleExclamation className="text-[11px]" />
            <span>{busy ? 'Saving…' : 'Failed'}</span>
          </button>
        </div>

        <TaskComments taskId={data.id} />
      </div>
    </div>
  );
};

export default AcceptTask;

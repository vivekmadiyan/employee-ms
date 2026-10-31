import React, { useContext, useState } from 'react';
import { AuthContext } from '../../context/AuthProvider';
import TaskComments from '../other/TaskComments';

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

  return (
    <div className="task-card flex h-full w-80 flex-shrink-0 flex-col rounded-lg border-2 border-primary bg-white p-5 shadow-lg">
      <div className="flex items-center justify-between">
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          {data.category}
        </span>
        <span className="text-xs text-neutral-400">{data.taskDate}</span>
      </div>
      <div className="flex-1 py-4">
        <h3 className="text-lg font-semibold text-neutral-500">{data.taskTitle}</h3>
        <p className="mt-2 text-sm leading-relaxed text-neutral-400">{data.taskDescription}</p>
      </div>
      {error && <p role="alert" className="mb-3 text-sm text-danger">{error}</p>}
      {notice && <p role="status" className="mb-3 text-xs text-amber-700">{notice}</p>}
      <div className="flex items-center gap-3">
        <button
          disabled={busy}
          onClick={() => updateStatus('completed')}
          className="w-full rounded-lg bg-emerald-100 px-4 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? 'Saving…' : 'Completed'}
        </button>
        <button
          disabled={busy}
          onClick={() => updateStatus('failed')}
          className="w-full rounded-lg bg-red-100 px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? 'Saving…' : 'Failed'}
        </button>
      </div>
      <TaskComments taskId={data.id} />
    </div>
  );
};

export default AcceptTask;

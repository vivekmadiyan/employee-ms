import React, { useContext, useState } from 'react';
import { AuthContext } from '../../context/AuthProvider';

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

  return (
    <div className="task-card flex h-full w-80 flex-shrink-0 flex-col rounded-lg border-2 border-dashed border-neutral-300 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="rounded-full bg-neutral-200 px-3 py-1 text-xs font-medium text-neutral-500">
          {data.category}
        </span>
        <span className="text-xs text-neutral-400">{data.taskDate}</span>
      </div>
      <div className="flex-1 py-4">
        <h3 className="text-lg font-semibold text-neutral-500">{data.taskTitle}</h3>
        <p className="mt-2 text-sm leading-relaxed text-neutral-400">{data.taskDescription}</p>
      </div>
      {error && <p role="alert" className="mb-3 text-sm text-danger">{error}</p>}
      <button
        onClick={handleAccept}
        disabled={busy}
        className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? 'Accepting…' : 'Accept Task'}
      </button>
    </div>
  );
};

export default NewTask;

import React, { useContext } from 'react';
import { AuthContext } from '../../context/AuthProvider';

const AcceptTask = ({ data, employeeId }) => {
  const { updateTaskStatus } = useContext(AuthContext);

  const handleCompleted = () => {
    updateTaskStatus(employeeId, data.id, 'completed');
  };

  const handleFailed = () => {
    updateTaskStatus(employeeId, data.id, 'failed');
  };

  return (
    <div className="flex h-full w-80 flex-shrink-0 flex-col rounded-lg border-2 border-primary bg-white p-5 shadow-lg">
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
      <div className="flex items-center gap-3">
        <button onClick={handleCompleted} className="w-full rounded-lg bg-emerald-100 py-2.5 px-4 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-200">
          Completed
        </button>
        <button onClick={handleFailed} className="w-full rounded-lg bg-red-100 py-2.5 px-4 text-sm font-semibold text-red-700 transition hover:bg-red-200">
          Failed
        </button>
      </div>
    </div>
  );
};

export default AcceptTask;
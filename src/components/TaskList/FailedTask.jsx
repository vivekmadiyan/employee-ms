import React from 'react';
import TaskComments from '../other/TaskComments';

const FailedTask = ({ data }) => {
  return (
    <div className="task-card flex h-full w-80 flex-shrink-0 flex-col rounded-lg border border-danger/50 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="rounded-full bg-neutral-200 px-3 py-1 text-xs font-medium text-neutral-500">
          {data.category}
        </span>
        <span className="text-xs text-neutral-400">{data.taskDate}</span>
      </div>
      <div className="flex-1 py-4">
        <h3 className="text-lg font-semibold text-danger">{data.taskTitle}</h3>
        <p className="mt-2 text-sm leading-relaxed text-neutral-400">{data.taskDescription}</p>
      </div>
      <div className="rounded-lg bg-red-100 py-2.5 px-4 text-center text-sm font-semibold text-red-700">
        Failed
      </div>
      <TaskComments taskId={data.id} />
    </div>
  );
};

export default FailedTask;
import React from 'react';

const CompleteTask = ({ data }) => {
  return (
    <div className="task-card flex h-full w-80 flex-shrink-0 flex-col rounded-lg border border-neutral-300 bg-white p-5 shadow-sm opacity-75">
      <div className="flex items-center justify-between">
        <span className="rounded-full bg-neutral-200 px-3 py-1 text-xs font-medium text-neutral-500">
          {data.category}
        </span>
        <span className="text-xs text-neutral-400">{data.taskDate}</span>
      </div>
      <div className="flex-1 py-4">
        <h3 className="text-lg font-semibold text-neutral-500 line-through">{data.taskTitle}</h3>
        <p className="mt-2 text-sm leading-relaxed text-neutral-400">{data.taskDescription}</p>
      </div>
      <div className="rounded-lg bg-emerald-100 py-2.5 px-4 text-center text-sm font-semibold text-emerald-700">
        Completed
      </div>
    </div>
  );
};

export default CompleteTask;
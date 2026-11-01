import React from 'react';
import { FaCalendarDay, FaCircleExclamation, FaFlag } from 'react-icons/fa6';
import TaskComments from '../other/TaskComments';

const priorityConfig = {
  high: { label: 'High Priority', tone: 'bg-rose-50 text-rose-700 border-rose-200' },
  medium: { label: 'Medium', tone: 'bg-amber-50 text-amber-700 border-amber-200' },
  low: { label: 'Low', tone: 'bg-slate-50 text-slate-600 border-slate-200' },
};

const FailedTask = ({ data }) => {
  const priority = priorityConfig[data.priority] || priorityConfig.medium;

  return (
    <div className="task-card flex flex-col justify-between rounded-2xl border border-rose-200 bg-white p-5 shadow-sm transition-all hover:shadow-md">
      <div>
        {/* Badges Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="inline-flex rounded-lg bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700">
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
          <h3 className="text-base font-bold text-rose-800 leading-snug">{data.taskTitle}</h3>
          <p className="mt-2 text-xs leading-relaxed text-slate-500 whitespace-pre-wrap">{data.taskDescription}</p>
        </div>
      </div>

      <div className="pt-2">
        <div className="flex items-center justify-center gap-2 rounded-xl bg-rose-50 py-2.5 px-4 text-xs font-bold text-rose-700 border border-rose-100">
          <FaCircleExclamation className="text-sm text-rose-600" />
          <span>Needs Attention / Failed</span>
        </div>

        <TaskComments taskId={data.id} />
      </div>
    </div>
  );
};

export default FailedTask;

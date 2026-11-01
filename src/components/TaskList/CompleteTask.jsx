import React from 'react';
import { FaCalendarDay, FaCircleCheck, FaFlag } from 'react-icons/fa6';
import TaskComments from '../other/TaskComments';

const priorityConfig = {
  high: { label: 'High Priority', tone: 'bg-rose-50 text-rose-700 border-rose-200' },
  medium: { label: 'Medium', tone: 'bg-amber-50 text-amber-700 border-amber-200' },
  low: { label: 'Low', tone: 'bg-slate-50 text-slate-600 border-slate-200' },
};

const CompleteTask = ({ data }) => {
  const priority = priorityConfig[data.priority] || priorityConfig.medium;

  return (
    <div className="task-card flex flex-col justify-between rounded-2xl border border-emerald-200/80 bg-white p-5 shadow-sm transition-all hover:shadow-md">
      <div>
        {/* Badges Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="inline-flex rounded-lg bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
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
          <h3 className="text-base font-bold text-slate-700 line-through decoration-emerald-500/50 leading-snug">
            {data.taskTitle}
          </h3>
          <p className="mt-2 text-xs leading-relaxed text-slate-400 whitespace-pre-wrap">{data.taskDescription}</p>
        </div>
      </div>

      <div className="pt-2">
        <div className="flex items-center justify-center gap-2 rounded-xl bg-emerald-50 py-2.5 px-4 text-xs font-bold text-emerald-700 border border-emerald-100">
          <FaCircleCheck className="text-sm text-emerald-600" />
          <span>Completed</span>
        </div>

        <TaskComments taskId={data.id} />
      </div>
    </div>
  );
};

export default CompleteTask;

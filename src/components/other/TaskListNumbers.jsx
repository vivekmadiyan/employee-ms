import React from 'react';
import { FaBolt, FaCheckDouble, FaCircleExclamation, FaSpinner } from 'react-icons/fa6';

const StatCard = ({ title, value, icon: Icon, tone, accent, borderAccent }) => (
  <div className={`relative overflow-hidden rounded-2xl border bg-white p-4 sm:p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${borderAccent || 'border-slate-200'}`}>
    <div className="flex items-center justify-between">
      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{title}</span>
      <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${tone}`}>
        <Icon className="text-xs" />
      </span>
    </div>
    <div className="mt-2.5 flex items-baseline gap-2">
      <span className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${accent}`}>
        {value}
      </span>
    </div>
  </div>
);

const TaskListNumbers = ({ data }) => {
  if (!data || !data.taskCounts) return null;

  return (
    <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
      <StatCard 
        title="New Tasks" 
        value={data.taskCounts.newTask} 
        icon={FaBolt}
        tone="bg-blue-50 text-blue-600"
        accent="text-blue-600"
        borderAccent="border-blue-100/70"
      />
      <StatCard 
        title="In Progress" 
        value={data.taskCounts.active} 
        icon={FaSpinner}
        tone="bg-indigo-50 text-indigo-600"
        accent="text-indigo-600"
        borderAccent="border-indigo-100/70"
      />
      <StatCard 
        title="Completed" 
        value={data.taskCounts.completed} 
        icon={FaCheckDouble}
        tone="bg-emerald-50 text-emerald-600"
        accent="text-emerald-600"
        borderAccent="border-emerald-100/70"
      />
      <StatCard 
        title="Needs Attention" 
        value={data.taskCounts.failed} 
        icon={FaCircleExclamation}
        tone="bg-rose-50 text-rose-600"
        accent="text-rose-600"
        borderAccent="border-rose-100/70"
      />
    </div>
  );
};

export default TaskListNumbers;

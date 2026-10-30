import React from 'react';

const StatCard = ({ title, value, colorClass }) => (
  <div className="rounded-xl border border-neutral-300 bg-white p-6 shadow-sm">
    <p className="text-sm font-medium text-neutral-400">{title}</p>
    <p className={`mt-2 text-4xl font-bold ${colorClass || 'text-neutral-500'}`}>
      {value}
    </p>
  </div>
);

const TaskListNumbers = ({ data }) => {
  if (!data || !data.taskCounts) return null;

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard title="New Task" value={data.taskCounts.newTask} colorClass="text-blue-600" />
      <StatCard title="Accepted Task" value={data.taskCounts.active} colorClass="text-primary" />
      <StatCard title="Completed Task" value={data.taskCounts.completed} colorClass="text-emerald-600" />
      <StatCard title="Failed Task" value={data.taskCounts.failed} colorClass="text-danger" />
    </div>
  );
};

export default TaskListNumbers;
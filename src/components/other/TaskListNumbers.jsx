import React from 'react';

const StatCard = ({ title, value, colorClass, accent }) => (
  <div className="stat-card p-5 sm:p-6" style={{ '--stat-accent': accent }}>
    <p className="stat-card-label">{title}</p>
    <p className={`stat-card-value ${colorClass || 'text-neutral-500'}`}>
      {value}
    </p>
  </div>
);

const TaskListNumbers = ({ data }) => {
  if (!data || !data.taskCounts) return null;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard title="New tasks" value={data.taskCounts.newTask} colorClass="text-blue-600" accent="#5b7df5" />
      <StatCard title="In progress" value={data.taskCounts.active} colorClass="text-primary" accent="#6659e8" />
      <StatCard title="Completed" value={data.taskCounts.completed} colorClass="text-emerald-600" accent="#35a17a" />
      <StatCard title="Needs attention" value={data.taskCounts.failed} colorClass="text-danger" accent="#df7771" />
    </div>
  );
};

export default TaskListNumbers;
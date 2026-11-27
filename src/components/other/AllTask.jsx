import React, { useContext } from 'react';
import { AuthContext } from '../../context/AuthProvider';

const statuses = [
  ['newTask', 'New'],
  ['active', 'Active'],
  ['completed', 'Done'],
  ['failed', 'Follow-up']
];

export default function AllTask() {
  const { userData } = useContext(AuthContext);
  return (
    <section className="dashboard-card workspace-workload" aria-labelledby="workload-title">
      <h2 id="workload-title" className="dashboard-card-heading">Team workload</h2>
      <p>See how tasks are distributed across your team.</p>
      <ul>
        {(userData || []).map(employee => (
          <li key={employee.id}>
            <div className="workspace-workload-name">
              <strong>{employee.firstName}</strong>
              <span>{employee.department || 'General'}{!employee.active && ' · Inactive'}</span>
            </div>
            <dl>
              {statuses.map(([id, label]) => (
                <div key={id}><dt>{label}</dt><dd>{employee.taskCounts?.[id] ?? 0}</dd></div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </section>
  );
}

import React, { useContext } from 'react';
import { AuthContext } from '../../context/AuthProvider';
import Header from '../other/Header';
import TaskListNumbers from '../other/TaskListNumbers';
import TaskList from '../TaskList/TaskList';

const EmployeeDashboard = (props) => {
  const { userData, loading, dataError, refresh } = useContext(AuthContext);

  const employeeData =
    userData && userData.length > 0
      ? userData[0]
      : null;

  return (
    <div className="dashboard-shell">
      <div className="dashboard-topbar">
        <div className="dashboard-topbar-content">
          <Header changeUser={props.changeUser} data={props.data} />
        </div>
      </div>

      <main className="employee-content">
        <div className="employee-intro">
          <h2>Your work, at a glance</h2>
          <p>Stay on top of priorities and keep things moving.</p>
        </div>

        {loading && !employeeData ? (
          <div role="status" className="dashboard-card p-8 text-center text-gray-500">
            Loading your tasks…
          </div>
        ) : !employeeData && dataError ? (
          <div className="dashboard-card p-8 text-center">
            <p role="alert" className="text-sm text-danger">{dataError}</p>
            <button type="button" onClick={() => refresh().catch(error => console.error('Retrying dashboard load failed:', error))} className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white">
              Retry loading tasks
            </button>
          </div>
        ) : (
          <>
            <TaskListNumbers data={employeeData} />
            <TaskList data={employeeData} />
          </>
        )}
      </main>
    </div>
  );
};
export default EmployeeDashboard;
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
    <>
      <Header changeUser={props.changeUser} data={props.data} />

      {loading && !employeeData ? (
        <div role="status" className="p-8 text-center text-gray-500">
          Loading your tasks…
        </div>
      ) : !employeeData && dataError ? (
        <div className="p-8 text-center">
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
    </>
  );
};
export default EmployeeDashboard;
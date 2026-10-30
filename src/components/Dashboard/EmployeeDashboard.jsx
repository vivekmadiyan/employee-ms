import React, { useContext } from 'react';
import { AuthContext } from '../../context/AuthProvider';
import Header from '../other/Header';
import TaskListNumbers from '../other/TaskListNumbers';
import TaskList from '../TaskList/TaskList';

const EmployeeDashboard = (props) => {
  const { userData, loading } = useContext(AuthContext);

  const employeeData =
    userData && userData.length > 0
      ? userData[0]
      : null;

  return (
    <>
      <Header changeUser={props.changeUser} data={props.data} />

      {loading && !employeeData ? (
        <div className="p-8 text-center text-gray-500">
          Loading your tasks...
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
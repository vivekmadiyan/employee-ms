import React, { createContext, useEffect, useState } from 'react';

import {
  getEmployeeDashboard,
  getEmployees,
  updateTaskStatusApi
} from '../api';

export const AuthContext = createContext(null);

const AuthProvider = ({ children }) => {
  const [userData, setUserData] = useState(null);

  const [currentUser, setCurrentUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('ems_user')) || null;
    } catch {
      return null;
    }
  });

  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState('');

  const refresh = async (user = currentUser) => {
    if (!user) {
      setUserData(null);
      setDataError('');
      return;
    }

    try {
      if (user.role === 'admin') {
        const employees = await getEmployees();
        setUserData(employees || []);
      } else {
        const data = await getEmployeeDashboard();

        setUserData([
          {
            ...data.user,
            tasks: data.tasks || [],
            taskCounts: data.taskCounts || {
              new: 0,
              active: 0,
              completed: 0,
              failed: 0,
            },
          },
        ]);
      }
      setDataError('');
    } catch (error) {
      setDataError(error.message || 'Could not load workspace data.');
      console.error('Failed to refresh user data:', error);
      throw error;
    }
  };

  useEffect(() => {
    if (!localStorage.getItem('ems_token') || !currentUser) {
      setLoading(false);
      return;
    }

    refresh()
      .catch(error => console.error('Failed to restore workspace data:', error))
      .finally(() => setLoading(false));
  // This bootstraps once from persisted session state.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const expireSession = () => {
      setCurrentUser(null);
      setUserData(null);
      setDataError('');
      setLoading(false);
    };
    window.addEventListener('ems:session-expired', expireSession);
    return () => window.removeEventListener('ems:session-expired', expireSession);
  }, []);

  const updateTaskStatus = async (taskId, status) => {
    const updatedTask = await updateTaskStatusApi(taskId, status);
    setUserData(current => current?.map(employee => {
      if (employee.id !== updatedTask.assignedTo) return employee;
      const tasks = employee.tasks.map(task => task.id === updatedTask.id ? updatedTask : task);
      return {
        ...employee,
        tasks,
        taskCounts: {
          newTask: tasks.filter(task => task.newTask).length,
          active: tasks.filter(task => task.active).length,
          completed: tasks.filter(task => task.completed).length,
          failed: tasks.filter(task => task.failed).length
        }
      };
    }) ?? current);
    return updatedTask;
  };

  const setSession = (user, token) => {
    localStorage.setItem('ems_token', token);
    localStorage.setItem('ems_user', JSON.stringify(user));

    setCurrentUser(user);
    setUserData(null);
    setDataError('');
    setLoading(true);

    refresh(user)
      .catch((error) => {
        console.error('Failed to load user data:', error);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const logout = () => {
    localStorage.removeItem('ems_token');
    localStorage.removeItem('ems_user');
    setCurrentUser(null);
    setUserData(null);
    setDataError('');
  };

  return (
    <AuthContext.Provider
      value={{
        userData,
        setUserData,
        currentUser,
        dataError,
        setSession,
        logout,
        updateTaskStatus,
        refresh,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;

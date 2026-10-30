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

  const refresh = async (user = currentUser) => {
    if (!user) {
      setUserData(null);
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
    } catch (error) {
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
      .catch(() => {
        localStorage.removeItem('ems_token');
        localStorage.removeItem('ems_user');
        setCurrentUser(null);
        setUserData(null);
      })
      .finally(() => setLoading(false));
  // This bootstraps once from persisted session state.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const expireSession = () => {
      setCurrentUser(null);
      setUserData(null);
      setLoading(false);
    };
    window.addEventListener('ems:session-expired', expireSession);
    return () => window.removeEventListener('ems:session-expired', expireSession);
  }, []);

  const updateTaskStatus = async (employeeId, taskId, status) => {
    await updateTaskStatusApi(taskId, status);
    await refresh(currentUser);
  };

  const setSession = (user, token) => {
    localStorage.setItem('ems_token', token);
    localStorage.setItem('ems_user', JSON.stringify(user));

    setCurrentUser(user);
    setUserData(null);
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
  };

  return (
    <AuthContext.Provider
      value={{
        userData,
        setUserData,
        currentUser,
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

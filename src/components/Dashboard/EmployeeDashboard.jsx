import React, { useContext, useState } from 'react';
import { FaCalendarDay, FaListCheck } from 'react-icons/fa6';
import { AuthContext } from '../../context/AuthProvider';
import Header from '../other/Header';
import TaskListNumbers from '../other/TaskListNumbers';
import TaskList from '../TaskList/TaskList';
import LeaveManagement from '../other/LeaveManagement';

const EmployeeDashboard = (props) => {
  const { userData, loading, dataError, refresh } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('tasks');

  const employeeData =
    userData && userData.length > 0
      ? userData[0]
      : null;

  const todayFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  });

  return (
    <div className="dashboard-shell min-h-screen bg-[#f8fafc]">
      <div className="dashboard-topbar">
        <div className="dashboard-topbar-content">
          <Header changeUser={props.changeUser} data={props.data} />
        </div>
      </div>

      <main className="employee-content">
        {/* Intro banner */}
        <div className="dashboard-heading">
          <div>
            <div className="flex items-center gap-2">
              <h2>My Workspace</h2>
              <span className="hidden rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-emerald-700 sm:inline-flex">
                Teammate Portal
              </span>
            </div>
            <p>Track your assigned priorities, collaborate with comments, and manage time off.</p>
          </div>
          <div className="text-right">
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 shadow-sm">
              <FaCalendarDay className="text-slate-400 text-xs" />
              <span>{todayFormatted}</span>
            </span>
          </div>
        </div>

        {loading && !employeeData ? (
          <div role="status" className="dashboard-card p-12 text-center text-slate-500">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
            <p className="text-sm font-medium">Loading your tasks…</p>
          </div>
        ) : !employeeData && dataError ? (
          <div className="dashboard-card p-8 text-center">
            <p role="alert" className="text-sm font-semibold text-rose-600">{dataError}</p>
            <button 
              type="button" 
              onClick={() => refresh().catch(error => console.error('Retrying dashboard load failed:', error))} 
              className="mt-4 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700"
            >
              Retry loading tasks
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Metric counters */}
            <TaskListNumbers data={employeeData} />

            {/* View Switcher Tabs */}
            <div className="flex gap-2 border-b border-slate-200 pb-3">
              <button
                type="button"
                onClick={() => setActiveTab('tasks')}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                  activeTab === 'tasks'
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/25'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                <FaListCheck className="text-xs" />
                <span>Assigned Tasks</span>
                {employeeData?.tasks?.length > 0 && (
                  <span className={`inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] ${
                    activeTab === 'tasks' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {employeeData.tasks.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('leaves')}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                  activeTab === 'leaves'
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/25'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                <FaCalendarDay className="text-xs" />
                <span>Time Off & Leave</span>
              </button>
            </div>

            {/* Tab Views */}
            {activeTab === 'tasks' ? (
              <div className="animate-fade-in">
                <TaskList data={employeeData} />
              </div>
            ) : (
              <div className="animate-fade-in">
                <LeaveManagement />
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default EmployeeDashboard;

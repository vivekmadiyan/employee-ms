import React, { useContext, useEffect, useState } from 'react';
import { FaCalendarDay, FaListCheck, FaUserGroup } from 'react-icons/fa6';
import { AuthContext } from '../../context/AuthProvider';
import { getDirectReportsApi } from '../../api';
import Header from '../other/Header';
import TaskListNumbers from '../other/TaskListNumbers';
import TaskList from '../TaskList/TaskList';
import LeaveManagement from '../other/LeaveManagement';

const EmployeeDashboard = (props) => {
  const { userData, loading, dataError, refresh, currentUser } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('tasks');
  const [directReports, setDirectReports] = useState([]);
  const [teamError, setTeamError] = useState('');

  useEffect(() => {
    getDirectReportsApi()
      .then(setDirectReports)
      .catch(error => setTeamError(error.message || 'Could not load your direct reports.'));
  }, [currentUser?.id]);

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
              {directReports.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab('team')}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                    activeTab === 'team'
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/25'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <FaUserGroup className="text-xs" />
                  <span>My Team</span>
                  <span className={`inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] ${
                    activeTab === 'team' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {directReports.length}
                  </span>
                </button>
              )}
            </div>

            {/* Tab Views */}
            {teamError && <p role="alert" className="rounded-xl border border-rose-100 bg-rose-50 p-3 text-xs text-rose-700">{teamError}</p>}
            {activeTab === 'tasks' ? (
              <div className="animate-fade-in">
                <TaskList data={employeeData} />
              </div>
            ) : activeTab === 'leaves' ? (
              <div className="animate-fade-in">
                <LeaveManagement isManager={directReports.length > 0} />
              </div>
            ) : (
              <section className="dashboard-card overflow-hidden rounded-2xl shadow-sm" aria-labelledby="manager-team-heading">
                <div className="border-b border-slate-100 p-5 sm:p-6">
                  <h2 id="manager-team-heading" className="text-sm font-bold text-slate-900">Your direct reports</h2>
                  <p className="mt-1 text-xs text-slate-500">You can review their leave requests. Ask an administrator or HR to change reporting lines, team membership, or employee access.</p>
                </div>
                <ul className="divide-y divide-slate-100">
                  {directReports.map(report => (
                    <li key={report.id} className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{report.firstName}</p>
                        <p className="text-xs text-slate-500">{report.jobTitle || report.department}</p>
                      </div>
                      <div className="text-xs text-slate-500 sm:text-right">
                        <p>{report.email}</p>
                        <p className="mt-0.5 font-medium text-indigo-700">{report.team || 'General'} team</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default EmployeeDashboard;

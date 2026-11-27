import React, { useContext, useEffect, useRef, useState } from 'react';
import { FaCalendarDay, FaListCheck, FaUserGroup, FaWandMagicSparkles } from 'react-icons/fa6';
import { AuthContext } from '../../context/AuthProvider';
import { getDirectReportsApi } from '../../api';
import Header from '../other/Header';
import TaskListNumbers from '../other/TaskListNumbers';
import TaskList from '../TaskList/TaskList';
import LeaveManagement from '../other/LeaveManagement';
import AIAssistant from '../other/AIAssistant';
import WorkFocus from '../other/WorkFocus';
import './Workspace.css';

const EmployeeDashboard = (props) => {
  const { userData, loading, dataError, refresh, currentUser } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('tasks');
  const [hasOpenedAi, setHasOpenedAi] = useState(false);
  const [directReports, setDirectReports] = useState([]);
  const [teamError, setTeamError] = useState('');
  const [focusRequest, setFocusRequest] = useState(null);
  const taskListRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    getDirectReportsApi()
      .then(reports => { if (!cancelled) setDirectReports(reports); })
      .catch(error => { if (!cancelled) setTeamError(error.message || 'Could not load your direct reports.'); });
    return () => { cancelled = true; };
  }, [currentUser?.id]);

  const employeeData =
    userData && userData.length > 0
      ? userData[0]
      : null;
  const workspaceTabs = [
    { id: 'ai', label: 'AI', icon: FaWandMagicSparkles },
    { id: 'tasks', label: 'My tasks', icon: FaListCheck, count: employeeData?.tasks?.length },
    { id: 'leaves', label: 'Time off', icon: FaCalendarDay },
    ...(directReports.length > 0
      ? [{ id: 'team', label: 'My team', icon: FaUserGroup, count: directReports.length }]
      : [])
  ];

  const todayFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  });

  const openTask = task => {
    if (task) {
      setFocusRequest({ taskId: task.id });
      setActiveTab('tasks');
    } else {
      taskListRef.current?.focus({ preventScroll: true });
      taskListRef.current?.scrollIntoView({ block: 'start' });
    }
  };

  const openPage = id => {
    if (id === 'ai') setHasOpenedAi(true);
    if (id === 'tasks') setFocusRequest(null);
    setActiveTab(id);
  };

  return (
    <div className="workspace-release">
      <div className="workspace-topbar">
        <div className="workspace-topbar-inner">
          <Header changeUser={props.changeUser} data={props.data} />
        </div>
      </div>

      <main className={`workspace-main workspace-personal${activeTab === 'ai' ? ' workspace-personal--ai' : ''}`}>
        <div className="workspace-pagehead">
          <div>
            <h1>{activeTab === 'ai' ? 'AI workspace' : 'My Workspace'}</h1>
            <p>{activeTab === 'ai'
              ? 'Ask about your tasks, draft updates, or prepare a status change.'
              : 'Manage your assignments, keep track of deadlines, and plan time off.'}</p>
          </div>
          <span className="workspace-date"><FaCalendarDay aria-hidden="true" /> {todayFormatted}</span>
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
          <div className="workspace-stack">
            <nav aria-label="My workspace sections" className="workspace-personal-nav">
              {workspaceTabs.map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    aria-current={isActive ? 'page' : undefined}
                    aria-controls={tab.id === 'ai' ? 'employee-ai-view' : undefined}
                    onClick={() => openPage(tab.id)}
                  >
                    <Icon className="text-xs" aria-hidden="true" />
                    <span>{tab.label}</span>
                    {tab.count > 0 && <span className="workspace-personal-count">{tab.count > 99 ? '99+' : tab.count}</span>}
                  </button>
                );
              })}
            </nav>

            {teamError && <p role="alert" className="rounded-xl border border-rose-100 bg-rose-50 p-3 text-xs text-rose-700">{teamError}</p>}
            <div id="employee-ai-view" className="workspace-ai-view" hidden={activeTab !== 'ai'}>
              {hasOpenedAi && <AIAssistant onOpenTask={openTask} />}
            </div>
            {activeTab === 'tasks' && (
              <div className="workspace-stack">
                <WorkFocus tasks={employeeData?.tasks} onOpenTasks={openTask} />
                <TaskListNumbers data={employeeData} />
                <div className="workspace-jump" tabIndex={-1} ref={taskListRef} aria-label="Assigned Tasks">
                  <TaskList data={employeeData} focusRequest={focusRequest} />
                </div>
              </div>
            )}
            {activeTab === 'leaves' && (
              <div className="animate-fade-in">
                <LeaveManagement isManager={directReports.length > 0} />
              </div>
            )}
            {activeTab === 'team' && (
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

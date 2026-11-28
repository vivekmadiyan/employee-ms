import React, { useContext, useEffect, useState } from 'react';
import { FaCalendarDay, FaHouse, FaListCheck, FaUserGroup, FaWandMagicSparkles } from 'react-icons/fa6';
import { AuthContext } from '../../context/AuthProvider';
import { WorkspaceSettingsContext } from '../../context/WorkspaceSettingsContext';
import { getDirectReportsApi } from '../../api';
import Header from '../other/Header';
import TaskListNumbers from '../other/TaskListNumbers';
import TaskList from '../TaskList/TaskList';
import LeaveManagement from '../other/LeaveManagement';
import AIAssistant from '../other/AIAssistant';
import WorkFocus from '../other/WorkFocus';
import OffboardingAssignments from '../other/OffboardingAssignments';
import WorkspaceBrief from './WorkspaceBrief';
import { briefPrompt } from '../../utils/workFocus';
import { clearTaskLink } from '../../utils/taskLink';
import WorkspaceNav from './WorkspaceNav';
import './Workspace.css';

const EmployeeDashboard = (props) => {
  const { userData, loading, dataError, refresh, currentUser } = useContext(AuthContext);
  const { settings } = useContext(WorkspaceSettingsContext);
  const [activeTab, setActiveTab] = useState(() => props.initialTaskId ? 'tasks' : 'home');
  const [hasOpenedAi, setHasOpenedAi] = useState(false);
  const [aiDraft, setAiDraft] = useState(null);
  const [showApprovals, setShowApprovals] = useState(false);
  const [directReports, setDirectReports] = useState([]);
  const [teamError, setTeamError] = useState('');
  const [focusRequest, setFocusRequest] = useState(() => props.initialTaskId ? { taskId: props.initialTaskId, fromLink: true } : null);
  const [taskView, setTaskView] = useState(null);

  useEffect(() => {
    let request;
    const loadReports = async () => {
      request?.abort();
      const controller = new AbortController();
      request = controller;
      try {
        const reports = await getDirectReportsApi(controller.signal);
        if (controller.signal.aborted) return;
        setDirectReports(reports);
        setTeamError('');
        if (!reports.length) setActiveTab(current => current === 'team' ? 'home' : current);
      } catch (error) {
        if (!controller.signal.aborted) setTeamError(error.message || 'Could not load your direct reports.');
      }
    };
    loadReports();
    window.addEventListener('ems:workspace-updated', loadReports);
    return () => {
      request?.abort();
      window.removeEventListener('ems:workspace-updated', loadReports);
    };
  }, [currentUser?.id]);

  const employeeData =
    userData && userData.length > 0
      ? userData[0]
      : null;
  const workspaceTabs = [
    { id: 'home', label: 'Home', icon: FaHouse },
    { id: 'tasks', label: 'My tasks', shortLabel: 'Work', icon: FaListCheck },
    { id: 'ai', label: 'AI', icon: FaWandMagicSparkles },
    { id: 'leaves', label: 'Time off', icon: FaCalendarDay }
  ];
  const secondaryTabs = directReports.length ? [{ id: 'team', label: 'My team', icon: FaUserGroup }] : [];
  const pageTitles = { home: 'My Workspace', tasks: 'My tasks', ai: 'AI workspace', leaves: 'Time off', team: 'My team' };

  const todayFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    timeZone: settings.timeZone
  });

  const openTask = task => {
    if (task) {
      clearTaskLink();
      setTaskView(null);
      setFocusRequest({ taskId: task.id });
      setActiveTab('tasks');
    } else {
      openPage('tasks');
    }
  };

  const openPage = id => {
    clearTaskLink();
    if (id === 'ai') setHasOpenedAi(true);
    if (id === 'tasks') {
      setFocusRequest(null);
      setTaskView(null);
    }
    setShowApprovals(false);
    setActiveTab(id);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };
  const draftHandoff = task => {
    setAiDraft({ text: 'Draft a handoff for this task.', taskId: task.id, title: task.taskTitle });
    openPage('ai');
  };

  const openNotificationTask = async task => {
    if (!employeeData?.tasks?.some(item => item.id === task.id)) await refresh();
    openTask(task);
  };

  return (
    <div className="workspace-release">
      <div className="workspace-topbar">
        <div className="workspace-topbar-inner">
          <Header changeUser={props.changeUser} data={props.data} onOpenTask={openNotificationTask} />
        </div>
      </div>

      <div className={`workspace-frame${activeTab === 'ai' ? ' workspace-frame--ai' : ''}`}>
        <WorkspaceNav label="My workspace sections" active={activeTab} primary={workspaceTabs}
          secondary={secondaryTabs} onOpen={openPage} aiView="employee-ai-view" />
      <main className="workspace-main">
        <div className={activeTab === 'ai' ? 'sr-only' : 'workspace-pagehead'}>
          <div>
            <h1>{pageTitles[activeTab]}</h1>
            {activeTab === 'home' && <p>Keep track of your work and plan time off.</p>}
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
            {teamError && <p role="alert" className="rounded-xl border border-rose-100 bg-rose-50 p-3 text-xs text-rose-700">{teamError}</p>}
            <div id="employee-ai-view" className="workspace-ai-view" hidden={activeTab !== 'ai'}>
              {hasOpenedAi && <AIAssistant draftRequest={aiDraft} onOpenTask={openTask} />}
            </div>
            {activeTab === 'home' && <>
              <WorkspaceBrief onWork={(filter, today) => { openPage('tasks'); setTaskView({ filter, today }); }} onTimeOff={() => openPage('leaves')}
                onReview={() => { openPage('leaves'); setShowApprovals(true); }}
                onAsk={() => { setAiDraft({ text: briefPrompt }); openPage('ai'); }} />
              <WorkFocus tasks={employeeData?.tasks} onOpenTasks={openTask} />
              <OffboardingAssignments />
            </>}
            {activeTab === 'tasks' && (
              <div className="workspace-stack">
                <TaskListNumbers data={employeeData} />
                <div className="workspace-jump" tabIndex={-1} aria-label="Assigned Tasks">
                  {focusRequest?.fromLink && employeeData && !employeeData.tasks?.some(task => task.id === focusRequest.taskId) && (
                    <p role="status" className="dashboard-card p-4">This task is no longer available to your account.</p>
                  )}
                  <TaskList key={taskView?.filter ?? 'all'} data={employeeData} focusRequest={focusRequest}
                    initialView={taskView} onDraftHandoff={draftHandoff} />
                </div>
              </div>
            )}
            {activeTab === 'leaves' && (
              <div className="animate-fade-in">
                <LeaveManagement isManager={directReports.length > 0} showApprovals={showApprovals} />
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
    </div>
  );
};

export default EmployeeDashboard;

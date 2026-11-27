import React, { useContext, useEffect, useRef, useState } from 'react';
import {
  FaCalendarDay, FaChartLine, FaChartPie, FaClipboardCheck, FaListCheck, FaPlus,
  FaPlug, FaShieldHalved, FaUserPlus, FaUsers, FaWandMagicSparkles
} from 'react-icons/fa6';
import { AuthContext } from '../../context/AuthProvider';
import Header from '../other/Header';
import CreateTask from '../other/CreateTask';
import AllTask from '../other/AllTask';
import InviteEmployee from '../other/InviteEmployee';
import TaskManagement from '../other/TaskManagement';
import TeamManagement from '../other/TeamManagement';
import TaskReports from '../other/TaskReports';
import BulkInviteEmployees from '../other/BulkInviteEmployees';
import AuditTrail from '../other/AuditTrail';
import LeaveManagement from '../other/LeaveManagement';
import SlackIntegration from '../other/SlackIntegration';
import OffboardingManagement from '../other/OffboardingManagement';
import WorkforceReports from '../other/WorkforceReports';
import AIAssistant from '../other/AIAssistant';
import WorkFocus from '../other/WorkFocus';
import './Workspace.css';

const navigation = [
  ['Operations', [
    { id: 'ai', label: 'AI', title: 'AI workspace', icon: FaWandMagicSparkles, description: 'Ask about work, draft updates, or prepare a task change.' },
    { id: 'overview', label: 'Overview', title: 'Workspace Overview', icon: FaChartPie, description: 'See what needs attention and keep your team on track.' },
    { id: 'tasks', label: 'Task Hub', icon: FaListCheck, description: 'Assign, prioritize, and follow up on team tasks.' },
    { id: 'leaves', label: 'Leave Requests', icon: FaCalendarDay, description: 'Review requests and plan around approved absences.' },
    { id: 'reports', label: 'Reports', icon: FaChartLine, description: 'Review task delivery, workload, and headcount.' }
  ]],
  ['People & settings', [
    { id: 'team', label: 'Team & Invites', icon: FaUsers, description: 'Manage teammates, invitations, and onboarding.' },
    { id: 'offboarding', label: 'Offboarding', icon: FaClipboardCheck, description: 'Coordinate employee transitions and handovers.' },
    { id: 'audit', label: 'Audit Trail', icon: FaShieldHalved, description: 'Review significant changes across your workspace.' },
    { id: 'integrations', label: 'Integrations', icon: FaPlug, description: 'Manage connections to the tools your team uses.' }
  ]]
];
const pages = navigation.flatMap(([, items]) => items);

const AdminDashboard = ({ changeUser, data }) => {
  const { userData, dataError, refresh } = useContext(AuthContext);
  const [view, setView] = useState({ tab: 'overview' });
  const [hasOpenedAi, setHasOpenedAi] = useState(false);
  const headingRef = useRef(null);
  const taskFormRef = useRef(null);
  const inviteRef = useRef(null);
  const { tab, taskId, taskSource, taskFocus } = view;
  const page = pages.find(item => item.id === tab);
  const employees = userData || [];
  const totals = employees.reduce((counts, employee) => ({
    active: counts.active + Number(Boolean(employee.active)),
    open: counts.open + (employee.taskCounts?.active || 0) + (employee.taskCounts?.newTask || 0),
    completed: counts.completed + (employee.taskCounts?.completed || 0),
    failed: counts.failed + (employee.taskCounts?.failed || 0)
  }), { active: 0, open: 0, completed: 0, failed: 0 });
  const stats = [
    { label: 'Active teammates', value: totals.active, note: `${employees.length} registered`, icon: FaUsers },
    { label: 'Open tasks', value: totals.open, note: 'New or in progress', icon: FaListCheck },
    { label: 'Completed', value: totals.completed, note: 'Tasks delivered', icon: FaClipboardCheck },
    { label: 'Needs attention', value: totals.failed, note: 'Tasks awaiting follow-up', icon: FaChartLine }
  ];
  const openTaskHub = (task, source = 'Work Focus') => setView(current => ({
    tab: 'tasks', taskId: task?.id, taskSource: source, taskFocus: (current.taskFocus || 0) + 1, jump: 'heading'
  }));
  const openPage = id => {
    if (id === 'ai') setHasOpenedAi(true);
    setView({ tab: id });
  };

  useEffect(() => {
    if (!view.jump) return;
    const targets = { heading: headingRef, create: taskFormRef, invite: inviteRef };
    const target = targets[view.jump].current;
    if (!target) return;
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: 'start' });
  }, [view]);

  return (
    <div className="workspace-release">
      <div className="workspace-topbar">
        <div className="workspace-topbar-inner">
          <Header changeUser={changeUser} data={data} onOpenTask={task => openTaskHub(task, 'Notifications')} />
        </div>
      </div>
      <div className={`workspace-frame${tab === 'ai' ? ' workspace-frame--ai' : ''}`}>
        <nav className="workspace-rail" aria-label="Workspace navigation">
          {navigation.map(([group, items]) => (
            <div className="workspace-navgroup" key={group}>
              <p>{group}</p>
              {items.map(({ id, label, icon: Icon }) => (
                <button key={id} type="button" aria-current={tab === id ? 'page' : undefined}
                  aria-controls={id === 'ai' ? 'admin-ai-view' : undefined}
                  onClick={() => openPage(id)}>
                  <Icon aria-hidden="true" />
                  {label}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <main className="workspace-main">
          <section className={tab === 'ai' ? 'sr-only' : 'workspace-pagehead'} aria-labelledby="workspace-page-title">
            <div>
              <h1 id="workspace-page-title" ref={headingRef} tabIndex={-1}>{page.title || page.label}</h1>
              <p>{page.description}</p>
            </div>
            {tab !== 'ai' && <div className="workspace-actions">
              <button type="button" onClick={() => setView({ tab: 'team', jump: 'invite' })}
                className="workspace-action workspace-action--secondary"><FaUserPlus aria-hidden="true" /> Invite Member</button>
              <button type="button" onClick={() => setView({ tab: 'tasks', jump: 'create' })}
                className="workspace-action"><FaPlus aria-hidden="true" /> New Task</button>
            </div>}
          </section>

          <div id="admin-ai-view" className="workspace-ai-view" hidden={tab !== 'ai'}>
            {hasOpenedAi && <AIAssistant onOpenTask={task => openTaskHub(task, 'AI chat')} />}
          </div>
          {tab !== 'ai' && (userData === null ? (
            <section className="dashboard-card p-8 text-center">
              {dataError ? (
                <>
                  <p role="alert" className="mb-3 text-sm text-rose-700">{dataError}</p>
                  <button type="button" className="workspace-action" onClick={() => refresh().catch(() => {})}>
                    Retry loading workspace
                  </button>
                </>
              ) : <p role="status">Loading your workspace…</p>}
            </section>
          ) : (
            <div className="workspace-stack">
              {tab === 'overview' && (
                <>
                  <dl className="workspace-stats" aria-label="Workspace totals">
                    {stats.map(({ label, value, note, icon: Icon }) => (
                      <div className="workspace-stat" key={label}>
                        <dt>{label} <Icon aria-hidden="true" /></dt>
                        <dd><strong>{value}</strong><span>{note}</span></dd>
                      </div>
                    ))}
                  </dl>
                  <WorkFocus admin employees={employees} onOpenTasks={openTaskHub} />
                  {employees.length > 0 ? (
                    <AllTask />
                  ) : (
                    <section className="dashboard-card workspace-onboard">
                      <span className="workspace-onboard-icon"><FaUserPlus aria-hidden="true" /></span>
                      <div>
                        <h2 className="dashboard-card-heading">Invite your first teammate</h2>
                        <p>Invite someone to assign work and see deadlines here.</p>
                      </div>
                      <button type="button" className="workspace-action"
                        onClick={() => setView({ tab: 'team', jump: 'invite' })}>Invite teammate</button>
                    </section>
                  )}
                </>
              )}

              {tab === 'tasks' && (
                <>
                  <TaskManagement key={taskFocus || 0} initialTaskId={taskId} taskSource={taskSource} />
                  <div className="workspace-jump" tabIndex={-1} ref={taskFormRef}><CreateTask /></div>
                </>
              )}

              {tab === 'team' && (
                <>
                  <div className="workspace-support">
                    <div className="workspace-jump" tabIndex={-1} ref={inviteRef}><InviteEmployee /></div>
                    <BulkInviteEmployees />
                  </div>
                  <TeamManagement />
                </>
              )}

              {tab === 'offboarding' && <OffboardingManagement />}
              {tab === 'leaves' && <LeaveManagement />}
              {tab === 'reports' && <><WorkforceReports /><TaskReports /></>}
              {tab === 'audit' && <AuditTrail />}
              {tab === 'integrations' && <SlackIntegration />}
            </div>
          ))}
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;

import React, { useContext, useState } from 'react';
import { 
  FaCalendarDay, 
  FaChartLine, 
  FaChartPie, 
  FaListCheck, 
  FaPlus, 
  FaShieldHalved, 
  FaUserPlus, 
  FaUsers 
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

const AdminDashboard = (props) => {
  const { userData, dataError, refresh } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('overview');

  // Compute workspace metrics
  const totalEmployees = userData?.length || 0;
  const activeEmployees = userData?.filter(e => e.active)?.length || 0;
  const inProgressTasks = userData?.reduce((acc, e) => acc + (e.taskCounts?.active || 0), 0) || 0;
  const newTasks = userData?.reduce((acc, e) => acc + (e.taskCounts?.newTask || 0), 0) || 0;
  const completedTasks = userData?.reduce((acc, e) => acc + (e.taskCounts?.completed || 0), 0) || 0;
  const attentionTasks = userData?.reduce((acc, e) => acc + (e.taskCounts?.failed || 0), 0) || 0;

  const tabs = [
    { id: 'overview', label: 'Overview', icon: FaChartPie },
    { id: 'tasks', label: 'Task Hub', icon: FaListCheck, count: inProgressTasks + newTasks },
    { id: 'team', label: 'Team & Invites', icon: FaUsers, count: totalEmployees },
    { id: 'leaves', label: 'Leave Requests', icon: FaCalendarDay },
    { id: 'reports', label: 'Reports', icon: FaChartLine },
    { id: 'audit', label: 'Audit Trail', icon: FaShieldHalved },
  ];

  return (
    <div className="dashboard-shell min-h-screen bg-[#f8fafc]">
      <div className="dashboard-topbar">
        <div className="dashboard-topbar-content">
          <Header changeUser={props.changeUser} data={props.data} />
        </div>
      </div>

      <main className="dashboard-content">
        {/* Workspace Title & Quick Actions */}
        <div className="dashboard-heading">
          <div>
            <div className="flex items-center gap-2">
              <h2>Workspace Overview</h2>
              <span className="hidden rounded-full border border-indigo-100 bg-indigo-50/70 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-indigo-700 sm:inline-flex">
                Admin Suite
              </span>
            </div>
            <p>Monitor team activity, allocate assignments, and keep operations aligned.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setActiveTab('team')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
            >
              <FaUserPlus className="text-slate-500 text-xs" />
              <span>Invite Member</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm shadow-indigo-600/25 transition hover:bg-indigo-700"
            >
              <FaPlus className="text-xs" />
              <span>New Task</span>
            </button>
          </div>
        </div>

        {/* Top Metric Cards */}
        <section className="mb-8 grid grid-cols-2 gap-3.5 sm:grid-cols-4 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Team</span>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <FaUsers className="text-xs" />
              </span>
            </div>
            <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900">{activeEmployees}</p>
            <p className="mt-1 text-[11px] text-slate-400">{totalEmployees} total registered</p>
          </div>

          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">In Progress</span>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                <FaListCheck className="text-xs" />
              </span>
            </div>
            <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900">{inProgressTasks}</p>
            <p className="mt-1 text-[11px] text-slate-400">{newTasks} new awaiting start</p>
          </div>

          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Completed</span>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <FaChartLine className="text-xs" />
              </span>
            </div>
            <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-emerald-600">{completedTasks}</p>
            <p className="mt-1 text-[11px] text-slate-400">Total deliverables</p>
          </div>

          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Needs Attention</span>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
                <FaShieldHalved className="text-xs" />
              </span>
            </div>
            <p className={`mt-2 text-2xl sm:text-3xl font-extrabold ${attentionTasks > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
              {attentionTasks}
            </p>
            <p className="mt-1 text-[11px] text-slate-400">Blocked or failed</p>
          </div>
        </section>

        {/* Tab Navigation Pill Bar */}
        <nav aria-label="Dashboard views" className="mb-6 flex gap-1.5 overflow-x-auto rounded-2xl border border-slate-200/80 bg-white/70 p-1.5 backdrop-blur-md shadow-sm scrollbar-none">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                    : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                }`}
              >
                <Icon className={`text-xs ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span className={`inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold ${
                    isActive ? 'bg-white/25 text-white' : 'bg-slate-200/70 text-slate-600'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Tab Content Panels */}
        {userData === null ? (
          <section className="dashboard-card p-10 text-center">
            {dataError ? (
              <>
                <h2 className="text-lg font-bold text-slate-900">We couldn’t load your team</h2>
                <p role="alert" className="mt-2 text-sm text-rose-600">{dataError}</p>
                <button
                  type="button"
                  onClick={() => refresh().catch(error => console.error('Retrying team load failed:', error))}
                  className="mt-4 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700"
                >
                  Retry Loading
                </button>
              </>
            ) : (
              <div className="py-6 flex flex-col items-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent mb-3" />
                <p role="status" className="text-sm font-medium text-slate-500">Loading your workspace…</p>
              </div>
            )}
          </section>
        ) : userData.length === 0 ? (
          <section className="dashboard-card px-6 py-14 text-center sm:px-12">
            <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-indigo-50 text-xl font-bold text-indigo-600">
              <FaUserPlus />
            </span>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">Your workspace is ready for its first teammate</h2>
            <p className="mx-auto mt-2 max-w-lg text-sm text-slate-500">
              Invite team members below to unlock task assignment, progress tracking, and company workflows.
            </p>
            <div className="mt-8 max-w-2xl mx-auto text-left">
              <InviteEmployee />
            </div>
          </section>
        ) : (
          <div className="space-y-6">
            {/* OVERVIEW TAB */}
            {activeTab === 'overview' && (
              <div className="space-y-6 animate-fade-in">
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                  <div className="lg:col-span-5">
                    <CreateTask />
                  </div>
                  <div className="lg:col-span-7">
                    <AllTask />
                  </div>
                </div>

                <div className="mt-6">
                  <TaskReports />
                </div>
              </div>
            )}

            {/* TASKS TAB */}
            {activeTab === 'tasks' && (
              <div className="space-y-6 animate-fade-in">
                <TaskManagement />
                <div className="mt-6">
                  <CreateTask />
                </div>
              </div>
            )}

            {/* TEAM & INVITES TAB */}
            {activeTab === 'team' && (
              <div className="space-y-6 animate-fade-in">
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <InviteEmployee />
                  <BulkInviteEmployees />
                </div>
                <TeamManagement />
              </div>
            )}

            {/* LEAVES TAB */}
            {activeTab === 'leaves' && (
              <div className="space-y-6 animate-fade-in">
                <LeaveManagement />
              </div>
            )}

            {/* REPORTS TAB */}
            {activeTab === 'reports' && (
              <div className="space-y-6 animate-fade-in">
                <TaskReports />
              </div>
            )}

            {/* AUDIT TRAIL TAB */}
            {activeTab === 'audit' && (
              <div className="space-y-6 animate-fade-in">
                <AuditTrail />
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminDashboard;

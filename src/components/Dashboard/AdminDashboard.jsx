import React, { useContext } from 'react';
import { AuthContext } from '../../context/AuthProvider';
import Header from '../other/Header';
import CreateTask from '../other/CreateTask';
import AllTask from '../other/AllTask';
import InviteEmployee from '../other/InviteEmployee';
import TaskManagement from '../other/TaskManagement';
import TeamManagement from '../other/TeamManagement';
import TaskReports from '../other/TaskReports';

const AdminDashboard = (props) => {
  const { userData, dataError, refresh } = useContext(AuthContext);

  return (
    <div className="dashboard-shell">
      <div className="dashboard-topbar">
        <div className="dashboard-topbar-content">
          <Header changeUser={props.changeUser} data={props.data} />
        </div>
      </div>

      <main className="dashboard-content">
        <div className="dashboard-heading">
          <div>
            <h2>Workspace overview</h2>
            <p>Bring your team’s work into focus.</p>
          </div>
          <span className="hidden rounded-full border border-indigo-100 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 shadow-sm sm:inline-flex">
            Admin workspace
          </span>
        </div>
        <section className="dashboard-section">
          <InviteEmployee />
        </section>
        <div className="dashboard-grid">
          {userData === null ? (
            <section className="dashboard-card col-span-full p-8 text-center">
              {dataError ? (
                <>
                  <h2 className="text-lg font-bold text-slate-900">We couldn’t load your team</h2>
                  <p role="alert" className="mt-2 text-sm text-danger">{dataError}</p>
                  <button
                    type="button"
                    onClick={() => refresh().catch(error => console.error('Retrying team load failed:', error))}
                    className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white"
                  >
                    Retry
                  </button>
                </>
              ) : <p role="status" className="text-neutral-500">Loading your workspace…</p>}
            </section>
          ) : userData.length === 0 ? (
            <section className="dashboard-card col-span-full px-6 py-12 text-center sm:px-10">
              <span className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-indigo-50 text-lg font-bold text-indigo-600">+</span>
              <h2 className="text-xl font-bold tracking-tight text-slate-900">Your workspace is ready for its first teammate</h2>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">
                Invite an employee above. Once they accept, you can assign tasks and track progress here.
              </p>
            </section>
          ) : (
            <>
              <div><CreateTask /></div>
              <div><AllTask /></div>
            </>
          )}
        </div>
        {userData !== null && (
          <div className="mt-6 space-y-6">
            <TaskReports />
            <TaskManagement />
            <TeamManagement />
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminDashboard;
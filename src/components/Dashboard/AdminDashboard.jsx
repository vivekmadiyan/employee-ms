import React, { useContext } from 'react';
import { AuthContext } from '../../context/AuthProvider';
import Header from '../other/Header';
import CreateTask from '../other/CreateTask';
import AllTask from '../other/AllTask';
import InviteEmployee from '../other/InviteEmployee';

const AdminDashboard = (props) => {
  const { userData, dataError, refresh } = useContext(AuthContext);

  return (
    <div className="min-h-screen">
      <div className="border-b border-neutral-300 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Header changeUser={props.changeUser} data={props.data} />
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8"><InviteEmployee /></div>
        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-3">
          {userData === null ? (
            <section className="lg:col-span-3 rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
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
            <section className="lg:col-span-3 rounded-2xl border border-dashed border-neutral-300 bg-white px-6 py-10 text-center shadow-sm sm:px-10">
              <h2 className="text-xl font-bold text-slate-900">Your workspace is ready for its first teammate</h2>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">
                Invite an employee above. Once they accept, you can assign tasks and track progress here.
              </p>
            </section>
          ) : (
            <>
              <div className="lg:col-span-1"><CreateTask /></div>
              <div className="lg:col-span-2"><AllTask /></div>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
import React, { useContext } from 'react';
import { FaHeartPulse } from 'react-icons/fa6';
import { AuthContext } from '../../context/AuthProvider';

const AllTask = () => {
  const { userData, dataError, refresh } = useContext(AuthContext);

  if (userData === null) {
    return (
      <div className="dashboard-card p-8 text-center">
        {dataError ? (
          <>
            <p role="alert" className="text-sm font-semibold text-rose-600">{dataError}</p>
            <button 
              type="button" 
              onClick={() => refresh().catch(error => console.error('Retrying employee load failed:', error))} 
              className="mt-3 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700"
            >
              Retry
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center py-4">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent mb-2" />
            <p role="status" className="text-xs text-slate-400">Loading team progress…</p>
          </div>
        )}
      </div>
    );
  }

  if (userData.length === 0) {
    return (
      <div className="dashboard-card border-dashed p-8 text-center">
        <h3 className="text-base font-bold text-slate-800">Your team is ready to grow</h3>
        <p className="mt-1 text-xs text-slate-500">Invite an employee above to start assigning and tracking work.</p>
      </div>
    );
  }

  return (
    <div className="dashboard-card overflow-hidden rounded-2xl shadow-sm">
      <div className="border-b border-slate-100 p-5 sm:p-6 bg-white">
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-indigo-600">
            <FaHeartPulse className="text-[10px]" /> Team Health
          </span>
        </div>
        <h2 className="dashboard-card-heading mt-1 text-slate-900">Workload & Task Balance</h2>
        <p className="mt-0.5 text-xs text-slate-500">Real-time status of assigned responsibilities per team member.</p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-100 text-left">
          <thead className="bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-500">
            <tr>
              <th scope="col" className="px-5 py-3 sm:px-6">Employee</th>
              <th scope="col" className="px-4 py-3 text-center">New</th>
              <th scope="col" className="px-4 py-3 text-center">In Progress</th>
              <th scope="col" className="px-4 py-3 text-center">Completed</th>
              <th scope="col" className="px-4 py-3 text-center">Attention</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white text-xs">
            {userData.map((elem) => {
              const initial = elem.firstName?.slice(0, 1).toUpperCase() || 'U';
              return (
                <tr key={elem.id} className="transition-colors hover:bg-slate-50/70">
                  <td className="whitespace-nowrap px-5 py-3.5 sm:px-6 font-semibold text-slate-800">
                    <div className="flex items-center gap-2.5">
                      <span className="inline-grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-tr from-indigo-50 to-indigo-100 text-xs font-bold text-indigo-700 ring-1 ring-indigo-200/50">
                        {initial}
                      </span>
                      <div>
                        <p className="text-xs font-bold text-slate-900">{elem.firstName}</p>
                        <p className="text-[11px] font-normal text-slate-400">{elem.department || 'General'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-center">
                    <span className="inline-flex min-w-6 items-center justify-center rounded-lg bg-blue-50 px-2 py-0.5 font-bold text-blue-700">
                      {elem.taskCounts.newTask}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-center">
                    <span className="inline-flex min-w-6 items-center justify-center rounded-lg bg-indigo-50 px-2 py-0.5 font-bold text-indigo-700">
                      {elem.taskCounts.active}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-center">
                    <span className="inline-flex min-w-6 items-center justify-center rounded-lg bg-emerald-50 px-2 py-0.5 font-bold text-emerald-700">
                      {elem.taskCounts.completed}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-center">
                    <span className={`inline-flex min-w-6 items-center justify-center rounded-lg px-2 py-0.5 font-bold ${
                      elem.taskCounts.failed > 0 ? 'bg-rose-50 text-rose-700 font-extrabold ring-1 ring-rose-200' : 'bg-slate-50 text-slate-400'
                    }`}>
                      {elem.taskCounts.failed}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AllTask;

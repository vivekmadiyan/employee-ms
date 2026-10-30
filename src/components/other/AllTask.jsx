import React, { useContext } from 'react';
import { AuthContext } from '../../context/AuthProvider'; // Make sure this path is correct

const AllTask = () => {
  // CORRECTED: Destructure the context value as an object {}
  const { userData, dataError, refresh } = useContext(AuthContext);

  // If userData hasn't loaded yet from the provider, show a loading message
  if (userData === null) {
    return (
        <div className="dashboard-card p-6 text-center">
            {dataError ? (
              <>
                <p role="alert" className="text-sm text-danger">{dataError}</p>
                <button type="button" onClick={() => refresh().catch(error => console.error('Retrying employee load failed:', error))} className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white">
                  Retry
                </button>
              </>
            ) : <p role="status" className="text-neutral-400">Loading employee data…</p>}
        </div>
    );
  }

  if (userData.length === 0) {
    return (
      <div className="dashboard-card border-dashed p-8 text-center">
        <h2 className="text-lg font-bold text-neutral-700">Your team is ready to grow</h2>
        <p className="mt-2 text-sm text-neutral-500">Invite an employee above to start assigning and tracking work.</p>
      </div>
    );
  }

  return (
    <div className="dashboard-card overflow-hidden">
      <div className="p-5 sm:p-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-600">Team health</p>
        <h2 className="dashboard-card-heading mt-1">Employee task summary</h2>
        <p className="mt-1 text-xs text-slate-500">A quick view of workload and progress.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-neutral-300">
          <thead className="bg-slate-50">
            <tr>
              <th scope="col" className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 sm:px-6">
                Employee
              </th>
              <th scope="col" className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">
                New
              </th>
              <th scope="col" className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Active
              </th>
              <th scope="col" className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Completed
              </th>
              <th scope="col" className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Attention
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {userData.map((elem) => (
              <tr key={elem.id} className="transition-colors hover:bg-slate-50/80">
                <td className="whitespace-nowrap px-5 py-4 text-sm font-semibold text-slate-700 sm:px-6">
                  <span className="mr-2 inline-grid h-8 w-8 place-items-center rounded-full bg-indigo-50 text-xs font-bold text-indigo-700">
                    {elem.firstName?.slice(0, 1).toUpperCase()}
                  </span>
                  {elem.firstName}
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-sm font-semibold text-blue-600">
                  {elem.taskCounts.newTask}
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-sm font-semibold text-violet-600">
                  {elem.taskCounts.active}
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-sm font-semibold text-emerald-600">
                  {elem.taskCounts.completed}
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-sm font-semibold text-danger">
                  {elem.taskCounts.failed}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AllTask;
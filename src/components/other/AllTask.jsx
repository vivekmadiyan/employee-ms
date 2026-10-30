import React, { useContext } from 'react';
import { AuthContext } from '../../context/AuthProvider'; // Make sure this path is correct

const AllTask = () => {
  // CORRECTED: Destructure the context value as an object {}
  const { userData, dataError, refresh } = useContext(AuthContext);

  // If userData hasn't loaded yet from the provider, show a loading message
  if (userData === null) {
    return (
        <div className="overflow-hidden rounded-xl border border-neutral-300 bg-white p-6 text-center shadow-sm">
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
      <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-8 text-center shadow-sm">
        <h2 className="text-lg font-bold text-neutral-700">Your team is ready to grow</h2>
        <p className="mt-2 text-sm text-neutral-500">Invite an employee above to start assigning and tracking work.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-300 bg-white shadow-sm">
      <div className="p-6">
        <h2 className="text-lg font-bold text-neutral-500">Employee Task Summary</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-neutral-300">
          <thead className="bg-neutral-200">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-neutral-400">
                Employee Name
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-neutral-400">
                New Task
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-neutral-400">
                Active Task
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-neutral-400">
                Completed
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-neutral-400">
                Failed
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-300 bg-white">
            {userData.map((elem, idx) => (
              <tr key={idx}>
                <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-neutral-500">
                  {elem.firstName}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm font-semibold text-blue-600">
                  {elem.taskCounts.newTask}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm font-semibold text-yellow-600">
                  {elem.taskCounts.active}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm font-semibold text-emerald-600">
                  {elem.taskCounts.completed}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm font-semibold text-danger">
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
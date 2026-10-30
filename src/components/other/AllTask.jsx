import React, { useContext } from 'react';
import { AuthContext } from '../../context/AuthProvider'; // Make sure this path is correct

const AllTask = () => {
  // CORRECTED: Destructure the context value as an object {}
  const { userData } = useContext(AuthContext);

  // If userData hasn't loaded yet from the provider, show a loading message
  if (!userData || userData.length === 0) {
    return (
        <div className="overflow-hidden rounded-xl border border-neutral-300 bg-white p-6 text-center text-neutral-400 shadow-sm">
            Loading employee data or no data available...
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
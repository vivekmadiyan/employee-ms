import React, { useContext } from 'react';
import { AuthContext } from '../../context/AuthProvider'; // Make sure path is correct

const NewTask = ({ data, employeeId }) => {
  // 1. Get the update function from our context
  const { updateTaskStatus } = useContext(AuthContext);

  // 2. Create a handler function for the button click
  const handleAccept = () => {
    // 3. Call the master function with the correct IDs and the new status: 'active'
    updateTaskStatus(employeeId, data.id, 'active');
  };

  return (
    <div className="flex h-full w-80 flex-shrink-0 flex-col rounded-lg border-2 border-dashed border-neutral-300 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="rounded-full bg-neutral-200 px-3 py-1 text-xs font-medium text-neutral-500">
          {data.category}
        </span>
        <span className="text-xs text-neutral-400">{data.taskDate}</span>
      </div>
      <div className="flex-1 py-4">
        <h3 className="text-lg font-semibold text-neutral-500">{data.taskTitle}</h3>
        <p className="mt-2 text-sm leading-relaxed text-neutral-400">{data.taskDescription}</p>
      </div>
      {/* 4. Add the onClick handler to the button */}
      <button 
        onClick={handleAccept}
        className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-hover"
      >
        Accept Task
      </button>
    </div>
  );
};

export default NewTask;
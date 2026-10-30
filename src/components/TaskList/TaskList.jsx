import React from 'react';
import AcceptTask from './AcceptTask';
import NewTask from './NewTask';
import CompleteTask from './CompleteTask';
import FailedTask from './FailedTask';

const TaskList = ({ data }) => {
    if (!data || !data.tasks || data.tasks.length === 0) {
        return (
            <div>
              <h2 className="text-lg font-semibold text-neutral-500">Your Tasks</h2>
              <div className='mt-4 rounded-lg border border-dashed border-neutral-300 bg-white py-12 text-center text-neutral-400'>
                  You have no tasks right now.
              </div>
            </div>
        )
    }

  return (
    <div>
      <h2 className="text-lg font-semibold text-neutral-500">Your Tasks</h2>
      <div
        id="tasklist"
        className="mt-4 flex w-full gap-6 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent"
      >
        {data.tasks.map((task) => {
          if (task.completed) return <CompleteTask key={task.id} data={task} />;
          if (task.failed) return <FailedTask key={task.id} data={task} />;
          if (task.active) return <AcceptTask key={task.id} data={task} employeeId={data.id} />;
          if (task.newTask) return <NewTask key={task.id} data={task} employeeId={data.id} />;
          return null;
        })}
      </div>
    </div>
  );
};

export default TaskList;
import React from 'react';
import AcceptTask from './AcceptTask';
import NewTask from './NewTask';
import CompleteTask from './CompleteTask';
import FailedTask from './FailedTask';

const TaskList = ({ data }) => {
    if (!data || !data.tasks || data.tasks.length === 0) {
        return (
            <div>
              <h2 className="task-section-heading">Your tasks</h2>
              <div className="task-empty mt-3 py-12 text-center text-sm">
                  Nothing on your plate right now. New assignments will show up here.
              </div>
            </div>
        )
    }

  return (
    <div>
      <h2 className="task-section-heading">Your tasks</h2>
      <div
        id="tasklist"
        className="task-board"
      >
        {data.tasks.map((task) => {
          if (task.completed) return <CompleteTask key={task.id} data={task} />;
          if (task.failed) return <FailedTask key={task.id} data={task} />;
          if (task.active) return <AcceptTask key={task.id} data={task} />;
          if (task.newTask) return <NewTask key={task.id} data={task} />;
          return null;
        })}
      </div>
    </div>
  );
};

export default TaskList;
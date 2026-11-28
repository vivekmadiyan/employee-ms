import React, { useEffect, useState } from 'react';
import { FaCircleCheck, FaInbox } from 'react-icons/fa6';
import AcceptTask from './AcceptTask';
import NewTask from './NewTask';
import CompleteTask from './CompleteTask';
import FailedTask from './FailedTask';
import CalendarExportButton from '../other/CalendarExportButton';
import { workspaceDateKey } from '../../utils/workFocus';
import { WorkspaceSettingsContext } from '../../context/WorkspaceSettingsContext';

const TaskList = ({ data, focusRequest, initialView }) => {
  const { settings } = React.useContext(WorkspaceSettingsContext);
  const today = initialView?.today ?? workspaceDateKey(settings.timeZone);
  const dueToday = task => (task.newTask || task.active) && task.taskDate === today;
  const [selection, setSelection] = useState({ filter: initialView?.filter ?? 'all', focusRequest });
  const filter = selection.focusRequest === focusRequest ? selection.filter : 'all';

  useEffect(() => {
    if (!focusRequest) return;
    const task = document.getElementById(`assigned-task-${focusRequest.taskId}`);
    task?.focus({ preventScroll: true });
    task?.scrollIntoView({ block: 'start' });
  }, [focusRequest]);

  if (!data || !data.tasks || data.tasks.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm">
        <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-400">
          <FaInbox className="text-xl" />
        </span>
        <h3 className="text-base font-bold text-slate-800">Your plate is completely clear</h3>
        <p className="mt-1 text-sm text-slate-500">
          Nothing on your plate right now. New task assignments will show up here.
        </p>
      </div>
    );
  }

  const tasks = data.tasks;
  const filteredTasks = tasks.filter(task => {
    if (filter === 'all') return true;
    if (filter === 'new') return task.newTask;
    if (filter === 'active') return task.active;
    if (filter === 'completed') return task.completed;
    if (filter === 'failed') return task.failed;
    if (filter === 'overdue') return task.overdue;
    if (filter === 'today') return dueToday(task);
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Subheader & Filter chips */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Assigned Tasks</h2>
          <p className="text-xs text-slate-500">Manage deliverables and mark progress.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <CalendarExportButton tasks={filteredTasks} />
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          {[
            { id: 'all', label: 'All', count: tasks.length },
            { id: 'active', label: 'In Progress', count: tasks.filter(t => t.active).length },
            { id: 'new', label: 'New', count: tasks.filter(t => t.newTask).length },
            { id: 'completed', label: 'Completed', count: tasks.filter(t => t.completed).length },
            { id: 'failed', label: 'Needs Attention', count: tasks.filter(t => t.failed).length },
            { id: 'overdue', label: 'Overdue', count: tasks.filter(t => t.overdue).length },
            { id: 'today', label: 'Due today', count: tasks.filter(dueToday).length },
          ].map(pill => (
            <button
              key={pill.id}
              type="button"
              onClick={() => setSelection({ filter: pill.id, focusRequest })}
              aria-pressed={filter === pill.id}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                filter === pill.id
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <span>{pill.label}</span>
              <span className={`inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] ${
                filter === pill.id ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-600'
              }`}>
                {pill.count}
              </span>
            </button>
          ))}
          </div>
        </div>
      </div>

      {/* Task Grid */}
      <div id="tasklist" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredTasks.length ? (
          filteredTasks.map(task => {
            const Card = task.completed ? CompleteTask : task.failed ? FailedTask : task.active ? AcceptTask : NewTask;
            return (
              <div key={task.id} id={`assigned-task-${task.id}`} className="assigned-task-target grid"
                tabIndex={-1} role="group" aria-label={task.taskTitle}>
                <Card data={task} />
              </div>
            );
          })
        ) : (
          <div className="col-span-full rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-slate-500">
            <FaCircleCheck className="mx-auto mb-2 text-xl text-emerald-500" />
            <p className="text-sm font-medium">No tasks found in this view.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskList;

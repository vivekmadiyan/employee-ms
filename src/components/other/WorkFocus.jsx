import React, { useContext, useState } from 'react';
import {
  FaArrowRight, FaCalendarDay, FaCalendarWeek, FaCircleCheck, FaClock, FaCrosshairs
} from 'react-icons/fa6';
import { groupFocusTasks } from '../../utils/workFocus';
import { WorkspaceSettingsContext } from '../../context/WorkspaceSettingsContext';
import './WorkFocus.css';

const buckets = [
  { id: 'overdue', label: 'Overdue', empty: 'No overdue tasks.', icon: FaClock },
  { id: 'today', label: 'Due today', empty: 'Nothing is due today.', icon: FaCalendarDay },
  { id: 'upcoming', label: 'Next 7 days', empty: 'Nothing is due in the next seven days.', icon: FaCalendarWeek }
];
const priorities = { low: 'Low', medium: 'Medium', high: 'High' };
const dateFormat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
const previewLimit = 5;

export default function WorkFocus({ admin = false, employees = [], tasks = [], onOpenTasks }) {
  const [selected, setSelected] = useState(null);
  const { settings } = useContext(WorkspaceSettingsContext);
  const groups = groupFocusTasks(admin ? employees.flatMap(employee => employee.tasks || []) : tasks, new Date(), settings.timeZone);
  const owners = new Map(employees.map(employee => [employee.id, employee.firstName]));
  const bucket = buckets.find(({ id }) => id === selected)
    || buckets.find(({ id }) => groups[id].length > 0) || buckets[0];
  const visibleTasks = groups[bucket.id];

  return (
    <section className="work-focus" aria-labelledby="work-focus-title">
      <header className="work-focus-head">
        <span className="work-focus-mark"><FaCrosshairs aria-hidden="true" /></span>
        <div>
          <h2 id="work-focus-title">Work Focus</h2>
          <p>{admin ? 'See what needs attention across your team.' : 'See what needs your attention first.'}</p>
        </div>
        <button type="button" className="work-focus-all" onClick={() => onOpenTasks()}>
          {admin ? 'Open Task Hub' : 'Go to assigned tasks'} <FaArrowRight aria-hidden="true" />
        </button>
      </header>

      <div className="work-focus-groups" role="group" aria-label="Task deadlines">
        {buckets.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" data-bucket={id} aria-pressed={bucket.id === id}
            onClick={() => setSelected(id)}>
            <Icon aria-hidden="true" />
            <span>{label}</span>
            <strong>{groups[id].length}</strong>
          </button>
        ))}
      </div>

      {visibleTasks.length ? (
        <ul className="work-focus-list" aria-label={`${bucket.label} tasks`}>
          {visibleTasks.slice(0, previewLimit).map(task => {
            const owner = owners.get(task.assignedTo);
            const priority = priorities[task.priority] || priorities.medium;
            return (
              <li key={task.id}>
                <button type="button" className="work-focus-task" onClick={() => onOpenTasks(task)}>
                  <span className="work-focus-task-copy">
                    <strong>{task.taskTitle}</strong>
                    <span>
                      {owner && <>{owner} <span aria-hidden="true">·</span> </>}
                      Due <time dateTime={task.taskDate}>{dateFormat.format(new Date(`${task.taskDate}T00:00:00Z`))}</time>
                    </span>
                  </span>
                  <span className="work-focus-priority" data-priority={task.priority}>{priority} priority</span>
                  <FaArrowRight className="work-focus-row-arrow" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="work-focus-empty" role="status">
          <FaCircleCheck aria-hidden="true" /> {bucket.empty}
        </p>
      )}
      {visibleTasks.length > previewLimit && (
        <p className="work-focus-limit">Showing {previewLimit} of {visibleTasks.length}. Open the full task list to see the rest.</p>
      )}
    </section>
  );
}

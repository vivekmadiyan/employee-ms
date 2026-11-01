import React from 'react';
import { FaCalendarPlus } from 'react-icons/fa6';
import { downloadTasksCalendar } from '../../utils/calendar';

export default function CalendarExportButton({ tasks, className = '' }) {
  const exportableTasks = tasks.filter(task => !task.archived);
  return (
    <button
      type="button"
      disabled={!exportableTasks.length}
      onClick={() => downloadTasksCalendar(exportableTasks)}
      title="Import task due dates into Google Calendar, Outlook, or Apple Calendar"
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      <FaCalendarPlus aria-hidden="true" className="text-xs text-indigo-500" />
      <span>Add to calendar</span>
    </button>
  );
}

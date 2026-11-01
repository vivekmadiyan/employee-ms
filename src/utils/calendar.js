const escapeText = value => String(value || '')
  .replace(/\\/g, '\\\\')
  .replace(/\r\n|\r|\n/g, '\\n')
  .replace(/,/g, '\\,')
  .replace(/;/g, '\\;');

const foldLine = line => {
  let folded = '';
  let current = '';
  let bytes = 0;
  for (const character of line) {
    const characterBytes = new TextEncoder().encode(character).length;
    if (bytes + characterBytes > 75) {
      folded += `${current}\r\n `;
      current = '';
      bytes = 1;
    }
    current += character;
    bytes += characterBytes;
  }
  return folded + current;
};

const nextDate = value => {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10).replace(/-/g, '');
};

const isValidDate = value => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

export function createTasksCalendar(tasks, now = new Date()) {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const events = tasks.filter(task => !task.archived && isValidDate(task.taskDate)).map(task => [
    'BEGIN:VEVENT',
    `UID:${escapeText(task.id)}@employee-ms`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${task.taskDate.replace(/-/g, '')}`,
    `DTEND;VALUE=DATE:${nextDate(task.taskDate)}`,
    `SUMMARY:${escapeText(task.taskTitle)}`,
    `DESCRIPTION:${escapeText(task.taskDescription)}`,
    `CATEGORIES:${escapeText(task.category)}`,
    `PRIORITY:${task.priority === 'high' ? 1 : task.priority === 'low' ? 9 : 5}`,
    'STATUS:CONFIRMED',
    'END:VEVENT'
  ]);
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//EmployeeMS//Task Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...events.flat(),
    'END:VCALENDAR',
    ''
  ].map(foldLine).join('\r\n');
}

export function downloadTasksCalendar(tasks, filename = 'employee-ms-tasks.ics') {
  const content = createTasksCalendar(tasks);
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

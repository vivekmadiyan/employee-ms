import assert from 'node:assert/strict';
import test from 'node:test';
import { createTasksCalendar } from './calendar.js';

test('creates importable all-day calendar events and escapes task text', () => {
  const calendar = createTasksCalendar([{
    id: 17,
    taskTitle: 'Review, approve; launch',
    taskDescription: 'First line\nSecond line',
    taskDate: '2026-03-05',
    category: 'Operations',
    priority: 'high'
  }], new Date('2026-03-01T10:20:30.000Z'));

  assert.match(calendar, /BEGIN:VCALENDAR\r\nVERSION:2\.0/);
  assert.match(calendar, /DTSTAMP:20260301T102030Z/);
  assert.match(calendar, /DTSTART;VALUE=DATE:20260305/);
  assert.match(calendar, /DTEND;VALUE=DATE:20260306/);
  assert.match(calendar, /SUMMARY:Review\\, approve\\; launch/);
  assert.match(calendar, /DESCRIPTION:First line\\nSecond line/);
  assert.match(calendar, /PRIORITY:1/);
});

test('omits archived tasks and invalid dates, and folds long UTF-8 lines', () => {
  const calendar = createTasksCalendar([
    { id: 1, taskTitle: 'Archived task', taskDate: '2026-03-05', archived: true },
    { id: 2, taskTitle: 'Invalid date', taskDate: '2026-02-31' },
    { id: 3, taskTitle: 'Ä'.repeat(100), taskDate: '2026-03-05' }
  ]);
  const lines = calendar.split('\r\n');

  assert.doesNotMatch(calendar, /Archived task|Invalid date/);
  assert.match(calendar, /SUMMARY:Ä{1,}/);
  assert.ok(lines.every(line => new TextEncoder().encode(line).length <= 75));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { groupFocusTasks } from './workFocus.js';

test('Work Focus uses the local calendar day and seven following dates across a month boundary', () => {
  const now = new Date(2026, 10, 28, 23, 45);
  const tasks = [
    { id: 1, taskDate: '2026-11-27', priority: 'medium' },
    { id: 2, taskDate: '2026-11-28', priority: 'medium' },
    { id: 3, taskDate: '2026-11-29', priority: 'medium' },
    { id: 4, taskDate: '2026-12-05', priority: 'medium' },
    { id: 5, taskDate: '2026-12-06', priority: 'medium' }
  ];
  const groups = groupFocusTasks(tasks, now);
  assert.deepEqual(groups.overdue.map(task => task.id), [1]);
  assert.deepEqual(groups.today.map(task => task.id), [2]);
  assert.deepEqual(groups.upcoming.map(task => task.id), [3, 4]);
});

test('Work Focus excludes closed or archived assignments and orders open work by priority then date', () => {
  const tasks = [
    { id: 1, taskDate: '2026-11-26', priority: 'low' },
    { id: 2, taskDate: '2026-11-27', priority: 'high' },
    { id: 3, taskDate: '2026-11-26', priority: 'high' },
    { id: 4, taskDate: '2026-11-27', priority: 'high', completed: true },
    { id: 5, taskDate: '2026-11-27', priority: 'high', failed: true },
    { id: 6, taskDate: '2026-11-27', priority: 'high', archived: true }
  ];
  assert.deepEqual(groupFocusTasks(tasks, new Date(2026, 10, 28)).overdue.map(task => task.id), [3, 2, 1]);
});

test('Work Focus treats the same deadline consistently across a workspace midnight', () => {
  const now = new Date('2026-11-27T18:45:00Z');
  const tasks = [{ id: 1, taskDate: '2026-11-27' }, { id: 2, taskDate: '2026-11-28' }];
  assert.deepEqual(groupFocusTasks(tasks, now, 'UTC').today.map(task => task.id), [1]);
  assert.deepEqual(groupFocusTasks(tasks, now, 'Asia/Kolkata').overdue.map(task => task.id), [1]);
  assert.deepEqual(groupFocusTasks(tasks, now, 'Asia/Kolkata').today.map(task => task.id), [2]);
});

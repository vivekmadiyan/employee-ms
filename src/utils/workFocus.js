const priorityOrder = { high: 0, medium: 1, low: 2 };

export function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function groupFocusTasks(tasks, now = new Date()) {
  const today = localDateKey(now);
  const weekEnd = new Date(now);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const nextWeek = localDateKey(weekEnd);
  const groups = { overdue: [], today: [], upcoming: [] };

  for (const task of tasks) {
    if (task.archived || task.completed || task.failed || !task.taskDate) continue;
    if (task.taskDate < today) groups.overdue.push(task);
    else if (task.taskDate === today) groups.today.push(task);
    else if (task.taskDate <= nextWeek) groups.upcoming.push(task);
  }

  Object.values(groups).forEach(group => group.sort((first, second) =>
    (priorityOrder[first.priority] ?? 1) - (priorityOrder[second.priority] ?? 1)
      || first.taskDate.localeCompare(second.taskDate)
      || first.id - second.id
  ));
  return groups;
}

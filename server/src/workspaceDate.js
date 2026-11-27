export function workspaceDateKey(timeZone = 'UTC', date = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export function isTimeZone(value) {
  try {
    workspaceDateKey(value);
    return value === 'UTC' || /^[a-zA-Z_]+(?:\/[A-Za-z0-9_+-]+)+$/.test(value);
  } catch {
    return false;
  }
}

export function readTaskLink() {
  if (window.location.pathname !== '/') return null;
  const value = new URLSearchParams(window.location.search).get('task');
  if (!value || !/^\d{1,10}$/.test(value)) return null;
  const id = Number(value);
  return id > 0 && id <= 2_147_483_647 ? id : null;
}

export function clearTaskLink() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has('task')) return;
  url.searchParams.delete('task');
  window.history.replaceState(window.history.state, '', url);
}

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:5000/api' : '');

export const api = async (path, options = {}) => {
  if (!API_URL) {
    throw new Error('The API is not configured. Set VITE_API_URL for this deployment.');
  }

  const token = localStorage.getItem('ems_token');
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) {
    localStorage.removeItem('ems_token');
    localStorage.removeItem('ems_user');
    window.dispatchEvent(new Event('ems:session-expired'));
  }
  if (!response.ok) throw new Error(data.message || 'Request failed');
  return data;
};

export const loginApi = (email, password) => api('/auth/login', {method:'POST', body:JSON.stringify({email,password})});
export const updateProfileApi = payload => api('/auth/me', { method: 'PATCH', body: JSON.stringify(payload) });
export const requestPasswordResetApi = email => api('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
export const resetPasswordApi = (token, password) => api('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) });
export const getEmployeeDashboard = () => api('/dashboard/employee');
export const getEmployees = () => api('/employees');
export const getAdminDashboard = () => api('/dashboard/admin');
export const getTasksApi = (filters = {}) => {
  const search = new URLSearchParams(Object.entries(filters).filter(([, value]) => value !== '' && value !== undefined && value !== null));
  const query = search.toString();
  return api(`/tasks${query ? `?${query}` : ''}`);
};
export const createTaskApi = (payload) => api('/tasks', {method:'POST', body:JSON.stringify(payload)});
export const updateTaskApi = (id, payload) => api(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
export const archiveTaskApi = (id, archived = true) => api(`/tasks/${id}/archive`, { method: 'PATCH', body: JSON.stringify({ archived }) });
export const updateTaskStatusApi = (id, status) => api(`/tasks/${id}/status`, {method:'PATCH', body:JSON.stringify({status})});
export const registerCompanyApi = (payload) => api('/onboarding/register-company', {method:'POST', body:JSON.stringify(payload)});
export const createEmployeeApi = (payload) => api('/employees', {method:'POST', body:JSON.stringify(payload)});
export const updateEmployeeApi = (id, payload) => api(`/employees/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
export const updateEmployeeStatusApi = (id, active) => api(`/employees/${id}/status`, { method: 'PATCH', body: JSON.stringify({ active }) });

export const createInvitationApi = (payload) => api('/invitations', {method:'POST', body:JSON.stringify(payload)});
export const getInvitationApi = (token) => api(`/invitations/${encodeURIComponent(token)}`);
export const acceptInvitationApi = (token, password) => api(`/invitations/${encodeURIComponent(token)}/accept`, {method:'POST', body:JSON.stringify({password})});
export const getInvitationsApi = () => api('/invitations');
export const resendInvitationApi = id => api(`/invitations/${id}/resend`, { method: 'POST' });
export const revokeInvitationApi = id => api(`/invitations/${id}`, { method: 'DELETE' });
export const getNotificationsApi = () => api('/notifications');
export const subscribeNotificationsApi = (onUpdate, onError = () => {}) => {
  const controller = new AbortController();
  let retryDelay = 1000;

  const connect = async () => {
    while (!controller.signal.aborted) {
      try {
        if (!API_URL) throw new Error('The API is not configured. Set VITE_API_URL for this deployment.');
        const token = localStorage.getItem('ems_token');
        if (!token) {
          window.dispatchEvent(new Event('ems:session-expired'));
          return;
        }

        const response = await fetch(`${API_URL}/notifications/stream`, {
          headers: { Accept: 'text/event-stream', Authorization: `Bearer ${token}` },
          signal: controller.signal
        });
        if (response.status === 401) {
          localStorage.removeItem('ems_token');
          localStorage.removeItem('ems_user');
          window.dispatchEvent(new Event('ems:session-expired'));
          return;
        }
        if (!response.ok || !response.body) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.message || `Live notifications failed (${response.status}).`);
        }

        retryDelay = 1000;
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (!controller.signal.aborted) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split(/\r?\n\r?\n/);
          buffer = events.pop() || '';
          for (const event of events) {
            const eventName = event.split(/\r?\n/).find(line => line.startsWith('event:'))?.slice(6).trim();
            const data = event.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trim()).join('\n');
            if (eventName === 'notifications' && data) onUpdate(JSON.parse(data));
            if (eventName === 'stream-error' && data) onError(JSON.parse(data).message);
          }
        }
        reader.releaseLock();
        if (!controller.signal.aborted) throw new Error('Live notifications disconnected.');
      } catch (error) {
        if (controller.signal.aborted) return;
        onError(error.message || 'Live notifications are reconnecting.');
        await new Promise(resolve => {
          const timer = window.setTimeout(resolve, retryDelay);
          controller.signal.addEventListener('abort', () => {
            window.clearTimeout(timer);
            resolve();
          }, { once: true });
        });
        retryDelay = Math.min(retryDelay * 2, 30_000);
      }
    }
  };

  connect();
  return () => controller.abort();
};
export const markNotificationReadApi = id => api(`/notifications/${id}/read`, { method: 'PATCH', body: '{}' });
export const markAllNotificationsReadApi = () => api('/notifications/read-all', { method: 'PATCH', body: '{}' });
export const getTaskCommentsApi = id => api(`/tasks/${id}/comments`);
export const createTaskCommentApi = (id, content) => api(`/tasks/${id}/comments`, { method: 'POST', body: JSON.stringify({ content }) });

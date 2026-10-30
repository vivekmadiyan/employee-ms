const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const api = async (path, options = {}) => {
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
export const getEmployeeDashboard = () => api('/dashboard/employee');
export const getEmployees = () => api('/employees');
export const getAdminDashboard = () => api('/dashboard/admin');
export const createTaskApi = (payload) => api('/tasks', {method:'POST', body:JSON.stringify(payload)});
export const updateTaskStatusApi = (id, status) => api(`/tasks/${id}/status`, {method:'PATCH', body:JSON.stringify({status})});
export const registerCompanyApi = (payload) => api('/onboarding/register-company', {method:'POST', body:JSON.stringify(payload)});
export const createEmployeeApi = (payload) => api('/employees', {method:'POST', body:JSON.stringify(payload)});

export const createInvitationApi = (payload) => api('/invitations', {method:'POST', body:JSON.stringify(payload)});
export const getInvitationApi = (token) => api(`/invitations/${encodeURIComponent(token)}`);
export const acceptInvitationApi = (token, password) => api(`/invitations/${encodeURIComponent(token)}/accept`, {method:'POST', body:JSON.stringify({password})});
export const getInvitationsApi = () => api('/invitations');

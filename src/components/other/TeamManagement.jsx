import React, { useCallback, useContext, useEffect, useState } from 'react';
import { FaArrowsRotate, FaCopy, FaUserGroup, FaPenToSquare } from 'react-icons/fa6';
import { getInvitationsApi, resendInvitationApi, revokeInvitationApi, updateEmployeeApi, updateEmployeeStatusApi } from '../../api';
import { AuthContext } from '../../context/AuthProvider';

const statusClass = status => ({
  pending: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200/50',
  accepted: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/50',
  expired: 'bg-slate-100 text-slate-600'
}[status] || 'bg-slate-100 text-slate-600');

export default function TeamManagement() {
  const { userData, refresh } = useContext(AuthContext);
  const [invitations, setInvitations] = useState([]);
  const [inviteError, setInviteError] = useState('');
  const [employeeError, setEmployeeError] = useState('');
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({ firstName: '', department: '' });
  const [copyMessage, setCopyMessage] = useState('');
  const [freshLinks, setFreshLinks] = useState({});

  const loadInvitations = useCallback(async () => {
    try {
      setInvitations(await getInvitationsApi());
      setInviteError('');
    } catch (error) {
      setInviteError(error.message);
    }
  }, []);

  useEffect(() => {
    loadInvitations();
    const onInvitationsUpdated = () => loadInvitations();
    window.addEventListener('ems:invitations-updated', onInvitationsUpdated);
    window.addEventListener('ems:workspace-updated', onInvitationsUpdated);
    return () => {
      window.removeEventListener('ems:invitations-updated', onInvitationsUpdated);
      window.removeEventListener('ems:workspace-updated', onInvitationsUpdated);
    };
  }, [loadInvitations]);

  const startEdit = employee => {
    setEditId(employee.id);
    setEditForm({ firstName: employee.firstName, department: employee.department });
    setEmployeeError('');
    setMessage('');
  };

  const saveEmployee = async event => {
    event.preventDefault();
    setBusyId(editId);
    setEmployeeError('');
    try {
      await updateEmployeeApi(editId, editForm);
      setEditId(null);
      setMessage('Employee details updated.');
      try {
        await refresh();
      } catch (refreshError) {
        setEmployeeError(`Employee details were saved, but the team list could not refresh: ${refreshError.message}`);
      }
    } catch (error) {
      setEmployeeError(error.message);
    } finally {
      setBusyId(null);
    }
  };

  const changeStatus = async employee => {
    setBusyId(employee.id);
    setEmployeeError('');
    setMessage('');
    try {
      await updateEmployeeStatusApi(employee.id, !employee.active);
      setMessage(employee.active ? 'Employee access deactivated.' : 'Employee access restored.');
      try {
        await refresh();
      } catch (refreshError) {
        setEmployeeError(`Access was updated, but the team list could not refresh: ${refreshError.message}`);
      }
    } catch (error) {
      setEmployeeError(error.message);
    } finally {
      setBusyId(null);
    }
  };

  const resend = async invitation => {
    setBusyId(invitation.id);
    setInviteError('');
    setCopyMessage('');
    try {
      const result = await resendInvitationApi(invitation.id);
      if (result.inviteUrl) {
        setFreshLinks(current => ({ ...current, [invitation.id]: result.inviteUrl }));
        const delivery = result.emailSent
          ? 'The email provider accepted the resend.'
          : result.emailStatus === 'not_configured'
            ? 'Invitation email is not configured.'
            : `Invitation email failed (${result.emailStatus}).`;
        try {
          await navigator.clipboard.writeText(result.inviteUrl);
          setCopyMessage(`${delivery} A fresh link for ${invitation.email} was copied; the previous link is no longer valid.`);
        } catch {
          setCopyMessage(`${delivery} A fresh link was created for ${invitation.email}; the previous link is no longer valid.`);
        }
      }
      await loadInvitations();
    } catch (error) {
      setInviteError(error.message);
    } finally {
      setBusyId(null);
    }
  };

  const revoke = async invitation => {
    if (!window.confirm(`Revoke the pending invitation for ${invitation.email}?`)) return;
    setBusyId(invitation.id);
    setInviteError('');
    try {
      await revokeInvitationApi(invitation.id);
      setInvitations(current => current.filter(item => item.id !== invitation.id));
    } catch (error) {
      setInviteError(error.message);
    } finally {
      setBusyId(null);
    }
  };

  const copyFreshLink = async invitation => {
    try {
      await navigator.clipboard.writeText(freshLinks[invitation.id]);
      setCopyMessage(`Invitation link for ${invitation.email} copied.`);
    } catch {
      setCopyMessage('Copy was blocked. Select and copy the invitation link shown below.');
    }
  };

  return (
    <section className="dashboard-card overflow-hidden rounded-2xl shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6 bg-white">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
            <FaUserGroup aria-hidden="true" className="text-base" />
          </span>
          <div>
            <h2 className="dashboard-card-heading text-slate-900">People & Workspace Access</h2>
            <p className="mt-0.5 text-xs text-slate-500">Manage teammate profiles, roles, and pending invitations.</p>
          </div>
        </div>
        <button 
          type="button" 
          onClick={() => { setEmployeeError(''); refresh().catch(error => setEmployeeError(error.message)); loadInvitations(); }} 
          className="inline-flex items-center justify-center gap-1.5 self-start rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition-colors sm:self-auto"
        >
          <FaArrowsRotate aria-hidden="true" className="text-xs text-slate-400" />
          <span>Refresh</span>
        </button>
      </div>

      {message && <p role="status" className="mx-5 mt-4 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-xs text-emerald-800 sm:mx-6">{message}</p>}
      {employeeError && <p role="alert" className="mx-5 mt-4 rounded-xl border border-rose-100 bg-rose-50 p-3 text-xs text-rose-700 sm:mx-6">{employeeError}</p>}
      {copyMessage && <p role="status" className="mx-5 mt-4 rounded-xl border border-indigo-100 bg-indigo-50 p-3 text-xs text-indigo-800 sm:mx-6">{copyMessage}</p>}

      {/* Team Members Table */}
      <div className="p-5 sm:p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Team Members <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">{userData?.length || 0}</span>
          </h3>
        </div>

        {!userData?.length ? (
          <p className="mt-3 rounded-2xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500">
            No employees have joined yet. Invite a teammate to get started.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="min-w-[620px] w-full text-left text-xs">
              <thead className="bg-slate-50/70 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100">
                <tr>
                  <th scope="col" className="px-4 py-3">Employee</th>
                  <th scope="col" className="px-4 py-3">Department</th>
                  <th scope="col" className="px-4 py-3 text-center">Open Tasks</th>
                  <th scope="col" className="px-4 py-3 text-center">Status</th>
                  <th scope="col" className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {userData.map(employee => {
                  const initial = employee.firstName?.slice(0, 1).toUpperCase() || 'U';
                  const openCount = (employee.taskCounts?.newTask || 0) + (employee.taskCounts?.active || 0);
                  return (
                    <tr key={employee.id} className={!employee.active ? 'opacity-60 bg-slate-50/30' : 'hover:bg-slate-50/60'}>
                      <td className="px-4 py-3.5">
                        {editId === employee.id ? (
                          <form id={`edit-employee-${employee.id}`} onSubmit={saveEmployee} className="flex gap-2">
                            <label className="sr-only" htmlFor={`employee-name-${employee.id}`}>Employee name</label>
                            <input 
                              id={`employee-name-${employee.id}`} 
                              value={editForm.firstName} 
                              onChange={event => setEditForm(current => ({ ...current, firstName: event.target.value }))} 
                              required 
                              minLength={2} 
                              maxLength={80} 
                              className="w-40 rounded-lg border border-slate-200 p-1.5 text-xs text-slate-900" 
                            />
                          </form>
                        ) : (
                          <div className="flex items-center gap-2.5">
                            <span className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-50 text-[11px] font-bold text-indigo-700">
                              {initial}
                            </span>
                            <div>
                              <p className="text-xs font-bold text-slate-900">{employee.firstName}</p>
                              <p className="text-[10px] text-slate-400">{employee.email}</p>
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">
                        {editId === employee.id ? (
                          <div>
                            <label className="sr-only" htmlFor={`employee-department-${employee.id}`}>Department</label>
                            <input 
                              id={`employee-department-${employee.id}`} 
                              value={editForm.department} 
                              onChange={event => setEditForm(current => ({ ...current, department: event.target.value }))} 
                              required 
                              minLength={2} 
                              maxLength={80} 
                              className="w-36 rounded-lg border border-slate-200 p-1.5 text-xs text-slate-900" 
                            />
                          </div>
                        ) : (
                          <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                            {employee.department || 'General'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-center font-semibold text-slate-700">
                        {openCount}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          employee.active ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/50' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {employee.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2.5">
                          {editId === employee.id ? (
                            <>
                              <button 
                                type="submit" 
                                form={`edit-employee-${employee.id}`} 
                                disabled={busyId === employee.id} 
                                className="text-xs font-bold text-indigo-600 hover:text-indigo-800"
                              >
                                Save
                              </button>
                              <button 
                                type="button" 
                                onClick={() => setEditId(null)} 
                                className="text-xs font-bold text-slate-400 hover:text-slate-600"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <button 
                              type="button" 
                              onClick={() => startEdit(employee)} 
                              className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800"
                            >
                              <FaPenToSquare className="text-[10px]" />
                              <span>Edit</span>
                            </button>
                          )}
                          <button 
                            type="button" 
                            onClick={() => changeStatus(employee)} 
                            disabled={busyId === employee.id} 
                            className={`text-xs font-bold disabled:opacity-50 ${
                              employee.active ? 'text-rose-600 hover:text-rose-800' : 'text-slate-600 hover:text-slate-800'
                            }`}
                          >
                            {employee.active ? 'Deactivate' : 'Reactivate'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invitations Section */}
      <div className="border-t border-slate-100 p-5 sm:p-6 bg-slate-50/40">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
          Pending & Past Invitations
        </h3>
        {inviteError && <p role="alert" className="mt-3 rounded-xl border border-rose-100 bg-rose-50 p-3 text-xs text-rose-700">{inviteError}</p>}
        {!invitations.length ? (
          <p className="mt-3 text-xs text-slate-500">No invitations recorded yet.</p>
        ) : (
          <div className="mt-3 space-y-2.5">
            {invitations.map(invitation => (
              <div key={invitation.id} className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-slate-900">
                      {invitation.firstName} <span className="font-normal text-slate-500">({invitation.email})</span>
                    </p>
                    <p className="mt-0.5 text-[10px] text-slate-400">
                      {invitation.department} · Expires {new Date(invitation.expiresAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold capitalize ${statusClass(invitation.status)}`}>
                      {invitation.status}
                    </span>
                    {invitation.status !== 'accepted' && (
                      <>
                        <button 
                          type="button" 
                          onClick={() => resend(invitation)} 
                          disabled={busyId === invitation.id} 
                          aria-label={`Resend invitation to ${invitation.email}`} 
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-indigo-600 hover:bg-slate-50 disabled:opacity-50"
                        >
                          <FaArrowsRotate aria-hidden="true" className="text-[10px]" /> 
                          <span>Resend</span>
                        </button>
                        <button 
                          type="button" 
                          onClick={() => revoke(invitation)} 
                          disabled={busyId === invitation.id} 
                          className="rounded-lg px-2.5 py-1 text-xs font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                        >
                          Revoke
                        </button>
                      </>
                    )}
                    {freshLinks[invitation.id] && (
                      <button 
                        type="button" 
                        onClick={() => copyFreshLink(invitation)} 
                        aria-label={`Copy refreshed invitation for ${invitation.email}`} 
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-indigo-600 hover:bg-slate-50"
                      >
                        <FaCopy aria-hidden="true" className="text-[10px]" /> 
                        <span>Copy link</span>
                      </button>
                    )}
                  </div>
                </div>
                {freshLinks[invitation.id] && (
                  <label className="mt-3 block text-[10px] font-semibold text-slate-500">
                    Refreshed invite link
                    <input 
                      readOnly 
                      value={freshLinks[invitation.id]} 
                      aria-label={`Refreshed invitation link for ${invitation.email}`} 
                      onFocus={event => event.target.select()} 
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700" 
                    />
                  </label>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

import React, { useCallback, useContext, useEffect, useState } from 'react';
import { FaArrowsRotate, FaCopy, FaUserGroup } from 'react-icons/fa6';
import { getInvitationsApi, resendInvitationApi, revokeInvitationApi, updateEmployeeApi, updateEmployeeStatusApi } from '../../api';
import { AuthContext } from '../../context/AuthProvider';

const statusClass = status => ({
  pending: 'bg-amber-50 text-amber-800',
  accepted: 'bg-emerald-50 text-emerald-700',
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
    return () => window.removeEventListener('ems:invitations-updated', onInvitationsUpdated);
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
    <section className="dashboard-card overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-50 text-indigo-600"><FaUserGroup aria-hidden="true" /></span>
          <div>
            <h2 className="dashboard-card-heading">People & access</h2>
            <p className="mt-1 text-xs text-slate-500">Manage teammates and invitation status.</p>
          </div>
        </div>
        <button type="button" onClick={() => { setEmployeeError(''); refresh().catch(error => setEmployeeError(error.message)); loadInvitations(); }} className="inline-flex min-h-9 items-center justify-center gap-2 self-start rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-600 sm:self-auto">
          <FaArrowsRotate aria-hidden="true" /> Refresh
        </button>
      </div>

      {message && <p role="status" className="mx-5 mt-4 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800 sm:mx-6">{message}</p>}
      {employeeError && <p role="alert" className="mx-5 mt-4 rounded-lg bg-rose-50 p-3 text-xs text-rose-700 sm:mx-6">{employeeError}</p>}
      {copyMessage && <p role="status" className="mx-5 mt-4 rounded-lg bg-indigo-50 p-3 text-xs text-indigo-800 sm:mx-6">{copyMessage}</p>}

      <div className="p-5 sm:p-6">
        <h3 className="text-sm font-extrabold text-slate-800">Team members <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">{userData?.length || 0}</span></h3>
        {!userData?.length ? (
          <p className="mt-3 rounded-xl border border-dashed border-slate-200 p-5 text-center text-xs text-slate-500">No employees have joined yet. Invite a teammate to get started.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-[620px] w-full text-left">
              <thead><tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-500"><th scope="col" className="py-3 pr-4">Employee</th><th scope="col" className="py-3 pr-4">Department</th><th scope="col" className="py-3 pr-4">Open work</th><th scope="col" className="py-3 pr-4">Access</th><th scope="col" className="py-3">Actions</th></tr></thead>
              <tbody className="divide-y divide-slate-50">
                {userData.map(employee => (
                  <tr key={employee.id} className={!employee.active ? 'opacity-60' : ''}>
                    <td className="py-3 pr-4">
                      {editId === employee.id ? (
                        <form id={`edit-employee-${employee.id}`} onSubmit={saveEmployee}>
                          <label className="sr-only" htmlFor={`employee-name-${employee.id}`}>Employee name</label>
                          <input id={`employee-name-${employee.id}`} value={editForm.firstName} onChange={event => setEditForm(current => ({ ...current, firstName: event.target.value }))} required minLength="2" maxLength="80" className="w-40 rounded-md px-2 py-1 text-xs" />
                        </form>
                      ) : <><p className="text-xs font-bold text-slate-800">{employee.firstName}</p><p className="mt-0.5 text-[10px] text-slate-500">{employee.email}</p></>}
                    </td>
                    <td className="py-3 pr-4">
                      {editId === employee.id ? (
                        <div>
                          <label className="sr-only" htmlFor={`employee-department-${employee.id}`}>Department</label>
                          <input id={`employee-department-${employee.id}`} value={editForm.department} onChange={event => setEditForm(current => ({ ...current, department: event.target.value }))} required minLength="2" maxLength="80" className="w-36 rounded-md px-2 py-1 text-xs" />
                        </div>
                      ) : <span className="text-xs text-slate-600">{employee.department}</span>}
                    </td>
                    <td className="py-3 pr-4 text-xs text-slate-600">{(employee.taskCounts?.newTask || 0) + (employee.taskCounts?.active || 0)}</td>
                    <td className="py-3 pr-4"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${employee.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{employee.active ? 'Active' : 'Inactive'}</span></td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        {editId === employee.id ? (
                          <>
                            <button type="submit" form={`edit-employee-${employee.id}`} disabled={busyId === employee.id} className="text-[10px] font-bold text-indigo-600">Save</button>
                            <button type="button" onClick={() => setEditId(null)} className="text-[10px] font-bold text-slate-500">Cancel</button>
                          </>
                        ) : (
                          <button type="button" onClick={() => startEdit(employee)} className="text-[10px] font-bold text-indigo-600">Edit</button>
                        )}
                        <button type="button" onClick={() => changeStatus(employee)} disabled={busyId === employee.id} className="text-[10px] font-bold text-slate-500 disabled:opacity-50">{employee.active ? 'Deactivate' : 'Reactivate'}</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="border-t border-slate-100 p-5 sm:p-6">
        <h3 className="text-sm font-extrabold text-slate-800">Invitations</h3>
        {inviteError && <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-xs text-rose-700">{inviteError}</p>}
        {!invitations.length ? (
          <p className="mt-3 text-xs text-slate-500">No invitations yet.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {invitations.map(invitation => (
              <div key={invitation.id} className="rounded-xl border border-slate-100 p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-slate-800">{invitation.firstName} <span className="font-normal text-slate-500">· {invitation.email}</span></p>
                    <p className="mt-1 text-[10px] text-slate-500">{invitation.department} · expires {new Date(invitation.expiresAt).toLocaleDateString()}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold capitalize ${statusClass(invitation.status)}`}>{invitation.status}</span>
                    {invitation.status !== 'accepted' && (
                      <>
                        <button type="button" onClick={() => resend(invitation)} disabled={busyId === invitation.id} aria-label={`Resend invitation to ${invitation.email}`} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[10px] font-bold text-indigo-600 disabled:opacity-50">
                          <FaArrowsRotate aria-hidden="true" /> Resend
                        </button>
                        <button type="button" onClick={() => revoke(invitation)} disabled={busyId === invitation.id} className="rounded-lg px-2 py-1.5 text-[10px] font-bold text-rose-600 disabled:opacity-50">Revoke</button>
                      </>
                    )}
                    {freshLinks[invitation.id] && (
                      <button type="button" onClick={() => copyFreshLink(invitation)} aria-label={`Copy refreshed invitation for ${invitation.email}`} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[10px] font-bold text-indigo-600">
                        <FaCopy aria-hidden="true" /> Copy link
                      </button>
                    )}
                  </div>
                </div>
                {freshLinks[invitation.id] && (
                  <label className="mt-3 block text-[10px] font-semibold text-slate-500">
                    Refreshed invite link
                    <input readOnly value={freshLinks[invitation.id]} aria-label={`Refreshed invitation link for ${invitation.email}`} onFocus={event => event.target.select()} className="mt-1 w-full rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-[10px] text-slate-600" />
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

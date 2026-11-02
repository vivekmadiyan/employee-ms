import React, { useCallback, useContext, useEffect, useState } from 'react';
import { FaArrowsRotate, FaCopy, FaFileArrowDown, FaUserGroup, FaPenToSquare, FaClipboardCheck, FaSitemap } from 'react-icons/fa6';
import {
  createEmployeeOnboardingApi,
  createOnboardingTemplateApi,
  getInvitationsApi,
  getOnboardingTemplatesApi,
  resendInvitationApi,
  revokeInvitationApi,
  updateEmployeeApi,
  updateEmployeeStatusApi
} from '../../api';
import { AuthContext } from '../../context/AuthProvider';
import { HelpIcon } from './Tooltip';
import PdfExportButton from './PdfExportButton';

const statusClass = status => ({
  pending: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200/50',
  accepted: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/50',
  expired: 'bg-slate-100 text-slate-600'
}[status] || 'bg-slate-100 text-slate-600');

function OrgNode({ employee, childrenByManager, activeEmployees, path = [] }) {
  if (path.includes(employee.id)) {
    return <p role="alert" className="text-xs text-rose-700">Reporting cycle detected. Update the reporting line.</p>;
  }
  const descendants = childrenByManager.get(employee.id) || [];
  return (
    <li className="mt-3 list-none">
      <article className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <p className="text-xs font-bold text-slate-900">{employee.firstName}</p>
        <p className="mt-0.5 text-[10px] text-slate-500">{employee.jobTitle || employee.department}</p>
        <p className="mt-1 text-[10px] font-semibold text-indigo-700">{employee.team || 'General'} team</p>
      </article>
      {descendants.length > 0 && (
        <ul className="ml-4 border-l border-slate-200 pl-3">
          {descendants.map(report => (
            <OrgNode
              key={report.id}
              employee={report}
              childrenByManager={childrenByManager}
              activeEmployees={activeEmployees}
              path={[...path, employee.id]}
            />
          ))}
        </ul>
      )}
      {!activeEmployees.has(employee.managerId) && employee.managerId && (
        <p className="ml-4 mt-1 text-[10px] text-slate-400">Reports to an inactive or unavailable manager</p>
      )}
    </li>
  );
}

export default function TeamManagement() {
  const teamReportRef = React.useRef(null);
  const { userData, refresh } = useContext(AuthContext);
  const [invitations, setInvitations] = useState([]);
  const [inviteError, setInviteError] = useState('');
  const [employeeError, setEmployeeError] = useState('');
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({ firstName: '', department: '', team: 'General', managerId: null });
  const [teamFilter, setTeamFilter] = useState('all');
  const [showOrgChart, setShowOrgChart] = useState(false);
  const [copyMessage, setCopyMessage] = useState('');
  const [freshLinks, setFreshLinks] = useState({});
  const [onboardingTemplates, setOnboardingTemplates] = useState([]);
  const [selectedOnboardingTemplateId, setSelectedOnboardingTemplateId] = useState('default');
  const [onboardingTemplateError, setOnboardingTemplateError] = useState('');
  const [templateBusy, setTemplateBusy] = useState(false);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateItems, setTemplateItems] = useState([{ title: '', description: '', daysAfterStart: 0 }]);

  const loadInvitations = useCallback(async () => {
    try {
      setInvitations(await getInvitationsApi());
      setInviteError('');
    } catch (error) {
      setInviteError(error.message);
    }
  }, []);

  const loadOnboardingTemplates = useCallback(async () => {
    try {
      setOnboardingTemplates(await getOnboardingTemplatesApi());
      setOnboardingTemplateError('');
    } catch (error) {
      setOnboardingTemplateError(error.message);
    }
  }, []);

  useEffect(() => {
    loadInvitations();
    loadOnboardingTemplates();
    const onInvitationsUpdated = () => loadInvitations();
    const onWorkspaceUpdated = () => {
      loadInvitations();
      loadOnboardingTemplates();
    };
    window.addEventListener('ems:invitations-updated', onInvitationsUpdated);
    window.addEventListener('ems:workspace-updated', onWorkspaceUpdated);
    return () => {
      window.removeEventListener('ems:invitations-updated', onInvitationsUpdated);
      window.removeEventListener('ems:workspace-updated', onWorkspaceUpdated);
    };
  }, [loadInvitations, loadOnboardingTemplates]);

  const startEdit = employee => {
    setEditId(employee.id);
    setEditForm({
      firstName: employee.firstName,
      department: employee.department,
      jobTitle: employee.jobTitle || '',
      employmentType: employee.employmentType || 'unspecified',
      hireDate: employee.hireDate || '',
      team: employee.team || 'General',
      managerId: employee.managerId || ''
    });
    setEmployeeError('');
    setMessage('');
  };

  const saveEmployee = async event => {
    event.preventDefault();
    setBusyId(editId);
    setEmployeeError('');
    try {
      const currentEmployee = userData.find(employee => employee.id === editId);
      const payload = { ...editForm };
      if (String(editForm.managerId || '') === String(currentEmployee?.managerId || '')) {
        delete payload.managerId;
      } else {
        payload.managerId = editForm.managerId === '' ? null : Number(editForm.managerId);
      }
      await updateEmployeeApi(editId, payload);
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

  const createOnboarding = async employee => {
    setBusyId(employee.id);
    setEmployeeError('');
    setMessage('');
    try {
      const templateId = selectedOnboardingTemplateId === 'default'
        ? null
        : Number(selectedOnboardingTemplateId);
      const result = await createEmployeeOnboardingApi(employee.id, templateId);
      setMessage(`Created ${result.tasksCreated} onboarding tasks for ${employee.firstName}.`);
      try {
        await refresh();
      } catch (refreshError) {
        setEmployeeError(`Onboarding tasks were created, but the team list could not refresh: ${refreshError.message}`);
      }
    } catch (error) {
      setEmployeeError(error.message);
    } finally {
      setBusyId(null);
    }
  };

  const saveOnboardingTemplate = async event => {
    event.preventDefault();
    setTemplateBusy(true);
    setOnboardingTemplateError('');
    try {
      const template = await createOnboardingTemplateApi({ name: templateName, items: templateItems });
      setOnboardingTemplates(current => [...current, template].sort((left, right) => left.name.localeCompare(right.name)));
      setSelectedOnboardingTemplateId(String(template.id));
      setTemplateName('');
      setTemplateItems([{ title: '', description: '', daysAfterStart: 0 }]);
      setShowTemplateForm(false);
      setMessage('Onboarding template created.');
    } catch (error) {
      setOnboardingTemplateError(error.message);
    } finally {
      setTemplateBusy(false);
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


  const exportCsv = () => {
    if (!userData?.length) return;
    const headers = ['ID', 'Name', 'Email', 'Department', 'Team', 'Manager', 'Job Title', 'Employment Type', 'Hire Date', 'Role', 'Status', 'Open Tasks', 'Completed Tasks'];
    const rows = userData.map(e => [
      e.id,
      e.firstName,
      e.email,
      e.department || 'General',
      e.team || 'General',
      userData.find(manager => manager.id === e.managerId)?.firstName || '',
      e.jobTitle || '',
      e.employmentType || 'unspecified',
      e.hireDate || '',
      e.role || 'employee',
      e.active ? 'Active' : 'Inactive',
      (e.taskCounts?.newTask || 0) + (e.taskCounts?.active || 0),
      e.taskCounts?.completed || 0,
    ]);
    const csv = [headers, ...rows]
      .map(row => row.map(cell => '"' + String(cell).replace(/"/g, '""') + '"').join(','))
      .join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'employees-' + new Date().toISOString().slice(0, 10) + '.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const activeEmployees = (userData || []).filter(employee => employee.active);
  const activeEmployeeIds = new Set(activeEmployees.map(employee => employee.id));
  const childrenByManager = new Map();
  activeEmployees.forEach(employee => {
    if (!activeEmployeeIds.has(employee.managerId)) return;
    const reports = childrenByManager.get(employee.managerId) || [];
    reports.push(employee);
    childrenByManager.set(employee.managerId, reports);
  });
  const orgRoots = activeEmployees.filter(employee => !activeEmployeeIds.has(employee.managerId));
  const chartRoots = orgRoots.length ? orgRoots : activeEmployees;
  const teams = [...new Set((userData || []).map(employee => employee.team || 'General'))].sort();
  const filteredEmployees = (userData || []).filter(employee =>
    teamFilter === 'all' || (employee.team || 'General') === teamFilter
  );

  return (
    <section className="dashboard-card overflow-hidden rounded-2xl shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6 bg-white">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
            <FaUserGroup aria-hidden="true" className="text-base" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="dashboard-card-heading text-slate-900">People & Workspace Access</h2>
              <HelpIcon text="Manage employee profiles, deactivate access, and track pending invitations." />
            </div>
            <p className="mt-0.5 text-xs text-slate-500">Manage teammate profiles, roles, and pending invitations.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {userData?.length > 0 && (
            <button
              type="button"
              onClick={exportCsv}
              aria-label="Export employees as CSV"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition-colors"
            >
              <FaFileArrowDown aria-hidden="true" className="text-xs text-slate-400" />
              <span>Export CSV</span>
            </button>
          )}
          <button 
            type="button" 
            onClick={() => { setEmployeeError(''); refresh().catch(error => setEmployeeError(error.message)); loadInvitations(); }} 
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition-colors"
          >
            <FaArrowsRotate aria-hidden="true" className="text-xs text-slate-400" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {message && <p role="status" className="mx-5 mt-4 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-xs text-emerald-800 sm:mx-6">{message}</p>}
      {employeeError && <p role="alert" className="mx-5 mt-4 rounded-xl border border-rose-100 bg-rose-50 p-3 text-xs text-rose-700 sm:mx-6">{employeeError}</p>}
      {copyMessage && <p role="status" className="mx-5 mt-4 rounded-xl border border-indigo-100 bg-indigo-50 p-3 text-xs text-indigo-800 sm:mx-6">{copyMessage}</p>}

      <div className="mx-5 mt-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4 sm:mx-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <label className="block min-w-56 flex-1 text-xs font-semibold text-slate-700">
            Onboarding template
            <select
              aria-label="Onboarding template"
              value={selectedOnboardingTemplateId}
              onChange={event => setSelectedOnboardingTemplateId(event.target.value)}
              disabled={!onboardingTemplates.length}
              className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900"
            >
              {onboardingTemplates.map(template => (
                <option key={template.id ?? 'default'} value={template.id ?? 'default'}>
                  {template.name} · {template.items.length} steps{template.isDefault ? ' (built in)' : ''}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => setShowTemplateForm(value => !value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            {showTemplateForm ? 'Close template form' : 'Create template'}
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-600">The selected template is used by new onboarding checklists. Due dates are relative to checklist creation.</p>
        {onboardingTemplateError && <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-xs text-rose-700">{onboardingTemplateError}</p>}
        {showTemplateForm && (
          <form onSubmit={saveOnboardingTemplate} className="mt-4 space-y-4 border-t border-slate-200 pt-4">
            <label className="block max-w-md text-xs font-semibold text-slate-700">
              Template name
              <input
                required
                minLength={2}
                maxLength={80}
                value={templateName}
                onChange={event => setTemplateName(event.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900"
              />
            </label>
            <div className="space-y-3">
              {templateItems.map((item, index) => (
                <fieldset key={index} className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-2">
                  <legend className="px-1 text-[11px] font-bold text-slate-700">Step {index + 1}</legend>
                  <label className="block text-xs font-semibold text-slate-700">
                    Step title
                    <input
                      required
                      minLength={2}
                      maxLength={160}
                      value={item.title}
                      onChange={event => setTemplateItems(current => current.map((step, stepIndex) =>
                        stepIndex === index ? { ...step, title: event.target.value } : step
                      ))}
                      className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900"
                    />
                  </label>
                  <label className="block text-xs font-semibold text-slate-700">
                    Description
                    <textarea
                      required
                      minLength={2}
                      maxLength={1000}
                      rows={2}
                      value={item.description}
                      onChange={event => setTemplateItems(current => current.map((step, stepIndex) =>
                        stepIndex === index ? { ...step, description: event.target.value } : step
                      ))}
                      className="mt-1 block w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900"
                    />
                  </label>
                  <label className="block max-w-xs text-xs font-semibold text-slate-700">
                    Days after checklist starts
                    <input
                      required
                      type="number"
                      min="0"
                      max="365"
                      value={item.daysAfterStart}
                      onChange={event => setTemplateItems(current => current.map((step, stepIndex) =>
                        stepIndex === index ? { ...step, daysAfterStart: Number(event.target.value) } : step
                      ))}
                      className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900"
                    />
                  </label>
                  {templateItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setTemplateItems(current => current.filter((_, stepIndex) => stepIndex !== index))}
                      className="self-end justify-self-start text-xs font-semibold text-rose-700 hover:text-rose-800"
                    >
                      Remove step {index + 1}
                    </button>
                  )}
                </fieldset>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={templateItems.length >= 25}
                onClick={() => setTemplateItems(current => [...current, { title: '', description: '', daysAfterStart: 0 }])}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-50"
              >
                Add step
              </button>
              <button
                type="submit"
                disabled={templateBusy || templateItems.length > 25}
                className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {templateBusy ? 'Saving…' : 'Save template'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Team Members Table */}
      <div ref={teamReportRef} className="p-5 sm:p-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Team Members <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">{userData?.length || 0}</span>
            </h3>
            <button type="button" onClick={() => setShowOrgChart(value => !value)} aria-pressed={showOrgChart} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[10px] font-bold text-slate-700 hover:bg-slate-50">
              <FaSitemap aria-hidden="true" />
              {showOrgChart ? 'Show directory' : 'Org chart'}
            </button>
          </div>
          <div className="flex items-center gap-2">
            {!showOrgChart && (
              <label className="text-[10px] font-semibold text-slate-500">
                Team
                <select value={teamFilter} onChange={event => setTeamFilter(event.target.value)} aria-label="Filter employees by team" className="ml-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[10px] text-slate-700">
                  <option value="all">All teams</option>
                  {teams.map(team => <option key={team} value={team}>{team}</option>)}
                </select>
              </label>
            )}
            <PdfExportButton targetRef={teamReportRef} title="Export roster PDF" />
          </div>
        </div>

        {showOrgChart ? (
          activeEmployees.length ? (
            <div className="overflow-x-auto rounded-xl border border-slate-100 bg-slate-50/50 p-4">
              <ul className="min-w-max">
                {chartRoots.map(employee => (
                  <OrgNode
                    key={employee.id}
                    employee={employee}
                    childrenByManager={childrenByManager}
                    activeEmployees={activeEmployeeIds}
                  />
                ))}
              </ul>
            </div>
          ) : <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500">No active employees to show in the org chart.</p>
        ) : !userData?.length ? (
          <p className="mt-3 rounded-2xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500">
            No employees have joined yet. Invite a teammate to get started.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="min-w-[1320px] w-full text-left text-xs">
              <thead className="bg-slate-50/70 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100">
                <tr>
                  <th scope="col" className="px-4 py-3">Employee</th>
                  <th scope="col" className="px-4 py-3">Department</th>
                  <th scope="col" className="px-4 py-3">Team</th>
                  <th scope="col" className="px-4 py-3">Reports To</th>
                  <th scope="col" className="px-4 py-3">Job Title</th>
                  <th scope="col" className="px-4 py-3">Employment Type</th>
                  <th scope="col" className="px-4 py-3">Hire Date</th>
                  <th scope="col" className="px-4 py-3 text-center">Open Tasks</th>
                  <th scope="col" className="px-4 py-3 text-center">Status</th>
                  <th scope="col" className="print-export-control px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredEmployees.map(employee => {
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
                      <td className="px-4 py-3.5 text-slate-600">
                        {editId === employee.id ? (
                          <input form={`edit-employee-${employee.id}`} aria-label="Team" required minLength={2} maxLength={80} value={editForm.team} onChange={event => setEditForm(current => ({ ...current, team: event.target.value }))} className="w-36 rounded-lg border border-slate-200 p-1.5 text-xs text-slate-900" />
                        ) : <span className="inline-flex rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700">{employee.team || 'General'}</span>}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">
                        {editId === employee.id ? (
                          <select
                            form={`edit-employee-${employee.id}`}
                            aria-label="Reports to"
                            value={editForm.managerId}
                            onChange={event => setEditForm(current => ({ ...current, managerId: event.target.value ? Number(event.target.value) : null }))}
                            className="w-40 rounded-lg border border-slate-200 p-1.5 text-xs text-slate-900"
                          >
                            <option value="">No manager</option>
                            {activeEmployees.filter(manager => manager.id !== employee.id).map(manager => (
                              <option key={manager.id} value={manager.id}>{manager.firstName}</option>
                            ))}
                            {employee.managerId && !activeEmployeeIds.has(employee.managerId) && (
                              <option value={employee.managerId}>
                                {userData.find(manager => manager.id === employee.managerId)?.firstName || 'Former employee'} (inactive)
                              </option>
                            )}
                          </select>
                        ) : employee.managerId ? (
                          <span>{userData.find(manager => manager.id === employee.managerId)?.firstName || 'Unavailable manager'}</span>
                        ) : <span className="text-slate-400">No manager</span>}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">
                        {editId === employee.id ? (
                          <input
                            form={`edit-employee-${employee.id}`}
                            aria-label="Job title"
                            value={editForm.jobTitle}
                            onChange={event => setEditForm(current => ({ ...current, jobTitle: event.target.value }))}
                            maxLength={120}
                            className="w-40 rounded-lg border border-slate-200 p-1.5 text-xs text-slate-900"
                          />
                        ) : employee.jobTitle || <span className="text-slate-400">Not set</span>}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">
                        {editId === employee.id ? (
                          <select
                            form={`edit-employee-${employee.id}`}
                            aria-label="Employment type"
                            value={editForm.employmentType}
                            onChange={event => setEditForm(current => ({ ...current, employmentType: event.target.value }))}
                            className="w-36 rounded-lg border border-slate-200 p-1.5 text-xs text-slate-900"
                          >
                            <option value="unspecified">Unspecified</option>
                            <option value="full_time">Full-time</option>
                            <option value="part_time">Part-time</option>
                            <option value="contractor">Contractor</option>
                            <option value="temporary">Temporary</option>
                            <option value="intern">Intern</option>
                          </select>
                        ) : <span className="capitalize">{(employee.employmentType || 'unspecified').replace('_', ' ')}</span>}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">
                        {editId === employee.id ? (
                          <input
                            form={`edit-employee-${employee.id}`}
                            aria-label="Hire date"
                            type="date"
                            value={editForm.hireDate}
                            onChange={event => setEditForm(current => ({ ...current, hireDate: event.target.value }))}
                            className="w-36 rounded-lg border border-slate-200 p-1.5 text-xs text-slate-900"
                          />
                        ) : employee.hireDate || <span className="text-slate-400">Not set</span>}
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
                      <td className="print-export-control px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2.5">
                          {employee.active && !employee.onboardingCreated && (
                            <button
                              type="button"
                              onClick={() => createOnboarding(employee)}
                              disabled={busyId === employee.id || !onboardingTemplates.length}
                              aria-label={`Create onboarding checklist for ${employee.firstName}`}
                              className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
                            >
                              <FaClipboardCheck aria-hidden="true" className="text-[10px]" />
                              <span>Onboard</span>
                            </button>
                          )}
                          {employee.onboardingCreated && (
                            <span className="text-[10px] font-semibold text-emerald-700">Checklist created</span>
                          )}
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
                      {invitation.department} · {invitation.team || 'General'} team
                      {invitation.managerId ? ` · Reports to ${userData.find(manager => manager.id === invitation.managerId)?.firstName || 'assigned manager'}` : ''}
                      {' · '}Expires {new Date(invitation.expiresAt).toLocaleDateString()}
                    </p>
                    {(invitation.jobTitle || (invitation.employmentType && invitation.employmentType !== 'unspecified') || invitation.hireDate) && (
                      <p className="mt-0.5 text-[10px] text-slate-500">
                        {[invitation.jobTitle, invitation.employmentType?.replace('_', ' '), invitation.hireDate]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    )}
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

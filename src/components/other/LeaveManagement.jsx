import React, { useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import { FaCalendarDays, FaCheck, FaXmark } from 'react-icons/fa6';
import {
  cancelLeaveRequestApi,
  createLeaveRequestApi,
  getLeaveBalanceApi,
  getLeaveCalendarApi,
  getLeavePoliciesApi,
  getLeaveRequestsApi,
  reviewLeaveRequestApi,
  updateLeavePoliciesApi
} from '../../api';
import { AuthContext } from '../../context/AuthProvider';
import { WorkspaceSettingsContext } from '../../context/WorkspaceSettingsContext';
import { workspaceDateKey } from '../../utils/workFocus';

const leaveTypes = {
  vacation: 'Vacation',
  sick: 'Sick Leave',
  personal: 'Personal',
  other: 'Other'
};

const statusStyles = {
  pending: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200/50',
  approved: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/50',
  rejected: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200/50',
  cancelled: 'bg-slate-100 text-slate-500'
};

const initialForm = today => ({ startDate: today, endDate: today, leaveType: 'vacation', reason: '' });
const leaveTypeEntries = Object.entries(leaveTypes);
const dateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const monthGridStart = date => {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  firstDay.setDate(firstDay.getDate() - firstDay.getDay());
  return firstDay;
};
const emptyPolicies = () => leaveTypeEntries.map(([leaveType]) => ({ leaveType, annualAllowanceDays: null }));
const emailStatusMessage = status => ({
  sent: 'Email notification sent.',
  not_configured: 'Email is not configured; review this request in the workspace.',
  no_recipients: 'No eligible email recipient was found; review this update in the workspace.',
  partial_failure: 'Some email notifications could not be sent; check the remaining requests in the workspace.',
  failed: 'Email could not be sent; the request is still available in the workspace.'
}[status] || '');

export default function LeaveManagement({ isManager = false, showApprovals = false }) {
  const { currentUser } = useContext(AuthContext);
  const { settings } = useContext(WorkspaceSettingsContext);
  const today = workspaceDateKey(settings.timeZone);
  const formId = useId();
  const isAdmin = currentUser?.role === 'admin';
  const canReview = isAdmin || isManager;
  const [requests, setRequests] = useState([]);
  const [onlyPending, setOnlyPending] = useState(showApprovals);
  const requestHeading = useRef(null);
  const visibleRequests = canReview && onlyPending
    ? requests.filter(leave => leave.status === 'pending' && leave.userId !== currentUser?.id)
    : requests;
  const [policyDraft, setPolicyDraft] = useState(emptyPolicies);
  const [balance, setBalance] = useState([]);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(`${today.slice(0, 7)}-01T00:00:00`));
  const [calendarAbsences, setCalendarAbsences] = useState([]);
  const [calendarError, setCalendarError] = useState('');
  const [savingPolicies, setSavingPolicies] = useState(false);
  const [form, setForm] = useState(() => initialForm(today));
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (showApprovals && canReview) requestHeading.current?.focus();
  }, [showApprovals, canReview]);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      setRequests(await getLeaveRequestsApi());
      setError('');
    } catch (requestError) {
      setError(requestError.message || 'Could not load leave requests.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
    window.addEventListener('ems:workspace-updated', loadRequests);
    return () => window.removeEventListener('ems:workspace-updated', loadRequests);
  }, [loadRequests]);

  const loadPoliciesAndBalance = useCallback(async () => {
    try {
      const [nextPolicies, nextBalance] = await Promise.all([
        getLeavePoliciesApi(),
        getLeaveBalanceApi(calendarMonth.getFullYear())
      ]);
      setPolicyDraft(nextPolicies);
      setBalance(nextBalance);
    } catch (requestError) {
      setError(requestError.message || 'Could not load leave policies and balances.');
    }
  }, [calendarMonth]);

  useEffect(() => {
    loadPoliciesAndBalance();
  }, [loadPoliciesAndBalance]);

  useEffect(() => {
    const start = monthGridStart(calendarMonth);
    const end = new Date(start);
    end.setDate(start.getDate() + 41);
    let activeRequest;
    const loadCalendar = async () => {
      activeRequest?.abort();
      const request = new AbortController();
      activeRequest = request;
      setCalendarError('');
      try {
        const absences = await getLeaveCalendarApi(dateKey(start), dateKey(end), request.signal);
        if (!request.signal.aborted) setCalendarAbsences(absences);
      } catch (requestError) {
        if (!request.signal.aborted) setCalendarError(requestError.message || 'Could not load the team leave calendar.');
      }
    };
    setCalendarAbsences([]);
    loadCalendar();
    window.addEventListener('ems:workspace-updated', loadCalendar);
    return () => {
      activeRequest?.abort();
      window.removeEventListener('ems:workspace-updated', loadCalendar);
    };
  }, [calendarMonth]);

  const submitRequest = async event => {
    event.preventDefault();
    setBusyId('new');
    setError('');
    setNotice('');
    try {
      const result = await createLeaveRequestApi(form);
      setForm(initialForm(today));
      setNotice(`Leave request submitted successfully for approval. ${emailStatusMessage(result.emailStatus)}`.trim());
      window.dispatchEvent(new Event('ems:workspace-updated'));
      await loadRequests();
      await loadPoliciesAndBalance();
    } catch (requestError) {
      setError(requestError.message || 'Could not submit leave request.');
    } finally {
      setBusyId(null);
    }
  };

  const reviewRequest = async (leave, status) => {
    setBusyId(leave.id);
    setError('');
    setNotice('');
    try {
      const result = await reviewLeaveRequestApi(leave.id, { status });
      setNotice(`Leave request ${status}. ${emailStatusMessage(result.emailStatus)}`.trim());
      window.dispatchEvent(new Event('ems:workspace-updated'));
      await loadRequests();
      await loadPoliciesAndBalance();
    } catch (requestError) {
      setError(requestError.message || 'Could not update leave request.');
    } finally {
      setBusyId(null);
    }
  };

  const cancelRequest = async leave => {
    if (leave.status === 'approved' && !window.confirm('Withdraw this approved leave and return the days to your balance?')) return;
    setBusyId(leave.id);
    setError('');
    setNotice('');
    try {
      await cancelLeaveRequestApi(leave.id);
      setNotice(leave.status === 'approved' ? 'Approved leave withdrawn and allowance restored.' : 'Pending leave request cancelled.');
      window.dispatchEvent(new Event('ems:workspace-updated'));
      await loadRequests();
      await loadPoliciesAndBalance();
    } catch (requestError) {
      setError(requestError.message || 'Could not cancel leave request.');
    } finally {
      setBusyId(null);
    }
  };

  const savePolicies = async event => {
    event.preventDefault();
    setSavingPolicies(true);
    setError('');
    setNotice('');
    try {
      const savedPolicies = await updateLeavePoliciesApi(policyDraft);
      setPolicyDraft(savedPolicies);
      await loadPoliciesAndBalance();
      setNotice('Annual leave allowances saved. Pending requests count against the balance.');
      window.dispatchEvent(new Event('ems:workspace-updated'));
    } catch (requestError) {
      setError(requestError.message || 'Could not save leave policies.');
    } finally {
      setSavingPolicies(false);
    }
  };

  const changeMonth = offset => setCalendarMonth(current => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  const gridStart = monthGridStart(calendarMonth);
  const calendarDays = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    const key = dateKey(date);
    return {
      date,
      key,
      inMonth: date.getMonth() === calendarMonth.getMonth(),
      absences: calendarAbsences.filter(leave => leave.startDate <= key && leave.endDate >= key)
    };
  });
  const agenda = calendarDays.filter(day => day.inMonth && day.absences.length);

  return (
    <section className="dashboard-card overflow-hidden rounded-2xl shadow-sm" aria-labelledby="leave-management-heading">
      <div className="flex items-center gap-3 border-b border-slate-100 p-5 sm:p-6 bg-white">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
          <FaCalendarDays className="text-base" aria-hidden="true" />
        </span>
        <div>
          <h2 id="leave-management-heading" className="dashboard-card-heading text-slate-900">
            {isAdmin ? 'Workspace Leave Management' : isManager ? 'Team Leave Management' : 'Time Off & Leave Requests'}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {isAdmin ? 'Review workspace requests and manage leave allowances.' : isManager ? 'Review leave requests from your direct reports; HR retains control of company policy.' : 'Submit leave requests and monitor manager approval status.'}
          </p>
        </div>
      </div>

      {error && <p role="alert" className="mx-5 mt-4 rounded-xl border border-rose-100 bg-rose-50 p-3 text-xs text-rose-700 sm:mx-6">{error}</p>}
      {notice && <p role="status" className="mx-5 mt-4 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-xs text-emerald-800 sm:mx-6">{notice}</p>}

      {isAdmin ? (
        <form onSubmit={savePolicies} className="border-b border-slate-100 bg-slate-50/50 p-5 sm:p-6">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Annual leave allowances</h3>
              <p className="mt-1 text-[11px] text-slate-500">Set calendar-day limits for each leave type. Blank means unlimited; pending requests reserve days.</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {leaveTypeEntries.map(([leaveType, label]) => (
              <label key={leaveType} className="text-xs font-semibold text-slate-700">
                {label}
                <span className="mt-1 block">
                  <input
                    type="number"
                    min="0"
                    max="365"
                    step="1"
                    inputMode="numeric"
                    aria-label={`${label} annual allowance in calendar days`}
                    placeholder="Unlimited"
                    value={policyDraft.find(policy => policy.leaveType === leaveType)?.annualAllowanceDays ?? ''}
                    onChange={event => setPolicyDraft(current => current.map(policy => policy.leaveType === leaveType
                      ? { ...policy, annualAllowanceDays: event.target.value === '' ? null : Number(event.target.value) }
                      : policy))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900"
                  />
                </span>
              </label>
            ))}
          </div>
          <button type="submit" disabled={savingPolicies} className="mt-3 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50">
            {savingPolicies ? 'Saving…' : 'Save allowances'}
          </button>
        </form>
      ) : (
        <div className="border-b border-slate-100 bg-indigo-50/40 p-5 sm:p-6">
          <h3 className="text-xs font-bold text-slate-800">{calendarMonth.getFullYear()} leave balance</h3>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {balance.map(item => (
              <div key={item.leaveType} className="rounded-xl border border-slate-100 bg-white p-3">
                <p className="text-[10px] font-semibold text-slate-500">{leaveTypes[item.leaveType]}</p>
                <p className="mt-1 text-sm font-bold text-slate-900">
                  {item.remainingDays === null ? 'Unlimited' : `${item.remainingDays} days left`}
                </p>
                <p className="mt-0.5 text-[10px] text-slate-400">
                  {item.pendingDays} pending · {item.approvedDays} approved
                </p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-slate-500">Balances count calendar days; pending and approved requests both reserve allowance.</p>
        </div>
      )}

      <div className="border-b border-slate-100 p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Team absence calendar</h3>
            <p className="mt-1 text-[10px] text-slate-500">Approved absences only. Leave reasons and types are not shown here.</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => changeMonth(-1)} aria-label="Previous month" className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">‹</button>
            <span className="min-w-28 text-center text-xs font-bold text-slate-700">
              {calendarMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
            </span>
            <button type="button" onClick={() => changeMonth(1)} aria-label="Next month" className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">›</button>
          </div>
        </div>
        {calendarError && <p className="mb-3 text-xs text-rose-600" role="alert">{calendarError}</p>}
        <div className="hidden overflow-x-auto md:block" tabIndex={0} role="region" aria-label="Monthly absence calendar">
          <div role="grid" aria-label="Approved team absences" className="min-w-[630px]">
            <div role="row" className="grid grid-cols-7 border-b border-slate-100">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div role="columnheader" key={day} className="px-2 py-2 text-center text-[10px] font-bold uppercase text-slate-400">{day}</div>
              ))}
            </div>
            {Array.from({ length: 6 }, (_, week) => (
              <div role="row" key={week} className="grid grid-cols-7">
                {calendarDays.slice(week * 7, week * 7 + 7).map(day => (
                  <div
                    role="gridcell"
                    key={day.key}
                    aria-label={`${day.key}, day ${day.date.getDate()}${day.absences.length ? `, ${day.absences.map(item => item.employeeName).join(', ')}` : ''}`}
                    className={`min-h-20 border-b border-r border-slate-100 p-1.5 ${day.inMonth ? 'bg-white' : 'bg-slate-50/60'}`}
                  >
                    <span className={`text-[10px] font-semibold ${day.inMonth ? 'text-slate-700' : 'text-slate-500'}`}>{day.date.getDate()}</span>
                    <div className="mt-1 space-y-0.5">
                      {day.absences.slice(0, 2).map((absence, index) => (
                        <p key={`${absence.userId}-${index}`} title={`${absence.employeeName} · ${absence.department}`} className="truncate rounded bg-emerald-50 px-1 py-0.5 text-[9px] font-medium text-emerald-800">
                          {absence.employeeName}
                        </p>
                      ))}
                      {day.absences.length > 2 && <p className="px-1 text-[9px] font-semibold text-slate-500">+{day.absences.length - 2} more</p>}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="md:hidden">
          {agenda.length ? (
            <ul aria-label="Approved team absences" className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              {agenda.map(day => (
                <li key={day.key} className="flex flex-wrap justify-between gap-x-3 gap-y-1 px-3 py-2 text-xs">
                  <time dateTime={day.key} className="font-bold text-slate-800">{day.date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}</time>
                  <span className="text-slate-600">{day.absences.map(item => item.employeeName).join(', ')}</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-xs text-slate-600">No approved absences this month.</p>}
        </div>
      </div>

      {!isAdmin && (
        <form onSubmit={submitRequest} className="grid gap-3.5 border-b border-slate-100 p-5 sm:grid-cols-2 sm:p-6 bg-slate-50/40">
          <div>
            <label htmlFor={`${formId}-type`} className="block text-xs font-bold text-slate-700 mb-1">
              Leave Type
            </label>
            <select id={`${formId}-type`}
              value={form.leaveType} 
              onChange={event => setForm(current => ({ ...current, leaveType: event.target.value }))} 
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-900 shadow-xs focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            >
              {Object.entries(leaveTypes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor={`${formId}-start`} className="block text-xs font-bold text-slate-700 mb-1">
                Start Date
              </label>
              <input id={`${formId}-start`}
                type="date" 
                required 
                value={form.startDate} 
                onChange={event => setForm(current => ({ ...current, startDate: event.target.value }))} 
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 shadow-xs focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" 
              />
            </div>
            <div>
              <label htmlFor={`${formId}-end`} className="block text-xs font-bold text-slate-700 mb-1">
                End Date
              </label>
              <input id={`${formId}-end`}
                type="date" 
                required 
                min={form.startDate} 
                value={form.endDate} 
                onChange={event => setForm(current => ({ ...current, endDate: event.target.value }))} 
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 shadow-xs focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" 
              />
            </div>
          </div>

          <div className="sm:col-span-2">
            <label htmlFor={`${formId}-reason`} className="block text-xs font-bold text-slate-700 mb-1">
              Note for Manager
            </label>
            <textarea id={`${formId}-reason`}
              required 
              minLength={2} 
              maxLength={500} 
              rows={2} 
              value={form.reason} 
              onChange={event => setForm(current => ({ ...current, reason: event.target.value }))} 
              placeholder="Share context for your requested absence…" 
              className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-900 placeholder-slate-400 shadow-xs focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" 
            />
          </div>

          <div className="sm:col-span-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
            <button 
              type="submit" 
              disabled={busyId === 'new'} 
              className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm shadow-indigo-600/20 hover:bg-indigo-700 disabled:opacity-50"
            >
              {busyId === 'new' ? 'Submitting…' : 'Submit Leave Request'}
            </button>
            <p className="text-[11px] text-slate-400">
              Requests may be up to 90 calendar days. Overlapping dates are automatically checked.
            </p>
          </div>
        </form>
      )}

      <div className="workspace-requests-head">
        <h3 tabIndex={-1} ref={requestHeading}>Leave requests</h3>
        {canReview && <button type="button" className="workspace-action workspace-action--secondary"
          aria-pressed={onlyPending} onClick={() => setOnlyPending(value => !value)}>Pending approvals</button>}
      </div>
      {loading && !requests.length ? (
        <div role="status" className="p-10 text-center text-slate-400">
          <span className="mx-auto block h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent mb-2" />
          <p className="text-xs">Loading requests…</p>
        </div>
      ) : visibleRequests.length ? (
        <div className="divide-y divide-slate-100 bg-white">
          {visibleRequests.map(leave => (
            <article key={leave.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between sm:px-6 hover:bg-slate-50/50 transition-colors">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {canReview && (
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-2 py-0.5 text-xs font-bold text-indigo-700">
                      {leave.employeeName}
                    </span>
                  )}
                  <span className="text-xs font-bold text-slate-800">{leaveTypes[leave.leaveType] || leave.leaveType}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold capitalize ${statusStyles[leave.status] || statusStyles.cancelled}`}>
                    {leave.status}
                  </span>
                </div>
                <p className="mt-1 text-xs font-semibold text-slate-600">
                  📅 {leave.startDate} to {leave.endDate}
                </p>
                <p className="mt-1.5 whitespace-pre-wrap break-words text-xs text-slate-500 leading-relaxed">
                  &ldquo;{leave.reason}&rdquo;
                </p>
                {leave.reviewNote && (
                  <p className="mt-2 rounded-lg bg-slate-50 p-2 text-[11px] text-slate-600">
                    <span className="font-bold text-slate-700">Manager Note:</span> {leave.reviewNote}
                  </p>
                )}
                {leave.reviewerName && (
                  <p className="mt-1 text-[10px] text-slate-400">Reviewed by {leave.reviewerName}</p>
                )}
              </div>

              <div className="flex shrink-0 gap-2">
                {canReview && leave.userId !== currentUser?.id && leave.status === 'pending' && (
                  <>
                    <button 
                      type="button" 
                      onClick={() => reviewRequest(leave, 'approved')} 
                      disabled={busyId === leave.id} 
                      className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50"
                    >
                      <FaCheck className="text-[10px]" />
                      <span>Approve</span>
                    </button>
                    <button 
                      type="button" 
                      onClick={() => reviewRequest(leave, 'rejected')} 
                      disabled={busyId === leave.id} 
                      className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                    >
                      <FaXmark className="text-[10px]" />
                      <span>Decline</span>
                    </button>
                  </>
                )}
                {leave.userId === currentUser?.id && (leave.status === 'pending' || (leave.status === 'approved' && leave.startDate > today)) && (
                  <button 
                    type="button" 
                    onClick={() => cancelRequest(leave)} 
                    disabled={busyId === leave.id} 
                    className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {leave.status === 'approved' ? 'Withdraw leave' : 'Cancel request'}
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : !error ? (
        <p className="p-10 text-center text-xs text-slate-400">
          {canReview && onlyPending ? 'No requests are awaiting your approval.' : 'No leave requests to show.'}
        </p>
      ) : null}
    </section>
  );
}

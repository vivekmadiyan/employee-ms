import React, { useCallback, useEffect, useState } from 'react';
import { FaClockRotateLeft, FaShieldHalved } from 'react-icons/fa6';
import { getAuditEventsApi } from '../../api';

const actionLabels = {
  'account.profile_updated': 'Updated account profile',
  'account.password_reset': 'Reset account password',
  'employee.created': 'Added employee account',
  'employee.updated': 'Updated employee details',
  'employee.access_deactivated': 'Deactivated employee access',
  'employee.access_restored': 'Restored employee access',
  'invitation.created': 'Created employee invitation',
  'invitation.resent': 'Resent employee invitation',
  'invitation.revoked': 'Revoked employee invitation',
  'invitation.accepted': 'Invitation accepted',
  'task.created': 'Created task',
  'task.updated': 'Updated task',
  'task.archived': 'Archived task',
  'task.restored': 'Restored task',
  'task.status_changed': 'Changed task status',
  'task.comment_added': 'Added task comment',
  'task.bulk_archive': 'Bulk archived tasks',
  'task.bulk_restore': 'Bulk restored tasks',
  'task.bulk_priority': 'Bulk updated task priority',
  'leave.requested': 'Requested leave',
  'leave.approved': 'Approved leave request',
  'leave.rejected': 'Declined leave request',
  'leave.cancelled': 'Cancelled leave request'
};

const describeDetails = details => {
  if (!details || typeof details !== 'object') return '';
  if (details.assigneeId) return `Assignee ID ${details.assigneeId}${details.priority ? ` · ${details.priority} priority` : ''}`;
  if (details.previousStatus && details.status) return `${details.previousStatus} → ${details.status}`;
  if (details.updatedCount !== undefined) {
    return `${details.updatedCount} updated · ${details.skippedCount || 0} skipped${details.priority ? ` · ${details.priority} priority` : ''}`;
  }
  if (details.assigneeChanged || details.dueDateChanged) {
    return [
      details.assigneeChanged ? 'Assignee changed' : '',
      details.dueDateChanged ? 'Due date changed' : ''
    ].filter(Boolean).join(' · ');
  }
  if (details.email) return details.email;
  if (details.startDate && details.endDate) return `${details.startDate} – ${details.endDate}${details.leaveType ? ` · ${details.leaveType}` : ''}`;
  return '';
};

export default function AuditTrail() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      setEvents(await getAuditEventsApi());
      setError('');
    } catch (requestError) {
      setError(requestError.message || 'Could not load the audit trail.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEvents();
    window.addEventListener('ems:workspace-updated', loadEvents);
    return () => window.removeEventListener('ems:workspace-updated', loadEvents);
  }, [loadEvents]);

  return (
    <section className="dashboard-card overflow-hidden rounded-2xl shadow-sm" aria-labelledby="audit-trail-heading">
      <div className="flex items-center gap-3 border-b border-slate-100 p-5 sm:p-6 bg-white">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-700">
          <FaClockRotateLeft className="text-base" aria-hidden="true" />
        </span>
        <div>
          <h2 id="audit-trail-heading" className="dashboard-card-heading text-slate-900">Security & Workspace Audit Trail</h2>
          <p className="mt-0.5 text-xs text-slate-500">Immutable ledger of account, invitation, workflow, and access changes.</p>
        </div>
      </div>

      {error && <p role="alert" className="m-5 rounded-xl border border-rose-100 bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}

      {loading && !events.length ? (
        <div role="status" className="p-10 text-center text-slate-400">
          <span className="mx-auto block h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent mb-2" />
          <p className="text-xs">Loading audit events…</p>
        </div>
      ) : events.length ? (
        <ol className="divide-y divide-slate-100 bg-white">
          {events.map(event => (
            <li key={event.id} className="flex flex-col gap-1.5 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-6 hover:bg-slate-50/60 transition-colors">
              <div className="min-w-0 flex items-start gap-3">
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500">
                  <FaShieldHalved className="text-[10px]" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-900">
                    <span className="font-bold text-slate-950">{event.actorName}</span>
                    <span className="text-slate-600"> · {actionLabels[event.action] || 'Workspace activity'}</span>
                    {event.entityId && <span className="ml-1.5 font-mono text-[10px] text-slate-400">#{event.entityId}</span>}
                  </p>
                  {describeDetails(event.details) && (
                    <p className="mt-0.5 truncate text-[11px] text-slate-500">{describeDetails(event.details)}</p>
                  )}
                </div>
              </div>
              <time className="shrink-0 text-[10px] text-slate-400 font-medium pl-9 sm:pl-0" dateTime={event.createdAt}>
                {new Date(event.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </time>
            </li>
          ))}
        </ol>
      ) : !error ? (
        <p className="p-10 text-center text-xs text-slate-400">No security activity has been recorded yet.</p>
      ) : null}
      {loading && events.length > 0 && <p role="status" className="border-t border-slate-100 px-5 py-2 text-[10px] text-slate-400">Refreshing activity…</p>}
    </section>
  );
}

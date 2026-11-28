import { useEffect, useState } from 'react';
import { FaCalendarDay, FaCalendarWeek, FaClock, FaClipboardCheck, FaTriangleExclamation, FaWandMagicSparkles } from 'react-icons/fa6';
import { getWorkspaceBriefApi } from '../../api';

export default function WorkspaceBrief({ onAsk, onTimeOff, onReview, onWork, isAdmin }) {
  const [brief, setBrief] = useState(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let controller;
    const load = async () => {
      controller?.abort();
      const request = new AbortController();
      controller = request;
      try {
        const result = await getWorkspaceBriefApi(request.signal);
        if (request.signal.aborted) return;
        setBrief(result);
        setError(false);
      } catch {
        if (!request.signal.aborted) setError(true);
      }
    };
    load();
    window.addEventListener('ems:workspace-updated', load);
    return () => {
      controller?.abort();
      window.removeEventListener('ems:workspace-updated', load);
    };
  }, [retry]);

  const items = brief ? [
    { label: 'Overdue tasks', value: brief.overdue, icon: FaClock, action: () => onWork('overdue', brief.today) },
    { label: 'Due today', value: brief.dueToday, icon: FaCalendarDay, action: () => onWork('today', brief.today) },
    { label: 'Needs attention', value: brief.blocked, icon: FaTriangleExclamation, action: () => onWork('failed', brief.today) },
    ...(brief.canReviewLeave ? [
      { label: 'Leave approvals', value: brief.pendingApprovals, icon: FaClipboardCheck, action: onReview },
      { label: 'People away in 7 days', value: brief.peopleAway, icon: FaCalendarWeek, action: onTimeOff }
    ] : [
      { label: 'My pending leave', value: brief.myPendingLeave, icon: FaCalendarWeek, action: onTimeOff }
    ])
  ] : [];

  return (
    <section className="workspace-brief" aria-labelledby="workspace-brief-title">
      <div className="workspace-brief-head">
        <div>
          <h2 id="workspace-brief-title">Today’s briefing</h2>
          <p>{isAdmin ? 'Workspace deadlines and team availability.' : 'Your deadlines and time-off activity.'}</p>
        </div>
        <button type="button" className="workspace-brief-ai" onClick={onAsk}>
          <FaWandMagicSparkles aria-hidden="true" /> Open brief in AI
        </button>
      </div>
      {error ? (
        <p className="workspace-brief-feedback" role="status">Couldn’t refresh the briefing. <button type="button" onClick={() => setRetry(value => value + 1)}>Retry</button></p>
      ) : brief ? (
        <ul className="workspace-brief-metrics">
          {items.map(({ label, value, icon: Icon, action }) => (
            <li key={label}>
              <button type="button" onClick={action}>
                <Icon aria-hidden="true" />
                <strong>{value}</strong><span>{label}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : <p className="workspace-brief-feedback" role="status">Loading today’s briefing…</p>}
    </section>
  );
}

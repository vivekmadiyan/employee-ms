import { useState } from 'react';

export default function HandoffEditor({ draft, teammates, busy, error, savedTask, dismissed, onConfirm, onDismiss, onOpenTask }) {
  const [fields, setFields] = useState({
    taskTitle: draft.taskTitle, taskDescription: draft.taskDescription, assignedTo: '', taskDate: '',
    category: draft.category, priority: draft.priority
  });
  const update = event => setFields(current => ({ ...current, [event.target.name]: event.target.value }));

  if (savedTask) return (
    <div className="ai-action-result" role="status">
      <span>Follow-up task created.</span>
      <button type="button" onClick={() => onOpenTask(savedTask)}>Open follow-up task</button>
    </div>
  );
  if (dismissed) return <p className="ai-note" role="status">Handoff draft dismissed.</p>;
  return (
    <form className="ai-action ai-handoff" aria-label="Review follow-up task" onSubmit={event => {
      event.preventDefault();
      onConfirm({ ...fields, handoff: { sourceTaskId: draft.sourceTaskId, requestId: draft.requestId } });
    }}>
      <h3>Review follow-up task</h3>
      <p className="ai-note">Choose who owns the follow-up and when it’s due. Creating it sends the usual assignment notifications.</p>
      <label>Title
        <input name="taskTitle" required minLength={2} maxLength={160} value={fields.taskTitle} onChange={update} disabled={busy} />
      </label>
      <label>Handoff details
        <textarea name="taskDescription" required minLength={2} maxLength={4000} rows={4} value={fields.taskDescription} onChange={update} disabled={busy} />
      </label>
      <div className="ai-handoff-fields">
        <label>Assignee
          <select name="assignedTo" required value={fields.assignedTo} onChange={update} disabled={busy}>
            <option value="">Choose a teammate</option>
            {teammates.map(person => <option key={person.id} value={person.id}>{person.firstName} ({person.email})</option>)}
          </select>
        </label>
        <label>Due date
          <input type="date" name="taskDate" required value={fields.taskDate} onChange={update} disabled={busy} />
        </label>
      </div>
      <p className="ai-note">Category {fields.category} · Priority {fields.priority}</p>
      {error && <p role="alert" className="ai-error">{error}</p>}
      <div className="ai-action-controls">
        <button type="submit" className="workspace-action" disabled={busy || !fields.assignedTo || !fields.taskDate}>
          Confirm and create follow-up
        </button>
        <button type="button" className="ai-quiet" onClick={onDismiss} disabled={busy}>Dismiss draft</button>
      </div>
    </form>
  );
}

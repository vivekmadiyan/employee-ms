import React, { useCallback, useEffect, useState } from 'react';
import { createTaskCommentApi, getTaskCommentsApi } from '../../api';

export default function TaskComments({ taskId }) {
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState([]);
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setComments(await getTaskCommentsApi(taskId));
      setError('');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  useEffect(() => {
    if (!open) return undefined;
    window.addEventListener('ems:workspace-updated', refresh);
    return () => window.removeEventListener('ems:workspace-updated', refresh);
  }, [open, refresh]);

  const submit = async event => {
    event.preventDefault();
    if (!content.trim()) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const comment = await createTaskCommentApi(taskId, content.trim());
      setComments(current => [...current, comment]);
      setContent('');
      setNotice(comment.emailStatus === 'sent'
        ? 'Comment posted; an email update was sent to the other task participants.'
        : comment.emailStatus === 'not_configured'
          ? 'Comment posted; email notifications are not configured.'
          : comment.emailStatus === 'failed' || comment.emailStatus === 'partial_failure'
            ? `Comment posted, but email delivery ${comment.emailStatus === 'failed' ? 'failed' : 'was incomplete'}.`
            : '');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 border-t border-slate-100 pt-3">
      <button type="button" onClick={() => setOpen(value => !value)} aria-expanded={open} className="text-xs font-bold text-indigo-600 hover:text-indigo-800">
        {open ? 'Hide discussion' : 'View discussion'}
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          {loading && <p role="status" className="text-xs text-slate-500">Loading comments…</p>}
          {error && <p role="alert" className="rounded-lg bg-rose-50 p-2 text-xs text-rose-700">{error}</p>}
          {notice && <p role="status" className="rounded-lg bg-emerald-50 p-2 text-xs text-emerald-800">{notice}</p>}
          {!loading && !comments.length && !error && <p className="text-xs text-slate-500">No comments yet.</p>}
          {comments.map(comment => (
            <article key={comment.id} className="rounded-lg bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-slate-700">{comment.firstName}</p>
                <time className="text-[10px] text-slate-400" dateTime={comment.createdAt}>{new Date(comment.createdAt).toLocaleString()}</time>
              </div>
              <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-slate-600">{comment.content}</p>
            </article>
          ))}
          <form onSubmit={submit} className="space-y-2">
            <label htmlFor={`comment-${taskId}`} className="sr-only">Add a comment</label>
            <textarea id={`comment-${taskId}`} value={content} maxLength="2000" rows="2" onChange={event => setContent(event.target.value)} placeholder="Add a comment…" className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-xs" />
            <button type="submit" disabled={busy || !content.trim()} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{busy ? 'Posting…' : 'Post comment'}</button>
          </form>
        </div>
      )}
    </div>
  );
}

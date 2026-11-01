import React, { useCallback, useEffect, useState } from 'react';
import { FaCommentDots, FaPaperPlane } from 'react-icons/fa6';
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
      <button 
        type="button" 
        onClick={() => setOpen(value => !value)} 
        aria-expanded={open} 
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
      >
        <FaCommentDots className="text-xs" />
        <span>{open ? 'Hide discussion' : 'View discussion'}</span>
        {comments.length > 0 && (
          <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-100 px-1 text-[10px] font-bold text-indigo-700">
            {comments.length}
          </span>
        )}
      </button>

      {open && (
        <div className="mt-3 space-y-3 animate-fade-in">
          {loading && (
            <div className="flex items-center gap-2 py-2 text-xs text-slate-400">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
              <span>Loading discussion…</span>
            </div>
          )}
          {error && <p role="alert" className="rounded-xl border border-rose-100 bg-rose-50 p-2.5 text-xs text-rose-700">{error}</p>}
          {notice && <p role="status" className="rounded-xl border border-emerald-100 bg-emerald-50 p-2.5 text-xs text-emerald-800">{notice}</p>}
          {!loading && !comments.length && !error && (
            <p className="rounded-xl bg-slate-50 p-3 text-center text-xs text-slate-400">No comments yet. Start the conversation below.</p>
          )}

          {comments.map(comment => (
            <article key={comment.id} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-left">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-700">
                    {comment.firstName ? comment.firstName.charAt(0).toUpperCase() : 'U'}
                  </span>
                  <span className="text-xs font-bold text-slate-800">{comment.firstName}</span>
                </div>
                <time className="text-[10px] text-slate-400" dateTime={comment.createdAt}>
                  {new Date(comment.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </time>
              </div>
              <p className="mt-1.5 whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-600 pl-6.5">{comment.content}</p>
            </article>
          ))}

          <form onSubmit={submit} className="relative mt-2">
            <label htmlFor={`comment-${taskId}`} className="sr-only">Add a comment</label>
            <textarea 
              id={`comment-${taskId}`} 
              value={content} 
              maxLength={2000} 
              rows={2} 
              onChange={event => setContent(event.target.value)} 
              placeholder="Write a message to teammates…" 
              className="w-full resize-none rounded-xl border border-slate-200 bg-white p-3 pr-20 text-xs text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" 
            />
            <button 
              type="submit" 
              disabled={busy || !content.trim()} 
              className="absolute right-2 bottom-3 inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-40 transition-all"
            >
              <FaPaperPlane className="text-[9px]" />
              <span>{busy ? '…' : 'Send'}</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

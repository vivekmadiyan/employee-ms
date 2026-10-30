import React, { useState } from 'react';
import { createInvitationApi } from '../../api';

export default function InviteEmployee() {
  const [form, setForm] = useState({ firstName: '', email: '', department: 'General' });
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copyMessage, setCopyMessage] = useState('');
  const update = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  const submit = async e => {
    e.preventDefault(); setBusy(true); setError(''); setResult(null); setCopyMessage('');
    try { const data = await createInvitationApi(form); setResult(data); setForm({ firstName: '', email: '', department: 'General' }); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  const copy = async () => {
    if (!result?.inviteUrl) return;
    try {
      await navigator.clipboard.writeText(result.inviteUrl);
      setCopyMessage('Invitation link copied.');
    } catch {
      setCopyMessage('Copy was blocked by the browser. Select and copy the link above.');
    }
  };
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="invite-heading text-xl font-bold text-slate-900">Invite an employee</h2>
          <p className="mt-1 text-sm text-slate-600">Send a secure 7-day invitation to join your company workspace.</p>
        </div>
        <span className="self-start rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">Team access</span>
      </div>
      <form onSubmit={submit} className="mt-5 grid gap-3 sm:grid-cols-2">
        {error && <div role="alert" className="sm:col-span-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        {result && (
          <div role="status" className={`sm:col-span-2 rounded-lg p-4 text-sm ${result.emailStatus === 'sent' ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-950'}`}>
            <b>
              {result.emailStatus === 'sent'
                ? 'Your email provider accepted the invitation.'
                : result.emailStatus === 'not_configured'
                  ? 'Invitation created, but email is not configured on the backend.'
                  : result.emailStatus === 'failed'
                    ? 'Invitation created, but the email provider rejected the message.'
                    : result.emailSent
                      ? 'Your email provider accepted the invitation.'
                      : 'Invitation created, but email was not sent.'}
            </b>
            <p className="mt-1">
              {result.emailSent
                ? 'The recipient may still need to check spam or promotions.'
                : 'Set valid SMTP_HOST, SMTP_USER, SMTP_PASS, and SMTP_FROM values in Render, or share this secure link directly. It expires in 7 days.'}
            </p>
            {result.inviteUrl && (
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <input aria-label="Invitation link" readOnly value={result.inviteUrl} className="min-w-0 flex-1 rounded border border-neutral-300 bg-white px-2 py-2 text-xs text-slate-900" />
                <button type="button" onClick={copy} className="rounded bg-emerald-800 px-3 py-2 text-xs font-semibold text-white">Copy link</button>
              </div>
            )}
            {copyMessage && <p className="mt-2 text-xs" aria-live="polite">{copyMessage}</p>}
          </div>
        )}
        <input name="firstName" required minLength="2" maxLength="80" autoComplete="given-name" aria-label="Employee name" placeholder="Employee name" value={form.firstName} onChange={update} className="min-w-0 rounded-lg border border-neutral-300 px-3 py-2 text-slate-900" />
        <input name="email" required maxLength="254" type="email" autoComplete="email" aria-label="Work email" placeholder="Work email" value={form.email} onChange={update} className="min-w-0 rounded-lg border border-neutral-300 px-3 py-2 text-slate-900" />
        <input name="department" required minLength="2" maxLength="80" aria-label="Department" placeholder="Department" value={form.department} onChange={update} className="min-w-0 rounded-lg border border-neutral-300 px-3 py-2 text-slate-900" />
        <button disabled={busy} className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{busy ? 'Creating invitation…' : 'Invite employee'}</button>
      </form>
    </section>
  );
}

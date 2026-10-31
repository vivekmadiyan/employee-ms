import React, { useState } from 'react';
import { FaArrowRight, FaCheck, FaCopy, FaEnvelope, FaLayerGroup } from 'react-icons/fa6';
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
    try { const data = await createInvitationApi(form); setResult(data); setForm({ firstName: '', email: '', department: 'General' }); window.dispatchEvent(new Event('ems:invitations-updated')); }
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
    <section className="dashboard-card rounded-2xl p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
            <FaLayerGroup aria-hidden="true" />
          </span>
          <div>
          <h2 className="invite-heading text-lg font-extrabold tracking-tight text-slate-900 sm:text-xl">Invite an employee</h2>
          <p className="mt-1 text-sm text-slate-600">Send a secure 7-day invitation to join your company workspace.</p>
          </div>
        </div>
        <span className="self-start rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-indigo-700">Team access</span>
      </div>
      <form onSubmit={submit} className="mt-5 grid gap-3 sm:grid-cols-2">
        {error && <div role="alert" className="sm:col-span-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        {result && (
          <div role="status" className={`sm:col-span-2 rounded-lg p-4 text-sm ${result.emailStatus === 'sent' ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-950'}`}>
            <b className="flex items-start gap-2 leading-5">
              {result.emailStatus === 'sent' ? <FaCheck className="mt-1 shrink-0 text-emerald-600" aria-hidden="true" /> : <FaEnvelope className="mt-1 shrink-0 text-amber-700" aria-hidden="true" />}
              {result.emailStatus === 'sent'
                ? 'Your email provider accepted the invitation.'
                : result.emailStatus === 'not_configured'
                  ? 'Invitation created, but email is not configured on the backend.'
                  : result.emailStatus === 'provider_auth_failed'
                    ? 'Invitation created, but Brevo rejected the API credentials.'
                  : result.emailStatus === 'provider_rejected'
                    ? 'Invitation created, but Brevo rejected the message. Check the backend logs and sender verification.'
                    : result.emailStatus === 'network_error'
                      ? 'Invitation created, but the backend could not reach Brevo. Check the Render service logs and try again.'
                    : result.emailStatus === 'failed'
                      ? 'Invitation created, but email delivery failed.'
                      : result.emailSent
                        ? 'Your email provider accepted the invitation.'
                        : 'Invitation created, but email was not sent.'}
            </b>
            <p className="mt-1">
              {result.emailSent
                ? 'The recipient may still need to check spam or promotions.'
                : result.emailStatus === 'not_configured'
                  ? 'Set BREVO_API_KEY and a verified BREVO_SENDER_EMAIL in Render, or share this secure link directly. It expires in 7 days.'
                  : result.emailStatus === 'provider_auth_failed'
                    ? 'Replace BREVO_API_KEY in Render with an active Brevo API key from SMTP & API → API Keys. Do not use the SMTP key or SMTP password. Save and redeploy, then try again.'
                  : result.emailStatus === 'provider_rejected'
                    ? 'Check your Brevo API key, verified sender, and Brevo transactional email logs, or share this secure link directly. It expires in 7 days.'
                    : result.emailStatus === 'network_error'
                      ? 'Check Render service connectivity and logs, then retry or share this secure link directly. It expires in 7 days.'
                      : 'Check the Render service logs, or share this secure link directly. It expires in 7 days.'}
            </p>
            {result.inviteUrl && (
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <input aria-label="Invitation link" readOnly value={result.inviteUrl} className="min-w-0 flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-xs text-slate-900" />
                <button type="button" onClick={copy} className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-800 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-900">
                  <FaCopy aria-hidden="true" /> Copy link
                </button>
              </div>
            )}
            {copyMessage && <p className="mt-2 text-xs" aria-live="polite">{copyMessage}</p>}
          </div>
        )}
        <input name="firstName" required minLength="2" maxLength="80" autoComplete="given-name" aria-label="Employee name" placeholder="Employee name" value={form.firstName} onChange={update} className="min-w-0 rounded-lg border border-neutral-300 px-3 py-2 text-slate-900" />
        <input name="email" required maxLength="254" type="email" autoComplete="email" aria-label="Work email" placeholder="Work email" value={form.email} onChange={update} className="min-w-0 rounded-lg border border-neutral-300 px-3 py-2 text-slate-900" />
        <input name="department" required minLength="2" maxLength="80" aria-label="Department" placeholder="Department" value={form.department} onChange={update} className="min-w-0 rounded-lg border border-neutral-300 px-3 py-2 text-slate-900" />
        <button disabled={busy} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm shadow-indigo-600/20 disabled:opacity-60">
          {busy ? 'Creating invitation…' : <>Invite employee <FaArrowRight aria-hidden="true" /></>}
        </button>
      </form>
    </section>
  );
}

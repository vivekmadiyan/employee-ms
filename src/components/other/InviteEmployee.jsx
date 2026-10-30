import React, { useContext, useState } from 'react';
import { createInvitationApi } from '../../api';
import { AuthContext } from '../../context/AuthProvider';

export default function InviteEmployee() {
  const { refresh } = useContext(AuthContext);
  const [form, setForm] = useState({ firstName: '', email: '', department: 'General' });
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const update = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  const submit = async e => {
    e.preventDefault(); setBusy(true); setError(''); setResult(null);
    try { const data = await createInvitationApi(form); setResult(data); setForm({ firstName: '', email: '', department: 'General' }); await refresh(); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  const copy = async () => { if (result?.inviteUrl) await navigator.clipboard.writeText(result.inviteUrl); };
  return <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
    <div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-bold text-neutral-800">Invite an employee</h2><p className="mt-1 text-sm text-neutral-500">Send a secure 7-day invitation to join your company workspace.</p></div><span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">Team access</span></div>
    <form onSubmit={submit} className="mt-5 grid gap-3 sm:grid-cols-2">
      {error && <div className="sm:col-span-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {result && <div className="sm:col-span-2 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800"><b>{result.emailSent ? 'Invitation email sent.' : 'Invitation created.'}</b>{result.inviteUrl && <div className="mt-2 flex gap-2"><input readOnly value={result.inviteUrl} className="min-w-0 flex-1 rounded border border-emerald-200 bg-white px-2 py-1 text-xs"/><button type="button" onClick={copy} className="rounded bg-emerald-700 px-3 py-1 text-xs font-semibold text-white">Copy link</button></div>}</div>}
      <input name="firstName" required placeholder="Employee name" value={form.firstName} onChange={update} className="rounded-lg border border-neutral-300 px-3 py-2" />
      <input name="email" required type="email" placeholder="Work email" value={form.email} onChange={update} className="rounded-lg border border-neutral-300 px-3 py-2" />
      <input name="department" placeholder="Department" value={form.department} onChange={update} className="rounded-lg border border-neutral-300 px-3 py-2" />
      <button disabled={busy} className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{busy ? 'Creating invitation…' : 'Invite employee'}</button>
    </form>
  </div>;
}

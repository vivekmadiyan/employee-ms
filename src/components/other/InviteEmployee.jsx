import React, { useContext, useState } from 'react';
import { FaArrowRight, FaCheck, FaCopy, FaEnvelope, FaUserPlus } from 'react-icons/fa6';
import { createInvitationApi } from '../../api';
import { AuthContext } from '../../context/AuthProvider';

export default function InviteEmployee() {
  const emptyForm = () => ({
    firstName: '',
    email: '',
    department: 'General',
    jobTitle: '',
    employmentType: 'unspecified',
    hireDate: '',
    team: 'General',
    managerId: ''
  });
  const { userData } = useContext(AuthContext);
  const [form, setForm] = useState(emptyForm);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copyMessage, setCopyMessage] = useState('');

  const update = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  
  const submit = async e => {
    e.preventDefault(); setBusy(true); setError(''); setResult(null); setCopyMessage('');
    try { 
      const data = await createInvitationApi({
        ...form,
        hireDate: form.hireDate || null,
        managerId: form.managerId ? Number(form.managerId) : null
      });
      setResult(data); 
      setForm(emptyForm());
      window.dispatchEvent(new Event('ems:invitations-updated')); 
    }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const copy = async () => {
    if (!result?.inviteUrl) return;
    try {
      await navigator.clipboard.writeText(result.inviteUrl);
      setCopyMessage('Invitation link copied to clipboard.');
    } catch {
      setCopyMessage('Copy was blocked by the browser. Select and copy the link above.');
    }
  };

  return (
    <section className="dashboard-card rounded-2xl p-5 sm:p-6 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
            <FaUserPlus className="text-base" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-base sm:text-lg font-bold tracking-tight text-slate-900">Invite Teammate</h2>
            <p className="mt-0.5 text-xs text-slate-500">Send an invitation link with 7-day access to join your workspace.</p>
          </div>
        </div>
        <span className="self-start rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-700">
          Direct Link
        </span>
      </div>

      <form onSubmit={submit} className="mt-5 grid gap-3 sm:grid-cols-2">
        {error && (
          <div role="alert" className="sm:col-span-2 rounded-xl border border-rose-100 bg-rose-50 p-3 text-xs text-rose-700">
            {error}
          </div>
        )}

        {result && (
          <div role="status" className={`sm:col-span-2 rounded-xl border p-4 text-xs ${
            result.emailStatus === 'sent' 
              ? 'border-emerald-200 bg-emerald-50/70 text-emerald-900' 
              : 'border-amber-200 bg-amber-50/70 text-amber-950'
          }`}>
            <b className="flex items-start gap-2 text-xs leading-5">
              {result.emailStatus === 'sent' ? (
                <FaCheck className="mt-0.5 shrink-0 text-emerald-600" aria-hidden="true" />
              ) : (
                <FaEnvelope className="mt-0.5 shrink-0 text-amber-700" aria-hidden="true" />
              )}
              {result.emailStatus === 'sent'
                ? 'Your email provider accepted the invitation.'
                : result.emailStatus === 'not_configured'
                  ? 'Invitation created! (Email service not configured; copy the direct link below).'
                  : result.emailStatus === 'provider_auth_failed'
                    ? 'Invitation created, but Brevo rejected the API credentials.'
                    : result.emailStatus === 'provider_rejected'
                      ? 'Invitation created, but email provider rejected the message.'
                      : result.emailStatus === 'network_error'
                        ? 'Invitation created, but email provider timed out.'
                        : result.emailStatus === 'failed'
                          ? 'Invitation created, but email delivery failed.'
                          : result.emailSent
                            ? 'Your email provider accepted the invitation.'
                            : 'Invitation created; copy the link below.'}
            </b>
            <p className="mt-1 text-[11px] text-slate-600">
              {result.emailSent
                ? 'The recipient may still need to check spam or promotions.'
                : 'Share this secure direct link with your teammate. It will expire in 7 days.'}
            </p>
            {result.inviteUrl && (
              <div className="mt-2.5 flex flex-col gap-2 sm:flex-row">
                <input 
                  aria-label="Invitation link" 
                  readOnly 
                  value={result.inviteUrl} 
                  className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:outline-none" 
                />
                <button 
                  type="button" 
                  onClick={copy} 
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-700 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-800 transition-colors"
                >
                  <FaCopy aria-hidden="true" className="text-xs" /> 
                  <span>Copy Link</span>
                </button>
              </div>
            )}
            {copyMessage && <p className="mt-2 text-[11px] font-semibold text-emerald-700" aria-live="polite">{copyMessage}</p>}
          </div>
        )}

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Full Name</label>
          <input 
            name="firstName" 
            required 
            minLength={2} 
            maxLength={80} 
            autoComplete="given-name" 
            aria-label="Employee name" 
            placeholder="e.g. Alex Morgan" 
            value={form.firstName} 
            onChange={update} 
            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" 
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Work Email</label>
          <input 
            name="email" 
            required 
            maxLength={254} 
            type="email" 
            autoComplete="email" 
            aria-label="Work email" 
            placeholder="alex@company.com" 
            value={form.email} 
            onChange={update} 
            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" 
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Department</label>
          <input 
            name="department" 
            required 
            minLength={2} 
            maxLength={80} 
            aria-label="Department" 
            placeholder="e.g. Engineering, Design" 
            value={form.department} 
            onChange={update} 
            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" 
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Team</label>
          <input
            name="team"
            required
            minLength={2}
            maxLength={80}
            aria-label="Team"
            placeholder="e.g. Platform"
            value={form.team}
            onChange={update}
            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Reports To <span className="font-normal text-slate-400">(optional)</span></label>
          <select
            name="managerId"
            value={form.managerId}
            onChange={update}
            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="">No manager assigned</option>
            {(userData || []).filter(employee => employee.active).map(employee => (
              <option key={employee.id} value={employee.id}>{employee.firstName} · {employee.jobTitle || employee.team || employee.department}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Job Title <span className="font-normal text-slate-400">(optional)</span></label>
          <input
            name="jobTitle"
            maxLength={120}
            aria-label="Job title"
            placeholder="e.g. Product Designer"
            value={form.jobTitle}
            onChange={update}
            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Employment Type</label>
          <select
            name="employmentType"
            value={form.employmentType}
            onChange={update}
            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="unspecified">Unspecified</option>
            <option value="full_time">Full-time</option>
            <option value="part_time">Part-time</option>
            <option value="contractor">Contractor</option>
            <option value="temporary">Temporary</option>
            <option value="intern">Intern</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Hire Date <span className="font-normal text-slate-400">(optional)</span></label>
          <input
            name="hireDate"
            type="date"
            value={form.hireDate}
            onChange={update}
            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        <div className="flex items-end">
          <button 
            disabled={busy} 
            className="w-full inline-flex h-[38px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 px-4 text-xs font-bold text-white shadow-sm shadow-indigo-600/20 hover:from-indigo-500 hover:to-indigo-600 disabled:opacity-60 transition-all"
          >
            {busy ? 'Sending invite…' : <>Send Invitation <FaArrowRight aria-hidden="true" className="text-xs" /></>}
          </button>
        </div>
      </form>
    </section>
  );
}

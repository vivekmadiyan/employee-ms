import React, { useContext, useEffect, useState } from 'react';
import { FaArrowLeft, FaBuilding, FaLayerGroup, FaLock } from 'react-icons/fa6';
import { acceptInvitationApi, getInvitationApi } from '../../api';
import { AuthContext } from '../../context/AuthProvider';

export default function AcceptInvitation({ token, onBack }) {
  const { setSession } = useContext(AuthContext);
  const [invite, setInvite] = useState(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getInvitationApi(token)
      .then(data => {
        if (active) setInvite(data);
      })
      .catch(requestError => {
        if (active) setError(requestError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [token]);

  const submit = async event => {
    event.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }

    setBusy(true);
    try {
      const data = await acceptInvitationApi(token, password);
      setSession(data.user, data.token);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-shell">
      <div className="w-full max-w-[440px]">
        <button 
          className="back-home group inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors mb-4" 
          onClick={onBack}
        >
          <FaArrowLeft className="text-[10px] group-hover:-translate-x-0.5 transition-transform" aria-hidden="true" /> 
          <span>Back to Home</span>
        </button>

        <main className="auth-card rounded-3xl border border-slate-200/80 bg-white p-7 sm:p-9 shadow-xl shadow-slate-900/5">
          <div className="auth-header text-center mb-6">
            <div className="brand justify-center mb-3">
              <span className="brand-mark"><FaLayerGroup /></span>
              <span>Employee<span className="brand-accent">MS</span></span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">Activate your workspace account</h2>
            <p className="auth-subtitle text-xs text-slate-500 mt-1">Set a password to accept your company invitation.</p>
          </div>

          {loading && (
            <div role="status" className="p-8 text-center text-slate-400">
              <span className="mx-auto block h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent mb-2" />
              <p className="text-xs">Validating invitation token…</p>
            </div>
          )}
          {error && <div role="alert" className="error-box rounded-xl border border-rose-100 bg-rose-50 p-3 text-xs text-rose-700 mb-4">{error}</div>}

          {invite && (
            <>
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4 text-xs">
                <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-indigo-700">
                  <FaBuilding className="text-[10px]" /> You&apos;re Joining
                </span>
                <p className="mt-1 text-sm font-bold text-slate-900">{invite.company.name}</p>
                <p className="mt-0.5 text-slate-600">{invite.firstName} · {invite.email}</p>
                <span className="mt-2.5 inline-flex rounded-md bg-white px-2 py-0.5 text-[10px] font-bold text-indigo-700 shadow-2xs">
                  {invite.department}
                </span>
              </div>

              <form onSubmit={submit} className="mt-5 space-y-4">
                <div>
                  <label htmlFor="invitePassword" className="block text-xs font-bold text-slate-700 mb-1">Create password</label>
                  <div className="auth-input-wrap relative">
                    <FaLock className="auth-input-icon text-slate-400" aria-hidden="true" />
                    <input
                      id="invitePassword"
                      required
                      minLength={10}
                      maxLength={128}
                      autoComplete="new-password"
                      type="password"
                      value={password}
                      onChange={event => setPassword(event.target.value)}
                      placeholder="At least 10 characters"
                      className="w-full rounded-xl border border-slate-200 bg-white py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">Use at least 10 characters.</p>
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-xs font-bold text-slate-700 mb-1">Confirm password</label>
                  <div className="auth-input-wrap relative">
                    <FaLock className="auth-input-icon text-slate-400" aria-hidden="true" />
                    <input
                      id="confirmPassword"
                      required
                      minLength={10}
                      maxLength={128}
                      autoComplete="new-password"
                      type="password"
                      value={confirm}
                      onChange={event => setConfirm(event.target.value)}
                      placeholder="Re-enter password"
                      className="w-full rounded-xl border border-slate-200 bg-white py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                </div>

                <button 
                  disabled={busy} 
                  className="submit-btn mt-2 w-full rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 py-2.5 text-xs font-bold text-white shadow-sm shadow-indigo-600/25 hover:from-indigo-500 hover:to-indigo-600 disabled:opacity-60 transition-all"
                >
                  {busy ? 'Activating account…' : 'Accept Invitation & Enter'}
                </button>
              </form>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

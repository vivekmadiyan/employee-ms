import React, { useContext, useEffect, useState } from 'react';
import { FaArrowLeft, FaLayerGroup } from 'react-icons/fa6';
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
      <button className="back-home" onClick={onBack}>
        <FaArrowLeft aria-hidden="true" /> Back to home
      </button>

      <main className="auth-card">
        <div className="auth-header">
          <div className="brand justify-center">
            <span className="brand-mark"><FaLayerGroup /></span>
            <span>Employee<span className="brand-accent">MS</span></span>
          </div>
          <h2>Join your company</h2>
          <p className="auth-subtitle">Create your password to activate your employee account.</p>
        </div>

        {loading && <p role="status" className="mt-7 text-center text-sm text-slate-500">Checking your invitation…</p>}
        {error && <div role="alert" className="error-box">{error}</div>}

        {invite && (
          <>
            <div className="mt-7 rounded-xl border border-indigo-100 bg-indigo-50/70 p-4 text-sm">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-600">You’re joining</p>
              <p className="mt-1 font-bold text-slate-900">{invite.company.name}</p>
              <p className="mt-1 text-slate-600">{invite.firstName} · {invite.email}</p>
              <span className="mt-3 inline-flex rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-indigo-700">{invite.department}</span>
            </div>

            <form onSubmit={submit} className="auth-form mt-6 space-y-5">
              <div>
                <label htmlFor="invitePassword">Create password</label>
                <input
                  id="invitePassword"
                  required
                  minLength="10"
                  maxLength="128"
                  autoComplete="new-password"
                  type="password"
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                  placeholder="At least 10 characters"
                />
                <p className="mt-1.5 text-xs text-slate-500">Use at least 10 characters.</p>
              </div>
              <div>
                <label htmlFor="confirmPassword">Confirm password</label>
                <input
                  id="confirmPassword"
                  required
                  minLength="10"
                  maxLength="128"
                  autoComplete="new-password"
                  type="password"
                  value={confirm}
                  onChange={event => setConfirm(event.target.value)}
                  placeholder="Enter your password again"
                />
              </div>
              <button disabled={busy} className="submit-btn !mt-0">
                {busy ? 'Activating account…' : 'Accept invitation'}
              </button>
            </form>
          </>
        )}
      </main>
    </div>
  );
}

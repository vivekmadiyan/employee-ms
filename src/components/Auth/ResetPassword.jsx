import React, { useState } from 'react';
import { FaArrowLeft, FaLayerGroup, FaLock } from 'react-icons/fa6';
import { resetPasswordApi } from '../../api';

export default function ResetPassword({ token, onBack }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async event => {
    event.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      const result = await resetPasswordApi(token, password);
      setMessage(result.message);
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
          <span>Back to Sign In</span>
        </button>

        <main className="auth-card rounded-3xl border border-slate-200/80 bg-white p-7 sm:p-9 shadow-xl shadow-slate-900/5">
          <div className="auth-header text-center mb-6">
            <div className="brand justify-center mb-3">
              <span className="brand-mark"><FaLayerGroup /></span>
              <span>Employee<span className="brand-accent">MS</span></span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">Choose a new password</h2>
            <p className="auth-subtitle text-xs text-slate-500 mt-1">Must be at least 10 characters. Reset link valid for 30 minutes.</p>
          </div>

          {error && <div role="alert" className="error-box rounded-xl border border-rose-100 bg-rose-50 p-3 text-xs text-rose-700 mb-4">{error}</div>}

          {message ? (
            <div className="space-y-4">
              <p role="status" className="rounded-2xl border border-emerald-100 bg-emerald-50/80 p-5 text-xs text-emerald-900 font-semibold leading-relaxed">
                {message}
              </p>
              <button 
                className="submit-btn w-full rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 py-2.5 text-xs font-bold text-white shadow-sm" 
                onClick={onBack}
              >
                Return to Sign In
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label htmlFor="new-password" className="block text-xs font-bold text-slate-700 mb-1">New password</label>
                <div className="auth-input-wrap relative">
                  <FaLock className="auth-input-icon text-slate-400" aria-hidden="true" />
                  <input 
                    id="new-password" 
                    type="password" 
                    autoComplete="new-password" 
                    required 
                    minLength={10} 
                    maxLength={128} 
                    value={password} 
                    onChange={event => setPassword(event.target.value)} 
                    placeholder="At least 10 characters"
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="confirm-new-password" className="block text-xs font-bold text-slate-700 mb-1">Confirm new password</label>
                <div className="auth-input-wrap relative">
                  <FaLock className="auth-input-icon text-slate-400" aria-hidden="true" />
                  <input 
                    id="confirm-new-password" 
                    type="password" 
                    autoComplete="new-password" 
                    required 
                    minLength={10} 
                    maxLength={128} 
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
                {busy ? 'Updating…' : 'Update Password'}
              </button>
            </form>
          )}
        </main>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { FaArrowLeft, FaEnvelope, FaLayerGroup } from 'react-icons/fa6';
import { requestPasswordResetApi } from '../../api';

export default function ForgotPassword({ onBack }) {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async event => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const result = await requestPasswordResetApi(email);
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
            <h2 className="text-xl font-bold tracking-tight text-slate-900">Reset your password</h2>
            <p className="auth-subtitle text-xs text-slate-500 mt-1">Enter your account email and we&apos;ll send a secure single-use recovery link.</p>
          </div>

          {error && <div role="alert" className="error-box rounded-xl border border-rose-100 bg-rose-50 p-3 text-xs text-rose-700 mb-4">{error}</div>}

          {message ? (
            <div role="status" className="rounded-2xl border border-emerald-100 bg-emerald-50/80 p-5 text-xs leading-relaxed text-emerald-900">
              <p className="font-semibold">{message}</p>
              <button 
                type="button" 
                onClick={onBack} 
                className="mt-4 inline-flex items-center gap-1.5 font-bold text-emerald-700 hover:underline"
              >
                Return to sign in
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label htmlFor="reset-email" className="block text-xs font-bold text-slate-700 mb-1">Email address</label>
                <div className="auth-input-wrap relative">
                  <FaEnvelope className="auth-input-icon text-slate-400" aria-hidden="true" />
                  <input 
                    id="reset-email" 
                    type="email" 
                    autoComplete="email" 
                    required 
                    maxLength={254} 
                    value={email} 
                    onChange={event => setEmail(event.target.value)} 
                    placeholder="you@company.com" 
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              <button 
                disabled={busy} 
                className="submit-btn w-full rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 py-2.5 text-xs font-bold text-white shadow-sm shadow-indigo-600/25 hover:from-indigo-500 hover:to-indigo-600 disabled:opacity-60 transition-all"
              >
                {busy ? 'Sending link…' : 'Send Recovery Link'}
              </button>
            </form>
          )}
        </main>
      </div>
    </div>
  );
}

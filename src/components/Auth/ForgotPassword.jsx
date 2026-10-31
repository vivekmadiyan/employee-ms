import React, { useState } from 'react';
import { FaArrowLeft, FaLayerGroup } from 'react-icons/fa6';
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
      <button className="back-home" onClick={onBack}><FaArrowLeft aria-hidden="true" /> Back to sign in</button>
      <main className="auth-card">
        <div className="auth-header">
          <div className="brand justify-center"><span className="brand-mark"><FaLayerGroup /></span><span>Employee<span className="brand-accent">MS</span></span></div>
          <h2>Reset your password</h2>
          <p className="auth-subtitle">Enter your account email and we’ll send a reset link if it matches an active account.</p>
        </div>
        {error && <div role="alert" className="error-box">{error}</div>}
        {message ? (
          <div role="status" className="mt-6 rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm leading-6 text-emerald-900">
            {message}
          </div>
        ) : (
          <form onSubmit={submit} className="auth-form mt-6">
            <label htmlFor="reset-email">Email address</label>
            <input id="reset-email" type="email" autoComplete="email" required maxLength="254" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@company.com" />
            <button disabled={busy} className="submit-btn">{busy ? 'Sending…' : 'Send reset link'}</button>
          </form>
        )}
      </main>
    </div>
  );
}

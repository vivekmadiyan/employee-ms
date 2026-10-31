import React, { useState } from 'react';
import { FaArrowLeft, FaLayerGroup } from 'react-icons/fa6';
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
      <button className="back-home" onClick={onBack}><FaArrowLeft aria-hidden="true" /> Back to sign in</button>
      <main className="auth-card">
        <div className="auth-header">
          <div className="brand justify-center"><span className="brand-mark"><FaLayerGroup /></span><span>Employee<span className="brand-accent">MS</span></span></div>
          <h2>Choose a new password</h2>
          <p className="auth-subtitle">Use at least 10 characters. Reset links expire after 30 minutes.</p>
        </div>
        {error && <div role="alert" className="error-box">{error}</div>}
        {message ? (
          <div className="mt-6">
            <p role="status" className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-900">{message}</p>
            <button className="submit-btn" onClick={onBack}>Return to sign in</button>
          </div>
        ) : (
          <form onSubmit={submit} className="auth-form mt-6 space-y-5">
            <div>
              <label htmlFor="new-password">New password</label>
              <input id="new-password" type="password" autoComplete="new-password" required minLength="10" maxLength="128" value={password} onChange={event => setPassword(event.target.value)} />
            </div>
            <div>
              <label htmlFor="confirm-new-password">Confirm new password</label>
              <input id="confirm-new-password" type="password" autoComplete="new-password" required minLength="10" maxLength="128" value={confirm} onChange={event => setConfirm(event.target.value)} />
            </div>
            <button disabled={busy} className="submit-btn !mt-0">{busy ? 'Updating…' : 'Update password'}</button>
          </form>
        )}
      </main>
    </div>
  );
}

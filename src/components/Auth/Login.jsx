import React, { useContext, useState } from 'react';
import { FaArrowLeft, FaEnvelope, FaLayerGroup, FaLock } from 'react-icons/fa6';
import { loginApi } from '../../api';
import { AuthContext } from '../../context/AuthProvider';

const Login = ({ onBack, onForgotPassword }) => {
  const { setSession } = useContext(AuthContext);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaRequired, setMfaRequired] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submitHandler = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);

    try {
      const data = await loginApi(email, password, mfaRequired ? mfaCode : undefined);
      if (data.mfaRequired) {
        setMfaRequired(true);
      } else {
        setSession(data.user, data.token);
      }
    } catch (err) {
      setError(err.message);
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
          <FaArrowLeft className="text-[10px] group-hover:-translate-x-0.5 transition-transform" /> 
          <span>Back to Home</span>
        </button>

        <div className="auth-card rounded-3xl border border-slate-200/80 bg-white p-7 sm:p-9 shadow-xl shadow-slate-900/5">
          <div className="auth-header text-center mb-6">
            <div className="brand justify-center mb-3">
              <span className="brand-mark"><FaLayerGroup /></span>
              <span>Employee<span className="brand-accent">MS</span></span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">Welcome back</h2>
            <p className="auth-subtitle text-xs text-slate-500 mt-1">{mfaRequired ? 'Enter the code from your authenticator app or a recovery code.' : 'Sign in to access your company workspace.'}</p>
          </div>

          {error && (
            <div role="alert" className="error-box mb-4 rounded-xl border border-rose-100 bg-rose-50 p-3 text-xs text-rose-700">
              {error}
            </div>
          )}

          <form onSubmit={submitHandler} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs font-bold text-slate-700 mb-1">
                Work Email
              </label>
              <div className="auth-input-wrap relative">
                <FaEnvelope className="auth-input-icon text-slate-400" aria-hidden="true" />
                <input 
                  id="email" 
                  type="email" 
                  autoComplete="email" 
                  required 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  placeholder="you@company.com" 
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="password" className="block text-xs font-bold text-slate-700">
                  Password
                </label>
                <button 
                  type="button" 
                  className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800" 
                  onClick={onForgotPassword}
                >
                  Forgot password?
                </button>
              </div>
              <div className="auth-input-wrap relative">
                <FaLock className="auth-input-icon text-slate-400" aria-hidden="true" />
                <input 
                  id="password" 
                  type="password" 
                  autoComplete="current-password" 
                  required 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  placeholder="••••••••••••" 
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>

            {mfaRequired && (
              <div>
                <label htmlFor="mfa-code" className="mb-1 block text-xs font-bold text-slate-700">Authenticator or recovery code</label>
                <input
                  id="mfa-code"
                  name="mfaCode"
                  inputMode="text"
                  autoComplete="one-time-code"
                  autoFocus
                  required
                  value={mfaCode}
                  onChange={event => setMfaCode(event.target.value)}
                  placeholder="6-digit code"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm tracking-widest text-slate-900 placeholder:text-xs placeholder:tracking-normal focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            )}

            <button 
              type="submit" 
              className="submit-btn mt-2 w-full rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 py-2.5 text-xs font-bold text-white shadow-sm shadow-indigo-600/25 hover:from-indigo-500 hover:to-indigo-600 disabled:opacity-60 transition-all" 
              disabled={busy}
            >
              {busy ? 'Signing in…' : mfaRequired ? 'Verify and Sign In' : 'Sign In to Workspace'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;

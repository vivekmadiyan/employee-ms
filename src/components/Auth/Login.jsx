import React, { useContext, useState } from 'react';
import { FaArrowLeft, FaEnvelope, FaLayerGroup, FaLock } from 'react-icons/fa6';
import { loginApi } from '../../api';
import { AuthContext } from '../../context/AuthProvider';

const Login = ({ onBack }) => {
  const { setSession } = useContext(AuthContext);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submitHandler = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);

    try {
      const data = await loginApi(email, password);
      setSession(data.user, data.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-shell">
      <button className="back-home" onClick={onBack}><FaArrowLeft /> Back to home</button>

      <div className="auth-card">
        <div className="auth-header">
          <div className="brand justify-center">
            <span className="brand-mark"><FaLayerGroup /></span>
            <span>Employee<span className="brand-accent">MS</span></span>
          </div>
          <h2>Welcome back</h2>
          <p className="auth-subtitle">Sign in to access your workspace.</p>
        </div>

        {error && <div className="error-box">{error}</div>}

        <form onSubmit={submitHandler}>
          <div className="field">
            <label htmlFor="email">Email address</label>
            <div className="auth-input-wrap">
                <FaEnvelope className="auth-input-icon" aria-hidden="true" />
                <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <div className="auth-input-wrap">
                <FaLock className="auth-input-icon" aria-hidden="true" />
                <input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" />
            </div>
          </div>

          <button type="submit" className="submit-btn" disabled={busy}>
            {busy ? 'Signing in…' : 'Log in'}
          </button>
        </form>

      </div>
    </div>
  );
};

export default Login;

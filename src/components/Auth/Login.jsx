import React, { useContext, useState } from 'react';
import { FaArrowLeft, FaEnvelope, FaLock } from 'react-icons/fa6';
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
          <div className="brand" style={{ justifyContent: 'center' }}>
            <span className="brand-mark">E</span>
            <span>Employee<span className="brand-accent">MS</span></span>
          </div>
          <h2>Welcome back</h2>
          <p className="auth-subtitle">Sign in to access your workspace.</p>
        </div>

        {error && <div className="error-box">{error}</div>}

        <form onSubmit={submitHandler}>
          <div className="field">
            <label htmlFor="email">Email address</label>
            <div style={{ position: 'relative' }}>
              <FaEnvelope style={{ position: 'absolute', left: '12px', top: '14px', color: '#64748b' }} />
              <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" style={{ paddingLeft: '38px' }} />
            </div>
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <div style={{ position: 'relative' }}>
              <FaLock style={{ position: 'absolute', left: '12px', top: '14px', color: '#64748b' }} />
              <input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" style={{ paddingLeft: '38px' }} />
            </div>
          </div>

          <button type="submit" className="submit-btn" disabled={busy}>
            {busy ? 'Signing in…' : 'Log in'}
          </button>
        </form>

        <div className="muted-note">
          <strong>Seed admin:</strong> admin@example.com / 123<br />
          <strong>Seed employee:</strong> e@e.com / 123
        </div>
      </div>
    </div>
  );
};

export default Login;

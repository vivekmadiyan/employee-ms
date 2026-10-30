import React, { useContext, useState } from 'react';
import { FaArrowLeft, FaLayerGroup } from 'react-icons/fa6';
import { registerCompanyApi } from '../../api';
import { AuthContext } from '../../context/AuthProvider';

const RegisterCompany = ({ onBack, onLogin }) => {
  const { setSession } = useContext(AuthContext);
  const [form, setForm] = useState({
    companyName: '',
    industry: 'Technology',
    size: '1-10',
    firstName: '',
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const update = event => setForm(current => ({ ...current, [event.target.name]: event.target.value }));

  const submit = async event => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const data = await registerCompanyApi(form);
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

      <main className="auth-register">
        <div className="auth-header">
          <div className="brand justify-center">
            <span className="brand-mark"><FaLayerGroup /></span>
            <span>Employee<span className="brand-accent">MS</span></span>
          </div>
          <h2>Create your company workspace</h2>
          <p className="auth-subtitle">A clear, shared place for your team to get work done.</p>
        </div>

        <form onSubmit={submit} className="auth-form auth-register-form">
          {error && <div role="alert" className="error-box auth-register-error">{error}</div>}

          <div className="auth-company-field">
            <label htmlFor="companyName">Company name</label>
            <input id="companyName" name="companyName" value={form.companyName} onChange={update} required maxLength="120" autoComplete="organization" placeholder="Acme Technologies" />
          </div>

          <div className="auth-register-grid">
            <div>
              <label htmlFor="industry">Industry</label>
              <input id="industry" name="industry" value={form.industry} onChange={update} required minLength="2" maxLength="80" />
            </div>
            <div>
              <label htmlFor="size">Company size</label>
              <select id="size" name="size" value={form.size} onChange={update}>
                <option>1-10</option>
                <option>11-50</option>
                <option>51-200</option>
                <option>201-500</option>
                <option>500+</option>
              </select>
            </div>
            <div>
              <label htmlFor="firstName">Your name</label>
              <input id="firstName" name="firstName" value={form.firstName} onChange={update} required minLength="2" maxLength="80" autoComplete="name" placeholder="Alex Morgan" />
            </div>
            <div>
              <label htmlFor="registerEmail">Work email</label>
              <input id="registerEmail" name="email" type="email" value={form.email} onChange={update} required maxLength="254" autoComplete="email" placeholder="you@company.com" />
            </div>
          </div>

          <div className="auth-company-field">
            <label htmlFor="registerPassword">Password</label>
            <input id="registerPassword" name="password" type="password" minLength="10" maxLength="128" autoComplete="new-password" value={form.password} onChange={update} required placeholder="At least 10 characters" />
            <p className="mt-1.5 text-xs text-slate-500">Use at least 10 characters.</p>
          </div>

          <button type="submit" disabled={busy} className="submit-btn auth-register-submit">
            {busy ? 'Creating workspace…' : 'Create company workspace'}
          </button>
          <button type="button" onClick={onLogin} className="auth-login-link">
            Already have an account? <span>Sign in</span>
          </button>
        </form>
      </main>
    </div>
  );
};

export default RegisterCompany;

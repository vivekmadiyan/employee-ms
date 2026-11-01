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
      <div className="w-full max-w-[620px]">
        <button 
          className="back-home group inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors mb-4" 
          onClick={onBack}
        >
          <FaArrowLeft className="text-[10px] group-hover:-translate-x-0.5 transition-transform" aria-hidden="true" /> 
          <span>Back to Home</span>
        </button>

        <main className="auth-register">
          <div className="auth-header text-center mb-6">
            <div className="brand justify-center mb-3">
              <span className="brand-mark"><FaLayerGroup /></span>
              <span>Employee<span className="brand-accent">MS</span></span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">Create your company workspace</h2>
            <p className="auth-subtitle text-xs text-slate-500 mt-1">Set up your organization, invite your team, and streamline operations.</p>
          </div>

          <form onSubmit={submit} className="rounded-3xl border border-slate-200/80 bg-white p-7 sm:p-9 shadow-xl shadow-slate-900/5 space-y-4">
            {error && <div role="alert" className="error-box rounded-xl border border-rose-100 bg-rose-50 p-3 text-xs text-rose-700">{error}</div>}

            <div>
              <label htmlFor="companyName" className="block text-xs font-bold text-slate-700 mb-1">Company name</label>
              <input 
                id="companyName" 
                name="companyName" 
                value={form.companyName} 
                onChange={update} 
                required 
                maxLength={120} 
                autoComplete="organization" 
                placeholder="Acme Technologies" 
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="industry" className="block text-xs font-bold text-slate-700 mb-1">Industry</label>
                <input 
                  id="industry" 
                  name="industry" 
                  value={form.industry} 
                  onChange={update} 
                  required 
                  minLength={2} 
                  maxLength={80} 
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
              <div>
                <label htmlFor="size" className="block text-xs font-bold text-slate-700 mb-1">Company size</label>
                <select 
                  id="size" 
                  name="size" 
                  value={form.size} 
                  onChange={update}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option>1-10</option>
                  <option>11-50</option>
                  <option>51-200</option>
                  <option>201-500</option>
                  <option>500+</option>
                </select>
              </div>
              <div>
                <label htmlFor="firstName" className="block text-xs font-bold text-slate-700 mb-1">Your name</label>
                <input 
                  id="firstName" 
                  name="firstName" 
                  value={form.firstName} 
                  onChange={update} 
                  required 
                  minLength={2} 
                  maxLength={80} 
                  autoComplete="name" 
                  placeholder="Alex Morgan" 
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
              <div>
                <label htmlFor="registerEmail" className="block text-xs font-bold text-slate-700 mb-1">Work email</label>
                <input 
                  id="registerEmail" 
                  name="email" 
                  type="email" 
                  value={form.email} 
                  onChange={update} 
                  required 
                  maxLength={254} 
                  autoComplete="email" 
                  placeholder="you@company.com" 
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>

            <div>
              <label htmlFor="registerPassword" className="block text-xs font-bold text-slate-700 mb-1">Password</label>
              <input 
                id="registerPassword" 
                name="password" 
                type="password" 
                minLength={10} 
                maxLength={128} 
                autoComplete="new-password" 
                value={form.password} 
                onChange={update} 
                required 
                placeholder="At least 10 characters" 
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              />
              <p className="mt-1 text-[11px] text-slate-400">Must be at least 10 characters.</p>
            </div>

            <button 
              type="submit" 
              disabled={busy} 
              className="submit-btn mt-2 w-full rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 py-3 text-xs font-bold text-white shadow-sm shadow-indigo-600/25 hover:from-indigo-500 hover:to-indigo-600 disabled:opacity-60 transition-all"
            >
              {busy ? 'Creating workspace…' : 'Create Company Workspace'}
            </button>
            
            <div className="text-center pt-2">
              <button type="button" onClick={onLogin} className="text-xs font-medium text-slate-500 hover:text-indigo-600">
                Already have an account? <span className="font-bold text-indigo-600 underline">Sign in</span>
              </button>
            </div>
          </form>
        </main>
      </div>
    </div>
  );
};

export default RegisterCompany;

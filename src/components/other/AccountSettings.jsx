import React, { useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FaGear, FaLock, FaXmark } from 'react-icons/fa6';
import { AuthContext } from '../../context/AuthProvider';
import { updateProfileApi } from '../../api';

export default function AccountSettings({ onClose }) {
  const { currentUser, updateCurrentUser } = useContext(AuthContext);
  const dialogRef = useRef(null);
  const [form, setForm] = useState({ firstName: currentUser.firstName, email: currentUser.email, currentPassword: '', newPassword: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeButton = dialog?.querySelector('[data-dialog-close]');
    closeButton?.focus();
    const handleKeyDown = event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !dialog) return;
      const focusable = [...dialog.querySelectorAll('button:not([disabled]), input:not([disabled]), [href], select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      document.querySelector('[aria-label="Account settings"]')?.focus();
    };
  }, [onClose]);

  const update = event => setForm(current => ({ ...current, [event.target.name]: event.target.value }));
  const submit = async event => {
    event.preventDefault();
    setMessage('');
    setError('');
    setBusy(true);
    try {
      const result = await updateProfileApi({
        firstName: form.firstName,
        email: form.email,
        ...(form.newPassword ? { currentPassword: form.currentPassword, newPassword: form.newPassword } : {})
      });
      updateCurrentUser(result.user);
      setForm(current => ({ ...current, currentPassword: '', newPassword: '' }));
      setMessage('Your account details were updated.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div 
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-md animate-fade-in" 
      role="presentation" 
      onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}
    >
      <section 
        ref={dialogRef} 
        role="dialog" 
        aria-modal="true" 
        aria-labelledby="account-settings-heading" 
        className="w-full max-w-lg rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xl sm:p-8 animate-slide-down"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
              <FaGear className="text-base" />
            </span>
            <div>
              <h2 id="account-settings-heading" className="text-lg font-bold tracking-tight text-slate-900">Account Settings</h2>
              <p className="mt-0.5 text-xs text-slate-500">Manage profile identity and authentication credentials.</p>
            </div>
          </div>
          <button 
            type="button" 
            data-dialog-close 
            onClick={onClose} 
            aria-label="Close settings" 
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <FaXmark className="text-sm" />
          </button>
        </div>

        {error && <p role="alert" className="mt-4 rounded-xl border border-rose-100 bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}
        {message && <p role="status" className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-xs text-emerald-800">{message}</p>}

        <form onSubmit={submit} className="mt-5 space-y-4">
          <div>
            <label htmlFor="settings-name" className="block text-xs font-bold text-slate-700 mb-1">
              Full Name
            </label>
            <div className="relative">
              <input 
                id="settings-name" 
                name="firstName" 
                required 
                minLength={2} 
                maxLength={80} 
                autoComplete="name" 
                value={form.firstName} 
                onChange={update} 
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-900 shadow-xs focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>

          <div>
            <label htmlFor="settings-email" className="block text-xs font-bold text-slate-700 mb-1">
              Work Email Address
            </label>
            <input 
              id="settings-email" 
              name="email" 
              type="email" 
              required 
              maxLength={254} 
              autoComplete="email" 
              value={form.email} 
              onChange={update} 
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-900 shadow-xs focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 space-y-3">
            <div className="flex items-center gap-1.5 text-slate-700">
              <FaLock className="text-xs text-slate-400" />
              <p className="text-[11px] font-bold uppercase tracking-wider">Change Password (Optional)</p>
            </div>
            
            <div>
              <label htmlFor="settings-current-password" className="block text-xs font-medium text-slate-600 mb-1">Current Password</label>
              <input 
                id="settings-current-password" 
                name="currentPassword" 
                type="password" 
                autoComplete="current-password" 
                value={form.currentPassword} 
                onChange={update} 
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-900 shadow-xs focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <label htmlFor="settings-new-password" className="block text-xs font-medium text-slate-600 mb-1">New Password</label>
              <input 
                id="settings-new-password" 
                name="newPassword" 
                type="password" 
                autoComplete="new-password" 
                minLength={10} 
                maxLength={128} 
                value={form.newPassword} 
                onChange={update} 
                placeholder="At least 10 characters" 
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 shadow-xs focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2.5 pt-2 sm:flex-row sm:justify-end">
            <button 
              type="button" 
              onClick={onClose} 
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button 
              disabled={busy} 
              className="rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 px-5 py-2 text-xs font-bold text-white shadow-sm shadow-indigo-600/25 hover:from-indigo-500 hover:to-indigo-600 disabled:opacity-60 transition-all"
            >
              {busy ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </section>
    </div>,
    document.body
  );
}

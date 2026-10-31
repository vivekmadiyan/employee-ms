import React, { useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/40 p-4 backdrop-blur-sm" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="account-settings-heading" className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="account-settings-heading" className="text-xl font-extrabold tracking-tight text-slate-900">Account settings</h2>
            <p className="mt-1 text-sm text-slate-500">Update your profile and sign-in password.</p>
          </div>
          <button type="button" data-dialog-close onClick={onClose} aria-label="Close settings" className="rounded-lg px-2 py-1 text-xl text-slate-500 hover:bg-slate-100">×</button>
        </div>
        {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {message && <p role="status" className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
        <form onSubmit={submit} className="auth-form mt-5 space-y-4">
          <div><label htmlFor="settings-name">Name</label><input id="settings-name" name="firstName" required minLength="2" maxLength="80" autoComplete="name" value={form.firstName} onChange={update} /></div>
          <div><label htmlFor="settings-email">Email address</label><input id="settings-email" name="email" type="email" required maxLength="254" autoComplete="email" value={form.email} onChange={update} /></div>
          <div className="border-t border-slate-100 pt-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Change password (optional)</p>
            <div className="space-y-4">
              <div><label htmlFor="settings-current-password">Current password</label><input id="settings-current-password" name="currentPassword" type="password" autoComplete="current-password" value={form.currentPassword} onChange={update} /></div>
              <div><label htmlFor="settings-new-password">New password</label><input id="settings-new-password" name="newPassword" type="password" autoComplete="new-password" minLength="10" maxLength="128" value={form.newPassword} onChange={update} placeholder="At least 10 characters" /></div>
            </div>
          </div>
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} className="min-h-10 rounded-lg border border-slate-200 px-4 text-sm font-bold text-slate-600">Close</button>
            <button disabled={busy} className="min-h-10 rounded-lg bg-indigo-600 px-4 text-sm font-bold text-white disabled:opacity-60">{busy ? 'Saving…' : 'Save changes'}</button>
          </div>
        </form>
      </section>
    </div>,
    document.body
  );
}

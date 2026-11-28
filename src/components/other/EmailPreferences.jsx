import { useEffect, useState } from 'react';
import { getEmailPreferencesApi, saveEmailPreferencesApi, sendTestEmailApi } from '../../api';

export default function EmailPreferences() {
  const [preferences, setPreferences] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    const request = new AbortController();
    getEmailPreferencesApi(request.signal).then(setPreferences).catch(error => {
      if (!request.signal.aborted) setError(error.message);
    });
    return () => request.abort();
  }, []);

  async function update(taskReminders) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      setPreferences(await saveEmailPreferencesApi(taskReminders));
      setNotice('Email preferences saved.');
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await sendTestEmailApi();
      setNotice('The email provider accepted your test. Check your inbox or spam folder.');
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-5 rounded-xl border border-slate-200 p-4" aria-labelledby="email-preferences-heading">
      <h3 id="email-preferences-heading" className="font-bold text-slate-900">Email notifications</h3>
      <p className="mt-1 text-xs text-slate-600">Account and workflow emails go to your sign-in address.</p>
      {preferences?.eligible && (
        <label className="mt-3 flex min-h-10 items-center gap-2 font-semibold text-slate-800">
          <input type="checkbox" className="h-4 w-4 rounded accent-[var(--ui-accent)]" checked={preferences.taskReminders}
            disabled={busy} onChange={event => update(event.target.checked)} />
          Daily due and overdue task reminder
        </label>
      )}
      {preferences?.emailConfigured ? (
        <button type="button" disabled={busy} onClick={sendTest}
          className="mt-2 min-h-10 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-800">
          Send test email
        </button>
      ) : preferences && <p className="mt-2 text-xs text-slate-600">Email delivery is currently unavailable.</p>}
      {error && <p role="alert" className="mt-2 text-xs text-rose-700">{error}</p>}
      {notice && <p role="status" className="mt-2 text-xs text-emerald-800">{notice}</p>}
    </section>
  );
}

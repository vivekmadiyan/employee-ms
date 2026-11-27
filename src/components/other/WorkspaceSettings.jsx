import React, { useContext, useId, useState } from 'react';
import { saveWorkspaceSettingsApi } from '../../api';
import { WorkspaceSettingsContext } from '../../context/WorkspaceSettingsContext';

const zoneSuggestions = ['UTC', ...(Intl.supportedValuesOf?.('timeZone') || ['Asia/Kolkata', 'Europe/London', 'America/New_York'])];

export default function WorkspaceSettings() {
  const { settings, setSettings } = useContext(WorkspaceSettingsContext);
  const zones = useId();
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function save(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setStatus('');
    setError('');
    setSaving(true);
    try {
      const next = await saveWorkspaceSettingsApi({ timeZone: String(form.get('timeZone')).trim(), aiEnabled: form.has('aiEnabled') });
      setSettings(next);
      setStatus('Workspace settings saved.');
    } catch (saveError) {
      setError(saveError.message || 'Could not save workspace settings.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="dashboard-card space-y-4 p-5 sm:p-6" aria-labelledby="workspace-settings-title">
      <h2 id="workspace-settings-title" className="dashboard-card-heading text-slate-900">Workspace settings</h2>
      <form key={`${settings.timeZone}:${settings.aiEnabled}`} onSubmit={save} className="space-y-4">
        <label className="grid max-w-sm gap-1 text-sm font-semibold text-slate-800">
          Workspace time zone
          <input name="timeZone" list={zones} required defaultValue={settings.timeZone} maxLength={80}
            className="rounded-xl border-slate-200 bg-white text-sm text-slate-900" />
        </label>
        <datalist id={zones}>{zoneSuggestions.map(zone => <option key={zone} value={zone} />)}</datalist>
        <p className="text-xs text-slate-500">Deadlines, reports and time off use this time zone.</p>
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <input type="checkbox" name="aiEnabled" defaultChecked={settings.aiEnabled} className="rounded text-indigo-600" />
          Allow external AI providers
        </label>
        <p className="text-xs text-slate-500">Verify your provider’s data settings for employee information. Database summaries and report figures are available with this setting off.</p>
        <button type="submit" className="workspace-action" disabled={saving}>{saving ? 'Saving…' : 'Save workspace settings'}</button>
        {status && <p role="status" className="text-sm text-slate-600">{status}</p>}
        {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      </form>
    </section>
  );
}

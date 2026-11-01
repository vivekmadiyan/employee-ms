import React, { useEffect, useState } from 'react';
import { FaLink, FaSlack } from 'react-icons/fa6';
import { getSlackIntegrationApi, removeSlackIntegrationApi, saveSlackIntegrationApi } from '../../api';

export default function SlackIntegration() {
  const [configured, setConfigured] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    getSlackIntegrationApi()
      .then(result => setConfigured(result.configured))
      .catch(requestError => setError(requestError.message))
      .finally(() => setLoading(false));
  }, []);

  const save = async event => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await saveSlackIntegrationApi(webhookUrl.trim());
      setConfigured(true);
      setWebhookUrl('');
      setNotice('Slack notifications are configured for this workspace.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await removeSlackIntegrationApi();
      setConfigured(false);
      setNotice('Slack notifications have been disconnected.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="dashboard-card rounded-2xl p-5 shadow-sm sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
          <FaSlack aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-sm font-bold text-slate-900">Slack task notifications</h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-500">
            Send a channel message when a task is assigned or reassigned. The webhook is encrypted, only shown once, and restricted to Slack&apos;s HTTPS webhook host.
          </p>
        </div>
      </div>

      {error && <p role="alert" className="mt-4 rounded-lg bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}
      {notice && <p role="status" className="mt-4 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800">{notice}</p>}

      {loading ? (
        <p role="status" className="mt-4 text-xs text-slate-500">Checking integration status…</p>
      ) : configured ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700">Connected</span>
          <button type="button" disabled={busy} onClick={remove} className="text-xs font-semibold text-rose-600 hover:text-rose-800 disabled:opacity-60">
            {busy ? 'Please wait…' : 'Disconnect Slack'}
          </button>
        </div>
      ) : (
        <form onSubmit={save} className="mt-4 flex flex-col gap-2 sm:flex-row">
          <label className="sr-only" htmlFor="slack-webhook-url">Slack incoming webhook URL</label>
          <div className="relative min-w-0 flex-1">
            <FaLink aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400" />
            <input
              id="slack-webhook-url"
              type="password"
              autoComplete="new-password"
              required
              maxLength={512}
              value={webhookUrl}
              onChange={event => setWebhookUrl(event.target.value)}
              placeholder="https://hooks.slack.com/services/…"
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-xs text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
          <button type="submit" disabled={busy} className="rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-60">
            {busy ? 'Connecting…' : 'Connect Slack'}
          </button>
        </form>
      )}
      <a href="https://api.slack.com/messaging/webhooks" target="_blank" rel="noreferrer" className="mt-3 inline-block text-[11px] font-semibold text-indigo-600 hover:text-indigo-800">
        How to create a Slack incoming webhook
      </a>
    </section>
  );
}

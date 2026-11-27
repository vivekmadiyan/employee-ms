import React, { useContext, useState } from 'react';
import { FaWandMagicSparkles } from 'react-icons/fa6';
import { askAiApi } from '../../api';
import { AuthContext } from '../../context/AuthProvider';
import { localDateKey } from '../../utils/workFocus';

export default function AIAssistant() {
  const { currentUser } = useContext(AuthContext);
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const suggestions = [
    'What needs attention in the next 7 days?',
    currentUser?.role === 'admin' ? 'Summarize the team’s open work' : 'Summarize my open work',
    'Which tasks are overdue?'
  ];
  const canAsk = question.trim().length >= 3 && !busy;

  const ask = async event => {
    event.preventDefault();
    if (!canAsk) return;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      setResult(await askAiApi(question.trim(), localDateKey(new Date())));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="dashboard-card p-5 sm:p-6" aria-labelledby="ai-assistant-heading">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
          <FaWandMagicSparkles aria-hidden="true" />
        </span>
        <div>
          <h2 id="ai-assistant-heading" className="dashboard-card-heading">AI workspace assistant</h2>
          <p className="text-xs text-slate-500">Get a quick read on your current work and next steps.</p>
        </div>
      </div>
      <form onSubmit={ask} className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input aria-label="Ask about tasks" value={question} maxLength={500} readOnly={busy}
          onChange={event => setQuestion(event.target.value)}
          placeholder={suggestions[0]} className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm" />
        <button type="submit" disabled={!canAsk}
          className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
          {busy ? 'Thinking…' : 'Ask AI'}
        </button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2">
        {suggestions.map(suggestion => (
          <button key={suggestion} type="button" disabled={busy} onClick={() => setQuestion(suggestion)}
            className="rounded-full border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50">
            {suggestion}
          </button>
        ))}
      </div>
      {error && <p role="alert" className="mt-3 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}
      {result && (
        <div role="status" className="mt-4 rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
          {result.source === 'workspace' && <p className="mb-1 text-xs font-semibold">Workspace summary · AI unavailable</p>}
          <p className="whitespace-pre-wrap break-words">{result.answer}</p>
        </div>
      )}
    </section>
  );
}

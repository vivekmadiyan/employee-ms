import React, { useState } from 'react';
import { FaWandMagicSparkles } from 'react-icons/fa6';
import { askAiApi } from '../../api';

export default function AIAssistant() {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const suggestions = ['What needs attention this week?', 'Summarize my open work', 'Which tasks are overdue?'];
  const ask = async event => {
    event.preventDefault();
    if (!question.trim()) return;
    setBusy(true); setError('');
    try { setAnswer((await askAiApi(question.trim())).answer); setQuestion(''); }
    catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  };
  return <section className="dashboard-card p-5 sm:p-6" aria-labelledby="ai-assistant-heading">
    <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-50 text-indigo-600"><FaWandMagicSparkles /></span><div><h2 id="ai-assistant-heading" className="dashboard-card-heading">AI workspace assistant</h2><p className="text-xs text-slate-500">Get a quick read on your current work and next steps.</p></div></div>
    <form onSubmit={ask} className="mt-4 flex flex-col gap-2 sm:flex-row"><input aria-label="Ask AI" value={question} onChange={event => setQuestion(event.target.value)} placeholder="What needs attention this week?" className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm" /><button type="submit" disabled={busy || !question.trim()} className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{busy ? 'Thinking…' : 'Ask AI'}</button></form>
    <div className="mt-3 flex flex-wrap gap-2">{suggestions.map(suggestion => <button key={suggestion} type="button" onClick={() => setQuestion(suggestion)} className="rounded-full border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50">{suggestion}</button>)}</div>
    {error && <p role="alert" className="mt-3 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}
    {answer && <p className="mt-4 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">{answer}</p>}
  </section>;
}

import React, { useContext, useEffect, useRef, useState } from 'react';
import { FaArrowUpRightFromSquare, FaWandMagicSparkles } from 'react-icons/fa6';
import { askAiApi } from '../../api';
import { AuthContext } from '../../context/AuthProvider';
import { localDateKey } from '../../utils/workFocus';
import './AIAssistant.css';

const providerNames = { gemini: 'Gemini', groq: 'Groq' };

export default function AIAssistant({ onOpenTask }) {
  const { currentUser } = useContext(AuthContext);
  const [mode, setMode] = useState('chat');
  const [question, setQuestion] = useState('');
  const [turns, setTurns] = useState([]);
  const [summary, setSummary] = useState(null);
  const [pending, setPending] = useState('');
  const [error, setError] = useState('');
  const log = useRef(null);
  const input = useRef(null);
  const summaries = [
    'Which tasks are overdue?',
    'What needs attention in the next 7 days?',
    currentUser?.role === 'admin' ? 'Summarize the team’s open work' : 'Summarize my open work'
  ];
  const starters = [summaries[1], 'Draft a handoff using the open tasks.'];

  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [turns, pending, mode]);

  function switchMode(nextMode) {
    setMode(nextMode);
    setError('');
  }

  async function sendQuestion(nextQuestion) {
    const text = nextQuestion.trim();
    if (pending || text.length < 3) return;
    setPending(text);
    setError('');
    const history = mode === 'chat'
      ? turns.slice(-4).map(turn => ({ question: turn.question, answer: turn.answer.slice(0, 2500) }))
      : [];

    try {
      const result = await askAiApi({ question: text, today: localDateKey(new Date()), mode, history });
      if (!result.answer) throw new Error('No answer was returned. Try again.');
      if (mode === 'chat') {
        if (!providerNames[result.source]) throw new Error('The AI provider is unavailable. You can still open Task summaries.');
        setTurns(current => [...current, { ...result, question: text }].slice(-12));
        setQuestion('');
      } else {
        if (result.source !== 'workspace') throw new Error('Task summaries are temporarily unavailable.');
        setSummary({ question: text, answer: result.answer });
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setPending('');
    }
  }

  return (
    <section className="dashboard-card ai-panel" aria-labelledby="ai-assistant-heading">
      <header className="ai-panel-header">
        <span className="ai-symbol"><FaWandMagicSparkles aria-hidden="true" /></span>
        <h2 id="ai-assistant-heading" className="dashboard-card-heading">AI workspace assistant</h2>
      </header>
      <div className="ai-modes" role="group" aria-label="Assistant mode">
        <button type="button" disabled={Boolean(pending)} aria-pressed={mode === 'chat'} onClick={() => switchMode('chat')}>AI chat</button>
        <button type="button" disabled={Boolean(pending)} aria-pressed={mode === 'summary'} onClick={() => switchMode('summary')}>Task summaries</button>
      </div>

      {mode === 'chat' ? (
        <>
          {turns.length > 0 && (
            <button type="button" className="ai-reset" disabled={Boolean(pending)} onClick={() => {
              setTurns([]);
              setQuestion('');
              setError('');
              input.current?.focus();
            }}>New chat</button>
          )}
          {(turns.length > 0 || pending) && (
            <div ref={log} className="ai-log" role="log" aria-label="Assistant conversation" tabIndex={0}>
              {turns.map((turn, index) => (
                <article key={index} className="ai-turn">
                  <p className="ai-user"><span className="sr-only">You: </span>{turn.question}</p>
                  <div className="ai-reply">
                    <p className="ai-reply-by" title={turn.model}>{providerNames[turn.source]}</p>
                    <p className="ai-text">{turn.answer}</p>
                    {turn.references?.length > 0 && (
                      <ul className="ai-references" aria-label="Referenced tasks">
                        {turn.references.map(task => (
                          <li key={task.id}>
                            <button type="button" onClick={() => onOpenTask(task)}>
                              {task.title} <FaArrowUpRightFromSquare aria-hidden="true" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </article>
              ))}
              {pending && <p className="ai-reply-by">Waiting for the AI provider…</p>}
            </div>
          )}
          {turns.length === 0 && (
            <div className="ai-options">
              {starters.map(starter => (
                <button key={starter} type="button" disabled={Boolean(pending)} onClick={() => {
                  setQuestion(starter);
                  input.current?.focus();
                }}>{starter}</button>
              ))}
            </div>
          )}
          <form className="ai-form" onSubmit={event => { event.preventDefault(); sendQuestion(question); }}>
            <textarea ref={input} rows={2} aria-label="Ask about tasks" aria-describedby="ai-context-note"
              value={question} maxLength={500} readOnly={Boolean(pending)}
              onChange={event => setQuestion(event.target.value)}
              placeholder={turns.length ? 'Ask a follow-up…' : 'Ask about tasks or draft an update…'} />
            <button type="submit" disabled={Boolean(pending) || question.trim().length < 3} className="workspace-action">
              {pending ? 'Thinking…' : 'Ask AI'}
            </button>
          </form>
          <p id="ai-context-note" className="ai-note">AI chat sends your question, recent replies, and visible task details to the configured provider.</p>
        </>
      ) : (
        <>
          <p className="ai-note">Get a count and up to five matching tasks from the workspace.</p>
          <div className="ai-options">
            {summaries.map(option => (
              <button key={option} type="button" disabled={Boolean(pending)}
                onClick={() => { setSummary(null); sendQuestion(option); }}>{option}</button>
            ))}
          </div>
          {pending && <p className="ai-note" role="status">Loading tasks…</p>}
          {summary && (
            <div className="ai-reply" role="status">
              <p className="ai-reply-by">Workspace summary</p>
              <p className="ai-text">{summary.answer}</p>
            </div>
          )}
        </>
      )}
      {error && <p role="alert" className="ai-error">{error}</p>}
    </section>
  );
}

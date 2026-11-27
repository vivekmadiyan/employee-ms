import React, { useContext, useEffect, useRef, useState } from 'react';
import {
  FaArrowRight, FaArrowUp, FaArrowUpRightFromSquare, FaChartSimple, FaCircleCheck, FaClock, FaClockRotateLeft,
  FaCommentDots, FaFileLines, FaListCheck, FaPenToSquare, FaPlus, FaWandMagicSparkles, FaWrench
} from 'react-icons/fa6';
import { askAiApi, createTaskApi, getAiToolsApi, updateTaskStatusApi } from '../../api';
import { AuthContext } from '../../context/AuthProvider';
import { localDateKey } from '../../utils/workFocus';
import AIChatHistory from './AIChatHistory';
import AIReports, { ReportResult } from './AIReports';
import './AIAssistant.css';

const modelSources = new Set(['gemini', 'groq']);
const toolIcons = { set_task_status: FaListCheck, create_task: FaPenToSquare };
const starters = [
  { title: 'Report on last week', text: 'Get verified figures and an AI summary.', question: 'Generate a task report for last week.', icon: FaFileLines },
  { title: 'Find overdue work', text: 'See which deadlines have slipped.', question: 'Which tasks are overdue?', icon: FaClock },
  { title: 'Plan the week', text: 'Pick what deserves attention first.', question: 'Help me prioritize this week.', icon: FaListCheck },
  { title: 'Draft a handoff', text: 'Turn open work into a short update.', question: 'Draft a handoff using the open tasks.', icon: FaPenToSquare }
];
const actionHandlers = {
  set_task_status: action => updateTaskStatusApi(action.taskId, action.status, action.expectedStatus),
  create_task: action => createTaskApi(action)
};

function ActionPreview({ turn, busy, isToolEnabled, confirm, dismiss, onOpenTask }) {
  const { action, actionState, savedTask, actionError } = turn;
  if (!action) return null;
  const successMessage = action.tool === 'create_task' ? 'Task created.' : 'Task status updated.';

  return (
    <section className="ai-action" aria-label="Proposed action">
      <div className="ai-action-heading"><FaWrench aria-hidden="true" /><h3>{action.title}</h3></div>
      <dl className="ai-action-details">
        {action.details.map(({ label, value }, index) => (
          <div key={index}><dt>{label}</dt><dd>{value}</dd></div>
        ))}
      </dl>
      {actionState === 'saved' ? (
        <div className="ai-action-result" role="status">
          <span><FaCircleCheck aria-hidden="true" /> {successMessage}</span>
          {savedTask?.id && <button type="button" onClick={() => onOpenTask(savedTask)}>Open task <FaArrowUpRightFromSquare aria-hidden="true" /></button>}
        </div>
      ) : actionState === 'dismissed' ? (
        <p className="ai-note" role="status">Action dismissed.</p>
      ) : actionState === 'error' ? (
        <p className="ai-error" role="alert">{actionError} Check the task list before requesting another change.</p>
      ) : (
        <>
          {!isToolEnabled && <p className="ai-note">Enable this tool to confirm the action.</p>}
          <div className="ai-action-controls">
            <button type="button" className="workspace-action" onClick={confirm}
              disabled={busy || !isToolEnabled || !Object.hasOwn(actionHandlers, action.tool)}>
              {actionState === 'saving' ? 'Saving…' : 'Confirm action'}
            </button>
            <button type="button" className="ai-quiet" onClick={dismiss} disabled={busy}>Dismiss</button>
          </div>
        </>
      )}
    </section>
  );
}

export default function AIAssistant({ onOpenTask }) {
  const { currentUser, refresh } = useContext(AuthContext);
  const [mode, setMode] = useState('chat');
  const [question, setQuestion] = useState('');
  const [turns, setTurns] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [summary, setSummary] = useState(null);
  const [pending, setPending] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [tools, setTools] = useState([]);
  const [toolState, setToolState] = useState('loading');
  const [toolLoadAttempt, setToolLoadAttempt] = useState(0);
  const [enabledTools, setEnabledTools] = useState([]);
  const [toolsOpen, setToolsOpen] = useState(false);
  const log = useRef(null);
  const input = useRef(null);
  const sequence = useRef(0);
  const initializedTools = useRef(false);
  const requestLock = useRef(false);
  const activeAction = useRef(null);
  const settledActions = useRef(new Set());
  const summaries = [
    'Which tasks are overdue?',
    'What needs attention in the next 7 days?',
    currentUser?.role === 'admin' ? 'Summarize the team’s open work' : 'Summarize my open work'
  ];
  const busy = Boolean(pending) || saving;

  useEffect(() => {
    let cancelled = false;
    getAiToolsApi().then(result => {
      if (cancelled) return;
      const available = Array.isArray(result.tools) ? result.tools : [];
      setTools(available);
      if (!initializedTools.current) {
        initializedTools.current = true;
        if (available.some(tool => tool.id === 'set_task_status')) setEnabledTools(['set_task_status']);
      }
      setToolState('ready');
    }).catch(() => {
      if (!cancelled) setToolState('error');
    });
    return () => { cancelled = true; };
  }, [toolLoadAttempt]);

  useEffect(() => {
    const conversation = log.current;
    if (!conversation) return;
    const latestTurn = conversation.lastElementChild;
    if (latestTurn?.classList.contains('ai-turn--report')) {
      conversation.scrollTop += latestTurn.getBoundingClientRect().top - conversation.getBoundingClientRect().top;
    } else {
      conversation.scrollTop = conversation.scrollHeight;
    }
  }, [conversationId, turns.length, pending, mode]);

  function switchMode(nextMode) {
    setMode(nextMode);
    setError('');
  }

  function setToolEnabled(id, enabled) {
    setEnabledTools(current => enabled
      ? [...new Set([...current, id])]
      : current.filter(item => item !== id));
  }

  function applyExample(tool) {
    setToolEnabled(tool.id, true);
    switchMode('chat');
    setQuestion(tool.example);
    setToolsOpen(false);
    window.requestAnimationFrame(() => input.current?.focus());
  }

  function resetChat() {
    switchMode('chat');
    setConversationId(null);
    setTurns([]);
    setQuestion('');
    settledActions.current.clear();
    window.requestAnimationFrame(() => input.current?.focus());
  }

  function resumeChat(conversation) {
    switchMode('chat');
    setConversationId(conversation.id);
    setTurns(conversation.turns.map(turn => ({ ...turn, id: ++sequence.current, action: undefined })));
    setQuestion('');
    settledActions.current.clear();
    window.requestAnimationFrame(() => input.current?.focus());
  }

  function updateTurn(id, changes) {
    setTurns(current => current.map(turn => turn.id === id ? { ...turn, ...changes } : turn));
  }

  async function confirmAction(turn) {
    const { action } = turn;
    if (requestLock.current || activeAction.current !== null || turn.actionState !== 'ready'
      || settledActions.current.has(turn.id) || !enabledTools.includes(action.tool)
      || !Object.hasOwn(actionHandlers, action.tool)) return;
    activeAction.current = turn.id;
    settledActions.current.add(turn.id);
    setSaving(true);
    updateTurn(turn.id, { actionState: 'saving' });
    try {
      const savedTask = await actionHandlers[action.tool](action.input);
      updateTurn(turn.id, { actionState: 'saved', savedTask });
      refresh().catch(() => {});
    } catch (actionError) {
      updateTurn(turn.id, { actionState: 'error', actionError: actionError.message || 'Could not confirm this change.' });
    } finally {
      activeAction.current = null;
      setSaving(false);
    }
  }

  function dismissAction(turn) {
    if (requestLock.current || activeAction.current !== null || settledActions.current.has(turn.id)) return;
    settledActions.current.add(turn.id);
    updateTurn(turn.id, { actionState: 'dismissed' });
  }

  async function sendQuestion(nextQuestion) {
    const text = nextQuestion.trim();
    if (requestLock.current || activeAction.current !== null || !text) return;
    requestLock.current = true;
    setPending(text);
    setError('');
    const history = mode === 'chat'
      ? turns.slice(-4).map(turn => ({
        question: turn.question,
        answer: (turn.actionState === 'saved' ? `${turn.answer}\nThe user confirmed the action and it was saved.` : turn.answer).slice(0, 2500)
      }))
      : [];
    const latestReport = mode === 'chat' ? turns.findLast(turn => turn.report)?.report : null;
    const reportContext = latestReport?.kind === 'workforce'
      ? { kind: 'workforce' }
      : latestReport?.range && { kind: 'tasks', from: latestReport.range.from, to: latestReport.range.to };

    try {
      const result = await askAiApi({
        question: text, today: localDateKey(new Date()), mode, history,
        ...(mode === 'chat' ? { tools: enabledTools, conversationId } : {}),
        ...(reportContext && { reportContext })
      });
      if (!result.answer) throw new Error('No answer was returned. Try again.');
      if (mode === 'chat') {
        const reportReply = result.source === 'workspace' && (result.report || result.reportIntent === true);
        if (!modelSources.has(result.source) && !reportReply) throw new Error('EmployeeMS AI is unavailable. You can still open Task summaries.');
        const turn = { ...result, question: text, id: ++sequence.current, actionState: 'ready' };
        if (result.conversationId) setConversationId(result.conversationId);
        setTurns(current => [...current, turn].slice(-12));
        setQuestion('');
      } else {
        if (result.source !== 'workspace') throw new Error('Task summaries are temporarily unavailable.');
        setSummary({ question: text, answer: result.answer });
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      requestLock.current = false;
      setPending('');
    }
  }

  return (
    <section className="ai-panel" aria-label="AI workspace assistant">
      <header className="ai-panel-header">
        <span className="ai-symbol"><FaWandMagicSparkles aria-hidden="true" /></span>
        <div className="ai-title">
          <h2>EmployeeMS AI</h2>
          <p>Plan work, prepare task changes, and generate reports.</p>
        </div>
        <div className="ai-header-actions">
          {mode !== 'reports' && (
            <button type="button" className="ai-quiet ai-mobile-tools" aria-expanded={toolsOpen} aria-controls="ai-tools"
              onClick={() => setToolsOpen(open => !open)}><FaWrench aria-hidden="true" /> Tools</button>
          )}
          <button type="button" className="ai-quiet" aria-haspopup="dialog" disabled={busy} onClick={() => setHistoryOpen(true)}>
            <FaClockRotateLeft aria-hidden="true" /> History
          </button>
          <button type="button" className="ai-quiet" disabled={busy} onClick={resetChat}>
            <FaPlus aria-hidden="true" /> New chat
          </button>
        </div>
      </header>
      {historyOpen && (
        <AIChatHistory currentId={conversationId} onOpen={resumeChat}
          onDelete={id => { if (id === conversationId) resetChat(); }} onClose={() => setHistoryOpen(false)} />
      )}
      <div className={mode === 'reports' ? 'ai-layout ai-layout--reports' : 'ai-layout'}>
        <div className={mode === 'reports' ? 'ai-chat ai-chat--reports' : 'ai-chat'}>
          <div className="ai-modes" role="group" aria-label="Assistant mode">
            <button type="button" disabled={busy} aria-pressed={mode === 'chat'} onClick={() => switchMode('chat')}>
              <FaCommentDots aria-hidden="true" /> AI chat
            </button>
            <button type="button" disabled={busy} aria-pressed={mode === 'summary'} onClick={() => switchMode('summary')}>
              <FaChartSimple aria-hidden="true" /> Task summaries
            </button>
            <button type="button" disabled={busy} aria-pressed={mode === 'reports'} aria-controls="ai-reports-panel"
              onClick={() => switchMode('reports')}>
              <FaFileLines aria-hidden="true" /> AI reports
            </button>
          </div>

          {mode === 'chat' ? (
            <>
              <div ref={log} className={`ai-log ${turns.length || pending ? '' : 'ai-log-empty'}`} role="log"
                aria-label="Assistant conversation" tabIndex={0}>
                {!turns.length && !pending && (
                  <div className="ai-welcome">
                    <div className="ai-welcome-hero">
                      <span className="ai-welcome-mark"><FaWandMagicSparkles aria-hidden="true" /></span>
                      <h3>Start with what matters.</h3>
                      <p>Ask a question or pick a starting point.</p>
                    </div>
                    <div className="ai-starters">
                      {starters.map(({ title, text, question: prompt, icon: Icon }) => (
                        <button key={title} type="button" onClick={() => {
                          setQuestion(prompt);
                          sendQuestion(prompt);
                        }}>
                          <span className="ai-starter-icon"><Icon aria-hidden="true" /></span>
                          <span className="ai-starter-copy"><strong>{title}</strong><span>{text}</span></span>
                          <FaArrowRight className="ai-starter-arrow" aria-hidden="true" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {turns.map(turn => (
                  <article key={turn.id} className={turn.report ? 'ai-turn ai-turn--report' : 'ai-turn'}>
                    <p className="ai-user"><span className="sr-only">You: </span>{turn.question}</p>
                    <div className="ai-reply">
                      <p className="ai-reply-by">EmployeeMS AI</p>
                      <p className="ai-text">{turn.answer}</p>
                      {turn.report && <ReportResult report={turn.report} inChat />}
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
                      <ActionPreview turn={turn} busy={busy} isToolEnabled={enabledTools.includes(turn.action?.tool)}
                        confirm={() => confirmAction(turn)} dismiss={() => dismissAction(turn)}
                        onOpenTask={onOpenTask} />
                    </div>
                  </article>
                ))}
                {pending && (
                  <article className="ai-turn">
                    <p className="ai-user"><span className="sr-only">You: </span>{pending}</p>
                    <p className="ai-thinking" role="status"><i /><i /><i /><span>Thinking…</span></p>
                  </article>
                )}
              </div>
              <div className="ai-composer">
                {error && (
                  <div className="ai-error ai-request-error">
                    <p role="alert">{error}</p>
                    {!busy && question.trim() && <button type="button" className="ai-quiet" onClick={() => sendQuestion(question)}>Retry</button>}
                  </div>
                )}
                <form className="ai-form" onSubmit={event => { event.preventDefault(); sendQuestion(question); }}>
                  <textarea ref={input} rows={2} aria-label="Ask about tasks" aria-describedby="ai-context-note"
                    value={question} maxLength={500} readOnly={busy} onChange={event => {
                      setQuestion(event.target.value);
                      setError('');
                    }}
                    onKeyDown={event => {
                      if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                        event.preventDefault();
                        sendQuestion(question);
                      }
                    }}
                    placeholder={turns.length ? 'Ask a follow-up…' : 'Message your workspace assistant…'} />
                  <button type="submit" disabled={busy || !question.trim()} className="workspace-action ai-send">
                    <FaArrowUp aria-hidden="true" /> {pending ? 'Thinking…' : 'Ask AI'}
                  </button>
                </form>
                <div className="ai-composer-meta">
                  <p id="ai-context-note" className="ai-note">
                    Chat and visible task details are sent to the AI service.
                    {enabledTools.includes('create_task') && ' Creating tasks also shares eligible assignee names.'}
                    {' Changes require your approval.'}
                  </p>
                  <span className="ai-keyboard-hint"><kbd>Enter</kbd> to send</span>
                </div>
              </div>
            </>
          ) : mode === 'summary' ? (
            <div className="ai-summary">
              <p className="ai-note">Get a count and up to five matching tasks from the workspace.</p>
              <div className="ai-options">
                {summaries.map(option => (
                  <button key={option} type="button" disabled={busy} onClick={() => { setSummary(null); sendQuestion(option); }}>
                    {option}
                  </button>
                ))}
              </div>
              {pending && <p className="ai-note" role="status">Loading tasks…</p>}
              {summary && (
                <div className="ai-reply" role="status">
                  <p className="ai-reply-by">Workspace summary</p>
                  <p className="ai-text">{summary.answer}</p>
                </div>
              )}
              {error && <p role="alert" className="ai-error">{error}</p>}
            </div>
          ) : null}
          <AIReports isAdmin={currentUser?.role === 'admin'} hidden={mode !== 'reports'} />
        </div>
        <aside className={mode === 'reports' ? 'ai-tools ai-tools--hidden' : 'ai-tools'} data-open={toolsOpen}
          id="ai-tools" aria-labelledby="ai-tools-heading">
          <div className="ai-tools-header">
            <h3 id="ai-tools-heading"><FaWrench aria-hidden="true" /> Tools</h3>
            {toolState === 'ready' && <span className="ai-tool-total">{enabledTools.length} enabled</span>}
          </div>
          <p className="ai-note">Choose what the assistant can prepare.</p>
          {toolState === 'loading' && <p className="ai-note" role="status">Loading tools…</p>}
          {toolState === 'error' && (
            <div>
              <p className="ai-note" role="status">Tools are unavailable. You can still use AI chat.</p>
              <button type="button" className="ai-tool-example" onClick={() => {
                setToolState('loading');
                setToolLoadAttempt(attempt => attempt + 1);
              }}>Retry tools</button>
            </div>
          )}
          {toolState === 'ready' && !tools.length && <p className="ai-note">Your account has no AI tools available.</p>}
          <ul className="ai-tool-list">
            {tools.map(tool => {
              const Icon = toolIcons[tool.id] || FaWrench;
              const enabled = enabledTools.includes(tool.id);
              return (
                <li key={tool.id} data-enabled={enabled}>
                  <label>
                    <span className="ai-tool-icon"><Icon aria-hidden="true" /></span>
                    <span>{tool.label}</span>
                    <span className="ai-toggle">
                      <input type="checkbox" checked={enabled} disabled={busy}
                        onChange={event => setToolEnabled(tool.id, event.target.checked)} />
                      <span aria-hidden="true" />
                    </span>
                  </label>
                  <p className="ai-note">{tool.description}</p>
                  <button type="button" className="ai-tool-example" aria-label={`Try ${tool.label}`}
                    disabled={busy} onClick={() => applyExample(tool)}>Try example <FaArrowRight aria-hidden="true" /></button>
                </li>
              );
            })}
          </ul>
        </aside>
      </div>
    </section>
  );
}

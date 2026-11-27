import React, { useEffect, useId, useRef, useState } from 'react';
import { FaArrowRight, FaClockRotateLeft, FaTrashCan, FaXmark } from 'react-icons/fa6';
import { deleteAiConversationApi, getAiConversationApi, listAiConversationsApi } from '../../api';
import './AIChatHistory.css';

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export default function AIChatHistory({ currentId, onOpen, onDelete, onClose }) {
  const dialog = useRef(null);
  const closeButton = useRef(null);
  const deleteButton = useRef(null);
  const operation = useRef(null);
  const heading = useId();
  const [chats, setChats] = useState(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState(null);
  const [confirmId, setConfirmId] = useState(null);

  useEffect(() => {
    if (!dialog.current.open) dialog.current.showModal();
  }, []);

  useEffect(() => {
    let cancelled = false;
    listAiConversationsApi().then(({ conversations }) => {
      if (!cancelled) setChats(conversations);
    }).catch(() => {
      if (!cancelled) setError('Could not load chat history.');
    });
    return () => { cancelled = true; };
  }, [attempt]);

  async function openChat(id) {
    if (operation.current) return;
    if (id === currentId) {
      dialog.current.close();
      return;
    }
    operation.current = id;
    setPending(id);
    setConfirmId(null);
    setError('');
    try {
      const conversation = await getAiConversationApi(id);
      dialog.current?.close();
      onOpen(conversation);
    } catch {
      setError('Could not open this chat.');
    } finally {
      setPending(null);
      operation.current = null;
    }
  }

  async function deleteChat(id) {
    if (operation.current) return;
    operation.current = id;
    setPending(id);
    setError('');
    try {
      await deleteAiConversationApi(id);
      setChats(current => current.filter(chat => chat.id !== id));
      setConfirmId(null);
      onDelete(id);
      window.requestAnimationFrame(() => closeButton.current?.focus());
    } catch {
      setError('Could not delete this chat.');
    } finally {
      setPending(null);
      operation.current = null;
    }
  }

  return (
    <dialog ref={dialog} className="ai-history" aria-labelledby={heading} onClose={onClose}
      onCancel={event => { if (operation.current) event.preventDefault(); }}>
      <div className="ai-history-header">
        <span className="ai-history-mark"><FaClockRotateLeft aria-hidden="true" /></span>
        <h3 id={heading}>Chat history</h3>
        <button ref={closeButton} type="button" className="ai-quiet ai-history-icon" aria-label="Close chat history"
          disabled={Boolean(pending)} onClick={() => dialog.current.close()}><FaXmark aria-hidden="true" /></button>
      </div>
      <div className="ai-history-content" aria-busy={Boolean(pending)}>
        <p className="ai-history-retention">Private to your account. Up to 20 chats, with the latest 12 exchanges in each.</p>
        {error && <p className="ai-error" role="alert">{error}</p>}
        {chats === null && (error ? (
          <button type="button" className="ai-quiet ai-history-retry" onClick={() => {
            setError('');
            setAttempt(current => current + 1);
          }}>Retry</button>
        ) : <p className="ai-note" role="status">Loading chats…</p>)}
        {chats?.length === 0 && <p className="ai-note">Saved chats appear here after the first reply.</p>}
        {chats?.length > 0 && (
          <ul className="ai-history-list" aria-label="Saved chats">
            {chats.map(chat => (
              <li key={chat.id} data-current={chat.id === currentId}>
                <div className="ai-history-row">
                  <button type="button" className="ai-history-open" aria-label={`Open ${chat.title}`}
                    aria-describedby={`${heading}-${chat.id}`}
                    aria-current={chat.id === currentId ? 'true' : undefined} disabled={Boolean(pending)} onClick={() => openChat(chat.id)}>
                    <span>
                      <strong>{chat.title}</strong>
                      <time id={`${heading}-${chat.id}`} dateTime={chat.updatedAt}>{dateFormat.format(new Date(chat.updatedAt))}</time>
                    </span>
                    <FaArrowRight aria-hidden="true" />
                  </button>
                  <button type="button" className="ai-quiet ai-history-icon" aria-label={`Delete ${chat.title}`}
                    disabled={Boolean(pending)} onClick={event => {
                      deleteButton.current = event.currentTarget;
                      setConfirmId(chat.id);
                      setError('');
                    }}><FaTrashCan aria-hidden="true" /></button>
                </div>
                {confirmId === chat.id && (
                  <div className="ai-history-confirm">
                    <p>Delete this chat and its messages?</p>
                    <div>
                      <button type="button" className="ai-quiet" autoFocus disabled={Boolean(pending)}
                        onClick={() => { setConfirmId(null); deleteButton.current?.focus(); }}>Cancel</button>
                      <button type="button" className="ai-quiet ai-history-delete" disabled={Boolean(pending)} onClick={() => deleteChat(chat.id)}>
                        {pending === chat.id ? 'Deleting…' : 'Delete chat'}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </dialog>
  );
}

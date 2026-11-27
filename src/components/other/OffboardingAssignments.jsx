import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FaCheck, FaClipboardCheck } from 'react-icons/fa6';
import { getAssignedOffboardingItemsApi, updateOffboardingItemApi } from '../../api';

export default function OffboardingAssignments() {
  const request = useRef(null);
  const mutation = useRef(false);
  const [items, setItems] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadItems = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    try {
      const result = await getAssignedOffboardingItemsApi({ signal: controller.signal });
      if (!controller.signal.aborted) {
        setItems(result);
        setError('');
      }
    } catch (requestError) {
      if (!controller.signal.aborted) setError(requestError.message || 'Could not load your offboarding assignments.');
    }
  }, []);

  useEffect(() => {
    loadItems();
    window.addEventListener('ems:workspace-updated', loadItems);
    return () => {
      request.current?.abort();
      window.removeEventListener('ems:workspace-updated', loadItems);
    };
  }, [loadItems]);

  const complete = async item => {
    if (mutation.current) return;
    mutation.current = true;
    setBusyId(item.id);
    setNotice('');
    setError('');
    try {
      await updateOffboardingItemApi(item.offboardingId, item.id, true);
      request.current?.abort();
      setItems(current => current.filter(row => row.id !== item.id));
      setNotice('Handoff marked complete.');
      await loadItems();
    } catch (requestError) {
      setError(requestError.message || 'Could not complete this handoff.');
    } finally {
      mutation.current = false;
      setBusyId(null);
    }
  };

  if (!items.length && !notice && !error) return null;

  return (
    <section className="dashboard-card space-y-3 p-5 sm:p-6" aria-labelledby="offboarding-assignments-heading">
      <h2 id="offboarding-assignments-heading" className="flex items-center gap-2 text-base font-bold text-slate-900">
        <FaClipboardCheck aria-hidden="true" className="text-indigo-600" /> Offboarding assignments
      </h2>
      {notice && <p role="status" className="text-sm text-slate-700">{notice}</p>}
      {error && (
        <div className="flex flex-wrap items-center gap-2">
          <p role="alert" className="text-sm text-rose-700">{error}</p>
          <button type="button" className="workspace-action workspace-action--secondary" onClick={loadItems}>Refresh assignments</button>
        </div>
      )}
      {items.length > 0 && (
        <ul className="divide-y divide-slate-100">
          {items.map(item => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-slate-800">{item.title}</h3>
                <p className="mt-1 text-xs text-slate-600">{item.firstName} · Last working date <time dateTime={item.lastWorkingDate}>{item.lastWorkingDate}</time></p>
              </div>
              <button type="button" className="workspace-action workspace-action--secondary" disabled={busyId !== null} onClick={() => complete(item)}
                aria-label={`Complete ${item.title} for ${item.firstName}`}><FaCheck aria-hidden="true" /> {busyId === item.id ? 'Saving…' : 'Mark complete'}</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

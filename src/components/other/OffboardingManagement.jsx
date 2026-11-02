import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { FaClipboardCheck } from 'react-icons/fa6';
import { AuthContext } from '../../context/AuthProvider';
import {
  createEmployeeOffboardingApi,
  getOffboardingsApi,
  updateOffboardingItemApi
} from '../../api';

export default function OffboardingManagement() {
  const { userData } = useContext(AuthContext);
  const [offboardings, setOffboardings] = useState([]);
  const [lastWorkingDate, setLastWorkingDate] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const availableEmployees = useMemo(() => (userData || []).filter(employee =>
    employee.role === 'employee' &&
    employee.active &&
    !offboardings.some(offboarding => offboarding.employeeId === employee.id)
  ), [offboardings, userData]);

  const loadOffboardings = useCallback(async () => {
    setLoading(true);
    try {
      setOffboardings(await getOffboardingsApi());
      setError('');
    } catch (requestError) {
      setError(requestError.message || 'Could not load offboarding plans.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOffboardings();
  }, [loadOffboardings]);

  const startOffboarding = async event => {
    event.preventDefault();
    if (!employeeId) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await createEmployeeOffboardingApi(employeeId, { lastWorkingDate });
      setEmployeeId('');
      setLastWorkingDate('');
      setNotice('Offboarding checklist created. Complete each item and separately deactivate account access when appropriate.');
      await loadOffboardings();
    } catch (requestError) {
      setError(requestError.message || 'Could not create the offboarding checklist.');
    } finally {
      setBusy(false);
    }
  };

  const updateItem = async (offboarding, item, completed) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await updateOffboardingItemApi(offboarding.id, item.id, completed);
      setOffboardings(current => current.map(record => record.id !== offboarding.id
        ? record
        : {
          ...record,
          status: result.status,
          items: record.items.map(currentItem => currentItem.id === item.id ? result.item : currentItem)
        }));
      if (result.status === 'completed') {
        setNotice('All checklist items are complete. Employee account access remains unchanged until separately deactivated.');
      }
    } catch (requestError) {
      setError(requestError.message || 'Could not update the offboarding checklist.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="dashboard-card overflow-hidden rounded-2xl shadow-sm" aria-labelledby="offboarding-heading">
      <div className="flex items-center gap-3 border-b border-slate-100 p-5 sm:p-6">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
          <FaClipboardCheck aria-hidden="true" />
        </span>
        <div>
          <h2 id="offboarding-heading" className="dashboard-card-heading text-slate-900">Employee offboarding</h2>
          <p className="mt-0.5 text-xs text-slate-600">Track handover, company property, system access, and exit records.</p>
        </div>
      </div>

      {error && <p role="alert" className="mx-5 mt-4 rounded-xl border border-rose-100 bg-rose-50 p-3 text-xs text-rose-700 sm:mx-6">{error}</p>}
      {notice && <p role="status" className="mx-5 mt-4 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-xs text-emerald-800 sm:mx-6">{notice}</p>}

      <form onSubmit={startOffboarding} className="grid gap-3 border-b border-slate-100 bg-slate-50/50 p-5 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end sm:p-6">
        <label className="block text-xs font-semibold text-slate-700">
          Active employee
          <select
            required
            value={employeeId}
            onChange={event => setEmployeeId(event.target.value)}
            className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-900"
          >
            <option value="">Select an employee</option>
            {availableEmployees.map(employee => (
              <option key={employee.id} value={employee.id}>{employee.firstName} · {employee.email}</option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-semibold text-slate-700">
          Last working date
          <input
            required
            type="date"
            value={lastWorkingDate}
            onChange={event => setLastWorkingDate(event.target.value)}
            className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-900"
          />
        </label>
        <button
          type="submit"
          disabled={busy || loading || availableEmployees.length === 0}
          className="rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Start checklist'}
        </button>
        {availableEmployees.length === 0 && (
          <p className="text-[11px] text-slate-500 sm:col-span-3">There are no active employees without an offboarding plan.</p>
        )}
      </form>

      {loading ? (
        <p role="status" className="p-8 text-center text-xs text-slate-500">Loading offboarding plans…</p>
      ) : offboardings.length === 0 ? (
        <p className="p-8 text-center text-xs text-slate-600">No offboarding plans have been created.</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {offboardings.map(offboarding => (
            <article key={offboarding.id} className="p-5 sm:p-6" aria-label={`${offboarding.firstName} offboarding`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{offboarding.firstName}</h3>
                  <p className="mt-0.5 text-xs text-slate-500">{offboarding.email} · Last day {offboarding.lastWorkingDate}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold capitalize ${
                  offboarding.status === 'completed' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'
                }`}>
                  {offboarding.status.replace('_', ' ')}
                </span>
              </div>
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {offboarding.items.map(item => (
                  <li key={item.id}>
                    <label className={`flex items-start gap-2 rounded-lg border border-slate-100 p-3 text-xs ${
                      offboarding.status === 'completed' ? 'text-slate-500' : 'text-slate-700'
                    }`}>
                      <input
                        type="checkbox"
                        checked={item.completed}
                        disabled={busy || offboarding.status === 'completed'}
                        onChange={event => updateItem(offboarding, item, event.target.checked)}
                        className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>{item.title}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

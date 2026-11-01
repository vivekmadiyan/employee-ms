import React, { useContext, useState } from 'react';
import { FaArrowRight, FaFileArrowUp, FaFileCsv } from 'react-icons/fa6';
import { createBulkInvitationsApi } from '../../api';
import { AuthContext } from '../../context/AuthProvider';

const maximumRows = 100;
const parseCsv = text => {
  const rows = [];
  let row = [];
  let value = '';
  let quoted = false;
  let lineNumber = 1;
  let rowStartLine = 1;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else if (character === '\r' || character === '\n') {
        value += character;
        if (character === '\r' && text[index + 1] === '\n') {
          value += '\n';
          index += 1;
        }
        lineNumber += 1;
      } else {
        value += character;
      }
    } else if (character === '"' && !value.length) {
      quoted = true;
    } else if (character === ',') {
      row.push(value);
      value = '';
    } else if (character === '\n' || character === '\r') {
      row.push(value);
      if (row.some(cell => cell.trim())) rows.push({ cells: row, line: rowStartLine });
      row = [];
      value = '';
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      lineNumber += 1;
      rowStartLine = lineNumber;
    } else {
      value += character;
    }
  }
  if (quoted) throw new Error('The CSV file contains an unclosed quoted field.');
  row.push(value);
  if (row.some(cell => cell.trim())) rows.push({ cells: row, line: rowStartLine });
  return rows;
};

const normalizeHeader = value => value.trim().replace(/^\uFEFF/, '').toLowerCase().replace(/[\s_-]/g, '');

const csvTemplate = [
  'firstName,email,department,team,managerEmail,jobTitle,employmentType,hireDate',
  'Alex Morgan,alex@example.com,Operations,Platform,manager@example.com,Analyst,full_time,2026-03-15',
  '"Jordan Lee","jordan@example.com","Engineering","Design","","Product Designer","part_time","2026-04-01"'
].join('\r\n');

export default function BulkInviteEmployees() {
  const { refresh } = useContext(AuthContext);
  const [open, setOpen] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [fileName, setFileName] = useState('');
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([`\uFEFF${csvTemplate}`], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'employeems-invitations-template.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const selectFile = async event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError('');
    setResults(null);
    setEmployees([]);
    setFileName(file.name);
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Choose a .csv file.');
      return;
    }
    if (file.size > 1_000_000) {
      setError('The CSV file must be smaller than 1 MB.');
      return;
    }

    try {
      const rows = parseCsv(await file.text());
      if (rows.length < 2) throw new Error('Add a header row and at least one employee row.');
      const headers = rows[0].cells.map(normalizeHeader);
      const firstNameIndex = headers.findIndex(header => ['firstname', 'name'].includes(header));
      const emailIndex = headers.indexOf('email');
      const departmentIndex = headers.indexOf('department');
      const teamIndex = headers.indexOf('team');
      const managerEmailIndex = headers.indexOf('manageremail');
      const jobTitleIndex = headers.indexOf('jobtitle');
      const employmentTypeIndex = headers.indexOf('employmenttype');
      const hireDateIndex = headers.indexOf('hiredate');
      if (firstNameIndex < 0 || emailIndex < 0) {
        throw new Error('CSV headers must include firstName (or name) and email. Department is optional.');
      }
      const parsed = rows.slice(1).map(({ cells, line }) => ({
        row: line,
        firstName: cells[firstNameIndex]?.trim() || '',
        email: cells[emailIndex]?.trim() || '',
        department: departmentIndex < 0 ? 'General' : cells[departmentIndex]?.trim() || 'General',
        team: teamIndex < 0 ? 'General' : cells[teamIndex]?.trim() || 'General',
        managerEmail: managerEmailIndex < 0 ? null : cells[managerEmailIndex]?.trim() || null,
        jobTitle: jobTitleIndex < 0 ? '' : cells[jobTitleIndex]?.trim() || '',
        employmentType: employmentTypeIndex < 0 ? 'unspecified' : cells[employmentTypeIndex]?.trim() || 'unspecified',
        hireDate: hireDateIndex < 0 ? null : cells[hireDateIndex]?.trim() || null
      }));
      if (parsed.length > maximumRows) {
        throw new Error(`Import up to ${maximumRows} employees at a time; this file has ${parsed.length}.`);
      }
      if (!parsed.length) throw new Error('No employee rows were found in this file.');
      setEmployees(parsed);
    } catch (parseError) {
      setError(parseError.message || 'Could not read this CSV file.');
    }
  };

  const importEmployees = async () => {
    if (!employees.length) return;
    setBusy(true);
    setError('');
    setResults(null);
    try {
      const response = await createBulkInvitationsApi(employees);
      setResults(response);
      window.dispatchEvent(new Event('ems:invitations-updated'));
      window.dispatchEvent(new Event('ems:workspace-updated'));
      try {
        await refresh();
      } catch (refreshError) {
        setError(`Import finished, but workspace data could not refresh: ${refreshError.message}`);
      }
    } catch (requestError) {
      setError(requestError.message || 'Could not import employee invitations.');
    } finally {
      setBusy(false);
    }
  };

  const clearImport = () => {
    setEmployees([]);
    setFileName('');
    setResults(null);
    setError('');
  };

  return (
    <section className="dashboard-card rounded-2xl p-5 sm:p-6 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-700">
            <FaFileCsv className="text-base" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-base sm:text-lg font-bold tracking-tight text-slate-900">Bulk Invite by CSV</h2>
            <p className="mt-0.5 text-xs text-slate-500">Import up to {maximumRows} teammates in seconds with automated 7-day invitations.</p>
          </div>
        </div>
        <button 
          type="button" 
          onClick={() => { setOpen(value => !value); setError(''); }} 
          aria-expanded={open} 
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition-colors"
        >
          <FaFileArrowUp aria-hidden="true" className="text-xs" />
          <span>{open ? 'Hide CSV Uploader' : 'Open CSV Uploader'}</span>
        </button>
      </div>

      {open && (
        <div className="mt-5 space-y-4 border-t border-slate-100 pt-4 animate-fade-in">
          <div className="flex flex-col gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-relaxed text-slate-600">
              Columns: <code className="font-bold text-slate-800">firstName</code>, <code className="font-bold text-slate-800">email</code>, and optional <code className="font-bold text-slate-800">department</code>. Duplicate rows or existing emails are automatically skipped.
            </p>
            <button 
              type="button" 
              onClick={downloadTemplate} 
              className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-indigo-700 shadow-xs hover:bg-indigo-50 transition-colors"
            >
              Download Template
            </button>
          </div>

          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 bg-white px-4 py-8 text-center transition-all hover:border-indigo-400 hover:bg-indigo-50/20">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
              <FaFileArrowUp aria-hidden="true" className="text-base" />
            </div>
            <span className="text-xs font-bold text-slate-800">{fileName || 'Click to select CSV file'}</span>
            <span className="text-[11px] text-slate-400">CSV format only · up to 1 MB · maximum {maximumRows} rows</span>
            <input type="file" accept=".csv,text/csv" onChange={selectFile} className="sr-only" aria-label="Choose employee invitation CSV" />
          </label>

          {error && <p role="alert" className="rounded-xl border border-rose-100 bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}

          {employees.length > 0 && !results && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-700" role="status">
                Previewing {employees.length} employee row{employees.length === 1 ? '' : 's'} from <span className="font-bold text-slate-900">{fileName}</span>
              </p>
              <div className="max-h-60 overflow-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-[480px] text-left text-xs">
                  <thead className="sticky top-0 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th scope="col" className="px-3.5 py-2">Row</th>
                      <th scope="col" className="px-3.5 py-2">Name</th>
                      <th scope="col" className="px-3.5 py-2">Email</th>
                      <th scope="col" className="px-3.5 py-2">Department</th>
                      <th scope="col" className="px-3.5 py-2">Team</th>
                      <th scope="col" className="px-3.5 py-2">Manager</th>
                      <th scope="col" className="px-3.5 py-2">Job Title</th>
                      <th scope="col" className="px-3.5 py-2">Employment Type</th>
                      <th scope="col" className="px-3.5 py-2">Hire Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {employees.map(employee => (
                      <tr key={employee.row}>
                        <td className="px-3.5 py-2 text-slate-400">{employee.row}</td>
                        <td className="px-3.5 py-2 font-medium text-slate-800">{employee.firstName || <span className="text-rose-600">Missing</span>}</td>
                        <td className="px-3.5 py-2 text-slate-600">{employee.email || <span className="text-rose-600">Missing</span>}</td>
                        <td className="px-3.5 py-2 text-slate-500">{employee.department}</td>
                        <td className="px-3.5 py-2 text-slate-500">{employee.team}</td>
                        <td className="px-3.5 py-2 text-slate-500">{employee.managerEmail || '—'}</td>
                        <td className="px-3.5 py-2 text-slate-500">{employee.jobTitle || '—'}</td>
                        <td className="px-3.5 py-2 text-slate-500">{employee.employmentType.replace('_', ' ')}</td>
                        <td className="px-3.5 py-2 text-slate-500">{employee.hireDate || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button 
                type="button" 
                onClick={importEmployees} 
                disabled={busy} 
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm shadow-indigo-600/20 hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 transition-all"
              >
                {busy ? 'Processing invitations…' : <>Import {employees.length} Row{employees.length === 1 ? '' : 's'} <FaArrowRight aria-hidden="true" className="text-xs" /></>}
              </button>
            </div>
          )}

          {results && (
            <div className="space-y-3">
              <div role="status" className={`rounded-xl border p-3.5 text-xs ${
                results.failedCount ? 'border-amber-200 bg-amber-50/80 text-amber-950' : 'border-emerald-200 bg-emerald-50/80 text-emerald-950'
              }`}>
                Imported {results.invitedCount} of {results.totalCount} rows. {results.failedCount} failed; email sent for {results.emailSentCount} invitation{results.emailSentCount === 1 ? '' : 's'}.
              </div>
              <div className="max-h-72 overflow-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-[500px] text-left text-xs">
                  <thead className="sticky top-0 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th scope="col" className="px-3.5 py-2">Row</th>
                      <th scope="col" className="px-3.5 py-2">Email</th>
                      <th scope="col" className="px-3.5 py-2">Result</th>
                      <th scope="col" className="px-3.5 py-2">Link</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {results.results.map(result => (
                      <tr key={`${result.row}-${result.email}`}>
                        <td className="px-3.5 py-2 text-slate-400">{result.row}</td>
                        <td className="px-3.5 py-2 text-slate-800">{result.email || '—'}</td>
                        <td className={`px-3.5 py-2 ${result.status === 'invited' ? 'text-emerald-700 font-semibold' : 'text-rose-700 font-medium'}`}>
                          {result.status === 'invited' ? `Invited · email ${result.emailStatus}` : result.error}
                        </td>
                        <td className="px-3.5 py-2">
                          {result.inviteUrl ? (
                            <a href={result.inviteUrl} target="_blank" rel="noreferrer" className="font-semibold text-indigo-600 hover:text-indigo-800 underline">
                              Open link
                            </a>
                          ) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button 
                type="button" 
                onClick={clearImport} 
                className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50"
              >
                Import another CSV
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

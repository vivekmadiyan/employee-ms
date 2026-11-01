const fs = require('fs');
const path = 'src/components/other/TeamManagement.jsx';
let src = fs.readFileSync(path, 'utf8');

// 1. Add FaFileArrowDown to imports
src = src.replace(
  "import { FaArrowsRotate, FaCopy, FaUserGroup, FaPenToSquare } from 'react-icons/fa6';",
  "import { FaArrowsRotate, FaCopy, FaFileArrowDown, FaUserGroup, FaPenToSquare } from 'react-icons/fa6';"
);

// 2. Add HelpIcon import
src = src.replace(
  "import { AuthContext } from '../../context/AuthProvider';",
  "import { AuthContext } from '../../context/AuthProvider';\nimport { HelpIcon } from './Tooltip';"
);

// 3. Insert exportCsv function just before `return (`
const RETURN_MARKER = '\n  return (\n    <section';
const exportFn = `
  const exportCsv = () => {
    if (!userData?.length) return;
    const headers = ['ID', 'Name', 'Email', 'Department', 'Role', 'Status', 'Open Tasks', 'Completed Tasks'];
    const rows = userData.map(e => [
      e.id,
      e.firstName,
      e.email,
      e.department || 'General',
      e.role || 'employee',
      e.active ? 'Active' : 'Inactive',
      (e.taskCounts?.newTask || 0) + (e.taskCounts?.active || 0),
      e.taskCounts?.completed || 0,
    ]);
    const csv = [headers, ...rows]
      .map(row => row.map(cell => '"' + String(cell).replace(/"/g, '""') + '"').join(','))
      .join('\\r\\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'employees-' + new Date().toISOString().slice(0, 10) + '.csv';
    link.click();
    URL.revokeObjectURL(url);
  };
`;
src = src.replace(RETURN_MARKER, exportFn + RETURN_MARKER);

// 4. Swap old header buttons with new ones including CSV export
const OLD_HEADER = `        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
            <FaUserGroup aria-hidden="true" className="text-base" />
          </span>
          <div>
            <h2 className="dashboard-card-heading text-slate-900">People & Workspace Access</h2>
            <p className="mt-0.5 text-xs text-slate-500">Manage teammate profiles, roles, and pending invitations.</p>
          </div>
        </div>
        <button 
          type="button" 
          onClick={() => { setEmployeeError(''); refresh().catch(error => setEmployeeError(error.message)); loadInvitations(); }} 
          className="inline-flex items-center justify-center gap-1.5 self-start rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition-colors sm:self-auto"
        >
          <FaArrowsRotate aria-hidden="true" className="text-xs text-slate-400" />
          <span>Refresh</span>
        </button>`;

const NEW_HEADER = `        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
            <FaUserGroup aria-hidden="true" className="text-base" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="dashboard-card-heading text-slate-900">People & Workspace Access</h2>
              <HelpIcon text="Manage employee profiles, deactivate access, and track pending invitations." />
            </div>
            <p className="mt-0.5 text-xs text-slate-500">Manage teammate profiles, roles, and pending invitations.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {userData?.length > 0 && (
            <button
              type="button"
              onClick={exportCsv}
              aria-label="Export employees as CSV"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition-colors"
            >
              <FaFileArrowDown aria-hidden="true" className="text-xs text-slate-400" />
              <span>Export CSV</span>
            </button>
          )}
          <button 
            type="button" 
            onClick={() => { setEmployeeError(''); refresh().catch(error => setEmployeeError(error.message)); loadInvitations(); }} 
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition-colors"
          >
            <FaArrowsRotate aria-hidden="true" className="text-xs text-slate-400" />
            <span>Refresh</span>
          </button>
        </div>`;

if (!src.includes(OLD_HEADER)) {
  console.error('OLD_HEADER not found');
  process.exit(1);
}
src = src.replace(OLD_HEADER, NEW_HEADER);

fs.writeFileSync(path, src, 'utf8');
console.log('patch_team.js: Done');

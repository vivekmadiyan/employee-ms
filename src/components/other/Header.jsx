import React from 'react';
import { FaArrowRightFromBracket, FaBuilding } from 'react-icons/fa6';

const Header = ({ changeUser, data }) => {
  const logOutUser = () => {
    localStorage.removeItem('ems_token');
    localStorage.removeItem('ems_user');
    changeUser();
  };

  return (
    <div className="flex min-h-16 items-center justify-between gap-4 py-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
          <FaBuilding style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
          {data?.companyName || 'Company Workspace'}
        </p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-700">
          Hello, <span className="font-bold text-slate-900">{data?.firstName || 'User'} 👋</span>
        </h1>
      </div>

      <button
        type="button"
        onClick={logOutUser}
        className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-200"
      >
        <FaArrowRightFromBracket />
        Log Out
      </button>
    </div>
  );
};

export default Header;

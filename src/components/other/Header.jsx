import React from 'react';
import { FaArrowRightFromBracket, FaBuilding, FaLayerGroup } from 'react-icons/fa6';

const Header = ({ changeUser, data }) => {
  const logOutUser = () => {
    localStorage.removeItem('ems_token');
    localStorage.removeItem('ems_user');
    changeUser();
  };

  return (
    <header className="flex min-h-[76px] items-center justify-between gap-4 py-3">
      <div className="flex min-w-0 items-center gap-3 sm:gap-4">
        <div className="header-brand-mark" aria-hidden="true">
          <FaLayerGroup />
        </div>
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
            <FaBuilding className="shrink-0 text-[10px]" />
            {data?.companyName || 'Company Workspace'}
          </p>
          <h1 className="mt-1 truncate text-base font-semibold tracking-tight text-slate-700 sm:text-lg">
            Welcome back, <span className="font-extrabold text-slate-950">{data?.firstName || 'User'}</span>
          </h1>
        </div>
      </div>

      <button
        type="button"
        onClick={logOutUser}
        className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-200 sm:px-4 sm:text-sm"
      >
        <FaArrowRightFromBracket aria-hidden="true" />
        <span className="hidden sm:inline">Log out</span>
      </button>
    </header>
  );
};

export default Header;

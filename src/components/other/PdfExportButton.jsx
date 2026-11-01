import React from 'react';
import { FaFilePdf } from 'react-icons/fa6';

export default function PdfExportButton({ targetRef, title = 'Export PDF' }) {
  const printTarget = () => {
    const target = targetRef.current;
    if (!target) return;

    const cleanup = () => {
      document.body.classList.remove('pdf-exporting');
      target.classList.remove('pdf-export-target');
      window.removeEventListener('afterprint', cleanup);
    };
    document.body.classList.add('pdf-exporting');
    target.classList.add('pdf-export-target');
    window.addEventListener('afterprint', cleanup, { once: true });
    window.print();
  };

  return (
    <button
      type="button"
      onClick={printTarget}
      className="print-export-control inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-xs transition hover:bg-slate-50"
    >
      <FaFilePdf aria-hidden="true" className="text-xs text-rose-500" />
      <span>{title}</span>
    </button>
  );
}

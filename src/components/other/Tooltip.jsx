import React from 'react';
import { useState, useRef, useEffect } from 'react';
import { FaCircleQuestion } from 'react-icons/fa6';

/**
 * Tooltip — wraps any element with a hover/focus tooltip.
 * Usage:
 *   <Tooltip text="Explain what this button does">
 *     <button>?</button>
 *   </Tooltip>
 *
 * Or use the standalone help icon:
 *   <HelpIcon text="Explain this field" />
 */
export default function Tooltip({ text, children, position = 'top' }) {
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);

  // Dismiss on Escape
  useEffect(() => {
    if (!visible) return;
    const handler = e => { if (e.key === 'Escape') setVisible(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [visible]);

  const posClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  }[position] || 'bottom-full left-1/2 -translate-x-1/2 mb-2';

  return (
    <span
      ref={ref}
      className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      {visible && (
        <span
          role="tooltip"
          className={`pointer-events-none absolute z-50 w-max max-w-[220px] rounded-xl bg-slate-900 px-3 py-1.5 text-[11px] font-medium leading-snug text-white shadow-xl animate-fade-in ${posClasses}`}
        >
          {text}
          <span className={`absolute block h-2 w-2 rotate-45 bg-slate-900 ${
            position === 'top' ? 'top-full left-1/2 -translate-x-1/2 -translate-y-1/2' :
            position === 'bottom' ? 'bottom-full left-1/2 -translate-x-1/2 translate-y-1/2' :
            position === 'left' ? 'left-full top-1/2 -translate-y-1/2 -translate-x-1/2' :
            'right-full top-1/2 -translate-y-1/2 translate-x-1/2'
          }`} />
        </span>
      )}
    </span>
  );
}

/** Standalone help icon with a tooltip */
export function HelpIcon({ text, position = 'top', className = '' }) {
  return (
    <Tooltip text={text} position={position}>
      <button
        type="button"
        aria-label={`Help: ${text}`}
        className={`inline-flex items-center text-slate-400 hover:text-indigo-500 focus:outline-none transition-colors ${className}`}
        tabIndex={0}
      >
        <FaCircleQuestion className="text-xs" aria-hidden="true" />
      </button>
    </Tooltip>
  );
}


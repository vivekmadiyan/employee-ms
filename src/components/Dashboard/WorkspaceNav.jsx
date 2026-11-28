import { useRef } from 'react';
import { FaEllipsis } from 'react-icons/fa6';

export default function WorkspaceNav({ label, active, primary, secondary = [], onOpen, aiView }) {
  const more = useRef(null);
  const choose = id => {
    if (more.current?.open) {
      more.current.open = false;
      more.current.querySelector('summary')?.focus();
    }
    onOpen(id);
  };
  const renderPage = ({ id, label: name, shortLabel, icon: Icon }) => (
    <button key={id} type="button" aria-current={active === id ? 'page' : undefined}
      aria-controls={id === 'ai' ? aiView : undefined} onClick={() => choose(id)}>
      <Icon aria-hidden="true" />
      <span className={shortLabel ? 'workspace-full-label' : undefined}>{name}</span>
      {shortLabel && <span className="workspace-short-label">{shortLabel}</span>}
    </button>
  );
  return (
    <nav className="workspace-rail" aria-label={label}>
      <div className="workspace-navgroup">{primary.map(renderPage)}</div>
      {secondary.length > 0 && <>
        <div className="workspace-navgroup workspace-nav-extras">
          <p>Manage</p>
          {secondary.map(renderPage)}
        </div>
        <details className="workspace-nav-more" ref={more}
          onKeyDown={event => {
            if (event.key !== 'Escape' || !event.currentTarget.open) return;
            event.currentTarget.open = false;
            event.currentTarget.querySelector('summary')?.focus();
          }}>
          <summary data-current={secondary.some(item => item.id === active)}>
            <FaEllipsis aria-hidden="true" /><span>More</span>
          </summary>
          <div className="workspace-navgroup">{secondary.map(renderPage)}</div>
        </details>
      </>}
    </nav>
  );
}

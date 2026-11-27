import React from 'react';
import {
  FaArrowRight,
  FaCalendarDay,
  FaCheck,
  FaCircleExclamation,
  FaLayerGroup,
  FaListCheck,
  FaMoon,
  FaSun,
  FaUsers
} from 'react-icons/fa6';
import { useTheme } from '../../context/ThemeContext';
import './entry.css';

const capabilities = [
  {
    title: 'Keep work moving',
    text: 'Assign work with a clear owner and due date. Watch progress, discuss changes, and see what needs attention.',
    icon: FaListCheck
  },
  {
    title: 'Bring people on board',
    text: 'Invite teammates, keep reporting lines up to date, and give each new hire a checklist they can actually use.',
    icon: FaUsers
  },
  {
    title: 'Plan around time off',
    text: 'Request and approve leave, check balances, and see who is away before you commit to a deadline.',
    icon: FaCalendarDay
  }
];

const exampleTasks = [
  { name: 'Send Friday handoff', owner: 'PM', status: 'Overdue', tone: 'urgent' },
  { name: 'Review onboarding checklist', owner: 'AL', status: 'Due today', tone: 'today' },
  { name: 'Prepare next week’s rota', owner: 'SB', status: 'Due soon', tone: 'soon' }
];

const WorkspacePreview = () => (
  <figure className="entry-preview" aria-label="Example workspace showing upcoming tasks">
    <div className="entry-preview-top">
      <span className="entry-preview-workspace"><FaLayerGroup aria-hidden="true" /> Studio North</span>
      <span>Example workspace</span>
    </div>
    <div className="entry-preview-body">
      <div className="entry-preview-title">
        <span className="entry-preview-emblem"><FaListCheck aria-hidden="true" /></span>
        <div>
          <p>Workspace overview</p>
          <strong>Work Focus</strong>
        </div>
      </div>
      <ul className="entry-preview-tasks">
        {exampleTasks.map(task => (
          <li key={task.name}>
            <span className={`entry-preview-owner entry-preview-owner--${task.tone}`} aria-hidden="true">{task.owner}</span>
            <span className="entry-preview-task">{task.name}</span>
            <span className={`entry-preview-status entry-preview-status--${task.tone}`}>{task.status}</span>
          </li>
        ))}
      </ul>
      <div className="entry-preview-footer">
        <FaCircleExclamation aria-hidden="true" />
        <span>Start with the work that needs you today.</span>
      </div>
    </div>
  </figure>
);

const LandingPage = ({ onLogin, onRegister }) => {
  const { darkMode, toggleDark } = useTheme();

  return (
    <div className="entry-surface entry-landing">
      <header className="entry-header">
        <div className="entry-container entry-header-content">
          <div className="entry-brand">
            <span className="entry-brand-mark"><FaLayerGroup aria-hidden="true" /></span>
            <span>EmployeeMS</span>
          </div>
          <nav className="entry-header-actions" aria-label="Account">
            <button
              type="button"
              className="entry-theme"
              aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              onClick={toggleDark}
            >
              {darkMode ? <FaSun aria-hidden="true" /> : <FaMoon aria-hidden="true" />}
            </button>
            <button type="button" className="entry-button entry-button--quiet" onClick={onLogin}>Sign in</button>
          </nav>
        </div>
      </header>

      <main className="entry-container">
        <section className="entry-hero" aria-labelledby="entry-title">
          <div className="entry-hero-copy">
            <h1 id="entry-title">Make the workday <em>clearer.</em></h1>
            <p className="entry-hero-description">
              See what’s due, who owns it, and who’s away. Give your team one place to run the workday.
            </p>
            <div className="entry-hero-actions">
              <button type="button" className="entry-button entry-button--primary" onClick={onRegister}>
                Create workspace free <FaArrowRight aria-hidden="true" />
              </button>
              <button type="button" className="entry-button entry-button--outline" onClick={onLogin}>Sign in to workspace</button>
            </div>
            <p className="entry-note"><FaCheck aria-hidden="true" /> Invite teammates when you’re ready.</p>
          </div>
          <div className="entry-hero-art">
            <WorkspacePreview />
          </div>
        </section>

        <section className="entry-capabilities" aria-labelledby="entry-capabilities-title">
          <h2 id="entry-capabilities-title">From the first day to the next deadline</h2>
          <div className="entry-capability-grid">
            {capabilities.map(({ title, text, icon: Icon }) => (
              <article key={title} className="entry-capability">
                <span><Icon aria-hidden="true" /></span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="entry-container entry-footer">
        <span>EmployeeMS</span>
        <a href="#entry-title">Back to top <span aria-hidden="true">↑</span></a>
      </footer>
    </div>
  );
};

export default LandingPage;

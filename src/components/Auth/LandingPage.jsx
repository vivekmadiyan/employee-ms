import React from 'react';
import {
  FaArrowRight,
  FaBolt,
  FaCheck,
  FaShieldHeart,
  FaUsers,
} from 'react-icons/fa6';

const features = [
  { icon: <FaBolt />, title: 'Task orchestration', text: 'Create, assign, and move work through the pipeline with clear ownership and due dates.' },
  { icon: <FaUsers />, title: 'Team visibility', text: 'Keep every employee workload visible with shared status, assignments, and simple accountability.' },
  { icon: <FaShieldHeart />, title: 'Secure by default', text: 'Role-based access, protected routes, and tenant-scoped data keep company work isolated and trusted.' },
];

const workflow = ['Create', 'Assign', 'Accept', 'Complete'];

const LandingPage = ({ onLogin, onRegister }) => {
  return (
    <main className="landing-page">
      <nav className="landing-nav">
        <div className="brand" aria-label="EmployeeMS home">
          <span className="brand-mark">E</span>
          <span>Employee<span className="brand-accent">MS</span></span>
        </div>

        <div className="nav-actions">
          <button className="nav-login" onClick={onLogin}>
            Sign in <FaArrowRight />
          </button>
          <button className="primary-btn" onClick={onRegister}>
            Create company
          </button>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="pulse-dot" /> Built for real operations
          </div>

          <h1>
            Run your team with <span>clarity</span> and momentum.
          </h1>

          <p>
            EmployeeMS helps modern teams create work, assign ownership, and track task progress in one dependable workspace.
          </p>

          <div className="hero-actions">
            <button className="primary-btn" onClick={onRegister}>
              Create your workspace <FaArrowRight />
            </button>
            <button className="secondary-btn" onClick={onLogin}>
              Sign in
            </button>
          </div>

          <div className="trust-row">
            <span><FaCheck /> Role-based access</span>
            <span><FaCheck /> Real-time status updates</span>
            <span><FaCheck /> Built for trustworthy operations</span>
          </div>
        </div>

        <div className="dashboard-preview" aria-label="Dashboard preview">
          <div className="preview-window">
            <div className="preview-top">
              <div className="window-dots"><i /><i /><i /></div>
              <span>EmployeeMS</span>
              <span className="preview-avatar">A</span>
            </div>

            <div className="preview-body">
              <aside>
                <div className="mini-logo">E</div>
                <div className="side-active">Dashboard</div>
                <div>Tasks</div>
                <div>Employees</div>
                <div>Reports</div>
              </aside>

              <div className="mini-content">
                <div className="mini-heading">
                  <div>
                    <small>Overview</small>
                    <h3>Operations snapshot</h3>
                  </div>
                  <button>+ New task</button>
                </div>

                <div className="stats">
                  <div>
                    <small>New</small>
                    <strong>12</strong>
                    <em>+8.2%</em>
                  </div>
                  <div>
                    <small>Active</small>
                    <strong>8</strong>
                    <em>+4.6%</em>
                  </div>
                  <div>
                    <small>Completed</small>
                    <strong>34</strong>
                    <em>+12.4%</em>
                  </div>
                </div>

                <div className="task-card">
                  <div className="card-title">
                    <span>Recent work</span>
                    <small>View all</small>
                  </div>
                  <div className="task-row">
                    <b>Website redesign</b>
                    <span className="status active">Active</span>
                  </div>
                  <div className="task-row">
                    <b>Quarterly planning</b>
                    <span className="status done">Completed</span>
                  </div>
                  <div className="task-row">
                    <b>Team onboarding</b>
                    <span className="status new">New</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="features-section">
        <div className="section-heading">
          <span className="eyebrow">Built for everyday work</span>
          <h2>Everything your team needs to stay aligned.</h2>
          <p>Clear ownership, clean workflows, and operational visibility without the chaos of spreadsheets.</p>
        </div>

        <div className="feature-grid">
          {features.map((feature) => (
            <article className="feature-card" key={feature.title}>
              <div className="feature-icon">{feature.icon}</div>
              <h3>{feature.title}</h3>
              <p>{feature.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="workflow-section">
        <div>
          <span className="eyebrow">A dependable workflow</span>
          <h2>From assignment to completion.</h2>
          <p>Admins create work, employees own execution, and every status update stays visible across the organization.</p>
        </div>

        <div className="workflow">
          {workflow.map((step, index) => (
            <React.Fragment key={step}>
              <div className="workflow-step">
                <b>0{index + 1}</b>
                <span>{step}</span>
              </div>
              {index < workflow.length - 1 && <i>→</i>}
            </React.Fragment>
          ))}
        </div>
      </section>

      <section className="cta">
        <div>
          <span className="eyebrow">Ready to launch?</span>
          <h2>Bring your operations into focus.</h2>
          <p>Create a company workspace, add employees, assign work, and keep progress moving without friction.</p>
        </div>
        <button className="primary-btn light" onClick={onRegister}>
          Create company workspace <FaArrowRight />
        </button>
      </section>

      <footer>
        <div className="brand">
          <span className="brand-mark">E</span>
          <span>Employee<span className="brand-accent">MS</span></span>
        </div>
        <span>Designed for modern teams</span>
      </footer>
    </main>
  );
};

export default LandingPage;

import React from 'react';
import {
  FaArrowRight,
  FaBolt,
  FaCheck,
  FaClockRotateLeft,
  FaEnvelopeOpenText,
  FaLayerGroup,
  FaShieldHeart,
  FaUmbrellaBeach,
  FaUsers,
} from 'react-icons/fa6';

const features = [
  { 
    icon: <FaBolt />, 
    title: 'Task Orchestration', 
    text: 'Create, prioritize, assign, and advance deliverables through real-time operational pipelines.' 
  },
  { 
    icon: <FaUsers />, 
    title: 'Workforce Visibility', 
    text: 'Eliminate blind spots with team workload balance, deliverable counts, and individual health metrics.' 
  },
  { 
    icon: <FaShieldHeart />, 
    title: 'Enterprise Multi-Tenancy', 
    text: 'Isolated company workspaces, encrypted JWT authentication, and role-based permissions by default.' 
  },
  { 
    icon: <FaUmbrellaBeach />, 
    title: 'Integrated Time-Off', 
    text: 'Employees request leave with automatic date collision checks while managers review with 1-click approvals.' 
  },
  { 
    icon: <FaClockRotateLeft />, 
    title: 'Immutable Audit Trail', 
    text: 'Track credential changes, task reassignments, bulk imports, and security events in a live activity ledger.' 
  },
  { 
    icon: <FaEnvelopeOpenText />, 
    title: 'Automated Notifications', 
    text: 'Keep teammates informed on assignment changes, due-date reminders, and discussions.' 
  },
];

const workflow = [
  { step: '01', title: 'Set Up', desc: 'Register company workspace in 30 seconds' },
  { step: '02', title: 'Invite', desc: 'Direct invite or bulk CSV import with 7-day links' },
  { step: '03', title: 'Assign', desc: 'Delegate tasks with due dates and priorities' },
  { step: '04', title: 'Track', desc: 'Real-time updates, discussion threads & reporting' }
];

const LandingPage = ({ onLogin, onRegister }) => {
  return (
    <main className="landing-page selection:bg-indigo-500 selection:text-white">
      {/* Sticky Navigation */}
      <nav className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/80 backdrop-blur-md">
        <div className="landing-nav">
          <div className="brand" aria-label="EmployeeMS home">
            <span className="brand-mark"><FaLayerGroup /></span>
            <span>Employee<span className="brand-accent">MS</span></span>
          </div>

          <div className="nav-actions">
            <button className="nav-login" onClick={onLogin}>
              <span>Sign in</span>
              <FaArrowRight className="text-xs" />
            </button>
            <button className="primary-btn" onClick={onRegister}>
              Create company
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero">
        <div className="hero-copy animate-fade-in">
          <div className="eyebrow">
            <span className="pulse-dot" /> Built for high-velocity teams
          </div>

          <h1>
            Run your team with <span>uncompromising clarity</span> and momentum.
          </h1>

          <p>
            EmployeeMS is the modern workspace designed to assign deliverables, coordinate workloads, and track task progress with dependable accountability.
          </p>

          <div className="hero-actions">
            <button className="primary-btn" onClick={onRegister}>
              <span>Create workspace free</span>
              <FaArrowRight className="text-xs" />
            </button>
            <button className="secondary-btn" onClick={onLogin}>
              Sign in to workspace
            </button>
          </div>

          <div className="trust-row">
            <span><FaCheck /> Multi-tenant isolation</span>
            <span><FaCheck /> Zero setup complexity</span>
            <span><FaCheck /> Real-time status sync</span>
          </div>
        </div>

        {/* Dashboard Preview Window Mockup */}
        <div className="dashboard-preview animate-fade-in" aria-label="Dashboard preview">
          <div className="preview-window">
            <div className="preview-top">
              <div className="window-dots"><i /><i /><i /></div>
              <span className="text-[11px] font-bold text-slate-500">EmployeeMS · Acme Workspace</span>
              <span className="grid h-6 w-6 place-items-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">A</span>
            </div>

            <div className="preview-body">
              <aside>
                <div className="font-extrabold text-indigo-600 text-sm mb-2 flex items-center gap-1.5">
                  <FaLayerGroup className="text-xs" />
                  <span>EMS</span>
                </div>
                <div className="side-active">Dashboard</div>
                <div>Task Pipeline</div>
                <div>Team Roster</div>
                <div>Leave Requests</div>
                <div>Audit Logs</div>
              </aside>

              <div className="mini-content">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Team Health</span>
                    <h3 className="text-sm font-bold text-slate-900">Operations Snapshot</h3>
                  </div>
                  <span className="rounded-lg bg-indigo-600 px-2 py-1 text-[10px] font-bold text-white shadow-xs">+ Task</span>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2 text-left">
                    <span className="text-[9px] font-semibold text-slate-500 uppercase">New</span>
                    <p className="text-base font-extrabold text-blue-600">14</p>
                    <span className="text-[8px] font-bold text-emerald-600">+8% wk</span>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2 text-left">
                    <span className="text-[9px] font-semibold text-slate-500 uppercase">Active</span>
                    <p className="text-base font-extrabold text-indigo-600">9</p>
                    <span className="text-[8px] font-bold text-indigo-600">On Track</span>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2 text-left">
                    <span className="text-[9px] font-semibold text-slate-500 uppercase">Done</span>
                    <p className="text-base font-extrabold text-emerald-600">42</p>
                    <span className="text-[8px] font-bold text-emerald-600">+16% wk</span>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-slate-700">Active Deliverables</span>
                    <span className="text-[9px] font-semibold text-indigo-600">Live</span>
                  </div>
                  <div className="space-y-1.5 text-[10px]">
                    <div className="flex items-center justify-between rounded-lg bg-slate-50 p-1.5">
                      <span className="font-semibold text-slate-800">API Gateway Auth Refactor</span>
                      <span className="rounded-md bg-indigo-100 px-1.5 py-0.5 font-bold text-indigo-700">In Progress</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-slate-50 p-1.5">
                      <span className="font-semibold text-slate-800">Q4 Operational Onboarding</span>
                      <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 font-bold text-emerald-700">Completed</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-slate-50 p-1.5">
                      <span className="font-semibold text-slate-800">Mobile UI Responsive Audit</span>
                      <span className="rounded-md bg-sky-100 px-1.5 py-0.5 font-bold text-sky-700">New</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Grid Section */}
      <section id="features" className="features-section">
        <div className="section-heading">
          <span className="eyebrow">Enterprise Capabilities</span>
          <h2>Engineered for operational excellence.</h2>
          <p>Everything your team needs to stay aligned, eliminate silos, and execute with precision.</p>
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

      {/* Workflow Section */}
      <section className="workflow-section">
        <div>
          <span className="eyebrow">Streamlined Lifecycle</span>
          <h2>From assignment to completion in 4 simple steps.</h2>
          <p>Admins define priorities, employees own delivery, and every status update stays visible in real time.</p>
        </div>

        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-2">
          {workflow.map((item) => (
            <div key={item.step} className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs transition hover:shadow-md">
              <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">{item.step}</span>
              <h3 className="mt-2 text-sm font-bold text-slate-900">{item.title}</h3>
              <p className="mt-1 text-xs text-slate-500 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-6">
        <div className="cta">
          <div>
            <span className="eyebrow !bg-indigo-900/50 !text-indigo-300 !border-indigo-700">Get Started in Seconds</span>
            <h2>Bring your company workspace to life.</h2>
            <p>Create your organization, invite your teammates, and start delegating work with zero friction.</p>
          </div>
          <button className="primary-btn !bg-white !text-slate-900 hover:!bg-slate-100 shrink-0 font-bold shadow-lg" onClick={onRegister}>
            <span>Create Company Workspace</span>
            <FaArrowRight className="text-xs" />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="brand">
          <span className="brand-mark"><FaLayerGroup /></span>
          <span>Employee<span className="brand-accent">MS</span></span>
        </div>
        <span className="text-xs text-slate-400">© 2026 EmployeeMS. Modern workforce operations platform.</span>
      </footer>
    </main>
  );
};

export default LandingPage;

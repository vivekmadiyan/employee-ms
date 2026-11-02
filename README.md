# EmployeeMS — Full-Stack Employee & Task Management

EmployeeMS is a React + Express + PostgreSQL application for assigning work, tracking task status, and giving employees a focused workspace.

## Stack
- Frontend: React 18 + Vite + Tailwind CSS
- Backend: Node.js + Express
- Database: PostgreSQL + node-postgres
- Auth: JWT + bcrypt
- API: REST

## Setup

### 1. Database
Install PostgreSQL locally or create a PostgreSQL database named `employee_management_system`.

### 2. Backend
```bash
cd server
cp .env.example .env
# edit DATABASE_URL and JWT_SECRET
# set SEED_ADMIN_PASSWORD to a unique password with at least 16 characters
npm install
npm run seed
npm run dev
```
API: `http://localhost:5000`

### 3. Frontend
From the project root:
```bash
npm install
cp .env.example .env
npm run dev
```
Frontend: `http://localhost:5173`

## Production deployment

For Vercel + Render + Neon instructions, see [DEPLOY.md](./DEPLOY.md). The optional Docker deployment below is a self-hosted alternative.

The repository includes a Docker deployment: React is served by Nginx, the API runs as a non-root Node process, and PostgreSQL data is stored in a named Docker volume.

1. Copy `.env.production.example` to `.env` on the deployment host.
2. Create a separate deployment secrets file containing at least:

```env
POSTGRES_PASSWORD=use-a-long-unique-database-password
JWT_SECRET=use-a-different-long-random-secret-at-least-32-characters
CLIENT_URL=https://app.example.com
```

3. Point your HTTPS reverse proxy/load balancer to the `web` service and run:

```bash
docker compose up -d --build
```

Do not expose PostgreSQL port `5432` publicly. Configure HTTPS at the edge, restrict database access to the API, and set `PGSSL=true` when using a managed PostgreSQL provider.

## Operational checklist

- Use unique production secrets; never reuse the example values or commit `.env` files.
- Back up PostgreSQL daily and rehearse a restore before launch.
- Monitor `/api/health` for readiness and `/api/health/live` for process liveness.
- Configure a verified Brevo sender and API key before enabling invitation email delivery.
- Run `npm run check` and `npm --prefix server audit --omit=dev` in CI for every release.
- Use a separate production database and a least-privilege database role.

## Browser end-to-end tests

The browser suite requires an empty, dedicated PostgreSQL database on the local machine. It refuses database URLs whose host is not `localhost` or a loopback address; never point it at production or a shared database.

```powershell
$env:EMS_E2E_DATABASE_URL = 'postgres://ems_e2e:ems_e2e_only@127.0.0.1:5432/ems_e2e'
npm run test:e2e
```

GitHub Actions provisions its own ephemeral PostgreSQL service and Chromium browser for this suite.

## Security baseline

The API validates environment variables and request bodies, scopes all tenant data by company, uses parameterized PostgreSQL queries, bcrypt password hashes, short-lived signed JWTs, strict CORS, Helmet headers, request size limits, rate limits for sensitive public flows, and request IDs for operational debugging. These controls address common authentication, object authorization, resource-consumption, and misconfiguration risks highlighted by the [OWASP API Security Top 10](https://owasp.org/www-project-api-security/).

## Seed accounts
- Admin: `admin@example.com`; set `SEED_ADMIN_PASSWORD` in `server/.env` before running the seed.
- Sample employee accounts receive independent random passwords and are not intended for login.
- The seed script refuses to run when `NODE_ENV=production`.

## Main API
- `POST /api/auth/login`
- `GET /api/auth/me`
- `PATCH /api/auth/me`
- `POST /api/auth/forgot-password` and `POST /api/auth/reset-password`
- `GET /api/employees` (admin)
- `PATCH /api/employees/:id` and `PATCH /api/employees/:id/status` (admin)
- Employee records include team and an optional same-workspace employee manager; reporting cycles are rejected.
- `GET /api/team/direct-reports` (employee; only active direct reports)
- `GET /api/invitations`, `POST /api/invitations/:id/resend`, and `DELETE /api/invitations/:id` (admin)
- `POST /api/invitations/bulk` (admin; create up to 100 invitations)
- `GET /api/tasks`
- `POST /api/tasks` (admin)
- `PATCH /api/tasks/:id` and `PATCH /api/tasks/:id/archive` (admin)
- `POST /api/tasks/bulk` (admin; archive, restore, or set priority for up to 100 task IDs)
- `PATCH /api/tasks/:id/status`
- `GET` and `POST /api/tasks/:id/comments`
- `GET /api/reports/tasks?from=YYYY-MM-DD&to=YYYY-MM-DD` (admin)
- `GET /api/notifications` and notification read endpoints
- `GET /api/audit-events` (admin; latest 100 company-scoped security events)
- `GET /api/leave-requests` (employee's own requests and direct reports' requests), `POST /api/leave-requests` (employee), `PATCH /api/leave-requests/:id/review` (admin or assigned manager for a direct report), `DELETE /api/leave-requests/:id` (employee)
- `GET /api/leave-policies`, `PUT /api/leave-policies` (admin configures annual allowances)
- `GET /api/leave-balance?year=YYYY` (signed-in user's approved, pending, and remaining allowance)
- `GET /api/leave-calendar?from=YYYY-MM-DD&to=YYYY-MM-DD` (approved absences only; up to 93 days)
- `GET /api/dashboard/admin` (admin)
- `GET /api/dashboard/employee`
- `GET /api/health`

## V1 workflows

- Admins can search and filter tasks, edit assignment/details, archive and restore tasks individually or in bulk, apply a bulk priority, and review task discussions.
- Team management supports employee profile edits, safe access deactivation/reactivation, invitation status, resend, and revoke.
- Admins can invite up to 100 employees from a CSV; each valid row creates a secure invitation without generating or sharing passwords, while invalid and duplicate rows are reported individually.
- Employees can discuss tasks; notifications cover assignments, status changes, comments, and due/overdue work. New assignments and reassignments send an email through Brevo. An authenticated Server-Sent Events stream refreshes notifications, dashboards, task lists, team/invitation data, and open discussions across signed-in devices within a few seconds.
- Users can update their profile and password or request a time-limited password-reset email.

## Feature comparison and product checklist

This is a feature-pattern comparison of public vendor pages, not a feature-by-feature certification, plan comparison, or claim that all vendors include every feature in every tier. Scope varies by product, plan, and country. Sources: [BambooHR](https://www.bamboohr.com/), [Rippling HRIS](https://www.rippling.com/products/hr/hris), [Zoho People](https://www.zoho.com/people/features.html), [OrangeHRM](https://orangehrm.com/), and [Workday HCM](https://www.workday.com/en-us/products/human-capital-management.html).

Status means: **Available** = implemented in EmployeeMS; **Basic** = a useful first version exists but lacks the depth, automation, or assurance expected of a mature HRIS; **Gap** = not implemented. Task management is a strength of EmployeeMS, but it is not a substitute for core HR lifecycle capabilities.

| Capability | Leading HRIS pattern | EmployeeMS today | Status |
|---|---|---|---|
| Employee records and directory | Central employee profiles, searchable workforce records, reporting hierarchy | Company-scoped profiles with department, team, manager, job title, employment type, hire date, status, filtering, CSV export, and org chart | **Available** |
| Organization and manager experience | HR owns structure and access; managers have scoped team views and approvals | Admin-controlled invites, access, team/reporting changes; managers see active direct reports and review only their leave requests | **Available** |
| Employee and manager self-service | Employees update permitted profile details; managers complete people workflows | Employees manage their account and tasks/time off; managers get a direct-report view and scoped leave review | **Basic** — no delegated workflow settings or manager task assignment controls |
| Onboarding | Reusable workflows, forms/documents, assigned tasks, progress tracking | One-time checklist per active employee, implemented as trackable tasks | **Basic** — no configurable templates, forms, document collection, or e-signatures |
| Leave and time off | Configurable policies, balance visibility, approval chains, holidays, accrual, scheduling | Requests, manager/admin review, email, annual calendar-day caps, balances, approved-absence calendar | **Basic** — no accrual, workday/holiday rules, carryover, or multi-stage approvals |
| Employee documents | Private records, acknowledgements, secure retrieval, retention, signatures | No employee document repository | **Gap** |
| Offboarding and lifecycle | Exit workflow, clearance, task ownership, access revocation, retained history | Admin can deactivate access; no complete exit checklist or lifecycle reporting | **Basic** |
| Attendance, shifts, and timesheets | Clock-in/out, schedules, breaks, approvals, labor rules | Not implemented | **Gap** — prioritize only for hourly/shift-based customers |
| Recruiting and hiring | Candidate pipeline, requisitions, interview/hiring workflows | Invitations begin after a hiring decision; no applicant tracking | **Gap** — segment-dependent |
| Performance and growth | Goals, review cycles, feedback, skills, learning | Task progress and comments, but no performance reviews, goals, or learning plans | **Gap** — segment-dependent |
| Payroll, benefits, and compensation | Payroll, enrollment, compensation planning, local compliance | Not implemented | **Gap** — jurisdiction-sensitive; do not build without a defined market and compliance plan |
| Tasks and collaboration | Assignments, progress, comments, notifications, operational reporting | Task assignment, status, comments, bulk operations, notifications, calendar export, Slack, email, and reports | **Available** — a product strength |
| Reporting and analytics | Headcount, lifecycle, leave, and configurable workforce insights | Task reports and employee roster export | **Basic** — HR headcount, lifecycle, and leave analytics are missing |
| Security and administration | Fine-grained access, audit, MFA/SSO, retention, compliance controls | Company-scoped APIs, admin/employee roles, scoped manager checks, audit events, optional TOTP MFA, rate limits | **Basic** — no SSO/SCIM, configurable retention, or completed independent security/compliance review |
| Integrations and automation | Broad app integrations, automated workflows, connected HR data | Slack task notifications, transactional email, live updates, task/calendar exports | **Basic** — no public API/webhooks, OAuth calendar sync, or configurable workflow engine |
| Product usability and accessibility | Responsive employee experience, accessible workflows, localization, help | Responsive role-based UI, dark mode, contextual help, account self-service | **Basic** — accessibility audit and localization are outstanding |

### Delivery checklist

Priorities target a usable, productive small-company HRIS first. “P0” items block a dependable production rollout; “P1” items close core HR gaps; “P2” items depend on validated customer segment and jurisdiction. Checkboxes track completion in the product, not whether an item is commercially available from a vendor.

#### P0 — Make the current product dependable

- [x] Company-scoped employee records, invites, profiles, team membership, and reporting lines.
- [x] Admin-owned organization changes with manager access limited to active direct reports.
- [x] Employee leave requests and manager/admin-scoped decisions.
- [x] Task assignment, team collaboration, notifications, and operational task reports.
- [ ] Run browser-based end-to-end workflows against an isolated real PostgreSQL database in CI.
- [ ] Rehearse production backup restore and schema rollback; document the recovery owner and recovery objectives.
- [ ] Complete accessibility and keyboard checks on employee, manager, and admin workflows; fix critical barriers.
- [ ] Add production monitoring, alert routing, and an incident runbook; verify email delivery and failure handling.

#### P1 — Complete the core HR lifecycle

- [ ] Add secure employee document storage, permission rules, acknowledgements, audit trail, and retention/deletion controls. Keep private files out of the public frontend build.
- [ ] Add reusable onboarding templates, owners, due dates, progress, and reminders; retain the existing task checklist integration.
- [ ] Add offboarding checklists, accountable owners, access-revocation steps, exit dates, and preserved employment history.
- [ ] Expand leave policies with accrual, working-day calculations, company holidays, carryover, and configurable approval rules. Do not silently reinterpret existing calendar-day policies.
- [ ] Add HR reporting for headcount, team/department changes, active/inactive employees, onboarding/offboarding, and leave usage.
- [ ] Improve manager workflows with a clear pending-approval queue, team absence planning, and auditable actions while keeping private HR data restricted.
- [ ] Add locale-aware dates, time zones, and number formatting; test keyboard navigation and screen-reader labels in critical forms.

#### P2 — Add only after target-market validation

- [ ] Decide whether the target customers need recruiting/ATS, performance reviews, goals/OKRs, and learning.
- [ ] Confirm workforce segment and labor-law scope before adding attendance, shifts, and timesheets.
- [ ] Select launch countries and compliance partners before adding payroll, benefits, compensation, or statutory HR workflows.
- [ ] Prioritize SSO/SCIM, public APIs/webhooks, and additional integrations based on customer demand.
- [ ] Add billing, plan limits, and tenant lifecycle tooling if EmployeeMS is commercialized as SaaS.

For scaling, also load-test representative tenant sizes, review database indexes and query plans, define tenant/data-retention controls, and establish measurable availability and recovery objectives before making scale or compliance claims.

## V2 task reporting

Admins can review task status, priority, category, overdue work, and assignee workload for a selected task-creation date range, with CSV export. Reports are scoped to the current company and exclude archived tasks.

## Security notes
Passwords are hashed with bcrypt in PostgreSQL. JWTs are required for protected APIs, and employees can only modify tasks assigned to them. For production, use HTTPS, a strong JWT secret, secure cookie-based refresh tokens, rate limiting, request validation, and managed PostgreSQL credentials.

Admins can review a company-scoped audit trail of account, employee, invitation, integration, and task changes. Audit records omit passwords, reset tokens, and invitation tokens; audit storage errors are logged without undoing completed workflows.

Employees can submit leave requests for up to 90 calendar days, view and cancel their pending requests, and track decisions. Assigned managers can review requests from active direct reports; admins can review requests workspace-wide. New requests are emailed to active workspace admins and the assigned manager, and approvals are emailed to the employee with the review note. Overlapping pending or approved dates are rejected, and workspace views update through the existing live activity stream.

Admins can configure annual calendar-day allowances per leave type; a blank allowance is unlimited. Approved and pending requests count toward the employee's allowance for each calendar year, and request creation serializes per employee to prevent concurrent requests from exceeding a configured cap. The team calendar shows approved absences only and omits leave reasons and leave types. Accrual schedules, working-day calculations, public holidays, carryover, and jurisdiction-specific policies are not implemented.

Users can optionally enable authenticator-app MFA from Account Settings. TOTP secrets are encrypted in PostgreSQL, login requires a current authenticator code, and ten single-use recovery codes are shown once. Slack incoming webhook URLs are also encrypted and restricted to Slack's HTTPS webhook host. Set a stable `MFA_ENCRYPTION_KEY` (at least 32 characters) in the API environment; if omitted, the API derives the encryption key from `JWT_SECRET`, so rotating the JWT secret will require MFA re-enrollment for users without recovery codes and reconfiguration of Slack.

Admins can create a one-time onboarding checklist for each active employee. It creates five assigned tasks with staggered due dates, reuses the normal task status/comment/notification workflows, and prevents duplicate checklists.

## Multi-company / SaaS-ready architecture
This version is designed so multiple companies can use the same application while keeping their data isolated. Each company gets a workspace, the first registered user becomes that company's admin, and employees/tasks are scoped by `companyId`. Admins can create employee accounts and assign tasks only within their own company.

### Company onboarding
1. Open the landing page.
2. Select **Create company workspace**.
3. Enter company details and create the first admin account.
4. From the admin dashboard, invite employees and share the invitation link if email delivery is unavailable.
5. Create and assign tasks to employees in that workspace.

### Important production next steps
- Add company plan limits and billing if commercialized.
- Configure production monitoring, backups, and HTTPS for the chosen hosting providers; rehearse a database restore.
- Deploy the frontend, API, and PostgreSQL using production environment variables.


## Transactional email

Company admins can invite employees instead of sharing temporary passwords. Invitations are scoped to the company and expire after 7 days. Brevo emails employees when a task is assigned or reassigned and emails the other active task participants when status, comments, or due dates change. Email delivery failures do not undo saved task or comment changes and are reported to the user. If email is not configured, invitations remain usable through the secure shareable invite link and task workflows remain available in the app.

### Email configuration

Set these optional values in `server/.env` or the backend hosting environment:

- `BREVO_API_KEY`
- `BREVO_SENDER_EMAIL`
- `BREVO_SENDER_NAME`

The invitation link is generated from `CLIENT_URL` and never grants access to another company. Render's free service blocks SMTP ports, so transactional email is sent over HTTPS through Brevo.

### No-cost monitoring

The API exposes `/api/health/live`, `/api/health`, and Prometheus-formatted `/api/metrics`. Configure a random `METRICS_TOKEN` of at least 32 characters in the API environment and scrape `/api/metrics` with `Authorization: Bearer <token>`. Metrics have no user, company, or URL labels; no hosted monitoring account is required.

## 12. Feature checklist

### Release verification

Run the same automated quality gates locally before a V2 release:

```bash
npm ci
npm run check
npm test
npm --prefix server ci
npm --prefix server test
npm --prefix server audit --omit=dev
```

GitHub Actions runs the frontend lint/build and calendar tests, backend syntax checks and API/email/MFA tests, and a Chromium end-to-end workflow against an ephemeral PostgreSQL 16 service. Production database backups/restores and provider-backed email/deployment smoke tests must still be verified in the hosting environment.

### V2 release-readiness gaps

- **P0 — Real-database/browser end-to-end coverage:** CI now exercises registration, invitation acceptance, manager reporting lines, employee authorization, and manager leave approval in Chromium against an isolated PostgreSQL service. The registration form also has an automated WCAG 2.1 A/AA scan. Run locally only with `EMS_E2E_DATABASE_URL` set to a dedicated PostgreSQL database on `localhost`; remote database hosts are rejected.
- **P0 — Recovery rehearsal:** production database backup, restore, and rollback of schema changes need an owner-run rehearsal against the actual hosting provider.
- **P1 — Production observability:** health and Prometheus metrics exist, but hosted dashboards, alert routing, and an incident runbook are not configured by the application.
- **P1 — Accessibility assurance:** the registration form has an automated WCAG 2.1 A/AA scan; continue with manual keyboard and assistive-technology checks across all workflows before making an accessibility conformance claim.
- **P1 — HR policy depth:** leave is annual calendar-day caps only; accrual, working-day/holiday rules, carryover, documents, and offboarding are not implemented.
- **Scope-dependent:** recruiting, payroll, benefits, billing, and advanced talent modules require customer and jurisdiction choices before implementation.

### Implemented
- Employee profiles include job title, employment type, and hire date, available during direct and CSV invitations and editable/exportable from team management.
- Hybrid team management keeps company structure, invitations, employee access, and policy changes admin-controlled. An employee becomes a manager through assigned active direct reports (not a separate elevated role); managers can view only those reports and review only their leave requests, while admins retain workspace-wide oversight.
- Team structure includes named teams, manager/reporting-line assignments, team-filtered directory, and a browsable org chart.
- Leave request emails go to active workspace admins and the assigned manager; approval emails go to the employee, with delivery status surfaced in the workflow.
- Admin-configurable annual leave allowances, employee leave balances, and a shared calendar of approved absences.
- Dark mode with a persisted theme preference.
- Live workspace updates and notification delivery using authenticated Server-Sent Events.
- Admin task reports with CSV export and employee-directory CSV export.
- Print-ready task reports, audit activity, and team rosters that can be saved as PDF through the browser print dialog.
- Company-scoped audit events with search and filters.
- Optional authenticator-app MFA with encrypted TOTP secrets and single-use recovery codes.
- Workspace-configurable Slack notifications for task assignments and reassignments.
- One-time employee onboarding checklists based on assigned, trackable tasks.
- Token-protected Prometheus metrics for HTTP request/error totals, latency, and PostgreSQL pool usage.
- API rate limits, responsive/mobile layouts, task comments, leave management, contextual tooltips, and task calendar export.

Calendar export downloads an `.ics` file for the tasks currently visible to the user. Import it into Google Calendar, Outlook, or Apple Calendar. Automatic OAuth-based synchronization and ongoing calendar updates are not implemented.

### Remaining
- Secure employee document storage and acknowledgement workflows.
- Accrual-aware leave policies, working-day/holiday calculations, and carryover rules.
- Auditable offboarding checklists and employee-lifecycle reporting.
- Full accessibility audit and remediation against WCAG, including assistive-technology testing.
- Internationalization and locale-aware formatting.
- Workspace-editable email templates and branding.
- Hosted monitoring dashboards and operational alerting (the API includes Prometheus metrics and health endpoints).
- Configurable data-retention policies and feature flags.
- Searchable help center beyond the existing contextual tooltips.
- Company plan limits and billing if the product is commercialized.
- OAuth-based two-way calendar synchronization.

Monitoring, database backups/restore rehearsals, HTTPS, and production provider configuration also require deployment-level setup; application code alone cannot complete them. See [production operations](./docs/production-operations.md) for a recovery and alerting runbook.

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
- `GET /api/leave-requests`, `POST /api/leave-requests` (employee), `PATCH /api/leave-requests/:id/review` (admin), `DELETE /api/leave-requests/:id` (employee)
- `GET /api/dashboard/admin` (admin)
- `GET /api/dashboard/employee`
- `GET /api/health`

## V1 workflows

- Admins can search and filter tasks, edit assignment/details, archive and restore tasks individually or in bulk, apply a bulk priority, and review task discussions.
- Team management supports employee profile edits, safe access deactivation/reactivation, invitation status, resend, and revoke.
- Admins can invite up to 100 employees from a CSV; each valid row creates a secure invitation without generating or sharing passwords, while invalid and duplicate rows are reported individually.
- Employees can discuss tasks; notifications cover assignments, status changes, comments, and due/overdue work. New assignments and reassignments send an email through Brevo. An authenticated Server-Sent Events stream refreshes notifications, dashboards, task lists, team/invitation data, and open discussions across signed-in devices within a few seconds.
- Users can update their profile and password or request a time-limited password-reset email.

## V2 task reporting

Admins can review task status, priority, category, overdue work, and assignee workload for a selected task-creation date range, with CSV export. Reports are scoped to the current company and exclude archived tasks.

## Security notes
Passwords are hashed with bcrypt in PostgreSQL. JWTs are required for protected APIs, and employees can only modify tasks assigned to them. For production, use HTTPS, a strong JWT secret, secure cookie-based refresh tokens, rate limiting, request validation, and managed PostgreSQL credentials.

Admins can review a company-scoped audit trail of account, employee, invitation, and task changes. Audit records omit passwords, reset tokens, and invitation tokens; audit storage errors are logged without undoing completed workflows.

Employees can submit leave requests for up to 90 calendar days, view and cancel their pending requests, and track decisions. Admins can review requests for their workspace. Overlapping pending or approved dates are rejected, and workspace views update through the existing live activity stream.


## Multi-company / SaaS-ready architecture
This version is designed so multiple companies can use the same application while keeping their data isolated. Each company gets a workspace, the first registered user becomes that company's admin, and employees/tasks are scoped by `companyId`. Admins can create employee accounts and assign tasks only within their own company.

### Company onboarding
1. Open the landing page.
2. Select **Create company workspace**.
3. Enter company details and create the first admin account.
4. From the admin dashboard, invite employees and share the invitation link if email delivery is unavailable.
5. Create and assign tasks to employees in that workspace.

### Important production next steps
- Add MFA, audit logs, and company plan limits if commercialized.
- Add billing/subscription if the product is commercialized.
- Configure monitoring, backups, and HTTPS for the chosen hosting providers; rehearse a database restore.
- Deploy the frontend, API, and PostgreSQL using production environment variables.


## Transactional email

Company admins can invite employees instead of sharing temporary passwords. Invitations are scoped to the company and expire after 7 days. Brevo emails employees when a task is assigned or reassigned and emails the other active task participants when status, comments, or due dates change. Email delivery failures do not undo saved task or comment changes and are reported to the user. If email is not configured, invitations remain usable through the secure shareable invite link and task workflows remain available in the app.

### Email configuration

Set these optional values in `server/.env` or the backend hosting environment:

- `BREVO_API_KEY`
- `BREVO_SENDER_EMAIL`
- `BREVO_SENDER_NAME`

The invitation link is generated from `CLIENT_URL` and never grants access to another company. Render's free service blocks SMTP ports, so transactional email is sent over HTTPS through Brevo.

## 12. Additional / Remaining Features

- **Dark Mode / Theming** – Provide a UI toggle for light‑ and dark‑theme with persisted user preference (CSS variables or Tailwind dark mode).
- **Real‑Time Push Notifications** – Use WebSockets or Server‑Sent Events to push task updates, assignment alerts, and comment notifications instantly.
- **Export to PDF** – Generate PDF reports for tasks, audit logs, and team metrics (e.g., via `react-pdf` or server‑side PDF generation).
- **Calendar Sync (Google / Outlook)** – One‑click export of task due dates to external calendars using OAuth2 APIs.
- **Accessibility (A11y)** – Add ARIA roles, keyboard navigation, focus management, and color‑contrast compliance throughout the UI.
- **Internationalization (i18n)** – Integrate `react-i18next` (or similar) to support multiple languages and locale‑specific date/number formatting.
- **Admin CSV Export of Users** – Export all employee records (ID, name, email, role, status) as CSV from the admin dashboard.
- **Audit Trail Search & Filter** – Add a search bar and filters (action type, user, date range) to the Audit Trail view.
- **Multi‑Factor Authentication (MFA)** – Optional TOTP or email‑code verification for admin logins (e.g., via `speakeasy`).
- **API Rate Limiting & Throttling** – Protect backend endpoints against abuse (per‑IP / per‑user limits, configurable thresholds).
- **Custom Email Templates** – UI for admins to edit subject/body of invitation, task‑assignment, and password‑reset emails.
- **Performance Monitoring Dashboard** – Integrate a monitoring solution (Grafana, Prometheus, or a hosted SaaS) to view API latency, error rates, and resource usage.
- **Branding / Theming Customization** – Allow workspace owners to set primary brand colors, upload a logo, and customize the app's look‑and‑feel.
- **Mobile‑First Enhancements** – Optimize touch targets, add swipe gestures for task actions, and ensure responsive layouts on small screens.
- **Data Retention Policies** – Settings to purge audit logs or archived tasks after configurable periods (e.g., 30 days, 90 days).
- **Help Center / Tooltip System** – Contextual help icons with hover tooltips and a searchable knowledge‑base modal.
- **Feature Flags** – Infrastructure (e.g., LaunchDarkly‑style) to enable/disable beta features per workspace or user role.

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

The repository includes an open-source Docker deployment: React is served by Nginx, the API runs as a non-root Node process, and PostgreSQL data is stored in a named Docker volume.

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
- Configure a real SMTP provider before enabling invitation email delivery.
- Run `npm run check` and `npm --prefix server audit --omit=dev` in CI for every release.
- Use a separate production database and a least-privilege database role.

## Security baseline

The API validates environment variables and request bodies, scopes all tenant data by company, uses parameterized PostgreSQL queries, bcrypt password hashes, short-lived signed JWTs, strict CORS, Helmet headers, request size limits, rate limits for sensitive public flows, and request IDs for operational debugging. These controls address common authentication, object authorization, resource-consumption, and misconfiguration risks highlighted by the [OWASP API Security Top 10](https://owasp.org/www-project-api-security/).

## Seed accounts
- Admin: `admin@example.com` / `123`
- Employee: `e@e.com` / `123`
- Employee: `employee2@example.com` / `123`

Change seed passwords before real deployment.

## Main API
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/employees` (admin)
- `GET /api/tasks`
- `POST /api/tasks` (admin)
- `PATCH /api/tasks/:id/status`
- `GET /api/dashboard/admin` (admin)
- `GET /api/dashboard/employee`
- `GET /api/health`

## Security notes
Passwords are hashed in MongoDB. JWTs are required for protected APIs, and employees can only modify tasks assigned to them. For production, use HTTPS, a strong JWT secret, secure cookie-based refresh tokens, rate limiting, request validation, and managed MongoDB credentials.


## Multi-company / SaaS-ready architecture
This version is designed so multiple companies can use the same application while keeping their data isolated. Each company gets a workspace, the first registered user becomes that company's admin, and employees/tasks are scoped by `companyId`. Admins can create employee accounts and assign tasks only within their own company.

### Company onboarding
1. Open the landing page.
2. Select **Create company workspace**.
3. Enter company details and create the first admin account.
4. From the admin dashboard, add employees.
5. Create and assign tasks to employees in that workspace.

### Important production next steps
- Add email invitations instead of sharing temporary passwords.
- Add password reset and MFA.
- Add billing/subscription and company plan limits if commercialized.
- Add audit logs, rate limiting, backups, monitoring, and HTTPS.
- Deploy the frontend, API, and MongoDB using production environment variables.


## Employee invitations

Company admins can invite employees instead of sharing temporary passwords. Invitations are scoped to the company, expire after 7 days, and can be delivered through SMTP. If SMTP is not configured, the admin receives a secure invitation link that can be copied and shared.

### SMTP configuration

Set these optional values in `server/.env`:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`

The invitation link is generated from `CLIENT_URL` and never grants access to another company.

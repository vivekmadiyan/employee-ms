# Run EmployeeMS as a Full-Stack App

## Requirements
- Node.js 18+
- PostgreSQL running locally OR a PostgreSQL connection string

## Terminal 1 — API
```bash
cd server
npm install
cp .env.example .env
# Windows PowerShell: copy .env.example .env
# Set DATABASE_URL and JWT_SECRET in .env
# Set SEED_ADMIN_PASSWORD to a unique password with at least 16 characters before seeding
npm run seed
npm run dev
```

The API runs at `http://localhost:5000`.

## Terminal 2 — React frontend
From the project root:
```bash
npm install
cp .env.example .env
# Windows PowerShell: copy .env.example .env
npm run dev
```

Open `http://localhost:5173`.

## Seed account
Use `admin@example.com` with the unique `SEED_ADMIN_PASSWORD` configured in `server/.env`. Sample employee accounts receive independent random passwords and are not intended for login.

## What is now server-backed
- JWT login
- bcrypt password verification
- PostgreSQL users
- PostgreSQL tasks
- Admin employee list
- Task creation and assignment
- Employee task dashboard
- Task status transitions
- Role-based API authorization
- Dashboard task counts

The frontend no longer uses the old employee/task seed data as its source of truth. `localStorage` is only used for the JWT and current user session metadata.

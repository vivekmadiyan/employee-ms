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

## Demo accounts
Admin:
- `admin@example.com` / `123`
- `admin@me.com` / `123`

Employee:
- `e@e.com` / `123`
- `employee2@example.com` / `123`
- `employee3@example.com` / `123`
- `employee4@example.com` / `123`
- `employee5@example.com` / `123`

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

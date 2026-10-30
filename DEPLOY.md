# Free deployment setup for EmployeeMS

This project is ready for a simple no-cost deployment setup using:

- Frontend: Vercel or Netlify
- Backend: Render free plan
- Email: Gmail SMTP with app password

## 1) Frontend deployment

### Option A: Vercel
1. Push this repository to GitHub.
2. Open Vercel and import the repo.
3. Set the root directory to the project root.
4. Build command: `npm install && npm run build`
5. Output directory: `dist`
6. Add environment variable:
   - `VITE_API_URL=https://your-render-app-name.onrender.com/api`

### Option B: Netlify
1. Import the repo in Netlify.
2. Build command: `npm run build`
3. Publish directory: `dist`
4. Add environment variable:
   - `VITE_API_URL=https://your-render-app-name.onrender.com/api`

## 2) Backend deployment

Use Render with the included `render.yaml` file.

1. Create a PostgreSQL database on Render.
2. Copy the database URL to the backend service environment variables.
3. Set `DATABASE_URL` to the Render Postgres connection string.
4. Set `JWT_SECRET` to a strong secret.
5. Set `CLIENT_URL` to your frontend live URL.
6. Set `ALLOWED_ORIGINS` to the same frontend URL.
7. Set `SMTP_*` values if you want actual invite mail.

## 3) Email setup

For no-cost email delivery, use Gmail SMTP:

- `SMTP_HOST=smtp.gmail.com`
- `SMTP_PORT=587`
- `SMTP_SECURE=false`
- `SMTP_USER=yourgmail@gmail.com`
- `SMTP_PASS=your-16-character-app-password`
- `SMTP_FROM="EmployeeMS <yourgmail@gmail.com>"`

For Gmail, create an App Password in Google Account settings.

## 4) Important note

Do not leave `CLIENT_URL=http://localhost:5173` in production. The invitation email links must point to a public URL or your emails will look suspicious.

## 5) Production server check

Test your deployed backend health endpoint:

- `https://your-render-app-name.onrender.com/api/health`

If the response is `status: "ok"`, the backend is live.

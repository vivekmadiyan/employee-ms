# Deploy EmployeeMS

The app consists of a Vite frontend, an Express API, and PostgreSQL. Deploy each service separately; the Render blueprint deploys the API only.

## Vercel frontend

1. Import this GitHub repository into Vercel.
2. Set the project root to the repository root, framework to Vite, output directory to `dist`, and build command to `npm run build`.
3. Add `VITE_API_URL` for Production and Preview, using the API URL with `/api`, for example `https://your-api.onrender.com/api`.
4. Deploy or redeploy after changing the variable. Vite embeds it at build time.

## Render API

1. Create a PostgreSQL database on a managed provider such as Neon.
2. In Render, create a Blueprint from this repository and use `render.yaml`.
3. Set `DATABASE_URL` to the current provider-generated PostgreSQL connection URI and keep it secret.
4. Set a unique `JWT_SECRET` of at least 32 characters. Render can generate this value.
5. Set `CLIENT_URL` and `ALLOWED_ORIGINS` to the exact public frontend origin, without a trailing slash. The blueprint defaults to this project's Vercel URL.
6. Keep `PGSSL=true` for a managed PostgreSQL provider.
7. Deploy, then confirm `https://your-api.onrender.com/api/health` reports `{"status":"ok","database":true}`.

## Invitation email

SMTP is optional. If it is not configured or the provider rejects the message, the invitation is still created and the admin is shown a link to copy and share. Set these values in Render to enable email:

- `SMTP_HOST=smtp.gmail.com`
- `SMTP_PORT=587`
- `SMTP_SECURE=false`
- `SMTP_USER`: the sender's Gmail address
- `SMTP_PASS`: a newly generated Google App Password (not the Gmail account password)
- `SMTP_FROM`: `EmployeeMS <same-sender@gmail.com>`

Use the sender identity authorized by your email provider. SMTP acceptance does not guarantee inbox placement; configure provider/domain authentication and monitor spam placement. Never put SMTP credentials in Git, Vercel frontend variables, or this document.

## Production checks

- The frontend bundle must use the public API URL, not `localhost`.
- The Render service must allow the exact Vercel origin.
- Test company signup, login, invitation link creation/acceptance, task assignment, and employee task status changes.
- Keep secrets in provider environment settings; rotate any credentials that have been exposed.

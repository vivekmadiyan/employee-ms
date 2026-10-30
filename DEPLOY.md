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

The Render free web service blocks outbound SMTP ports, so invitations are sent through Brevo's HTTPS transactional email API instead.

1. Create a Brevo account, generate an API key, and register/verify a sender email address in Brevo.
2. In Render's `employeems-api` Environment settings, set:
   - `BREVO_API_KEY`: the API key (keep it secret)
   - `BREVO_SENDER_EMAIL`: the exact sender address verified in Brevo
   - `BREVO_SENDER_NAME`: `EmployeeMS` (already the Blueprint default)
3. Save the settings and wait for the backend to redeploy.
4. Create a new invitation. The app reports whether the provider accepted it; acceptance is not a guarantee of inbox placement.

If email is not configured or Brevo rejects the message, the invitation remains valid and the admin can copy and share its 7-day invite link. Never put provider credentials in Git, Vercel frontend variables, or this document.

Brevo's sender and API setup: https://developers.brevo.com/docs/send-a-transactional-email

## Production checks

- The frontend bundle must use the public API URL, not `localhost`.
- The Render service must allow the exact Vercel origin.
- Test company signup, login, invitation link creation/acceptance, task assignment, and employee task status changes.
- Keep secrets in provider environment settings; rotate any credentials that have been exposed.

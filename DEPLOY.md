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
7. Deploy; the API creates the required tables and applies the additive task-archive column migration at startup.
8. Confirm `https://your-api.onrender.com/api/health` reports `{"status":"ok","database":true}`.

## Transactional email

The Render free web service blocks outbound SMTP ports, so invitations, password resets, and task assignment emails use Brevo's HTTPS transactional email API instead.

1. Create a Brevo account, generate an API key, and register/verify a sender email address in Brevo.
2. In Render's `employeems-api` Environment settings, set:
   - `BREVO_API_KEY`: the API key (keep it secret)
   - `BREVO_SENDER_EMAIL`: the exact sender address verified in Brevo
   - `BREVO_SENDER_NAME`: `EmployeeMS` (already the Blueprint default)
3. Save the settings and wait for the backend to redeploy.
4. Create an invitation and assign a task. The app reports whether the provider accepted each message; acceptance is not a guarantee of inbox placement.

If email is not configured or Brevo rejects a message, the invitation/task still remains available in the app and the admin sees a delivery status. For invitations, the admin can copy and share its 7-day invite link. Never put provider credentials in Git, Vercel frontend variables, or this document.

Brevo's sender and API setup: https://developers.brevo.com/docs/send-a-transactional-email

## Optional AI task drafting

The admin task form can draft editable task details using Google Gemini. It is disabled until configured:

1. Create a Gemini API key in [Google AI Studio](https://aistudio.google.com/apikey).
2. In Render's `employeems-api` Environment settings, set `GEMINI_API_KEY` to the secret key. Keep billing disabled if you want to use only the free quota; the service applies a per-IP request limit and the provider may impose additional quotas.
3. Optionally set `GEMINI_MODEL`; the default is `gemini-2.5-flash-lite`.
4. Save settings and wait for the backend to redeploy.

Only the brief and optional category entered by the admin are sent to Gemini. The form warns users not to include personal, sensitive, or confidential information: Google's unpaid-service terms allow submitted prompts and responses to be reviewed and used to improve Google products. Generated text is untrusted and must be reviewed; it is never saved or assigned until the admin submits the task form. See [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing) and [Gemini API terms](https://ai.google.dev/gemini-api/terms).

Google's current terms require Paid Services for Gemini API clients made available to users in the EEA, Switzerland, or UK. Use an eligible paid service or disable AI drafting for those users.

## Production checks

- The frontend bundle must use the public API URL, not `localhost`.
- The Render service must allow the exact Vercel origin.
- Test company signup and login, invitation delivery and acceptance, password recovery, account profile/password changes, and sign-out.
- If AI drafting is enabled, verify that `GEMINI_API_KEY` is configured only on the backend and test the free-quota/rate-limit response; do not enter sensitive or personal data in prompts.
- As an admin, test task search/filter/edit/archive/restore, comments, and notifications; verify archived tasks do not appear in active dashboards.
- Keep the authenticated Server-Sent Events stream available through the hosting proxy; it refreshes workspace data and notifications across signed-in devices within a few seconds and reconnects automatically after interruptions. Workspace-change tracking is installed automatically during database initialization; it needs no additional environment variables.
- Test that an employee can comment on and update only their own tasks, and that deactivation is blocked while they have open work.
- Check the responsive layout and keyboard access for sign-in, invitation, dashboard, account settings, and task workflows.
- Back up the production database and complete a restore rehearsal before inviting real users.
- Keep secrets in provider environment settings; rotate any credentials that have been exposed.

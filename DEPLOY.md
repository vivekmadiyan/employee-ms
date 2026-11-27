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
9. To verify the exact backend release, compare the `X-EmployeeMS-Revision` response header from `/api/health/live` with the commit deployed to Render.

## Transactional email

The Render free web service blocks outbound SMTP ports, so invitations, password resets, and task assignment/update emails use Brevo's HTTPS transactional email API instead.

1. Create a Brevo account, generate an API key, and register/verify a sender email address in Brevo.
2. In Render's `employeems-api` Environment settings, set:
   - `BREVO_API_KEY`: the API key (keep it secret)
   - `BREVO_SENDER_EMAIL`: the exact sender address verified in Brevo
   - `BREVO_SENDER_NAME`: `EmployeeMS` (already the Blueprint default)
3. Save the settings and wait for the backend to redeploy.
4. Create an invitation and assign a task. The app reports whether the provider accepted each message; acceptance is not a guarantee of inbox placement.

If email is not configured or Brevo rejects a message, the invitation/task still remains available in the app and the admin sees a delivery status. For invitations, the admin can copy and share its 7-day invite link. Never put provider credentials in Git, Vercel frontend variables, or this document.

Brevo's sender and API setup: https://developers.brevo.com/docs/send-a-transactional-email

## Workspace AI

Set `GEMINI_API_KEY` in the Render backend environment. `GEMINI_MODEL` is optional and defaults to `gemini-3.5-flash-lite`. Keep these keys out of frontend variables and Git.

To enable a separate provider when Gemini is unavailable, add a `GROQ_API_KEY` in the same Render service and redeploy. The app uses Groq's `openai/gpt-oss-20b` model. If only Groq is configured, it serves the chat directly. Each enabled provider can receive the current question, the last four exchanges, and up to 100 visible task records (ID, title, due date, status, and priority). Check the provider's data policies and quotas before enabling it for a workspace.

Use **AI chat** to test a task question and a follow-up. Model replies identify the provider and can link to referenced tasks. **Task summaries** use the database directly and do not call a model.

The **AI** tab has a tool picker. Employees can enable **Update task status** for their assignments. Admins can also enable **Create a task** for active teammates. With that tool enabled, active teammate names and IDs are included in the model context so it can resolve assignments. Review the proposed changes, then select **Confirm action** to save through the normal task API. The usual permissions, notifications, and audit trail apply.

**AI chat** and **AI reports** use the same database figures as the standard reports. Ask in chat for a task report, then ask a follow-up to change its dates or explain the results. Employees can report on their own tasks, and admins can report across the workspace and generate a workforce overview. Reports are read-only. The model receives aggregate counts and the report period for analysis. The app shows the verified figures and supports a text download for supported report requests when the provider is unavailable.

Chat history is stored in PostgreSQL and scoped to the signed-in account, workspace, and role. The app retains up to 20 recent chats with 12 turns each. Users can reopen or delete their saved chats. Reopening a chat loads its transcript and report figures. A new draft is required to review a task change again.

## Production checks

- The frontend bundle must use the public API URL, not `localhost`.
- The Render service must allow the exact Vercel origin.
- Test company signup and login, invitation delivery and acceptance, password recovery, account profile/password changes, and sign-out.
- As an admin, test task search/filter/edit/archive/restore, bulk task actions, comments, and notifications; verify archived tasks do not appear in active dashboards.
- Check task reports for multiple date ranges, verify status/priority/category and assignee totals, and export a CSV. Confirm archived and other-company tasks are excluded.
- Test bulk employee CSV invitations with valid, duplicate, malformed, and already-registered addresses; verify each successful invitation expires after 7 days and failures are identified by row.
- Verify admins can review only their own workspace's security activity, employees cannot access the audit trail, and password/reset/invitation tokens are never recorded.
- Test employee leave submission, overlap rejection, pending cancellation, admin approval/decline, and live updates; confirm users cannot read or modify another company's requests.
- Confirm assignment/reassignment, status, comment, and due-date emails reach the expected active task participants. Provider failures should be visible without undoing saved task changes.
- Keep the authenticated Server-Sent Events stream available through the hosting proxy; it refreshes workspace data and notifications across signed-in devices within a few seconds and reconnects automatically after interruptions. Workspace-change tracking is installed automatically during database initialization; it needs no additional environment variables.
- Test that an employee can comment on and update only their own tasks, and that deactivation is blocked while they have open work.
- Check the responsive layout and keyboard access for sign-in, invitation, dashboard, account settings, and task workflows.
- Back up the production database and complete a restore rehearsal before inviting real users.
- Keep secrets in provider environment settings; rotate any credentials that have been exposed.

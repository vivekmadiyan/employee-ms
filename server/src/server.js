import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import { initialiseDatabase, pool, query } from './db.js';
import { allowedOrigins, config } from './config.js';
import { auth, adminOnly } from './middleware/auth.js';
import {
  sendInvitationEmail,
  sendLeaveDecisionEmail,
  sendLeaveRequestEmail,
  sendPasswordResetEmail,
  sendTaskAssignedEmail,
  sendTaskUpdateEmail
} from './email.js';
import {
  createRecoveryCodes,
  decryptSecret,
  decryptTotpSecret,
  encryptSecret,
  encryptTotpSecret,
  findRecoveryCodeHash,
  generateTotpSecret,
  hashRecoveryCode,
  verifyTotpCode
} from './mfa.js';

const app = express();
if (config.TRUST_PROXY) app.set('trust proxy', 1);
app.disable('x-powered-by');
const httpMetrics = { requests: 0, serverErrors: 0, durationSeconds: 0 };
app.use((req, res, next) => { req.id = crypto.randomUUID(); res.setHeader('X-Request-Id', req.id); next(); });
app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));
app.use(cors({ origin(origin, callback) { if (!origin || allowedOrigins.has(origin)) return callback(null, true); return callback(new Error('Origin not allowed by CORS')); }, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], allowedHeaders: ['Authorization', 'Content-Type'], maxAge: 86400 }));
app.use(express.json({ limit: '1mb' }));
const skipRateLimitForTests = () => config.NODE_ENV === 'test';
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: 'draft-7', legacyHeaders: false, skip: skipRateLimitForTests, message: { message: 'Too many requests. Please try again later.' } }));
app.use((req, res, next) => {
  const startedAt = process.hrtime.bigint();
  res.on('finish', () => {
    httpMetrics.requests += 1;
    if (res.statusCode >= 500) httpMetrics.serverErrors += 1;
    httpMetrics.durationSeconds += Number(process.hrtime.bigint() - startedAt) / 1e9;
  });
  next();
});
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false, skip: skipRateLimitForTests, message: { message: 'Too many attempts. Please try again later.' } });
const onboardingLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: 'draft-7', legacyHeaders: false, skip: skipRateLimitForTests, message: { message: 'Too many account requests. Please try again later.' } });
const resetLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: 'draft-7', legacyHeaders: false, skip: skipRateLimitForTests, message: { message: 'Too many password reset requests. Please try again later.' } });
const userFields = 'id, company_id AS "companyId", first_name AS "firstName", email, role, department, job_title AS "jobTitle", employment_type AS "employmentType", hire_date::text AS "hireDate", team, manager_id AS "managerId", active';
const leaveTypes = ['vacation', 'sick', 'personal', 'other'];
const offboardingChecklist = [
  { key: 'handover', title: 'Complete role and knowledge handover' },
  { key: 'responsibilities', title: 'Reassign active tasks and responsibilities' },
  { key: 'property', title: 'Recover company equipment and property' },
  { key: 'access', title: 'Revoke company-system access' },
  { key: 'records', title: 'Complete required exit records' }
];
const leaveYearDays = (startDate, endDate, year) => {
  const yearStart = Date.UTC(year, 0, 1);
  const yearEnd = Date.UTC(year + 1, 0, 1) - 86400000;
  const start = Math.max(Date.parse(`${startDate}T00:00:00Z`), yearStart);
  const end = Math.min(Date.parse(`${endDate}T00:00:00Z`), yearEnd);
  return start <= end ? Math.floor((end - start) / 86400000) + 1 : 0;
};
const taskFields = 'id, company_id AS "companyId", task_title AS "taskTitle", task_description AS "taskDescription", task_date AS "taskDate", category, priority, status, assigned_to AS "assignedTo", created_by AS "createdBy", archived_at AS "archivedAt", created_at AS "createdAt", updated_at AS "updatedAt"';
const safeUser = u => ({ id: u.id, companyId: u.companyId, firstName: u.firstName, email: u.email, role: u.role, department: u.department, jobTitle: u.jobTitle || '', employmentType: u.employmentType || 'unspecified', hireDate: u.hireDate || null, team: u.team || 'General', managerId: u.managerId || null, active: u.active });
const serializeTask = t => ({ id: t.id, companyId: t.companyId, taskTitle: t.taskTitle, taskDescription: t.taskDescription, taskDate: t.taskDate, category: t.category, priority: t.priority, active: t.status === 'active', newTask: t.status === 'new', completed: t.status === 'completed', failed: t.status === 'failed', overdue: !t.archivedAt && !['completed', 'failed'].includes(t.status) && t.taskDate < new Date().toISOString().slice(0, 10), archived: Boolean(t.archivedAt), assignedTo: t.assignedTo, createdBy: t.createdBy, createdAt: t.createdAt, updatedAt: t.updatedAt });
const counts = tasks => ({ newTask: tasks.filter(t => t.status === 'new').length, active: tasks.filter(t => t.status === 'active').length, completed: tasks.filter(t => t.status === 'completed').length, failed: tasks.filter(t => t.status === 'failed').length });
const slugify = value => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
const hashToken = token => crypto.createHash('sha256').update(token).digest('hex');
const validateEmployeeManager = async (companyId, employeeId, managerId) => {
  if (managerId == null) return;
  if (managerId === Number(employeeId)) {
    const error = new Error('An employee cannot report to themselves');
    error.status = 400;
    throw error;
  }
  const manager = (await query(
    `SELECT id FROM users WHERE id=$1 AND company_id=$2 AND role='employee' AND active=true`,
    [managerId, companyId]
  )).rows[0];
  if (!manager) {
    const error = new Error('Select an active employee in this workspace as the manager');
    error.status = 400;
    throw error;
  }
  if (employeeId == null) return;
  const cycle = (await query(
    `WITH RECURSIVE manager_chain AS (
       SELECT id,manager_id FROM users WHERE id=$2 AND company_id=$1
       UNION
       SELECT u.id,u.manager_id FROM users u
       JOIN manager_chain chain ON u.id=chain.manager_id
       WHERE u.company_id=$1
     )
     SELECT EXISTS(SELECT 1 FROM manager_chain WHERE id=$3) AS "createsCycle"`,
    [companyId, managerId, employeeId]
  )).rows[0]?.createsCycle;
  if (cycle) {
    const error = new Error('This manager assignment would create a reporting cycle');
    error.status = 400;
    throw error;
  }
};
const resolveManagerEmail = async (companyId, managerEmail) => {
  if (!managerEmail) return null;
  const manager = (await query(
    `SELECT id FROM users WHERE company_id=$1 AND lower(email)=$2
       AND role='employee' AND active=true`,
    [companyId, managerEmail]
  )).rows[0];
  if (!manager) {
    const error = new Error('Manager email must belong to an active employee in this workspace');
    error.status = 400;
    throw error;
  }
  return manager.id;
};
const recordAuditEvent = async (companyId, actorId, req, action, entityType, entityId, details = {}) => {
  try {
    await query(
      `INSERT INTO audit_events(company_id,actor_user_id,action,entity_type,entity_id,details,request_id)
       VALUES($1,$2,$3,$4,$5,$6::jsonb,$7)`,
      [companyId, actorId || null, action, entityType, entityId == null ? null : String(entityId), JSON.stringify(details), req?.id || null]
    );
  } catch (error) {
    console.error('Audit event write failed:', {
      requestId: req?.id,
      action,
      entityType,
      entityId: entityId == null ? undefined : String(entityId),
      message: error.message
    });
  }
};
const notifyUser = (userId, taskId, actorId, type, message, eventKey) => query(
  'INSERT INTO notifications(user_id,task_id,actor_id,type,message,event_key) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(event_key) DO NOTHING',
  [userId, taskId, actorId, type, message, eventKey]
);
const emailTaskAssignment = async (task, recipient, assignedBy, req) => {
  if (!config.BREVO_API_KEY || !config.BREVO_SENDER_EMAIL) {
    return { emailSent: false, emailStatus: 'not_configured' };
  }
  try {
    await sendTaskAssignedEmail({
      apiKey: config.BREVO_API_KEY,
      senderEmail: config.BREVO_SENDER_EMAIL,
      senderName: config.BREVO_SENDER_NAME,
      recipientEmail: recipient.email,
      recipientName: recipient.firstName,
      companyName: req.company.name,
      assignedBy,
      task
    });
    return { emailSent: true, emailStatus: 'sent' };
  } catch (error) {
    console.error('Task assignment email failed:', {
      requestId: req.id,
      taskId: task.id,
      status: error.status,
      code: error.code || 'network_error',
      providerCode: error.providerCode,
      providerMessage: error.providerMessage
    });
    return { emailSent: false, emailStatus: error.code || 'failed' };
  }
};
const emailTaskUpdate = async (task, recipientIds, actorId, actorName, updateType, updateDetails, req) => {
  if (!config.BREVO_API_KEY || !config.BREVO_SENDER_EMAIL) return 'not_configured';
  try {
    const recipientResult = await query(
      `SELECT id,first_name AS "firstName",email FROM users
       WHERE id=ANY($1::int[]) AND company_id=$2 AND active=true`,
      [[...new Set(recipientIds)].filter(id => id !== actorId), req.company.id]
    );
    if (!recipientResult.rows.length) return 'no_recipients';
    const results = await Promise.allSettled(recipientResult.rows.map(recipient => sendTaskUpdateEmail({
      apiKey: config.BREVO_API_KEY,
      senderEmail: config.BREVO_SENDER_EMAIL,
      senderName: config.BREVO_SENDER_NAME,
      recipientEmail: recipient.email,
      recipientName: recipient.firstName,
      companyName: req.company.name,
      task,
      actorName,
      updateType,
      updateDetails
    })));
    const failures = results.filter(result => result.status === 'rejected');
    if (failures.length) {
      console.error('Task update email failed:', {
        requestId: req.id,
        taskId: task.id,
        event: updateType,
        failureCount: failures.length,
        codes: failures.map(result => result.reason.code || 'provider_error')
      });
    }
    return failures.length === 0 ? 'sent' : failures.length === results.length ? 'failed' : 'partial_failure';
  } catch (error) {
    console.error('Task update email recipient lookup failed:', {
      requestId: req.id,
      taskId: task.id,
      event: updateType,
      message: error.message
    });
    return 'failed';
  }
};
const emailLeaveRequest = async (leave, employeeName, req) => {
  if (!config.BREVO_API_KEY || !config.BREVO_SENDER_EMAIL) return 'not_configured';
  try {
    const reviewers = (await query(
      `SELECT id,first_name AS "firstName",email FROM users
       WHERE company_id=$1 AND active=true
         AND (role='admin' OR id=(SELECT manager_id FROM users WHERE id=$2 AND company_id=$1))`,
      [req.company.id, leave.userId]
    )).rows;
    if (!reviewers.length) return 'no_recipients';
    const results = await Promise.allSettled(reviewers.map(reviewer => sendLeaveRequestEmail({
      apiKey: config.BREVO_API_KEY,
      senderEmail: config.BREVO_SENDER_EMAIL,
      senderName: config.BREVO_SENDER_NAME,
      recipientEmail: reviewer.email,
      recipientName: reviewer.firstName,
      companyName: req.company.name,
      employeeName,
      leave
    })));
    const failures = results.filter(result => result.status === 'rejected');
    if (failures.length) {
      console.error('Leave request email failed:', {
        requestId: req.id,
        leaveRequestId: leave.id,
        failureCount: failures.length,
        codes: failures.map(result => result.reason.code || 'provider_error')
      });
    }
    return failures.length === 0 ? 'sent' : failures.length === results.length ? 'failed' : 'partial_failure';
  } catch (error) {
    console.error('Leave request email recipient lookup failed:', {
      requestId: req.id,
      leaveRequestId: leave.id,
      message: error.message
    });
    return 'failed';
  }
};
const emailLeaveApproval = async (leave, req) => {
  if (!config.BREVO_API_KEY || !config.BREVO_SENDER_EMAIL) return 'not_configured';
  try {
    const employee = (await query(
      `SELECT id,first_name AS "firstName",email FROM users
       WHERE id=$1 AND company_id=$2 AND active=true`,
      [leave.userId, req.company.id]
    )).rows[0];
    if (!employee) return 'no_recipients';
    await sendLeaveDecisionEmail({
      apiKey: config.BREVO_API_KEY,
      senderEmail: config.BREVO_SENDER_EMAIL,
      senderName: config.BREVO_SENDER_NAME,
      recipientEmail: employee.email,
      recipientName: employee.firstName,
      companyName: req.company.name,
      leave,
      reviewerName: req.user.firstName
    });
    return 'sent';
  } catch (error) {
    console.error('Leave approval email failed:', {
      requestId: req.id,
      leaveRequestId: leave.id,
      code: error.code || 'provider_error',
      message: error.message
    });
    return 'failed';
  }
};
const notifySlackTaskAssigned = async (task, recipient, req) => {
  try {
    const integration = (await query(
      'SELECT slack_webhook_encrypted AS encrypted FROM company_integrations WHERE company_id=$1',
      [req.company.id]
    )).rows[0];
    if (!integration?.encrypted) return;

    const webhookUrl = decryptSecret(integration.encrypted);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `Task assigned to ${recipient.firstName}: ${task.taskTitle} (due ${task.taskDate})`
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        }),
        redirect: 'error',
        signal: controller.signal
      });
      if (!response.ok || (await response.text()) !== 'ok') {
        throw new Error(`Slack webhook returned HTTP ${response.status}`);
      }
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    console.error('Slack task notification failed:', {
      requestId: req.id,
      taskId: task.id,
      message: error.message
    });
  }
};
const createEmployeeInvitation = async (values, req) => {
  const managerId = values.managerEmail
    ? await resolveManagerEmail(req.company.id, values.managerEmail)
    : values.managerId;
  await validateEmployeeManager(req.company.id, null, managerId);
  if (await findUser(values.email)) {
    const error = new Error('This email already belongs to an account');
    error.status = 409;
    throw error;
  }
  await query('DELETE FROM invitations WHERE company_id=$1 AND email=$2 AND accepted_at IS NULL', [req.company.id, values.email]);
  const rawToken = crypto.randomBytes(32).toString('hex');
  const invitation = (await query(
    `INSERT INTO invitations(company_id,email,first_name,department,token_hash,expires_at,invited_by,job_title,employment_type,hire_date,team,manager_id)
     VALUES($1,$2,$3,$4,$5,NOW() + INTERVAL '7 days',$6,$7,$8,$9,$10,$11) RETURNING id,expires_at AS "expiresAt"`,
    [req.company.id, values.email, values.firstName, values.department, hashToken(rawToken), req.user.id, values.jobTitle, values.employmentType, values.hireDate, values.team, managerId]
  )).rows[0];
  await recordAuditEvent(req.company.id, req.user.id, req, 'invitation.created', 'invitation', invitation.id, {
    email: values.email,
    department: values.department
  });
  const inviteUrl = `${config.CLIENT_URL}/invite/${rawToken}`;
  let emailSent = false;
  let emailStatus = 'not_configured';

  if (config.BREVO_API_KEY && config.BREVO_SENDER_EMAIL) {
    try {
      await sendInvitationEmail({
        apiKey: config.BREVO_API_KEY,
        senderEmail: config.BREVO_SENDER_EMAIL,
        senderName: config.BREVO_SENDER_NAME,
        recipientEmail: values.email,
        recipientName: values.firstName,
        companyName: req.company.name,
        inviteUrl
      });
      emailSent = true;
      emailStatus = 'sent';
    } catch (error) {
      emailStatus = error.code || 'failed';
      console.error('Invitation email failed:', {
        requestId: req.id,
        status: error.status,
        code: error.code || 'network_error',
        providerCode: error.providerCode,
        providerMessage: error.providerMessage
      });
    }
  }

  return {
    id: invitation.id,
    email: values.email,
    inviteUrl,
    emailSent,
    emailStatus,
    expiresAt: invitation.expiresAt
  };
};
const loadNotifications = async userId => {
  const { rows } = await query(
    `SELECT n.id,n.task_id AS "taskId",n.type,n.message,n.read_at AS "readAt",n.created_at AS "createdAt"
     FROM notifications n WHERE n.user_id=$1 ORDER BY n.created_at DESC LIMIT 50`,
    [userId]
  );
  return { notifications: rows, unreadCount: rows.filter(notification => !notification.readAt).length };
};
const syncDeadlineNotifications = async user => {
  if (user.role !== 'employee') return;
  await query(
    `INSERT INTO notifications(user_id,task_id,type,message,event_key)
     SELECT t.assigned_to,t.id,'due','Task due today: ' || t.task_title,'due:' || t.id || ':' || t.task_date
     FROM tasks t WHERE t.company_id=$1 AND t.assigned_to=$2 AND t.archived_at IS NULL
       AND t.status IN ('new','active') AND t.task_date=CURRENT_DATE::text
     ON CONFLICT(event_key) DO NOTHING`,
    [user.companyId, user.id]
  );
  await query(
    `INSERT INTO notifications(user_id,task_id,type,message,event_key)
     SELECT t.assigned_to,t.id,'overdue','Task is overdue: ' || t.task_title,'overdue:' || t.id || ':' || t.task_date
     FROM tasks t WHERE t.company_id=$1 AND t.assigned_to=$2 AND t.archived_at IS NULL
       AND t.status IN ('new','active') AND t.task_date<CURRENT_DATE::text
     ON CONFLICT(event_key) DO NOTHING`,
    [user.companyId, user.id]
  );
};
const sign = user => jwt.sign({ userId: String(user.id), role: user.role, companyId: String(user.companyId) }, config.JWT_SECRET, { algorithm: 'HS256', expiresIn: '8h', issuer: 'employeems-api', audience: 'employeems-web' });
const companyDto = c => ({ id: c.id, name: c.name, slug: c.slug, industry: c.industry, size: c.size });
const findUser = async (email) => (await query(`SELECT ${userFields}, password_hash AS "passwordHash" FROM users WHERE email = $1`, [email])).rows[0];
const email = z.string().trim().email().max(254).transform(value => value.toLowerCase());
const password = z.string().min(10, 'Password must be at least 10 characters').max(128);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
  .refine(value => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value, 'Date is invalid');
const schemas = {
  login: z.object({ email, password: z.string().min(1).max(128), mfaCode: z.string().trim().max(64).optional() }),
  register: z.object({ companyName: z.string().trim().min(2).max(120), industry: z.string().trim().min(2).max(80).default('General'), size: z.enum(['1-10', '11-50', '51-200', '201-500', '500+']).default('1-10'), firstName: z.string().trim().min(2).max(80), email, password }),
  employee: z.object({
    firstName: z.string().trim().min(2).max(80),
    email,
    password,
    department: z.string().trim().min(2).max(80).default('General'),
    jobTitle: z.string().trim().max(120).optional().default(''),
    employmentType: z.enum(['full_time', 'part_time', 'contractor', 'temporary', 'intern', 'unspecified']).optional().default('unspecified'),
    hireDate: isoDate.nullable().optional().default(null),
    team: z.string().trim().min(2).max(80).optional().default('General'),
    managerId: z.number().int().positive().nullable().optional().default(null)
  }),
  invitation: z.object({
    firstName: z.string().trim().min(2).max(80),
    email,
    department: z.string().trim().min(2).max(80).default('General'),
    jobTitle: z.string().trim().max(120).optional().default(''),
    employmentType: z.enum(['full_time', 'part_time', 'contractor', 'temporary', 'intern', 'unspecified']).optional().default('unspecified'),
    hireDate: isoDate.nullable().optional().default(null),
    team: z.string().trim().min(2).max(80).optional().default('General'),
    managerId: z.number().int().positive().nullable().optional().default(null),
    managerEmail: email.nullable().optional().default(null)
  }).refine(invitation => !(invitation.managerId && invitation.managerEmail), {
    message: 'Provide either a manager ID or manager email, not both'
  }),
  employeeProfile: z.object({
    firstName: z.string().trim().min(2).max(80),
    department: z.string().trim().min(2).max(80),
    jobTitle: z.string().trim().max(120).optional(),
    employmentType: z.enum(['full_time', 'part_time', 'contractor', 'temporary', 'intern', 'unspecified']).optional(),
    hireDate: isoDate.nullable().optional(),
    team: z.string().trim().min(2).max(80).optional(),
    managerId: z.number().int().positive().nullable().optional()
  }),
  leavePolicies: z.object({
    policies: z.array(z.object({
      leaveType: z.enum(['vacation', 'sick', 'personal', 'other']),
      annualAllowanceDays: z.number().int().min(0).max(365).nullable()
    })).length(4).refine(policies => new Set(policies.map(policy => policy.leaveType)).size === leaveTypes.length, {
      message: 'Provide exactly one annual allowance for each leave type'
    })
  }),
  task: z.object({ taskTitle: z.string().trim().min(2).max(160), taskDescription: z.string().trim().min(2).max(4_000), taskDate: isoDate, category: z.string().trim().min(2).max(80), assignedTo: z.coerce.number().int().positive(), priority: z.enum(['low', 'medium', 'high']).default('medium') })
};
const body = (schema, value) => { const result = schema.safeParse(value); if (!result.success) { const error = new Error(result.error.issues[0].message); error.status = 400; throw error; } return result.data; };
app.get('/api/health/live', (req, res) => res.json({ status: 'ok' }));
app.get('/api/health', async (req, res) => { try { await query('SELECT 1'); res.json({ status: 'ok', database: true }); } catch { res.status(503).json({ status: 'error', database: false }); } });
app.get('/api/metrics', (req, res) => {
  if (!config.METRICS_TOKEN) return res.sendStatus(404);
  const expected = Buffer.from(`Bearer ${config.METRICS_TOKEN}`);
  const supplied = Buffer.from(req.get('authorization') || '');
  if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) return res.sendStatus(404);
  res.type('text/plain; version=0.0.4; charset=utf-8').send([
    '# HELP employeems_http_requests_total Total HTTP requests handled.',
    '# TYPE employeems_http_requests_total counter',
    `employeems_http_requests_total ${httpMetrics.requests}`,
    '# HELP employeems_http_server_errors_total Total HTTP responses with a 5xx status.',
    '# TYPE employeems_http_server_errors_total counter',
    `employeems_http_server_errors_total ${httpMetrics.serverErrors}`,
    '# HELP employeems_http_request_duration_seconds_sum Cumulative HTTP request duration.',
    '# TYPE employeems_http_request_duration_seconds_sum counter',
    `employeems_http_request_duration_seconds_sum ${httpMetrics.durationSeconds}`,
    '# HELP employeems_database_pool_connections Current PostgreSQL pool connections by state.',
    '# TYPE employeems_database_pool_connections gauge',
    `employeems_database_pool_connections{state="total"} ${pool.totalCount}`,
    `employeems_database_pool_connections{state="idle"} ${pool.idleCount}`,
    `employeems_database_pool_connections{state="waiting"} ${pool.waitingCount}`
  ].join('\n') + '\n');
});

app.post('/api/onboarding/register-company', onboardingLimiter, async (req, res, next) => {
  let values; try { values = body(schemas.register, req.body); } catch (error) { return next(error); }
  const { companyName, industry, size, firstName, password } = values;
  const normalizedEmail = values.email;
  if (await findUser(normalizedEmail)) return res.status(409).json({ message: 'An account with this email already exists' });
  let slug = slugify(companyName) || `company-${Date.now()}`, suffix = 1;
  while ((await query('SELECT 1 FROM companies WHERE slug=$1', [slug])).rowCount) slug = `${slugify(companyName)}-${suffix++}`;
  const client = await pool.connect();
  try { await client.query('BEGIN'); const company = (await client.query('INSERT INTO companies(name,slug,industry,size) VALUES($1,$2,$3,$4) RETURNING id,name,slug,industry,size', [companyName.trim(), slug, industry.trim(), size])).rows[0]; const passwordHash = await bcrypt.hash(password, 12); const admin = (await client.query(`INSERT INTO users(company_id,first_name,email,password_hash,role,department) VALUES($1,$2,$3,$4,'admin','Management') RETURNING ${userFields}`, [company.id, firstName.trim(), normalizedEmail, passwordHash])).rows[0]; await client.query('COMMIT'); res.status(201).json({ token: sign(admin), user: { ...safeUser(admin), companyName: company.name }, company: companyDto(company) }); } catch (e) { await client.query('ROLLBACK'); console.error(e); res.status(500).json({ message: 'Could not create company' }); } finally { client.release(); }
});

app.post('/api/auth/login', authLimiter, async (req, res, next) => {
  try {
    const values = body(schemas.login, req.body);
    const user = await findUser(values.email);
    if (!user || !user.active || !(await bcrypt.compare(values.password, user.passwordHash))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const company = (await query('SELECT id,name,slug,industry,size,active FROM companies WHERE id=$1', [user.companyId])).rows[0];
    if (!company?.active) return res.status(403).json({ message: 'Your company workspace is inactive' });

    const mfa = (await query(
      'SELECT mfa_secret AS "mfaSecret",mfa_enabled AS "mfaEnabled",mfa_recovery_codes AS "mfaRecoveryCodes" FROM users WHERE id=$1',
      [user.id]
    )).rows[0];
    if (mfa?.mfaEnabled) {
      if (!values.mfaCode) return res.json({ mfaRequired: true });
      let accepted = false;
      if (mfa.mfaSecret) accepted = verifyTotpCode(decryptTotpSecret(mfa.mfaSecret), values.mfaCode);
      if (!accepted) {
        const recoveryHash = findRecoveryCodeHash(values.mfaCode, mfa.mfaRecoveryCodes);
        if (!recoveryHash) return res.status(401).json({ message: 'Invalid authenticator or recovery code' });
        await query(
          'UPDATE users SET mfa_recovery_codes=array_remove(mfa_recovery_codes,$1),updated_at=NOW() WHERE id=$2',
          [recoveryHash, user.id]
        );
        await recordAuditEvent(user.companyId, user.id, req, 'account.mfa_recovery_code_used', 'user', user.id);
      }
    }

    res.json({ token: sign(user), user: { ...safeUser(user), companyName: company.name }, company: companyDto(company) });
  } catch (error) {
    next(error);
  }
});
app.get('/api/auth/me', auth, (req, res) => res.json({ user: safeUser(req.user), company: companyDto(req.company) }));
app.get('/api/auth/mfa', auth, async (req, res, next) => {
  try {
    const result = await query('SELECT mfa_enabled AS enabled,mfa_secret IS NOT NULL AND mfa_enabled=false AS "setupPending",cardinality(mfa_recovery_codes) AS "recoveryCodesRemaining" FROM users WHERE id=$1', [req.user.id]);
    res.json(result.rows[0] || { enabled: false, setupPending: false, recoveryCodesRemaining: 0 });
  } catch (error) {
    next(error);
  }
});
app.post('/api/auth/mfa/setup', auth, async (req, res, next) => {
  try {
    const values = body(z.object({ currentPassword: z.string().min(1).max(128) }), req.body);
    const account = (await query('SELECT password_hash AS "passwordHash",mfa_enabled AS "mfaEnabled" FROM users WHERE id=$1', [req.user.id])).rows[0];
    if (!account || !await bcrypt.compare(values.currentPassword, account.passwordHash)) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }
    if (account.mfaEnabled) return res.status(409).json({ message: 'Multi-factor authentication is already enabled' });

    const secret = generateTotpSecret();
    await query('UPDATE users SET mfa_secret=$1,updated_at=NOW() WHERE id=$2', [encryptTotpSecret(secret), req.user.id]);
    await recordAuditEvent(req.company.id, req.user.id, req, 'account.mfa_setup_started', 'user', req.user.id);
    const label = encodeURIComponent(`${req.company.name}:${req.user.email}`);
    const issuer = encodeURIComponent(req.company.name);
    res.json({
      secret,
      otpauthUri: `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`
    });
  } catch (error) {
    next(error);
  }
});
app.post('/api/auth/mfa/enable', auth, async (req, res, next) => {
  try {
    const { code } = body(z.object({ code: z.string().trim().length(6) }), req.body);
    const account = (await query('SELECT mfa_secret AS secret,mfa_enabled AS enabled FROM users WHERE id=$1', [req.user.id])).rows[0];
    if (!account?.secret || account.enabled) return res.status(409).json({ message: 'Start multi-factor authentication setup before enabling it' });
    if (!verifyTotpCode(decryptTotpSecret(account.secret), code)) {
      return res.status(400).json({ message: 'That authenticator code is invalid or expired' });
    }

    const recoveryCodes = createRecoveryCodes();
    await query(
      'UPDATE users SET mfa_enabled=true,mfa_recovery_codes=$1,updated_at=NOW() WHERE id=$2',
      [recoveryCodes.map(hashRecoveryCode), req.user.id]
    );
    await recordAuditEvent(req.company.id, req.user.id, req, 'account.mfa_enabled', 'user', req.user.id);
    res.json({ enabled: true, recoveryCodes });
  } catch (error) {
    next(error);
  }
});
app.post('/api/auth/mfa/disable', auth, async (req, res, next) => {
  try {
    const values = body(z.object({ currentPassword: z.string().min(1).max(128), code: z.string().trim().max(64) }), req.body);
    const account = (await query(
      'SELECT password_hash AS "passwordHash",mfa_secret AS secret,mfa_enabled AS enabled,mfa_recovery_codes AS "recoveryCodes" FROM users WHERE id=$1',
      [req.user.id]
    )).rows[0];
    if (!account || !await bcrypt.compare(values.currentPassword, account.passwordHash)) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }
    if (!account.enabled || !account.secret) return res.status(409).json({ message: 'Multi-factor authentication is not enabled' });
    let accepted = verifyTotpCode(decryptTotpSecret(account.secret), values.code);
    if (!accepted) accepted = Boolean(findRecoveryCodeHash(values.code, account.recoveryCodes));
    if (!accepted) return res.status(400).json({ message: 'Invalid authenticator or recovery code' });
    await query('UPDATE users SET mfa_enabled=false,mfa_secret=NULL,mfa_recovery_codes=\'{}\',updated_at=NOW() WHERE id=$1', [req.user.id]);
    await recordAuditEvent(req.company.id, req.user.id, req, 'account.mfa_disabled', 'user', req.user.id);
    res.json({ enabled: false });
  } catch (error) {
    next(error);
  }
});
app.get('/api/integrations/slack', auth, adminOnly, async (req, res, next) => {
  try {
    const result = await query(
      'SELECT slack_webhook_encrypted IS NOT NULL AS configured FROM company_integrations WHERE company_id=$1',
      [req.company.id]
    );
    res.json({ configured: Boolean(result.rows[0]?.configured) });
  } catch (error) {
    next(error);
  }
});
app.post('/api/integrations/slack', auth, adminOnly, async (req, res, next) => {
  try {
    const { webhookUrl } = body(z.object({ webhookUrl: z.string().url().max(512) }), req.body);
    const parsedUrl = new URL(webhookUrl);
    if (
      parsedUrl.protocol !== 'https:' ||
      parsedUrl.hostname !== 'hooks.slack.com' ||
      parsedUrl.username ||
      parsedUrl.password ||
      parsedUrl.search ||
      parsedUrl.hash ||
      !/^\/services\/[A-Z0-9]+\/[A-Z0-9]+\/[A-Z0-9]+$/i.test(parsedUrl.pathname)
    ) {
      return res.status(400).json({ message: 'Enter a valid HTTPS Slack incoming webhook URL' });
    }
    await query(
      `INSERT INTO company_integrations(company_id,slack_webhook_encrypted,updated_by,updated_at)
       VALUES($1,$2,$3,NOW())
       ON CONFLICT(company_id) DO UPDATE SET slack_webhook_encrypted=EXCLUDED.slack_webhook_encrypted,updated_by=EXCLUDED.updated_by,updated_at=NOW()`,
      [req.company.id, encryptSecret(webhookUrl), req.user.id]
    );
    await recordAuditEvent(req.company.id, req.user.id, req, 'integration.slack_configured', 'integration', 'slack');
    res.json({ configured: true });
  } catch (error) {
    next(error);
  }
});
app.delete('/api/integrations/slack', auth, adminOnly, async (req, res, next) => {
  try {
    await query(
      'UPDATE company_integrations SET slack_webhook_encrypted=NULL,updated_by=$1,updated_at=NOW() WHERE company_id=$2',
      [req.user.id, req.company.id]
    );
    await recordAuditEvent(req.company.id, req.user.id, req, 'integration.slack_removed', 'integration', 'slack');
    res.json({ configured: false });
  } catch (error) {
    next(error);
  }
});
app.patch('/api/auth/me', auth, async (req, res, next) => {
  try {
    const values = body(z.object({
      firstName: z.string().trim().min(2).max(80),
      email,
      currentPassword: z.string().min(1).max(128).optional(),
      newPassword: password.optional()
    }).refine(data => Boolean(data.currentPassword) === Boolean(data.newPassword), 'Enter both current and new password to change your password'), req.body);
    if (values.email !== req.user.email && await query('SELECT 1 FROM users WHERE email=$1 AND id<>$2', [values.email, req.user.id]).then(result => result.rowCount)) {
      return res.status(409).json({ message: 'This email is already in use' });
    }

    let passwordHash;
    if (values.newPassword) {
      const current = await query('SELECT password_hash FROM users WHERE id=$1', [req.user.id]);
      if (!await bcrypt.compare(values.currentPassword, current.rows[0].password_hash)) {
        return res.status(400).json({ message: 'Current password is incorrect' });
      }
      passwordHash = await bcrypt.hash(values.newPassword, 12);
      await query('UPDATE password_resets SET used_at=NOW() WHERE user_id=$1 AND used_at IS NULL', [req.user.id]);
    }

    const updated = (await query(
      `UPDATE users SET first_name=$1,email=$2,${passwordHash ? 'password_hash=$3,' : ''}updated_at=NOW() WHERE id=$${passwordHash ? 4 : 3} RETURNING ${userFields}`,
      passwordHash ? [values.firstName, values.email, passwordHash, req.user.id] : [values.firstName, values.email, req.user.id]
    )).rows[0];
    await recordAuditEvent(req.company.id, req.user.id, req, 'account.profile_updated', 'user', req.user.id, {
      nameChanged: values.firstName !== req.user.firstName,
      emailChanged: values.email !== req.user.email,
      passwordChanged: Boolean(passwordHash)
    });
    res.json({ user: safeUser(updated) });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ message: 'This email is already in use' });
    next(error);
  }
});
app.post('/api/auth/forgot-password', resetLimiter, async (req, res, next) => {
  try {
    const { email: requestedEmail } = body(z.object({ email }), req.body);
    const user = await findUser(requestedEmail);
    if (user?.active && config.BREVO_API_KEY && config.BREVO_SENDER_EMAIL) {
      const rawToken = crypto.randomBytes(32).toString('hex');
      await query('UPDATE password_resets SET used_at=NOW() WHERE user_id=$1 AND used_at IS NULL', [user.id]);
      await query(
        'INSERT INTO password_resets(user_id,token_hash,expires_at) VALUES($1,$2,NOW() + INTERVAL \'30 minutes\')',
        [user.id, hashToken(rawToken)]
      );
      try {
        await sendPasswordResetEmail({
          apiKey: config.BREVO_API_KEY,
          senderEmail: config.BREVO_SENDER_EMAIL,
          senderName: config.BREVO_SENDER_NAME,
          recipientEmail: user.email,
          recipientName: user.firstName,
          resetUrl: `${config.CLIENT_URL}/reset-password/${rawToken}`
        });
      } catch (error) {
        await query('UPDATE password_resets SET used_at=NOW() WHERE token_hash=$1 AND used_at IS NULL', [hashToken(rawToken)]);
        console.error('Password reset email failed:', {
          requestId: req.id,
          status: error.status,
          code: error.code || 'network_error',
          providerCode: error.providerCode,
          providerMessage: error.providerMessage
        });
      }
    }
    res.json({ message: 'If an active account matches that email, a password reset link will be sent.' });
  } catch (error) {
    next(error);
  }
});
app.post('/api/auth/reset-password', resetLimiter, async (req, res, next) => {
  let values;
  try {
    values = body(z.object({ token: z.string().min(32).max(200), password }), req.body);
  } catch (error) {
    return next(error);
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const reset = (await client.query(
      `SELECT p.id,p.user_id,u.company_id
       FROM password_resets p JOIN users u ON u.id=p.user_id
       WHERE p.token_hash=$1 AND p.used_at IS NULL AND p.expires_at>NOW() FOR UPDATE OF p`,
      [hashToken(values.token)]
    )).rows[0];
    if (!reset) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'This password reset link is invalid or expired. Request a new one.' });
    }
    await client.query('UPDATE users SET password_hash=$1,updated_at=NOW() WHERE id=$2', [await bcrypt.hash(values.password, 12), reset.user_id]);
    await client.query('UPDATE password_resets SET used_at=NOW() WHERE user_id=$1 AND used_at IS NULL', [reset.user_id]);
    await client.query('COMMIT');
    await recordAuditEvent(reset.company_id, reset.user_id, req, 'account.password_reset', 'user', reset.user_id);
    res.json({ message: 'Password updated. You can now sign in.' });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});
app.get('/api/company/me', auth, (req, res) => res.json(companyDto(req.company)));

app.get('/api/employees', auth, adminOnly, async (req, res) => { const users = (await query(`SELECT ${userFields} FROM users WHERE company_id=$1 AND role='employee' ORDER BY active DESC, first_name`, [req.company.id])).rows; const tasks = (await query(`SELECT ${taskFields} FROM tasks WHERE company_id=$1 AND archived_at IS NULL`, [req.company.id])).rows; const onboarding = new Set((await query('SELECT employee_id AS "employeeId" FROM employee_onboarding WHERE company_id=$1', [req.company.id])).rows.map(item => item.employeeId)); res.json(users.map(u => { const own = tasks.filter(t => t.assignedTo === u.id); return { ...safeUser(u), onboardingCreated: onboarding.has(u.id), tasks: own.map(serializeTask), taskCounts: counts(own) }; })); });
app.get('/api/team/direct-reports', auth, async (req, res, next) => {
  try {
    if (req.user.role !== 'employee') return res.status(403).json({ message: 'Only employees can view their direct reports' });
    const { rows } = await query(
      `SELECT id,first_name AS "firstName",email,department,job_title AS "jobTitle",team
       FROM users WHERE company_id=$1 AND manager_id=$2 AND role='employee' AND active=true
       ORDER BY team,first_name`,
      [req.company.id, req.user.id]
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});
app.post('/api/employees', auth, adminOnly, async (req, res, next) => {
  try {
    const values = body(schemas.employee, req.body);
    await validateEmployeeManager(req.company.id, null, values.managerId);
    if (await findUser(values.email)) return res.status(409).json({ message: 'This email is already registered' });
    const passwordHash = await bcrypt.hash(values.password, 12);
    const user = (await query(
      `INSERT INTO users(company_id,first_name,email,password_hash,role,department,job_title,employment_type,hire_date,team,manager_id)
       VALUES($1,$2,$3,$4,'employee',$5,$6,$7,$8,$9,$10) RETURNING ${userFields}`,
      [req.company.id, values.firstName, values.email, passwordHash, values.department, values.jobTitle, values.employmentType, values.hireDate, values.team, values.managerId]
    )).rows[0];
    await recordAuditEvent(req.company.id, req.user.id, req, 'employee.created', 'user', user.id, {
      email: user.email,
      department: user.department,
      jobTitle: user.jobTitle,
      employmentType: user.employmentType,
      hireDate: user.hireDate
    });
    res.status(201).json(safeUser(user));
  } catch (error) {
    next(error);
  }
});
app.patch('/api/employees/:id/status', auth, adminOnly, async (req, res, next) => {
  try {
    const values = body(z.object({ active: z.boolean() }), req.body);
    const employee = (await query(
      `UPDATE users u SET active=$1,updated_at=NOW()
       WHERE u.id=$2 AND u.company_id=$3 AND u.role='employee'
         AND ($1 OR NOT EXISTS (
           SELECT 1 FROM tasks t WHERE t.assigned_to=u.id AND t.company_id=u.company_id
             AND t.archived_at IS NULL AND t.status IN ('new','active')
         ))
       RETURNING ${userFields}`,
      [values.active, req.params.id, req.company.id]
    )).rows[0];
    if (!employee) {
      const exists = await query(`SELECT 1 FROM users WHERE id=$1 AND company_id=$2 AND role='employee'`, [req.params.id, req.company.id]);
      if (!exists.rowCount) return res.status(404).json({ message: 'Employee not found' });
      return res.status(409).json({ message: 'Reassign or close this employee’s open tasks before deactivating their access.' });
    }
    await recordAuditEvent(req.company.id, req.user.id, req, values.active ? 'employee.access_restored' : 'employee.access_deactivated', 'user', employee.id);
    res.json(safeUser(employee));
  } catch (error) {
    next(error);
  }
});
app.patch('/api/employees/:id', auth, adminOnly, async (req, res, next) => {
  try {
    const values = body(schemas.employeeProfile, req.body);
    const employeeId = Number(req.params.id);
    if (Object.hasOwn(req.body, 'managerId')) {
      await validateEmployeeManager(req.company.id, employeeId, values.managerId);
    }
    const employee = (await query(
      `UPDATE users SET first_name=$1,department=$2,job_title=COALESCE($3,job_title),
         employment_type=COALESCE($4,employment_type),
         hire_date=CASE WHEN $8 THEN $5::date ELSE hire_date END,
         team=COALESCE($9,team),manager_id=CASE WHEN $10 THEN $11 ELSE manager_id END,updated_at=NOW()
       WHERE id=$6 AND company_id=$7 AND role='employee' RETURNING ${userFields}`,
      [
        values.firstName,
        values.department,
        values.jobTitle ?? null,
        values.employmentType ?? null,
        values.hireDate ?? null,
        employeeId,
        req.company.id,
        Object.hasOwn(req.body, 'hireDate'),
        values.team ?? null,
        Object.hasOwn(req.body, 'managerId'),
        values.managerId ?? null
      ]
    )).rows[0];
    if (!employee) return res.status(404).json({ message: 'Employee not found' });
    await recordAuditEvent(req.company.id, req.user.id, req, 'employee.updated', 'user', employee.id);
    res.json(safeUser(employee));
  } catch (error) {
    next(error);
  }
});
app.post('/api/employees/:id/onboarding', auth, adminOnly, async (req, res, next) => {
  const checklist = [
    { title: 'Complete your employee profile', description: 'Review your name, work email, department, and account settings.' },
    { title: 'Set up your work tools', description: 'Confirm access to the applications and communication tools needed for your role.' },
    { title: 'Review company policies', description: 'Read the policies and guidance shared by your manager.' },
    { title: 'Meet your teammates', description: 'Schedule introductions with your manager and immediate teammates.' },
    { title: 'Align on your first-week goals', description: 'Review your role expectations and agree on initial priorities with your manager.' }
  ];
  const employeeId = Number(req.params.id);
  if (!Number.isSafeInteger(employeeId) || employeeId < 1) return res.status(400).json({ message: 'Employee ID is invalid' });
  const client = await pool.connect();
  let createdTasks = [];
  let employee;
  try {
    await client.query('BEGIN');
    employee = (await client.query(
      `SELECT id,first_name AS "firstName",email FROM users WHERE id=$1 AND company_id=$2 AND role='employee' AND active=true`,
      [employeeId, req.company.id]
    )).rows[0];
    if (!employee) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Active employee not found in this workspace' });
    }

    const plan = (await client.query(
      'INSERT INTO employee_onboarding(company_id,employee_id,created_by) VALUES($1,$2,$3) ON CONFLICT(employee_id) DO NOTHING RETURNING id',
      [req.company.id, employeeId, req.user.id]
    )).rows[0];
    if (!plan) {
      await client.query('ROLLBACK');
      return res.status(409).json({ message: 'An onboarding checklist has already been created for this employee' });
    }

    const createdAt = new Date();
    createdTasks = await Promise.all(checklist.map(async (item, index) => {
      const taskDate = new Date(createdAt);
      taskDate.setUTCDate(taskDate.getUTCDate() + [0, 1, 3, 5, 7][index]);
      const dueDate = taskDate.toISOString().slice(0, 10);
      return (await client.query(
        `INSERT INTO tasks(company_id,task_title,task_description,task_date,category,assigned_to,created_by,priority)
         VALUES($1,$2,$3,$4,'Onboarding',$5,$6,'medium') RETURNING ${taskFields}`,
        [req.company.id, item.title, item.description, dueDate, employeeId, req.user.id]
      )).rows[0];
    }));
    await client.query('COMMIT');
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Onboarding checklist rollback failed:', { requestId: req.id, message: rollbackError.message });
    }
    return next(error);
  } finally {
    client.release();
  }

  await recordAuditEvent(req.company.id, req.user.id, req, 'employee.onboarding_created', 'user', employeeId, {
    taskCount: createdTasks.length
  });
  await Promise.all(createdTasks.map(async task => {
    try {
      await notifyUser(employeeId, task.id, req.user.id, 'assigned', `New task assigned: ${task.taskTitle}`, `assigned:${task.id}:${employeeId}`);
    } catch (error) {
      console.error('Onboarding task notification failed:', { requestId: req.id, taskId: task.id, message: error.message });
    }
  }));
  const emailResults = await Promise.all(createdTasks.map(task => emailTaskAssignment(task, employee, req.user.firstName, req)));
  createdTasks.forEach(task => { void notifySlackTaskAssigned(task, employee, req); });
  res.status(201).json({
    tasksCreated: createdTasks.length,
    emailStatuses: emailResults.map(result => result.emailStatus)
  });
});

app.get('/api/offboardings', auth, adminOnly, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT o.id,o.employee_id AS "employeeId",u.first_name AS "firstName",u.email,
         o.last_working_date::text AS "lastWorkingDate",o.status,
         i.id AS "itemId",i.item_key AS "itemKey",i.title AS "itemTitle",
         i.position AS "itemPosition",i.completed AS "itemCompleted",
         i.completed_at AS "itemCompletedAt"
       FROM employee_offboardings o
       JOIN users u ON u.id=o.employee_id AND u.company_id=o.company_id
       LEFT JOIN employee_offboarding_items i ON i.offboarding_id=o.id
       WHERE o.company_id=$1
       ORDER BY o.created_at DESC,i.position`,
      [req.company.id]
    );
    const offboardings = new Map();
    for (const row of rows) {
      if (!offboardings.has(row.id)) {
        offboardings.set(row.id, {
          id: row.id,
          employeeId: row.employeeId,
          firstName: row.firstName,
          email: row.email,
          lastWorkingDate: row.lastWorkingDate,
          status: row.status,
          items: []
        });
      }
      if (row.itemId) {
        offboardings.get(row.id).items.push({
          id: row.itemId,
          key: row.itemKey,
          title: row.itemTitle,
          completed: row.itemCompleted,
          completedAt: row.itemCompletedAt
        });
      }
    }
    res.json([...offboardings.values()]);
  } catch (error) {
    next(error);
  }
});

app.post('/api/employees/:id/offboarding', auth, adminOnly, async (req, res, next) => {
  let values;
  try {
    values = body(z.object({ lastWorkingDate: isoDate }).strict(), req.body);
  } catch (error) {
    return next(error);
  }
  const employeeId = Number(req.params.id);
  if (!Number.isSafeInteger(employeeId) || employeeId < 1) {
    return res.status(400).json({ message: 'Employee ID is invalid' });
  }

  const client = await pool.connect();
  let offboarding;
  try {
    await client.query('BEGIN');
    const employee = (await client.query(
      `SELECT id,first_name AS "firstName",email FROM users
       WHERE id=$1 AND company_id=$2 AND role='employee' AND active=true FOR UPDATE`,
      [employeeId, req.company.id]
    )).rows[0];
    if (!employee) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Active employee not found in this workspace' });
    }

    const existing = (await client.query(
      'SELECT id FROM employee_offboardings WHERE company_id=$1 AND employee_id=$2',
      [req.company.id, employeeId]
    )).rows[0];
    if (existing) {
      await client.query('ROLLBACK');
      return res.status(409).json({ message: 'An offboarding checklist already exists for this employee' });
    }

    offboarding = (await client.query(
      `INSERT INTO employee_offboardings(company_id,employee_id,last_working_date,created_by)
       VALUES($1,$2,$3,$4)
       RETURNING id,employee_id AS "employeeId",last_working_date::text AS "lastWorkingDate",status`,
      [req.company.id, employeeId, values.lastWorkingDate, req.user.id]
    )).rows[0];
    offboarding.firstName = employee.firstName;
    offboarding.email = employee.email;
    offboarding.items = await Promise.all(offboardingChecklist.map(async (item, position) => (
      (await client.query(
        `INSERT INTO employee_offboarding_items(offboarding_id,item_key,title,position)
         VALUES($1,$2,$3,$4)
         RETURNING id,item_key AS key,title,completed,completed_at AS "completedAt"`,
        [offboarding.id, item.key, item.title, position]
      )).rows[0]
    )));
    await client.query('COMMIT');
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Offboarding checklist rollback failed:', { requestId: req.id, message: rollbackError.message });
    }
    return next(error);
  } finally {
    client.release();
  }

  await recordAuditEvent(req.company.id, req.user.id, req, 'employee.offboarding_created', 'user', employeeId, {
    offboardingId: offboarding.id,
    lastWorkingDate: offboarding.lastWorkingDate
  });
  res.status(201).json(offboarding);
});

app.patch('/api/offboardings/:id/items/:itemId', auth, adminOnly, async (req, res, next) => {
  let values;
  try {
    values = body(z.object({ completed: z.boolean() }).strict(), req.body);
  } catch (error) {
    return next(error);
  }
  const offboardingId = Number(req.params.id);
  const itemId = Number(req.params.itemId);
  if (![offboardingId, itemId].every(value => Number.isSafeInteger(value) && value > 0)) {
    return res.status(400).json({ message: 'Offboarding checklist item is invalid' });
  }

  const client = await pool.connect();
  let item;
  let status;
  try {
    await client.query('BEGIN');
    const offboarding = (await client.query(
      `SELECT id,status FROM employee_offboardings
       WHERE id=$1 AND company_id=$2 FOR UPDATE`,
      [offboardingId, req.company.id]
    )).rows[0];
    if (!offboarding) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Offboarding checklist not found' });
    }
    if (offboarding.status !== 'in_progress') {
      await client.query('ROLLBACK');
      return res.status(409).json({ message: 'Completed offboarding checklists cannot be changed' });
    }

    item = (await client.query(
      `UPDATE employee_offboarding_items SET completed=$1,
         completed_by=CASE WHEN $1 THEN $4 ELSE NULL END,
         completed_at=CASE WHEN $1 THEN NOW() ELSE NULL END
       WHERE id=$2 AND offboarding_id=$3
       RETURNING id,item_key AS key,title,completed,completed_at AS "completedAt"`,
      [values.completed, itemId, offboardingId, req.user.id]
    )).rows[0];
    if (!item) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Offboarding checklist item not found' });
    }
    const remaining = (await client.query(
      'SELECT COUNT(*)::int AS count FROM employee_offboarding_items WHERE offboarding_id=$1 AND completed=false',
      [offboardingId]
    )).rows[0].count;
    status = remaining === 0 ? 'completed' : 'in_progress';
    await client.query(
      'UPDATE employee_offboardings SET status=$1,updated_at=NOW() WHERE id=$2 AND company_id=$3',
      [status, offboardingId, req.company.id]
    );
    await client.query('COMMIT');
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Offboarding checklist update rollback failed:', { requestId: req.id, message: rollbackError.message });
    }
    return next(error);
  } finally {
    client.release();
  }

  await recordAuditEvent(req.company.id, req.user.id, req, values.completed ? 'employee.offboarding_item_completed' : 'employee.offboarding_item_reopened', 'offboarding_item', item.id, {
    offboardingId
  });
  res.json({ offboardingId, status, item });
});

app.post('/api/invitations', auth, adminOnly, async (req, res, next) => {
  try {
    const values = body(schemas.invitation, req.body);
    res.status(201).json(await createEmployeeInvitation(values, req));
  } catch (error) {
    next(error);
  }
});
app.post('/api/invitations/bulk', auth, adminOnly, async (req, res, next) => {
  try {
    const values = body(z.object({
      employees: z.array(z.unknown()).min(1).max(100)
    }), req.body);
    const seenEmails = new Set();
    const results = new Array(values.employees.length);
    const processRow = async (rawEmployee, index) => {
      const rowNumber = Number.isInteger(rawEmployee?.row) && rawEmployee.row >= 2
        ? rawEmployee.row
        : index + 2;
      const employee = schemas.invitation.safeParse(rawEmployee);
      if (!employee.success) {
        results[index] = {
          row: rowNumber,
          email: typeof rawEmployee?.email === 'string' ? rawEmployee.email.slice(0, 254) : '',
          status: 'failed',
          error: employee.error.issues[0].message
        };
        return;
      }

      if (seenEmails.has(employee.data.email)) {
        results[index] = {
          row: rowNumber,
          email: employee.data.email,
          status: 'failed',
          error: 'This email appears more than once in the uploaded file'
        };
        return;
      }
      seenEmails.add(employee.data.email);

      try {
        const invitation = await createEmployeeInvitation(employee.data, req);
        results[index] = {
          row: rowNumber,
          ...invitation,
          status: 'invited'
        };
      } catch (error) {
        if (error.status === 409) {
          results[index] = {
            row: rowNumber,
            email: employee.data.email,
            status: 'failed',
            error: error.message
          };
          return;
        }
        console.error('Bulk employee invitation failed:', {
          requestId: req.id,
          row: rowNumber,
          message: error.message
        });
        results[index] = {
          row: rowNumber,
          email: employee.data.email,
          status: 'failed',
          error: 'Could not process this row. Please try again.'
        };
      }
    };
    let nextIndex = 0;
    const worker = async () => {
      while (nextIndex < values.employees.length) {
        const index = nextIndex;
        nextIndex += 1;
        await processRow(values.employees[index], index);
      }
    };
    await Promise.all(Array.from({ length: Math.min(5, values.employees.length) }, worker));

    const invitedCount = results.filter(result => result.status === 'invited').length;
    res.status(200).json({
      totalCount: results.length,
      invitedCount,
      failedCount: results.length - invitedCount,
      emailSentCount: results.filter(result => result.emailSent).length,
      results
    });
  } catch (error) {
    next(error);
  }
});
app.get('/api/invitations', auth, adminOnly, async (req, res) => { const { rows } = await query('SELECT id,email,first_name AS "firstName",department,job_title AS "jobTitle",employment_type AS "employmentType",hire_date::text AS "hireDate",team,manager_id AS "managerId",expires_at AS "expiresAt",accepted_at AS "acceptedAt",created_at AS "createdAt" FROM invitations WHERE company_id=$1 ORDER BY created_at DESC LIMIT 100', [req.company.id]); res.json(rows.map(i => ({ ...i, status: i.acceptedAt ? 'accepted' : (i.expiresAt < new Date() ? 'expired' : 'pending') }))); });
app.post('/api/invitations/:id/resend', auth, adminOnly, async (req, res, next) => {
  try {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const invitation = (await query(
      'UPDATE invitations SET token_hash=$1,expires_at=NOW() + INTERVAL \'7 days\' WHERE id=$2 AND company_id=$3 AND accepted_at IS NULL RETURNING id,email,first_name AS "firstName",department',
      [hashToken(rawToken), req.params.id, req.company.id]
    )).rows[0];
    if (!invitation) return res.status(404).json({ message: 'Pending invitation not found' });
    await recordAuditEvent(req.company.id, req.user.id, req, 'invitation.resent', 'invitation', invitation.id);

    let emailSent = false;
    let emailStatus = 'not_configured';
    if (config.BREVO_API_KEY && config.BREVO_SENDER_EMAIL) {
      try {
        await sendInvitationEmail({
          apiKey: config.BREVO_API_KEY,
          senderEmail: config.BREVO_SENDER_EMAIL,
          senderName: config.BREVO_SENDER_NAME,
          recipientEmail: invitation.email,
          recipientName: invitation.firstName,
          companyName: req.company.name,
          inviteUrl: `${config.CLIENT_URL}/invite/${rawToken}`
        });
        emailSent = true;
        emailStatus = 'sent';
      } catch (error) {
        emailStatus = error.code || 'failed';
        console.error('Invitation resend email failed:', {
          requestId: req.id,
          status: error.status,
          code: error.code || 'network_error',
          providerCode: error.providerCode,
          providerMessage: error.providerMessage
        });
      }
    }

    res.json({
      id: invitation.id,
      email: invitation.email,
      inviteUrl: `${config.CLIENT_URL}/invite/${rawToken}`,
      emailSent,
      emailStatus,
      expiresInDays: 7
    });
  } catch (error) {
    next(error);
  }
});
app.delete('/api/invitations/:id', auth, adminOnly, async (req, res, next) => {
  try {
    const result = await query(
      'DELETE FROM invitations WHERE id=$1 AND company_id=$2 AND accepted_at IS NULL',
      [req.params.id, req.company.id]
    );
    if (!result.rowCount) return res.status(404).json({ message: 'Pending invitation not found' });
    await recordAuditEvent(req.company.id, req.user.id, req, 'invitation.revoked', 'invitation', req.params.id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});
app.get('/api/audit-events', auth, adminOnly, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT a.id,a.actor_user_id AS "actorId",COALESCE(u.first_name,'Former user') AS "actorName",
         a.action,a.entity_type AS "entityType",a.entity_id AS "entityId",
         a.details,a.request_id AS "requestId",a.created_at AS "createdAt"
       FROM audit_events a LEFT JOIN users u ON u.id=a.actor_user_id AND u.company_id=a.company_id
       WHERE a.company_id=$1 ORDER BY a.created_at DESC,a.id DESC LIMIT 100`,
      [req.company.id]
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});
app.get('/api/leave-requests', auth, async (req, res, next) => {
  try {
    if (!['admin', 'employee'].includes(req.user.role)) return res.status(403).json({ message: 'You do not have permission to view leave requests' });
    const params = [req.company.id];
    let scope = 'l.company_id=$1';
    if (req.user.role === 'employee') {
      params.push(req.user.id);
      scope += ` AND (l.user_id=$2 OR EXISTS (
        SELECT 1 FROM users reports WHERE reports.id=l.user_id AND reports.company_id=l.company_id
          AND reports.manager_id=$2 AND reports.role='employee' AND reports.active=true
      ))`;
    }
    const { rows } = await query(
      `SELECT l.id,l.user_id AS "userId",u.first_name AS "employeeName",l.start_date::text AS "startDate",
         l.end_date::text AS "endDate",l.leave_type AS "leaveType",l.reason,l.status,
         l.review_note AS "reviewNote",l.reviewed_at AS "reviewedAt",r.first_name AS "reviewerName",
         l.created_at AS "createdAt"
       FROM leave_requests l JOIN users u ON u.id=l.user_id AND u.company_id=l.company_id
       LEFT JOIN users r ON r.id=l.reviewed_by AND r.company_id=l.company_id
       WHERE ${scope} ORDER BY CASE WHEN l.status='pending' THEN 0 ELSE 1 END,l.created_at DESC LIMIT 200`,
      params
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});
app.get('/api/leave-policies', auth, async (req, res, next) => {
  try {
    const { rows } = await query(
      'SELECT leave_type AS "leaveType",annual_allowance_days AS "annualAllowanceDays" FROM company_leave_policies WHERE company_id=$1',
      [req.company.id]
    );
    const configured = new Map(rows.map(policy => [policy.leaveType, policy.annualAllowanceDays]));
    res.json(leaveTypes.map(leaveType => ({
      leaveType,
      annualAllowanceDays: configured.has(leaveType) ? configured.get(leaveType) : null
    })));
  } catch (error) {
    next(error);
  }
});
app.put('/api/leave-policies', auth, adminOnly, async (req, res, next) => {
  try {
    const values = body(schemas.leavePolicies, req.body);
    const leaveTypeValues = values.policies.map(policy => policy.leaveType);
    const allowanceValues = values.policies.map(policy => policy.annualAllowanceDays);
    const { rows } = await query(
      `INSERT INTO company_leave_policies(company_id,leave_type,annual_allowance_days,updated_by)
       SELECT $1,policy.leave_type,policy.days,$4
       FROM unnest($2::text[],$3::int[]) AS policy(leave_type,days)
       ON CONFLICT(company_id,leave_type) DO UPDATE
       SET annual_allowance_days=EXCLUDED.annual_allowance_days,updated_by=EXCLUDED.updated_by,updated_at=NOW()
       RETURNING leave_type AS "leaveType",annual_allowance_days AS "annualAllowanceDays"`,
      [req.company.id, leaveTypeValues, allowanceValues, req.user.id]
    );
    const configured = new Map(rows.map(policy => [policy.leaveType, policy.annualAllowanceDays]));
    const policies = leaveTypes.map(leaveType => ({
      leaveType,
      annualAllowanceDays: configured.has(leaveType) ? configured.get(leaveType) : null
    }));
    await recordAuditEvent(req.company.id, req.user.id, req, 'leave.policies_updated', 'leave_policy', null, { policies });
    res.json(policies);
  } catch (error) {
    next(error);
  }
});
app.get('/api/leave-balance', auth, async (req, res, next) => {
  try {
    const year = body(z.object({
      year: z.coerce.number().int().min(2000).max(2100).default(new Date().getUTCFullYear())
    }), req.query).year;
    const policies = await query(
      'SELECT leave_type AS "leaveType",annual_allowance_days AS "annualAllowanceDays" FROM company_leave_policies WHERE company_id=$1',
      [req.company.id]
    );
    const usage = await query(
      `SELECT leave_type AS "leaveType",status,start_date::text AS "startDate",end_date::text AS "endDate"
       FROM leave_requests WHERE company_id=$1 AND user_id=$2 AND status IN ('pending','approved')
         AND start_date<=$3::date AND end_date>=$4::date`,
      [req.company.id, req.user.id, `${year}-12-31`, `${year}-01-01`]
    );
    const allowanceByType = new Map(policies.rows.map(policy => [policy.leaveType, policy.annualAllowanceDays]));
    res.json(leaveTypes.map(leaveType => {
      const byStatus = { approvedDays: 0, pendingDays: 0 };
      usage.rows.filter(item => item.leaveType === leaveType).forEach(item => {
        const days = leaveYearDays(item.startDate, item.endDate, year);
        if (item.status === 'approved') byStatus.approvedDays += days;
        if (item.status === 'pending') byStatus.pendingDays += days;
      });
      const annualAllowanceDays = allowanceByType.has(leaveType) ? allowanceByType.get(leaveType) : null;
      const remainingDays = annualAllowanceDays === null
        ? null
        : Math.max(0, annualAllowanceDays - byStatus.approvedDays - byStatus.pendingDays);
      return { leaveType, annualAllowanceDays, ...byStatus, remainingDays };
    }));
  } catch (error) {
    next(error);
  }
});
app.get('/api/leave-calendar', auth, async (req, res, next) => {
  try {
    const range = body(z.object({
      from: isoDate,
      to: isoDate
    }).refine(({ from, to }) => from <= to, {
      message: 'End date must be on or after start date',
      path: ['to']
    }).refine(({ from, to }) =>
      (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000 <= 92,
    {
      message: 'Calendar range cannot exceed 93 days',
      path: ['to']
    }), req.query);
    const { rows } = await query(
      `SELECT l.user_id AS "userId",u.first_name AS "employeeName",u.department,
         l.start_date::text AS "startDate",l.end_date::text AS "endDate"
       FROM leave_requests l JOIN users u ON u.id=l.user_id AND u.company_id=l.company_id
       WHERE l.company_id=$1 AND l.status='approved' AND u.active=true
         AND l.start_date<=$3::date AND l.end_date>=$2::date
       ORDER BY l.start_date,u.first_name`,
      [req.company.id, range.from, range.to]
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});
app.post('/api/leave-requests', auth, async (req, res, next) => {
  let client;
  let transactionOpen = false;
  try {
    if (req.user.role !== 'employee') return res.status(403).json({ message: 'Only employees can submit leave requests' });
    const values = body(z.object({
      startDate: isoDate,
      endDate: isoDate,
      leaveType: z.enum(['vacation', 'sick', 'personal', 'other']),
      reason: z.string().trim().min(2).max(500)
    }).refine(request => request.startDate <= request.endDate, {
      message: 'End date must be on or after start date',
      path: ['endDate']
    }).refine(request => (Date.parse(`${request.endDate}T00:00:00Z`) - Date.parse(`${request.startDate}T00:00:00Z`)) / 86400000 < 90, {
      message: 'A leave request cannot exceed 90 calendar days',
      path: ['endDate']
    }), req.body);
    const firstYear = Number(values.startDate.slice(0, 4));
    const lastYear = Number(values.endDate.slice(0, 4));
    client = await pool.connect();
    await client.query('BEGIN');
    transactionOpen = true;
    await client.query('SELECT id FROM users WHERE id=$1 AND company_id=$2 FOR UPDATE', [req.user.id, req.company.id]);
    const conflict = await client.query(
      `SELECT id FROM leave_requests
       WHERE company_id=$1 AND user_id=$2 AND status IN ('pending','approved')
         AND daterange(start_date,end_date,'[]') && daterange($3::date,$4::date,'[]')
       LIMIT 1`,
      [req.company.id, req.user.id, values.startDate, values.endDate]
    );
    if (conflict.rowCount) {
      await client.query('ROLLBACK');
      transactionOpen = false;
      return res.status(409).json({ message: 'This request overlaps an existing pending or approved leave request' });
    }
    const [policyResult, usageResult] = await Promise.all([
      client.query(
        'SELECT annual_allowance_days AS "annualAllowanceDays" FROM company_leave_policies WHERE company_id=$1 AND leave_type=$2',
        [req.company.id, values.leaveType]
      ),
      client.query(
        `SELECT start_date::text AS "startDate",end_date::text AS "endDate"
         FROM leave_requests WHERE company_id=$1 AND user_id=$2 AND leave_type=$3
           AND status IN ('pending','approved') AND start_date<=$5::date AND end_date>=$4::date`,
        [req.company.id, req.user.id, values.leaveType, `${firstYear}-01-01`, `${lastYear}-12-31`]
      )
    ]);
    const allowance = policyResult.rows[0]?.annualAllowanceDays ?? null;
    if (allowance !== null) {
      for (let year = firstYear; year <= lastYear; year += 1) {
        const requestedDays = leaveYearDays(values.startDate, values.endDate, year);
        const existingDays = usageResult.rows.reduce(
          (total, leave) => total + leaveYearDays(leave.startDate, leave.endDate, year),
          0
        );
        if (existingDays + requestedDays > allowance) {
          await client.query('ROLLBACK');
          transactionOpen = false;
          return res.status(409).json({
            message: `This request exceeds the ${year} annual ${values.leaveType} leave allowance (${allowance} calendar days)`
          });
        }
      }
    }
    const leave = (await client.query(
      `INSERT INTO leave_requests(company_id,user_id,start_date,end_date,leave_type,reason)
       VALUES($1,$2,$3,$4,$5,$6)
       RETURNING id,user_id AS "userId",start_date::text AS "startDate",end_date::text AS "endDate",
         leave_type AS "leaveType",reason,status,created_at AS "createdAt"`,
      [req.company.id, req.user.id, values.startDate, values.endDate, values.leaveType, values.reason]
    )).rows[0];
    await client.query('COMMIT');
    transactionOpen = false;
    await recordAuditEvent(req.company.id, req.user.id, req, 'leave.requested', 'leave_request', leave.id, {
      startDate: leave.startDate,
      endDate: leave.endDate,
      leaveType: leave.leaveType
    });
    const emailStatus = await emailLeaveRequest(leave, req.user.firstName, req);
    res.status(201).json({ ...leave, employeeName: req.user.firstName, emailStatus });
  } catch (error) {
    if (transactionOpen) await client.query('ROLLBACK');
    next(error);
  } finally {
    client?.release();
  }
});
app.patch('/api/leave-requests/:id/review', auth, async (req, res, next) => {
  try {
    if (!['admin', 'employee'].includes(req.user.role)) return res.status(403).json({ message: 'You do not have permission to review leave requests' });
    const values = body(z.object({
      status: z.enum(['approved', 'rejected']),
      reviewNote: z.string().trim().max(500).optional().default('')
    }), req.body);
    const leave = (await query(
      `UPDATE leave_requests SET status=$1,review_note=$2,reviewed_by=$3,reviewed_at=NOW(),updated_at=NOW()
       WHERE id=$4 AND company_id=$5 AND status='pending'
         AND ($6::int IS NULL OR EXISTS (
           SELECT 1 FROM users reports WHERE reports.id=leave_requests.user_id AND reports.company_id=$5
             AND reports.manager_id=$6 AND reports.role='employee' AND reports.active=true
         ))
       RETURNING id,user_id AS "userId",start_date::text AS "startDate",end_date::text AS "endDate",
         leave_type AS "leaveType",reason,status,review_note AS "reviewNote",reviewed_at AS "reviewedAt"`,
      [values.status, values.reviewNote, req.user.id, req.params.id, req.company.id, req.user.role === 'admin' ? null : req.user.id]
    )).rows[0];
    if (!leave) return res.status(404).json({ message: 'Pending leave request not found' });
    await recordAuditEvent(req.company.id, req.user.id, req, `leave.${values.status}`, 'leave_request', leave.id, {
      employeeId: leave.userId
    });
    const emailStatus = values.status === 'approved' ? await emailLeaveApproval(leave, req) : 'not_applicable';
    res.json({ ...leave, emailStatus });
  } catch (error) {
    next(error);
  }
});
app.delete('/api/leave-requests/:id', auth, async (req, res, next) => {
  try {
    if (req.user.role !== 'employee') return res.status(403).json({ message: 'Only employees can cancel leave requests' });
    const leave = (await query(
      `UPDATE leave_requests SET status='cancelled',updated_at=NOW()
       WHERE id=$1 AND company_id=$2 AND user_id=$3 AND status='pending'
       RETURNING id`,
      [req.params.id, req.company.id, req.user.id]
    )).rows[0];
    if (!leave) return res.status(404).json({ message: 'Pending leave request not found' });
    await recordAuditEvent(req.company.id, req.user.id, req, 'leave.cancelled', 'leave_request', leave.id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});
app.get('/api/invitations/:token', async (req, res) => {
  const { rows } = await query(
    `SELECT i.first_name AS "firstName",i.email,i.department,i.job_title AS "jobTitle",
       i.employment_type AS "employmentType",i.hire_date::text AS "hireDate",i.team,
       i.manager_id AS "managerId",c.name,c.slug
     FROM invitations i JOIN companies c ON c.id=i.company_id
     WHERE i.token_hash=$1 AND i.accepted_at IS NULL AND i.expires_at > NOW()`,
    [hashToken(req.params.token)]
  );
  const invitation = rows[0];
  if (!invitation) return res.status(404).json({ message: 'Invitation is invalid or expired' });
  res.json({
    firstName: invitation.firstName,
    email: invitation.email,
    department: invitation.department,
    jobTitle: invitation.jobTitle || '',
    employmentType: invitation.employmentType || 'unspecified',
    hireDate: invitation.hireDate || null,
    team: invitation.team || 'General',
    managerId: invitation.managerId || null,
    company: { name: invitation.name, slug: invitation.slug }
  });
});
app.post('/api/invitations/:token/accept', async (req, res, next) => {
  let values;
  try {
    values = body(z.object({ password }).strict(), req.body);
  } catch (error) {
    return next(error);
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const invitation = (await client.query(
      'SELECT * FROM invitations WHERE token_hash=$1 AND accepted_at IS NULL AND expires_at > NOW() FOR UPDATE',
      [hashToken(req.params.token)]
    )).rows[0];
    if (!invitation) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Invitation is invalid or expired' });
    }
    if (await findUser(invitation.email)) {
      await client.query('ROLLBACK');
      return res.status(409).json({ message: 'An account with this email already exists' });
    }
    const company = (await client.query(
      'SELECT id,name,slug,industry,size,active FROM companies WHERE id=$1',
      [invitation.company_id]
    )).rows[0];
    if (!company?.active) {
      await client.query('ROLLBACK');
      return res.status(403).json({ message: 'This company workspace is currently inactive' });
    }
    const user = (await client.query(
      `INSERT INTO users(company_id,first_name,email,password_hash,role,department,job_title,employment_type,hire_date,team,manager_id)
       VALUES($1,$2,$3,$4,'employee',$5,$6,$7,$8,$9,$10) RETURNING ${userFields}`,
      [
        company.id,
        invitation.first_name,
        invitation.email,
        await bcrypt.hash(values.password, 12),
        invitation.department,
        invitation.job_title || '',
        invitation.employment_type || 'unspecified',
        invitation.hire_date || null,
        invitation.team || 'General',
        invitation.manager_id || null
      ]
    )).rows[0];
    await client.query('UPDATE invitations SET accepted_at=NOW() WHERE id=$1', [invitation.id]);
    await client.query('COMMIT');
    await recordAuditEvent(company.id, user.id, req, 'invitation.accepted', 'invitation', invitation.id);
    res.status(201).json({
      token: sign(user),
      user: { ...safeUser(user), companyName: company.name },
      company: companyDto(company)
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ message: 'Could not accept invitation' });
  } finally {
    client.release();
  }
});

app.get('/api/notifications', auth, async (req, res, next) => {
  try {
    await syncDeadlineNotifications(req.user);
    res.json(await loadNotifications(req.user.id));
  } catch (error) {
    next(error);
  }
});
app.get('/api/notifications/stream', auth, async (req, res, next) => {
  let initialState;
  let previousWorkspaceVersion;
  try {
    await syncDeadlineNotifications(req.user);
    initialState = await loadNotifications(req.user.id);
    previousWorkspaceVersion = (await query(
      'SELECT updated_at::text AS version FROM workspace_activity WHERE company_id=$1',
      [req.user.companyId]
    )).rows[0]?.version;
  } catch (error) {
    return next(error);
  }

  res.status(200);
  res.set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.flushHeaders();
  res.write(`event: notifications\ndata: ${JSON.stringify(initialState)}\n\n`);

  let previousState = JSON.stringify(initialState);
  let polling = false;
  const poll = async () => {
    if (polling || res.writableEnded) return;
    polling = true;
    try {
      await syncDeadlineNotifications(req.user);
      const state = await loadNotifications(req.user.id);
      const serialized = JSON.stringify(state);
      if (serialized !== previousState) {
        res.write(`event: notifications\ndata: ${serialized}\n\n`);
        previousState = serialized;
      }
      const workspaceVersion = (await query(
        'SELECT updated_at::text AS version FROM workspace_activity WHERE company_id=$1',
        [req.user.companyId]
      )).rows[0]?.version;
      if (workspaceVersion && workspaceVersion !== previousWorkspaceVersion) {
        res.write('event: workspace\ndata: {}\n\n');
        previousWorkspaceVersion = workspaceVersion;
      }
    } catch (error) {
      console.error('Notification stream poll failed:', { requestId: req.id, message: error.message });
      previousState = null;
      if (!res.writableEnded) res.write('event: stream-error\ndata: {"message":"Live notifications are reconnecting."}\n\n');
    } finally {
      polling = false;
    }
  };
  const pollTimer = setInterval(poll, 3000);
  const heartbeatTimer = setInterval(() => {
    if (!res.writableEnded) res.write(': keep-alive\n\n');
  }, 15_000);
  const closeStream = () => {
    clearInterval(pollTimer);
    clearInterval(heartbeatTimer);
  };
  req.on('aborted', closeStream);
  res.on('close', closeStream);
});
app.patch('/api/notifications/:id/read', auth, async (req, res, next) => {
  try {
    const notification = (await query(
      'UPDATE notifications SET read_at=COALESCE(read_at,NOW()) WHERE id=$1 AND user_id=$2 RETURNING id,read_at AS "readAt"',
      [req.params.id, req.user.id]
    )).rows[0];
    if (!notification) return res.status(404).json({ message: 'Notification not found' });
    res.json(notification);
  } catch (error) {
    next(error);
  }
});
app.patch('/api/notifications/read-all', auth, async (req, res, next) => {
  try {
    await query('UPDATE notifications SET read_at=NOW() WHERE user_id=$1 AND read_at IS NULL', [req.user.id]);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});
app.get('/api/tasks', auth, async (req, res, next) => {
  try {
    const params = [req.company.id];
    const clauses = ['company_id=$1'];
    if (req.user.role === 'employee') {
      params.push(req.user.id);
      clauses.push(`assigned_to=$${params.length}`, 'archived_at IS NULL');
    } else if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'You do not have permission to view tasks' });
    }
    const queryValues = body(z.object({
      q: z.string().trim().max(120).optional(),
      status: z.enum(['new', 'active', 'completed', 'failed']).optional(),
      priority: z.enum(['low', 'medium', 'high']).optional(),
      assignee: z.coerce.number().int().positive().optional(),
      category: z.string().trim().max(80).optional(),
      dueBefore: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      dueAfter: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      includeArchived: z.enum(['true', 'false']).optional()
    }), req.query);
    if (queryValues.includeArchived === 'true' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can view archived tasks' });
    }
    if (queryValues.includeArchived !== 'true') clauses.push('archived_at IS NULL');
    for (const [field, column] of [['status', 'status'], ['priority', 'priority'], ['assignee', 'assigned_to'], ['category', 'category'], ['dueBefore', 'task_date'], ['dueAfter', 'task_date']]) {
      const value = queryValues[field];
      if (value === undefined) continue;
      params.push(field === 'category' ? `%${value}%` : value);
      const operator = field === 'dueBefore' ? '<=' : field === 'dueAfter' ? '>=' : '=';
      clauses.push(field === 'category' ? `${column} ILIKE $${params.length}` : `${column} ${operator} $${params.length}`);
    }
    if (queryValues.q) {
      params.push(`%${queryValues.q}%`);
      clauses.push(`(task_title ILIKE $${params.length} OR task_description ILIKE $${params.length} OR category ILIKE $${params.length})`);
    }
    const { rows } = await query(
      `SELECT ${taskFields} FROM tasks WHERE ${clauses.join(' AND ')} ORDER BY task_date ASC, created_at DESC LIMIT 200`,
      params
    );
    res.json(rows.map(serializeTask));
  } catch (error) {
    next(error);
  }
});
app.post('/api/tasks', auth, adminOnly, async (req, res, next) => {
  try {
    const values = body(schemas.task, req.body);
    const employee = (await query(
      `SELECT id,first_name AS "firstName",email FROM users WHERE id=$1 AND company_id=$2 AND role='employee' AND active=true`,
      [values.assignedTo, req.company.id]
    )).rows[0];
    if (!employee) return res.status(400).json({ message: 'Choose an active employee in this workspace' });
    const task = (await query(
      `INSERT INTO tasks(company_id,task_title,task_description,task_date,category,assigned_to,created_by,priority)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING ${taskFields}`,
      [req.company.id, values.taskTitle, values.taskDescription, values.taskDate, values.category, values.assignedTo, req.user.id, values.priority]
    )).rows[0];
    await recordAuditEvent(req.company.id, req.user.id, req, 'task.created', 'task', task.id, {
      assigneeId: task.assignedTo,
      priority: task.priority
    });
    try {
      await notifyUser(values.assignedTo, task.id, req.user.id, 'assigned', `New task assigned: ${task.taskTitle}`, `assigned:${task.id}:${values.assignedTo}`);
    } catch (error) {
      console.error('Task assignment notification failed:', {
        requestId: req.id,
        taskId: task.id,
        message: error.message
      });
    }
    const email = await emailTaskAssignment(task, employee, req.user.firstName, req);
    void notifySlackTaskAssigned(task, employee, req);
    res.status(201).json({ ...serializeTask(task), ...email });
  } catch (error) {
    next(error);
  }
});
app.patch('/api/tasks/:id', auth, adminOnly, async (req, res, next) => {
  try {
    const values = body(schemas.task, req.body);
    const employee = (await query(
      `SELECT id,first_name AS "firstName",email FROM users WHERE id=$1 AND company_id=$2 AND role='employee' AND active=true`,
      [values.assignedTo, req.company.id]
    )).rows[0];
    if (!employee) return res.status(400).json({ message: 'Choose an active employee in this workspace' });
    const previous = (await query(
      'SELECT assigned_to AS "assignedTo",task_date AS "taskDate" FROM tasks WHERE id=$1 AND company_id=$2 AND archived_at IS NULL',
      [req.params.id, req.company.id]
    )).rows[0];
    if (!previous) return res.status(404).json({ message: 'Task not found or archived' });
    const previousTaskDate = previous.taskDate;
    const task = (await query(
      `UPDATE tasks SET task_title=$1,task_description=$2,task_date=$3,category=$4,assigned_to=$5,priority=$6,updated_at=NOW()
       WHERE id=$7 AND company_id=$8 AND archived_at IS NULL RETURNING ${taskFields}`,
      [values.taskTitle, values.taskDescription, values.taskDate, values.category, values.assignedTo, values.priority, req.params.id, req.company.id]
    )).rows[0];
    if (!task) return res.status(404).json({ message: 'Task not found or archived' });
    await recordAuditEvent(req.company.id, req.user.id, req, 'task.updated', 'task', task.id, {
      assigneeChanged: previous.assignedTo !== task.assignedTo,
      dueDateChanged: previousTaskDate !== task.taskDate
    });
    const response = { ...serializeTask(task) };
    if (previous.assignedTo !== task.assignedTo) {
      try {
        await Promise.all([
          notifyUser(task.assignedTo, task.id, req.user.id, 'assigned', `Task assigned to you: ${task.taskTitle}`, `assigned:${task.id}:${task.assignedTo}:${crypto.randomUUID()}`),
          notifyUser(previous.assignedTo, task.id, req.user.id, 'assigned', `Task reassigned: ${task.taskTitle}`, `reassigned:${task.id}:${previous.assignedTo}:${crypto.randomUUID()}`)
        ]);
      } catch (error) {
        console.error('Task reassignment notification failed:', { requestId: req.id, taskId: task.id, message: error.message });
      }
      Object.assign(response, await emailTaskAssignment(task, employee, req.user.firstName, req));
      void notifySlackTaskAssigned(task, employee, req);
    }
    if (previousTaskDate !== task.taskDate) {
      const emailStatus = await emailTaskUpdate(
        task,
        [task.assignedTo, task.createdBy],
        req.user.id,
        req.user.firstName,
        'due_date',
        task.taskDate,
        req
      );
      if (response.emailStatus) response.dueDateEmailStatus = emailStatus;
      else response.emailStatus = emailStatus;
    }
    res.json(response);
  } catch (error) {
    next(error);
  }
});
app.patch('/api/tasks/:id/archive', auth, adminOnly, async (req, res, next) => {
  try {
    const { archived } = body(z.object({ archived: z.boolean() }), req.body);
    const task = (await query(
      `UPDATE tasks SET archived_at=${archived ? 'NOW()' : 'NULL'},updated_at=NOW()
       WHERE id=$1 AND company_id=$2 RETURNING ${taskFields}`,
      [req.params.id, req.company.id]
    )).rows[0];
    if (!task) return res.status(404).json({ message: 'Task not found' });
    await recordAuditEvent(req.company.id, req.user.id, req, archived ? 'task.archived' : 'task.restored', 'task', task.id);
    res.json(serializeTask(task));
  } catch (error) {
    next(error);
  }
});
app.post('/api/tasks/bulk', auth, adminOnly, async (req, res, next) => {
  try {
    const values = body(z.object({
      taskIds: z.array(z.coerce.number().int().positive()).min(1).max(100),
      action: z.enum(['archive', 'restore', 'priority']),
      priority: z.enum(['low', 'medium', 'high']).optional()
    }).refine(value => value.action !== 'priority' || value.priority !== undefined, {
      message: 'Priority is required for the priority action',
      path: ['priority']
    }), req.body);
    const taskIds = [...new Set(values.taskIds)];
    let updated;
    if (values.action === 'priority') {
      updated = await query(
        `UPDATE tasks SET priority=$2,updated_at=NOW()
         WHERE id=ANY($1::int[]) AND company_id=$3 AND archived_at IS NULL RETURNING id`,
        [taskIds, values.priority, req.company.id]
      );
    } else {
      updated = await query(
        `UPDATE tasks SET archived_at=${values.action === 'archive' ? 'NOW()' : 'NULL'},updated_at=NOW()
         WHERE id=ANY($1::int[]) AND company_id=$2 AND archived_at IS ${values.action === 'archive' ? 'NULL' : 'NOT NULL'} RETURNING id`,
        [taskIds, req.company.id]
      );
    }
    const updatedIds = updated.rows.map(task => task.id);
    await recordAuditEvent(req.company.id, req.user.id, req, `task.bulk_${values.action}`, 'task', null, {
      updatedCount: updatedIds.length,
      skippedCount: taskIds.length - updatedIds.length,
      priority: values.action === 'priority' ? values.priority : undefined
    });
    res.json({
      requestedCount: taskIds.length,
      updatedCount: updatedIds.length,
      skippedCount: taskIds.length - updatedIds.length,
      updatedIds
    });
  } catch (error) {
    next(error);
  }
});
app.patch('/api/tasks/:id/status', auth, async (req, res, next) => {
  try {
    const { status } = body(z.object({ status: z.enum(['active', 'completed', 'failed']) }), req.body);
    const task = (await query(`SELECT ${taskFields} FROM tasks WHERE id=$1 AND company_id=$2 AND archived_at IS NULL`, [req.params.id, req.company.id])).rows[0];
    if (!task) return res.status(404).json({ message: 'Task not found' });
    if (req.user.role !== 'admin' && task.assignedTo !== req.user.id) return res.status(403).json({ message: 'You cannot modify this task' });
    if (!((task.status === 'new' && status === 'active') || (task.status === 'active' && ['completed', 'failed'].includes(status)))) {
      return res.status(409).json({ message: `Cannot change task from "${task.status}" to "${status}"` });
    }
    const updated = (await query(`UPDATE tasks SET status=$1,updated_at=NOW() WHERE id=$2 AND company_id=$3 RETURNING ${taskFields}`, [status, task.id, req.company.id])).rows[0];
    await recordAuditEvent(req.company.id, req.user.id, req, 'task.status_changed', 'task', task.id, {
      previousStatus: task.status,
      status
    });
    const notifyId = req.user.id === task.createdBy ? task.assignedTo : task.createdBy;
    if (notifyId !== req.user.id) {
      try {
        await notifyUser(notifyId, task.id, req.user.id, 'status', `${req.user.firstName} marked "${task.taskTitle}" ${status}`, `status:${task.id}:${crypto.randomUUID()}`);
      } catch (error) {
        console.error('Task status notification failed:', { requestId: req.id, taskId: task.id, message: error.message });
      }
    }
    const emailStatus = await emailTaskUpdate(
      updated,
      [task.assignedTo, task.createdBy],
      req.user.id,
      req.user.firstName,
      'status',
      status,
      req
    );
    res.json({ ...serializeTask(updated), emailStatus });
  } catch (error) {
    next(error);
  }
});
app.get('/api/tasks/:id/comments', auth, async (req, res, next) => {
  try {
    const task = (await query(
      `SELECT id,assigned_to AS "assignedTo",created_by AS "createdBy" FROM tasks WHERE id=$1 AND company_id=$2 AND archived_at IS NULL`,
      [req.params.id, req.company.id]
    )).rows[0];
    if (!task) return res.status(404).json({ message: 'Task not found' });
    if (req.user.role !== 'admin' && task.assignedTo !== req.user.id) return res.status(403).json({ message: 'You cannot view this task' });
    const { rows } = await query(
      `SELECT c.id,c.content,c.created_at AS "createdAt",u.id AS "userId",u.first_name AS "firstName"
       FROM task_comments c JOIN users u ON u.id=c.user_id WHERE c.task_id=$1 AND c.company_id=$2 ORDER BY c.created_at`,
      [task.id, req.company.id]
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});
app.post('/api/tasks/:id/comments', auth, async (req, res, next) => {
  try {
    const { content } = body(z.object({ content: z.string().trim().min(1).max(2000) }), req.body);
    const task = (await query(
      `SELECT id,task_title AS "taskTitle",assigned_to AS "assignedTo",created_by AS "createdBy" FROM tasks WHERE id=$1 AND company_id=$2 AND archived_at IS NULL`,
      [req.params.id, req.company.id]
    )).rows[0];
    if (!task) return res.status(404).json({ message: 'Task not found' });
    if (req.user.role !== 'admin' && task.assignedTo !== req.user.id) return res.status(403).json({ message: 'You cannot comment on this task' });
    const comment = (await query(
      `INSERT INTO task_comments(task_id,company_id,user_id,content) VALUES($1,$2,$3,$4)
       RETURNING id,content,created_at AS "createdAt"`,
      [task.id, req.company.id, req.user.id, content]
    )).rows[0];
    await recordAuditEvent(req.company.id, req.user.id, req, 'task.comment_added', 'task', task.id, {
      commentId: comment.id
    });
    const notifyTargets = new Set([task.assignedTo, task.createdBy]);
    notifyTargets.delete(req.user.id);
    try {
      await Promise.all([...notifyTargets].map(userId => notifyUser(
        userId,
        task.id,
        req.user.id,
        'comment',
        `${req.user.firstName} commented on "${task.taskTitle}"`,
        `comment:${comment.id}:${userId}`
      )));
    } catch (error) {
      console.error('Task comment notification failed:', { requestId: req.id, taskId: task.id, message: error.message });
    }
    const emailStatus = await emailTaskUpdate(
      task,
      [task.assignedTo, task.createdBy],
      req.user.id,
      req.user.firstName,
      'comment',
      content.slice(0, 500),
      req
    );
    res.status(201).json({ ...comment, userId: req.user.id, firstName: req.user.firstName, emailStatus });
  } catch (error) {
    next(error);
  }
});
app.get('/api/reports/tasks', auth, adminOnly, async (req, res, next) => {
  try {
    const values = body(z.object({
      from: isoDate,
      to: isoDate
    }).refine(range => range.from <= range.to, {
      message: 'Start date must be on or before end date',
      path: ['from']
    }), req.query);
    const params = [req.company.id, values.from, values.to];
    const dateScope = 't.company_id=$1 AND t.archived_at IS NULL AND t.created_at >= $2::date AND t.created_at < ($3::date + INTERVAL \'1 day\')';
    const [summary, statuses, priorities, categories, assignees] = await Promise.all([
      query(
        `SELECT COUNT(*)::int AS "totalTasks",
           COUNT(*) FILTER (WHERE t.status='new')::int AS "newTasks",
           COUNT(*) FILTER (WHERE t.status='active')::int AS "activeTasks",
           COUNT(*) FILTER (WHERE t.status='completed')::int AS "completedTasks",
           COUNT(*) FILTER (WHERE t.status='failed')::int AS "failedTasks",
           COUNT(*) FILTER (WHERE t.status IN ('new','active') AND t.task_date<CURRENT_DATE::text)::int AS "overdueTasks"
         FROM tasks t WHERE ${dateScope}`,
        params
      ),
      query(
        `SELECT t.status,COUNT(*)::int AS count FROM tasks t WHERE ${dateScope} GROUP BY t.status`,
        params
      ),
      query(
        `SELECT t.priority,COUNT(*)::int AS count FROM tasks t WHERE ${dateScope} GROUP BY t.priority`,
        params
      ),
      query(
        `SELECT t.category,COUNT(*)::int AS count FROM tasks t WHERE ${dateScope} GROUP BY t.category ORDER BY count DESC,t.category ASC LIMIT 10`,
        params
      ),
      query(
        `SELECT t.assigned_to AS "assigneeId",COALESCE(u.first_name,'Former employee') AS "assigneeName",
           COALESCE(u.active,false) AS active,COUNT(*)::int AS "totalTasks",
           COUNT(*) FILTER (WHERE t.status='completed')::int AS "completedTasks",
           COUNT(*) FILTER (WHERE t.status IN ('new','active') AND t.task_date<CURRENT_DATE::text)::int AS "overdueTasks"
         FROM tasks t LEFT JOIN users u ON u.id=t.assigned_to AND u.company_id=t.company_id
         WHERE ${dateScope} GROUP BY t.assigned_to,u.first_name,u.active ORDER BY "totalTasks" DESC,"assigneeName" ASC`,
        params
      )
    ]);
    res.json({
      range: values,
      summary: summary.rows[0],
      statusBreakdown: statuses.rows,
      priorityBreakdown: priorities.rows,
      categoryBreakdown: categories.rows,
      assigneeBreakdown: assignees.rows
    });
  } catch (error) {
    next(error);
  }
});
app.get('/api/dashboard/admin', auth, adminOnly, async (req, res) => { const [employees, tasks] = await Promise.all([query("SELECT COUNT(*)::int AS count FROM users WHERE company_id=$1 AND role='employee' AND active=true", [req.company.id]), query(`SELECT ${taskFields} FROM tasks WHERE company_id=$1 AND archived_at IS NULL`, [req.company.id])]); const list = tasks.rows; res.json({ company: { name: req.company.name, slug: req.company.slug }, employees: employees.rows[0].count, totalTasks: list.length, newTasks: counts(list).newTask, activeTasks: counts(list).active, completedTasks: counts(list).completed, failedTasks: counts(list).failed }); });
app.get('/api/dashboard/employee', auth, async (req, res) => { if (req.user.role !== 'employee') return res.status(403).json({ message: 'Employee dashboard is only available to employees' }); const { rows } = await query(`SELECT ${taskFields} FROM tasks WHERE company_id=$1 AND assigned_to=$2 AND archived_at IS NULL ORDER BY created_at DESC`, [req.company.id, req.user.id]); res.json({ user: safeUser(req.user), company: { name: req.company.name, slug: req.company.slug }, tasks: rows.map(serializeTask), taskCounts: counts(rows) }); });

app.use((req, res) => res.status(404).json({ message: 'Route not found', requestId: req.id }));
app.use((error, req, res, _next) => { console.error('Request failed:', { requestId: req.id, method: req.method, path: req.path, message: error.message }); const status = Number.isInteger(error.status) ? error.status : 500; res.status(status).json({ message: status >= 500 ? 'An unexpected error occurred' : error.message, requestId: req.id }); });

const shutdown = signal => { console.log(`${signal} received; closing PostgreSQL pool.`); pool.end().finally(() => process.exit(0)); };

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
  initialiseDatabase()
    .then(() => app.listen(config.PORT, () => console.log(`EMS API running on port ${config.PORT} (${config.NODE_ENV})`)))
    .catch(error => {
      console.error('PostgreSQL connection failed:', error.message);
      process.exit(1);
    });
}

export { app };

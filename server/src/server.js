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
import { sendInvitationEmail, sendPasswordResetEmail, sendTaskAssignedEmail } from './email.js';

const app = express();
if (config.TRUST_PROXY) app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use((req, res, next) => { req.id = crypto.randomUUID(); res.setHeader('X-Request-Id', req.id); next(); });
app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));
app.use(cors({ origin(origin, callback) { if (!origin || allowedOrigins.has(origin)) return callback(null, true); return callback(new Error('Origin not allowed by CORS')); }, methods: ['GET', 'POST', 'PATCH', 'DELETE'], allowedHeaders: ['Authorization', 'Content-Type'], maxAge: 86400 }));
app.use(express.json({ limit: '1mb' }));
const skipRateLimitForTests = () => config.NODE_ENV === 'test';
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: 'draft-7', legacyHeaders: false, skip: skipRateLimitForTests, message: { message: 'Too many requests. Please try again later.' } }));
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false, skip: skipRateLimitForTests, message: { message: 'Too many attempts. Please try again later.' } });
const onboardingLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: 'draft-7', legacyHeaders: false, skip: skipRateLimitForTests, message: { message: 'Too many account requests. Please try again later.' } });
const resetLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: 'draft-7', legacyHeaders: false, skip: skipRateLimitForTests, message: { message: 'Too many password reset requests. Please try again later.' } });
const userFields = 'id, company_id AS "companyId", first_name AS "firstName", email, role, department, active';
const taskFields = 'id, company_id AS "companyId", task_title AS "taskTitle", task_description AS "taskDescription", task_date AS "taskDate", category, priority, status, assigned_to AS "assignedTo", created_by AS "createdBy", archived_at AS "archivedAt", created_at AS "createdAt", updated_at AS "updatedAt"';
const safeUser = u => ({ id: u.id, companyId: u.companyId, firstName: u.firstName, email: u.email, role: u.role, department: u.department, active: u.active });
const serializeTask = t => ({ id: t.id, companyId: t.companyId, taskTitle: t.taskTitle, taskDescription: t.taskDescription, taskDate: t.taskDate, category: t.category, priority: t.priority, active: t.status === 'active', newTask: t.status === 'new', completed: t.status === 'completed', failed: t.status === 'failed', overdue: !t.archivedAt && !['completed', 'failed'].includes(t.status) && t.taskDate < new Date().toISOString().slice(0, 10), archived: Boolean(t.archivedAt), assignedTo: t.assignedTo, createdBy: t.createdBy, createdAt: t.createdAt, updatedAt: t.updatedAt });
const counts = tasks => ({ newTask: tasks.filter(t => t.status === 'new').length, active: tasks.filter(t => t.status === 'active').length, completed: tasks.filter(t => t.status === 'completed').length, failed: tasks.filter(t => t.status === 'failed').length });
const slugify = value => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
const hashToken = token => crypto.createHash('sha256').update(token).digest('hex');
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
const schemas = {
  login: z.object({ email, password: z.string().min(1).max(128) }),
  register: z.object({ companyName: z.string().trim().min(2).max(120), industry: z.string().trim().min(2).max(80).default('General'), size: z.enum(['1-10', '11-50', '51-200', '201-500', '500+']).default('1-10'), firstName: z.string().trim().min(2).max(80), email, password }),
  employee: z.object({ firstName: z.string().trim().min(2).max(80), email, password, department: z.string().trim().min(2).max(80).default('General') }),
  invitation: z.object({ firstName: z.string().trim().min(2).max(80), email, department: z.string().trim().min(2).max(80).default('General') }),
  task: z.object({ taskTitle: z.string().trim().min(2).max(160), taskDescription: z.string().trim().min(2).max(4_000), taskDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Task date must be YYYY-MM-DD').refine(value => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value, 'Task date is invalid'), category: z.string().trim().min(2).max(80), assignedTo: z.coerce.number().int().positive(), priority: z.enum(['low', 'medium', 'high']).default('medium') })
};
const body = (schema, value) => { const result = schema.safeParse(value); if (!result.success) { const error = new Error(result.error.issues[0].message); error.status = 400; throw error; } return result.data; };
app.get('/api/health/live', (req, res) => res.json({ status: 'ok' }));
app.get('/api/health', async (req, res) => { try { await query('SELECT 1'); res.json({ status: 'ok', database: true }); } catch { res.status(503).json({ status: 'error', database: false }); } });

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

app.post('/api/auth/login', authLimiter, async (req, res, next) => { try { const values = body(schemas.login, req.body); const user = await findUser(values.email); if (!user || !user.active || !(await bcrypt.compare(values.password, user.passwordHash))) return res.status(401).json({ message: 'Invalid email or password' }); const company = (await query('SELECT id,name,slug,industry,size,active FROM companies WHERE id=$1', [user.companyId])).rows[0]; if (!company?.active) return res.status(403).json({ message: 'Your company workspace is inactive' }); res.json({ token: sign(user), user: { ...safeUser(user), companyName: company.name }, company: companyDto(company) }); } catch (error) { next(error); } });
app.get('/api/auth/me', auth, (req, res) => res.json({ user: safeUser(req.user), company: companyDto(req.company) }));
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
      'SELECT id,user_id FROM password_resets WHERE token_hash=$1 AND used_at IS NULL AND expires_at>NOW() FOR UPDATE',
      [hashToken(values.token)]
    )).rows[0];
    if (!reset) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'This password reset link is invalid or expired. Request a new one.' });
    }
    await client.query('UPDATE users SET password_hash=$1,updated_at=NOW() WHERE id=$2', [await bcrypt.hash(values.password, 12), reset.user_id]);
    await client.query('UPDATE password_resets SET used_at=NOW() WHERE user_id=$1 AND used_at IS NULL', [reset.user_id]);
    await client.query('COMMIT');
    res.json({ message: 'Password updated. You can now sign in.' });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});
app.get('/api/company/me', auth, (req, res) => res.json(companyDto(req.company)));

app.get('/api/employees', auth, adminOnly, async (req, res) => { const users = (await query(`SELECT ${userFields} FROM users WHERE company_id=$1 AND role='employee' ORDER BY active DESC, first_name`, [req.company.id])).rows; const tasks = (await query(`SELECT ${taskFields} FROM tasks WHERE company_id=$1 AND archived_at IS NULL`, [req.company.id])).rows; res.json(users.map(u => { const own = tasks.filter(t => t.assignedTo === u.id); return { ...safeUser(u), tasks: own.map(serializeTask), taskCounts: counts(own) }; })); });
app.post('/api/employees', auth, adminOnly, async (req, res, next) => { try { const values = body(schemas.employee, req.body); if (await findUser(values.email)) return res.status(409).json({ message: 'This email is already registered' }); const passwordHash = await bcrypt.hash(values.password, 12); const user = (await query(`INSERT INTO users(company_id,first_name,email,password_hash,role,department) VALUES($1,$2,$3,$4,'employee',$5) RETURNING ${userFields}`, [req.company.id, values.firstName, values.email, passwordHash, values.department])).rows[0]; res.status(201).json(safeUser(user)); } catch (error) { next(error); } });
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
    res.json(safeUser(employee));
  } catch (error) {
    next(error);
  }
});
app.patch('/api/employees/:id', auth, adminOnly, async (req, res, next) => {
  try {
    const values = body(z.object({
      firstName: z.string().trim().min(2).max(80),
      department: z.string().trim().min(2).max(80)
    }), req.body);
    const employee = (await query(
      `UPDATE users SET first_name=$1,department=$2,updated_at=NOW() WHERE id=$3 AND company_id=$4 AND role='employee' RETURNING ${userFields}`,
      [values.firstName, values.department, req.params.id, req.company.id]
    )).rows[0];
    if (!employee) return res.status(404).json({ message: 'Employee not found' });
    res.json(safeUser(employee));
  } catch (error) {
    next(error);
  }
});

app.post('/api/invitations', auth, adminOnly, async (req, res, next) => {
  try {
    const values = body(schemas.invitation, req.body);
    if (await findUser(values.email)) {
      return res.status(409).json({ message: 'This email already belongs to an account' });
    }

    await query('DELETE FROM invitations WHERE company_id=$1 AND email=$2 AND accepted_at IS NULL', [req.company.id, values.email]);
    const rawToken = crypto.randomBytes(32).toString('hex');
    const invitation = (await query(
      'INSERT INTO invitations(company_id,email,first_name,department,token_hash,expires_at,invited_by) VALUES($1,$2,$3,$4,$5,NOW() + INTERVAL \'7 days\',$6) RETURNING id,expires_at AS "expiresAt"',
      [req.company.id, values.email, values.firstName, values.department, hashToken(rawToken), req.user.id]
    )).rows[0];
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

    res.status(201).json({
      id: invitation.id,
      email: values.email,
      inviteUrl,
      emailSent,
      emailStatus,
      expiresAt: invitation.expiresAt
    });
  } catch (error) {
    next(error);
  }
});
app.get('/api/invitations', auth, adminOnly, async (req, res) => { const { rows } = await query('SELECT id,email,first_name AS "firstName",department,expires_at AS "expiresAt",accepted_at AS "acceptedAt",created_at AS "createdAt" FROM invitations WHERE company_id=$1 ORDER BY created_at DESC LIMIT 100', [req.company.id]); res.json(rows.map(i => ({ ...i, status: i.acceptedAt ? 'accepted' : (i.expiresAt < new Date() ? 'expired' : 'pending') }))); });
app.post('/api/invitations/:id/resend', auth, adminOnly, async (req, res, next) => {
  try {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const invitation = (await query(
      'UPDATE invitations SET token_hash=$1,expires_at=NOW() + INTERVAL \'7 days\' WHERE id=$2 AND company_id=$3 AND accepted_at IS NULL RETURNING id,email,first_name AS "firstName",department',
      [hashToken(rawToken), req.params.id, req.company.id]
    )).rows[0];
    if (!invitation) return res.status(404).json({ message: 'Pending invitation not found' });

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
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});
app.get('/api/invitations/:token', async (req, res) => { const { rows } = await query('SELECT i.first_name AS "firstName",i.email,i.department,c.name,c.slug FROM invitations i JOIN companies c ON c.id=i.company_id WHERE i.token_hash=$1 AND i.accepted_at IS NULL AND i.expires_at > NOW()', [hashToken(req.params.token)]); const i = rows[0]; if (!i) return res.status(404).json({ message: 'Invitation is invalid or expired' }); res.json({ firstName: i.firstName, email: i.email, department: i.department, company: { name: i.name, slug: i.slug } }); });
app.post('/api/invitations/:token/accept', async (req, res, next) => { let values; try { values = body(z.object({ password }).strict(), req.body); } catch (error) { return next(error); } const client = await pool.connect(); try { await client.query('BEGIN'); const invitation = (await client.query('SELECT * FROM invitations WHERE token_hash=$1 AND accepted_at IS NULL AND expires_at > NOW() FOR UPDATE', [hashToken(req.params.token)])).rows[0]; if (!invitation) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Invitation is invalid or expired' }); } if (await findUser(invitation.email)) { await client.query('ROLLBACK'); return res.status(409).json({ message: 'An account with this email already exists' }); } const company = (await client.query('SELECT id,name,slug,industry,size,active FROM companies WHERE id=$1', [invitation.company_id])).rows[0]; if (!company?.active) { await client.query('ROLLBACK'); return res.status(403).json({ message: 'This company workspace is currently inactive' }); } const user = (await client.query(`INSERT INTO users(company_id,first_name,email,password_hash,role,department) VALUES($1,$2,$3,$4,'employee',$5) RETURNING ${userFields}`, [company.id, invitation.first_name, invitation.email, await bcrypt.hash(values.password, 12), invitation.department])).rows[0]; await client.query('UPDATE invitations SET accepted_at=NOW() WHERE id=$1', [invitation.id]); await client.query('COMMIT'); res.status(201).json({ token: sign(user), user: { ...safeUser(user), companyName: company.name }, company: companyDto(company) }); } catch (e) { await client.query('ROLLBACK'); console.error(e); res.status(500).json({ message: 'Could not accept invitation' }); } finally { client.release(); } });

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
      'SELECT assigned_to AS "assignedTo" FROM tasks WHERE id=$1 AND company_id=$2 AND archived_at IS NULL',
      [req.params.id, req.company.id]
    )).rows[0];
    if (!previous) return res.status(404).json({ message: 'Task not found or archived' });
    const task = (await query(
      `UPDATE tasks SET task_title=$1,task_description=$2,task_date=$3,category=$4,assigned_to=$5,priority=$6,updated_at=NOW()
       WHERE id=$7 AND company_id=$8 AND archived_at IS NULL RETURNING ${taskFields}`,
      [values.taskTitle, values.taskDescription, values.taskDate, values.category, values.assignedTo, values.priority, req.params.id, req.company.id]
    )).rows[0];
    if (!task) return res.status(404).json({ message: 'Task not found or archived' });
    if (previous.assignedTo !== task.assignedTo) {
      await Promise.all([
        notifyUser(task.assignedTo, task.id, req.user.id, 'assigned', `Task assigned to you: ${task.taskTitle}`, `assigned:${task.id}:${task.assignedTo}:${crypto.randomUUID()}`),
        notifyUser(previous.assignedTo, task.id, req.user.id, 'assigned', `Task reassigned: ${task.taskTitle}`, `reassigned:${task.id}:${previous.assignedTo}:${crypto.randomUUID()}`)
      ]);
      const email = await emailTaskAssignment(task, employee, req.user.firstName, req);
      return res.json({ ...serializeTask(task), ...email });
    }
    res.json(serializeTask(task));
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
    res.json(serializeTask(task));
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
    const notifyId = req.user.id === task.createdBy ? task.assignedTo : task.createdBy;
    if (notifyId !== req.user.id) {
      await notifyUser(notifyId, task.id, req.user.id, 'status', `${req.user.firstName} marked "${task.taskTitle}" ${status}`, `status:${task.id}:${crypto.randomUUID()}`);
    }
    res.json(serializeTask(updated));
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
    const notifyTargets = new Set([task.assignedTo, task.createdBy]);
    notifyTargets.delete(req.user.id);
    await Promise.all([...notifyTargets].map(userId => notifyUser(
      userId,
      task.id,
      req.user.id,
      'comment',
      `${req.user.firstName} commented on "${task.taskTitle}"`,
      `comment:${comment.id}:${userId}`
    )));
    res.status(201).json({ ...comment, userId: req.user.id, firstName: req.user.firstName });
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

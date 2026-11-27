import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { query } from '../db.js';
import { config } from '../config.js';

const tokenSettings = { issuer: 'employeems-api', audience: 'employeems-web' };
const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const sessionGuard = `u.id=$1 AND u.auth_version=$2 AND NOT EXISTS (
  SELECT 1 FROM auth_session_revocations WHERE token_id=$3
)`;

export function signSession(user, authVersion = user.authVersion ?? 0) {
  return jwt.sign({ userId: String(user.id), authVersion }, config.JWT_SECRET, {
    ...tokenSettings, jwtid: randomUUID(), algorithm: 'HS256', expiresIn: '8h'
  });
}

export async function revokeSession({ id, expiresAt }) {
  await query(`WITH pruned AS (DELETE FROM auth_session_revocations WHERE expires_at<=NOW())
    INSERT INTO auth_session_revocations(token_id,expires_at) VALUES($1,$2) ON CONFLICT DO NOTHING`,
  [id, new Date(expiresAt)]);
}

async function sessionUser(session) {
  const { rows } = await query(`SELECT u.id, u.company_id AS "companyId", u.first_name AS "firstName", u.email, u.role, u.department, u.team, u.manager_id AS "managerId", u.active, c.id AS company_id_value, c.name AS company_name, c.slug AS company_slug, c.industry AS company_industry, c.size AS company_size, c.active AS company_active, c.time_zone AS company_time_zone, c.ai_enabled AS company_ai_enabled FROM users u JOIN companies c ON c.id = u.company_id WHERE ${sessionGuard}`,
  [session.userId, session.version, session.id]);
  return rows[0];
}

export async function sessionIsCurrent(session) {
  if (Date.now() >= session.expiresAt) return false;
  const user = await sessionUser(session);
  return Boolean(user?.active && user.company_active);
}

export const auth = async (req, res, next) => {
  const token = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Authentication required' });
  let payload;
  try {
    payload = jwt.verify(token, config.JWT_SECRET, { ...tokenSettings, algorithms: ['HS256'] });
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
  if (!uuidV4.test(payload.jti) || !Number.isInteger(payload.authVersion) || !Number.isInteger(payload.exp)
    || !/^\d+$/.test(payload.userId)) {
    return res.status(401).json({ message: 'Please sign in again.' });
  }
  const session = { id: payload.jti, userId: payload.userId, version: payload.authVersion, expiresAt: payload.exp * 1000 };
  try {
    const row = await sessionUser(session);
    if (!row || !row.active) return res.status(401).json({ message: 'Session ended. Please sign in again.' });
    if (!row.company_active) return res.status(403).json({ message: 'Company is inactive or missing' });
    req.session = session;
    req.user = { id: row.id, _id: row.id, companyId: row.companyId, firstName: row.firstName, email: row.email, role: row.role, department: row.department, team: row.team, managerId: row.managerId, active: row.active, workspaceTimeZone: row.company_time_zone };
    req.company = { id: row.company_id_value, _id: row.company_id_value, name: row.company_name, slug: row.company_slug, industry: row.company_industry, size: row.company_size, active: row.company_active, timeZone: row.company_time_zone, aiEnabled: row.company_ai_enabled };
  } catch (error) {
    console.error('Session lookup unavailable', { requestId: req.id, code: error.code });
    return res.status(503).json({ message: 'Sign-in verification is temporarily unavailable.' });
  }
  next();
};

export const adminOnly = (req, res, next) => req.user.role === 'admin' ? next() : res.status(403).json({ message: 'Admin access required' });

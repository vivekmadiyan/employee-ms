import jwt from 'jsonwebtoken';
import { query } from '../db.js';
import { config } from '../config.js';

export const auth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null;
    if (!token) return res.status(401).json({ message: 'Authentication required' });
    const payload = jwt.verify(token, config.JWT_SECRET, { algorithms: ['HS256'], issuer: 'employeems-api', audience: 'employeems-web' });
    const { rows } = await query(`SELECT u.id, u.company_id AS "companyId", u.first_name AS "firstName", u.email, u.role, u.department, u.team, u.manager_id AS "managerId", u.active, c.id AS company_id_value, c.name AS company_name, c.slug AS company_slug, c.industry AS company_industry, c.size AS company_size, c.active AS company_active FROM users u JOIN companies c ON c.id = u.company_id WHERE u.id = $1`, [payload.userId]);
    const row = rows[0];
    if (!row || !row.active) return res.status(401).json({ message: 'User is inactive or missing' });
    if (!row.company_active) return res.status(403).json({ message: 'Company is inactive or missing' });
    req.user = { id: row.id, _id: row.id, companyId: row.companyId, firstName: row.firstName, email: row.email, role: row.role, department: row.department, team: row.team, managerId: row.managerId, active: row.active };
    req.company = { id: row.company_id_value, _id: row.company_id_value, name: row.company_name, slug: row.company_slug, industry: row.company_industry, size: row.company_size, active: row.company_active };
    next();
  } catch { res.status(401).json({ message: 'Invalid or expired token' }); }
};

export const adminOnly = (req, res, next) => req.user.role === 'admin' ? next() : res.status(403).json({ message: 'Admin access required' });

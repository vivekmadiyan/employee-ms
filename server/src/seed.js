import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { initialiseDatabase, pool, query } from './db.js';

await initialiseDatabase();
const passwordHash = await bcrypt.hash('123', 12);
const company = (await query(`INSERT INTO companies(name,slug,industry,size) VALUES('Demo Company','demo-company','Technology','11-50') ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name,industry=EXCLUDED.industry,size=EXCLUDED.size,active=true RETURNING id`, [])).rows[0];
const upsertUser = (firstName, email, department, role = 'employee') => query(`INSERT INTO users(company_id,first_name,email,password_hash,role,department,active) VALUES($1,$2,$3,$4,$5,$6,true) ON CONFLICT (email) DO UPDATE SET company_id=EXCLUDED.company_id,first_name=EXCLUDED.first_name,password_hash=EXCLUDED.password_hash,role=EXCLUDED.role,department=EXCLUDED.department,active=true RETURNING id`, [company.id, firstName, email, passwordHash, role, department]);
const admin = (await upsertUser('Admin', 'admin@example.com', 'Management', 'admin')).rows[0];
for (const [name, email, department] of [['Arjun', 'e@e.com', 'Engineering'], ['Sneha', 'employee2@example.com', 'Design'], ['Ravi', 'employee3@example.com', 'QA']]) await upsertUser(name, email, department);
const arjun = (await query('SELECT id FROM users WHERE email=$1', ['e@e.com'])).rows[0];
if (!(await query('SELECT 1 FROM tasks WHERE company_id=$1 LIMIT 1', [company.id])).rowCount) await query(`INSERT INTO tasks(company_id,task_title,task_description,task_date,category,priority,status,assigned_to,created_by) VALUES ($1,'Update website','Revamp the homepage design','2026-09-20','Design','high','new',$2,$3),($1,'Fix bugs','Resolve bugs reported in issue tracker','2026-09-18','Development','medium','active',$2,$3)`, [company.id, arjun.id, admin.id]);
console.log('Seed complete. Admin: admin@example.com / 123');
await pool.end();

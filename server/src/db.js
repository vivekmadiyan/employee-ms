import pg from 'pg';
import { config } from './config.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.DATABASE_URL,
  ssl: config.PGSSL ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000
});

pool.on('error', error => console.error('Unexpected PostgreSQL pool error:', error));
export const query = (text, params) => pool.query(text, params);

export async function initialiseDatabase() {
  await query(`
    CREATE TABLE IF NOT EXISTS companies (id SERIAL PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, industry TEXT NOT NULL DEFAULT 'General', size TEXT NOT NULL DEFAULT '1-10', active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE, first_name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('admin', 'employee')), department TEXT NOT NULL DEFAULT 'General', active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS tasks (id SERIAL PRIMARY KEY, company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE, task_title TEXT NOT NULL, task_description TEXT NOT NULL, task_date TEXT NOT NULL, category TEXT NOT NULL, priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')), status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'active', 'completed', 'failed')), assigned_to INTEGER NOT NULL REFERENCES users(id), created_by INTEGER NOT NULL REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS invitations (id SERIAL PRIMARY KEY, company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE, email TEXT NOT NULL, first_name TEXT NOT NULL, department TEXT NOT NULL DEFAULT 'General', token_hash TEXT NOT NULL UNIQUE, expires_at TIMESTAMPTZ NOT NULL, accepted_at TIMESTAMPTZ, invited_by INTEGER NOT NULL REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
    CREATE TABLE IF NOT EXISTS password_resets (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, token_hash TEXT NOT NULL UNIQUE, expires_at TIMESTAMPTZ NOT NULL, used_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS notifications (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE, actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL, type TEXT NOT NULL CHECK (type IN ('assigned', 'status', 'comment', 'due', 'overdue')), message TEXT NOT NULL, event_key TEXT NOT NULL UNIQUE, read_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS task_comments (id SERIAL PRIMARY KEY, task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE, company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    CREATE INDEX IF NOT EXISTS users_company_id_idx ON users(company_id);
    CREATE INDEX IF NOT EXISTS tasks_company_id_idx ON tasks(company_id);
    CREATE INDEX IF NOT EXISTS tasks_active_company_due_idx ON tasks(company_id, task_date) WHERE archived_at IS NULL;
    CREATE INDEX IF NOT EXISTS invitations_company_id_idx ON invitations(company_id);
    CREATE INDEX IF NOT EXISTS password_resets_user_id_idx ON password_resets(user_id);
    CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON notifications(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS task_comments_task_created_idx ON task_comments(task_id, created_at);
  `);
}

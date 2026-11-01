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
    ALTER TABLE users ADD COLUMN IF NOT EXISTS job_title TEXT NOT NULL DEFAULT '';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS employment_type TEXT NOT NULL DEFAULT 'unspecified' CHECK (employment_type IN ('full_time','part_time','contractor','temporary','intern','unspecified'));
    ALTER TABLE users ADD COLUMN IF NOT EXISTS hire_date DATE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS team TEXT NOT NULL DEFAULT 'General';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS manager_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_secret TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_recovery_codes TEXT[] NOT NULL DEFAULT '{}';
    CREATE TABLE IF NOT EXISTS tasks (id SERIAL PRIMARY KEY, company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE, task_title TEXT NOT NULL, task_description TEXT NOT NULL, task_date TEXT NOT NULL, category TEXT NOT NULL, priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')), status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'active', 'completed', 'failed')), assigned_to INTEGER NOT NULL REFERENCES users(id), created_by INTEGER NOT NULL REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS invitations (id SERIAL PRIMARY KEY, company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE, email TEXT NOT NULL, first_name TEXT NOT NULL, department TEXT NOT NULL DEFAULT 'General', token_hash TEXT NOT NULL UNIQUE, expires_at TIMESTAMPTZ NOT NULL, accepted_at TIMESTAMPTZ, invited_by INTEGER NOT NULL REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    ALTER TABLE invitations ADD COLUMN IF NOT EXISTS job_title TEXT NOT NULL DEFAULT '';
    ALTER TABLE invitations ADD COLUMN IF NOT EXISTS employment_type TEXT NOT NULL DEFAULT 'unspecified' CHECK (employment_type IN ('full_time','part_time','contractor','temporary','intern','unspecified'));
    ALTER TABLE invitations ADD COLUMN IF NOT EXISTS hire_date DATE;
    ALTER TABLE invitations ADD COLUMN IF NOT EXISTS team TEXT NOT NULL DEFAULT 'General';
    ALTER TABLE invitations ADD COLUMN IF NOT EXISTS manager_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
    CREATE TABLE IF NOT EXISTS password_resets (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, token_hash TEXT NOT NULL UNIQUE, expires_at TIMESTAMPTZ NOT NULL, used_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS notifications (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE, actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL, type TEXT NOT NULL CHECK (type IN ('assigned', 'status', 'comment', 'due', 'overdue')), message TEXT NOT NULL, event_key TEXT NOT NULL UNIQUE, read_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS task_comments (id SERIAL PRIMARY KEY, task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE, company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS audit_events (id BIGSERIAL PRIMARY KEY, company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE, actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT, details JSONB NOT NULL DEFAULT '{}'::jsonb, request_id TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS leave_requests (id SERIAL PRIMARY KEY, company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, start_date DATE NOT NULL, end_date DATE NOT NULL, leave_type TEXT NOT NULL CHECK (leave_type IN ('vacation','sick','personal','other')), reason TEXT NOT NULL CHECK (char_length(reason) BETWEEN 2 AND 500), status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')), reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL, reviewed_at TIMESTAMPTZ, review_note TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), CHECK (end_date >= start_date));
    CREATE TABLE IF NOT EXISTS company_leave_policies (company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE, leave_type TEXT NOT NULL CHECK (leave_type IN ('vacation','sick','personal','other')), annual_allowance_days INTEGER CHECK (annual_allowance_days BETWEEN 0 AND 365), updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY(company_id,leave_type));
    CREATE TABLE IF NOT EXISTS company_integrations (company_id INTEGER PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE, slack_webhook_encrypted TEXT, updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS employee_onboarding (id SERIAL PRIMARY KEY, company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE, employee_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE, created_by INTEGER REFERENCES users(id) ON DELETE SET NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS workspace_activity (company_id INTEGER PRIMARY KEY, updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp());
    CREATE OR REPLACE FUNCTION bump_workspace_activity() RETURNS trigger AS $$
    DECLARE
      affected_company_id INTEGER;
    BEGIN
      IF TG_OP = 'DELETE' THEN
        affected_company_id := OLD.company_id;
      ELSE
        affected_company_id := NEW.company_id;
      END IF;
      INSERT INTO workspace_activity(company_id, updated_at)
      VALUES(affected_company_id, clock_timestamp())
      ON CONFLICT(company_id) DO UPDATE SET updated_at=EXCLUDED.updated_at;
      IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
    DROP TRIGGER IF EXISTS users_workspace_activity ON users;
    CREATE TRIGGER users_workspace_activity AFTER INSERT OR UPDATE OR DELETE ON users FOR EACH ROW EXECUTE FUNCTION bump_workspace_activity();
    DROP TRIGGER IF EXISTS tasks_workspace_activity ON tasks;
    CREATE TRIGGER tasks_workspace_activity AFTER INSERT OR UPDATE OR DELETE ON tasks FOR EACH ROW EXECUTE FUNCTION bump_workspace_activity();
    DROP TRIGGER IF EXISTS invitations_workspace_activity ON invitations;
    CREATE TRIGGER invitations_workspace_activity AFTER INSERT OR UPDATE OR DELETE ON invitations FOR EACH ROW EXECUTE FUNCTION bump_workspace_activity();
    DROP TRIGGER IF EXISTS task_comments_workspace_activity ON task_comments;
    CREATE TRIGGER task_comments_workspace_activity AFTER INSERT OR UPDATE OR DELETE ON task_comments FOR EACH ROW EXECUTE FUNCTION bump_workspace_activity();
    DROP TRIGGER IF EXISTS leave_requests_workspace_activity ON leave_requests;
    CREATE TRIGGER leave_requests_workspace_activity AFTER INSERT OR UPDATE OR DELETE ON leave_requests FOR EACH ROW EXECUTE FUNCTION bump_workspace_activity();
    DROP TRIGGER IF EXISTS leave_policies_workspace_activity ON company_leave_policies;
    CREATE TRIGGER leave_policies_workspace_activity AFTER INSERT OR UPDATE OR DELETE ON company_leave_policies FOR EACH ROW EXECUTE FUNCTION bump_workspace_activity();
    INSERT INTO workspace_activity(company_id) SELECT id FROM companies ON CONFLICT(company_id) DO NOTHING;
    CREATE INDEX IF NOT EXISTS users_company_id_idx ON users(company_id);
    CREATE INDEX IF NOT EXISTS tasks_company_id_idx ON tasks(company_id);
    CREATE INDEX IF NOT EXISTS tasks_active_company_due_idx ON tasks(company_id, task_date) WHERE archived_at IS NULL;
    CREATE INDEX IF NOT EXISTS invitations_company_id_idx ON invitations(company_id);
    CREATE INDEX IF NOT EXISTS password_resets_user_id_idx ON password_resets(user_id);
    CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON notifications(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS task_comments_task_created_idx ON task_comments(task_id, created_at);
    CREATE INDEX IF NOT EXISTS audit_events_company_created_idx ON audit_events(company_id, created_at DESC, id DESC);
    CREATE INDEX IF NOT EXISTS leave_requests_company_created_idx ON leave_requests(company_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS leave_requests_user_status_idx ON leave_requests(user_id, status, start_date);
  `);
}

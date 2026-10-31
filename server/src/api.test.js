import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  clientQuery: vi.fn(),
  connect: vi.fn(),
  sendInvitationEmail: vi.fn(),
  sendPasswordResetEmail: vi.fn()
}));

vi.mock('./db.js', () => ({
  query: mocks.query,
  pool: { connect: mocks.connect },
  initialiseDatabase: vi.fn()
}));
vi.mock('./email.js', () => ({
  sendInvitationEmail: mocks.sendInvitationEmail,
  sendPasswordResetEmail: mocks.sendPasswordResetEmail
}));

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/employee_ms_test';
process.env.JWT_SECRET = 'test-only-jwt-secret-that-is-at-least-32-characters';
process.env.CLIENT_URL = 'https://employee-ms.test';
process.env.ALLOWED_ORIGINS = 'https://employee-ms.test';
process.env.BREVO_API_KEY = 'test-brevo-key';
process.env.BREVO_SENDER_EMAIL = 'no-reply@example.test';

const { app } = await import('./server.js');

const company = { id: 1, name: 'Test Workspace', slug: 'test-workspace', industry: 'General', size: '1-10', active: true };
let users;
let tasks;
let comments;
let notifications;
let invitations;
let passwordResets;
let baseUsers;
let nextTaskId;
let nextCommentId;
let nextInvitationId;

const result = rows => ({ rows, rowCount: rows.length });
const userFields = user => ({
  id: user.id,
  companyId: user.companyId,
  firstName: user.firstName,
  email: user.email,
  role: user.role,
  department: user.department,
  active: user.active
});
const taskFields = task => ({ ...task });
const normalize = sql => sql.replace(/\s+/g, ' ').trim().toLowerCase();

function installQueryMock() {
  mocks.query.mockImplementation(async (sql, params = []) => {
    const text = normalize(sql);
    if (text.startsWith('select id, company_id as "companyid", first_name as "firstname", email, role, department, active, password_hash as "passwordhash" from users where email')) {
      const user = users.find(item => item.email === params[0]);
      return result(user ? [{ ...userFields(user), passwordHash: user.passwordHash }] : []);
    }
    if (text.startsWith('select u.id, u.company_id as "companyid"') && text.includes('join companies c')) {
      const user = users.find(item => item.id === Number(params[0]));
      return result(user ? [{
        ...userFields(user),
        company_id_value: company.id,
        company_name: company.name,
        company_slug: company.slug,
        company_industry: company.industry,
        company_size: company.size,
        company_active: company.active
      }] : []);
    }
    if (text.startsWith('select id,name,slug,industry,size,active from companies where id=')) {
      return result(company.id === Number(params[0]) ? [company] : []);
    }
    if (text.includes('select 1 from users where email=$1 and id<>$2')) {
      return result(users.some(user => user.email === params[0] && user.id !== Number(params[1])) ? [{ '?column?': 1 }] : []);
    }
    if (text.startsWith('select password_hash from users where id=')) {
      const user = users.find(item => item.id === Number(params[0]));
      return result(user ? [{ password_hash: user.passwordHash }] : []);
    }
    if (text.startsWith('update password_resets set used_at=now() where user_id=')) {
      passwordResets.filter(reset => reset.userId === Number(params[0]) && !reset.usedAt).forEach(reset => { reset.usedAt = new Date().toISOString(); });
      return result([]);
    }
    if (text.startsWith('update password_resets set used_at=now() where token_hash=')) {
      const reset = passwordResets.find(item => item.tokenHash === params[0] && !item.usedAt);
      if (reset) reset.usedAt = new Date().toISOString();
      return result([]);
    }
    if (text.startsWith('insert into password_resets(')) {
      passwordResets.push({ userId: Number(params[0]), tokenHash: params[1], usedAt: null });
      return result([]);
    }
    if (text.startsWith('update users set first_name=$1,email=$2')) {
      const userId = Number(params[params.length - 1]);
      const user = users.find(item => item.id === userId);
      user.firstName = params[0];
      user.email = params[1];
      if (params.length === 4) user.passwordHash = params[2];
      return result([userFields(user)]);
    }
    if (text.startsWith('select 1 from users where id=$1 and company_id=$2 and role=\'employee\' and active=true')) {
      return result(users.some(user => user.id === Number(params[0]) && user.companyId === Number(params[1]) && user.role === 'employee' && user.active) ? [{ '?column?': 1 }] : []);
    }
    if (text.startsWith('select 1 from users where id=$1 and company_id=$2 and role=\'employee\'')) {
      return result(users.some(user => user.id === Number(params[0]) && user.companyId === Number(params[1]) && user.role === 'employee') ? [{ '?column?': 1 }] : []);
    }
    if (text.startsWith('select id, company_id as "companyid", first_name as "firstname", email, role, department, active from users where company_id=$1 and role=\'employee\'')) {
      return result(users.filter(user => user.companyId === Number(params[0]) && user.role === 'employee').map(userFields));
    }
    if (text.startsWith('update users u set active=$1')) {
      const employee = users.find(user => user.id === Number(params[1]) && user.companyId === Number(params[2]) && user.role === 'employee');
      if (!employee) return result([]);
      const openTask = tasks.some(task => task.assignedTo === employee.id && task.companyId === employee.companyId && !task.archivedAt && ['new', 'active'].includes(task.status));
      if (!params[0] && openTask) return result([]);
      employee.active = params[0];
      return result([userFields(employee)]);
    }
    if (text.startsWith('update users set first_name=$1,department=$2')) {
      const employee = users.find(user => user.id === Number(params[2]) && user.companyId === Number(params[3]) && user.role === 'employee');
      if (!employee) return result([]);
      employee.firstName = params[0];
      employee.department = params[1];
      return result([userFields(employee)]);
    }
    if (text.startsWith('select assigned_to as "assignedto" from tasks where id=$1')) {
      const task = tasks.find(item => item.id === Number(params[0]) && item.companyId === Number(params[1]) && !item.archivedAt);
      return result(task ? [{ assignedTo: task.assignedTo }] : []);
    }
    if (text.startsWith('update tasks set task_title=$1')) {
      const task = tasks.find(item => item.id === Number(params[6]) && item.companyId === Number(params[7]) && !item.archivedAt);
      if (!task) return result([]);
      [task.taskTitle, task.taskDescription, task.taskDate, task.category] = params.slice(0, 4);
      task.assignedTo = Number(params[4]);
      task.priority = params[5];
      task.updatedAt = new Date().toISOString();
      return result([taskFields(task)]);
    }
    if (text.startsWith('delete from invitations where company_id=$1')) {
      invitations = invitations.filter(item => !(item.companyId === Number(params[0]) && item.email === params[1] && !item.acceptedAt));
      return { rows: [], rowCount: 1 };
    }
    if (text.startsWith('insert into invitations(')) {
      const invitation = {
        id: nextInvitationId++,
        companyId: Number(params[0]),
        email: params[1],
        firstName: params[2],
        department: params[3],
        tokenHash: params[4],
        expiresAt: new Date(Date.now() + 7 * 86400000),
        acceptedAt: null,
        invitedBy: Number(params[5]),
        createdAt: new Date()
      };
      invitations.push(invitation);
      return result([{ id: invitation.id, expiresAt: invitation.expiresAt }]);
    }
    if (text.startsWith('select id,email,first_name as "firstname",department,expires_at as "expiresat"')) {
      return result(invitations.filter(item => item.companyId === Number(params[0])).map(item => ({
        id: item.id,
        email: item.email,
        firstName: item.firstName,
        department: item.department,
        expiresAt: item.expiresAt,
        acceptedAt: item.acceptedAt,
        createdAt: item.createdAt
      })));
    }
    if (text.startsWith('update invitations set token_hash=$1')) {
      const invitation = invitations.find(item => item.id === Number(params[1]) && item.companyId === Number(params[2]) && !item.acceptedAt);
      if (!invitation) return result([]);
      invitation.tokenHash = params[0];
      invitation.expiresAt = new Date(Date.now() + 7 * 86400000);
      return result([{ id: invitation.id, email: invitation.email, firstName: invitation.firstName, department: invitation.department }]);
    }
    if (text.startsWith('delete from invitations where id=$1')) {
      const previousLength = invitations.length;
      invitations = invitations.filter(item => !(item.id === Number(params[0]) && item.companyId === Number(params[1]) && !item.acceptedAt));
      return { rows: [], rowCount: previousLength - invitations.length };
    }
    if (text.startsWith('select i.first_name as "firstname",i.email,i.department,c.name,c.slug from invitations')) {
      const invitation = invitations.find(item => item.tokenHash === params[0] && !item.acceptedAt && item.expiresAt > new Date());
      return result(invitation ? [{
        firstName: invitation.firstName,
        email: invitation.email,
        department: invitation.department,
        name: company.name,
        slug: company.slug
      }] : []);
    }
    if (text.startsWith('insert into tasks(')) {
      const task = {
        id: nextTaskId++,
        companyId: Number(params[0]),
        taskTitle: params[1],
        taskDescription: params[2],
        taskDate: params[3],
        category: params[4],
        assignedTo: Number(params[5]),
        createdBy: Number(params[6]),
        priority: params[7],
        status: 'new',
        archivedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      tasks.push(task);
      return result([taskFields(task)]);
    }
    if (text.startsWith('insert into notifications(')) {
      if (text.includes('select t.assigned_to')) return { rows: [], rowCount: 0 };
      const eventKey = params[5];
      if (!notifications.some(item => item.eventKey === eventKey)) {
        notifications.push({
          id: notifications.length + 1,
          userId: Number(params[0]),
          taskId: params[1] == null ? null : Number(params[1]),
          actorId: params[2] == null ? null : Number(params[2]),
          type: params[3],
          message: params[4],
          eventKey,
          readAt: null,
          createdAt: new Date().toISOString()
        });
      }
      return { rows: [], rowCount: 1 };
    }
    if (text.startsWith('select id,assigned_to as "assignedto",created_by as "createdby" from tasks')) {
      const task = tasks.find(item => item.id === Number(params[0]) && item.companyId === Number(params[1]) && !item.archivedAt);
      return result(task ? [{ id: task.id, assignedTo: task.assignedTo, createdBy: task.createdBy }] : []);
    }
    if (text.startsWith('select id,task_title as "tasktitle",assigned_to as "assignedto",created_by as "createdby" from tasks')) {
      const task = tasks.find(item => item.id === Number(params[0]) && item.companyId === Number(params[1]) && !item.archivedAt);
      return result(task ? [{ id: task.id, taskTitle: task.taskTitle, assignedTo: task.assignedTo, createdBy: task.createdBy }] : []);
    }
    if (text.startsWith('select c.id,c.content,c.created_at as "createdat"')) {
      return result(comments.filter(comment => comment.taskId === Number(params[0]) && comment.companyId === Number(params[1])));
    }
    if (text.startsWith('insert into task_comments(')) {
      const comment = {
        id: nextCommentId++,
        taskId: Number(params[0]),
        companyId: Number(params[1]),
        userId: Number(params[2]),
        content: params[3],
        createdAt: new Date().toISOString()
      };
      const user = users.find(item => item.id === comment.userId);
      const saved = { ...comment, firstName: user.firstName };
      comments.push(saved);
      return result([{ id: saved.id, content: saved.content, createdAt: saved.createdAt, userId: user.id, firstName: user.firstName }]);
    }
    if (text.startsWith('select n.id,n.task_id as "taskid",n.type,n.message,n.read_at as "readat"')) {
      return result(notifications.filter(item => item.userId === Number(params[0])).map(item => ({
        id: item.id,
        taskId: item.taskId,
        type: item.type,
        message: item.message,
        readAt: item.readAt,
        createdAt: item.createdAt
      })));
    }
    if (text.startsWith('update notifications set read_at=coalesce')) {
      const notification = notifications.find(item => item.id === Number(params[0]) && item.userId === Number(params[1]));
      if (notification) notification.readAt = new Date().toISOString();
      return result(notification ? [{ id: notification.id, readAt: notification.readAt }] : []);
    }
    if (text.startsWith('update notifications set read_at=now()')) {
      notifications.filter(item => item.userId === Number(params[0]) && !item.readAt).forEach(item => { item.readAt = new Date().toISOString(); });
      return result([]);
    }
    if (text.startsWith('select id, company_id as "companyid", task_title as "tasktitle"')) {
      let found = tasks.filter(task => task.companyId === Number(params[0]));
      if (text.includes('assigned_to=$2')) found = found.filter(task => task.assignedTo === Number(params[1]));
      if (text.includes('archived_at is null')) found = found.filter(task => !task.archivedAt);
      if (text.includes('status=$')) {
        const statusParam = Number(text.match(/status=\$(\d+)/)?.[1]);
        found = found.filter(task => task.status === params[statusParam - 1]);
      }
      return result(found.map(taskFields));
    }
    if (text.startsWith('select id,company_id as "companyid",task_title as "tasktitle"')) {
      let found = tasks.filter(task => task.companyId === Number(params[0]));
      if (text.includes('archived_at is null')) found = found.filter(task => !task.archivedAt);
      return result(found.map(taskFields));
    }
    if (text.startsWith('update tasks set status=$1')) {
      const task = tasks.find(item => item.id === Number(params[1]) && item.companyId === Number(params[2]));
      task.status = params[0];
      task.updatedAt = new Date().toISOString();
      return result([taskFields(task)]);
    }
    if (text.startsWith('update tasks set archived_at=')) {
      const task = tasks.find(item => item.id === Number(params[0]) && item.companyId === Number(params[1]));
      if (!task) return result([]);
      task.archivedAt = text.includes('archived_at=now()') ? new Date().toISOString() : null;
      task.updatedAt = new Date().toISOString();
      return result([taskFields(task)]);
    }
    if (text === 'select 1') return result([{ '?column?': 1 }]);
    throw new Error(`Unexpected SQL in API test: ${text}`);
  });
}

beforeAll(async () => {
  const passwordHash = await bcrypt.hash('correct-horse-battery-123', 4);
  baseUsers = [
    { id: 1, companyId: 1, firstName: 'Admin', email: 'admin@example.test', passwordHash, role: 'admin', department: 'Management', active: true },
    { id: 2, companyId: 1, firstName: 'Employee', email: 'employee@example.test', passwordHash, role: 'employee', department: 'Operations', active: true }
  ];
});

beforeEach(() => {
  users = baseUsers.map(user => ({ ...user }));
  tasks = [];
  comments = [];
  notifications = [];
  invitations = [];
  passwordResets = [];
  nextTaskId = 1;
  nextCommentId = 1;
  nextInvitationId = 1;
  installQueryMock();
  mocks.clientQuery.mockReset();
  mocks.clientQuery.mockImplementation(async (sql, params = []) => {
  const text = normalize(sql);
  if (['begin', 'commit', 'rollback'].includes(text)) return result([]);
  if (text.startsWith('select id,user_id from password_resets')) {
    const reset = passwordResets.find(item => item.tokenHash === params[0] && !item.usedAt);
    return result(reset ? [{ id: passwordResets.indexOf(reset) + 1, user_id: reset.userId }] : []);
  }
  if (text.startsWith('select * from invitations where token_hash=')) {
    const invitation = invitations.find(item => item.tokenHash === params[0] && !item.acceptedAt && item.expiresAt > new Date());
    return result(invitation ? [{
      id: invitation.id,
      company_id: invitation.companyId,
      email: invitation.email,
      first_name: invitation.firstName,
      department: invitation.department
    }] : []);
  }
  if (text.startsWith('select id,name,slug,industry,size,active from companies where id=')) {
    return result(company.id === Number(params[0]) ? [company] : []);
  }
  if (text.startsWith('insert into users(company_id,first_name,email,password_hash,role,department)')) {
    const user = {
      id: Math.max(...users.map(item => item.id)) + 1,
      companyId: Number(params[0]),
      firstName: params[1],
      email: params[2],
      passwordHash: params[3],
      role: 'employee',
      department: params[4],
      active: true
    };
    users.push(user);
    return result([userFields(user)]);
  }
  if (text.startsWith('update invitations set accepted_at=now()')) {
    const invitation = invitations.find(item => item.id === Number(params[0]));
    if (invitation) invitation.acceptedAt = new Date();
    return result([]);
  }
  if (text.startsWith('update users set password_hash=$1')) {
    const user = users.find(item => item.id === Number(params[1]));
    if (user) user.passwordHash = params[0];
    return result([]);
  }
  if (text.startsWith('update password_resets set used_at=now() where user_id=$1')) {
    passwordResets.filter(reset => reset.userId === Number(params[0]) && !reset.usedAt).forEach(reset => { reset.usedAt = new Date().toISOString(); });
    return result([]);
  }
  throw new Error(`Unexpected transaction SQL in API test: ${text}`);
  });
  mocks.connect.mockResolvedValue({
  query: mocks.clientQuery,
  release: vi.fn()
  });
});

describe('authenticated API workflows', () => {
  it('creates a task, lets its owner accept it, discuss it, and complete it', async () => {
    const adminLogin = await request(app).post('/api/auth/login').send({
      email: 'admin@example.test',
      password: 'correct-horse-battery-123'
    }).expect(200);
    const employeeLogin = await request(app).post('/api/auth/login').send({
      email: 'employee@example.test',
      password: 'correct-horse-battery-123'
    }).expect(200);
    const adminToken = adminLogin.body.token;
    const employeeToken = employeeLogin.body.token;

    const created = await request(app).post('/api/tasks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        taskTitle: 'Prepare launch checklist',
        taskDescription: 'Review all production-readiness items.',
        taskDate: '2099-12-31',
        category: 'Operations',
        assignedTo: 2,
        priority: 'high'
      }).expect(201);
    expect(created.body.taskTitle).toBe('Prepare launch checklist');
    expect(notifications.some(item => item.userId === 2 && item.type === 'assigned')).toBe(true);

    await request(app).get('/api/tasks')
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(200)
      .then(response => expect(response.body.map(task => task.id)).toEqual([created.body.id]));

    await request(app).patch(`/api/tasks/${created.body.id}/status`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ status: 'active' }).expect(200);
    await request(app).post(`/api/tasks/${created.body.id}/comments`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ content: 'I started the checklist.' }).expect(201);
    const discussion = await request(app).get(`/api/tasks/${created.body.id}/comments`)
      .set('Authorization', `Bearer ${adminToken}`).expect(200);
    expect(discussion.body).toMatchObject([{ content: 'I started the checklist.', firstName: 'Employee' }]);
    const employeeNotifications = await request(app).get('/api/notifications')
      .set('Authorization', `Bearer ${employeeToken}`).expect(200);
    expect(employeeNotifications.body.notifications.some(item => item.type === 'assigned')).toBe(true);
    await request(app).patch(`/api/notifications/${employeeNotifications.body.notifications[0].id}/read`)
      .set('Authorization', `Bearer ${employeeToken}`).expect(200);

    await request(app).patch(`/api/tasks/${created.body.id}/status`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ status: 'completed' }).expect(200);
    expect(notifications.some(item => item.userId === 1 && item.type === 'status')).toBe(true);

    await request(app).patch(`/api/tasks/${created.body.id}/archive`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ archived: true }).expect(200);
    const activeTasks = await request(app).get('/api/tasks')
      .set('Authorization', `Bearer ${employeeToken}`).expect(200);
    expect(activeTasks.body).toEqual([]);
  });

  it('rejects unauthorized and cross-employee task access', async () => {
    const employee = await request(app).post('/api/auth/login').send({
      email: 'employee@example.test',
      password: 'correct-horse-battery-123'
    }).expect(200);

    await request(app).get('/api/tasks').expect(401);
    await request(app).post('/api/tasks')
      .set('Authorization', `Bearer ${employee.body.token}`)
      .send({}).expect(403);
    await request(app).post('/api/tasks/99/comments')
      .set('Authorization', `Bearer ${employee.body.token}`)
      .send({ content: 'Unauthorized task comment' }).expect(404);
  });

  it('updates account profile and password, requiring the current password', async () => {
    const login = await request(app).post('/api/auth/login').send({
      email: 'admin@example.test',
      password: 'correct-horse-battery-123'
    }).expect(200);

    await request(app).patch('/api/auth/me')
      .set('Authorization', `Bearer ${login.body.token}`)
      .send({
        firstName: 'Workspace Owner',
        email: 'admin@example.test',
        currentPassword: 'incorrect-password',
        newPassword: 'a-new-valid-password-123'
      }).expect(400);

    const updated = await request(app).patch('/api/auth/me')
      .set('Authorization', `Bearer ${login.body.token}`)
      .send({
        firstName: 'Workspace Owner',
        email: 'admin@example.test',
        currentPassword: 'correct-horse-battery-123',
        newPassword: 'a-new-valid-password-123'
      }).expect(200);
    expect(updated.body.user.firstName).toBe('Workspace Owner');
    await request(app).post('/api/auth/login').send({
      email: 'admin@example.test',
      password: 'a-new-valid-password-123'
    }).expect(200);
  });

  it('lets admins edit employees and prevents deactivation while open work remains', async () => {
    const adminLogin = await request(app).post('/api/auth/login').send({
      email: 'admin@example.test',
      password: 'correct-horse-battery-123'
    }).expect(200);
    const adminToken = adminLogin.body.token;
    const created = await request(app).post('/api/tasks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        taskTitle: 'Active employee work',
        taskDescription: 'This task should block account deactivation.',
        taskDate: '2099-12-31',
        category: 'Operations',
        assignedTo: 2,
        priority: 'medium'
      }).expect(201);

    await request(app).patch('/api/employees/2/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ active: false }).expect(409);
    await request(app).patch('/api/employees/2')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ firstName: 'Updated Employee', department: 'Support' }).expect(200)
      .then(response => expect(response.body).toMatchObject({ firstName: 'Updated Employee', department: 'Support' }));

    await request(app).patch(`/api/tasks/${created.body.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'active' }).expect(200);
    await request(app).patch(`/api/tasks/${created.body.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'completed' }).expect(200);
    await request(app).patch('/api/employees/2/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ active: false }).expect(200);
  });

  it('creates an invitation, refreshes the link, and accepts it exactly once', async () => {
    const adminLogin = await request(app).post('/api/auth/login').send({
      email: 'admin@example.test',
      password: 'correct-horse-battery-123'
    }).expect(200);
    const adminToken = adminLogin.body.token;
    const created = await request(app).post('/api/invitations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ firstName: 'New Teammate', email: 'new@example.test', department: 'Research' }).expect(201);
    expect(created.body.emailStatus).toBe('sent');
    const oldToken = new URL(created.body.inviteUrl).pathname.split('/').pop();
    await request(app).get(`/api/invitations/${oldToken}`).expect(200);

    const resent = await request(app).post(`/api/invitations/${created.body.id}/resend`)
      .set('Authorization', `Bearer ${adminToken}`).expect(200);
    const currentToken = new URL(resent.body.inviteUrl).pathname.split('/').pop();
    await request(app).get(`/api/invitations/${oldToken}`).expect(404);
    await request(app).get(`/api/invitations/${currentToken}`)
      .expect(200)
      .then(response => expect(response.body.email).toBe('new@example.test'));

    const accepted = await request(app).post(`/api/invitations/${currentToken}/accept`)
      .send({ password: 'accepted-password-12345' }).expect(201);
    expect(accepted.body.user.role).toBe('employee');
    await request(app).post('/api/auth/login')
      .send({ email: 'new@example.test', password: 'accepted-password-12345' }).expect(200);
    await request(app).post(`/api/invitations/${currentToken}/accept`)
      .send({ password: 'accepted-password-12345' }).expect(404);
  });
});

describe('password reset API flow', () => {
  it('rejects an invalid or expired reset token', async () => {
    const clientQuery = mocks.clientQuery.mockImplementation(async sql => {
      const text = normalize(sql);
      if (text === 'begin' || text === 'rollback') return result([]);
      if (text.startsWith('select id,user_id from password_resets')) return result([]);
      throw new Error(`Unexpected transaction SQL in API test: ${text}`);
    });

    const response = await request(app).post('/api/auth/reset-password')
      .send({ token: crypto.randomBytes(32).toString('hex'), password: 'new-password-12345' })
      .expect(400);
    expect(response.body.message).toMatch(/invalid or expired/i);
    expect(clientQuery).toHaveBeenCalled();
  });

  it('emails a single-use reset link and changes the password', async () => {
    mocks.sendPasswordResetEmail.mockResolvedValue(undefined);
    await request(app).post('/api/auth/forgot-password')
      .send({ email: 'admin@example.test' }).expect(200);
    expect(mocks.sendPasswordResetEmail).toHaveBeenCalledOnce();
    const { resetUrl } = mocks.sendPasswordResetEmail.mock.calls[0][0];
    const token = new URL(resetUrl).pathname.split('/').pop();

    await request(app).post('/api/auth/reset-password')
      .send({ token, password: 'reset-password-12345' }).expect(200);
    await request(app).post('/api/auth/login')
      .send({ email: 'admin@example.test', password: 'reset-password-12345' }).expect(200);
    await request(app).post('/api/auth/reset-password')
      .send({ token, password: 'another-password-12345' }).expect(400);
  });
});

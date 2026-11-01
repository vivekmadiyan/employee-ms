import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  clientQuery: vi.fn(),
  connect: vi.fn(),
  sendInvitationEmail: vi.fn(),
  sendLeaveRequestEmail: vi.fn(),
  sendLeaveDecisionEmail: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  sendTaskAssignedEmail: vi.fn(),
  sendTaskUpdateEmail: vi.fn()
}));

vi.mock('./db.js', () => ({
  query: mocks.query,
  pool: { connect: mocks.connect, totalCount: 2, idleCount: 1, waitingCount: 0 },
  initialiseDatabase: vi.fn()
}));
vi.mock('./email.js', () => ({
  sendInvitationEmail: mocks.sendInvitationEmail,
  sendLeaveRequestEmail: mocks.sendLeaveRequestEmail,
  sendLeaveDecisionEmail: mocks.sendLeaveDecisionEmail,
  sendPasswordResetEmail: mocks.sendPasswordResetEmail,
  sendTaskAssignedEmail: mocks.sendTaskAssignedEmail,
  sendTaskUpdateEmail: mocks.sendTaskUpdateEmail
}));
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/employee_ms_test';
process.env.JWT_SECRET = 'test-only-jwt-secret-that-is-at-least-32-characters';
process.env.CLIENT_URL = 'https://employee-ms.test';
process.env.ALLOWED_ORIGINS = 'https://employee-ms.test';
process.env.BREVO_API_KEY = 'test-brevo-key';
process.env.BREVO_SENDER_EMAIL = 'no-reply@example.test';
process.env.METRICS_TOKEN = 'test-metrics-token-that-is-at-least-32-chars';

const { app } = await import('./server.js');
const { createTotpCode, decryptSecret, decryptTotpSecret } = await import('./mfa.js');

const company = { id: 1, name: 'Test Workspace', slug: 'test-workspace', industry: 'General', size: '1-10', active: true };
let users;
let tasks;
let comments;
let notifications;
let auditEvents;
let leaveRequests;
let leavePolicies;
let invitations;
let passwordResets;
let slackWebhookEncrypted;
let onboardingEmployees;
let baseUsers;
let nextTaskId;
let nextCommentId;
let nextInvitationId;
let nextLeaveId;
let failAuditWrites;

const result = rows => ({ rows, rowCount: rows.length });
const userFields = user => ({
  id: user.id,
  companyId: user.companyId,
  firstName: user.firstName,
  email: user.email,
  role: user.role,
  department: user.department,
  jobTitle: user.jobTitle || '',
  employmentType: user.employmentType || 'unspecified',
  hireDate: user.hireDate || null,
  team: user.team || 'General',
  managerId: user.managerId || null,
  active: user.active
});
const taskFields = task => ({ ...task });
const normalize = sql => sql.replace(/\s+/g, ' ').trim().toLowerCase();

function installQueryMock() {
  mocks.query.mockImplementation(async (sql, params = []) => {
    const text = normalize(sql);
    if (text.startsWith('insert into audit_events(')) {
      if (failAuditWrites) throw new Error('audit storage unavailable');
      auditEvents.push({
        id: auditEvents.length + 1,
        companyId: Number(params[0]),
        actorId: params[1] == null ? null : Number(params[1]),
        action: params[2],
        entityType: params[3],
        entityId: params[4],
        details: JSON.parse(params[5]),
        requestId: params[6],
        createdAt: new Date().toISOString()
      });
      return result([]);
    }
    if (text.startsWith('select slack_webhook_encrypted is not null as configured from company_integrations')) {
      return result(slackWebhookEncrypted ? [{ configured: true }] : [{ configured: false }]);
    }
    if (text.startsWith('select slack_webhook_encrypted as encrypted from company_integrations')) {
      return result(slackWebhookEncrypted ? [{ encrypted: slackWebhookEncrypted }] : []);
    }
    if (text.startsWith('insert into company_integrations(')) {
      slackWebhookEncrypted = params[1];
      return result([]);
    }
    if (text.startsWith('update company_integrations set slack_webhook_encrypted=null')) {
      slackWebhookEncrypted = null;
      return result([]);
    }
    if (text.startsWith('select employee_id as "employeeid" from employee_onboarding')) {
      return result([...onboardingEmployees].map(employeeId => ({ employeeId })));
    }
    if (text.startsWith('select mfa_secret as "mfasecret",mfa_enabled as "mfaenabled"')) {
      const user = users.find(item => item.id === Number(params[0]));
      return result(user ? [{
        mfaSecret: user.mfaSecret || null,
        mfaEnabled: Boolean(user.mfaEnabled),
        mfaRecoveryCodes: user.mfaRecoveryCodes || []
      }] : []);
    }
    if (text.startsWith('select mfa_enabled as enabled,mfa_secret is not null')) {
      const user = users.find(item => item.id === Number(params[0]));
      return result(user ? [{
        enabled: Boolean(user.mfaEnabled),
        setupPending: Boolean(user.mfaSecret) && !user.mfaEnabled,
        recoveryCodesRemaining: (user.mfaRecoveryCodes || []).length
      }] : []);
    }
    if (text.startsWith('select password_hash as "passwordhash",mfa_enabled as "mfaenabled"')) {
      const user = users.find(item => item.id === Number(params[0]));
      return result(user ? [{ passwordHash: user.passwordHash, mfaEnabled: Boolean(user.mfaEnabled) }] : []);
    }
    if (text.startsWith('select mfa_secret as secret,mfa_enabled as enabled')) {
      const user = users.find(item => item.id === Number(params[0]));
      return result(user ? [{ secret: user.mfaSecret || null, enabled: Boolean(user.mfaEnabled) }] : []);
    }
    if (text.startsWith('select password_hash as "passwordhash",mfa_secret as secret')) {
      const user = users.find(item => item.id === Number(params[0]));
      return result(user ? [{
        passwordHash: user.passwordHash,
        secret: user.mfaSecret || null,
        enabled: Boolean(user.mfaEnabled),
        recoveryCodes: user.mfaRecoveryCodes || []
      }] : []);
    }
    if (text.startsWith('update users set mfa_secret=$1')) {
      const user = users.find(item => item.id === Number(params[1]));
      if (user) user.mfaSecret = params[0];
      return result([]);
    }
    if (text.startsWith('update users set mfa_recovery_codes=array_remove')) {
      const user = users.find(item => item.id === Number(params[1]));
      if (user) user.mfaRecoveryCodes = (user.mfaRecoveryCodes || []).filter(hash => hash !== params[0]);
      return result([]);
    }
    if (text.startsWith('update users set mfa_enabled=true')) {
      const user = users.find(item => item.id === Number(params[1]));
      if (user) {
        user.mfaEnabled = true;
        user.mfaRecoveryCodes = params[0];
      }
      return result([]);
    }
    if (text.startsWith('update users set mfa_enabled=false')) {
      const user = users.find(item => item.id === Number(params[0]));
      if (user) {
        user.mfaEnabled = false;
        user.mfaSecret = null;
        user.mfaRecoveryCodes = [];
      }
      return result([]);
    }
    if (text.startsWith('select a.id,a.actor_user_id as "actorid"')) {
      const visibleEvents = auditEvents
        .filter(event => event.companyId === Number(params[0]))
        .sort((left, right) => right.id - left.id)
        .slice(0, 100)
        .map(event => ({
          id: event.id,
          actorId: event.actorId,
          actorName: users.find(user => user.id === event.actorId)?.firstName || 'Former user',
          action: event.action,
          entityType: event.entityType,
          entityId: event.entityId,
          details: event.details,
          requestId: event.requestId,
          createdAt: event.createdAt
        }));
      return result(visibleEvents);
    }
    if (text.startsWith('select id from leave_requests')) {
      const overlap = leaveRequests.find(leave =>
        leave.companyId === Number(params[0]) &&
        leave.userId === Number(params[1]) &&
        ['pending', 'approved'].includes(leave.status) &&
        leave.startDate <= params[3] &&
        leave.endDate >= params[2]
      );
      return result(overlap ? [{ id: overlap.id }] : []);
    }
    if (text.startsWith('insert into company_leave_policies(')) {
      leavePolicies = params[1].map((leaveType, index) => ({
        companyId: Number(params[0]),
        leaveType,
        annualAllowanceDays: params[2][index],
        updatedBy: Number(params[3])
      }));
      return result(leavePolicies.map(({ leaveType, annualAllowanceDays }) => ({ leaveType, annualAllowanceDays })));
    }
    if (text.startsWith('select leave_type as "leavetype",annual_allowance_days as "annualallowancedays" from company_leave_policies')) {
      const companyPolicies = leavePolicies.filter(policy => policy.companyId === Number(params[0]));
      return result(params.length > 1
        ? companyPolicies.filter(policy => policy.leaveType === params[1]).map(policy => ({ annualAllowanceDays: policy.annualAllowanceDays }))
        : companyPolicies.map(({ leaveType, annualAllowanceDays }) => ({ leaveType, annualAllowanceDays })));
    }
    if (text.startsWith('select annual_allowance_days as "annualallowancedays" from company_leave_policies')) {
      const policy = leavePolicies.find(item =>
        item.companyId === Number(params[0]) && item.leaveType === params[1]
      );
      return result(policy ? [{ annualAllowanceDays: policy.annualAllowanceDays }] : []);
    }
    if (text.startsWith('select start_date::text as "startdate",end_date::text as "enddate" from leave_requests')) {
      return result(leaveRequests.filter(leave =>
        leave.companyId === Number(params[0]) &&
        leave.userId === Number(params[1]) &&
        leave.leaveType === params[2] &&
        ['pending', 'approved'].includes(leave.status) &&
        leave.startDate <= params[4] &&
        leave.endDate >= params[3]
      ).map(leave => ({ startDate: leave.startDate, endDate: leave.endDate })));
    }
    if (text.startsWith('select leave_type as "leavetype",status,start_date::text as "startdate"')) {
      return result(leaveRequests.filter(leave =>
        leave.companyId === Number(params[0]) &&
        leave.userId === Number(params[1]) &&
        ['pending', 'approved'].includes(leave.status) &&
        leave.startDate <= params[2] &&
        leave.endDate >= params[3]
      ).map(leave => ({
        leaveType: leave.leaveType,
        status: leave.status,
        startDate: leave.startDate,
        endDate: leave.endDate
      })));
    }
    if (text.startsWith('select l.user_id as "userid",u.first_name as "employeename",u.department')) {
      return result(leaveRequests.filter(leave =>
        leave.companyId === Number(params[0]) &&
        leave.status === 'approved' &&
        leave.startDate <= params[2] &&
        leave.endDate >= params[1] &&
        users.find(user => user.id === leave.userId)?.active
      ).map(leave => {
        const user = users.find(item => item.id === leave.userId);
        return {
          userId: leave.userId,
          employeeName: user.firstName,
          department: user.department,
          startDate: leave.startDate,
          endDate: leave.endDate
        };
      }));
    }
    if (text.startsWith('insert into leave_requests(')) {
      const leave = {
        id: nextLeaveId++,
        companyId: Number(params[0]),
        userId: Number(params[1]),
        startDate: params[2],
        endDate: params[3],
        leaveType: params[4],
        reason: params[5],
        status: 'pending',
        reviewNote: null,
        reviewedBy: null,
        reviewedAt: null,
        createdAt: new Date().toISOString()
      };
      leaveRequests.push(leave);
      return result([{
        id: leave.id,
        userId: leave.userId,
        startDate: leave.startDate,
        endDate: leave.endDate,
        leaveType: leave.leaveType,
        reason: leave.reason,
        status: leave.status,
        createdAt: leave.createdAt
      }]);
    }
    if (text.startsWith('update leave_requests set status=$1')) {
      const leave = leaveRequests.find(item =>
        item.id === Number(params[3]) &&
        item.companyId === Number(params[4]) &&
        item.status === 'pending'
      );
      if (!leave) return result([]);
      leave.status = params[0];
      leave.reviewNote = params[1];
      leave.reviewedBy = Number(params[2]);
      leave.reviewedAt = new Date().toISOString();
      return result([{
        id: leave.id,
        userId: leave.userId,
        startDate: leave.startDate,
        endDate: leave.endDate,
        leaveType: leave.leaveType,
        reason: leave.reason,
        status: leave.status,
        reviewNote: leave.reviewNote,
        reviewedAt: leave.reviewedAt
      }]);
    }
    if (text.startsWith("update leave_requests set status='cancelled'")) {
      const leave = leaveRequests.find(item =>
        item.id === Number(params[0]) &&
        item.companyId === Number(params[1]) &&
        item.userId === Number(params[2]) &&
        item.status === 'pending'
      );
      if (!leave) return result([]);
      leave.status = 'cancelled';
      return result([{ id: leave.id }]);
    }
    if (text.startsWith('select l.id,l.user_id as "userid"')) {
      const filtered = leaveRequests.filter(leave =>
        leave.companyId === Number(params[0]) &&
        (params.length === 1 || leave.userId === Number(params[1]))
      ).sort((left, right) => {
        if ((left.status === 'pending') !== (right.status === 'pending')) return left.status === 'pending' ? -1 : 1;
        return right.id - left.id;
      }).slice(0, 200);
      return result(filtered.map(leave => ({
        id: leave.id,
        userId: leave.userId,
        employeeName: users.find(user => user.id === leave.userId)?.firstName || 'Former employee',
        startDate: leave.startDate,
        endDate: leave.endDate,
        leaveType: leave.leaveType,
        reason: leave.reason,
        status: leave.status,
        reviewNote: leave.reviewNote,
        reviewedAt: leave.reviewedAt,
        reviewerName: users.find(user => user.id === leave.reviewedBy)?.firstName || null,
        createdAt: leave.createdAt
      })));
    }
    if (text.startsWith('select count(*)::int as "totaltasks"')) {
      const reportTasks = tasks.filter(task => {
        const createdDate = String(task.createdAt).slice(0, 10);
        return task.companyId === Number(params[0]) &&
          !task.archivedAt &&
          createdDate >= params[1] &&
          createdDate <= params[2];
      });
      return result([{
        totalTasks: reportTasks.length,
        newTasks: reportTasks.filter(task => task.status === 'new').length,
        activeTasks: reportTasks.filter(task => task.status === 'active').length,
        completedTasks: reportTasks.filter(task => task.status === 'completed').length,
        failedTasks: reportTasks.filter(task => task.status === 'failed').length,
        overdueTasks: reportTasks.filter(task =>
          ['new', 'active'].includes(task.status) &&
          task.taskDate < new Date().toISOString().slice(0, 10)
        ).length
      }]);
    }
    if (text.startsWith('select t.status,count(*)::int as count from tasks t')) {
      const reportTasks = tasks.filter(task =>
        task.companyId === Number(params[0]) &&
        !task.archivedAt &&
        String(task.createdAt).slice(0, 10) >= params[1] &&
        String(task.createdAt).slice(0, 10) <= params[2]
      );
      const groups = new Map();
      reportTasks.forEach(task => groups.set(task.status, (groups.get(task.status) || 0) + 1));
      return result([...groups].map(([status, count]) => ({ status, count })));
    }
    if (text.startsWith('select t.priority,count(*)::int as count from tasks t')) {
      const reportTasks = tasks.filter(task =>
        task.companyId === Number(params[0]) &&
        !task.archivedAt &&
        String(task.createdAt).slice(0, 10) >= params[1] &&
        String(task.createdAt).slice(0, 10) <= params[2]
      );
      const groups = new Map();
      reportTasks.forEach(task => groups.set(task.priority, (groups.get(task.priority) || 0) + 1));
      return result([...groups].map(([priority, count]) => ({ priority, count })));
    }
    if (text.startsWith('select t.category,count(*)::int as count from tasks t')) {
      const reportTasks = tasks.filter(task =>
        task.companyId === Number(params[0]) &&
        !task.archivedAt &&
        String(task.createdAt).slice(0, 10) >= params[1] &&
        String(task.createdAt).slice(0, 10) <= params[2]
      );
      const groups = new Map();
      reportTasks.forEach(task => groups.set(task.category, (groups.get(task.category) || 0) + 1));
      return result([...groups].map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count).slice(0, 10));
    }
    if (text.startsWith('select t.assigned_to as "assigneeid"')) {
      const reportTasks = tasks.filter(task =>
        task.companyId === Number(params[0]) &&
        !task.archivedAt &&
        String(task.createdAt).slice(0, 10) >= params[1] &&
        String(task.createdAt).slice(0, 10) <= params[2]
      );
      const groups = new Map();
      reportTasks.forEach(task => {
        const group = groups.get(task.assignedTo) || { totalTasks: 0, completedTasks: 0, overdueTasks: 0 };
        group.totalTasks += 1;
        if (task.status === 'completed') group.completedTasks += 1;
        if (['new', 'active'].includes(task.status) && task.taskDate < new Date().toISOString().slice(0, 10)) group.overdueTasks += 1;
        groups.set(task.assignedTo, group);
      });
      return result([...groups].map(([assigneeId, counts]) => {
        const assignee = users.find(user => user.id === assigneeId && user.companyId === Number(params[0]));
        return {
          assigneeId,
          assigneeName: assignee?.firstName || 'Former employee',
          active: assignee?.active || false,
          ...counts
        };
      }).sort((a, b) => b.totalTasks - a.totalTasks));
    }
    if (text.startsWith('select id, company_id as "companyid", first_name as "firstname", email, role, department, job_title as "jobtitle"') && text.includes('password_hash as "passwordhash" from users where email')) {
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
    if (text.startsWith('select id,first_name as "firstname",email from users where id=$1 and company_id=$2 and role=\'employee\' and active=true')) {
      const user = users.find(item => item.id === Number(params[0]) && item.companyId === Number(params[1]) && item.role === 'employee' && item.active);
      return result(user ? [{ id: user.id, firstName: user.firstName, email: user.email }] : []);
    }
    if (text.startsWith('select id from users where id=$1 and company_id=$2 and role=\'employee\' and active=true')) {
      const manager = users.find(user =>
        user.id === Number(params[0]) &&
        user.companyId === Number(params[1]) &&
        user.role === 'employee' &&
        user.active
      );
      return result(manager ? [{ id: manager.id }] : []);
    }
    if (text.startsWith('select id from users where company_id=$1 and lower(email)=$2')) {
      const manager = users.find(user =>
        user.companyId === Number(params[0]) &&
        user.email.toLowerCase() === params[1] &&
        user.role === 'employee' &&
        user.active
      );
      return result(manager ? [{ id: manager.id }] : []);
    }
    if (text.startsWith('with recursive manager_chain as')) {
      let cursor = users.find(user =>
        user.id === Number(params[1]) && user.companyId === Number(params[0])
      );
      const visited = new Set();
      let createsCycle = false;
      while (cursor && !visited.has(cursor.id)) {
        if (cursor.id === Number(params[2])) createsCycle = true;
        visited.add(cursor.id);
        cursor = users.find(user => user.id === cursor.managerId && user.companyId === Number(params[0]));
      }
      return result([{ createsCycle }]);
    }
    if (text.startsWith('select id,first_name as "firstname",email from users where company_id=$1 and role=\'admin\' and active=true')) {
      return result(users
        .filter(user => user.companyId === Number(params[0]) && user.role === 'admin' && user.active)
        .map(user => ({ id: user.id, firstName: user.firstName, email: user.email })));
    }
    if (text.startsWith('select id,first_name as "firstname",email from users where id=$1 and company_id=$2 and active=true')) {
      const user = users.find(item => item.id === Number(params[0]) && item.companyId === Number(params[1]) && item.active);
      return result(user ? [{ id: user.id, firstName: user.firstName, email: user.email }] : []);
    }
    if (text.startsWith('select id,first_name as "firstname",email from users where id=any($1::int[])')) {
      const ids = new Set(params[0].map(Number));
      return result(users
        .filter(user => ids.has(user.id) && user.companyId === Number(params[1]) && user.active)
        .map(user => ({ id: user.id, firstName: user.firstName, email: user.email })));
    }
    if (text.startsWith('select 1 from users where id=$1 and company_id=$2 and role=\'employee\'')) {
      return result(users.some(user => user.id === Number(params[0]) && user.companyId === Number(params[1]) && user.role === 'employee') ? [{ '?column?': 1 }] : []);
    }
    if (text.startsWith('select id, company_id as "companyid", first_name as "firstname", email, role, department, job_title as "jobtitle"') && text.includes('from users where company_id=$1 and role=\'employee\'')) {
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
    if (text.startsWith('update users set first_name=$1,department=$2,job_title=coalesce')) {
      const employee = users.find(user => user.id === Number(params[5]) && user.companyId === Number(params[6]) && user.role === 'employee');
      if (!employee) return result([]);
      employee.firstName = params[0];
      employee.department = params[1];
      employee.jobTitle = params[2] ?? employee.jobTitle ?? '';
      employee.employmentType = params[3] ?? employee.employmentType ?? 'unspecified';
      if (params[7]) employee.hireDate = params[4];
      employee.team = params[8] ?? employee.team ?? 'General';
      if (params[9]) employee.managerId = params[10] == null ? null : Number(params[10]);
      return result([userFields(employee)]);
    }
    if (text.startsWith('select assigned_to as "assignedto",task_date as "taskdate" from tasks where id=$1')) {
      const task = tasks.find(item => item.id === Number(params[0]) && item.companyId === Number(params[1]) && !item.archivedAt);
      return result(task ? [{ assignedTo: task.assignedTo, taskDate: task.taskDate }] : []);
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
        jobTitle: params[6] || '',
        employmentType: params[7] || 'unspecified',
        hireDate: params[8] || null,
        team: params[9] || 'General',
        managerId: params[10] == null ? null : Number(params[10]),
        createdAt: new Date()
      };
      invitations.push(invitation);
      return result([{ id: invitation.id, expiresAt: invitation.expiresAt }]);
    }
    if (text.startsWith('select id,email,first_name as "firstname",department,job_title as "jobtitle"')) {
      return result(invitations.filter(item => item.companyId === Number(params[0])).map(item => ({
        id: item.id,
        email: item.email,
        firstName: item.firstName,
        department: item.department,
        jobTitle: item.jobTitle,
        employmentType: item.employmentType,
        hireDate: item.hireDate,
        team: item.team,
        managerId: item.managerId,
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
    if (text.startsWith('select i.first_name as "firstname",i.email,i.department,i.job_title as "jobtitle"')) {
      const invitation = invitations.find(item => item.tokenHash === params[0] && !item.acceptedAt && item.expiresAt > new Date());
      return result(invitation ? [{
        firstName: invitation.firstName,
        email: invitation.email,
        department: invitation.department,
        jobTitle: invitation.jobTitle,
        employmentType: invitation.employmentType,
        hireDate: invitation.hireDate,
        team: invitation.team,
        managerId: invitation.managerId,
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
    if (text.startsWith('update tasks set priority=$2')) {
      const requestedIds = new Set(params[0].map(Number));
      const changed = tasks.filter(task =>
        requestedIds.has(task.id) &&
        task.companyId === Number(params[2]) &&
        !task.archivedAt
      );
      changed.forEach(task => {
        task.priority = params[1];
        task.updatedAt = new Date().toISOString();
      });
      return result(changed.map(task => ({ id: task.id })));
    }
    if (text.startsWith('update tasks set archived_at=now()') && text.includes('id=any($1::int[])')) {
      const requestedIds = new Set(params[0].map(Number));
      const changed = tasks.filter(task =>
        requestedIds.has(task.id) &&
        task.companyId === Number(params[1]) &&
        !task.archivedAt
      );
      changed.forEach(task => {
        task.archivedAt = new Date().toISOString();
        task.updatedAt = new Date().toISOString();
      });
      return result(changed.map(task => ({ id: task.id })));
    }
    if (text.startsWith('update tasks set archived_at=null') && text.includes('id=any($1::int[])')) {
      const requestedIds = new Set(params[0].map(Number));
      const changed = tasks.filter(task =>
        requestedIds.has(task.id) &&
        task.companyId === Number(params[1]) &&
        Boolean(task.archivedAt)
      );
      changed.forEach(task => {
        task.archivedAt = null;
        task.updatedAt = new Date().toISOString();
      });
      return result(changed.map(task => ({ id: task.id })));
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
    { id: 1, companyId: 1, firstName: 'Admin', email: 'admin@example.test', passwordHash, role: 'admin', department: 'Management', jobTitle: '', employmentType: 'unspecified', hireDate: null, team: 'General', managerId: null, active: true, mfaEnabled: false, mfaSecret: null, mfaRecoveryCodes: [] },
    { id: 2, companyId: 1, firstName: 'Employee', email: 'employee@example.test', passwordHash, role: 'employee', department: 'Operations', jobTitle: '', employmentType: 'unspecified', hireDate: null, team: 'General', managerId: null, active: true, mfaEnabled: false, mfaSecret: null, mfaRecoveryCodes: [] },
    { id: 3, companyId: 1, firstName: 'Second Employee', email: 'second@example.test', passwordHash, role: 'employee', department: 'Research', jobTitle: '', employmentType: 'unspecified', hireDate: null, team: 'General', managerId: null, active: true, mfaEnabled: false, mfaSecret: null, mfaRecoveryCodes: [] }
  ];
});

beforeEach(() => {
  users = baseUsers.map(user => ({ ...user }));
  tasks = [];
  comments = [];
  notifications = [];
  auditEvents = [];
  leaveRequests = [];
  leavePolicies = [];
  invitations = [];
  passwordResets = [];
  slackWebhookEncrypted = null;
  onboardingEmployees = new Set();
  nextTaskId = 1;
  nextCommentId = 1;
  nextInvitationId = 1;
  nextLeaveId = 1;
  failAuditWrites = false;
  installQueryMock();
  mocks.sendInvitationEmail.mockReset();
  mocks.sendInvitationEmail.mockResolvedValue(undefined);
  mocks.sendLeaveRequestEmail.mockReset();
  mocks.sendLeaveRequestEmail.mockResolvedValue(undefined);
  mocks.sendLeaveDecisionEmail.mockReset();
  mocks.sendLeaveDecisionEmail.mockResolvedValue(undefined);
  mocks.sendTaskAssignedEmail.mockReset();
  mocks.sendTaskAssignedEmail.mockResolvedValue(undefined);
  mocks.sendTaskUpdateEmail.mockReset();
  mocks.sendTaskUpdateEmail.mockResolvedValue(undefined);
  mocks.clientQuery.mockReset();
  mocks.clientQuery.mockImplementation(async (sql, params = []) => {
  const text = normalize(sql);
  if (['begin', 'commit', 'rollback'].includes(text)) return result([]);
  if (text.startsWith('select id from users where id=$1 and company_id=$2 for update')) {
    const user = users.find(item => item.id === Number(params[0]) && item.companyId === Number(params[1]));
    return result(user ? [{ id: user.id }] : []);
  }
  if (text.startsWith('select id from leave_requests')) {
    const overlap = leaveRequests.find(leave =>
      leave.companyId === Number(params[0]) &&
      leave.userId === Number(params[1]) &&
      ['pending', 'approved'].includes(leave.status) &&
      leave.startDate <= params[3] &&
      leave.endDate >= params[2]
    );
    return result(overlap ? [{ id: overlap.id }] : []);
  }
  if (text.startsWith('select annual_allowance_days as "annualallowancedays" from company_leave_policies')) {
    const policy = leavePolicies.find(item =>
      item.companyId === Number(params[0]) && item.leaveType === params[1]
    );
    return result(policy ? [{ annualAllowanceDays: policy.annualAllowanceDays }] : []);
  }
  if (text.startsWith('select start_date::text as "startdate",end_date::text as "enddate" from leave_requests')) {
    return result(leaveRequests.filter(leave =>
      leave.companyId === Number(params[0]) &&
      leave.userId === Number(params[1]) &&
      leave.leaveType === params[2] &&
      ['pending', 'approved'].includes(leave.status) &&
      leave.startDate <= params[4] &&
      leave.endDate >= params[3]
    ).map(leave => ({ startDate: leave.startDate, endDate: leave.endDate })));
  }
  if (text.startsWith('insert into leave_requests(')) {
    const leave = {
      id: nextLeaveId++,
      companyId: Number(params[0]),
      userId: Number(params[1]),
      startDate: params[2],
      endDate: params[3],
      leaveType: params[4],
      reason: params[5],
      status: 'pending',
      reviewNote: null,
      reviewedBy: null,
      reviewedAt: null,
      createdAt: new Date().toISOString()
    };
    leaveRequests.push(leave);
    return result([{
      id: leave.id,
      userId: leave.userId,
      startDate: leave.startDate,
      endDate: leave.endDate,
      leaveType: leave.leaveType,
      reason: leave.reason,
      status: leave.status,
      createdAt: leave.createdAt
    }]);
  }
  if (text.startsWith('select id,first_name as "firstname",email from users where id=$1 and company_id=$2 and role=\'employee\' and active=true')) {
    const user = users.find(item => item.id === Number(params[0]) && item.companyId === Number(params[1]) && item.role === 'employee' && item.active);
    return result(user ? [{ id: user.id, firstName: user.firstName, email: user.email }] : []);
  }
  if (text.startsWith('insert into employee_onboarding(')) {
    const employeeId = Number(params[1]);
    if (onboardingEmployees.has(employeeId)) return result([]);
    onboardingEmployees.add(employeeId);
    return result([{ id: onboardingEmployees.size }]);
  }
  if (text.startsWith('insert into tasks(company_id,task_title,task_description,task_date,category,assigned_to,created_by,priority)')) {
    const task = {
      id: nextTaskId++,
      companyId: Number(params[0]),
      taskTitle: params[1],
      taskDescription: params[2],
      taskDate: params[3],
      category: 'Onboarding',
      assignedTo: Number(params[4]),
      createdBy: Number(params[5]),
      priority: 'medium',
      status: 'new',
      archivedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    tasks.push(task);
    return result([taskFields(task)]);
  }
  if (text.startsWith('select p.id,p.user_id,u.company_id from password_resets')) {
    const reset = passwordResets.find(item => item.tokenHash === params[0] && !item.usedAt);
    const user = reset && users.find(item => item.id === reset.userId);
    return result(reset && user ? [{ id: passwordResets.indexOf(reset) + 1, user_id: reset.userId, company_id: user.companyId }] : []);
  }
  if (text.startsWith('select * from invitations where token_hash=')) {
    const invitation = invitations.find(item => item.tokenHash === params[0] && !item.acceptedAt && item.expiresAt > new Date());
    return result(invitation ? [{
      id: invitation.id,
      company_id: invitation.companyId,
      email: invitation.email,
      first_name: invitation.firstName,
      department: invitation.department,
      job_title: invitation.jobTitle,
      employment_type: invitation.employmentType,
      hire_date: invitation.hireDate,
      team: invitation.team,
      manager_id: invitation.managerId
    }] : []);
  }
  if (text.startsWith('select id,name,slug,industry,size,active from companies where id=')) {
    return result(company.id === Number(params[0]) ? [company] : []);
  }
  if (text.startsWith('insert into users(company_id,first_name,email,password_hash,role,department,job_title,employment_type,hire_date,team,manager_id)')) {
    const user = {
      id: Math.max(...users.map(item => item.id)) + 1,
      companyId: Number(params[0]),
      firstName: params[1],
      email: params[2],
      passwordHash: params[3],
      role: 'employee',
      department: params[4],
      jobTitle: params[5] || '',
      employmentType: params[6] || 'unspecified',
      hireDate: params[7] || null,
      team: params[8] || 'General',
      managerId: params[9] == null ? null : Number(params[9]),
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
  it('exposes low-cardinality Prometheus metrics only with a configured secret', async () => {
    await request(app).get('/api/metrics').expect(404);
    const metrics = await request(app).get('/api/metrics')
      .set('Authorization', 'Bearer wrong-token')
      .expect(404);
    expect(metrics.text).not.toContain('employeems_http_requests_total');

    const authorized = await request(app).get('/api/metrics')
      .set('Authorization', `Bearer ${process.env.METRICS_TOKEN}`)
      .expect(200)
      .expect('Content-Type', /text\/plain/);
    expect(authorized.text).toContain('employeems_http_requests_total');
    expect(authorized.text).toContain('employeems_database_pool_connections{state="idle"} 1');
    expect(authorized.text).not.toContain('/api/');
  });

  it('creates a one-time onboarding checklist from assigned, trackable tasks', async () => {
    const login = await request(app).post('/api/auth/login').send({
      email: 'admin@example.test',
      password: 'correct-horse-battery-123'
    }).expect(200);
    const token = login.body.token;

    const created = await request(app).post('/api/employees/2/onboarding')
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    expect(created.body.tasksCreated).toBe(5);
    expect(tasks).toHaveLength(5);
    expect(tasks.every(task => task.category === 'Onboarding' && task.assignedTo === 2)).toBe(true);
    expect(notifications).toHaveLength(5);

    await request(app).post('/api/employees/2/onboarding')
      .set('Authorization', `Bearer ${token}`)
      .expect(409);
    expect(tasks).toHaveLength(5);

    const employees = await request(app).get('/api/employees')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(employees.body.find(employee => employee.id === 2).onboardingCreated).toBe(true);
  });

  it('secures workspace Slack settings and sends task-assignment notifications', async () => {
    const adminLogin = await request(app).post('/api/auth/login').send({
      email: 'admin@example.test',
      password: 'correct-horse-battery-123'
    }).expect(200);
    const employeeLogin = await request(app).post('/api/auth/login').send({
      email: 'employee@example.test',
      password: 'correct-horse-battery-123'
    }).expect(200);
    const adminToken = adminLogin.body.token;
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => 'ok' });
    vi.stubGlobal('fetch', fetchMock);
    try {
      await request(app).get('/api/integrations/slack')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200, { configured: false });
      await request(app).get('/api/integrations/slack')
        .set('Authorization', `Bearer ${employeeLogin.body.token}`)
        .expect(403);
      await request(app).post('/api/integrations/slack')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ webhookUrl: 'https://example.test/services/T1/B1/token' })
        .expect(400);

      const webhookUrl = 'https://hooks.slack.com/services/T111/B222/secretToken123';
      await request(app).post('/api/integrations/slack')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ webhookUrl })
        .expect(200, { configured: true });
      expect(slackWebhookEncrypted).not.toBe(webhookUrl);
      expect(decryptSecret(slackWebhookEncrypted)).toBe(webhookUrl);

      await request(app).post('/api/tasks')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          taskTitle: 'Review <launch> & confirm',
          taskDescription: 'Complete the project handoff.',
          taskDate: '2099-12-31',
          category: 'Operations',
          assignedTo: 2,
          priority: 'high'
        }).expect(201);
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
      expect(fetchMock.mock.calls[0][0]).toBe(webhookUrl);
      expect(JSON.parse(fetchMock.mock.calls[0][1].body).text).toContain('&lt;launch&gt; &amp; confirm');

      await request(app).delete('/api/integrations/slack')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200, { configured: false });
      expect(slackWebhookEncrypted).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('enables authenticator MFA, requires it at login, consumes recovery codes once, and can disable it', async () => {
    const login = await request(app).post('/api/auth/login').send({
      email: 'admin@example.test',
      password: 'correct-horse-battery-123'
    }).expect(200);
    const token = login.body.token;

    await request(app).get('/api/auth/mfa')
      .set('Authorization', `Bearer ${token}`)
      .expect(200, { enabled: false, setupPending: false, recoveryCodesRemaining: 0 });

    const setup = await request(app).post('/api/auth/mfa/setup')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'correct-horse-battery-123' })
      .expect(200);
    expect(setup.body.secret).toMatch(/^[A-Z2-7]+$/);
    expect(setup.body.otpauthUri).toContain(setup.body.secret);
    expect(users[0].mfaSecret).not.toBe(setup.body.secret);

    const setupCode = createTotpCode(setup.body.secret);
    const enabled = await request(app).post('/api/auth/mfa/enable')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: setupCode })
      .expect(200);
    expect(enabled.body.recoveryCodes).toHaveLength(10);
    expect(users[0].mfaEnabled).toBe(true);

    const challenge = await request(app).post('/api/auth/login').send({
      email: 'admin@example.test',
      password: 'correct-horse-battery-123'
    }).expect(200);
    expect(challenge.body).toEqual({ mfaRequired: true });

    await request(app).post('/api/auth/login').send({
      email: 'admin@example.test',
      password: 'correct-horse-battery-123',
      mfaCode: '000000'
    }).expect(401);

    const verified = await request(app).post('/api/auth/login').send({
      email: 'admin@example.test',
      password: 'correct-horse-battery-123',
      mfaCode: createTotpCode(decryptTotpSecret(users[0].mfaSecret))
    }).expect(200);
    expect(verified.body.token).toBeTruthy();

    const recoveryCode = enabled.body.recoveryCodes[0];
    await request(app).post('/api/auth/login').send({
      email: 'admin@example.test',
      password: 'correct-horse-battery-123',
      mfaCode: recoveryCode
    }).expect(200);
    await request(app).post('/api/auth/login').send({
      email: 'admin@example.test',
      password: 'correct-horse-battery-123',
      mfaCode: recoveryCode
    }).expect(401);

    await request(app).post('/api/auth/mfa/disable')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'correct-horse-battery-123', code: createTotpCode(decryptTotpSecret(users[0].mfaSecret)) })
      .expect(200, { enabled: false });
    expect(users[0].mfaSecret).toBeNull();
    expect(users[0].mfaEnabled).toBe(false);
  });

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
    expect(created.body.emailSent).toBe(true);
    expect(created.body.emailStatus).toBe('sent');
    expect(mocks.sendTaskAssignedEmail).toHaveBeenCalledWith(expect.objectContaining({
      recipientEmail: 'employee@example.test',
      recipientName: 'Employee',
      companyName: 'Test Workspace',
      assignedBy: 'Admin',
      task: expect.objectContaining({ taskTitle: 'Prepare launch checklist' })
    }));
    expect(notifications.some(item => item.userId === 2 && item.type === 'assigned')).toBe(true);

    await request(app).get('/api/tasks')
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(200)
      .then(response => expect(response.body.map(task => task.id)).toEqual([created.body.id]));

    const dueDateUpdate = await request(app).patch(`/api/tasks/${created.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        taskTitle: 'Prepare launch checklist',
        taskDescription: 'Review all production-readiness items.',
        taskDate: '2099-12-30',
        category: 'Operations',
        assignedTo: 2,
        priority: 'high'
      }).expect(200);
    expect(dueDateUpdate.body.emailStatus).toBe('sent');
    expect(mocks.sendTaskUpdateEmail).toHaveBeenCalledWith(expect.objectContaining({
      recipientEmail: 'employee@example.test',
      updateType: 'due_date',
      updateDetails: '2099-12-30'
    }));

    const activated = await request(app).patch(`/api/tasks/${created.body.id}/status`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ status: 'active' }).expect(200);
    expect(activated.body.emailStatus).toBe('sent');
    expect(mocks.sendTaskUpdateEmail).toHaveBeenCalledWith(expect.objectContaining({
      recipientEmail: 'admin@example.test',
      updateType: 'status',
      updateDetails: 'active'
    }));
    const comment = await request(app).post(`/api/tasks/${created.body.id}/comments`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ content: 'I started the checklist.' }).expect(201);
    expect(comment.body.emailStatus).toBe('sent');
    expect(mocks.sendTaskUpdateEmail).toHaveBeenCalledWith(expect.objectContaining({
      recipientEmail: 'admin@example.test',
      updateType: 'comment',
      updateDetails: 'I started the checklist.'
    }));
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

  it('keeps task changes successful when task-update email delivery fails', async () => {
    const adminLogin = await request(app).post('/api/auth/login').send({
      email: 'admin@example.test',
      password: 'correct-horse-battery-123'
    }).expect(200);
    const created = await request(app).post('/api/tasks')
      .set('Authorization', `Bearer ${adminLogin.body.token}`)
      .send({
        taskTitle: 'Prepare launch checklist',
        taskDescription: 'Review all production-readiness items.',
        taskDate: '2099-12-31',
        category: 'Operations',
        assignedTo: 2,
        priority: 'high'
      }).expect(201);
    mocks.sendTaskUpdateEmail.mockRejectedValue(new Error('provider unavailable'));

    const response = await request(app).patch(`/api/tasks/${created.body.id}/status`)
      .set('Authorization', `Bearer ${adminLogin.body.token}`)
      .send({ status: 'active' }).expect(200);

    expect(response.body.active).toBe(true);
    expect(response.body.emailStatus).toBe('failed');
    expect(tasks[0].status).toBe('active');
  });

  it('bulk-updates only matching company tasks and reports skipped IDs', async () => {
    const adminLogin = await request(app).post('/api/auth/login').send({
      email: 'admin@example.test',
      password: 'correct-horse-battery-123'
    }).expect(200);
    const employeeLogin = await request(app).post('/api/auth/login').send({
      email: 'employee@example.test',
      password: 'correct-horse-battery-123'
    }).expect(200);
    tasks = [
      { id: 101, companyId: 1, taskTitle: 'Open task', taskDate: '2099-12-31', assignedTo: 2, createdBy: 1, status: 'new', priority: 'low', archivedAt: null },
      { id: 102, companyId: 1, taskTitle: 'Archived task', taskDate: '2099-12-31', assignedTo: 2, createdBy: 1, status: 'new', priority: 'low', archivedAt: '2025-01-01' },
      { id: 103, companyId: 2, taskTitle: 'Other workspace task', taskDate: '2099-12-31', assignedTo: 2, createdBy: 1, status: 'new', priority: 'low', archivedAt: null }
    ];

    const prioritized = await request(app).post('/api/tasks/bulk')
      .set('Authorization', `Bearer ${adminLogin.body.token}`)
      .send({ taskIds: [101, 103, 999, 101], action: 'priority', priority: 'high' })
      .expect(200);
    expect(prioritized.body).toMatchObject({ requestedCount: 3, updatedCount: 1, skippedCount: 2, updatedIds: [101] });
    expect(tasks.map(task => task.priority)).toEqual(['high', 'low', 'low']);

    const archived = await request(app).post('/api/tasks/bulk')
      .set('Authorization', `Bearer ${adminLogin.body.token}`)
      .send({ taskIds: [101, 102], action: 'archive' })
      .expect(200);
    expect(archived.body).toMatchObject({ updatedCount: 1, skippedCount: 1 });
    const restored = await request(app).post('/api/tasks/bulk')
      .set('Authorization', `Bearer ${adminLogin.body.token}`)
      .send({ taskIds: [101, 103], action: 'restore' })
      .expect(200);
    expect(restored.body).toMatchObject({ updatedCount: 1, skippedCount: 1 });
    expect(tasks[0].archivedAt).toBeNull();
    expect(tasks[1].archivedAt).toBe('2025-01-01');
    const restoredPreviouslyArchived = await request(app).post('/api/tasks/bulk')
      .set('Authorization', `Bearer ${adminLogin.body.token}`)
      .send({ taskIds: [102], action: 'restore' })
      .expect(200);
    expect(restoredPreviouslyArchived.body.updatedCount).toBe(1);
    expect(tasks[1].archivedAt).toBeNull();

    await request(app).post('/api/tasks/bulk')
      .set('Authorization', `Bearer ${adminLogin.body.token}`)
      .send({ taskIds: [101], action: 'priority' })
      .expect(400);
    await request(app).post('/api/tasks/bulk')
      .set('Authorization', `Bearer ${employeeLogin.body.token}`)
      .send({ taskIds: [101], action: 'archive' })
      .expect(403);
  });

  it('returns tenant-scoped task reports for the requested creation period', async () => {
    const adminLogin = await request(app).post('/api/auth/login').send({
      email: 'admin@example.test',
      password: 'correct-horse-battery-123'
    }).expect(200);
    const employeeLogin = await request(app).post('/api/auth/login').send({
      email: 'employee@example.test',
      password: 'correct-horse-battery-123'
    }).expect(200);
    tasks = [
      { id: 201, companyId: 1, taskTitle: 'Overdue task', createdAt: '2026-10-10T12:00:00Z', taskDate: '2026-10-20', category: 'Operations', assignedTo: 2, status: 'active', priority: 'high', archivedAt: null },
      { id: 202, companyId: 1, taskTitle: 'Completed task', createdAt: '2026-10-20T12:00:00Z', taskDate: '2099-12-31', category: 'Research', assignedTo: 3, status: 'completed', priority: 'low', archivedAt: null },
      { id: 203, companyId: 2, taskTitle: 'Other workspace task', createdAt: '2026-10-12T12:00:00Z', taskDate: '2026-10-15', category: 'Operations', assignedTo: 2, status: 'active', priority: 'high', archivedAt: null },
      { id: 204, companyId: 1, taskTitle: 'Outside report range', createdAt: '2026-09-30T12:00:00Z', taskDate: '2099-12-31', category: 'Research', assignedTo: 2, status: 'new', priority: 'medium', archivedAt: null },
      { id: 205, companyId: 1, taskTitle: 'Archived task', createdAt: '2026-10-15T12:00:00Z', taskDate: '2026-10-20', category: 'Operations', assignedTo: 2, status: 'active', priority: 'high', archivedAt: '2026-10-16T00:00:00Z' }
    ];

    const report = await request(app).get('/api/reports/tasks?from=2026-10-01&to=2026-10-31')
      .set('Authorization', `Bearer ${adminLogin.body.token}`)
      .expect(200);
    expect(report.body.range).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(report.body.summary).toMatchObject({
      totalTasks: 2,
      newTasks: 0,
      activeTasks: 1,
      completedTasks: 1,
      failedTasks: 0,
      overdueTasks: 1
    });
    expect(report.body.statusBreakdown).toEqual([
      { status: 'active', count: 1 },
      { status: 'completed', count: 1 }
    ]);
    expect(report.body.categoryBreakdown).toEqual([
      { category: 'Operations', count: 1 },
      { category: 'Research', count: 1 }
    ]);
    expect(report.body.assigneeBreakdown).toMatchObject([
      { assigneeId: 2, assigneeName: 'Employee', totalTasks: 1, overdueTasks: 1 },
      { assigneeId: 3, assigneeName: 'Second Employee', totalTasks: 1, completedTasks: 1 }
    ]);

    await request(app).get('/api/reports/tasks?from=2026-02-30&to=2026-03-01')
      .set('Authorization', `Bearer ${adminLogin.body.token}`)
      .expect(400);
    await request(app).get('/api/reports/tasks?from=2026-11-01&to=2026-10-01')
      .set('Authorization', `Bearer ${adminLogin.body.token}`)
      .expect(400);
    await request(app).get('/api/reports/tasks?from=2026-10-01&to=2026-10-31')
      .set('Authorization', `Bearer ${employeeLogin.body.token}`)
      .expect(403);
  });

  it('bulk-creates secure invitations with per-row validation and duplicate handling', async () => {
    const adminLogin = await request(app).post('/api/auth/login').send({
      email: 'admin@example.test',
      password: 'correct-horse-battery-123'
    }).expect(200);
    const employeeLogin = await request(app).post('/api/auth/login').send({
      email: 'employee@example.test',
      password: 'correct-horse-battery-123'
    }).expect(200);

    const response = await request(app).post('/api/invitations/bulk')
      .set('Authorization', `Bearer ${adminLogin.body.token}`)
      .send({
        employees: [
          {
            row: 2,
            firstName: '  New Teammate  ',
            email: 'New.Person@example.test',
            department: 'Operations',
            team: 'Platform',
            managerEmail: 'employee@example.test',
            jobTitle: 'Operations Analyst',
            employmentType: 'full_time',
            hireDate: '2026-03-15'
          },
          { row: 3, firstName: 'Duplicate Row', email: 'new.person@example.test', department: 'Operations' },
          { row: 4, firstName: 'Known User', email: 'employee@example.test', department: 'Support' },
          { row: 5, firstName: 'Invalid Email', email: 'not-an-email', department: 'Support' },
          { row: 6, firstName: 'Default Department', email: 'another.person@example.test' }
        ]
      })
      .expect(200);

    expect(response.body).toMatchObject({
      totalCount: 5,
      invitedCount: 2,
      failedCount: 3,
      emailSentCount: 2
    });
    expect(response.body.results).toMatchObject([
      { row: 2, email: 'new.person@example.test', status: 'invited', emailStatus: 'sent' },
      { row: 3, email: 'new.person@example.test', status: 'failed' },
      { row: 4, email: 'employee@example.test', status: 'failed', error: 'This email already belongs to an account' },
      { row: 5, status: 'failed' },
      { row: 6, email: 'another.person@example.test', status: 'invited' }
    ]);
    expect(response.body.results[0].inviteUrl).toMatch(/^https:\/\/employee-ms\.test\/invite\/[a-f0-9]{64}$/);
    expect(invitations).toHaveLength(2);
    expect(invitations.every(invitation => invitation.companyId === company.id)).toBe(true);
    expect(invitations.find(invitation => invitation.email === 'new.person@example.test')).toMatchObject({
      jobTitle: 'Operations Analyst',
      employmentType: 'full_time',
      hireDate: '2026-03-15',
      team: 'Platform',
      managerId: 2
    });
    expect(mocks.sendInvitationEmail).toHaveBeenCalledTimes(2);

    await request(app).post('/api/invitations/bulk')
      .set('Authorization', `Bearer ${employeeLogin.body.token}`)
      .send({ employees: [{ firstName: 'Not Admin', email: 'not-admin@example.test' }] })
      .expect(403);
    await request(app).post('/api/invitations/bulk')
      .set('Authorization', `Bearer ${adminLogin.body.token}`)
      .send({ employees: Array.from({ length: 101 }, (_, index) => ({ firstName: `Employee ${index}`, email: `person${index}@example.test` })) })
      .expect(400);
  });

  it('keeps audit records private to workspace admins and omits credentials and invitation tokens', async () => {
    const adminLogin = await request(app).post('/api/auth/login').send({
      email: 'admin@example.test',
      password: 'correct-horse-battery-123'
    }).expect(200);
    const employeeLogin = await request(app).post('/api/auth/login').send({
      email: 'employee@example.test',
      password: 'correct-horse-battery-123'
    }).expect(200);

    await request(app).post('/api/invitations')
      .set('Authorization', `Bearer ${adminLogin.body.token}`)
      .send({ firstName: 'New Teammate', email: 'new.person@example.test', department: 'Operations' })
      .expect(201);
    await request(app).post('/api/tasks')
      .set('Authorization', `Bearer ${adminLogin.body.token}`)
      .send({
        taskTitle: 'Audited task',
        taskDescription: 'This task should be recorded in the audit trail.',
        taskDate: '2099-12-31',
        category: 'Operations',
        assignedTo: 2,
        priority: 'high'
      })
      .expect(201);
    auditEvents.push({
      id: auditEvents.length + 1,
      companyId: 2,
      actorId: 99,
      action: 'employee.access_deactivated',
      entityType: 'user',
      entityId: '4',
      details: {},
      requestId: 'other-company-request',
      createdAt: new Date().toISOString()
    });

    const visible = await request(app).get('/api/audit-events')
      .set('Authorization', `Bearer ${adminLogin.body.token}`)
      .expect(200);
    expect(visible.body.map(event => event.action)).toEqual([
      'task.created',
      'invitation.created'
    ]);
    expect(visible.body.every(event => event.actorName === 'Admin')).toBe(true);
    expect(JSON.stringify(visible.body)).not.toContain('invite/');
    expect(JSON.stringify(visible.body)).not.toContain('password');
    await request(app).get('/api/audit-events')
      .set('Authorization', `Bearer ${employeeLogin.body.token}`)
      .expect(403);
    await request(app).get('/api/audit-events').expect(401);
  });

  it('does not undo a successful task write when audit storage is unavailable', async () => {
    const adminLogin = await request(app).post('/api/auth/login').send({
      email: 'admin@example.test',
      password: 'correct-horse-battery-123'
    }).expect(200);
    failAuditWrites = true;
    const logError = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const response = await request(app).post('/api/tasks')
        .set('Authorization', `Bearer ${adminLogin.body.token}`)
        .send({
          taskTitle: 'Task survives audit issue',
          taskDescription: 'The task write should succeed independently.',
          taskDate: '2099-12-31',
          category: 'Operations',
          assignedTo: 2,
          priority: 'medium'
        })
        .expect(201);
      expect(response.body.taskTitle).toBe('Task survives audit issue');
      expect(tasks).toHaveLength(1);
      expect(logError).toHaveBeenCalledWith('Audit event write failed:', expect.objectContaining({
        action: 'task.created'
      }));
    } finally {
      logError.mockRestore();
    }
  });

  it('lets employees request and cancel leave while admins review within their workspace', async () => {
    const adminLogin = await request(app).post('/api/auth/login').send({
      email: 'admin@example.test',
      password: 'correct-horse-battery-123'
    }).expect(200);
    const employeeLogin = await request(app).post('/api/auth/login').send({
      email: 'employee@example.test',
      password: 'correct-horse-battery-123'
    }).expect(200);
    const secondEmployeeLogin = await request(app).post('/api/auth/login').send({
      email: 'second@example.test',
      password: 'correct-horse-battery-123'
    }).expect(200);

    await request(app).post('/api/leave-requests')
      .set('Authorization', `Bearer ${adminLogin.body.token}`)
      .send({ startDate: '2026-12-01', endDate: '2026-12-02', leaveType: 'vacation', reason: 'Family trip' })
      .expect(403);

    const requested = await request(app).post('/api/leave-requests')
      .set('Authorization', `Bearer ${employeeLogin.body.token}`)
      .send({ startDate: '2026-12-01', endDate: '2026-12-02', leaveType: 'vacation', reason: 'Family trip' })
      .expect(201);
    expect(requested.body).toMatchObject({
      userId: 2,
      employeeName: 'Employee',
      status: 'pending',
      leaveType: 'vacation',
      emailStatus: 'sent'
    });
    expect(mocks.sendLeaveRequestEmail).toHaveBeenCalledOnce();
    expect(mocks.sendLeaveRequestEmail).toHaveBeenCalledWith(expect.objectContaining({
      recipientEmail: 'admin@example.test',
      recipientName: 'Admin',
      employeeName: 'Employee',
      companyName: 'Test Workspace',
      leave: expect.objectContaining({ startDate: '2026-12-01', endDate: '2026-12-02', reason: 'Family trip' })
    }));
    await request(app).post('/api/leave-requests')
      .set('Authorization', `Bearer ${employeeLogin.body.token}`)
      .send({ startDate: '2026-12-02', endDate: '2026-12-04', leaveType: 'personal', reason: 'Overlapping dates' })
      .expect(409);
    await request(app).post('/api/leave-requests')
      .set('Authorization', `Bearer ${employeeLogin.body.token}`)
      .send({ startDate: '2026-12-05', endDate: '2026-12-04', leaveType: 'personal', reason: 'Invalid date range' })
      .expect(400);

    const ownRequests = await request(app).get('/api/leave-requests')
      .set('Authorization', `Bearer ${employeeLogin.body.token}`)
      .expect(200);
    expect(ownRequests.body).toMatchObject([{ id: requested.body.id, employeeName: 'Employee' }]);
    expect(ownRequests.body).toHaveLength(1);
    await request(app).delete(`/api/leave-requests/${requested.body.id}`)
      .set('Authorization', `Bearer ${secondEmployeeLogin.body.token}`)
      .expect(404);
    await request(app).delete(`/api/leave-requests/${requested.body.id}`)
      .set('Authorization', `Bearer ${employeeLogin.body.token}`)
      .expect(204);

    const pending = await request(app).post('/api/leave-requests')
      .set('Authorization', `Bearer ${employeeLogin.body.token}`)
      .send({ startDate: '2026-12-10', endDate: '2026-12-12', leaveType: 'sick', reason: 'Medical leave' })
      .expect(201);
    const adminRequests = await request(app).get('/api/leave-requests')
      .set('Authorization', `Bearer ${adminLogin.body.token}`)
      .expect(200);
    expect(adminRequests.body).toMatchObject([
      { id: pending.body.id, employeeName: 'Employee', status: 'pending' },
      { id: requested.body.id, status: 'cancelled' }
    ]);

    const reviewed = await request(app).patch(`/api/leave-requests/${pending.body.id}/review`)
      .set('Authorization', `Bearer ${adminLogin.body.token}`)
      .send({ status: 'approved', reviewNote: 'Approved. Please coordinate coverage.' })
      .expect(200);
    expect(reviewed.body).toMatchObject({
      id: pending.body.id,
      status: 'approved',
      reviewNote: 'Approved. Please coordinate coverage.',
      emailStatus: 'sent'
    });
    expect(mocks.sendLeaveDecisionEmail).toHaveBeenCalledOnce();
    expect(mocks.sendLeaveDecisionEmail).toHaveBeenCalledWith(expect.objectContaining({
      recipientEmail: 'employee@example.test',
      recipientName: 'Employee',
      companyName: 'Test Workspace',
      reviewerName: 'Admin',
      leave: expect.objectContaining({
        startDate: '2026-12-10',
        endDate: '2026-12-12',
        leaveType: 'sick',
        status: 'approved',
        reviewNote: 'Approved. Please coordinate coverage.'
      })
    }));
    await request(app).patch(`/api/leave-requests/${pending.body.id}/review`)
      .set('Authorization', `Bearer ${adminLogin.body.token}`)
      .send({ status: 'rejected' })
      .expect(404);
    await request(app).patch(`/api/leave-requests/${pending.body.id}/review`)
      .set('Authorization', `Bearer ${employeeLogin.body.token}`)
      .send({ status: 'rejected' })
      .expect(403);
    expect(auditEvents.map(event => event.action)).toEqual([
      'leave.requested',
      'leave.cancelled',
      'leave.requested',
      'leave.approved'
    ]);
  });

  it('configures annual leave allowances, enforces reserved balances, and shares private approved absences', async () => {
    const adminLogin = await request(app).post('/api/auth/login').send({
      email: 'admin@example.test',
      password: 'correct-horse-battery-123'
    }).expect(200);
    const employeeLogin = await request(app).post('/api/auth/login').send({
      email: 'employee@example.test',
      password: 'correct-horse-battery-123'
    }).expect(200);
    const adminAuth = `Bearer ${adminLogin.body.token}`;
    const employeeAuth = `Bearer ${employeeLogin.body.token}`;

    const defaults = await request(app).get('/api/leave-policies').set('Authorization', employeeAuth).expect(200);
    expect(defaults.body).toEqual([
      { leaveType: 'vacation', annualAllowanceDays: null },
      { leaveType: 'sick', annualAllowanceDays: null },
      { leaveType: 'personal', annualAllowanceDays: null },
      { leaveType: 'other', annualAllowanceDays: null }
    ]);

    const configuredPolicies = [
      { leaveType: 'vacation', annualAllowanceDays: 3 },
      { leaveType: 'sick', annualAllowanceDays: 5 },
      { leaveType: 'personal', annualAllowanceDays: 2 },
      { leaveType: 'other', annualAllowanceDays: null }
    ];
    await request(app).put('/api/leave-policies')
      .set('Authorization', employeeAuth)
      .send({ policies: configuredPolicies })
      .expect(403);
    await request(app).put('/api/leave-policies')
      .set('Authorization', adminAuth)
      .send({ policies: configuredPolicies.slice(1) })
      .expect(400);
    const savedPolicies = await request(app).put('/api/leave-policies')
      .set('Authorization', adminAuth)
      .send({ policies: configuredPolicies })
      .expect(200);
    expect(savedPolicies.body).toEqual(configuredPolicies);

    const requested = await request(app).post('/api/leave-requests')
      .set('Authorization', employeeAuth)
      .send({ startDate: '2026-12-01', endDate: '2026-12-02', leaveType: 'vacation', reason: 'Family trip' })
      .expect(201);
    await request(app).post('/api/leave-requests')
      .set('Authorization', employeeAuth)
      .send({ startDate: '2026-12-03', endDate: '2026-12-04', leaveType: 'vacation', reason: 'More time away' })
      .expect(409);

    const balance = await request(app).get('/api/leave-balance?year=2026').set('Authorization', employeeAuth).expect(200);
    expect(balance.body).toContainEqual({
      leaveType: 'vacation',
      annualAllowanceDays: 3,
      approvedDays: 0,
      pendingDays: 2,
      remainingDays: 1
    });

    await request(app).patch(`/api/leave-requests/${requested.body.id}/review`)
      .set('Authorization', adminAuth)
      .send({ status: 'approved' })
      .expect(200);
    const calendar = await request(app).get('/api/leave-calendar?from=2026-12-01&to=2026-12-31')
      .set('Authorization', employeeAuth)
      .expect(200);
    expect(calendar.body).toEqual([{
      userId: 2,
      employeeName: 'Employee',
      department: 'Operations',
      startDate: '2026-12-01',
      endDate: '2026-12-02'
    }]);
    expect(calendar.body[0]).not.toHaveProperty('reason');
    expect(calendar.body[0]).not.toHaveProperty('leaveType');
    expect(auditEvents.map(event => event.action)).toContain('leave.policies_updated');
  });

  it('keeps leave workflows successful and reports status when email delivery fails', async () => {
    const adminLogin = await request(app).post('/api/auth/login').send({
      email: 'admin@example.test',
      password: 'correct-horse-battery-123'
    }).expect(200);
    const employeeLogin = await request(app).post('/api/auth/login').send({
      email: 'employee@example.test',
      password: 'correct-horse-battery-123'
    }).expect(200);
    const logError = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      mocks.sendLeaveRequestEmail.mockRejectedValue(new Error('provider unavailable'));
      const requested = await request(app).post('/api/leave-requests')
        .set('Authorization', `Bearer ${employeeLogin.body.token}`)
        .send({ startDate: '2026-12-20', endDate: '2026-12-21', leaveType: 'personal', reason: 'Personal matter' })
        .expect(201);
      expect(requested.body).toMatchObject({ status: 'pending', emailStatus: 'failed' });
      expect(leaveRequests).toHaveLength(1);

      mocks.sendLeaveDecisionEmail.mockRejectedValue(new Error('provider unavailable'));
      const approved = await request(app).patch(`/api/leave-requests/${requested.body.id}/review`)
        .set('Authorization', `Bearer ${adminLogin.body.token}`)
        .send({ status: 'approved' })
        .expect(200);
      expect(approved.body).toMatchObject({ status: 'approved', emailStatus: 'failed' });
      expect(leaveRequests[0].status).toBe('approved');
      expect(logError).toHaveBeenCalledTimes(2);
    } finally {
      logError.mockRestore();
    }
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
    const employeeLogin = await request(app).post('/api/auth/login').send({
      email: 'employee@example.test',
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
      .send({
        firstName: 'Updated Employee',
        department: 'Support',
        jobTitle: 'Support Specialist',
        employmentType: 'part_time',
        hireDate: '2026-03-15',
        team: 'Customer Success',
        managerId: 3
      }).expect(200)
      .then(response => expect(response.body).toMatchObject({
        firstName: 'Updated Employee',
        department: 'Support',
        jobTitle: 'Support Specialist',
        employmentType: 'part_time',
        hireDate: '2026-03-15',
        team: 'Customer Success',
        managerId: 3
      }));
    await request(app).patch('/api/employees/3')
      .set('Authorization', `Bearer ${adminLogin.body.token}`)
      .send({ firstName: 'Second Employee', department: 'Research', managerId: 2 })
      .expect(400)
      .expect(response => expect(response.body.message).toMatch(/reporting cycle/));
    await request(app).patch('/api/employees/3')
      .set('Authorization', `Bearer ${adminLogin.body.token}`)
      .send({ firstName: 'Second Employee', department: 'Research', managerId: 999 })
      .expect(400);
    await request(app).get('/api/employees')
      .set('Authorization', `Bearer ${adminLogin.body.token}`)
      .expect(200)
      .then(response => expect(response.body).toContainEqual(expect.objectContaining({
        id: 2,
        team: 'Customer Success',
        managerId: 3
      })));
    await request(app).get('/api/auth/me')
      .set('Authorization', `Bearer ${employeeLogin.body.token}`)
      .expect(200)
      .then(response => expect(response.body.user).toMatchObject({
        team: 'Customer Success',
        managerId: 3
      }));
    await request(app).get('/api/dashboard/employee')
      .set('Authorization', `Bearer ${employeeLogin.body.token}`)
      .expect(200)
      .then(response => expect(response.body.user).toMatchObject({
        team: 'Customer Success',
        managerId: 3
      }));

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

  it('keeps task creation successful and reports when assignment email fails', async () => {
    const adminLogin = await request(app).post('/api/auth/login').send({
      email: 'admin@example.test',
      password: 'correct-horse-battery-123'
    }).expect(200);
    mocks.sendTaskAssignedEmail.mockRejectedValue(Object.assign(new Error('Brevo unavailable'), {
      code: 'provider_rejected',
      status: 503,
      providerCode: 'temporarily_unavailable'
    }));
    const logError = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const response = await request(app).post('/api/tasks')
        .set('Authorization', `Bearer ${adminLogin.body.token}`)
        .send({
          taskTitle: 'Persist despite mail issue',
          taskDescription: 'Task creation must not depend on the email provider.',
          taskDate: '2099-12-31',
          category: 'Operations',
          assignedTo: 2,
          priority: 'medium'
        }).expect(201);
      expect(response.body.taskTitle).toBe('Persist despite mail issue');
      expect(response.body.emailSent).toBe(false);
      expect(response.body.emailStatus).toBe('provider_rejected');
    } finally {
      logError.mockRestore();
    }
  });

  it('emails the new owner when an admin reassigns an existing task', async () => {
    const adminLogin = await request(app).post('/api/auth/login').send({
      email: 'admin@example.test',
      password: 'correct-horse-battery-123'
    }).expect(200);
    const payload = {
      taskTitle: 'Reassigned task',
      taskDescription: 'Notify whoever currently owns this task.',
      taskDate: '2099-12-31',
      category: 'Operations',
      assignedTo: 2,
      priority: 'medium'
    };
    const created = await request(app).post('/api/tasks')
      .set('Authorization', `Bearer ${adminLogin.body.token}`)
      .send(payload).expect(201);
    mocks.sendTaskAssignedEmail.mockClear();

    const updated = await request(app).patch(`/api/tasks/${created.body.id}`)
      .set('Authorization', `Bearer ${adminLogin.body.token}`)
      .send({ ...payload, assignedTo: 3 }).expect(200);

    expect(updated.body.emailSent).toBe(true);
    expect(mocks.sendTaskAssignedEmail).toHaveBeenCalledOnce();
    expect(mocks.sendTaskAssignedEmail).toHaveBeenCalledWith(expect.objectContaining({
      recipientEmail: 'second@example.test',
      recipientName: 'Second Employee'
    }));
  });

  it('creates an invitation, refreshes the link, and accepts it exactly once', async () => {
    const adminLogin = await request(app).post('/api/auth/login').send({
      email: 'admin@example.test',
      password: 'correct-horse-battery-123'
    }).expect(200);
    const adminToken = adminLogin.body.token;
    const created = await request(app).post('/api/invitations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        firstName: 'New Teammate',
        email: 'new@example.test',
        department: 'Research',
        jobTitle: 'Research Analyst',
        employmentType: 'contractor',
        hireDate: '2026-03-15',
        team: 'Research',
        managerId: 2
      }).expect(201);
    expect(created.body.emailStatus).toBe('sent');
    const oldToken = new URL(created.body.inviteUrl).pathname.split('/').pop();
    await request(app).get(`/api/invitations/${oldToken}`).expect(200);

    const resent = await request(app).post(`/api/invitations/${created.body.id}/resend`)
      .set('Authorization', `Bearer ${adminToken}`).expect(200);
    const currentToken = new URL(resent.body.inviteUrl).pathname.split('/').pop();
    await request(app).get(`/api/invitations/${oldToken}`).expect(404);
    await request(app).get(`/api/invitations/${currentToken}`)
      .expect(200)
      .then(response => expect(response.body).toMatchObject({
        email: 'new@example.test',
        jobTitle: 'Research Analyst',
        employmentType: 'contractor',
        hireDate: '2026-03-15',
        team: 'Research',
        managerId: 2
      }));

    const accepted = await request(app).post(`/api/invitations/${currentToken}/accept`)
      .send({ password: 'accepted-password-12345' }).expect(201);
    expect(accepted.body.user.role).toBe('employee');
    expect(accepted.body.user).toMatchObject({
      jobTitle: 'Research Analyst',
      employmentType: 'contractor',
      hireDate: '2026-03-15',
      team: 'Research',
      managerId: 2
    });
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
      if (text.startsWith('select p.id,p.user_id,u.company_id from password_resets')) return result([]);
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

import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const password = 'E2E-only-password-123!';
const apiUrl = 'http://127.0.0.1:5000/api';

const readSession = async page => page.evaluate(() => ({
  user: JSON.parse(localStorage.getItem('ems_user')),
  token: localStorage.getItem('ems_token')
}));

const createInvitation = async (page, adminToken, invitation) => {
  const response = await page.request.post(`${apiUrl}/invitations`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: invitation
  });
  expect(response.status()).toBe(201);
  return response.json();
};

const acceptInvitationInBrowser = async (page, inviteUrl, expectedName) => {
  await page.getByRole('button', { name: 'Log out' }).click();
  await page.goto(inviteUrl);
  await expect(page.getByText(expectedName, { exact: false })).toBeVisible();
  await page.getByLabel('Create password').fill(password);
  await page.getByLabel('Confirm password').fill(password);
  await page.getByRole('button', { name: 'Accept Invitation & Enter' }).click();
  await expect(page.getByRole('heading', { name: 'My Workspace' })).toBeVisible();
  return readSession(page);
};

test('registration, manager reporting, leave approval, and auth accessibility', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Create workspace free' }).click();
  await expect(page.getByRole('heading', { name: 'Create your company workspace' })).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Back to Home' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Company name')).toBeFocused();

  const accessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(
    accessibility.violations,
    accessibility.violations.map(({ id, help, nodes }) =>
      `${id}: ${help} (${nodes.map(node => node.target.join(', ')).join('; ')})`
    ).join('\n')
  ).toEqual([]);

  const unique = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const adminEmail = `admin-${unique}@example.test`;
  const managerEmail = `manager-${unique}@example.test`;
  const employeeEmail = `employee-${unique}@example.test`;

  await page.getByLabel('Company name').fill(`E2E Company ${unique}`);
  await page.getByLabel('Your name').fill('E2E Admin');
  await page.getByLabel('Work email').fill(adminEmail);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Create Company Workspace' }).click();
  await expect(page.getByRole('heading', { name: 'Workspace Overview' })).toBeVisible();
  const adminSession = await readSession(page);
  expect(adminSession.user.role).toBe('admin');

  const managerInvite = await createInvitation(page, adminSession.token, {
    firstName: 'E2E Manager',
    email: managerEmail,
    department: 'Engineering',
    jobTitle: 'Engineering Manager',
    team: 'Platform'
  });
  const managerSession = await acceptInvitationInBrowser(page, managerInvite.inviteUrl, 'E2E Manager');

  const employeeInvite = await createInvitation(page, adminSession.token, {
    firstName: 'E2E Teammate',
    email: employeeEmail,
    department: 'Engineering',
    jobTitle: 'Software Engineer',
    team: 'Platform',
    managerId: managerSession.user.id
  });
  const employeeSession = await acceptInvitationInBrowser(page, employeeInvite.inviteUrl, 'E2E Teammate');

  const start = new Date();
  start.setDate(start.getDate() + 5);
  const startDate = start.toISOString().slice(0, 10);
  const leaveResponse = await page.request.post(`${apiUrl}/leave-requests`, {
    headers: { Authorization: `Bearer ${employeeSession.token}` },
    data: {
      startDate,
      endDate: startDate,
      leaveType: 'vacation',
      reason: 'E2E manager approval'
    }
  });
  expect(leaveResponse.status()).toBe(201);
  const leaveRequest = await leaveResponse.json();

  await page.getByRole('button', { name: 'Log out' }).click();
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in to workspace' }).click();
  await page.getByLabel('Work Email').fill(managerEmail);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign In to Workspace' }).click();
  await expect(page.getByRole('heading', { name: 'My Workspace' })).toBeVisible();
  const manager = await readSession(page);
  const managerAdminResponse = await page.request.get(`${apiUrl}/employees`, {
    headers: { Authorization: `Bearer ${manager.token}` }
  });
  expect(managerAdminResponse.status()).toBe(403);
  const managerOffboardingResponse = await page.request.get(`${apiUrl}/offboardings`, {
    headers: { Authorization: `Bearer ${manager.token}` }
  });
  expect(managerOffboardingResponse.status()).toBe(403);
  const managerWorkforceReport = await page.request.get(`${apiUrl}/reports/workforce`, {
    headers: { Authorization: `Bearer ${manager.token}` }
  });
  expect(managerWorkforceReport.status()).toBe(403);

  await page.getByRole('button', { name: /My team/ }).waitFor();
  await page.getByRole('button', { name: /My team/ }).click();
  await expect(page.getByRole('heading', { name: 'Your direct reports' })).toBeVisible();
  await expect(page.getByText(employeeEmail)).toBeVisible();

  await page.getByRole('button', { name: 'Time off' }).click();
  await expect(page.getByRole('heading', { name: 'Team Leave Management' })).toBeVisible();
  const requestCard = page.getByRole('article').filter({ hasText: 'E2E manager approval' });
  await expect(requestCard).toBeVisible();
  await requestCard.getByRole('button', { name: 'Approve' }).click();
  await expect(requestCard.getByText('approved', { exact: true })).toBeVisible();

  const savedRequest = await page.request.get(`${apiUrl}/leave-requests`, {
    headers: { Authorization: `Bearer ${manager.token}` }
  });
  expect(savedRequest.ok()).toBeTruthy();
  expect((await savedRequest.json()).find(item => item.id === leaveRequest.id)?.status).toBe('approved');

  await page.getByRole('button', { name: 'Log out' }).click();
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in to workspace' }).click();
  await page.getByLabel('Work Email').fill(adminEmail);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign In to Workspace' }).click();
  await expect(page.getByRole('heading', { name: 'Workspace Overview' })).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: 'Offboarding' }).click();
  await expect(page.getByRole('heading', { name: 'Employee offboarding' })).toBeVisible();
  const offboardingAccessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(
    offboardingAccessibility.violations,
    offboardingAccessibility.violations.map(({ id, help }) => `${id}: ${help}`).join('\n')
  ).toEqual([]);
  await page.getByLabel('Active employee').selectOption(String(employeeSession.user.id));
  const lastWorkingDate = new Date();
  lastWorkingDate.setDate(lastWorkingDate.getDate() + 30);
  await page.getByLabel('Last working date').fill(lastWorkingDate.toISOString().slice(0, 10));
  await page.getByRole('button', { name: 'Start checklist' }).click();
  const offboarding = page.getByRole('article', { name: 'E2E Teammate offboarding' });
  await expect(offboarding).toBeVisible();
  const updatedAdminSession = await readSession(page);
  const offboardingResponse = await page.request.get(`${apiUrl}/offboardings`, {
    headers: { Authorization: `Bearer ${updatedAdminSession.token}` }
  });
  expect(offboardingResponse.ok()).toBeTruthy();
  const plan = (await offboardingResponse.json()).find(item => item.employeeId === employeeSession.user.id);
  expect(plan).toMatchObject({
    status: 'in_progress',
    lastWorkingDate: lastWorkingDate.toISOString().slice(0, 10)
  });
  expect(plan.items).toHaveLength(5);
  const duplicatePlan = await page.request.post(`${apiUrl}/employees/${employeeSession.user.id}/offboarding`, {
    headers: { Authorization: `Bearer ${updatedAdminSession.token}` },
    data: { lastWorkingDate: lastWorkingDate.toISOString().slice(0, 10) }
  });
  expect(duplicatePlan.status()).toBe(409);

  for (const item of [
    'Complete role and knowledge handover',
    'Reassign active tasks and responsibilities',
    'Recover company equipment and property',
    'Revoke company-system access',
    'Complete required exit records'
  ]) {
    const checkbox = offboarding.getByLabel(item);
    await checkbox.click();
    await expect(checkbox).toBeChecked();
  }
  await expect(offboarding.getByText('completed', { exact: true })).toBeVisible();
  const reopenItem = await page.request.patch(`${apiUrl}/offboardings/${plan.id}/items/${plan.items[0].id}`, {
    headers: { Authorization: `Bearer ${updatedAdminSession.token}` },
    data: { completed: false }
  });
  expect(reopenItem.status()).toBe(409);
  const employees = await page.request.get(`${apiUrl}/employees`, {
    headers: { Authorization: `Bearer ${updatedAdminSession.token}` }
  });
  expect((await employees.json()).find(employee => employee.id === employeeSession.user.id)?.active).toBe(true);

  const workforceResponse = await page.request.get(`${apiUrl}/reports/workforce`, {
    headers: { Authorization: `Bearer ${updatedAdminSession.token}` }
  });
  expect(workforceResponse.ok()).toBeTruthy();
  const workforceReport = await workforceResponse.json();
  expect(workforceReport.headcount).toMatchObject({ total: 2, activeEmployees: 2, inactiveEmployees: 0 });
  expect(workforceReport.offboardingPlans).toContainEqual({ status: 'completed', count: 1 });
  await page.getByRole('button', { name: 'Reports' }).click();
  await expect(page.getByRole('heading', { name: 'Workforce overview' })).toBeVisible();
  await expect(page.getByText('Active accounts', { exact: true })).toBeVisible();
  await expect(page.getByText('Offboarding plans')).toBeVisible();
  const workforceOverview = page.getByRole('region', { name: 'Workforce overview' });
  const workforceDownloadPromise = page.waitForEvent('download');
  await workforceOverview.getByRole('button', { name: 'Export CSV' }).click();
  const workforceDownload = await workforceDownloadPromise;
  expect(workforceDownload.suggestedFilename()).toMatch(/^employeems-workforce-report-\d{4}-\d{2}-\d{2}\.csv$/);
  const csvStream = await workforceDownload.createReadStream();
  let workforceCsv = '';
  for await (const chunk of csvStream) workforceCsv += chunk.toString();
  expect(workforceCsv).toContain('"Total employees","2"');
  expect(workforceCsv).toContain('"Offboarding plans","Status","Count"');
});

import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const api = 'http://127.0.0.1:5000/api';
const password = 'E2E-only-password-123!';

test.use({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });

test('the public landing works at 390 pixels in both themes', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Make the workday clearer.' })).toBeVisible();
  await expect(page.getByRole('figure', { name: 'Example workspace showing upcoming tasks' })).toBeVisible();

  for (const mode of ['light', 'dark']) {
    if (mode === 'dark') await page.getByRole('button', { name: 'Switch to dark mode' }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(audit.violations, `Accessibility in ${mode} mode`).toEqual([]);
  }

  await page.getByRole('button', { name: 'Create workspace free' }).click();
  await expect(page.getByRole('heading', { name: 'Create your company workspace' })).toBeVisible();
  await expect(page.locator('html')).toHaveClass(/dark/);
});

test('Work Focus leads admins and employees to the right task on a phone', async ({ page }) => {
  test.setTimeout(50_000);
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const registered = await page.request.post(`${api}/onboarding/register-company`, {
    data: {
      companyName: `Focus Ops ${suffix}`, firstName: 'Focus Admin', email: `focus-admin-${suffix}@example.test`,
      password, industry: 'Technology', size: '1-10'
    }
  });
  expect(registered.status()).toBe(201);
  const admin = await registered.json();
  const headers = { Authorization: `Bearer ${admin.token}` };

  const invite = await page.request.post(`${api}/invitations`, {
    headers,
    data: { firstName: 'Focus Teammate', email: `focus-member-${suffix}@example.test`, department: 'Operations' }
  });
  expect(invite.status()).toBe(201);
  const { inviteUrl } = await invite.json();
  await page.goto(inviteUrl);
  await page.getByLabel('Create password').fill(password);
  await page.getByLabel('Confirm password').fill(password);
  await page.getByRole('button', { name: 'Accept Invitation & Enter' }).click();
  await expect(page.getByRole('heading', { name: 'My Workspace' })).toBeVisible();
  const employee = await page.evaluate(() => JSON.parse(localStorage.getItem('ems_user')));

  const overdue = new Date();
  overdue.setUTCDate(overdue.getUTCDate() - 3);
  const fartherOut = new Date();
  fartherOut.setUTCDate(fartherOut.getUTCDate() + 25);
  for (const [due, description] of [[overdue, 'The overdue handoff'], [fartherOut, 'A later handoff with the same title']]) {
    const task = await page.request.post(`${api}/tasks`, {
      headers,
      data: {
        taskTitle: 'Review shift handoff', taskDescription: description, taskDate: due.toISOString().slice(0, 10),
        category: 'Operations', assignedTo: employee.id, priority: 'high'
      }
    });
    expect(task.status()).toBe(201);
  }

  await page.reload();
  const workFocus = page.getByRole('region', { name: 'Work Focus' });
  await expect(workFocus.getByRole('button', { name: 'Overdue 1' })).toHaveAttribute('aria-pressed', 'true');
  await workFocus.getByRole('button', { name: /next 7 days/i }).click();
  await expect(workFocus.getByText('Nothing is due in the next seven days.')).toBeVisible();
  await workFocus.getByRole('button', { name: 'Overdue 1' }).click();
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  expect((await new AxeBuilder({ page }).include('.work-focus')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await workFocus.getByRole('button', { name: /Review shift handoff/ }).click();
  const employeeTask = page.getByRole('group', { name: 'Review shift handoff' }).filter({ hasText: 'The overdue handoff' });
  await expect(employeeTask).toBeFocused();
  await employeeTask.getByRole('button', { name: 'Accept Task' }).click();
  await employeeTask.getByRole('button', { name: 'Completed' }).click();
  await expect(workFocus.getByRole('button', { name: 'Overdue 0' })).toBeVisible();

  // Add a second overdue assignment to exercise the admin link with duplicate titles.
  const followUp = await page.request.post(`${api}/tasks`, {
    headers,
    data: {
      taskTitle: 'Review shift handoff', taskDescription: 'Admin follow-up', taskDate: overdue.toISOString().slice(0, 10),
      category: 'Operations', assignedTo: employee.id, priority: 'high'
    }
  });
  expect(followUp.status()).toBe(201);
  await page.getByRole('button', { name: 'Log out' }).click();
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in to workspace' }).click();
  await page.getByLabel('Work Email').fill(admin.user.email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign In to Workspace' }).click();
  await expect(page.getByRole('heading', { name: 'Workspace Overview' })).toBeVisible();
  await expect(workFocus.getByText('Focus Teammate', { exact: false })).toBeVisible();
  const adminAudit = await new AxeBuilder({ page })
    .include('.workspace-pagehead').include('.workspace-stats').include('.work-focus').include('.workspace-workload')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(adminAudit.violations).toEqual([]);
  await workFocus.getByRole('button', { name: /Review shift handoff/ }).click();
  await expect(page.getByText('Viewing a task from Work Focus')).toBeVisible();
  await expect(page.getByText('Admin follow-up', { exact: true })).toBeVisible();
  await expect(page.getByText('A later handoff with the same title', { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByRole('button', { name: 'Show all tasks' }).click();
  await expect(page.getByText('A later handoff with the same title', { exact: true })).toBeVisible();
});

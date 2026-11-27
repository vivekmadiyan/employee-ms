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

test('Work Focus and AI approvals keep task actions scoped on a phone', async ({ page }) => {
  test.setTimeout(60_000);
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
  const employee = await page.evaluate(() => ({
    ...JSON.parse(localStorage.getItem('ems_user')),
    token: localStorage.getItem('ems_token')
  }));
  const employeeHeaders = { Authorization: `Bearer ${employee.token}` };
  const readTask = async taskId => {
    const response = await page.request.get(`${api}/tasks?taskId=${taskId}`, { headers: employeeHeaders });
    expect(response.status()).toBe(200);
    return (await response.json())[0];
  };

  const overdue = new Date();
  overdue.setUTCDate(overdue.getUTCDate() - 3);
  const fartherOut = new Date();
  fartherOut.setUTCDate(fartherOut.getUTCDate() + 25);
  let overdueTaskId;
  for (const [due, description] of [[overdue, 'The overdue handoff'], [fartherOut, 'A later handoff with the same title']]) {
    const task = await page.request.post(`${api}/tasks`, {
      headers,
      data: {
        taskTitle: 'Review shift handoff', taskDescription: description, taskDate: due.toISOString().slice(0, 10),
        category: 'Operations', assignedTo: employee.id, priority: 'high'
      }
    });
    expect(task.status()).toBe(201);
    if (due === overdue) overdueTaskId = (await task.json()).id;
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

  const employeeNavigation = page.getByRole('navigation', { name: 'My workspace sections' });
  await expect(employeeNavigation.getByRole('button').first()).toHaveAccessibleName('AI');
  await employeeNavigation.getByRole('button', { name: 'AI', exact: true }).click();
  const assistant = page.getByRole('region', { name: 'AI workspace assistant' });
  await expect(workFocus).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await assistant.getByRole('button', { name: 'Task summaries' }).click();
  await assistant.getByRole('button', { name: 'Which tasks are overdue?' }).click();
  await expect(assistant.getByRole('status')).toContainText('Workspace summary');
  await expect(assistant.getByRole('status')).toContainText('1 overdue task.');
  await expect(assistant.getByRole('status')).toContainText('Review shift handoff');
  await assistant.getByRole('button', { name: 'What needs attention in the next 7 days?' }).click();
  await expect(assistant.getByRole('status')).toContainText('1 task needs attention.');
  await assistant.getByRole('button', { name: 'Summarize my open work' }).click();
  await expect(assistant.getByRole('status')).toContainText('2 open tasks.');
  await assistant.getByRole('button', { name: 'AI chat' }).click();
  await assistant.getByRole('textbox', { name: 'Ask about tasks' }).fill('Which tasks are overdue?');
  await assistant.getByRole('button', { name: 'Ask AI' }).click();
  await expect(assistant.getByRole('alert')).toContainText(/AI provider .*unavailable/);
  await expect(assistant.getByText('Workspace summary')).toHaveCount(0);

  const employeeTools = await page.request.get(`${api}/ai/tools`, { headers: employeeHeaders });
  expect(employeeTools.status()).toBe(200);
  const { tools } = await employeeTools.json();
  expect(tools.map(tool => tool.id)).toContain('set_task_status');
  expect(tools.map(tool => tool.id)).not.toContain('create_task');
  const statusTool = tools.find(tool => tool.id === 'set_task_status');
  const chatInputs = [];
  const action = {
    tool: 'set_task_status', title: 'Update task status',
    details: [
      { label: 'Task', value: 'Review shift handoff' },
      { label: 'Change', value: 'New → In progress' }
    ],
    input: { taskId: overdueTaskId, status: 'active', expectedStatus: 'new' }
  };
  await page.route('**/api/ai/ask', async route => {
    if (route.request().method() !== 'POST') return route.continue();
    chatInputs.push(route.request().postDataJSON());
    const isProposal = chatInputs.length > 2;
    await route.fulfill({
      json: {
        answer: isProposal ? 'Review the proposed task change.' :
          chatInputs.length === 1 ? 'Review the overdue shift handoff first.' : 'Tell the next shift to review the handoff.',
        source: 'gemini',
        model: 'gemini-3.5-flash-lite',
        references: [{ id: overdueTaskId, title: 'Review shift handoff' }],
        ...(isProposal ? { action } : {})
      }
    });
  });
  await assistant.getByRole('textbox', { name: 'Ask about tasks' }).fill('Which tasks are overdue?');
  await assistant.getByRole('button', { name: 'Ask AI' }).click();
  await expect(assistant.getByRole('log')).toContainText('Review the overdue shift handoff first.');
  await expect(assistant.getByRole('log')).toContainText('Gemini');
  await assistant.getByRole('textbox', { name: 'Ask about tasks' }).fill('Draft a handoff for it.');
  await assistant.getByRole('button', { name: 'Ask AI' }).click();
  await expect(assistant.getByRole('log')).toContainText('Tell the next shift to review the handoff.');
  expect(chatInputs[1].history).toEqual([{
    question: 'Which tasks are overdue?', answer: 'Review the overdue shift handoff first.'
  }]);

  await assistant.getByRole('button', { name: 'Tools', exact: true }).click();
  await assistant.getByRole('checkbox', { name: statusTool.label, exact: true }).check();
  const proposeStatusChange = async () => {
    await assistant.getByRole('textbox', { name: 'Ask about tasks' }).fill('Start the overdue shift handoff.');
    await assistant.getByRole('button', { name: 'Ask AI' }).click();
    await expect(assistant.getByRole('button', { name: 'Confirm action', exact: true })).toBeVisible();
    expect(chatInputs.at(-1).tools).toContain('set_task_status');
    expect(await readTask(overdueTaskId)).toMatchObject({ id: overdueTaskId, newTask: true, active: false });
  };
  await proposeStatusChange();
  await assistant.getByRole('button', { name: 'Dismiss', exact: true }).click();
  await expect(assistant.getByRole('button', { name: 'Confirm action', exact: true })).toHaveCount(0);
  expect(await readTask(overdueTaskId)).toMatchObject({ newTask: true, active: false });
  await proposeStatusChange();
  const [confirmedStatus] = await Promise.all([
    page.waitForResponse(response => response.request().method() === 'PATCH'
      && new URL(response.url()).pathname === `/api/tasks/${overdueTaskId}/status`),
    assistant.getByRole('button', { name: 'Confirm action', exact: true }).click()
  ]);
  expect(confirmedStatus.ok()).toBe(true);
  await expect(assistant.getByText('Task status updated.', { exact: true })).toBeVisible();
  expect(await readTask(overdueTaskId)).toMatchObject({ newTask: false, active: true });
  await assistant.getByRole('button', { name: 'Review shift handoff' }).last().click();
  await expect(employeeTask).toBeFocused();
  await page.unroute('**/api/ai/ask');

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
  const adminNavigation = page.getByRole('navigation', { name: 'Workspace navigation' });
  await expect(adminNavigation.getByRole('button').first()).toHaveAccessibleName('AI');
  await adminNavigation.getByRole('button', { name: 'AI', exact: true }).click();
  await expect(assistant).toBeVisible();
  const adminTools = await page.request.get(`${api}/ai/tools`, { headers });
  expect(adminTools.status()).toBe(200);
  const { tools: availableAdminTools } = await adminTools.json();
  expect(availableAdminTools.map(tool => tool.id)).toEqual(expect.arrayContaining(['set_task_status', 'create_task']));
  const creationTool = availableAdminTools.find(tool => tool.id === 'create_task');
  const creationInput = {
    taskTitle: 'Update the stock checklist',
    taskDescription: 'Review items added during the shift.',
    taskDate: fartherOut.toISOString().slice(0, 10),
    category: 'Operations',
    assignedTo: employee.id,
    priority: 'medium'
  };
  const readCreatedTasks = async () => {
    const response = await page.request.get(`${api}/tasks?q=${encodeURIComponent(creationInput.taskTitle)}`, { headers });
    expect(response.status()).toBe(200);
    return response.json();
  };
  let creationRequest;
  await page.route('**/api/ai/ask', async route => {
    if (route.request().method() !== 'POST') return route.continue();
    creationRequest = route.request().postDataJSON();
    await route.fulfill({
      json: {
        answer: 'Review the proposed new task.',
        source: 'gemini',
        model: 'gemini-3.5-flash-lite',
        references: [],
        action: {
          tool: 'create_task', title: 'Create a task',
          details: [
            { label: 'Title', value: creationInput.taskTitle },
            { label: 'Assigned to', value: 'Focus Teammate' },
            { label: 'Due date', value: creationInput.taskDate }
          ],
          input: creationInput
        }
      }
    });
  });
  await assistant.getByRole('button', { name: 'Tools', exact: true }).click();
  await assistant.getByRole('checkbox', { name: creationTool.label, exact: true }).check();
  await assistant.getByRole('textbox', { name: 'Ask about tasks' }).fill('Create a task to update the stock checklist.');
  await assistant.getByRole('button', { name: 'Ask AI' }).click();
  await expect(assistant.getByRole('button', { name: 'Confirm action', exact: true })).toBeVisible();
  expect(creationRequest.tools).toContain('create_task');
  expect(await readCreatedTasks()).toEqual([]);
  const [createdTask] = await Promise.all([
    page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/tasks'),
    assistant.getByRole('button', { name: 'Confirm action', exact: true }).click()
  ]);
  expect(createdTask.status()).toBe(201);
  await expect(assistant.getByText('Task created.', { exact: true })).toBeVisible();
  expect(await readCreatedTasks()).toMatchObject([{ ...creationInput, newTask: true }]);
  await page.unroute('**/api/ai/ask');
  await adminNavigation.getByRole('button', { name: 'Overview', exact: true }).click();
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

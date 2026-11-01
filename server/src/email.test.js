import { describe, expect, it, vi } from 'vitest';
import {
  sendInvitationEmail,
  sendLeaveDecisionEmail,
  sendLeaveRequestEmail,
  sendPasswordResetEmail,
  sendTaskAssignedEmail,
  sendTaskUpdateEmail
} from './email.js';

const emailOptions = {
  apiKey: 'test-api-key',
  senderEmail: 'sender@example.com',
  senderName: 'EmployeeMS',
  recipientEmail: 'employee@example.com',
  recipientName: 'Alex',
  companyName: 'Example Co',
  inviteUrl: 'https://app.example.com/invite/test-token'
};

const taskOptions = {
  ...emailOptions,
  assignedBy: 'Admin',
  task: {
    taskTitle: 'Prepare launch checklist',
    taskDescription: 'Review production readiness.',
    category: 'Operations',
    priority: 'high',
    taskDate: '2099-12-31'
  }
};

describe('sendInvitationEmail', () => {
  it('sends a transactional email through Brevo over HTTPS', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 201 }));

    await sendInvitationEmail({ ...emailOptions, fetchImpl });

    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect(options.method).toBe('POST');
    expect(options.headers['api-key']).toBe('test-api-key');
    expect(JSON.parse(options.body)).toMatchObject({
      sender: { name: 'EmployeeMS', email: 'sender@example.com' },
      to: [{ name: 'Alex', email: 'employee@example.com' }],
      subject: "You're invited to join Example Co on EmployeeMS",
      textContent: expect.stringContaining(emailOptions.inviteUrl)
    });
  });

  it('reports provider rejection with safe diagnostic details without retrying', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      Response.json({
        code: 'sender_not_validated',
        message: 'Sender sender@example.com is not verified'
      }, { status: 400 })
    );

    await expect(sendInvitationEmail({ ...emailOptions, fetchImpl })).rejects.toMatchObject({
      code: 'provider_rejected',
      status: 400,
      providerCode: 'sender_not_validated',
      providerMessage: 'Sender [email] is not verified'
    });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('classifies Brevo 401 responses as invalid credentials without retrying', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      Response.json({ code: 'unauthorized', message: 'Invalid API key' }, { status: 401 })
    );

    await expect(sendInvitationEmail({ ...emailOptions, fetchImpl })).rejects.toMatchObject({
      code: 'provider_auth_failed',
      status: 401,
      providerCode: 'unauthorized',
      providerMessage: 'Invalid API key'
    });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('does not expose malformed provider response bodies', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('private provider response', { status: 401 }));

    await expect(sendInvitationEmail({ ...emailOptions, fetchImpl })).rejects.toMatchObject({
      code: 'provider_auth_failed',
      status: 401
    });
  });

  it('retries network failures up to three attempts', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('fetch failed'));

    await expect(sendInvitationEmail({ ...emailOptions, fetchImpl })).rejects.toMatchObject({
      code: 'network_error'
    });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
});

describe('sendPasswordResetEmail', () => {
  it('sends a reset link through the same HTTPS provider', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 201 }));

    await sendPasswordResetEmail({
      ...emailOptions,
      resetUrl: 'https://app.example.com/reset-password/one-time-token',
      fetchImpl
    });

    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect(JSON.parse(options.body)).toMatchObject({
      to: [{ email: 'employee@example.com' }],
      subject: 'Reset your EmployeeMS password',
      textContent: expect.stringContaining('https://app.example.com/reset-password/one-time-token')
    });
  });
});

describe('sendTaskAssignedEmail', () => {
  it('sends task details to the assigned employee through Brevo', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 201 }));

    await sendTaskAssignedEmail({ ...taskOptions, fetchImpl });

    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect(JSON.parse(options.body)).toMatchObject({
      to: [{ name: 'Alex', email: 'employee@example.com' }],
      subject: 'New task assigned: Prepare launch checklist',
      textContent: expect.stringContaining('Due date: 2099-12-31')
    });
    expect(JSON.parse(options.body).textContent).toContain('Admin assigned you a task in Example Co.');
  });

  it('retries a transient Brevo error and succeeds when the provider recovers', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(Response.json({ code: 'temporary_error' }, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 201 }));

    await sendTaskAssignedEmail({ ...taskOptions, fetchImpl });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});

describe('sendTaskUpdateEmail', () => {
  it.each([
    ['status', 'In progress', 'Task status updated: Prepare launch checklist', 'Status changed to In progress.'],
    ['due_date', '2099-12-31', 'Task due date changed: Prepare launch checklist', 'Due date changed to 2099-12-31.'],
    ['comment', 'I started the checklist.', 'New comment on task: Prepare launch checklist', 'New comment from Admin: I started the checklist.']
  ])('sends an email for the %s event', async (updateType, updateDetails, subject, expectedDetail) => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 201 }));

    await sendTaskUpdateEmail({
      ...taskOptions,
      actorName: 'Admin',
      updateType,
      updateDetails,
      fetchImpl
    });

    const [, options] = fetchImpl.mock.calls[0];
    expect(JSON.parse(options.body)).toMatchObject({
      to: [{ name: 'Alex', email: 'employee@example.com' }],
      subject,
      textContent: expect.stringContaining(expectedDetail)
    });
  });

  describe('leave request emails', () => {
    const leave = {
      startDate: '2026-12-10',
      endDate: '2026-12-12',
      leaveType: 'sick',
      reason: 'Medical leave',
      status: 'pending'
    };

    it('emails workspace admins when an employee requests leave', async () => {
      const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 201 }));

      await sendLeaveRequestEmail({
        ...emailOptions,
        employeeName: 'Alex',
        leave,
        fetchImpl
      });

      const [, options] = fetchImpl.mock.calls[0];
      expect(JSON.parse(options.body)).toMatchObject({
        to: [{ name: 'Alex', email: 'employee@example.com' }],
        subject: 'Leave request from Alex',
        textContent: expect.stringContaining('Dates: 2026-12-10 through 2026-12-12')
      });
      expect(JSON.parse(options.body).textContent).toContain('Reason: Medical leave');
    });

    it('emails the employee after approval, including the manager note', async () => {
      const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 201 }));

      await sendLeaveDecisionEmail({
        ...emailOptions,
        reviewerName: 'Manager',
        leave: { ...leave, status: 'approved', reviewNote: 'Please coordinate coverage.' },
        fetchImpl
      });

      const [, options] = fetchImpl.mock.calls[0];
      expect(JSON.parse(options.body)).toMatchObject({
        to: [{ name: 'Alex', email: 'employee@example.com' }],
        subject: 'Your leave request was approved',
        textContent: expect.stringContaining('Manager approved your leave request in Example Co.')
      });
      expect(JSON.parse(options.body).textContent).toContain('Manager note: Please coordinate coverage.');
    });

    it('refuses to send an approval email for unsupported decisions', async () => {
      const fetchImpl = vi.fn();

      await expect(sendLeaveDecisionEmail({
        ...emailOptions,
        reviewerName: 'Manager',
        leave: { ...leave, status: 'rejected' },
        fetchImpl
      })).rejects.toThrow('Unsupported leave decision email status');
      expect(fetchImpl).not.toHaveBeenCalled();
    });
  });

  it('rejects unsupported event types instead of silently sending a generic message', async () => {
    const fetchImpl = vi.fn();

    await expect(sendTaskUpdateEmail({
      ...taskOptions,
      actorName: 'Admin',
      updateType: 'profile',
      updateDetails: 'changed',
      fetchImpl
    })).rejects.toThrow('Unsupported task update email type');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

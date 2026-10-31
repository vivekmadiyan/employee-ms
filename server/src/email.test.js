import { describe, expect, it, vi } from 'vitest';
import { sendInvitationEmail, sendPasswordResetEmail, sendTaskAssignedEmail } from './email.js';

const emailOptions = {
  apiKey: 'test-api-key',
  senderEmail: 'sender@example.com',
  senderName: 'EmployeeMS',
  recipientEmail: 'employee@example.com',
  recipientName: 'Alex',
  companyName: 'Example Co',
  inviteUrl: 'https://app.example.com/invite/test-token'
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

  describe('sendPasswordResetEmail', () => {
    it('sends a reset link through the same HTTPS provider', async () => {
      const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 201 }));

      await sendPasswordResetEmail({
        apiKey: 'test-api-key',
        senderEmail: 'sender@example.com',
        senderName: 'EmployeeMS',
        recipientEmail: 'employee@example.com',
        recipientName: 'Alex',
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

    describe('sendTaskAssignedEmail', () => {
      it('sends the task details to the assigned employee through Brevo', async () => {
        const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 201 }));

        await sendTaskAssignedEmail({
          apiKey: 'test-api-key',
          senderEmail: 'sender@example.com',
          senderName: 'EmployeeMS',
          recipientEmail: 'employee@example.com',
          recipientName: 'Alex',
          companyName: 'Example Co',
          assignedBy: 'Admin',
          task: {
            taskTitle: 'Prepare launch checklist',
            taskDescription: 'Review production readiness.',
            category: 'Operations',
            priority: 'high',
            taskDate: '2099-12-31'
          },
          fetchImpl
        });

        const [url, options] = fetchImpl.mock.calls[0];
        expect(url).toBe('https://api.brevo.com/v3/smtp/email');
        expect(JSON.parse(options.body)).toMatchObject({
          to: [{ name: 'Alex', email: 'employee@example.com' }],
          subject: 'New task assigned: Prepare launch checklist',
          textContent: expect.stringContaining('Due date: 2099-12-31')
        });
        expect(JSON.parse(options.body).textContent).toContain('Admin assigned you a task in Example Co.');
      });
    });
  });

  it('reports provider rejection with safe diagnostic details', async () => {
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
  });

  it('classifies Brevo 401 responses as invalid API credentials', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      Response.json({
        code: 'unauthorized',
        message: 'Invalid API key'
      }, { status: 401 })
    );

    await expect(sendInvitationEmail({ ...emailOptions, fetchImpl })).rejects.toMatchObject({
      code: 'provider_auth_failed',
      status: 401,
      providerCode: 'unauthorized',
      providerMessage: 'Invalid API key'
    });
  });

  it('does not expose malformed provider response bodies', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response('private provider response', { status: 401 })
    );

    await expect(sendInvitationEmail({ ...emailOptions, fetchImpl })).rejects.toMatchObject({
      code: 'provider_auth_failed',
      status: 401
    });
  });

  it('classifies connection failures as network errors', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('fetch failed'));

    await expect(sendInvitationEmail({ ...emailOptions, fetchImpl })).rejects.toMatchObject({
      code: 'network_error'
    });
  });
});

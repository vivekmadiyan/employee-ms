import { describe, expect, it, vi } from 'vitest';
import { sendInvitationEmail } from './email.js';

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

  it('does not expose malformed provider response bodies', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response('private provider response', { status: 401 })
    );

    await expect(sendInvitationEmail({ ...emailOptions, fetchImpl })).rejects.toMatchObject({
      code: 'provider_rejected',
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

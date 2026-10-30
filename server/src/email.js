const BREVO_EMAIL_URL = 'https://api.brevo.com/v3/smtp/email';

export async function sendInvitationEmail({
  apiKey,
  senderEmail,
  senderName,
  recipientEmail,
  recipientName,
  companyName,
  inviteUrl,
  fetchImpl = fetch
}) {
  let response;
  try {
    response = await fetchImpl(BREVO_EMAIL_URL, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        sender: { name: senderName, email: senderEmail },
        to: [{ name: recipientName, email: recipientEmail }],
        subject: `You're invited to join ${companyName} on EmployeeMS`,
        textContent: `Hi ${recipientName}, accept your invitation to join ${companyName}: ${inviteUrl}`
      }),
      signal: AbortSignal.timeout(10_000)
    });
  } catch {
    const error = new Error('Could not reach the Brevo email API');
    error.code = 'network_error';
    throw error;
  }

  if (!response.ok) {
    let providerError;
    try {
      providerError = await response.json();
    } catch {
      providerError = null;
    }

    const error = new Error(`Brevo rejected the email request with HTTP ${response.status}`);
    error.code = response.status === 401 ? 'provider_auth_failed' : 'provider_rejected';
    error.status = response.status;
    if (typeof providerError?.code === 'string') {
      error.providerCode = providerError.code.slice(0, 100);
    }
    if (typeof providerError?.message === 'string') {
      error.providerMessage = providerError.message
        .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email]')
        .replace(/[\r\n]/g, ' ')
        .slice(0, 300);
    }
    throw error;
  }
}

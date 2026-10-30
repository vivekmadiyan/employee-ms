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
  const response = await fetchImpl(BREVO_EMAIL_URL, {
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

  if (!response.ok) {
    const error = new Error(`Brevo rejected the email request with HTTP ${response.status}`);
    error.code = 'provider_rejected';
    error.status = response.status;
    throw error;
  }
}

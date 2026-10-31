const BREVO_EMAIL_URL = 'https://api.brevo.com/v3/smtp/email';

async function sendBrevoEmail({ apiKey, senderEmail, senderName, recipientEmail, payload, fetchImpl }) {
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
        to: [{ email: recipientEmail }],
        ...payload
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
  return sendBrevoEmail({
    apiKey,
    senderEmail,
    senderName,
    recipientEmail,
    fetchImpl,
    payload: {
      to: [{ name: recipientName, email: recipientEmail }],
      subject: `You're invited to join ${companyName} on EmployeeMS`,
      textContent: `Hi ${recipientName}, accept your invitation to join ${companyName}: ${inviteUrl}`
    }
  });
}

export async function sendPasswordResetEmail({
  apiKey,
  senderEmail,
  senderName,
  recipientEmail,
  recipientName,
  resetUrl,
  fetchImpl = fetch
}) {
  return sendBrevoEmail({
    apiKey,
    senderEmail,
    senderName,
    recipientEmail,
    fetchImpl,
    payload: {
      subject: 'Reset your EmployeeMS password',
      textContent: `Hi ${recipientName}, use this link to reset your EmployeeMS password: ${resetUrl}\n\nThis link expires in 30 minutes. If you did not request a reset, you can ignore this email.`
    }
  });
}

export async function sendTaskAssignedEmail({
  apiKey,
  senderEmail,
  senderName,
  recipientEmail,
  recipientName,
  companyName,
  task,
  assignedBy,
  fetchImpl = fetch
}) {
  return sendBrevoEmail({
    apiKey,
    senderEmail,
    senderName,
    recipientEmail,
    recipientName,
    fetchImpl,
    payload: {
      to: [{ name: recipientName, email: recipientEmail }],
      subject: `New task assigned: ${task.taskTitle}`,
      textContent: [
        `Hi ${recipientName},`,
        '',
        `${assignedBy} assigned you a task in ${companyName}.`,
        `Task: ${task.taskTitle}`,
        `Description: ${task.taskDescription}`,
        `Category: ${task.category}`,
        `Priority: ${task.priority}`,
        `Due date: ${task.taskDate}`,
        '',
        'Sign in to EmployeeMS to review and update this task.'
      ].join('\n')
    }
  });
}

const BREVO_EMAIL_URL = 'https://api.brevo.com/v3/smtp/email';

async function sendBrevoEmail({ apiKey, senderEmail, senderName, recipientEmail, payload, fetchImpl }) {
  const request = {
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
    })
  };
  let lastError;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    let response;
    try {
      response = await fetchImpl(BREVO_EMAIL_URL, {
        ...request,
        signal: AbortSignal.timeout(10_000)
      });
    } catch {
      lastError = new Error('Could not reach the Brevo email API');
      lastError.code = 'network_error';
    }

    if (response?.ok) return;

    if (response) {
      let providerError;
      try {
        providerError = await response.json();
      } catch {
        providerError = null;
      }

      lastError = new Error(`Brevo rejected the email request with HTTP ${response.status}`);
      lastError.code = response.status === 401 ? 'provider_auth_failed' : 'provider_rejected';
      lastError.status = response.status;
      if (typeof providerError?.code === 'string') {
        lastError.providerCode = providerError.code.slice(0, 100);
      }
      if (typeof providerError?.message === 'string') {
        lastError.providerMessage = providerError.message
          .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email]')
          .replace(/[\r\n]/g, ' ')
          .slice(0, 300);
      }
    }

    const retryable = lastError.code === 'network_error'
      || lastError.status === 429
      || lastError.status >= 500;
    if (!retryable || attempt === 2) throw lastError;
    await new Promise(resolve => setTimeout(resolve, 300 * (attempt + 1)));
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

export async function sendTaskUpdateEmail({
  apiKey,
  senderEmail,
  senderName,
  recipientEmail,
  recipientName,
  companyName,
  task,
  actorName,
  updateType,
  updateDetails,
  fetchImpl = fetch
}) {
  const updates = {
    status: {
      subject: `Task status updated: ${task.taskTitle}`,
      description: `Status changed to ${updateDetails}.`
    },
    comment: {
      subject: `New comment on task: ${task.taskTitle}`,
      description: `New comment from ${actorName}: ${updateDetails}`
    },
    due_date: {
      subject: `Task due date changed: ${task.taskTitle}`,
      description: `Due date changed to ${updateDetails}.`
    }
  };
  const update = updates[updateType];
  if (!update) throw new Error('Unsupported task update email type');

  return sendBrevoEmail({
    apiKey,
    senderEmail,
    senderName,
    recipientEmail,
    fetchImpl,
    payload: {
      to: [{ name: recipientName, email: recipientEmail }],
      subject: update.subject,
      textContent: [
        `Hi ${recipientName},`,
        '',
        `${actorName} updated a task in ${companyName}.`,
        `Task: ${task.taskTitle}`,
        update.description,
        '',
        'Sign in to EmployeeMS to review the update.'
      ].join('\n')
    }
  });
}

export async function sendLeaveRequestEmail({
  apiKey,
  senderEmail,
  senderName,
  recipientEmail,
  recipientName,
  companyName,
  employeeName,
  leave,
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
      subject: `Leave request from ${employeeName}`,
      textContent: [
        `Hi ${recipientName},`,
        '',
        `${employeeName} submitted a leave request for ${companyName}.`,
        `Type: ${leave.leaveType}`,
        `Dates: ${leave.startDate} through ${leave.endDate}`,
        `Reason: ${leave.reason}`,
        '',
        'Sign in to EmployeeMS to review this request.'
      ].join('\n')
    }
  });
}

export async function sendLeaveDecisionEmail({
  apiKey,
  senderEmail,
  senderName,
  recipientEmail,
  recipientName,
  companyName,
  leave,
  reviewerName,
  fetchImpl = fetch
}) {
  if (leave.status !== 'approved') throw new Error('Unsupported leave decision email status');
  return sendBrevoEmail({
    apiKey,
    senderEmail,
    senderName,
    recipientEmail,
    recipientName,
    fetchImpl,
    payload: {
      to: [{ name: recipientName, email: recipientEmail }],
      subject: 'Your leave request was approved',
      textContent: [
        `Hi ${recipientName},`,
        '',
        `${reviewerName} approved your leave request in ${companyName}.`,
        `Type: ${leave.leaveType}`,
        `Dates: ${leave.startDate} through ${leave.endDate}`,
        ...(leave.reviewNote ? [`Manager note: ${leave.reviewNote}`] : []),
        '',
        'Sign in to EmployeeMS to review your leave request.'
      ].join('\n')
    }
  });
}

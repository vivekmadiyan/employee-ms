import { setTimeout as delay } from 'node:timers/promises';
import { defaultGeminiModel } from './config.js';

const alternateModel = 'gemini-3.1-flash-lite';
const retryableStatuses = new Set([0, 408, 500, 502, 503, 504]);

export async function generateWorkspaceAnswer({ apiKey, model, prompt }) {
  const generate = async modelName => {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
          signal: AbortSignal.timeout(7000)
        }
      );
      if (!response.ok) {
        await response.body?.cancel();
        return { status: response.status };
      }
      const data = await response.json();
      const answer = data.candidates?.[0]?.content?.parts
        ?.filter(part => !part.thought && typeof part.text === 'string')
        .map(part => part.text).join('').trim();
      return { status: response.status, answer };
    } catch {
      return { status: 0 };
    }
  };

  const first = await generate(model);
  if (first.status === 404 && model === 'gemini-2.5-flash') return generate(defaultGeminiModel);
  if (!retryableStatuses.has(first.status)) return first;

  await delay(1000 + Math.floor(Math.random() * 200));
  return generate(model === defaultGeminiModel ? alternateModel : defaultGeminiModel);
}

export function taskSnapshotFilter(question, dateParameter) {
  const open = "status IN ('new','active')";
  switch (question.toLowerCase().replace(/’/g, "'").replace(/[?.!]+$/, '')) {
    case 'which tasks are overdue':
      return { predicate: `${open} AND task_date < ${dateParameter}`, label: 'overdue', needsDate: true };
    case 'what needs attention this week':
    case 'what needs attention in the next 7 days':
      return {
        predicate: `((${open} AND task_date <= to_char(${dateParameter}::date + 7, 'YYYY-MM-DD')) OR status='failed')`,
        label: 'needing attention', needsDate: true
      };
    case 'summarize my open work':
    case "summarize the team's open work":
      return { predicate: open, label: 'open', needsDate: false };
    default:
      return null;
  }
}

export function formatTaskSnapshot(tasks, label) {
  if (!tasks.length) return label === 'needing attention' ? 'No tasks need attention.' : `No ${label} tasks.`;
  const total = tasks[0].total;
  const name = total === 1 ? 'task' : 'tasks';
  const summary = label === 'needing attention' ? `${total} ${name} need${total === 1 ? 's' : ''} attention.` : `${total} ${label} ${name}.`;
  const details = tasks.map(task => {
    const status = { new: 'not started', active: 'in progress', failed: 'needs follow-up' }[task.status];
    return `• ${task.title} — due ${task.due_date} (${status})`;
  });
  if (total > tasks.length) details.push(`Showing the first ${tasks.length} by due date.`);
  return [summary, ...details].join('\n');
}

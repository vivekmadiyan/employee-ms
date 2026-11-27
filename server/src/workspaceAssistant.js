import { setTimeout as delay } from 'node:timers/promises';
import { defaultGeminiModel } from './config.js';

const alternateModel = 'gemini-3.1-flash-lite';
const retryableStatuses = new Set([0, 408, 500, 502, 503, 504]);

async function callModel({ url, headers, body, readAnswer, provider, model }) {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(7000)
    });
    if (!response.ok) {
      await response.body?.cancel();
      return { status: response.status, provider, model };
    }
    const answer = readAnswer(await response.json());
    return { status: response.status, answer: typeof answer === 'string' ? answer.trim() : '', provider, model };
  } catch {
    return { status: 0, provider, model };
  }
}

export async function generateWorkspaceAnswer({ apiKey, model, groqKey, instruction, messages }) {
  const generate = modelName => callModel({
    url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent`,
    headers: { 'x-goog-api-key': apiKey },
    body: {
      systemInstruction: { parts: [{ text: instruction }] },
      contents: messages.map(({ role, content }) => ({
        role: role === 'assistant' ? 'model' : 'user', parts: [{ text: content }]
      })),
      generationConfig: { maxOutputTokens: 1024 }
    },
    readAnswer: data => data.candidates?.[0]?.content?.parts
      ?.filter(part => !part.thought && typeof part.text === 'string').map(part => part.text).join(''),
    provider: 'gemini',
    model: modelName
  });
  const generateWithGroq = () => callModel({
    url: 'https://api.groq.com/openai/v1/chat/completions',
    headers: { Authorization: `Bearer ${groqKey}` },
    body: {
      model: 'openai/gpt-oss-20b',
      messages: [{ role: 'system', content: instruction }, ...messages],
      max_completion_tokens: 1024,
      reasoning_effort: 'low',
      include_reasoning: false
    },
    readAnswer: data => data.choices?.[0]?.message?.content,
    provider: 'groq',
    model: 'openai/gpt-oss-20b'
  });

  if (!apiKey) return generateWithGroq();
  const first = await generate(model);
  if (groqKey && (retryableStatuses.has(first.status) || [401, 403, 404, 429].includes(first.status))) {
    return generateWithGroq();
  }
  if (first.status === 404 && model === 'gemini-2.5-flash') return generate(defaultGeminiModel);
  if (!retryableStatuses.has(first.status)) return first;

  await delay(1000 + Math.floor(Math.random() * 200));
  return generate(model === defaultGeminiModel ? alternateModel : defaultGeminiModel);
}

export function formatChatAnswer(answer, tasks) {
  const available = new Map(tasks.map(({ id, title }) => [id, { id, title }]));
  const references = new Map();
  const text = answer.replace(/[ \t]*\[T(\d+)\]/gi, (_, rawId) => {
    const task = available.get(Number(rawId));
    if (task && references.size < 8) references.set(task.id, task);
    return '';
  }).trim();
  return { answer: text, references: [...references.values()] };
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

import { describe, expect, it, vi } from 'vitest';
import { generateTaskDraft } from './ai.js';

const request = {
  apiKey: 'test-gemini-key',
  model: 'gemini-2.5-flash-lite',
  brief: 'Prepare a launch checklist for accessibility and mobile readiness.',
  category: 'Operations'
};

const draft = {
  title: 'Prepare launch readiness checklist',
  description: 'Review accessibility and mobile layouts, then document findings and required fixes.',
  category: 'Operations',
  priority: 'medium'
};

const successfulResponse = body => Response.json({
  candidates: [{ content: { parts: [{ text: JSON.stringify(body) }] } }]
});

describe('generateTaskDraft', () => {
  it('uses Gemini structured output and validates the returned task fields', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(successfulResponse(draft));

    await expect(generateTaskDraft({ ...request, fetchImpl })).resolves.toEqual(draft);

    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent');
    expect(options.headers['x-goog-api-key']).toBe(request.apiKey);
    expect(options.body).toContain(request.brief);
    expect(options.body).toContain('"responseMimeType":"application/json"');
  });

  it('maps provider rate limits without leaking provider response details', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      Response.json({ error: { message: 'private provider diagnostic' } }, { status: 429 })
    );

    await expect(generateTaskDraft({ ...request, fetchImpl })).rejects.toMatchObject({
      code: 'ai_rate_limited',
      status: 429
    });
  });

  it('classifies invalid provider credentials for actionable configuration errors', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      Response.json({ error: { message: 'private key diagnostic' } }, { status: 403 })
    );

    await expect(generateTaskDraft({ ...request, fetchImpl })).rejects.toMatchObject({
      code: 'ai_configuration_error',
      status: 403
    });
  });

  it('rejects malformed or out-of-contract model output', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(successfulResponse({ ...draft, priority: 'urgent' }));

    await expect(generateTaskDraft({ ...request, fetchImpl })).rejects.toMatchObject({
      code: 'ai_invalid_response'
    });
  });

  it('reports network failures clearly', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('fetch failed'));

    await expect(generateTaskDraft({ ...request, fetchImpl })).rejects.toMatchObject({
      code: 'ai_network_error'
    });
  });
});

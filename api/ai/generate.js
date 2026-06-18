// /api/ai/generate.js
// Handles all AI content generation via Anthropic

import { cors, error, ok } from '../_helpers.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return error(res, 'Method not allowed', 405);

  const { prompt, system, history, anthropicKey, count } = req.body;
  if (!anthropicKey) return error(res, 'Anthropic API key required');

  try {
    const messages = history?.length ? history : [{ role: 'user', content: prompt }];

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: count > 1 ? 3000 : 1500,
        system: system || 'You are ARCA, an AI marketing engine.',
        messages: messages.slice(-12)
      })
    });

    const data = await response.json();

    if (data.error) return error(res, data.error.message);
    if (!data.content?.[0]?.text) return error(res, 'No response from AI');

    return ok(res, { reply: data.content[0].text });

  } catch (e) {
    return error(res, 'Server error: ' + e.message, 500);
  }
}

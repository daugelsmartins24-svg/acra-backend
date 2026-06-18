// /api/video/generate.js
// Calls Runway ML Gen-3 to generate a real video from a prompt

import { cors, error, ok } from '../_helpers.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return error(res, 'Method not allowed', 405);

  const { prompt, storyboard, runwayKey } = req.body;
  if (!runwayKey) return error(res, 'Runway ML API key is required');
  if (!prompt) return error(res, 'Prompt is required');

  // Build a rich prompt from the storyboard
  const shotText = storyboard?.map(s => s.desc).join('. ') || '';
  const fullPrompt = [prompt, shotText].filter(Boolean).join('. ').substring(0, 512);

  try {
    // Step 1 — Create generation task
    const createRes = await fetch('https://api.dev.runwayml.com/v1/image_to_video', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${runwayKey}`,
        'X-Runway-Version': '2024-11-06'
      },
      body: JSON.stringify({
        model: 'gen3a_turbo',
        promptText: fullPrompt,
        duration: 10,
        ratio: '1280:768',
        watermark: false
      })
    });

    const createData = await createRes.json();

    if (!createData.id) {
      return error(res, createData.error || createData.message || 'Runway task creation failed');
    }

    // Step 2 — Poll until complete (max 5 minutes)
    const taskId = createData.id;
    let attempts = 0;
    const maxAttempts = 36; // 36 x 5s = 3 minutes

    while (attempts < maxAttempts) {
      await new Promise(r => setTimeout(r, 5000));
      attempts++;

      const pollRes = await fetch(`https://api.dev.runwayml.com/v1/tasks/${taskId}`, {
        headers: {
          'Authorization': `Bearer ${runwayKey}`,
          'X-Runway-Version': '2024-11-06'
        }
      });

      const pollData = await pollRes.json();

      if (pollData.status === 'SUCCEEDED') {
        const videoUrl = pollData.output?.[0];
        if (!videoUrl) return error(res, 'Video generated but no URL returned');
        return ok(res, { videoUrl, taskId, duration: attempts * 5 + 's' });
      }

      if (pollData.status === 'FAILED') {
        return error(res, 'Runway generation failed: ' + (pollData.failure || 'unknown'));
      }

      // Still processing — continue polling
    }

    return error(res, 'Video generation timed out — try again');

  } catch (e) {
    return error(res, 'Server error: ' + e.message, 500);
  }
}

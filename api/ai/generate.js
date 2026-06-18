// /api/video/generate.js
import { cors, error, ok } from '../_helpers.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return error(res, 'Method not allowed', 405);

  const { prompt, storyboard, runwayKey } = req.body;
  if (!runwayKey) return error(res, 'Runway ML API key is required');
  if (!prompt) return error(res, 'Prompt is required');

  const shotText = storyboard?.map(s => s.desc).join('. ') || '';
  const fullPrompt = [prompt, shotText].filter(Boolean).join('. ').substring(0, 512);

  try {
    const createRes = await fetch('https://api.dev.runwayml.com/v1/image_to_video', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${runwayKey}`,
        'X-Runway-Version': '2024-11-06'
      },
      body: JSON.stringify({
        model: 'seedance2',
        promptText: fullPrompt,
        duration: 5,
        ratio: '9:16'
      })
    });

    const createData = await createRes.json();
    if (!createData.id) return error(res, JSON.stringify(createData));

    const taskId = createData.id;
    let attempts = 0;

    while (attempts < 36) {
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
        return ok(res, { videoUrl, taskId });
      }

      if (pollData.status === 'FAILED') {
        return error(res, 'Runway generation failed: ' + (pollData.failure || 'unknown'));
      }
    }

    return error(res, 'Video generation timed out');
  } catch (e) {
    return error(res, 'Server error: ' + e.message, 500);
  }
}

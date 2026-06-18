// /api/post/instagram.js
// Posts a video (Reel) or image to Instagram via Meta Graph API

import { cors, error, ok } from '../_helpers.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return error(res, 'Method not allowed', 405);

  const { mediaUrl, caption, metaToken, igUserId, isVideo } = req.body;
  if (!metaToken) return error(res, 'Meta access token required');
  if (!igUserId) return error(res, 'Instagram User ID required — add it in Account settings');
  if (!mediaUrl) return error(res, 'Media URL required');

  try {
    // Step 1 — Create media container
    const containerBody = {
      caption: caption || '',
      access_token: metaToken
    };

    if (isVideo) {
      containerBody.media_type = 'REELS';
      containerBody.video_url = mediaUrl;
      containerBody.share_to_feed = true;
    } else {
      containerBody.image_url = mediaUrl;
    }

    const containerRes = await fetch(
      `https://graph.instagram.com/v21.0/${igUserId}/media`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(containerBody)
      }
    );

    const containerData = await containerRes.json();
    if (!containerData.id) {
      return error(res, 'Container creation failed: ' + (containerData.error?.message || 'unknown'));
    }

    const containerId = containerData.id;

    // Step 2 — Wait for container to process (video needs time)
    if (isVideo) {
      let ready = false;
      for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 5000));
        const checkRes = await fetch(
          `https://graph.instagram.com/v21.0/${containerId}?fields=status_code&access_token=${metaToken}`
        );
        const checkData = await checkRes.json();
        if (checkData.status_code === 'FINISHED') { ready = true; break; }
        if (checkData.status_code === 'ERROR') return error(res, 'Media processing failed');
      }
      if (!ready) return error(res, 'Media processing timed out');
    }

    // Step 3 — Publish
    const publishRes = await fetch(
      `https://graph.instagram.com/v21.0/${igUserId}/media_publish`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creation_id: containerId, access_token: metaToken })
      }
    );

    const publishData = await publishRes.json();
    if (!publishData.id) {
      return error(res, 'Publish failed: ' + (publishData.error?.message || 'unknown'));
    }

    return ok(res, { postId: publishData.id, platform: 'instagram', status: 'published' });

  } catch (e) {
    return error(res, 'Server error: ' + e.message, 500);
  }
}

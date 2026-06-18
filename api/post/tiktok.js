// /api/post/tiktok.js
// Posts a video to TikTok using Content Posting API

import { cors, error, ok } from '../_helpers.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return error(res, 'Method not allowed', 405);

  const { videoUrl, caption, tiktokKey } = req.body;
  if (!tiktokKey) return error(res, 'TikTok API key required');
  if (!videoUrl) return error(res, 'Video URL required');

  try {
    // Step 1 — Initialize video post
    const initRes = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tiktokKey}`,
        'Content-Type': 'application/json; charset=UTF-8'
      },
      body: JSON.stringify({
        post_info: {
          title: caption?.substring(0, 150) || 'Posted via ARCA',
          privacy_level: 'PUBLIC_TO_EVERYONE',
          disable_duet: false,
          disable_comment: false,
          disable_stitch: false,
          video_cover_timestamp_ms: 1000
        },
        source_info: {
          source: 'PULL_FROM_URL',
          video_url: videoUrl
        }
      })
    });

    const initData = await initRes.json();

    if (initData.error?.code && initData.error.code !== 'ok') {
      return error(res, 'TikTok error: ' + initData.error.message);
    }

    const publishId = initData.data?.publish_id;
    if (!publishId) return error(res, 'No publish ID returned from TikTok');

    // Step 2 — Poll for publish status
    let attempts = 0;
    while (attempts < 20) {
      await new Promise(r => setTimeout(r, 3000));
      attempts++;

      const statusRes = await fetch('https://open.tiktokapis.com/v2/post/publish/status/fetch/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tiktokKey}`,
          'Content-Type': 'application/json; charset=UTF-8'
        },
        body: JSON.stringify({ publish_id: publishId })
      });

      const statusData = await statusRes.json();
      const status = statusData.data?.status;

      if (status === 'PUBLISH_COMPLETE') {
        return ok(res, { publishId, status: 'published', platform: 'tiktok' });
      }
      if (status === 'FAILED') {
        return error(res, 'TikTok publish failed: ' + (statusData.data?.fail_reason || 'unknown'));
      }
    }

    // Still processing — return optimistic success
    return ok(res, { publishId, status: 'processing', platform: 'tiktok' });

  } catch (e) {
    return error(res, 'Server error: ' + e.message, 500);
  }
}

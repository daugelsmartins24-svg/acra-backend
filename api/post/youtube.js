// /api/post/youtube.js
// Uploads a video to YouTube via YouTube Data API v3

import { cors, error, ok } from '../_helpers.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return error(res, 'Method not allowed', 405);

  const { videoUrl, title, description, tags, youtubeToken, clientId, clientSecret, refreshToken } = req.body;
  if (!videoUrl) return error(res, 'Video URL required');

  try {
    // Step 1 — Get access token (either directly or via refresh token)
    let accessToken = youtubeToken;
    if (!accessToken && refreshToken && clientId && clientSecret) {
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token'
        })
      });
      const tokenData = await tokenRes.json();
      if (!tokenData.access_token) return error(res, 'Failed to get access token: ' + (tokenData.error_description || tokenData.error || 'unknown'));
      accessToken = tokenData.access_token;
    }
    if (!accessToken) return error(res, 'YouTube OAuth token or refresh token required');

    // Step 2 — Fetch video from URL
    const videoRes = await fetch(videoUrl);
    if (!videoRes.ok) return error(res, 'Could not fetch video from URL');
    const videoBuffer = await videoRes.arrayBuffer();
    const videoBytes = Buffer.from(videoBuffer);
    const contentType = videoRes.headers.get('content-type') || 'video/mp4';

    // Step 3 — Build metadata
    const metadata = JSON.stringify({
      snippet: {
        title: (title || 'ARCA Post').substring(0, 100),
        description: description || '',
        tags: tags || ['ARCA', 'marketing'],
        categoryId: '22'
      },
      status: {
        privacyStatus: 'public',
        selfDeclaredMadeForKids: false
      }
    });

    // Step 4 — Multipart upload
    const boundary = '---ARCABoundary' + Date.now();
    const metaPart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`;
    const videoPart = `--${boundary}\r\nContent-Type: ${contentType}\r\n\r\n`;
    const closing = `\r\n--${boundary}--`;

    const body = Buffer.concat([
      Buffer.from(metaPart),
      Buffer.from(videoPart),
      videoBytes,
      Buffer.from(closing)
    ]);

    const uploadRes = await fetch(
      'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
          'Content-Length': body.length
        },
        body
      }
    );

    const uploadData = await uploadRes.json();

    if (!uploadData.id) {
      return error(res, 'YouTube upload failed: ' + (uploadData.error?.message || 'unknown'));
    }

    return ok(res, {
      videoId: uploadData.id,
      url: `https://youtube.com/watch?v=${uploadData.id}`,
      platform: 'youtube',
      status: 'published'
    });

  } catch (e) {
    return error(res, 'Server error: ' + e.message, 500);
  }
}

// /api/analytics/fetch.js
// Fetches real analytics from TikTok, Instagram, and YouTube

import { cors, error, ok } from '../_helpers.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return error(res, 'Method not allowed', 405);

  const { platform, metaToken, igUserId, tiktokKey, youtubeToken } = req.body;

  const results = {};

  try {
    // ── INSTAGRAM ──
    if ((platform === 'instagram' || platform === 'all') && metaToken && igUserId) {
      try {
        const igRes = await fetch(
          `https://graph.instagram.com/v21.0/${igUserId}?fields=followers_count,media_count,username,name&access_token=${metaToken}`
        );
        const igData = await igRes.json();
        if (igData.followers_count !== undefined) {
          results.instagram = {
            followers: igData.followers_count,
            posts: igData.media_count,
            username: igData.username,
            name: igData.name
          };
        }

        // Get recent media insights
        const mediaRes = await fetch(
          `https://graph.instagram.com/v21.0/${igUserId}/media?fields=id,caption,media_type,timestamp,like_count,comments_count&limit=10&access_token=${metaToken}`
        );
        const mediaData = await mediaRes.json();
        if (mediaData.data) {
          results.instagram.recentPosts = mediaData.data.map(p => ({
            id: p.id,
            caption: p.caption?.substring(0, 100),
            type: p.media_type,
            date: p.timestamp,
            likes: p.like_count || 0,
            comments: p.comments_count || 0
          }));
        }
      } catch (e) {
        results.instagram = { error: e.message };
      }
    }

    // ── TIKTOK ──
    if ((platform === 'tiktok' || platform === 'all') && tiktokKey) {
      try {
        const ttRes = await fetch(
          'https://open.tiktokapis.com/v2/user/info/?fields=follower_count,following_count,video_count,display_name,avatar_url',
          { headers: { 'Authorization': `Bearer ${tiktokKey}` } }
        );
        const ttData = await ttRes.json();
        if (ttData.data?.user) {
          results.tiktok = {
            followers: ttData.data.user.follower_count,
            following: ttData.data.user.following_count,
            posts: ttData.data.user.video_count,
            displayName: ttData.data.user.display_name
          };
        }

        // Get video list
        const videoRes = await fetch(
          'https://open.tiktokapis.com/v2/video/list/?fields=id,title,create_time,share_count,view_count,like_count,comment_count',
          {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${tiktokKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ max_count: 10 })
          }
        );
        const videoData = await videoRes.json();
        if (videoData.data?.videos) {
          results.tiktok.recentPosts = videoData.data.videos.map(v => ({
            id: v.id,
            title: v.title,
            date: new Date(v.create_time * 1000).toLocaleDateString(),
            views: v.view_count || 0,
            likes: v.like_count || 0,
            shares: v.share_count || 0,
            comments: v.comment_count || 0
          }));
        }
      } catch (e) {
        results.tiktok = { error: e.message };
      }
    }

    // ── YOUTUBE ──
    if ((platform === 'youtube' || platform === 'all') && youtubeToken) {
      try {
        const ytRes = await fetch(
          'https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&mine=true',
          { headers: { 'Authorization': `Bearer ${youtubeToken}` } }
        );
        const ytData = await ytRes.json();
        const channel = ytData.items?.[0];
        if (channel) {
          results.youtube = {
            followers: parseInt(channel.statistics.subscriberCount || 0),
            posts: parseInt(channel.statistics.videoCount || 0),
            views: parseInt(channel.statistics.viewCount || 0),
            channelName: channel.snippet.title
          };
        }

        // Get recent videos
        const videosRes = await fetch(
          'https://www.googleapis.com/youtube/v3/search?part=snippet&forMine=true&maxResults=10&type=video&order=date',
          { headers: { 'Authorization': `Bearer ${youtubeToken}` } }
        );
        const videosData = await videosRes.json();
        if (videosData.items) {
          results.youtube.recentPosts = videosData.items.map(v => ({
            id: v.id.videoId,
            title: v.snippet.title,
            date: v.snippet.publishedAt?.substring(0, 10),
            thumbnail: v.snippet.thumbnails?.default?.url
          }));
        }
      } catch (e) {
        results.youtube = { error: e.message };
      }
    }

    return ok(res, { analytics: results });

  } catch (e) {
    return error(res, 'Server error: ' + e.message, 500);
  }
}

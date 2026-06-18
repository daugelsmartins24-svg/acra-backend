// /api/health.js
import { cors, ok } from './_helpers.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  return ok(res, { status: 'ARCA backend online', version: '3.0', timestamp: new Date().toISOString() });
}

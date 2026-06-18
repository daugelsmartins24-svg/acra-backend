export function cors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-arca-key');
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }
  return false;
}
export function error(res, msg, status = 400) {
  return res.status(status).json({ success: false, error: msg });
}
export function ok(res, data) {
  return res.status(200).json({ success: true, ...data });
}

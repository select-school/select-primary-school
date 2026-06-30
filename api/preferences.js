const { redis, getUserId } = require('./auth-helper');

module.exports = async (req, res) => {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = await getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const key = `user:${userId}`;
  const data = (await redis.get(key)) || {};
  data._preferences = { ...req.body, updatedAt: new Date().toISOString() };
  await redis.set(key, data);
  return res.json({ success: true });
};

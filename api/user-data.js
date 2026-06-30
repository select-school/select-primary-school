const { Redis } = require('@upstash/redis');
const { createClient } = require('@supabase/supabase-js');

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function getUserId(req) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user.id;
}

module.exports = async (req, res) => {
  const userId = await getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const key = `user:${userId}`;

  if (req.method === 'GET') {
    const data = (await redis.get(key)) || {};
    return res.json(data);
  }

  if (req.method === 'PUT') {
    const { id, rating, ratingReason, notes } = req.body;
    if (!id) return res.status(400).json({ error: 'Missing id' });
    const data = (await redis.get(key)) || {};
    if (!data[id]) data[id] = {};
    if (rating !== undefined) data[id].rating = rating;
    if (ratingReason !== undefined) data[id].ratingReason = ratingReason;
    if (notes !== undefined) data[id].notes = notes;
    data[id].updatedAt = new Date().toISOString();
    await redis.set(key, data);
    return res.json({ success: true });
  }

  res.status(405).json({ error: 'Method not allowed' });
};

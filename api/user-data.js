const { supabase, getUserId } = require('./auth-helper');

module.exports = async (req, res) => {
  const userId = await getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  if (req.method === 'GET') {
    const [{ data: ratings }, { data: prefs }] = await Promise.all([
      supabase.from('school_ratings').select('*').eq('user_id', userId),
      supabase.from('user_preferences').select('*').eq('user_id', userId).single(),
    ]);

    const result = {};
    (ratings || []).forEach(r => {
      result[r.school_id] = {
        rating: r.rating,
        ratingReason: r.rating_reason,
        notes: r.notes,
        updatedAt: r.updated_at,
      };
    });

    if (prefs) {
      result._preferences = {
        districts: prefs.districts,
        schoolNets: prefs.school_nets,
        schoolTypes: prefs.school_types,
        onboardingCompleted: prefs.onboarding_completed,
        updatedAt: prefs.updated_at,
      };
    }

    return res.json(result);
  }

  if (req.method === 'PUT') {
    const { id, rating, ratingReason, notes } = req.body;
    if (!id) return res.status(400).json({ error: 'Missing id' });

    const row = { user_id: userId, school_id: id, updated_at: new Date().toISOString() };
    if (rating !== undefined) row.rating = rating;
    if (ratingReason !== undefined) row.rating_reason = ratingReason;
    if (notes !== undefined) row.notes = notes;

    const { error } = await supabase
      .from('school_ratings')
      .upsert(row, { onConflict: 'user_id,school_id' });

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true });
  }

  res.status(405).json({ error: 'Method not allowed' });
};

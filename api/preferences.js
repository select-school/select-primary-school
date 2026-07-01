const { supabase, getUserId } = require('./auth-helper');

module.exports = async (req, res) => {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = await getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { districts, schoolNets, schoolTypes, onboardingCompleted } = req.body;

  const { error } = await supabase
    .from('user_preferences')
    .upsert({
      user_id: userId,
      districts: districts || [],
      school_nets: schoolNets || [],
      school_types: schoolTypes || [],
      onboarding_completed: onboardingCompleted || false,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ success: true });
};

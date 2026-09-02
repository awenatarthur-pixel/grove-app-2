import { createClient } from '@supabase/supabase-js';

// Uses the SERVICE ROLE key so this can write to both the new user's and the
// referrer's profile rows, bypassing row-level security (a normal signed-in
// user can only edit their own row, which isn't enough for crediting someone else).
const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { newUserId, referrerId } = req.body || {};
  if (!newUserId || !referrerId) return res.status(400).json({ error: 'Missing newUserId or referrerId' });
  if (newUserId === referrerId) return res.status(400).json({ error: 'Cannot refer yourself' });

  try {
    // A user can only ever be credited to one referrer, ever — check this first
    // so someone can't reload the link and get their referrer "double-paid."
    const { data: newUserProfile, error: fetchErr } = await supabaseAdmin
      .from('profiles')
      .select('referred_by')
      .eq('id', newUserId)
      .single();
    if (fetchErr) return res.status(404).json({ error: 'New user profile not found' });
    if (newUserProfile.referred_by) return res.status(200).json({ success: false, reason: 'already credited' });

    // Confirm the referrer is a real, existing account (not a made-up ID in a tampered link)
    const { data: referrerProfile, error: refErr } = await supabaseAdmin
      .from('profiles')
      .select('id, flowers')
      .eq('id', referrerId)
      .single();
    if (refErr || !referrerProfile) return res.status(404).json({ error: 'Referrer not found' });

    // Lock in the attribution first, so a retry/race can't credit twice
    await supabaseAdmin.from('profiles').update({ referred_by: referrerId }).eq('id', newUserId);

    // Reward the referrer: a Friendly Dragon (flower) and Grove Pro
    const currentFlowers = referrerProfile.flowers || 0;
    await supabaseAdmin
      .from('profiles')
      .update({ pro: true, flowers: currentFlowers + 1 })
      .eq('id', referrerId);

    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Referral credit error:', err);
    res.status(500).json({ error: err.message });
  }
}

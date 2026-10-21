import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Verify who's calling from their session token first.
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  const { data: userData, error: authErr } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !userData?.user) return res.status(401).json({ error: 'Invalid session' });

  // Look up the caller's OWN Stripe customer id server-side — never trust one
  // supplied by the client, since that could let someone manage another account's billing.
  const { data: profile, error: profileErr } = await supabaseAdmin
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', userData.user.id)
    .single();
  if (profileErr || !profile?.stripe_customer_id) {
    return res.status(404).json({ error: 'No subscription found for this account yet' });
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${req.headers.origin}/`,
    });
    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Portal session error:', err);
    res.status(500).json({ error: err.message });
  }
}

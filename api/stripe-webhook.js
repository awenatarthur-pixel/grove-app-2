import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Uses the SERVICE ROLE key (server-side only, never exposed to the browser)
// so this function can write to any user's profile row, bypassing row-level security.
const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Stripe needs the raw, unparsed request body to verify the webhook signature.
export const config = { api: { bodyParser: false } };

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const signature = req.headers['stripe-signature'];
  const rawBody = await readRawBody(req);

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Stripe can deliver the same event more than once. Record each event id first; if it's
  // already recorded, we've handled it, so do nothing. (Needs the stripe_events table.)
  const { error: dupErr } = await supabaseAdmin.from('stripe_events').insert({ id: event.id });
  if (dupErr) {
    if (dupErr.code === '23505') return res.status(200).json({ received: true, duplicate: true });
    console.error('Could not record Stripe event:', dupErr);
    return res.status(500).json({ error: 'Could not record event' });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const userId = session.client_reference_id;
      const purchaseType = session.metadata?.purchaseType;

      if (userId && purchaseType === 'sparks') {
        // Sparks bundle — add to the existing balance, don't overwrite it
        const sparkAmount = parseInt(session.metadata?.sparkAmount || '0', 10);
        const { data: profile, error: fetchErr } = await supabaseAdmin
          .from('profiles')
          .select('sparks')
          .eq('id', userId)
          .single();

        if (fetchErr) {
          console.error('Sparks purchase: failed to fetch profile for userId', userId, fetchErr);
          throw new Error('Sparks purchase failed: could not read profile');
        } else {
          const currentSparks = profile?.sparks || 0;
          const { error: updateErr } = await supabaseAdmin
            .from('profiles')
            .update({ sparks: currentSparks + sparkAmount })
            .eq('id', userId);
          if (updateErr) {
            console.error('Sparks purchase: failed to update sparks for userId', userId, updateErr);
            throw new Error('Sparks purchase failed: could not update balance');
          } else {
            console.log(`Sparks purchase: credited ${sparkAmount} to userId ${userId}, new total ${currentSparks + sparkAmount}`);
          }
        }
      } else if (userId) {
        // Grove Pro plan (subscription or lifetime)
        const planId = session.metadata?.planId;
        const { error: updateErr } = await supabaseAdmin
          .from('profiles')
          .update({ pro: true, pro_plan: planId, stripe_customer_id: session.customer })
          .eq('id', userId);
        if (updateErr) {
          console.error('Pro purchase: failed to update profile for userId', userId, updateErr);
          throw new Error('Pro purchase failed: could not update profile');
        }
      }
    }

    // If a monthly/yearly subscription is cancelled or fails renewal, revoke Pro access.
    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object;
      const { error: cancelErr } = await supabaseAdmin
        .from('profiles')
        .update({ pro: false, pro_plan: null })
        .eq('stripe_customer_id', subscription.customer)
        .neq('pro_plan', 'lifetime'); // an old cancelled subscription must never remove a Lifetime purchase
      if (cancelErr) {
        console.error('Subscription cancellation: failed to update profile', cancelErr);
        throw new Error('Cancellation failed: could not update profile');
      }
    }

    // A fully refunded Lifetime purchase removes Pro. (Monthly/yearly refunds are handled by
    // cancelling the subscription in Stripe, which triggers the cancellation above.)
    if (event.type === 'charge.refunded') {
      const charge = event.data.object;
      if (charge.refunded && charge.customer) {
        const { error: refundErr } = await supabaseAdmin
          .from('profiles')
          .update({ pro: false, pro_plan: null })
          .eq('stripe_customer_id', charge.customer)
          .eq('pro_plan', 'lifetime');
        if (refundErr) {
          console.error('Refund: failed to update profile', refundErr);
          throw new Error('Refund failed: could not update profile');
        }
      }
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook handler error:', err);
    // Forget this event so Stripe's automatic retry gets processed instead of skipped as a duplicate.
    await supabaseAdmin.from('stripe_events').delete().eq('id', event.id);
    res.status(500).json({ error: err.message });
  }
}

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
        } else {
          const currentSparks = profile?.sparks || 0;
          const { error: updateErr } = await supabaseAdmin
            .from('profiles')
            .update({ sparks: currentSparks + sparkAmount })
            .eq('id', userId);
          if (updateErr) {
            console.error('Sparks purchase: failed to update sparks for userId', userId, updateErr);
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
        }
      }
    }

    // If a monthly/yearly subscription is cancelled or fails renewal, revoke Pro access.
    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object;
      const { error: cancelErr } = await supabaseAdmin
        .from('profiles')
        .update({ pro: false, pro_plan: null })
        .eq('stripe_customer_id', subscription.customer);
      if (cancelErr) {
        console.error('Subscription cancellation: failed to update profile', cancelErr);
      }
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook handler error:', err);
    res.status(500).json({ error: err.message });
  }
}

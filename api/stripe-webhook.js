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
      const planId = session.metadata?.planId;

      if (userId) {
        await supabaseAdmin
          .from('profiles')
          .update({ pro: true, pro_plan: planId, stripe_customer_id: session.customer })
          .eq('id', userId);
      }
    }

    // If a monthly/yearly subscription is cancelled or fails renewal, revoke Pro access.
    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object;
      await supabaseAdmin
        .from('profiles')
        .update({ pro: false, pro_plan: null })
        .eq('stripe_customer_id', subscription.customer);
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook handler error:', err);
    res.status(500).json({ error: err.message });
  }
}

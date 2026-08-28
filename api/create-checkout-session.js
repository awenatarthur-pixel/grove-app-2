import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const PRO_PRICE_IDS = {
  monthly: process.env.STRIPE_PRICE_MONTHLY,
  yearly: process.env.STRIPE_PRICE_YEARLY,
  lifetime: process.env.STRIPE_PRICE_LIFETIME,
};

const SPARK_PRICE_IDS = {
  b3: { priceId: process.env.STRIPE_PRICE_SPARKS_3, amount: 3 },
  b6: { priceId: process.env.STRIPE_PRICE_SPARKS_6, amount: 6 },
  b12: { priceId: process.env.STRIPE_PRICE_SPARKS_12, amount: 12 },
  b24: { priceId: process.env.STRIPE_PRICE_SPARKS_24, amount: 24 },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { planId, bundleId, userId, email } = req.body || {};
  if (!userId || !email) return res.status(400).json({ error: 'Missing userId or email — user must be signed in' });

  try {
    let session;

    if (planId) {
      // Grove Pro subscription or lifetime purchase
      const priceId = PRO_PRICE_IDS[planId];
      if (!priceId) return res.status(400).json({ error: `Unknown plan: ${planId}` });

      session = await stripe.checkout.sessions.create({
        mode: planId === 'lifetime' ? 'payment' : 'subscription',
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        customer_email: email,
        client_reference_id: userId,
        metadata: { userId, planId, purchaseType: 'pro' },
        success_url: `${req.headers.origin}/?checkout=success`,
        cancel_url: `${req.headers.origin}/?checkout=cancelled`,
      });
    } else if (bundleId) {
      // Sparks bundle — a one-time top-up
      const bundle = SPARK_PRICE_IDS[bundleId];
      if (!bundle || !bundle.priceId) return res.status(400).json({ error: `Unknown bundle: ${bundleId}` });

      session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [{ price: bundle.priceId, quantity: 1 }],
        customer_email: email,
        client_reference_id: userId,
        metadata: { userId, bundleId, sparkAmount: String(bundle.amount), purchaseType: 'sparks' },
        success_url: `${req.headers.origin}/?checkout=success`,
        cancel_url: `${req.headers.origin}/?checkout=cancelled`,
      });
    } else {
      return res.status(400).json({ error: 'Missing planId or bundleId' });
    }

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe checkout session error:', err);
    res.status(500).json({ error: err.message });
  }
}

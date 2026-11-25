import Stripe from "stripe";

let stripeClient: Stripe | null = null;

export function getSiteBuilderStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("SiteBuilder Stripe is not configured. Set STRIPE_SECRET_KEY on the SiteBuilder deployment.");
  }

  if (!stripeClient) stripeClient = new Stripe(secretKey);
  return stripeClient;
}

export function siteBuilderStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

const { Hono } = require("hono");
const { env } = require("hono/adapter");
const Stripe = require("stripe");
const app = new Hono();

app.post("/v1/pay", async (context) => {
  // Load the Stripe API key from context.
  const { STRIPE_WEBHOOK_SECRET } = env(context);
  /**
   * Load the Stripe client from the context
   */
  const stripe = context.get('stripe');
  const signature = context.req.raw.headers.get("stripe-signature");
  try {
    if (!signature) {
      return context.text("", 400);
    }
    const body = await context.req.text();
    const event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      STRIPE_WEBHOOK_SECRET
    );
    switch (event.type) {
      case "payment_intent.created": {
        console.log(event.data.object)
        break
      }
      default:
        break
    }
    return context.text("", 200);
  } catch (err) {
    const errorMessage = `⚠️  Webhook signature verification failed. ${err instanceof Error ? err.message : "Internal server error"}`
    console.log(errorMessage);
    return context.text(errorMessage, 400);
  }
})

export default app;

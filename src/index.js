import { upgradeWebSocket } from "hono/cloudflare-workers";

const { Hono } = require("hono");
const { env } = require("hono/adapter");
const Stripe = require("stripe");
const app = new Hono();

const connections = new Map();
/**
 * Setup Stripe SDK prior to handling a request
 */
app.use('*', async (context, next) => {
  // Load the Stripe API key from context.
  const { STRIPE_API_KEY: stripeKey } = env(context);

  // Instantiate the Stripe client object 
  const stripe = new Stripe(stripeKey, {
    appInfo: {
      // For sample support and debugging, not required for production:
      name: "stripe-samples/stripe-node-cloudflare-worker-template",
      version: "0.0.1",
      url: "https://github.com/stripe-samples"
    },
    maxNetworkRetries: 3,
    timeout: 30 * 1000,
  });

  // Set the Stripe client to the Variable context object
  context.set("stripe", stripe);
  const { WAPILOT } = env(context);
  context.set('db', WAPILOT);
  await next();
});


app.post("/v1/pay", async (context) => {
  // 获取stripe secret
  const { STRIPE_WEBHOOK_SECRET } = env(context);
  try {
    // 获取数据库
    const db = context.get('db');
    // const stripe = context.get('stripe');
    // const signature = context.req.raw.headers.get("stripe-signature");
    // if (!signature) {
    //   return context.text("", 400);
    // }
    // const body = await context.req.text();
    // const event = await stripe.webhooks.constructEventAsync(
    //   body,
    //   signature,
    //   STRIPE_WEBHOOK_SECRET
    // );
    const event = await context.req.json()
    const id = event.id;
    const deviceId = event.data.object.client_reference_id;
    // let licenseKey = '';
    switch (event.type) {
      case "payment_intent.succeeded": {
        // 获取激活码
        const response = await fetch(`https://generater.luoyutao1028.workers.dev/encrypt?deviceId=${deviceId}`);
        const license = await response.text();
        // licenseKey = license;
        // 支付成功，存储至D1数据库
        await db.prepare(
          "INSERT INTO [order] (id, order_id, device_id, order_info, license) VALUES (?, ?, ?, ?, ?)"
        ).bind(id, id, deviceId, JSON.stringify(event.data.object), license).run();
        const ws = connections.get(deviceId);
        setTimeout(() => {
          if (ws) {
            ws.send(JSON.stringify({ deviceId, license, id, type: event.type }));
            ws.close();
          }
        }, 500);

        break;
      }
      default:
        break
    }
    return context.text('', 200)
  } catch (error) {
    const errorMessage = `⚠️  Webhook signature verification failed. ${err instanceof Error ? err.message : "Internal server error"}`
    console.log(errorMessage);
    return context.text(errorMessage, 400);
  }
})

app.get('/v1/checkPay', async (context) => {
  try {

    const db = context.get('db');
    db.prepare(`
      SELECT * FROM [order] WHERE device_id = ?`).bind()
  } catch (error) {

  }
})

app.get('/ws', upgradeWebSocket((c) => {
  const deviceId = c.req.query('deviceId');
  return {
    onOpen(_, ws) {
      connections.set(deviceId, ws);
      ws.send('连接成功')
    },
    onClose() {
      connections.delete(deviceId);
    }
  }
}))

export default app;
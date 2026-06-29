const Stripe = require('stripe');

let connectionSettings = null;
let cachedCredentials = null;

async function getCredentials() {
  if (cachedCredentials) {
    return cachedCredentials;
  }

  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? 'depl ' + process.env.WEB_REPL_RENEWAL
      : null;

  const isProduction = process.env.REPLIT_DEPLOYMENT === '1';
  const targetEnvironment = isProduction ? 'production' : 'development';

  // Try connector first
  if (xReplitToken && hostname) {
    try {
      const connectorName = 'stripe';
      const url = new URL(`https://${hostname}/api/v2/connection`);
      url.searchParams.set('include_secrets', 'true');
      url.searchParams.set('connector_names', connectorName);
      url.searchParams.set('environment', targetEnvironment);

      const response = await fetch(url.toString(), {
        headers: {
          'Accept': 'application/json',
          'X_REPLIT_TOKEN': xReplitToken
        }
      });

      const data = await response.json();
      connectionSettings = data.items?.[0];

      if (connectionSettings?.settings?.publishable && connectionSettings?.settings?.secret) {
        console.log(`✅ Stripe ${targetEnvironment} connector credentials loaded`);
        cachedCredentials = {
          publishableKey: connectionSettings.settings.publishable,
          secretKey: connectionSettings.settings.secret,
        };
        return cachedCredentials;
      }
    } catch (connectorError) {
      console.warn(`⚠️ Stripe connector not available: ${connectorError.message}`);
    }
  }

  // Fallback to environment secrets
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;

  if (secretKey && publishableKey) {
    console.log(`✅ Stripe credentials loaded from environment secrets (${isProduction ? 'production' : 'development'})`);
    cachedCredentials = {
      publishableKey: publishableKey,
      secretKey: secretKey,
    };
    return cachedCredentials;
  }

  throw new Error(`Stripe credentials not found. Please configure Stripe in deployment settings or set STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY secrets.`);
}

async function getUncachableStripeClient() {
  const { secretKey } = await getCredentials();
  return new Stripe(secretKey, {
    apiVersion: '2024-11-20.acacia',
  });
}

async function getStripePublishableKey() {
  const { publishableKey } = await getCredentials();
  return publishableKey;
}

async function getStripeSecretKey() {
  const { secretKey } = await getCredentials();
  return secretKey;
}

let stripeSync = null;

async function getStripeSync() {
  if (!stripeSync) {
    const { StripeSync } = require('stripe-replit-sync');
    const secretKey = await getStripeSecretKey();

    stripeSync = new StripeSync({
      poolConfig: {
        connectionString: process.env.DATABASE_URL,
        max: 2,
      },
      stripeSecretKey: secretKey,
    });
  }
  return stripeSync;
}

module.exports = {
  getUncachableStripeClient,
  getStripePublishableKey,
  getStripeSecretKey,
  getStripeSync,
};

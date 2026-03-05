const { getUncachableStripeClient } = require('./stripeClient');

let _cachedProducts = null;
let _cacheExpiry = 0;
const CACHE_TTL_MS = 60 * 60 * 1000;

/**
 * StripeService: Handles direct Stripe API operations
 * Use Stripe client for write operations, StripeStorage for read operations
 */
class StripeService {
  async createCustomer(email, userId) {
    const stripe = await getUncachableStripeClient();
    return await stripe.customers.create({
      email,
      metadata: { userId },
    });
  }

  async createCheckoutSession(customerId, priceId, successUrl, cancelUrl) {
    const stripe = await getUncachableStripeClient();
    return await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      locale: 'auto'
    });
  }

  async createCustomerPortalSession(customerId, returnUrl) {
    const stripe = await getUncachableStripeClient();
    return await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
  }

  async ensureSubscriptionProducts() {
    const now = Date.now();
    if (_cachedProducts && now < _cacheExpiry) {
      return _cachedProducts;
    }

    const stripe = await getUncachableStripeClient();
    
    let studentProduct = await this.findOrCreateProduct(stripe, 'Kenostod Student', 'Student Subscription - Access to all courses and learning materials');
    let proProduct = await this.findOrCreateProduct(stripe, 'Kenostod Professional', 'Professional Subscription - Everything in Student plus Corporate/B2B features');

    const studentPrice = await this.findOrCreatePrice(stripe, studentProduct.id, 9.99);
    const proPrice = await this.findOrCreatePrice(stripe, proProduct.id, 29.99);

    _cachedProducts = {
      student: { product: studentProduct, price: studentPrice },
      professional: { product: proProduct, price: proPrice }
    };
    _cacheExpiry = now + CACHE_TTL_MS;

    return _cachedProducts;
  }

  async findOrCreateProduct(stripe, name, description) {
    try {
      const products = await stripe.products.list({ limit: 100, active: true });
      const existing = products.data.find(p => p.name === name && p.active);
      
      if (existing) {
        return existing;
      }
      
      return await stripe.products.create({
        name,
        description,
      });
    } catch (error) {
      console.error('Error in findOrCreateProduct:', error.message);
      throw error;
    }
  }

  async findOrCreatePrice(stripe, productId, amount) {
    try {
      const prices = await stripe.prices.list({ product: productId, active: true, limit: 100 });
      const existing = prices.data.find(p => p.unit_amount === Math.round(amount * 100) && p.active === true && p.recurring?.interval === 'month');
      
      if (existing) {
        return existing;
      }
      
      return await stripe.prices.create({
        product: productId,
        unit_amount: Math.round(amount * 100),
        currency: 'usd',
        recurring: {
          interval: 'month',
          interval_count: 1,
        },
      });
    } catch (error) {
      console.error('Error in findOrCreatePrice:', error.message);
      throw error;
    }
  }

  async listPrices() {
    const stripe = await getUncachableStripeClient();
    const prices = await stripe.prices.list({ limit: 100 });
    return prices.data;
  }
}

module.exports = new StripeService();

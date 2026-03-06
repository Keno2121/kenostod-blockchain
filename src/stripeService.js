const { getUncachableStripeClient } = require('./stripeClient');

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
    const stripe = await getUncachableStripeClient();
    
    // Get or create Student product
    let studentProduct = await this.findOrCreateProduct(stripe, 'Kenostod Student', 'Student Subscription - Access to all courses and learning materials');
    
    // Get or create Professional product
    let proProduct = await this.findOrCreateProduct(stripe, 'Kenostod Professional', 'Professional Subscription - Everything in Student plus Corporate/B2B features');

    // Create prices if they don't exist
    const studentPrice = await this.findOrCreatePrice(stripe, studentProduct.id, 9.99, 'Student subscription');
    const proPrice = await this.findOrCreatePrice(stripe, proProduct.id, 29.99, 'Professional subscription');

    return {
      student: { product: studentProduct, price: studentPrice },
      professional: { product: proProduct, price: proPrice }
    };
  }

  async findOrCreateProduct(stripe, name, description) {
    try {
      // List products to find existing one
      const products = await stripe.products.list({ limit: 100 });
      const existing = products.data.find(p => p.name === name);
      
      if (existing) {
        return existing;
      }
      
      // Create new product
      return await stripe.products.create({
        name,
        description,
        type: 'service',
      });
    } catch (error) {
      console.error('Error in findOrCreateProduct:', error.message);
      throw error;
    }
  }

  async findOrCreatePrice(stripe, productId, amount, description) {
    try {
      // List prices for this product
      const prices = await stripe.prices.list({ product: productId, limit: 100 });
      const existing = prices.data.find(p => p.unit_amount === Math.round(amount * 100) && p.status === 'active');
      
      if (existing) {
        return existing;
      }
      
      // Create new price
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

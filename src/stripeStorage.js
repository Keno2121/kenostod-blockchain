/**
 * StripeStorage: Query Stripe data from PostgreSQL stripe.* schema tables
 * stripe-replit-sync creates and manages these tables automatically
 */
class StripeStorage {
  constructor(db) {
    this.db = db;
  }

  async getProduct(productId) {
    const result = await this.db.query(
      'SELECT * FROM stripe.products WHERE id = $1',
      [productId]
    );
    return result.rows[0] || null;
  }

  async listProducts(active = true, limit = 20, offset = 0) {
    const result = await this.db.query(
      'SELECT * FROM stripe.products WHERE active = $1 ORDER BY id LIMIT $2 OFFSET $3',
      [active, limit, offset]
    );
    return result.rows;
  }

  async listProductsWithPrices(active = true, limit = 20, offset = 0) {
    const result = await this.db.query(`
      WITH paginated_products AS (
        SELECT id, name, description, metadata, active
        FROM stripe.products
        WHERE active = $1
        ORDER BY id
        LIMIT $2 OFFSET $3
      )
      SELECT 
        p.id as product_id,
        p.name as product_name,
        p.description as product_description,
        p.active as product_active,
        p.metadata as product_metadata,
        pr.id as price_id,
        pr.unit_amount,
        pr.currency,
        pr.recurring,
        pr.active as price_active
      FROM paginated_products p
      LEFT JOIN stripe.prices pr ON pr.product = p.id AND pr.active = true
      ORDER BY p.id, pr.unit_amount
    `, [active, limit, offset]);
    return result.rows;
  }

  async getPrice(priceId) {
    const result = await this.db.query(
      'SELECT * FROM stripe.prices WHERE id = $1',
      [priceId]
    );
    return result.rows[0] || null;
  }

  async listPrices(active = true, limit = 20, offset = 0) {
    const result = await this.db.query(
      'SELECT * FROM stripe.prices WHERE active = $1 LIMIT $2 OFFSET $3',
      [active, limit, offset]
    );
    return result.rows;
  }

  async getPricesForProduct(productId) {
    const result = await this.db.query(
      'SELECT * FROM stripe.prices WHERE product = $1 AND active = true',
      [productId]
    );
    return result.rows;
  }

  async getSubscription(subscriptionId) {
    const result = await this.db.query(
      'SELECT * FROM stripe.subscriptions WHERE id = $1',
      [subscriptionId]
    );
    return result.rows[0] || null;
  }

  async getCustomer(customerId) {
    const result = await this.db.query(
      'SELECT * FROM stripe.customers WHERE id = $1',
      [customerId]
    );
    return result.rows[0] || null;
  }
}

module.exports = StripeStorage;

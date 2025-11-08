const { Pool } = require('pg');

class DatabaseConnection {
    constructor() {
        if (!process.env.DATABASE_URL) {
            throw new Error('DATABASE_URL environment variable is not set');
        }

        this.pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: {
                rejectUnauthorized: false
            }
        });

        this.pool.on('error', (err) => {
            console.error('❌ Unexpected database error:', err);
        });

        console.log('✅ PostgreSQL connection pool initialized');
    }

    async query(text, params) {
        const start = Date.now();
        try {
            const res = await this.pool.query(text, params);
            const duration = Date.now() - start;
            if (duration > 1000) {
                console.log(`⚠️  Slow query (${duration}ms):`, text);
            }
            return res;
        } catch (error) {
            console.error('❌ Database query error:', error.message);
            console.error('Query:', text);
            throw error;
        }
    }

    async initializeSchema() {
        try {
            await this.query(`
                CREATE TABLE IF NOT EXISTS organizations (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    owner_email VARCHAR(255) NOT NULL,
                    owner_wallet_address VARCHAR(255),
                    company_type VARCHAR(50) DEFAULT 'corporate',
                    total_seats INTEGER DEFAULT 10,
                    used_seats INTEGER DEFAULT 0,
                    stripe_customer_id VARCHAR(255),
                    stripe_subscription_id VARCHAR(255),
                    subscription_status VARCHAR(50) DEFAULT 'active',
                    monthly_price DECIMAL(10, 2) DEFAULT 200.00,
                    billing_cycle_day INTEGER DEFAULT 1,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);

            await this.query(`
                CREATE TABLE IF NOT EXISTS organization_members (
                    id SERIAL PRIMARY KEY,
                    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
                    user_email VARCHAR(255) NOT NULL,
                    user_wallet_address VARCHAR(255),
                    role VARCHAR(50) DEFAULT 'member',
                    invite_status VARCHAR(50) DEFAULT 'pending',
                    invited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    joined_at TIMESTAMP,
                    last_active TIMESTAMP,
                    UNIQUE(organization_id, user_email)
                );
            `);

            await this.query(`
                CREATE TABLE IF NOT EXISTS learning_progress (
                    id SERIAL PRIMARY KEY,
                    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
                    member_id INTEGER REFERENCES organization_members(id) ON DELETE CASCADE,
                    user_wallet_address VARCHAR(255),
                    course_name VARCHAR(255),
                    completion_percentage INTEGER DEFAULT 0,
                    time_spent_minutes INTEGER DEFAULT 0,
                    last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    completed_at TIMESTAMP,
                    quiz_score INTEGER,
                    UNIQUE(member_id, course_name)
                );
            `);

            await this.query(`
                CREATE TABLE IF NOT EXISTS seat_usage_history (
                    id SERIAL PRIMARY KEY,
                    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
                    seats_used INTEGER NOT NULL,
                    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);

            await this.query(`
                CREATE INDEX IF NOT EXISTS idx_org_members_org_id ON organization_members(organization_id);
            `);

            await this.query(`
                CREATE INDEX IF NOT EXISTS idx_learning_progress_org_id ON learning_progress(organization_id);
            `);

            await this.query(`
                CREATE INDEX IF NOT EXISTS idx_learning_progress_member_id ON learning_progress(member_id);
            `);

            await this.query(`
                CREATE TABLE IF NOT EXISTS white_label_licenses (
                    id SERIAL PRIMARY KEY,
                    license_id VARCHAR(255) UNIQUE NOT NULL,
                    license_key VARCHAR(255) UNIQUE NOT NULL,
                    organization_name VARCHAR(255) NOT NULL,
                    tier VARCHAR(50) NOT NULL,
                    contact_email VARCHAR(255) NOT NULL,
                    custom_domain VARCHAR(255),
                    monthly_price DECIMAL(10, 2) NOT NULL,
                    status VARCHAR(50) DEFAULT 'active',
                    stripe_customer_id VARCHAR(255),
                    stripe_subscription_id VARCHAR(255),
                    total_revenue DECIMAL(12, 2) DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    expires_at TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);

            await this.query(`
                CREATE TABLE IF NOT EXISTS license_payments (
                    id SERIAL PRIMARY KEY,
                    license_id VARCHAR(255) REFERENCES white_label_licenses(license_id) ON DELETE CASCADE,
                    payment_id VARCHAR(255) UNIQUE NOT NULL,
                    amount DECIMAL(10, 2) NOT NULL,
                    period VARCHAR(100),
                    payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);

            await this.query(`
                CREATE INDEX IF NOT EXISTS idx_licenses_org_name ON white_label_licenses(organization_name);
            `);

            await this.query(`
                CREATE INDEX IF NOT EXISTS idx_licenses_tier ON white_label_licenses(tier);
            `);

            await this.query(`
                CREATE INDEX IF NOT EXISTS idx_license_payments_license_id ON license_payments(license_id);
            `);

            console.log('✅ Database schema initialized successfully');
            return true;
        } catch (error) {
            console.error('❌ Error initializing database schema:', error.message);
            throw error;
        }
    }

    async close() {
        await this.pool.end();
        console.log('✅ Database connection pool closed');
    }
}

module.exports = DatabaseConnection;

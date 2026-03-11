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

            await this.query(`
                CREATE TABLE IF NOT EXISTS student_rewards (
                    id SERIAL PRIMARY KEY,
                    user_wallet_address VARCHAR(255) NOT NULL,
                    user_email VARCHAR(255),
                    reward_type VARCHAR(50) NOT NULL,
                    reward_amount DECIMAL(18, 8) NOT NULL,
                    course_name VARCHAR(255),
                    course_id INTEGER NOT NULL,
                    description TEXT,
                    status VARCHAR(50) DEFAULT 'pending',
                    claimed_at TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(user_wallet_address, course_id)
                );
            `);

            await this.query(`
                CREATE TABLE IF NOT EXISTS course_progress (
                    id SERIAL PRIMARY KEY,
                    user_wallet_address VARCHAR(255) NOT NULL,
                    course_id INTEGER NOT NULL,
                    quiz_score INTEGER,
                    time_spent_seconds INTEGER,
                    modules_completed INTEGER,
                    completion_verified BOOLEAN DEFAULT false,
                    verified_at TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(user_wallet_address, course_id)
                );
            `);

            await this.query(`
                CREATE TABLE IF NOT EXISTS scholarship_applications (
                    id SERIAL PRIMARY KEY,
                    applicant_name VARCHAR(255) NOT NULL,
                    applicant_email VARCHAR(255) NOT NULL,
                    country VARCHAR(100) NOT NULL,
                    age INTEGER,
                    current_income_usd DECIMAL(10, 2),
                    education_level VARCHAR(100),
                    motivation_statement TEXT NOT NULL,
                    financial_need_statement TEXT NOT NULL,
                    career_goals TEXT,
                    application_status VARCHAR(50) DEFAULT 'pending',
                    reviewed_by VARCHAR(255),
                    review_notes TEXT,
                    verification_score INTEGER DEFAULT 0,
                    documents_verified BOOLEAN DEFAULT false,
                    approved_at TIMESTAMP,
                    rejected_at TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);

            await this.query(`
                CREATE TABLE IF NOT EXISTS scholarship_documents (
                    id SERIAL PRIMARY KEY,
                    application_id INTEGER REFERENCES scholarship_applications(id) ON DELETE CASCADE,
                    document_type VARCHAR(100) NOT NULL,
                    document_url VARCHAR(500),
                    document_hash VARCHAR(255),
                    verification_status VARCHAR(50) DEFAULT 'pending',
                    verified_by VARCHAR(255),
                    verified_at TIMESTAMP,
                    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);

            await this.query(`
                CREATE TABLE IF NOT EXISTS job_listings (
                    id SERIAL PRIMARY KEY,
                    job_id VARCHAR(255) UNIQUE NOT NULL,
                    company_name VARCHAR(255) NOT NULL,
                    job_title VARCHAR(255) NOT NULL,
                    job_type VARCHAR(50),
                    location VARCHAR(255),
                    remote_allowed BOOLEAN DEFAULT false,
                    salary_min DECIMAL(10, 2),
                    salary_max DECIMAL(10, 2),
                    salary_currency VARCHAR(10) DEFAULT 'USD',
                    description TEXT NOT NULL,
                    requirements TEXT,
                    apply_url VARCHAR(500),
                    apply_email VARCHAR(255),
                    status VARCHAR(50) DEFAULT 'active',
                    posted_by VARCHAR(255),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    expires_at TIMESTAMP
                );
            `);

            await this.query(`
                CREATE TABLE IF NOT EXISTS job_applications (
                    id SERIAL PRIMARY KEY,
                    job_id VARCHAR(255) REFERENCES job_listings(job_id) ON DELETE CASCADE,
                    applicant_wallet VARCHAR(255) NOT NULL,
                    applicant_email VARCHAR(255) NOT NULL,
                    applicant_name VARCHAR(255) NOT NULL,
                    resume_url VARCHAR(500),
                    cover_letter TEXT,
                    portfolio_url VARCHAR(500),
                    application_status VARCHAR(50) DEFAULT 'submitted',
                    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);

            await this.query(`
                CREATE TABLE IF NOT EXISTS referrals (
                    id SERIAL PRIMARY KEY,
                    referrer_wallet VARCHAR(255) NOT NULL,
                    referrer_email VARCHAR(255),
                    referred_email VARCHAR(255) NOT NULL,
                    referred_wallet VARCHAR(255),
                    referral_code VARCHAR(50) UNIQUE NOT NULL,
                    reward_amount DECIMAL(18, 8) DEFAULT 0,
                    reward_claimed BOOLEAN DEFAULT false,
                    referred_joined BOOLEAN DEFAULT false,
                    referred_completed_course BOOLEAN DEFAULT false,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    claimed_at TIMESTAMP
                );
            `);

            await this.query(`
                CREATE TABLE IF NOT EXISTS rvt_nft_distributions (
                    id SERIAL PRIMARY KEY,
                    nft_id VARCHAR(255) UNIQUE NOT NULL,
                    recipient_wallet VARCHAR(255) NOT NULL,
                    recipient_email VARCHAR(255),
                    nft_type VARCHAR(100) NOT NULL,
                    royalty_percentage DECIMAL(5, 2) NOT NULL,
                    total_royalties_earned DECIMAL(18, 8) DEFAULT 0,
                    reason TEXT,
                    metadata JSON,
                    distributed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);

            await this.query(`
                CREATE TABLE IF NOT EXISTS wealth_snapshots (
                    id SERIAL PRIMARY KEY,
                    user_wallet VARCHAR(255) NOT NULL,
                    user_email VARCHAR(255),
                    total_keno_balance DECIMAL(18, 8) DEFAULT 0,
                    total_rewards_earned DECIMAL(18, 8) DEFAULT 0,
                    total_rvt_royalties DECIMAL(18, 8) DEFAULT 0,
                    total_referral_earnings DECIMAL(18, 8) DEFAULT 0,
                    courses_completed INTEGER DEFAULT 0,
                    estimated_net_worth_usd DECIMAL(18, 2) DEFAULT 0,
                    snapshot_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);

            await this.query(`
                CREATE INDEX IF NOT EXISTS idx_student_rewards_wallet ON student_rewards(user_wallet_address);
            `);

            await this.query(`
                CREATE INDEX IF NOT EXISTS idx_scholarship_apps_email ON scholarship_applications(applicant_email);
            `);

            await this.query(`
                CREATE INDEX IF NOT EXISTS idx_job_listings_status ON job_listings(status);
            `);

            await this.query(`
                CREATE INDEX IF NOT EXISTS idx_job_apps_job_id ON job_applications(job_id);
            `);

            await this.query(`
                CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(referral_code);
            `);

            await this.query(`
                CREATE INDEX IF NOT EXISTS idx_rvt_nfts_wallet ON rvt_nft_distributions(recipient_wallet);
            `);

            await this.query(`
                CREATE INDEX IF NOT EXISTS idx_wealth_snapshots_wallet ON wealth_snapshots(user_wallet);
            `);

            await this.query(`
                CREATE TABLE IF NOT EXISTS chat_conversations (
                    id SERIAL PRIMARY KEY,
                    user_wallet_address VARCHAR(255),
                    user_email VARCHAR(255),
                    conversation_title VARCHAR(500),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);

            await this.query(`
                CREATE TABLE IF NOT EXISTS chat_messages (
                    id SERIAL PRIMARY KEY,
                    conversation_id INTEGER REFERENCES chat_conversations(id) ON DELETE CASCADE,
                    message_role VARCHAR(50) NOT NULL,
                    message_content TEXT NOT NULL,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);

            await this.query(`
                CREATE INDEX IF NOT EXISTS idx_chat_conversations_wallet ON chat_conversations(user_wallet_address);
            `);

            await this.query(`
                CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON chat_messages(conversation_id);
            `);

            await this.query(`
                CREATE TABLE IF NOT EXISTS api_licenses (
                    id SERIAL PRIMARY KEY,
                    license_key VARCHAR(255) UNIQUE NOT NULL,
                    company_name VARCHAR(255) NOT NULL,
                    contact_email VARCHAR(255) NOT NULL,
                    contact_wallet VARCHAR(255),
                    license_type VARCHAR(50) NOT NULL,
                    features_allowed TEXT[],
                    status VARCHAR(50) DEFAULT 'active',
                    rate_limit INTEGER DEFAULT 1000,
                    requests_made INTEGER DEFAULT 0,
                    monthly_price DECIMAL(10, 2),
                    expires_at TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    notes TEXT
                );
            `);

            await this.query(`
                CREATE TABLE IF NOT EXISTS api_usage_logs (
                    id SERIAL PRIMARY KEY,
                    license_key VARCHAR(255) REFERENCES api_licenses(license_key) ON DELETE CASCADE,
                    endpoint VARCHAR(255) NOT NULL,
                    method VARCHAR(10) NOT NULL,
                    ip_address VARCHAR(50),
                    response_status INTEGER,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);

            await this.query(`
                CREATE INDEX IF NOT EXISTS idx_api_licenses_key ON api_licenses(license_key);
            `);

            await this.query(`
                CREATE INDEX IF NOT EXISTS idx_api_licenses_email ON api_licenses(contact_email);
            `);

            await this.query(`
                CREATE INDEX IF NOT EXISTS idx_api_usage_license ON api_usage_logs(license_key);
            `);

            await this.query(`
                CREATE TABLE IF NOT EXISTS kenostod_graduates (
                    id SERIAL PRIMARY KEY,
                    graduate_id VARCHAR(50) UNIQUE NOT NULL,
                    wallet_address VARCHAR(255) UNIQUE NOT NULL,
                    user_email VARCHAR(255),
                    completion_date TIMESTAMP NOT NULL,
                    total_courses INTEGER DEFAULT 21,
                    keno_earned DECIMAL(18, 8) DEFAULT 0,
                    rvt_nft_tier VARCHAR(50) DEFAULT 'Platinum',
                    certificate_hash VARCHAR(255),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);

            await this.query(`
                CREATE INDEX IF NOT EXISTS idx_graduates_wallet ON kenostod_graduates(wallet_address);
            `);

            await this.query(`
                CREATE INDEX IF NOT EXISTS idx_graduates_id ON kenostod_graduates(graduate_id);
            `);

            await this.query(`
                CREATE TABLE IF NOT EXISTS graduate_merchandise_orders (
                    id SERIAL PRIMARY KEY,
                    order_id VARCHAR(255) UNIQUE NOT NULL,
                    user_wallet_address VARCHAR(255) NOT NULL,
                    user_email VARCHAR(255),
                    graduate_name VARCHAR(255) NOT NULL,
                    graduate_id VARCHAR(50),
                    shipping_address_line1 VARCHAR(500) NOT NULL,
                    shipping_address_line2 VARCHAR(500),
                    shipping_city VARCHAR(255) NOT NULL,
                    shipping_state VARCHAR(255),
                    shipping_postal_code VARCHAR(50) NOT NULL,
                    shipping_country VARCHAR(100) NOT NULL,
                    phone_number VARCHAR(50),
                    items_requested JSON NOT NULL,
                    order_status VARCHAR(50) DEFAULT 'pending',
                    order_notes TEXT,
                    printful_order_id VARCHAR(255),
                    tracking_number VARCHAR(255),
                    estimated_total_cost DECIMAL(10, 2),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    processed_at TIMESTAMP,
                    shipped_at TIMESTAMP,
                    delivered_at TIMESTAMP
                );
            `);

            await this.query(`
                CREATE INDEX IF NOT EXISTS idx_merch_orders_wallet ON graduate_merchandise_orders(user_wallet_address);
            `);

            await this.query(`
                CREATE INDEX IF NOT EXISTS idx_merch_orders_status ON graduate_merchandise_orders(order_status);
            `);

            await this.query(`
                CREATE INDEX IF NOT EXISTS idx_merch_orders_created ON graduate_merchandise_orders(created_at);
            `);

            await this.query(`
                CREATE TABLE IF NOT EXISTS ico_investors (
                    id SERIAL PRIMARY KEY,
                    investor_id VARCHAR(255) UNIQUE NOT NULL,
                    wallet_address VARCHAR(255) NOT NULL,
                    email VARCHAR(255),
                    investment_amount_usd DECIMAL(18, 2) NOT NULL,
                    tokens_purchased DECIMAL(18, 8) NOT NULL,
                    token_price_usd DECIMAL(18, 8) NOT NULL,
                    payment_method VARCHAR(50),
                    transaction_hash VARCHAR(255),
                    sale_phase VARCHAR(50) DEFAULT 'private',
                    bonus_percentage DECIMAL(5, 2) DEFAULT 0,
                    bonus_tokens DECIMAL(18, 8) DEFAULT 0,
                    referral_code VARCHAR(50),
                    kyc_status VARCHAR(50) DEFAULT 'pending',
                    accredited_investor BOOLEAN DEFAULT false,
                    country VARCHAR(100),
                    ip_address VARCHAR(50),
                    investment_status VARCHAR(50) DEFAULT 'completed',
                    vesting_schedule VARCHAR(100),
                    tokens_claimed DECIMAL(18, 8) DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);

            await this.query(`
                CREATE TABLE IF NOT EXISTS kyc_verifications (
                    id SERIAL PRIMARY KEY,
                    verification_id VARCHAR(255) UNIQUE NOT NULL,
                    investor_id VARCHAR(255) REFERENCES ico_investors(investor_id) ON DELETE CASCADE,
                    wallet_address VARCHAR(255) NOT NULL,
                    email VARCHAR(255) NOT NULL,
                    full_name VARCHAR(255) NOT NULL,
                    date_of_birth DATE,
                    nationality VARCHAR(100),
                    country_of_residence VARCHAR(100),
                    address_line1 VARCHAR(500),
                    address_line2 VARCHAR(500),
                    city VARCHAR(255),
                    state_province VARCHAR(255),
                    postal_code VARCHAR(50),
                    phone_number VARCHAR(50),
                    government_id_type VARCHAR(50),
                    government_id_number VARCHAR(255),
                    id_document_url VARCHAR(500),
                    selfie_photo_url VARCHAR(500),
                    proof_of_address_url VARCHAR(500),
                    accredited_investor_doc_url VARCHAR(500),
                    verification_status VARCHAR(50) DEFAULT 'pending',
                    verification_provider VARCHAR(100),
                    provider_verification_id VARCHAR(255),
                    risk_score INTEGER DEFAULT 0,
                    aml_status VARCHAR(50) DEFAULT 'pending',
                    rejected_reason TEXT,
                    verified_by VARCHAR(255),
                    verified_at TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);

            await this.query(`
                CREATE TABLE IF NOT EXISTS investment_statistics (
                    id SERIAL PRIMARY KEY,
                    stat_date DATE DEFAULT CURRENT_DATE,
                    total_raised_usd DECIMAL(18, 2) DEFAULT 0,
                    total_investors INTEGER DEFAULT 0,
                    total_tokens_sold DECIMAL(18, 8) DEFAULT 0,
                    new_investors_24h INTEGER DEFAULT 0,
                    raised_24h_usd DECIMAL(18, 2) DEFAULT 0,
                    average_investment_usd DECIMAL(18, 2) DEFAULT 0,
                    kyc_verified_count INTEGER DEFAULT 0,
                    kyc_pending_count INTEGER DEFAULT 0,
                    private_sale_raised DECIMAL(18, 2) DEFAULT 0,
                    public_sale_raised DECIMAL(18, 2) DEFAULT 0,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(stat_date)
                );
            `);

            await this.query(`
                CREATE INDEX IF NOT EXISTS idx_ico_investors_wallet ON ico_investors(wallet_address);
            `);

            await this.query(`
                CREATE INDEX IF NOT EXISTS idx_ico_investors_email ON ico_investors(email);
            `);

            await this.query(`
                CREATE INDEX IF NOT EXISTS idx_ico_investors_created ON ico_investors(created_at);
            `);

            await this.query(`
                CREATE INDEX IF NOT EXISTS idx_kyc_verifications_wallet ON kyc_verifications(wallet_address);
            `);

            await this.query(`
                CREATE INDEX IF NOT EXISTS idx_kyc_verifications_status ON kyc_verifications(verification_status);
            `);

            await this.query(`
                CREATE INDEX IF NOT EXISTS idx_investment_stats_date ON investment_statistics(stat_date);
            `);

            await this.query(`
                CREATE TABLE IF NOT EXISTS node_whitelist (
                    id SERIAL PRIMARY KEY,
                    whitelist_id VARCHAR(50) UNIQUE NOT NULL,
                    email VARCHAR(255) NOT NULL UNIQUE,
                    wallet VARCHAR(42) NOT NULL UNIQUE,
                    tier VARCHAR(20) NOT NULL CHECK (tier IN ('scholar', 'educator', 'academy')),
                    registered_at TIMESTAMP DEFAULT NOW(),
                    status VARCHAR(20) DEFAULT 'pending'
                );
            `);

            await this.query(`
                CREATE INDEX IF NOT EXISTS idx_node_whitelist_email ON node_whitelist(email);
            `);

            await this.query(`
                CREATE INDEX IF NOT EXISTS idx_node_whitelist_wallet ON node_whitelist(wallet);
            `);

            await this.query(`
                CREATE TABLE IF NOT EXISTS fal_withdrawals (
                    id SERIAL PRIMARY KEY,
                    request_id VARCHAR(50) UNIQUE NOT NULL,
                    simulator_wallet VARCHAR(255) NOT NULL,
                    metamask_wallet VARCHAR(42) NOT NULL,
                    amount DECIMAL(18, 8) NOT NULL,
                    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
                    tx_hash VARCHAR(66),
                    admin_notes TEXT,
                    requested_at TIMESTAMP DEFAULT NOW(),
                    processed_at TIMESTAMP
                );
            `);

            await this.query(`
                CREATE INDEX IF NOT EXISTS idx_fal_withdrawals_status ON fal_withdrawals(status);
            `);

            await this.query(`
                CREATE INDEX IF NOT EXISTS idx_fal_withdrawals_wallet ON fal_withdrawals(simulator_wallet);
            `);

            console.log('✅ Database schema initialized successfully (including Wealth Builder, Chat History, API Licensing, Graduate Merchandise, ICO Investors, Node Whitelist & FAL Withdrawals)');
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

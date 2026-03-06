-- Kenostod Graduates Table
-- Stores records of students who completed all 21 courses

CREATE TABLE IF NOT EXISTS kenostod_graduates (
    id SERIAL PRIMARY KEY,
    graduate_id VARCHAR(50) UNIQUE NOT NULL,
    wallet_address TEXT UNIQUE NOT NULL,
    user_email VARCHAR(255),
    completion_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    total_courses INTEGER NOT NULL DEFAULT 21,
    keno_earned INTEGER NOT NULL DEFAULT 5250,
    rvt_nft_tier VARCHAR(50) NOT NULL DEFAULT 'Platinum',
    certificate_hash TEXT NOT NULL,
    physical_badge_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_graduates_wallet ON kenostod_graduates(wallet_address);
CREATE INDEX IF NOT EXISTS idx_graduates_id ON kenostod_graduates(graduate_id);
CREATE INDEX IF NOT EXISTS idx_graduates_completion ON kenostod_graduates(completion_date);

-- Comments
COMMENT ON TABLE kenostod_graduates IS 'Elite graduates who completed all 21 Kenostod courses';
COMMENT ON COLUMN kenostod_graduates.graduate_id IS 'Unique graduate identifier (format: KG-YYYYMMDD-XXXX)';
COMMENT ON COLUMN kenostod_graduates.certificate_hash IS 'Blockchain verification hash for certificate authenticity';
COMMENT ON COLUMN kenostod_graduates.rvt_nft_tier IS 'RVT NFT tier awarded (Bronze/Silver/Gold/Platinum)';

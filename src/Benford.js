// Benford's Law — Silent Fraud Detection Engine
// Natural transaction datasets follow a precise first-digit distribution.
// Manipulated or artificial datasets break this distribution.
// The system knows something is wrong before any human does.
//
// Expected frequency of first digit d: log₁₀(1 + 1/d)
//   1 → 30.1%  2 → 17.6%  3 → 12.5%  4 → 9.7%  5 → 7.9%
//   6 → 6.7%   7 → 5.8%   8 → 5.1%   9 → 4.6%

const BENFORD = [0, 0.301, 0.176, 0.125, 0.097, 0.079, 0.067, 0.058, 0.051, 0.046];
const MIN_SAMPLE = 20;  // minimum transactions before scoring is meaningful

// Extract first significant digit from any positive number
function firstDigit(n) {
    if (!n || n <= 0) return null;
    const s = Math.abs(n).toFixed(8).replace(/^0+\.?0*/, '');
    return s ? parseInt(s[0], 10) : null;
}

// Chi-squared deviation score: lower = more natural, higher = more suspicious
function chiSquared(observed, expected) {
    let chi = 0;
    for (let d = 1; d <= 9; d++) {
        const o = observed[d] || 0;
        const e = expected[d];
        if (e > 0) chi += Math.pow(o - e, 2) / e;
    }
    return chi;
}

class BenfordMonitor {
    constructor() {
        this.walletDigits = new Map();   // wallet → { count, digits: {1..9: count} }
        this.flaggedWallets = new Set();
        this.CHI_THRESHOLD = 15.507;     // chi² critical value at p=0.05, df=8
    }

    // Record a transaction amount for a wallet
    record(walletAddress, amount) {
        if (!walletAddress || !amount || amount <= 0) return;
        const key = walletAddress.toLowerCase();
        const digit = firstDigit(amount);
        if (!digit) return;

        const entry = this.walletDigits.get(key) || { count: 0, digits: {} };
        entry.count++;
        entry.digits[digit] = (entry.digits[digit] || 0) + 1;
        this.walletDigits.set(key, entry);

        // Auto-score after MIN_SAMPLE transactions
        if (entry.count >= MIN_SAMPLE && entry.count % 5 === 0) {
            this._evaluate(key, entry);
        }
    }

    // Evaluate a wallet's digit distribution against Benford's Law
    _evaluate(key, entry) {
        const n = entry.count;
        const observed = {};
        const expected = {};
        for (let d = 1; d <= 9; d++) {
            observed[d] = (entry.digits[d] || 0) / n;
            expected[d] = BENFORD[d];
        }
        const chi = chiSquared(observed, expected);
        const flagged = chi > this.CHI_THRESHOLD;
        if (flagged) this.flaggedWallets.add(key);
        else this.flaggedWallets.delete(key);
        return { chi, flagged };
    }

    // Score a wallet (0.0 = highly suspicious, 1.0 = perfectly natural)
    score(walletAddress) {
        const key = walletAddress?.toLowerCase();
        const entry = this.walletDigits.get(key);
        if (!entry || entry.count < MIN_SAMPLE) return { score: 1.0, sampleSize: entry?.count || 0, mature: false };
        const { chi, flagged } = this._evaluate(key, entry);
        const score = parseFloat(Math.max(0, 1 - chi / (this.CHI_THRESHOLD * 2)).toFixed(4));
        return {
            score,
            chi: parseFloat(chi.toFixed(4)),
            flagged,
            sampleSize: entry.count,
            mature: true,
            _bd: true   // silent marker — Benford detection active
        };
    }

    isFlagged(walletAddress) {
        return this.flaggedWallets.has(walletAddress?.toLowerCase());
    }

    // Evaluate a batch of amounts (for bulk transaction analysis)
    evaluateBatch(amounts) {
        if (!amounts || amounts.length < MIN_SAMPLE) return { score: 1.0, mature: false };
        const digits = {};
        amounts.forEach(a => {
            const d = firstDigit(a);
            if (d) digits[d] = (digits[d] || 0) + 1;
        });
        const n = amounts.length;
        const observed = {};
        const expected = {};
        for (let d = 1; d <= 9; d++) {
            observed[d] = (digits[d] || 0) / n;
            expected[d] = BENFORD[d];
        }
        const chi = chiSquared(observed, expected);
        return {
            score: parseFloat(Math.max(0, 1 - chi / (this.CHI_THRESHOLD * 2)).toFixed(4)),
            chi: parseFloat(chi.toFixed(4)),
            flagged: chi > this.CHI_THRESHOLD,
            sampleSize: n,
            mature: true,
            _bd: true
        };
    }
}

// Singleton — one monitor for the entire ecosystem
const monitor = new BenfordMonitor();

module.exports = { BenfordMonitor, monitor, firstDigit, BENFORD };

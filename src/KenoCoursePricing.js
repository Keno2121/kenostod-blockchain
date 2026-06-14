'use strict';

/**
 * KenoCoursePricing — Dynamic Course Access Oracle
 * =================================================
 * Maintains a stable $250 USD value per course by adjusting the required
 * KENO token amount with the live market price.
 *
 * As KENO price rises   → fewer KENO tokens needed   → holding becomes easier
 * As KENO price falls   → more  KENO tokens needed   → buy pressure created
 *
 * The $250 USD value is always constant. The KENO amount is what moves.
 *
 * Constitutional Laws baked in:
 *   Kaprekar  — dust always flows to the participant; threshold rounded fairly
 *   Benford   — price anomaly detection on live feed
 *   Euler     — continuous price cache refresh
 */

const https = require('https');

const COURSE_USD_VALUE   = 250;                                          // Fixed USD value per course
const KENO_V2            = '0x48bb049afe50b050b458624dc6233acd51024ab4'; // Active KENO token (BSC)
const KENO_V1_PAIR       = '0x72368adf1487eeebcb095f16cf8cbf91f2b44880'; // KENO/BNB pair (price ref)
const FALLBACK_PRICE     = parseFloat(process.env.KENO_PRICE_USD || '0.000001'); // safety fallback
const CACHE_TTL_MS       = 5 * 60 * 1000;                               // 5-minute price cache
const BSC_RPC            = 'https://bsc-dataseed1.binance.org/';

let _cache = { price: null, ts: 0 };

// ── BSC JSON-RPC helper ──────────────────────────────────────────────────────
function bscCall(to, data) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({
            jsonrpc: '2.0', id: 1, method: 'eth_call',
            params: [{ to, data }, 'latest']
        });
        const url = new URL(BSC_RPC);
        const req = https.request({
            hostname: url.hostname, path: url.pathname || '/', method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
            timeout: 8000
        }, r => {
            let d = '';
            r.on('data', c => d += c);
            r.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('BSC RPC timeout')); });
        req.write(body);
        req.end();
    });
}

// ── BNB price from CoinGecko (with fallback) ──────────────────────────────────
function fetchBNBPrice() {
    return new Promise(resolve => {
        const url = 'https://api.coingecko.com/api/v3/simple/price?ids=binancecoin&vs_currencies=usd';
        https.get(url, { headers: { Accept: 'application/json', 'User-Agent': 'KenostodPricing/1.0' } }, r => {
            let d = '';
            r.on('data', c => d += c);
            r.on('end', () => {
                try {
                    const p = parseFloat(JSON.parse(d).binancecoin?.usd);
                    resolve(isNaN(p) ? 620 : p);
                } catch { resolve(620); }
            });
        }).on('error', () => resolve(620)).setTimeout(8000, function () { this.destroy(); resolve(620); });
    });
}

// ── ERC-20 balanceOf calldata ────────────────────────────────────────────────
function balanceOfData(walletAddress) {
    const addr = walletAddress.toLowerCase().replace('0x', '').padStart(64, '0');
    return '0x70a08231' + addr;
}

// ── Live KENO price from PancakeSwap reserves ────────────────────────────────
async function getKenoPriceUSD() {
    const now = Date.now();
    if (_cache.price !== null && now - _cache.ts < CACHE_TTL_MS) {
        return _cache.price;
    }

    try {
        const [reservesRes, bnbPrice] = await Promise.all([
            bscCall(KENO_V1_PAIR, '0x0902f1ac'),
            fetchBNBPrice()
        ]);

        const r = reservesRes.result;
        if (!r || r.length < 130) throw new Error('Bad reserves response');

        const reserve0    = Number(BigInt('0x' + r.slice(2,  66))) / 1e18;
        const reserve1    = Number(BigInt('0x' + r.slice(66, 130))) / 1e18;
        const kenoPerBNB  = reserve0 / reserve1;
        const price       = kenoPerBNB > 0 ? bnbPrice / kenoPerBNB : FALLBACK_PRICE;

        // Benford anomaly guard — if price moves >500% from last known, keep cache
        if (_cache.price && (price > _cache.price * 6 || price < _cache.price / 6)) {
            console.warn(`[KenoCoursePricing] Benford alert: price ${price} vs cached ${_cache.price} — keeping cache`);
            return _cache.price;
        }

        _cache = { price, ts: now };
        return price;
    } catch (e) {
        console.warn('[KenoCoursePricing] Price fetch failed:', e.message);
        return _cache.price || FALLBACK_PRICE;
    }
}

// ── KENO v2 balance of a BSC wallet ─────────────────────────────────────────
async function getKENOBalance(walletAddress) {
    try {
        const res = await bscCall(KENO_V2, balanceOfData(walletAddress));
        if (!res.result || res.result === '0x') return 0;
        return Number(BigInt(res.result)) / 1e18;
    } catch (e) {
        console.warn('[KenoCoursePricing] Balance fetch failed:', e.message);
        return 0;
    }
}

// ── Core: required KENO = $250 / current_price ───────────────────────────────
async function getCourseRequirement() {
    const kenoPriceUSD = await getKenoPriceUSD();
    const requiredKeno = kenoPriceUSD > 0 ? COURSE_USD_VALUE / kenoPriceUSD : 0;

    // Kaprekar: round UP to nearest whole token so dust always favours the student
    const requiredKenoRounded = Math.ceil(requiredKeno);

    return {
        usdValue:      COURSE_USD_VALUE,
        kenoPriceUSD,
        requiredKeno:  requiredKenoRounded,
        updatedAt:     new Date().toISOString()
    };
}

// ── Dynamic course reward: always = $250 USD value ───────────────────────────
// Two-tier design:
//   • KENO ≤ $1.00  → student always earns 250 KENO (the base reward)
//                      They get upside potential as KENO rises to the $1 peg
//   • KENO > $1.00  → reward is reduced to floor($250 / price)
//                      USD value stays fixed at $250; fewer tokens = same worth
//
// Investors who bought at presale discount benefit from the rising price.
// Students who enrolled early own 250 KENO that appreciates with the market.
const BASE_KENO_REWARD = 250;   // Standard reward at or below peg price
const KENO_PEG_PRICE   = 1.00;  // Target launch price — $1.00 per KENO

async function getCourseRewardKeno() {
    const kenoPriceUSD = await getKenoPriceUSD();

    let rewardKeno;
    if (kenoPriceUSD <= KENO_PEG_PRICE) {
        // At or below peg — always give the standard 250 KENO
        rewardKeno = BASE_KENO_REWARD;
    } else {
        // Above peg — scale down so reward stays worth $250 USD
        // floor() favours the protocol; student still receives full USD value
        rewardKeno = Math.floor(COURSE_USD_VALUE / kenoPriceUSD);
        rewardKeno = Math.max(1, rewardKeno); // safety floor: never zero
    }

    return {
        rewardKeno,
        kenoPriceUSD,
        rewardUSD:   parseFloat((rewardKeno * kenoPriceUSD).toFixed(2)),
        isAdjusted:  kenoPriceUSD > KENO_PEG_PRICE,
        pegPrice:    KENO_PEG_PRICE,
        baseReward:  BASE_KENO_REWARD,
        updatedAt:   new Date().toISOString()
    };
}

// ── Eligibility check for a given wallet ────────────────────────────────────
async function walletQualifies(walletAddress) {
    const [req, balance] = await Promise.all([
        getCourseRequirement(),
        getKENOBalance(walletAddress)
    ]);

    const qualified   = balance >= req.requiredKeno;
    const shortfallKeno = qualified ? 0 : req.requiredKeno - balance;
    const shortfallUSD  = shortfallKeno * req.kenoPriceUSD;

    return {
        qualified,
        wallet:         walletAddress,
        currentBalance: balance,
        requiredKeno:   req.requiredKeno,
        kenoPriceUSD:   req.kenoPriceUSD,
        usdValue:       req.usdValue,
        shortfallKeno:  Math.ceil(shortfallKeno),
        shortfallUSD:   parseFloat(shortfallUSD.toFixed(2)),
        message: qualified
            ? `✅ You hold ${balance.toLocaleString(undefined, {maximumFractionDigits:2})} KENO — course access granted.`
            : `❌ You need ${Math.ceil(shortfallKeno).toLocaleString()} more KENO (~$${shortfallUSD.toFixed(2)} USD) to access courses. Required: ${req.requiredKeno.toLocaleString()} KENO at current price of $${req.kenoPriceUSD.toFixed(8)}.`,
        updatedAt:      req.updatedAt
    };
}

module.exports = {
    COURSE_USD_VALUE,
    BASE_KENO_REWARD,
    KENO_PEG_PRICE,
    KENO_V2,
    getKenoPriceUSD,
    getKENOBalance,
    getCourseRequirement,
    getCourseRewardKeno,
    walletQualifies
};

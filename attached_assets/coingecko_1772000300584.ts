/**
 * CoinGecko API Integration (FREE - No API Key Required for Basic Usage)
 * 
 * CoinGecko provides cryptocurrency price data, market data, and more.
 * Free tier: 10-50 calls/minute (no registration needed)
 * 
 * Rate Limits (Free Tier):
 * - 10-50 requests per minute
 * - Caching recommended to stay within limits
 */

const COINGECKO_API_URL = 'https://api.coingecko.com/api/v3';

// Cache for price data (5 minute TTL)
const priceCache = new Map<string, { price: number; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export interface TokenPrice {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  market_cap: number;
  price_change_24h: number;
  price_change_percentage_24h: number;
}

export interface MultiTokenPrices {
  [tokenId: string]: {
    usd: number;
    usd_24h_change: number;
  };
}

/**
 * Get current price for a single token
 */
export async function getTokenPrice(tokenId: string): Promise<number> {
  try {
    // Check cache first
    const cached = priceCache.get(tokenId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.price;
    }

    const response = await fetch(
      `${COINGECKO_API_URL}/simple/price?ids=${tokenId}&vs_currencies=usd`
    );

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.statusText}`);
    }

    const data = await response.json();
    const price = data[tokenId]?.usd || 0;

    // Cache the result
    priceCache.set(tokenId, { price, timestamp: Date.now() });

    return price;
  } catch (error) {
    console.error('CoinGecko price error:', error);
    return 0;
  }
}

/**
 * Get prices for multiple tokens at once (more efficient)
 */
export async function getMultipleTokenPrices(
  tokenIds: string[]
): Promise<MultiTokenPrices> {
  try {
    const uncachedTokens: string[] = [];
    const result: MultiTokenPrices = {};

    // Check cache for each token
    for (const tokenId of tokenIds) {
      const cached = priceCache.get(tokenId);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        result[tokenId] = {
          usd: cached.price,
          usd_24h_change: 0, // Not cached
        };
      } else {
        uncachedTokens.push(tokenId);
      }
    }

    // Fetch uncached tokens
    if (uncachedTokens.length > 0) {
      const response = await fetch(
        `${COINGECKO_API_URL}/simple/price?ids=${uncachedTokens.join(',')}&vs_currencies=usd&include_24hr_change=true`
      );

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.statusText}`);
      }

      const data = await response.json();

      for (const tokenId of uncachedTokens) {
        if (data[tokenId]) {
          result[tokenId] = {
            usd: data[tokenId].usd,
            usd_24h_change: data[tokenId].usd_24h_change || 0,
          };

          // Cache the result
          priceCache.set(tokenId, {
            price: data[tokenId].usd,
            timestamp: Date.now(),
          });
        }
      }
    }

    return result;
  } catch (error) {
    console.error('CoinGecko multiple prices error:', error);
    return {};
  }
}

/**
 * Get detailed market data for a token
 */
export async function getTokenMarketData(tokenId: string): Promise<TokenPrice | null> {
  try {
    const response = await fetch(
      `${COINGECKO_API_URL}/coins/markets?vs_currency=usd&ids=${tokenId}`
    );

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.length === 0) {
      return null;
    }

    return {
      id: data[0].id,
      symbol: data[0].symbol,
      name: data[0].name,
      current_price: data[0].current_price,
      market_cap: data[0].market_cap,
      price_change_24h: data[0].price_change_24h,
      price_change_percentage_24h: data[0].price_change_percentage_24h,
    };
  } catch (error) {
    console.error('CoinGecko market data error:', error);
    return null;
  }
}

/**
 * Search for a token by name or symbol
 */
export async function searchToken(query: string): Promise<any[]> {
  try {
    const response = await fetch(`${COINGECKO_API_URL}/search?query=${encodeURIComponent(query)}`);

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.coins || [];
  } catch (error) {
    console.error('CoinGecko search error:', error);
    return [];
  }
}

/**
 * Get historical price data (last 7 days)
 */
export async function getHistoricalPrices(
  tokenId: string,
  days: number = 7
): Promise<Array<[number, number]>> {
  try {
    const response = await fetch(
      `${COINGECKO_API_URL}/coins/${tokenId}/market_chart?vs_currency=usd&days=${days}`
    );

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.prices || [];
  } catch (error) {
    console.error('CoinGecko historical prices error:', error);
    return [];
  }
}

/**
 * Calculate UCU (Universal Compute Units) from USD value
 * 1 UCU = $0.01 USD
 */
export function usdToUCU(usdValue: number): number {
  return usdValue / 0.01;
}

/**
 * Calculate USD value from UCU
 */
export function ucuToUSD(ucu: number): number {
  return ucu * 0.01;
}

/**
 * Calculate UTL Protocol fee (0.1% in UCU)
 */
export function calculateUTLFee(ucu: number): number {
  return ucu * 0.001; // 0.1%
}

/**
 * Common token IDs for CoinGecko
 */
export const COMMON_TOKEN_IDS = {
  ETHEREUM: 'ethereum',
  BITCOIN: 'bitcoin',
  USDC: 'usd-coin',
  USDT: 'tether',
  DAI: 'dai',
  WBTC: 'wrapped-bitcoin',
  BNB: 'binancecoin',
  MATIC: 'matic-network',
  AVAX: 'avalanche-2',
  SOL: 'solana',
  LINK: 'chainlink',
  UNI: 'uniswap',
  AAVE: 'aave',
  COMP: 'compound-governance-token',
};

/**
 * Get prices for all major tokens
 */
export async function getMajorTokenPrices(): Promise<MultiTokenPrices> {
  const tokenIds = Object.values(COMMON_TOKEN_IDS);
  return getMultipleTokenPrices(tokenIds);
}

/**
 * Clear price cache (useful for testing or manual refresh)
 */
export function clearPriceCache(): void {
  priceCache.clear();
}

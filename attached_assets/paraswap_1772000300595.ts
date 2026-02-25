/**
 * ParaSwap API Integration (FREE - No API Key Required)
 * 
 * ParaSwap aggregates prices from 50+ DEXs across multiple chains
 * to find the best swap rates. No fees, no registration needed.
 * 
 * Supported Networks:
 * - Ethereum (1)
 * - BSC (56)
 * - Polygon (137)
 * - Arbitrum (42161)
 * - Optimism (10)
 * - Avalanche (43114)
 */

const PARASWAP_API_URL = 'https://apiv5.paraswap.io';

export interface SwapQuote {
  srcToken: string;
  destToken: string;
  srcAmount: string;
  destAmount: string;
  priceRoute: any;
  gasCost: string;
}

export interface TokenPrice {
  symbol: string;
  address: string;
  decimals: number;
  price: number; // in USD
}

/**
 * Get best swap quote from ParaSwap
 */
export async function getSwapQuote(
  srcToken: string,
  destToken: string,
  srcAmount: string,
  network: number = 1 // Default to Ethereum
): Promise<SwapQuote> {
  try {
    const params = new URLSearchParams({
      srcToken,
      destToken,
      srcDecimals: '18',
      destDecimals: '18',
      amount: srcAmount,
      side: 'SELL',
      network: network.toString(),
      userAddress: '0x0000000000000000000000000000000000000000', // Placeholder
    });

    const response = await fetch(`${PARASWAP_API_URL}/prices?${params}`);
    
    if (!response.ok) {
      throw new Error(`ParaSwap API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      srcToken: data.priceRoute.srcToken,
      destToken: data.priceRoute.destToken,
      srcAmount: data.priceRoute.srcAmount,
      destAmount: data.priceRoute.destAmount,
      priceRoute: data.priceRoute,
      gasCost: data.priceRoute.gasCost || '0',
    };
  } catch (error) {
    console.error('ParaSwap quote error:', error);
    throw error;
  }
}

/**
 * Get token price in USD from ParaSwap
 */
export async function getTokenPrice(
  tokenAddress: string,
  network: number = 1
): Promise<number> {
  try {
    // Get quote against USDC to determine USD price
    const USDC_ADDRESS = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'; // Ethereum USDC
    const ONE_TOKEN = '1000000000000000000'; // 1 token with 18 decimals

    const quote = await getSwapQuote(tokenAddress, USDC_ADDRESS, ONE_TOKEN, network);
    
    // Convert destAmount (USDC has 6 decimals) to USD price
    const usdcAmount = parseInt(quote.destAmount) / 1e6;
    
    return usdcAmount;
  } catch (error) {
    console.error('ParaSwap price error:', error);
    return 0;
  }
}

/**
 * Calculate Universal Compute Units (UCU) for a transaction
 * 
 * UCU normalizes transaction costs across all blockchains
 * 1 UCU = $0.01 USD in computational cost
 */
export async function calculateUCU(
  tokenAddress: string,
  amount: string,
  network: number = 1
): Promise<{
  ucu: number;
  usdValue: number;
  utlFee: number; // 0.1% fee in UCU
}> {
  try {
    const tokenPrice = await getTokenPrice(tokenAddress, network);
    const tokenAmount = parseFloat(amount) / 1e18; // Assuming 18 decimals
    const usdValue = tokenPrice * tokenAmount;
    
    // 1 UCU = $0.01 USD
    const ucu = usdValue / 0.01;
    
    // UTL Protocol fee: 0.1% of transaction value in UCU
    const utlFee = ucu * 0.001;
    
    return {
      ucu,
      usdValue,
      utlFee,
    };
  } catch (error) {
    console.error('UCU calculation error:', error);
    return { ucu: 0, usdValue: 0, utlFee: 0 };
  }
}

/**
 * Get supported tokens for a network
 */
export async function getSupportedTokens(network: number = 1): Promise<TokenPrice[]> {
  try {
    const response = await fetch(`${PARASWAP_API_URL}/tokens/${network}`);
    
    if (!response.ok) {
      throw new Error(`ParaSwap API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    return data.tokens.map((token: any) => ({
      symbol: token.symbol,
      address: token.address,
      decimals: token.decimals,
      price: 0, // Price needs separate call
    }));
  } catch (error) {
    console.error('ParaSwap tokens error:', error);
    return [];
  }
}

/**
 * Network configurations
 */
export const SUPPORTED_NETWORKS = {
  ETHEREUM: { id: 1, name: 'Ethereum', rpc: 'https://eth.llamarpc.com' },
  BSC: { id: 56, name: 'BSC', rpc: 'https://bsc-dataseed.binance.org' },
  POLYGON: { id: 137, name: 'Polygon', rpc: 'https://polygon-rpc.com' },
  ARBITRUM: { id: 42161, name: 'Arbitrum', rpc: 'https://arb1.arbitrum.io/rpc' },
  OPTIMISM: { id: 10, name: 'Optimism', rpc: 'https://mainnet.optimism.io' },
  AVALANCHE: { id: 43114, name: 'Avalanche', rpc: 'https://api.avax.network/ext/bc/C/rpc' },
};

/**
 * Common token addresses (Ethereum mainnet)
 */
export const COMMON_TOKENS = {
  ETH: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
  USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  DAI: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
  WBTC: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
  WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
};

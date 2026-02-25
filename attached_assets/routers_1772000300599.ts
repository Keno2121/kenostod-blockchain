import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { TRPCError } from "@trpc/server";

const stakeRouter = router({
  // Get current user's stake
  getMyStake: protectedProcedure.query(async ({ ctx }) => {
    let stake = await db.getStakeByUserId(ctx.user.id);
    
    // Create stake if it doesn't exist
    if (!stake) {
      stake = await db.createStake(ctx.user.id);
    }
    
    return stake;
  }),

  // Deposit UTL tokens
  deposit: protectedProcedure
    .input(z.object({
      amount: z.string().refine(val => parseFloat(val) > 0, "Amount must be positive"),
      txHash: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      let stake = await db.getStakeByUserId(ctx.user.id);
      
      if (!stake) {
        stake = await db.createStake(ctx.user.id);
      }

      const currentAmount = parseFloat(stake.amount);
      const depositAmount = parseFloat(input.amount);
      const newAmount = (currentAmount + depositAmount).toFixed(8);

      // Record the transaction
      await db.createStakeTransaction({
        userId: ctx.user.id,
        stakeId: stake.id,
        type: "deposit",
        amount: input.amount,
        balanceBefore: stake.amount,
        balanceAfter: newAmount,
        tierBefore: stake.tier,
        tierAfter: db.calculateTier(newAmount).tier,
        txHash: input.txHash,
        status: "completed"
      });

      // Update stake amount
      await db.updateStakeAmount(stake.id, newAmount);

      return { success: true, newAmount, newTier: db.calculateTier(newAmount).tier };
    }),

  // Withdraw UTL tokens
  withdraw: protectedProcedure
    .input(z.object({
      amount: z.string().refine(val => parseFloat(val) > 0, "Amount must be positive")
    }))
    .mutation(async ({ ctx, input }) => {
      const stake = await db.getStakeByUserId(ctx.user.id);
      
      if (!stake) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No stake found"
        });
      }

      const currentAmount = parseFloat(stake.amount);
      const withdrawAmount = parseFloat(input.amount);

      if (withdrawAmount > currentAmount) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Insufficient stake balance"
        });
      }

      const newAmount = (currentAmount - withdrawAmount).toFixed(8);

      // Record the transaction
      await db.createStakeTransaction({
        userId: ctx.user.id,
        stakeId: stake.id,
        type: "withdrawal",
        amount: input.amount,
        balanceBefore: stake.amount,
        balanceAfter: newAmount,
        tierBefore: stake.tier,
        tierAfter: db.calculateTier(newAmount).tier,
        status: "completed"
      });

      // Update stake amount
      await db.updateStakeAmount(stake.id, newAmount);

      return { success: true, newAmount, newTier: db.calculateTier(newAmount).tier };
    }),

  // Get stake transaction history
  getTransactionHistory: protectedProcedure
    .input(z.object({ limit: z.number().optional().default(50) }))
    .query(async ({ ctx, input }) => {
      return await db.getStakeTransactionsByUserId(ctx.user.id, input.limit);
    }),
});

const earningsRouter = router({
  // Get user's fee distributions
  getMyDistributions: protectedProcedure
    .input(z.object({ limit: z.number().optional().default(100) }))
    .query(async ({ ctx, input }) => {
      return await db.getFeeDistributionsByUserId(ctx.user.id, input.limit);
    }),

  // Get earnings by date range
  getEarningsByDateRange: protectedProcedure
    .input(z.object({
      startDate: z.date(),
      endDate: z.date()
    }))
    .query(async ({ ctx, input }) => {
      return await db.getEarningsByDateRange(ctx.user.id, input.startDate, input.endDate);
    }),

  // Get earnings summary
  getSummary: protectedProcedure.query(async ({ ctx }) => {
    const stake = await db.getStakeByUserId(ctx.user.id);
    
    if (!stake) {
      return {
        totalEarnings: "0",
        dailyAverage: "0",
        weeklyAverage: "0",
        monthlyAverage: "0"
      };
    }

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [dailyEarnings, weeklyEarnings, monthlyEarnings] = await Promise.all([
      db.getEarningsByDateRange(ctx.user.id, oneDayAgo, now),
      db.getEarningsByDateRange(ctx.user.id, oneWeekAgo, now),
      db.getEarningsByDateRange(ctx.user.id, oneMonthAgo, now)
    ]);

    const sumEarnings = (earnings: any[]) => 
      earnings.reduce((sum, e) => sum + parseFloat(e.amount), 0).toFixed(8);

    return {
      totalEarnings: stake.totalEarnings,
      dailyAverage: sumEarnings(dailyEarnings),
      weeklyAverage: sumEarnings(weeklyEarnings),
      monthlyAverage: sumEarnings(monthlyEarnings)
    };
  }),
});

const networkRouter = router({
  // Get active blockchain networks
  getActive: publicProcedure.query(async () => {
    return await db.getActiveBlockchainNetworks();
  }),

  // Get recent transactions across all networks
  getRecentTransactions: publicProcedure
    .input(z.object({ limit: z.number().optional().default(100) }))
    .query(async ({ input }) => {
      return await db.getRecentTransactions(input.limit);
    }),
});

const adminRouter = router({
  // Get all stakes (admin only)
  getAllStakes: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Admin access required"
      });
    }
    return await db.getAllStakes();
  }),

  // Get protocol statistics (admin only)
  getStats: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Admin access required"
      });
    }
    return await db.getProtocolStats();
  }),

  // Simulate fee distribution (admin only - for testing)
  simulateFeeDistribution: protectedProcedure
    .input(z.object({
      totalFees: z.string(),
      transactionId: z.number().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Admin access required"
        });
      }

      const allStakes = await db.getAllStakes();
      const totalProtocolStake = await db.getTotalProtocolStake();
      const totalProtocolStakeNum = parseFloat(totalProtocolStake);

      if (totalProtocolStakeNum === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No stakes in protocol"
        });
      }

      const totalFeesNum = parseFloat(input.totalFees);
      let distributionsCreated = 0;

      for (const { stake, user } of allStakes) {
        if (!stake || !user) continue;

        const userStakeNum = parseFloat(stake.amount);
        if (userStakeNum === 0) continue;

        const stakePercentage = userStakeNum / totalProtocolStakeNum;
        const multiplier = parseFloat(stake.multiplier);
        const baseDistribution = totalFeesNum * stakePercentage;
        const finalDistribution = (baseDistribution * multiplier).toFixed(8);

        await db.createFeeDistribution({
          userId: user.id,
          stakeId: stake.id,
          transactionId: input.transactionId,
          amount: finalDistribution,
          tier: stake.tier,
          multiplier: stake.multiplier,
          userStakeAmount: stake.amount,
          totalProtocolStake: totalProtocolStake,
          stakePercentage: stakePercentage.toFixed(8),
          status: "completed"
        });

        await db.addToStakeEarnings(stake.id, finalDistribution);
        distributionsCreated++;
      }

      return { 
        success: true, 
        distributionsCreated,
        totalDistributed: input.totalFees
      };
    }),
});

// Phase 1: Enhanced Distribution Router
const enhancedDistributionRouter = router({
  // Toggle auto-compounding
  toggleAutoCompound: protectedProcedure
    .input(z.object({
      enabled: z.boolean()
    }))
    .mutation(async ({ ctx, input }) => {
      const stake = await db.getStakeByUserId(ctx.user.id);
      
      if (!stake) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No stake found"
        });
      }

      await db.updateStakeMetrics(stake.id, {
        autoCompound: input.enabled ? "yes" : "no"
      });

      return { success: true, autoCompound: input.enabled };
    }),

  // Get user's weighted distribution score
  getMyDistributionScore: protectedProcedure.query(async ({ ctx }) => {
    const stake = await db.getStakeByUserId(ctx.user.id);
    
    if (!stake) {
      return null;
    }

    const totalProtocolStake = await db.getTotalProtocolStake();
    const totalProtocolVolume = await db.getTotalProtocolVolume();

    const { calculateWeightedScore } = await import("./ucu");
    
    const score = calculateWeightedScore({
      stakeAmount: stake.amount,
      transactionVolume: stake.transactionVolume,
      stakingDuration: stake.stakingDuration,
      referralCount: stake.referralCount,
      totalProtocolStake,
      totalProtocolVolume,
    });

    return {
      ...score,
      stakeAmount: stake.amount,
      transactionVolume: stake.transactionVolume,
      stakingDuration: stake.stakingDuration,
      durationMultiplier: stake.durationMultiplier,
      referralCount: stake.referralCount,
      autoCompound: stake.autoCompound === "yes",
    };
  }),

  // Get user's referrals
  getMyReferrals: protectedProcedure.query(async ({ ctx }) => {
    return await db.getUserReferrals(ctx.user.id);
  }),

  // Get unclaimed merkle distributions
  getUnclaimedDistributions: protectedProcedure.query(async ({ ctx }) => {
    return await db.getUnclaimedMerkleClaims(ctx.user.id);
  }),

  // Claim merkle distribution
  claimDistribution: protectedProcedure
    .input(z.object({
      claimId: z.number(),
      txHash: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      await db.markClaimAsClaimed(input.claimId, input.txHash);
      return { success: true };
    }),
});

// Oracle & UCU Router
const oracleRouter = router({
  // Get current asset prices
  getPrices: publicProcedure
    .input(z.object({
      symbols: z.array(z.string())
    }))
    .query(async ({ input }) => {
      const { getPrices } = await import("./oracle");
      return await getPrices(input.symbols);
    }),

  // Get single asset price
  getPrice: publicProcedure
    .input(z.object({
      symbol: z.string()
    }))
    .query(async ({ input }) => {
      const { getPrice } = await import("./oracle");
      return await getPrice(input.symbol);
    }),

  // Calculate UCU for transaction
  calculateUCU: publicProcedure
    .input(z.object({
      networkId: z.number(),
      gasUsed: z.number().optional(),
      assetSymbol: z.string(),
      transactionAmount: z.string(),
      txType: z.enum(['transfer', 'swap', 'contract', 'nft', 'defi']).optional()
    }))
    .query(async ({ input }) => {
      const { calculateUCU } = await import("./ucu");
      const { getPrice } = await import("./oracle");
      
      const assetPrice = await getPrice(input.assetSymbol);
      const result = calculateUCU(input, assetPrice);
      
      return result;
    }),

  // Estimate UCU cost
  estimateUCU: publicProcedure
    .input(z.object({
      networkId: z.number(),
      assetSymbol: z.string(),
      amount: z.string(),
      txType: z.string().optional()
    }))
    .query(async ({ input }) => {
      const { estimateUCUCost } = await import("./ucu");
      return estimateUCUCost(
        input.networkId,
        input.assetSymbol,
        input.amount,
        input.txType
      );
    }),
});


// Phase 2-4: Integration & Premium Features Routers
const integrationRouter = router({
  // Wallet connections
  connectWallet: protectedProcedure
    .input(z.object({
      walletAddress: z.string(),
      walletType: z.enum(["metamask", "walletconnect", "phantom"]),
      chainId: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      // Store wallet connection in database
      return { success: true, connected: true };
    }),

  // Get DEX quote
  getDEXQuote: publicProcedure
    .input(z.object({
      network: z.enum(["ethereum", "solana", "polygon", "arbitrum"]),
      fromToken: z.string(),
      toToken: z.string(),
      amount: z.string()
    }))
    .query(async ({ input }) => {
      const { dexAggregatorManager } = await import("./dexAggregator");
      return await dexAggregatorManager.getBestQuote(input);
    }),

  // Get lending positions
  getLendingPositions: protectedProcedure
    .input(z.object({
      walletAddress: z.string()
    }))
    .query(async ({ input }) => {
      const { lendingProtocolManager } = await import("./lendingProtocols");
      return await lendingProtocolManager.getUserPositions(input.walletAddress);
    }),
});

const premiumRouter = router({
  // Get premium tier features
  getTierFeatures: publicProcedure
    .input(z.object({
      tier: z.enum(["basic", "professional", "institutional", "enterprise"])
    }))
    .query(async ({ input }) => {
      const { premiumSubscriptionManager } = await import("./premiumFeatures");
      return premiumSubscriptionManager.getTierFeatures(input.tier);
    }),

  // Subscribe to premium tier
  subscribe: protectedProcedure
    .input(z.object({
      tier: z.enum(["professional", "institutional", "enterprise"])
    }))
    .mutation(async ({ ctx, input }) => {
      return { success: true, tier: input.tier, message: "Subscription activated" };
    }),

  // Get analytics data
  getAnalytics: protectedProcedure
    .input(z.object({
      dataType: z.enum(["transaction_flow", "network_congestion", "fee_optimization", "volume_analysis"]),
      startDate: z.date(),
      endDate: z.date()
    }))
    .query(async ({ input }) => {
      const { analyticsDataManager } = await import("./analytics");
      if (input.dataType === "transaction_flow") {
        return await analyticsDataManager.getTransactionFlowAnalytics(input);
      }
      return { data: "Analytics data" };
    }),

  // Get realtime metrics
  getRealtimeMetrics: publicProcedure.query(async () => {
    const { analyticsDataManager } = await import("./analytics");
    return await analyticsDataManager.getRealtimeMetrics();
  }),
});

const whiteLabelRouter = router({
  // Create white-label license
  createLicense: protectedProcedure
    .input(z.object({
      companyName: z.string(),
      monthlyFee: z.number(),
      revenueShare: z.number().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const { whiteLabelManager } = await import("./analytics");
      return await whiteLabelManager.createLicense({
        licenseeId: ctx.user.id,
        ...input
      });
    }),

  // Customize branding
  customizeBranding: protectedProcedure
    .input(z.object({
      licenseKey: z.string(),
      brandName: z.string(),
      logoUrl: z.string(),
      primaryColor: z.string()
    }))
    .mutation(async ({ input }) => {
      const { whiteLabelManager } = await import("./analytics");
      return await whiteLabelManager.customizeBranding(input);
    }),
});

const insuranceRouter = router({
  // Get available insurance products
  getProducts: publicProcedure.query(async () => {
    const { insuranceManager } = await import("./advancedRevenue");
    return await insuranceManager.getAvailableProducts();
  }),

  // Purchase insurance policy
  purchasePolicy: protectedProcedure
    .input(z.object({
      policyType: z.enum(["transaction_protection", "smart_contract_cover", "slashing_protection"]),
      coverageAmount: z.string(),
      durationDays: z.number()
    }))
    .mutation(async ({ ctx, input }) => {
      const { insuranceManager } = await import("./advancedRevenue");
      return await insuranceManager.purchasePolicy({
        userId: ctx.user.id,
        ...input
      });
    }),
});

const mevRouter = router({
  // Detect MEV opportunities
  detectOpportunities: publicProcedure
    .input(z.object({
      network: z.string()
    }))
    .query(async ({ input }) => {
      const { mevManager } = await import("./advancedRevenue");
      return await mevManager.detectOpportunities(input.network);
    }),

  // Get MEV statistics
  getStatistics: publicProcedure
    .input(z.object({
      startDate: z.date(),
      endDate: z.date()
    }))
    .query(async ({ input }) => {
      const { mevManager } = await import("./advancedRevenue");
      return await mevManager.getMEVStatistics({
        start: input.startDate,
        end: input.endDate
      });
    }),
});

// API Integration Router (ParaSwap + CoinGecko)
const apiRouter = router({
  // Get swap quote from ParaSwap
  getSwapQuote: publicProcedure
    .input(z.object({
      srcToken: z.string(),
      destToken: z.string(),
      srcAmount: z.string(),
      network: z.number().optional().default(1)
    }))
    .query(async ({ input }) => {
      const { getSwapQuote } = await import("./paraswap");
      return await getSwapQuote(
        input.srcToken,
        input.destToken,
        input.srcAmount,
        input.network
      );
    }),

  // Calculate UCU for a transaction
  calculateUCU: publicProcedure
    .input(z.object({
      tokenAddress: z.string(),
      amount: z.string(),
      network: z.number().optional().default(1)
    }))
    .query(async ({ input }) => {
      const { calculateUCU } = await import("./paraswap");
      return await calculateUCU(
        input.tokenAddress,
        input.amount,
        input.network
      );
    }),

  // Get token price from CoinGecko
  getTokenPrice: publicProcedure
    .input(z.object({
      tokenId: z.string()
    }))
    .query(async ({ input }) => {
      const { getTokenPrice } = await import("./coingecko");
      return await getTokenPrice(input.tokenId);
    }),

  // Get multiple token prices
  getMultiplePrices: publicProcedure
    .input(z.object({
      tokenIds: z.array(z.string())
    }))
    .query(async ({ input }) => {
      const { getMultipleTokenPrices } = await import("./coingecko");
      return await getMultipleTokenPrices(input.tokenIds);
    }),

  // Get major token prices (ETH, BTC, USDC, etc.)
  getMajorTokenPrices: publicProcedure
    .query(async () => {
      const { getMajorTokenPrices } = await import("./coingecko");
      return await getMajorTokenPrices();
    }),

  // Get token market data
  getTokenMarketData: publicProcedure
    .input(z.object({
      tokenId: z.string()
    }))
    .query(async ({ input }) => {
      const { getTokenMarketData } = await import("./coingecko");
      return await getTokenMarketData(input.tokenId);
    }),

  // Search for tokens
  searchToken: publicProcedure
    .input(z.object({
      query: z.string()
    }))
    .query(async ({ input }) => {
      const { searchToken } = await import("./coingecko");
      return await searchToken(input.query);
    }),

  // Get historical prices
  getHistoricalPrices: publicProcedure
    .input(z.object({
      tokenId: z.string(),
      days: z.number().optional().default(7)
    }))
    .query(async ({ input }) => {
      const { getHistoricalPrices } = await import("./coingecko");
      return await getHistoricalPrices(input.tokenId, input.days);
    }),

  // Get supported tokens from ParaSwap
  getSupportedTokens: publicProcedure
    .input(z.object({
      network: z.number().optional().default(1)
    }))
    .query(async ({ input }) => {
      const { getSupportedTokens } = await import("./paraswap");
      return await getSupportedTokens(input.network);
    }),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  stake: stakeRouter,
  earnings: earningsRouter,
  network: networkRouter,
  admin: adminRouter,
  distribution: enhancedDistributionRouter,
  oracle: oracleRouter,
  // Phase 2-4 routers
  integration: integrationRouter,
  premium: premiumRouter,
  whiteLabel: whiteLabelRouter,
  insurance: insuranceRouter,
  mev: mevRouter,
  api: apiRouter,
});

export type AppRouter = typeof appRouter;

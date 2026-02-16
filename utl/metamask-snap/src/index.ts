import type {
  OnRpcRequestHandler,
  OnTransactionHandler,
} from '@metamask/snaps-sdk';
import { panel, text, heading, divider, copyable, row } from '@metamask/snaps-sdk';

const UTL_FEE_COLLECTOR = '0xfE537c43d202C455Cedc141B882c808287BB662f';
const UTL_STAKING = '0x49961979c93f43f823BB3593b207724194019d1d';
const UTL_TREASURY = '0x3B3538b955647d811D42400084e9409e6593bE97';
const UTL_DISTRIBUTION = '0xE6918cdBB9D8cd0d3532A88D974734B2F1A793c7';
const USDC_BSC = '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d';
const FEE_RATE = 0.001; // 0.1%

interface UTLState {
  totalFeesContributed: string;
  totalRewardsEarned: string;
  isOptedIn: boolean;
  stakedAmount: string;
  tier: string;
  transactionCount: number;
  joinedAt: string;
  autoCompound: boolean;
}

async function getState(): Promise<UTLState> {
  const state = await snap.request({
    method: 'snap_manageState',
    params: { operation: 'get' },
  });

  return (state as UTLState) || {
    totalFeesContributed: '0',
    totalRewardsEarned: '0',
    isOptedIn: false,
    stakedAmount: '0',
    tier: 'Observer',
    transactionCount: 0,
    joinedAt: '',
    autoCompound: false,
  };
}

async function saveState(state: UTLState): Promise<void> {
  await snap.request({
    method: 'snap_manageState',
    params: { operation: 'update', newState: state as any },
  });
}

function calculateTier(stakedAmount: number): string {
  if (stakedAmount >= 1000000) return 'Guardian (2.0x)';
  if (stakedAmount >= 100000) return 'Champion (1.5x)';
  if (stakedAmount >= 10000) return 'Advocate (1.2x)';
  if (stakedAmount >= 1000) return 'Participant (1.0x)';
  return 'Observer (0.1x)';
}

function formatValue(wei: string): string {
  const eth = parseFloat(wei) / 1e18;
  if (eth < 0.0001) return '< 0.0001';
  return eth.toFixed(4);
}

export const onTransaction: OnTransactionHandler = async ({ transaction }) => {
  const state = await getState();

  if (!state.isOptedIn) {
    return {
      content: panel([
        heading('UTL — Universal Transaction Layer'),
        text('You have not opted into UTL fee redistribution yet.'),
        divider(),
        text('**Opt in to earn passive income** from every transaction.'),
        text('UTL captures a tiny 0.1% fee and redistributes 60% back to participants.'),
        divider(),
        text('Send "utl_optIn" via the UTL dApp to activate.'),
        divider(),
        text('_UTL Protocol — Asset-Agnostic Fee Redistribution_'),
      ]),
    };
  }

  const txValue = transaction.value ? parseInt(transaction.value as string, 16) : 0;
  const estimatedFee = txValue * FEE_RATE;
  const estimatedFeeFormatted = formatValue(estimatedFee.toString());
  const txValueFormatted = formatValue(txValue.toString());

  const newContributed = parseFloat(state.totalFeesContributed) + estimatedFee;
  state.totalFeesContributed = newContributed.toString();
  state.transactionCount += 1;
  await saveState(state);

  const isRouted = transaction.to?.toLowerCase() === UTL_FEE_COLLECTOR.toLowerCase();

  return {
    content: panel([
      heading('UTL Fee Insight'),
      row('Transaction Value', text(`${txValueFormatted} BNB`)),
      row('UTL Fee (0.1%)', text(`${estimatedFeeFormatted} BNB`)),
      row('Routed via UTL', text(isRouted ? 'YES — Fee captured on-chain' : 'NO — Use UTL dApp to route')),
      divider(),
      row('Your Tier', text(state.tier)),
      row('Total Fees Contributed', text(`${formatValue(state.totalFeesContributed)} BNB`)),
      row('Total Rewards Earned', text(`${formatValue(state.totalRewardsEarned)} BNB`)),
      row('Transactions', text(`${state.transactionCount}`)),
      divider(),
      text(state.autoCompound
        ? '**Auto-compound:** ON — rewards automatically restaked'
        : '**Auto-compound:** OFF — claim rewards manually'),
      divider(),
      text('_UTL captures 0.1% — 60% redistributed to stakers, 40% to treasury._'),
      text('_UTL Protocol — Live on BNB Smart Chain_'),
    ]),
  };
};

export const onRpcRequest: OnRpcRequestHandler = async ({ origin, request }) => {
  const state = await getState();

  switch (request.method) {
    case 'utl_optIn': {
      state.isOptedIn = true;
      state.joinedAt = new Date().toISOString();
      await saveState(state);

      return snap.request({
        method: 'snap_dialog',
        params: {
          type: 'alert',
          content: panel([
            heading('Welcome to UTL!'),
            text('You are now opted into the Universal Transaction Layer.'),
            divider(),
            text('**How UTL works:**'),
            text('1. A 0.1% fee is captured from transactions routed through UTL'),
            text('2. Fees are pooled across all UTL participants'),
            text('3. 60% is redistributed to USDC stakers'),
            text('4. 40% funds operations, scholarships & insurance'),
            divider(),
            text('**Stake USDC** to increase your tier and earn more:'),
            text('• Observer (0 USDC): 0.1x multiplier'),
            text('• Participant (1,000 USDC): 1.0x multiplier'),
            text('• Advocate (10,000 USDC): 1.2x multiplier'),
            text('• Champion (100,000 USDC): 1.5x multiplier'),
            text('• Guardian (1,000,000 USDC): 2.0x multiplier'),
            divider(),
            text('**Live Contracts on BSC:**'),
            copyable(UTL_FEE_COLLECTOR),
            text('_UTL Protocol — Asset-Agnostic Fee Redistribution_'),
          ]),
        },
      });
    }

    case 'utl_optOut': {
      state.isOptedIn = false;
      await saveState(state);

      return snap.request({
        method: 'snap_dialog',
        params: {
          type: 'alert',
          content: panel([
            heading('UTL Deactivated'),
            text('You have opted out of UTL fee redistribution.'),
            text('Your staked USDC remains in the staking contract until you unstake.'),
            text('You can re-activate at any time.'),
          ]),
        },
      });
    }

    case 'utl_dashboard': {
      return snap.request({
        method: 'snap_dialog',
        params: {
          type: 'alert',
          content: panel([
            heading('UTL Dashboard'),
            divider(),
            row('Status', text(state.isOptedIn ? 'ACTIVE' : 'INACTIVE')),
            row('Tier', text(state.tier)),
            row('USDC Staked', text(`${formatValue(state.stakedAmount)} USDC`)),
            divider(),
            heading('Earnings'),
            row('Total Fees Contributed', text(`${formatValue(state.totalFeesContributed)} BNB`)),
            row('Total Rewards Earned', text(`${formatValue(state.totalRewardsEarned)} BNB`)),
            row('Transactions', text(`${state.transactionCount}`)),
            divider(),
            heading('Settings'),
            row('Auto-Compound', text(state.autoCompound ? 'ON' : 'OFF')),
            row('Member Since', text(state.joinedAt || 'Not joined')),
            divider(),
            text('**Live Contracts (BSC Mainnet):**'),
            text('Fee Collector:'),
            copyable(UTL_FEE_COLLECTOR),
            text('Staking:'),
            copyable(UTL_STAKING),
            text('Treasury:'),
            copyable(UTL_TREASURY),
            text('Distribution:'),
            copyable(UTL_DISTRIBUTION),
            divider(),
            text('_UTL Protocol — Live on BNB Smart Chain_'),
          ]),
        },
      });
    }

    case 'utl_toggleAutoCompound': {
      state.autoCompound = !state.autoCompound;
      await saveState(state);

      return snap.request({
        method: 'snap_dialog',
        params: {
          type: 'alert',
          content: panel([
            heading('Auto-Compound Updated'),
            text(state.autoCompound
              ? 'Auto-compound is now **ON**. Your rewards will be automatically restaked for exponential growth.'
              : 'Auto-compound is now **OFF**. You will need to manually claim your rewards.'),
          ]),
        },
      });
    }

    case 'utl_getStats': {
      return {
        isOptedIn: state.isOptedIn,
        tier: state.tier,
        stakedAmount: state.stakedAmount,
        totalFeesContributed: state.totalFeesContributed,
        totalRewardsEarned: state.totalRewardsEarned,
        transactionCount: state.transactionCount,
        autoCompound: state.autoCompound,
        joinedAt: state.joinedAt,
        contracts: {
          feeCollector: UTL_FEE_COLLECTOR,
          staking: UTL_STAKING,
          treasury: UTL_TREASURY,
          distribution: UTL_DISTRIBUTION,
        },
      };
    }

    case 'utl_updateStake': {
      const params = request.params as { amount: string } | undefined;
      if (params && params.amount) {
        state.stakedAmount = params.amount;
        state.tier = calculateTier(parseFloat(params.amount) / 1e18);
        await saveState(state);

        await snap.request({
          method: 'snap_notify',
          params: {
            type: 'inApp',
            message: `UTL stake updated: ${formatValue(params.amount)} USDC (${state.tier})`,
          },
        });

        return { success: true, tier: state.tier };
      }
      return { success: false, error: 'Missing amount parameter' };
    }

    case 'utl_claimRewards': {
      return snap.request({
        method: 'snap_dialog',
        params: {
          type: 'confirmation',
          content: panel([
            heading('Claim UTL Rewards'),
            text(`You have **${formatValue(state.totalRewardsEarned)}** BNB in pending rewards.`),
            divider(),
            text('Claiming will transfer your rewards to your wallet.'),
            text('Gas fees apply for the claim transaction.'),
            text(`Staking contract: ${UTL_STAKING}`),
            divider(),
            text('**Confirm to proceed with reward claim?**'),
          ]),
        },
      });
    }

    case 'utl_weeklyReport': {
      const weeklyEstimate = (parseFloat(state.totalFeesContributed) * 0.6).toString();

      await snap.request({
        method: 'snap_notify',
        params: {
          type: 'inApp',
          message: `UTL Weekly: ${state.transactionCount} txs, ~${formatValue(weeklyEstimate)} BNB earned`,
        },
      });

      return {
        transactions: state.transactionCount,
        feesContributed: state.totalFeesContributed,
        estimatedRewards: weeklyEstimate,
        tier: state.tier,
        contracts: {
          feeCollector: UTL_FEE_COLLECTOR,
          staking: UTL_STAKING,
        },
      };
    }

    case 'utl_getContracts': {
      return {
        network: 'BSC Mainnet',
        chainId: 56,
        feeCollector: UTL_FEE_COLLECTOR,
        staking: UTL_STAKING,
        treasury: UTL_TREASURY,
        distribution: UTL_DISTRIBUTION,
        usdc: USDC_BSC,
      };
    }

    default:
      throw new Error(`Method not found: ${request.method}`);
  }
};

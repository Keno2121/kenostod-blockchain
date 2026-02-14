const UTL_FEE_COLLECTOR = '0x0000000000000000000000000000000000000000';
const UTL_STAKING = '0x0000000000000000000000000000000000000000';
const FEE_RATE = 0.001;
const KENO_TOKEN = '0x65791E0B5Cbac5F40c76cDe31bf4F074D982FD0E';

async function getState() {
  const state = await snap.request({
    method: 'snap_manageState',
    params: { operation: 'get' },
  });

  return state || {
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

async function saveState(state) {
  await snap.request({
    method: 'snap_manageState',
    params: { operation: 'update', newState: state },
  });
}

function calculateTier(stakedAmount) {
  if (stakedAmount >= 1000000) return 'Guardian (2.0x)';
  if (stakedAmount >= 100000) return 'Champion (1.5x)';
  if (stakedAmount >= 10000) return 'Advocate (1.2x)';
  if (stakedAmount >= 1000) return 'Participant (1.0x)';
  return 'Observer (0.1x)';
}

function formatValue(wei) {
  const eth = parseFloat(wei) / 1e18;
  if (eth < 0.0001) return '< 0.0001';
  return eth.toFixed(4);
}

module.exports.onTransaction = async ({ transaction }) => {
  const state = await getState();

  if (!state.isOptedIn) {
    return {
      content: panel([
        heading('UTL Fee Rewards'),
        text('You are not opted into UTL fee redistribution.'),
        divider(),
        text('**Opt in to earn rewards** from every transaction across the network.'),
        text('Use the UTL companion dapp or send "utl_optIn" to activate.'),
        divider(),
        text('_Powered by Kenostod Blockchain Academy_'),
      ]),
    };
  }

  const txValue = transaction.value ? parseInt(transaction.value, 16) : 0;
  const estimatedFee = txValue * FEE_RATE;
  const estimatedFeeFormatted = formatValue(estimatedFee.toString());
  const txValueFormatted = formatValue(txValue.toString());

  const newContributed = parseFloat(state.totalFeesContributed) + estimatedFee;
  state.totalFeesContributed = newContributed.toString();
  state.transactionCount += 1;
  await saveState(state);

  return {
    content: panel([
      heading('UTL Fee Insight'),
      row('Transaction Value', text(txValueFormatted + ' ETH')),
      row('UTL Fee (0.1%)', text(estimatedFeeFormatted + ' ETH')),
      divider(),
      row('Your Tier', text(state.tier)),
      row('Total Fees Contributed', text(formatValue(state.totalFeesContributed) + ' ETH')),
      row('Total Rewards Earned', text(formatValue(state.totalRewardsEarned) + ' ETH')),
      row('Transactions Processed', text('' + state.transactionCount)),
      divider(),
      text(state.autoCompound
        ? '**Auto-compound:** ON — rewards automatically restaked'
        : '**Auto-compound:** OFF — claim rewards manually'),
      divider(),
      text('_Your 0.1% fee contributes to the UTL pool. 60% is redistributed to KENO stakers like you._'),
      text('_Powered by Kenostod Blockchain Academy_'),
    ]),
  };
};

module.exports.onRpcRequest = async ({ origin, request }) => {
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
            text('**What happens next:**'),
            text('1. A 0.1% fee is captured from your transactions'),
            text('2. Fees are pooled across all UTL participants'),
            text('3. 60% of all fees are redistributed to KENO stakers'),
            text('4. Your share is based on your stake amount and tier'),
            divider(),
            text('**Stake KENO tokens** to increase your tier and earn more:'),
            text('• Observer (0 KENO): 0.1x multiplier'),
            text('• Participant (1,000 KENO): 1.0x multiplier'),
            text('• Advocate (10,000 KENO): 1.2x multiplier'),
            text('• Champion (100,000 KENO): 1.5x multiplier'),
            text('• Guardian (1,000,000 KENO): 2.0x multiplier'),
            divider(),
            text('KENO Token: ' + KENO_TOKEN),
            text('_Powered by Kenostod Blockchain Academy_'),
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
            text('Your staked KENO remains in the staking contract until you unstake.'),
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
            row('KENO Staked', text(formatValue(state.stakedAmount) + ' KENO')),
            divider(),
            heading('Earnings'),
            row('Total Fees Contributed', text(formatValue(state.totalFeesContributed) + ' ETH')),
            row('Total Rewards Earned', text(formatValue(state.totalRewardsEarned) + ' ETH')),
            row('Transactions', text('' + state.transactionCount)),
            divider(),
            heading('Settings'),
            row('Auto-Compound', text(state.autoCompound ? 'ON' : 'OFF')),
            row('Member Since', text(state.joinedAt || 'Not joined')),
            divider(),
            text('**KENO Contract:**'),
            copyable(KENO_TOKEN),
            text('**Fee Collector:**'),
            copyable(UTL_FEE_COLLECTOR),
            text('**Staking Contract:**'),
            copyable(UTL_STAKING),
            divider(),
            text('_Powered by Kenostod Blockchain Academy_'),
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
      };
    }

    case 'utl_updateStake': {
      const params = request.params;
      if (params && params.amount) {
        state.stakedAmount = params.amount;
        state.tier = calculateTier(parseFloat(params.amount) / 1e18);
        await saveState(state);

        await snap.request({
          method: 'snap_notify',
          params: {
            type: 'inApp',
            message: 'UTL stake updated: ' + formatValue(params.amount) + ' KENO (' + state.tier + ')',
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
            text('You have **' + formatValue(state.totalRewardsEarned) + '** ETH in pending rewards.'),
            divider(),
            text('Claiming will transfer your rewards to your wallet.'),
            text('Gas fees apply for the claim transaction.'),
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
          message: 'UTL Weekly: ' + state.transactionCount + ' txs, ~' + formatValue(weeklyEstimate) + ' ETH earned',
        },
      });

      return {
        transactions: state.transactionCount,
        feesContributed: state.totalFeesContributed,
        estimatedRewards: weeklyEstimate,
        tier: state.tier,
      };
    }

    default:
      throw new Error('Method not found: ' + request.method);
  }
};

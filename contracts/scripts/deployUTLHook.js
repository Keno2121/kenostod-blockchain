// UTLHook Deployment Script
// Network: BSC Mainnet (chainId 56)
// Run with: node contracts/scripts/deployUTLHook.js
//
// Prerequisites:
//   npm install ethers@6 solc
//   DEPLOYER_PRIVATE_KEY must be set in environment
//
// What this script does:
//   1. Compiles UTLHook using solc
//   2. Mines a CREATE2 salt that gives the contract an address with bit 6 set
//      (AFTER_SWAP_FLAG — required by PancakeSwap v4 pool manager)
//   3. Deploys via CREATE2 to that address
//   4. Authorizes the KENO/USDC pool key
//   5. Prints all addresses for verification

import { ethers } from 'ethers';

// ── PancakeSwap v4 Pool Manager on BSC Mainnet ────────────────────────────
const PANCAKE_V4_POOL_MANAGER = '0x0000000000000000000000000000000000000000'; // TODO: update when PCS v4 goes live on BSC mainnet

// ── Known token addresses ─────────────────────────────────────────────────
const KENO  = '0x65791E0B5Cbac5F40c76cDe31bf4F074D982FD0E';
const USDC  = '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d';
const WBNB  = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';

// ── Hook permission flags ────────────────────────────────────────────────
const AFTER_SWAP_FLAG = 64n; // 1n << 6n
const ALL_HOOK_BITS   = (1n << 14n) - 1n;

async function mineHookSalt(deployer, initCodeHash) {
    console.log('Mining CREATE2 salt for AFTER_SWAP_FLAG address...');
    for (let i = 0n; i < 160_000n; i++) {
        const salt = ethers.zeroPadValue(ethers.toBeHex(i), 32);
        const predicted = ethers.getCreate2Address(deployer, salt, initCodeHash);
        const addrBigInt = BigInt(predicted);
        if ((addrBigInt & ALL_HOOK_BITS) === AFTER_SWAP_FLAG) {
            console.log(`✅ Salt found: ${salt}`);
            console.log(`✅ Hook address will be: ${predicted}`);
            return { salt, hookAddress: predicted };
        }
    }
    throw new Error('No valid salt found — increase search range');
}

async function main() {
    const provider = new ethers.JsonRpcProvider('https://bsc-dataseed.binance.org');
    const deployer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);

    console.log(`\nDeployer: ${deployer.address}`);
    const balance = await provider.getBalance(deployer.address);
    console.log(`Balance: ${ethers.formatEther(balance)} BNB\n`);

    // ── Compile (placeholder — use hardhat or foundry in production) ──────
    // For now, load pre-compiled ABI/bytecode
    const artifactPath = './contracts/artifacts/UTLHook.json';
    let artifact;
    try {
        artifact = require(artifactPath);
    } catch {
        console.error(`Artifact not found at ${artifactPath}`);
        console.error('Compile with: npx hardhat compile');
        process.exit(1);
    }

    const factory     = new ethers.ContractFactory(artifact.abi, artifact.bytecode, deployer);
    const initCode    = factory.bytecode + factory.interface.encodeDeploy([PANCAKE_V4_POOL_MANAGER]).slice(2);
    const initCodeHash = ethers.keccak256(initCode);

    // ── Mine the salt ─────────────────────────────────────────────────────
    const { salt, hookAddress } = await mineHookSalt(deployer.address, initCodeHash);

    // ── Deploy via CREATE2 factory ────────────────────────────────────────
    // Using deterministic deployment proxy (EIP-2470 / 0x4e59b44847b379578588920cA78FbF26c0B4956C)
    const CREATE2_FACTORY = '0x4e59b44847b379578588920cA78FbF26c0B4956C';
    const deployTx = {
        to:   CREATE2_FACTORY,
        data: salt + initCode.slice(2),
        gasLimit: 3_000_000n
    };

    console.log('Deploying UTLHook...');
    const tx   = await deployer.sendTransaction(deployTx);
    const receipt = await tx.wait();
    console.log(`✅ Deployed at: ${hookAddress}`);
    console.log(`   Tx: ${receipt.hash}`);

    // ── Authorize KENO/USDC pool ──────────────────────────────────────────
    const hook = new ethers.Contract(hookAddress, artifact.abi, deployer);

    const kenoUsdcPoolKey = {
        currency0: KENO < USDC ? KENO : USDC,   // lower address first
        currency1: KENO < USDC ? USDC : KENO,
        fee: 2500,                                // 0.25% tier
        tickSpacing: 50,
        hooks: hookAddress
    };

    console.log('\nAuthorizing KENO/USDC pool...');
    const authTx = await hook.authorizePool(kenoUsdcPoolKey);
    await authTx.wait();
    console.log('✅ KENO/USDC pool authorized');

    const kenoWbnbPoolKey = {
        currency0: KENO < WBNB ? KENO : WBNB,
        currency1: KENO < WBNB ? WBNB : KENO,
        fee: 2500,
        tickSpacing: 50,
        hooks: hookAddress
    };

    console.log('Authorizing KENO/WBNB pool...');
    const authTx2 = await hook.authorizePool(kenoWbnbPoolKey);
    await authTx2.wait();
    console.log('✅ KENO/WBNB pool authorized');

    console.log('\n─────────────────────────────────────────────');
    console.log('UTL Hook Deployment Complete');
    console.log('─────────────────────────────────────────────');
    console.log(`Hook Contract:     ${hookAddress}`);
    console.log(`UTL FeeCollector:  0xfE537c43d202C455Cedc141B882c808287BB662f`);
    console.log(`KENO/USDC Pool:    0.25% tier, 50 tick spacing`);
    console.log(`KENO/WBNB Pool:    0.25% tier, 50 tick spacing`);
    console.log(`Fee rate:          0.09% per swap`);
    console.log(`Staker cut:        60% of every UTL fee`);
    console.log('─────────────────────────────────────────────\n');
}

main().catch(console.error);

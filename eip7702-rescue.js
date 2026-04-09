#!/usr/bin/env node
/**
 * EIP-7702 RESCUE SCRIPT
 * 
 * Overrides the attacker's EIP-7702 delegation on the compromised wallet
 * with our own rescue contract, then calls rescue() to transfer ownership
 * of all 5 UTL contracts to the new safe wallet.
 * 
 * Compromised:  0xDc41cAAD2Cb3509Df595082AFB7372F0454fcEbf (EIP-7702 drained)
 * Gas payer:    0x7f14aD1Ea5bE76C7525B2e5d0b452BA519a92751 (temp wallet - needs 0.001 BNB)
 * New owner:    0x4AA73FadfFd71E6549867a37455EA957A52Cf849
 */

const { ethers } = require('ethers');
const solc       = require('solc');

// ─── Config ─────────────────────────────────────────────────────────────────
const CHAIN_ID        = 56n;
const RPC             = 'https://bsc-dataseed1.binance.org/';
const COMPROMISED     = '0xDc41cAAD2Cb3509Df595082AFB7372F0454fcEbf';
const NEW_OWNER       = '0x4AA73FadfFd71E6549867a37455EA957A52Cf849';
const FARM_ADDR       = '0xaf991D0A2b4Ab522Adc6766fc0FdCbAfFA541094';
const KENO_TOKEN      = '0x65791E0B5Cbac5F40c76cDe31bf4F074D982FD0E';
const STAKING         = '0x49961979c93f43f823BB3593b207724194019d1d';
const FEE_COLLECTOR   = '0xfE537c43d202C455Cedc141B882c808287BB662f';
const TREASURY        = '0x3B3538b955647d811D42400084e9409e6593bE97';
const DISTRIBUTION    = '0xE6918cdBB9D8cd0d3532A88D974734B2F1A793c7';

// Temp gas payer — generated fresh, no funds yet
const GAS_WALLET_PK = '0x75556570df75da423ae59ef375c2680b3dfa8a864072b1bfc54777d7b5937d54';

// ─── Rescue Contract Source ──────────────────────────────────────────────────
const RESCUE_SOL = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IOwnable {
    function transferOwnership(address newOwner) external;
}
interface IKENO is IOwnable {
    function updateWhitelist(address account, bool status) external;
}

contract Rescue {
    address constant NEW_OWNER     = ${NEW_OWNER};
    address constant FARM_ADDR     = ${FARM_ADDR};
    address constant KENO_TOKEN    = ${KENO_TOKEN};
    address constant STAKING       = ${STAKING};
    address constant FEE_COLLECTOR = ${FEE_COLLECTOR};
    address constant TREASURY      = ${TREASURY};
    address constant DISTRIBUTION  = ${DISTRIBUTION};

    function rescue() external {
        IOwnable(KENO_TOKEN).transferOwnership(NEW_OWNER);
        IOwnable(STAKING).transferOwnership(NEW_OWNER);
        IOwnable(FEE_COLLECTOR).transferOwnership(NEW_OWNER);
        IOwnable(TREASURY).transferOwnership(NEW_OWNER);
        IOwnable(DISTRIBUTION).transferOwnership(NEW_OWNER);
        IKENO(KENO_TOKEN).updateWhitelist(FARM_ADDR, true);
    }
}
`;

// ─── Helpers ────────────────────────────────────────────────────────────────

function toRlpNum(n) {
    // Convert bigint/number to hex string for ethers.encodeRlp (strips leading zeros)
    if (n === 0n || n === 0) return '0x';
    const hex = n.toString(16);
    return '0x' + (hex.length % 2 ? '0' + hex : hex);
}

async function compileRescue() {
    console.log('📝 Compiling rescue contract...');
    const input = {
        language: 'Solidity',
        sources: { 'Rescue.sol': { content: RESCUE_SOL } },
        settings: { outputSelection: { '*': { '*': ['abi', 'evm.bytecode'] } }, optimizer: { enabled: true, runs: 200 } }
    };
    const output = JSON.parse(solc.compile(JSON.stringify(input)));
    if (output.errors) {
        const errs = output.errors.filter(e => e.severity === 'error');
        if (errs.length) throw new Error('Compile errors: ' + errs.map(e => e.message).join('\n'));
    }
    const contract = output.contracts['Rescue.sol']['Rescue'];
    const bytecode = '0x' + contract.evm.bytecode.object;
    const abi = contract.abi;
    console.log('✅ Compiled. Bytecode length:', bytecode.length / 2 - 1, 'bytes');
    return { bytecode, abi };
}

async function deployRescue(provider, gasWallet, bytecode) {
    console.log('\n🚀 Deploying rescue contract from gas wallet...');
    const factory = new ethers.ContractFactory([], bytecode, gasWallet);
    const contract = await factory.deploy({ gasLimit: 500000 });
    await contract.waitForDeployment();
    const addr = await contract.getAddress();
    console.log('✅ Rescue contract deployed at:', addr);
    return addr;
}

async function signEIP7702Authorization(compromisedPk, rescueAddr, nonce) {
    console.log('\n🔐 Signing EIP-7702 authorization from compromised wallet...');
    console.log('   Rescue contract:', rescueAddr);
    console.log('   Auth nonce:', nonce);

    // EIP-7702 auth hash: keccak256(0x05 || rlp([chain_id, address, nonce]))
    const authRlp = ethers.encodeRlp([
        toRlpNum(CHAIN_ID),
        rescueAddr,
        toRlpNum(BigInt(nonce))
    ]);
    const authHash = ethers.keccak256(
        ethers.concat(['0x05', ethers.getBytes(authRlp)])
    );

    const compromisedWallet = new ethers.Wallet(compromisedPk);
    const sig = compromisedWallet.signingKey.sign(authHash);

    console.log('✅ Authorization signed by:', compromisedWallet.address);
    return {
        chainId: CHAIN_ID,
        address: rescueAddr,
        nonce: BigInt(nonce),
        yParity: sig.yParity,
        r: sig.r,
        s: sig.s
    };
}

async function buildAndSendType4Tx(provider, gasWallet, rescueAddr, authorization) {
    console.log('\n📡 Building EIP-7702 TYPE-4 transaction...');

    const iface = new ethers.Interface(['function rescue()']);
    const calldata = iface.encodeFunctionData('rescue');

    const gasPk  = gasWallet;
    const from   = gasPk.address;
    const nonce  = await provider.getTransactionCount(from);
    const feeData = await provider.getFeeData();
    const maxFeePerGas = feeData.maxFeePerGas || ethers.parseUnits('3', 'gwei');
    const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas || ethers.parseUnits('1', 'gwei');
    const gasLimit = 600000n;

    const { chainId, address: authAddr, nonce: authNonce, yParity, r, s } = authorization;

    // TYPE-4 (EIP-7702) raw transaction encoding:
    // 0x04 || rlp([chain_id, nonce, max_priority_fee_per_gas, max_fee_per_gas,
    //              gas_limit, to, value, data, access_list, authorization_list,
    //              sig_y_parity, sig_r, sig_s])
    //
    // authorization_list entry: [chain_id, address, nonce, y_parity, r, s]

    const authEntry = [
        toRlpNum(chainId),
        authAddr,
        toRlpNum(authNonce),
        toRlpNum(BigInt(yParity)),
        r,
        s
    ];

    const txFields = [
        toRlpNum(CHAIN_ID),                       // chain_id
        toRlpNum(BigInt(nonce)),                   // nonce
        toRlpNum(maxPriorityFeePerGas),            // max_priority_fee_per_gas
        toRlpNum(maxFeePerGas),                    // max_fee_per_gas
        toRlpNum(gasLimit),                        // gas_limit
        COMPROMISED,                               // to (the compromised wallet, which becomes our rescue contract)
        '0x',                                      // value = 0
        calldata,                                  // data = rescue()
        [],                                        // access_list
        [authEntry],                               // authorization_list
    ];

    // Sign the TYPE-4 tx
    const txRlp = ethers.encodeRlp(txFields);
    const txHash = ethers.keccak256(
        ethers.concat(['0x04', ethers.getBytes(txRlp)])
    );

    const sig = gasPk.signingKey.sign(txHash);

    const signedTxFields = [
        ...txFields,
        toRlpNum(BigInt(sig.yParity)),
        sig.r,
        sig.s,
    ];

    const rawTx = ethers.concat([
        '0x04',
        ethers.getBytes(ethers.encodeRlp(signedTxFields))
    ]);

    console.log('📤 Sending TYPE-4 EIP-7702 transaction...');
    console.log('   From (gas payer):', from);
    console.log('   To (compromised):', COMPROMISED);
    console.log('   Calling:          rescue()');

    const txResponse = await provider.send('eth_sendRawTransaction', [ethers.hexlify(rawTx)]);
    console.log('✅ TX submitted! Hash:', txResponse);
    return txResponse;
}

async function verifyOwnership(provider) {
    console.log('\n🔍 Verifying ownership transfer...');
    const abi = ['function owner() view returns (address)'];
    const contracts = [
        { name: 'KENO Token',    addr: KENO_TOKEN },
        { name: 'Staking',       addr: STAKING },
        { name: 'Fee Collector', addr: FEE_COLLECTOR },
        { name: 'Treasury',      addr: TREASURY },
        { name: 'Distribution',  addr: DISTRIBUTION },
    ];
    for (const c of contracts) {
        try {
            const contract = new ethers.Contract(c.addr, abi, provider);
            const owner = await contract.owner();
            const ok = owner.toLowerCase() === NEW_OWNER.toLowerCase();
            console.log(`  ${ok ? '✅' : '❌'} ${c.name}: owner = ${owner}`);
        } catch (e) {
            console.log(`  ⚠️  ${c.name}: ${e.message}`);
        }
    }
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
    console.log('═══════════════════════════════════════════════════');
    console.log(' EIP-7702 OWNERSHIP RESCUE — KENOSTOD / UTL');
    console.log('═══════════════════════════════════════════════════');
    console.log('Compromised wallet:', COMPROMISED);
    console.log('New owner:         ', NEW_OWNER);

    const provider   = new ethers.JsonRpcProvider(RPC);
    const gasWallet  = new ethers.Wallet(GAS_WALLET_PK, provider);
    const deployerPk = process.env.DEPLOYER_PRIVATE_KEY;

    if (!deployerPk) {
        console.error('❌ DEPLOYER_PRIVATE_KEY not set');
        process.exit(1);
    }
    const compromisedWallet = new ethers.Wallet(
        deployerPk.startsWith('0x') ? deployerPk : '0x' + deployerPk
    );
    if (compromisedWallet.address.toLowerCase() !== COMPROMISED.toLowerCase()) {
        console.error('❌ DEPLOYER_PRIVATE_KEY does not match compromised wallet!');
        console.error('   Expected:', COMPROMISED);
        console.error('   Got:     ', compromisedWallet.address);
        process.exit(1);
    }
    console.log('✅ Compromised wallet key verified');

    // Check gas wallet has BNB
    const gasBal = await provider.getBalance(gasWallet.address);
    console.log('\nGas wallet:', gasWallet.address);
    console.log('Gas wallet BNB:', ethers.formatEther(gasBal));

    if (gasBal < ethers.parseEther('0.0005')) {
        console.log('\n⏳ Waiting for BNB funding on gas wallet...');
        console.log('   Send at least 0.001 BNB to:', gasWallet.address);
        let funded = false;
        while (!funded) {
            await new Promise(r => setTimeout(r, 5000));
            const bal = await provider.getBalance(gasWallet.address);
            if (bal >= ethers.parseEther('0.0005')) {
                console.log('✅ Funded! Balance:', ethers.formatEther(bal), 'BNB');
                funded = true;
            } else {
                process.stdout.write('.');
            }
        }
    }

    // Get compromised wallet nonce
    const compNonce = await provider.getTransactionCount(COMPROMISED);
    console.log('\nCompromised wallet current nonce:', compNonce);

    // Check current delegation
    const code = await provider.getCode(COMPROMISED);
    console.log('Current code:', code.slice(0, 22) + '...');
    if (code.startsWith('0xef0100')) {
        const delegate = '0x' + code.slice(8);
        console.log('Currently delegated to:', delegate);
        console.log('(Will be overridden by our rescue contract)');
    }

    // 1. Compile rescue contract
    const { bytecode, abi } = await compileRescue();

    // 2. Deploy rescue contract
    const rescueAddr = await deployRescue(provider, gasWallet, bytecode);

    // 3. Sign EIP-7702 authorization from compromised wallet
    const compromisedPk = deployerPk.startsWith('0x') ? deployerPk : '0x' + deployerPk;
    const authorization = await signEIP7702Authorization(compromisedPk, rescueAddr, compNonce);

    // 4. Build and send TYPE-4 transaction
    const txHash = await buildAndSendType4Tx(provider, gasWallet, rescueAddr, authorization);

    // 5. Wait for confirmation
    console.log('\n⏳ Waiting for confirmation...');
    let receipt = null;
    for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 3000));
        receipt = await provider.getTransactionReceipt(txHash).catch(() => null);
        if (receipt) break;
        process.stdout.write('.');
    }

    if (receipt) {
        console.log('\n✅ Confirmed in block:', receipt.blockNumber);
        console.log('   Status:', receipt.status === 1 ? 'SUCCESS ✅' : 'FAILED ❌');
        console.log('   Gas used:', receipt.gasUsed.toString());
    } else {
        console.log('\n⚠️  Transaction not yet confirmed. Check hash on BSCScan:', txHash);
    }

    // 6. Verify ownership
    if (receipt?.status === 1) {
        await verifyOwnership(provider);
        console.log('\n🎉 RESCUE COMPLETE! All contracts transferred to', NEW_OWNER);
    }
}

main().catch(e => {
    console.error('\n❌ RESCUE FAILED:', e.message);
    console.error(e.stack);
    process.exit(1);
});

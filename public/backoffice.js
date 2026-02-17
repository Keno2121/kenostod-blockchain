const pageParams = new URLSearchParams(window.location.search);
const isStudentMode = pageParams.get('mode') === 'student';
const isAdminMode = localStorage.getItem('kenostodAdmin') === 'true';

let subscriptionVerified = localStorage.getItem('subscriptionActive') === 'true';
const isSubscribed = () => subscriptionVerified || isAdminMode;
const getSubscriptionPlan = () => isAdminMode ? 'admin' : (localStorage.getItem('subscriptionPlan') || 'free');

(async function verifySubscription() {
    if (isAdminMode) {
        subscriptionVerified = true;
        return;
    }
    const email = localStorage.getItem('userEmail') || localStorage.getItem('customerEmail');
    if (!email && localStorage.getItem('subscriptionActive') !== 'true') return;
    try {
        const resp = await fetch(`/api/subscription/verify?email=${encodeURIComponent(email || '')}`);
        const data = await resp.json();
        subscriptionVerified = data.active;
        localStorage.setItem('subscriptionActive', data.active ? 'true' : 'false');
        if (data.active) localStorage.setItem('subscriptionPlan', data.plan);
    } catch (e) {
        subscriptionVerified = localStorage.getItem('subscriptionActive') === 'true';
    }
})();

(function setupPageMode() {
    if (isStudentMode) {
        document.querySelectorAll('.admin-only-section').forEach(el => el.style.display = 'none');
        const header = document.querySelector('.admin-header h1');
        if (header) header.textContent = '🎓 Kenostod Academy Courses';
        const subtitle = document.querySelector('.admin-header p');
        if (subtitle) subtitle.textContent = 'Your blockchain education journey - 21 courses to master';
    }
    if (isAdminMode && !isStudentMode) {
        const header = document.querySelector('.admin-header');
        if (header) {
            const badge = document.createElement('span');
            badge.style.cssText = 'background: #059669; color: white; padding: 4px 12px; border-radius: 20px; font-size: 0.75rem; margin-left: 12px; vertical-align: middle;';
            badge.textContent = 'ADMIN - Full Access';
            const h1 = header.querySelector('h1');
            if (h1) h1.appendChild(badge);
        }
    }
})();

const premiumContent = {
    1: {
        deep_dive: [
            { title: 'Advanced ECC Mathematics', content: 'Explore the group theory behind elliptic curves, point addition and scalar multiplication on secp256k1, and how the discrete logarithm problem provides security.' },
            { title: 'HD Wallet Architecture (BIP32/BIP44)', content: 'Master hierarchical deterministic wallets — derive unlimited addresses from a single seed, understand derivation paths (m/44\'/60\'/0\'/0), and implement multi-account structures.' },
            { title: 'Hardware Wallet Integration', content: 'Learn how Ledger and Trezor devices protect private keys using secure elements, and how to sign transactions via USB/Bluetooth without exposing keys.' }
        ],
        code_exercises: [
            'Build a complete HD wallet from scratch using BIP32 derivation',
            'Implement multi-signature (2-of-3) wallet logic',
            'Create a vanity address generator using secp256k1',
            'Build a wallet recovery tool using BIP39 mnemonics'
        ],
        resources: ['Mastering Bitcoin - Chapter 4: Keys & Addresses', 'NIST Elliptic Curve Standards Guide', 'BIP39 Wordlist Reference']
    },
    2: {
        deep_dive: [
            { title: 'Mining Pool Mechanics', content: 'Understand stratum protocols, share difficulty, payout schemes (PPS, PPLNS, FPPS), and how pools coordinate thousands of miners to find blocks efficiently.' },
            { title: 'ASIC vs GPU Mining Economics', content: 'Deep analysis of hardware ROI calculations, electricity costs, hash rate comparisons, and when each mining approach is profitable.' },
            { title: 'Selfish Mining & Attack Vectors', content: 'Study the selfish mining attack strategy where miners withhold blocks to gain unfair advantage, and how protocols defend against it.' }
        ],
        code_exercises: [
            'Build a complete SHA-256 hasher from scratch (no libraries)',
            'Simulate a mining pool with share validation',
            'Implement dynamic difficulty adjustment algorithm',
            'Create a mining profitability calculator'
        ],
        resources: ['Bitcoin Whitepaper - Section 4: Proof-of-Work', 'Hashcash Proof-of-Work Function Paper', 'Mining Difficulty Algorithm Analysis']
    },
    3: {
        deep_dive: [
            { title: 'Merkle Patricia Tries', content: 'How Ethereum stores state using Merkle Patricia tries — key-value mappings, node types (leaf, extension, branch), and efficient proof generation.' },
            { title: 'Block Propagation & Orphan Blocks', content: 'Study network topology, block propagation delays, compact block relay (BIP152), and how orphan/uncle blocks affect consensus.' },
            { title: 'State Channels & Off-Chain Verification', content: 'Learn how payment channels (Lightning Network) verify transactions off-chain using cryptographic proofs, reducing on-chain load.' }
        ],
        code_exercises: [
            'Build a Merkle tree implementation with proof verification',
            'Simulate block propagation across a network',
            'Implement SPV (Simplified Payment Verification)',
            'Create a blockchain explorer that validates chain integrity'
        ],
        resources: ['Ethereum Yellow Paper - State Trie Specification', 'Bitcoin Developer Guide - Block Chain', 'Merkle Tree Research Paper']
    },
    4: {
        deep_dive: [
            { title: 'Timelock Contract Patterns', content: 'Deep exploration of CLTV (CheckLockTimeVerify), CSV (CheckSequenceVerify), and how time-based conditions enable advanced smart contract logic.' },
            { title: 'Escrow & Multi-Party Computation', content: 'Build trustless escrow systems using hash time-locked contracts (HTLCs) and understand multi-party computation for secure shared decisions.' },
            { title: 'Automated Market Maker Scheduling', content: 'How DeFi protocols use scheduled transactions for rebalancing, fee collection, and liquidity provision automation.' }
        ],
        code_exercises: [
            'Build a timelock vault with configurable release schedules',
            'Implement an escrow system with dispute resolution',
            'Create a vesting schedule contract for token distribution',
            'Build a recurring payment system with cancellation'
        ],
        resources: ['BIP65: CheckLockTimeVerify Specification', 'Hash Time-Locked Contracts Explained', 'DeFi Scheduling Patterns Guide']
    },
    5: {
        deep_dive: [
            { title: 'UTXO Model Deep Dive', content: 'Compare UTXO (Bitcoin) vs Account (Ethereum) models in depth — transaction construction, change outputs, coin selection algorithms, and privacy implications.' },
            { title: 'Transaction Malleability & SegWit', content: 'Understand how transaction malleability attacks work, why Segregated Witness was introduced, and how it fixes the txid mutation problem.' },
            { title: 'Fee Estimation Algorithms', content: 'Study mempool analysis, fee rate estimation (sat/vbyte), Replace-By-Fee (RBF), and Child-Pays-For-Parent (CPFP) strategies.' }
        ],
        code_exercises: [
            'Implement a UTXO coin selection algorithm (Branch and Bound)',
            'Build a transaction fee estimator using mempool data',
            'Create a batch transaction optimizer',
            'Simulate Replace-By-Fee mechanics'
        ],
        resources: ['Bitcoin Transaction Format Specification', 'BIP141: Segregated Witness', 'Fee Estimation Research Paper']
    },
    6: {
        deep_dive: [
            { title: 'Reversible Transaction Protocol Design', content: 'Study the game theory behind transaction reversal windows — how 5-minute windows balance user protection with finality, and the security implications of delayed settlement.' },
            { title: 'Chargeback Prevention Systems', content: 'Compare traditional payment chargeback rates (0.6-1.8%) with blockchain reversal mechanisms, and how merchants benefit from deterministic dispute resolution.' },
            { title: 'Cross-Chain Reversibility', content: 'Explore how atomic swaps handle reversal scenarios across different blockchains using hash time-locked contracts with timeout windows.' }
        ],
        code_exercises: [
            'Build a complete reversal window system with timeout enforcement',
            'Implement a dispute resolution mechanism with evidence submission',
            'Create a merchant protection dashboard with reversal analytics',
            'Simulate fraud detection using reversal pattern analysis'
        ],
        resources: ['Kenostod Reversal Window Whitepaper', 'Payment Fraud Detection Research', 'Dispute Resolution in Digital Payments']
    },
    7: {
        deep_dive: [
            { title: 'Sybil Resistance Mechanisms', content: 'Deep dive into proof-of-personhood, social graph analysis, Web of Trust models, and how platforms prevent fake identity creation at scale.' },
            { title: 'Zero-Knowledge Reputation Proofs', content: 'Learn how ZK-SNARKs enable proving reputation scores without revealing transaction history, protecting user privacy while maintaining trust.' },
            { title: 'Cross-Platform Reputation Portability', content: 'Study W3C Verifiable Credentials, DID (Decentralized Identifiers), and how to make blockchain reputation portable across platforms.' }
        ],
        code_exercises: [
            'Build a reputation scoring system with decay and recovery',
            'Implement Sybil detection using graph analysis',
            'Create a verifiable credential issuer and verifier',
            'Design a cross-platform reputation aggregator'
        ],
        resources: ['W3C DID Core Specification', 'Sybil Attack Prevention Research', 'Verifiable Credentials Data Model']
    },
    8: {
        deep_dive: [
            { title: 'Quadratic Voting Implementation', content: 'Build a complete quadratic voting system — cost calculations, credit allocation, vote tallying, and how it prevents plutocratic governance outcomes.' },
            { title: 'Governance Attack Vectors', content: 'Study flash loan governance attacks (real DeFi examples), vote buying markets, and delegation manipulation strategies with countermeasures.' },
            { title: 'DAO Treasury Management', content: 'Learn how major DAOs (MakerDAO, Uniswap, Aave) manage multi-million dollar treasuries through governance proposals and execution.' }
        ],
        code_exercises: [
            'Build a complete DAO voting system with proposal lifecycle',
            'Implement quadratic voting with credit management',
            'Create a timelock-protected treasury execution system',
            'Design a delegation system with vote weight inheritance'
        ],
        resources: ['Compound Governor Alpha/Bravo Specs', 'Quadratic Payments Research Paper', 'DAO Governance Best Practices']
    },
    9: {
        deep_dive: [
            { title: 'Mining Economics Simulation', content: 'Build a comprehensive mining simulator — electricity costs, hardware depreciation, difficulty projections, and breakeven analysis for different scenarios.' },
            { title: 'Halving Events & Supply Dynamics', content: 'Study Bitcoin halving mechanics, stock-to-flow models, the impact on miner revenue, and historical price correlation analysis.' },
            { title: 'MEV (Maximal Extractable Value)', content: 'Understand how miners/validators extract value through transaction ordering — front-running, sandwich attacks, and Flashbots as a mitigation solution.' }
        ],
        code_exercises: [
            'Build a mining profitability simulator with real-time data',
            'Implement a block reward halving schedule calculator',
            'Create an MEV detection dashboard',
            'Design a Flashbots-style transaction bundle system'
        ],
        resources: ['Bitcoin Halving Schedule & History', 'MEV Research Paper (Flashbots)', 'Mining Economics Analysis']
    },
    10: {
        deep_dive: [
            { title: 'PoRV Economic Model', content: 'Deep analysis of how Proof-of-Residual-Value transforms computation into lasting economic value — energy efficiency comparisons, value accrual mechanics, and sustainability analysis.' },
            { title: 'AI/ML Computation Marketplace', content: 'How PoRV creates a marketplace for AI inference and ML training — task allocation, result verification, and quality-of-service guarantees.' },
            { title: 'Deflationary Token Mechanics', content: 'Study burn mechanisms, supply curves, and how PoRV\'s token burns create predictable deflation that benefits long-term holders.' }
        ],
        code_exercises: [
            'Implement a PoRV validator node simulator',
            'Build a computation task marketplace with bidding',
            'Create a token burn tracker with supply projection',
            'Design a hybrid PoW/PoRV consensus selector'
        ],
        resources: ['Kenostod PoRV Whitepaper', 'Token Deflation Models', 'AI Compute Marketplace Design']
    },
    11: {
        deep_dive: [
            { title: 'RVT NFT Smart Contract Architecture', content: 'Study the ERC-721 extension for royalty-bearing NFTs — how perpetual royalty payments are encoded on-chain and distributed automatically.' },
            { title: 'Royalty Distribution Mathematics', content: 'Learn the mathematical models behind tiered royalty rates, pro-rata distribution, compounding effects, and long-term yield projections.' },
            { title: 'NFT Marketplace Integration', content: 'How to list, trade, and manage RVT NFTs across major marketplaces while maintaining royalty enforcement through ERC-2981.' }
        ],
        code_exercises: [
            'Build an ERC-721 contract with perpetual royalty distribution',
            'Implement a tiered royalty calculator with compounding',
            'Create an NFT marketplace with royalty enforcement',
            'Design a royalty yield projection dashboard'
        ],
        resources: ['ERC-2981: NFT Royalty Standard', 'ERC-721 Token Standard', 'Perpetual Royalty Design Patterns']
    },
    12: {
        deep_dive: [
            { title: 'Enterprise Compute Pricing Models', content: 'How to price AI/ML computation competitively — comparison with AWS, Google Cloud, and Azure, and the blockchain advantage in cost transparency.' },
            { title: 'Decentralized Storage for Compute Results', content: 'Integration with IPFS and Arweave for permanent storage of computation results, with on-chain verification hashes.' },
            { title: 'Compute Node Operation', content: 'Practical guide to running a PoRV compute node — hardware requirements, software setup, task selection strategies, and income optimization.' }
        ],
        code_exercises: [
            'Build a compute pricing engine with market-based rates',
            'Implement IPFS integration for result storage and retrieval',
            'Create a compute node dashboard with earnings tracker',
            'Design a task routing system for optimal node utilization'
        ],
        resources: ['Decentralized Compute Networks Overview', 'IPFS Documentation', 'Cloud Pricing Comparison Analysis']
    },
    13: {
        deep_dive: [
            { title: 'RVT Tier Economic Analysis', content: 'Detailed ROI analysis for each RVT tier (Bronze through Diamond) — break-even periods, expected annual yields, and historical performance modeling.' },
            { title: 'Secondary Market Dynamics', content: 'How RVT NFTs trade on secondary markets — floor price dynamics, rarity premiums, and how royalty income affects trading decisions.' },
            { title: 'Tax Implications of NFT Royalties', content: 'Understanding how perpetual royalty income is classified, reporting requirements, and strategies for tax-efficient RVT portfolio management.' }
        ],
        code_exercises: [
            'Build an RVT portfolio value tracker with yield projections',
            'Implement a secondary market price discovery algorithm',
            'Create an automated royalty reinvestment system',
            'Design a tax reporting tool for NFT royalty income'
        ],
        resources: ['RVT Tier Specifications', 'NFT Market Analysis Framework', 'Crypto Tax Reporting Guide']
    },
    14: {
        deep_dive: [
            { title: 'Payment Gateway Architecture', content: 'Build a production-grade payment gateway — request routing, idempotency keys, webhook delivery guarantees, and PCI compliance considerations for crypto payments.' },
            { title: 'Merchant SDK Development', content: 'Create developer SDKs for multiple platforms (JavaScript, Python, PHP) that merchants can integrate in minutes with simple API calls.' },
            { title: 'Point-of-Sale Integration', content: 'How to integrate crypto payments into physical retail — NFC terminals, QR code displays, receipt printing, and real-time conversion rates.' }
        ],
        code_exercises: [
            'Build a complete merchant payment API with webhooks',
            'Implement a QR code payment flow with real-time confirmation',
            'Create a merchant analytics dashboard with revenue charts',
            'Design a multi-currency checkout widget'
        ],
        resources: ['Payment Gateway Design Patterns', 'PCI DSS Compliance Guide', 'Crypto Payment Integration Best Practices']
    },
    15: {
        deep_dive: [
            { title: 'KYC/AML Implementation', content: 'Build compliant onboarding — identity verification tiers, document validation, sanctions screening, and travel rule compliance for crypto businesses.' },
            { title: 'Regulatory Landscape Analysis', content: 'Navigate global crypto regulations — SEC guidance, MiCA (EU), FATF recommendations, and how to build for multi-jurisdictional compliance.' },
            { title: 'Smart Contract Auditing', content: 'Learn formal verification methods, common vulnerability patterns (reentrancy, overflow, access control), and how to conduct thorough smart contract audits.' }
        ],
        code_exercises: [
            'Build a KYC verification flow with document upload',
            'Implement AML transaction monitoring with risk scoring',
            'Create a smart contract vulnerability scanner',
            'Design a compliance reporting dashboard'
        ],
        resources: ['FATF Virtual Asset Guidance', 'Smart Contract Security Best Practices', 'KYC/AML Compliance Framework']
    },
    16: {
        deep_dive: [
            { title: 'Order Book Engine Design', content: 'Build a high-performance matching engine — price-time priority, order types (limit, market, stop-loss, iceberg), and nanosecond-precision matching.' },
            { title: 'Liquidity & Market Making', content: 'Understand market maker strategies, spread management, inventory risk, and how automated market makers (AMMs) compare to order books.' },
            { title: 'Exchange Security Architecture', content: 'Multi-sig cold storage, hot wallet management, rate limiting, DDoS protection, and how top exchanges secure billions in assets.' }
        ],
        code_exercises: [
            'Build a complete order matching engine with price-time priority',
            'Implement a market making bot with spread management',
            'Create a real-time order book visualization',
            'Design a hot/cold wallet management system'
        ],
        resources: ['Exchange Architecture Patterns', 'Market Making Strategies Guide', 'Cryptocurrency Security Standards']
    },
    17: {
        deep_dive: [
            { title: 'Behavioral Finance & Cognitive Biases', content: 'Study how loss aversion, anchoring bias, herd mentality, and overconfidence affect investment decisions — and evidence-based strategies to overcome them.' },
            { title: 'Tax-Efficient Investment Strategies', content: 'Learn tax-loss harvesting, holding period optimization, retirement account strategies (IRA/401k), and how to minimize tax drag on portfolio returns.' },
            { title: 'Estate Planning & Generational Wealth', content: 'Trusts, beneficiary designations, crypto inheritance planning, and how to structure assets for efficient generational wealth transfer.' }
        ],
        code_exercises: [
            'Build a compound interest calculator with inflation adjustment',
            'Implement a budget tracking app with category analysis',
            'Create a retirement planning tool with Monte Carlo simulation',
            'Design a net worth tracker with goal projections'
        ],
        resources: ['The Psychology of Money - Key Concepts', 'Tax-Loss Harvesting Guide', 'Estate Planning Basics']
    },
    18: {
        deep_dive: [
            { title: 'Flash Loan Attack Analysis', content: 'Study real-world flash loan exploits (bZx, Harvest Finance, Cream) — the exact transaction sequences, profit calculations, and how protocols now defend against them.' },
            { title: 'Multi-DEX Arbitrage Strategies', content: 'Build advanced arbitrage strategies across 5+ DEXs simultaneously — triangular arbitrage, cross-chain arbitrage, and statistical arbitrage approaches.' },
            { title: 'Gas Optimization for Flash Loans', content: 'Minimize gas costs in flash loan transactions — calldata optimization, storage patterns, and how to make profitable trades even with high gas fees.' }
        ],
        code_exercises: [
            'Build a flash loan executor with multi-hop arbitrage',
            'Implement a real-time arbitrage opportunity scanner',
            'Create a gas optimization layer for complex transactions',
            'Design a flash loan risk assessment tool'
        ],
        resources: ['Flash Loan Protocol Specifications', 'DeFi Exploit Post-Mortems', 'Gas Optimization Techniques']
    },
    19: {
        deep_dive: [
            { title: 'Liquidity Pool Mathematics', content: 'Master constant product formulas (x*y=k), impermanent loss calculations, concentrated liquidity (Uniswap V3), and how pool design affects returns.' },
            { title: 'Risk Management in DeFi Pools', content: 'Build risk assessment frameworks — smart contract risk, impermanent loss risk, oracle manipulation risk, and how to construct balanced pool portfolios.' },
            { title: 'Yield Farming Strategy Optimization', content: 'Compare yield farming strategies across protocols — auto-compounding benefits, farm rotation timing, and how to maximize APY while managing risk.' }
        ],
        code_exercises: [
            'Build an impermanent loss calculator with visualization',
            'Implement a yield farming optimizer across multiple pools',
            'Create a pool performance comparison dashboard',
            'Design an automated pool rebalancing strategy'
        ],
        resources: ['Uniswap V3 Concentrated Liquidity Paper', 'Impermanent Loss Deep Dive', 'DeFi Yield Farming Guide']
    },
    20: {
        deep_dive: [
            { title: 'Modern Portfolio Theory for Crypto', content: 'Apply Markowitz efficient frontier to crypto portfolios — correlation matrices, risk-adjusted returns (Sharpe/Sortino ratios), and optimal allocation strategies.' },
            { title: 'On-Chain Portfolio Analysis', content: 'Use on-chain data for portfolio decisions — whale wallet tracking, DEX volume analysis, protocol revenue metrics, and how to identify undervalued assets.' },
            { title: 'Automated Portfolio Management', content: 'Build rebalancing bots — threshold-based rebalancing, calendar rebalancing, and how to minimize tax events while maintaining target allocations.' }
        ],
        code_exercises: [
            'Build a portfolio allocation optimizer using MPT',
            'Implement an automated rebalancing engine with tax awareness',
            'Create an on-chain analytics dashboard for investment research',
            'Design a portfolio performance tracker with benchmark comparison'
        ],
        resources: ['Modern Portfolio Theory Applied to Crypto', 'On-Chain Analysis Framework', 'Portfolio Rebalancing Strategies']
    },
    21: {
        deep_dive: [
            { title: 'Global Financial Inclusion', content: 'How blockchain enables banking the unbanked — 1.7 billion people without bank accounts, mobile money solutions, and crypto\'s role in emerging economies.' },
            { title: 'Microfinance & Blockchain', content: 'Study how blockchain reduces lending costs for micro-entrepreneurs — smart contract-based microloans, group lending models, and repayment tracking systems.' },
            { title: 'Cross-Border Remittance Revolution', content: 'Compare traditional remittance costs (6.5% average) with blockchain solutions — instant settlement, transparent fees, and how crypto reduces the $48B annual remittance fee burden.' }
        ],
        code_exercises: [
            'Build a micro-lending platform with smart contract enforcement',
            'Implement a cross-border remittance cost calculator',
            'Create a financial inclusion impact dashboard',
            'Design a group savings (chama/tontine) system on blockchain'
        ],
        resources: ['World Bank Financial Inclusion Database', 'Blockchain for Social Impact Report', 'Remittance Market Analysis']
    }
};

const courses = {
    1: {
        icon: '💼',
        title: 'Course 1: Wallet Management & Cryptography',
        duration: '4 hours',
        modules: 5,
        level: 'Beginner',
        overview: 'Master the fundamentals of blockchain wallets using industry-standard secp256k1 elliptic curve cryptography. Create secure public/private key pairs, understand wallet address generation, and learn best practices for key storage and security.',
        objectives: [
            'Understand public-key cryptography fundamentals',
            'Generate secure secp256k1 key pairs',
            'Create and validate wallet addresses',
            'Implement digital signature creation and verification',
            'Master wallet security best practices'
        ],
        modules_content: [
            {
                title: 'Introduction to Cryptographic Wallets',
                lessons: [
                    'What is a cryptocurrency wallet?',
                    'Hot wallets vs. cold wallets',
                    'Custodial vs. non-custodial wallets',
                    'Why cryptography is essential'
                ]
            },
            {
                title: 'Elliptic Curve Cryptography (ECC)',
                lessons: [
                    'Mathematical foundations of ECC',
                    'The secp256k1 curve parameters',
                    'Why Bitcoin chose secp256k1',
                    'ECC vs. RSA comparison'
                ]
            },
            {
                title: 'Key Generation & Management',
                lessons: [
                    'Generating private keys securely',
                    'Deriving public keys from private keys',
                    'Address generation algorithms',
                    'Key storage best practices (hardware wallets, paper wallets)'
                ]
            },
            {
                title: 'Digital Signatures',
                lessons: [
                    'How digital signatures work',
                    'ECDSA signature algorithm',
                    'Signing transactions',
                    'Verifying signatures'
                ]
            },
            {
                title: 'Wallet Security & Recovery',
                lessons: [
                    'BIP39 mnemonic phrases',
                    'Seed phrase generation',
                    'Multi-signature wallets',
                    'Common security vulnerabilities and how to avoid them'
                ]
            }
        ],
        quiz: [
            {
                question: 'What is the main advantage of secp256k1 elliptic curve cryptography?',
                options: [
                    'A) It\'s faster than RSA',
                    'B) It provides strong security with smaller key sizes',
                    'C) It\'s easier to understand',
                    'D) It works on quantum computers'
                ],
                correct: 'B) It provides strong security with smaller key sizes'
            },
            {
                question: 'Which of the following is true about private keys?',
                options: [
                    'A) They can be safely shared with trusted friends',
                    'B) They can be recovered if lost',
                    'C) They must never be shared with anyone',
                    'D) They expire after one year'
                ],
                correct: 'C) They must never be shared with anyone'
            },
            {
                question: 'What is a BIP39 mnemonic phrase?',
                options: [
                    'A) A password for your exchange account',
                    'B) A series of 12-24 words that can recover your wallet',
                    'C) Your wallet address',
                    'D) A type of cryptocurrency'
                ],
                correct: 'B) A series of 12-24 words that can recover your wallet'
            }
        ],
        skills: ['Public-Key Cryptography', 'Digital Signatures', 'Wallet Security', 'secp256k1', 'Key Management'],
        real_world: 'Used by Bitcoin, Ethereum, and most major cryptocurrencies. Essential foundation for all blockchain development.',
        hands_on: 'Students practice generating wallets, creating signatures, and implementing the full ECDSA signature verification algorithm.'
    },

    2: {
        icon: '⛏️',
        title: 'Course 2: Block Mining & Hashing',
        duration: '5 hours',
        modules: 6,
        level: 'Beginner',
        overview: 'Learn how blockchain miners create new blocks using SHA-256 hashing and Proof-of-Work consensus. Understand difficulty adjustment, nonce calculation, and the economic incentives that secure blockchain networks.',
        objectives: [
            'Understand SHA-256 cryptographic hashing',
            'Implement Proof-of-Work mining algorithm',
            'Calculate mining difficulty targets',
            'Master nonce discovery techniques',
            'Understand mining economics and incentives'
        ],
        modules_content: [
            {
                title: 'Cryptographic Hash Functions',
                lessons: [
                    'What is a hash function?',
                    'Properties of cryptographic hashes',
                    'SHA-256 algorithm overview',
                    'Collision resistance and preimage resistance'
                ]
            },
            {
                title: 'Proof-of-Work Consensus',
                lessons: [
                    'Byzantine Generals Problem',
                    'How PoW achieves consensus',
                    'Mining difficulty explained',
                    'Target hash calculation'
                ]
            },
            {
                title: 'Block Structure & Mining',
                lessons: [
                    'Block header components',
                    'Merkle root calculation',
                    'Nonce iteration strategies',
                    'Hashrate and mining power'
                ]
            },
            {
                title: 'Difficulty Adjustment',
                lessons: [
                    'Why difficulty must adjust',
                    'Bitcoin\'s 2-week adjustment algorithm',
                    'Network hashrate impact',
                    'Maintaining consistent block times'
                ]
            },
            {
                title: 'Mining Economics',
                lessons: [
                    'Block rewards structure',
                    'Transaction fees',
                    'Mining profitability calculation',
                    'Pool mining vs. solo mining'
                ]
            },
            {
                title: 'Mining Hardware Evolution',
                lessons: [
                    'CPU mining era',
                    'GPU mining advantages',
                    'ASIC miners explained',
                    'Energy consumption considerations'
                ]
            }
        ],
        quiz: [
            {
                question: 'What happens if you change one bit in the block data?',
                options: [
                    'A) The hash changes slightly',
                    'B) The hash changes completely (avalanche effect)',
                    'C) The hash stays the same',
                    'D) The block becomes invalid but the hash is unchanged'
                ],
                correct: 'B) The hash changes completely (avalanche effect)'
            },
            {
                question: 'What is the purpose of mining difficulty?',
                options: [
                    'A) To make mining impossible',
                    'B) To maintain consistent block creation times',
                    'C) To reduce electricity costs',
                    'D) To prevent transactions'
                ],
                correct: 'B) To maintain consistent block creation times'
            },
            {
                question: 'What is a nonce in blockchain mining?',
                options: [
                    'A) A type of cryptocurrency',
                    'B) A number miners increment to find a valid hash',
                    'C) A wallet address',
                    'D) A transaction fee'
                ],
                correct: 'B) A number miners increment to find a valid hash'
            }
        ],
        skills: ['SHA-256 Hashing', 'Proof-of-Work', 'Mining Algorithms', 'Difficulty Adjustment', 'Block Structure'],
        real_world: 'Powers Bitcoin, Ethereum Classic, and thousands of other blockchain networks. Core mechanism for decentralized consensus.',
        hands_on: 'Students mine real blocks, adjust difficulty parameters, and measure hashrate performance in the simulator.'
    },

    3: {
        icon: '🔗',
        title: 'Course 3: Blockchain Structure & Chain Management',
        duration: '4 hours',
        modules: 5,
        level: 'Beginner',
        overview: 'Understand how blocks link together to form an immutable chain. Learn about block headers, previous hash references, Merkle trees, and the properties that make blockchains tamper-proof.',
        objectives: [
            'Understand blockchain data structures',
            'Implement block linking mechanism',
            'Master Merkle tree construction',
            'Validate blockchain integrity',
            'Handle chain reorganizations'
        ],
        modules_content: [
            {
                title: 'Blockchain Data Structure',
                lessons: [
                    'Linked list structure',
                    'Genesis block concept',
                    'Block height and depth',
                    'Chain immutability properties'
                ]
            },
            {
                title: 'Block Headers & Linking',
                lessons: [
                    'Block header components',
                    'Previous hash reference',
                    'How blocks link together',
                    'Why changing old blocks breaks the chain'
                ]
            },
            {
                title: 'Merkle Trees',
                lessons: [
                    'Binary tree structure',
                    'Transaction hash aggregation',
                    'Merkle root calculation',
                    'Efficient proof of inclusion'
                ]
            },
            {
                title: 'Chain Validation',
                lessons: [
                    'Validating individual blocks',
                    'Validating entire chain',
                    'Detecting tampering',
                    'Chain reorganization rules'
                ]
            },
            {
                title: 'Fork Management',
                lessons: [
                    'Orphan blocks',
                    'Longest chain rule',
                    'Temporary vs. permanent forks',
                    'Hard forks vs. soft forks'
                ]
            }
        ],
        quiz: [
            {
                question: 'Why is blockchain considered immutable?',
                options: [
                    'A) Blocks are encrypted',
                    'B) Changing a block breaks all subsequent block hashes',
                    'C) Blocks are stored in multiple locations',
                    'D) Government regulations prevent changes'
                ],
                correct: 'B) Changing a block breaks all subsequent block hashes'
            },
            {
                question: 'What is a Merkle tree used for?',
                options: [
                    'A) Encrypting transactions',
                    'B) Efficiently proving transaction inclusion in a block',
                    'C) Storing wallet addresses',
                    'D) Mining new blocks'
                ],
                correct: 'B) Efficiently proving transaction inclusion in a block'
            }
        ],
        skills: ['Blockchain Structure', 'Merkle Trees', 'Chain Validation', 'Fork Resolution', 'Data Integrity'],
        real_world: 'Foundation of all blockchain systems. Understanding chain structure is critical for building wallets, explorers, and nodes.',
        hands_on: 'Students build a blockchain from scratch, validate chains, and observe how tampering breaks the structure.'
    },

    4: {
        icon: '💸',
        title: 'Course 4: Transaction Creation & Validation',
        duration: '6 hours',
        modules: 7,
        level: 'Intermediate',
        overview: 'Master cryptocurrency transactions from creation to validation. Learn UTXO model, transaction inputs/outputs, digital signatures, fee calculation, and multi-layer validation.',
        objectives: [
            'Create valid cryptocurrency transactions',
            'Understand UTXO model vs. account model',
            'Implement transaction signing',
            'Validate transactions cryptographically',
            'Calculate appropriate transaction fees'
        ],
        modules_content: [
            {
                title: 'Transaction Fundamentals',
                lessons: [
                    'What is a cryptocurrency transaction?',
                    'Transaction lifecycle',
                    'Transaction components',
                    'Transaction ID calculation'
                ]
            },
            {
                title: 'UTXO Model',
                lessons: [
                    'Unspent Transaction Output explained',
                    'How UTXO differs from account model',
                    'Finding spendable UTXOs',
                    'Change addresses and outputs'
                ]
            },
            {
                title: 'Transaction Inputs & Outputs',
                lessons: [
                    'Input structure and references',
                    'Output structure and amounts',
                    'Multi-input transactions',
                    'Multi-output transactions'
                ]
            },
            {
                title: 'Transaction Signing',
                lessons: [
                    'Creating transaction signatures',
                    'What gets signed (transaction hash)',
                    'Signature verification process',
                    'Multi-signature transactions'
                ]
            },
            {
                title: 'Transaction Validation',
                lessons: [
                    'Signature verification',
                    'Balance validation',
                    'Double-spend prevention',
                    'Fee calculation validation'
                ]
            },
            {
                title: 'Transaction Fees',
                lessons: [
                    'Why fees exist',
                    'Fee calculation (inputs - outputs)',
                    'Fee-per-byte pricing',
                    'Priority transaction processing'
                ]
            },
            {
                title: 'Advanced Transaction Types',
                lessons: [
                    'Multi-signature transactions',
                    'Time-locked transactions',
                    'Script-based conditions',
                    'Atomic swaps'
                ]
            }
        ],
        quiz: [
            {
                question: 'In the UTXO model, what happens to unspent output?',
                options: [
                    'A) It disappears',
                    'B) It remains available for future transactions',
                    'C) It gets refunded to the sender',
                    'D) It goes to miners'
                ],
                correct: 'B) It remains available for future transactions'
            },
            {
                question: 'How is a transaction fee calculated?',
                options: [
                    'A) Fixed $1 per transaction',
                    'B) Sum of inputs minus sum of outputs',
                    'C) Based on sender reputation',
                    'D) Random amount'
                ],
                correct: 'B) Sum of inputs minus sum of outputs'
            }
        ],
        skills: ['UTXO Model', 'Transaction Signing', 'Cryptographic Validation', 'Fee Calculation', 'Double-Spend Prevention'],
        real_world: 'Core mechanism of Bitcoin, Litecoin, and UTXO-based cryptocurrencies. Essential for wallet development.',
        hands_on: 'Students create transactions, sign them with private keys, and implement full validation logic.'
    },

    5: {
        icon: '⏱️',
        title: 'Course 5: Scheduled Payments & Time-Locks',
        duration: '5 hours',
        modules: 5,
        level: 'Intermediate',
        overview: 'Implement automated recurring payments and time-locked transactions. Learn subscription billing, salary disbursement, escrow systems, and vesting schedules on the blockchain.',
        objectives: [
            'Create time-locked transactions',
            'Implement recurring payment schedules',
            'Build subscription billing systems',
            'Master vesting schedule logic',
            'Understand payment automation'
        ],
        modules_content: [
            {
                title: 'Introduction to Smart Scheduling',
                lessons: [
                    'Traditional payment limitations',
                    'Blockchain-based automation',
                    'Use cases for scheduled payments',
                    'Time-lock concepts'
                ]
            },
            {
                title: 'Time-Locked Transactions',
                lessons: [
                    'Absolute time locks (locktime)',
                    'Relative time locks (CSV)',
                    'Block height vs. timestamp locks',
                    'Implementing time-lock validation'
                ]
            },
            {
                title: 'Recurring Payments',
                lessons: [
                    'Payment schedule data structures',
                    'Daily, weekly, monthly intervals',
                    'Payment execution triggers',
                    'Handling failed payments'
                ]
            },
            {
                title: 'Subscription Systems',
                lessons: [
                    'Subscription registration',
                    'Automated billing cycles',
                    'Cancellation handling',
                    'Grace periods and retries'
                ]
            },
            {
                title: 'Vesting & Escrow',
                lessons: [
                    'Token vesting schedules',
                    'Cliff periods',
                    'Linear vs. staged vesting',
                    'Escrow release conditions'
                ]
            }
        ],
        quiz: [
            {
                question: 'What is the purpose of time-locked transactions?',
                options: [
                    'A) To prevent transactions permanently',
                    'B) To delay transaction execution until a specific time',
                    'C) To encrypt transactions',
                    'D) To increase transaction fees'
                ],
                correct: 'B) To delay transaction execution until a specific time'
            },
            {
                question: 'In a vesting schedule, what is a "cliff period"?',
                options: [
                    'A) Time before any tokens unlock',
                    'B) Maximum vesting duration',
                    'C) Transaction fee period',
                    'D) Mining difficulty'
                ],
                correct: 'A) Time before any tokens unlock'
            }
        ],
        skills: ['Time-Lock Mechanisms', 'Payment Automation', 'Subscription Billing', 'Vesting Schedules', 'Escrow Systems'],
        real_world: 'Used in DeFi protocols, payroll systems, subscription services, and token distribution. Critical for building automated financial applications.',
        hands_on: 'Students build a complete subscription payment system with automated billing, cancellations, and payment tracking.'
    },

    6: {
        icon: '⏮️',
        title: 'Course 6: Transaction Reversal System',
        duration: '5 hours',
        modules: 6,
        level: 'Advanced',
        overview: 'Revolutionary 5-minute transaction reversal window. Learn fraud prevention, dispute resolution, and how this feature bridges traditional finance and blockchain while maintaining security.',
        objectives: [
            'Understand transaction reversal mechanics',
            'Implement 5-minute reversal window',
            'Build fraud detection systems',
            'Handle dispute resolution',
            'Balance security with user protection'
        ],
        modules_content: [
            {
                title: 'Why Transaction Reversal?',
                lessons: [
                    'Bitcoin\'s finality problem',
                    'Accidental transfers',
                    'Fraud and scam protection',
                    'Real-world adoption barriers'
                ]
            },
            {
                title: 'Reversal Window Implementation',
                lessons: [
                    '5-minute pending state',
                    'Transaction confirmation delays',
                    'Reversal request mechanism',
                    'Security considerations'
                ]
            },
            {
                title: 'Fraud Detection',
                lessons: [
                    'Common cryptocurrency scams',
                    'Automated fraud detection',
                    'Risk scoring algorithms',
                    'User behavior analysis'
                ]
            },
            {
                title: 'Dispute Resolution',
                lessons: [
                    'User-initiated reversals',
                    'Evidence submission',
                    'Automated dispute handling',
                    'Manual review process'
                ]
            },
            {
                title: 'Security Trade-offs',
                lessons: [
                    'Double-spend attack prevention',
                    'Merchant protection',
                    'Time-window optimization',
                    'Network consensus impacts'
                ]
            },
            {
                title: 'Integration with Traditional Finance',
                lessons: [
                    'Comparison to credit card chargebacks',
                    'Consumer protection requirements',
                    'Regulatory compliance',
                    'Mainstream adoption benefits'
                ]
            }
        ],
        quiz: [
            {
                question: 'Why is a 5-minute reversal window significant?',
                options: [
                    'A) It makes transactions instant',
                    'B) It protects users from accidental sends while maintaining fast finality',
                    'C) It increases mining rewards',
                    'D) It reduces network traffic'
                ],
                correct: 'B) It protects users from accidental sends while maintaining fast finality'
            },
            {
                question: 'How does transaction reversal differ from chargebacks?',
                options: [
                    'A) Chargebacks can happen months later, reversals only within 5 minutes',
                    'B) There is no difference',
                    'C) Reversals cost more money',
                    'D) Chargebacks are automatic'
                ],
                correct: 'A) Chargebacks can happen months later, reversals only within 5 minutes'
            }
        ],
        skills: ['Transaction Reversal', 'Fraud Detection', 'Dispute Resolution', 'User Protection', 'Risk Management'],
        real_world: 'Bridges crypto and traditional finance. Critical for consumer adoption, regulatory compliance, and fraud prevention.',
        hands_on: 'Students implement the full reversal system, including fraud detection, pending states, and security measures.'
    },

    7: {
        icon: '🔐',
        title: 'Course 7: Social Recovery System',
        duration: '4 hours',
        modules: 5,
        level: 'Advanced',
        overview: 'Implement account recovery through trusted guardians. Learn multi-signature recovery, guardian management, threshold signatures, and how to recover wallets without centralized authorities.',
        objectives: [
            'Design social recovery systems',
            'Implement guardian selection mechanisms',
            'Create threshold signature recovery',
            'Build secure recovery workflows',
            'Balance security and accessibility'
        ],
        modules_content: [
            {
                title: 'The Lost Key Problem',
                lessons: [
                    'Billions lost to forgotten passwords',
                    'Why seed phrases fail',
                    'Traditional vs. decentralized recovery',
                    'Social recovery concept'
                ]
            },
            {
                title: 'Guardian-Based Recovery',
                lessons: [
                    'Selecting trusted guardians',
                    'Guardian key distribution',
                    'Recovery threshold (M-of-N)',
                    'Guardian notification systems'
                ]
            },
            {
                title: 'Multi-Signature Recovery',
                lessons: [
                    'Shamir Secret Sharing',
                    'Threshold cryptography',
                    'Recovery transaction construction',
                    'Guardian signature aggregation'
                ]
            },
            {
                title: 'Recovery Workflow',
                lessons: [
                    'Initiating recovery request',
                    'Guardian verification',
                    'Timelocks for security',
                    'New wallet generation'
                ]
            },
            {
                title: 'Attack Prevention',
                lessons: [
                    'Preventing unauthorized recovery',
                    'Guardian collusion detection',
                    'Social engineering prevention',
                    'Recovery delays and notifications'
                ]
            }
        ],
        quiz: [
            {
                question: 'What is a "3-of-5" guardian recovery system?',
                options: [
                    'A) 3 guardians total, 5 required',
                    'B) 5 guardians total, 3 required to recover wallet',
                    'C) 5% recovery fee',
                    'D) 3 days to recover, 5 days delay'
                ],
                correct: 'B) 5 guardians total, 3 required to recover wallet'
            },
            {
                question: 'Why include a timelock in recovery process?',
                options: [
                    'A) To slow down the network',
                    'B) To give the owner time to cancel if recovery is unauthorized',
                    'C) To increase fees',
                    'D) For mining purposes'
                ],
                correct: 'B) To give the owner time to cancel if recovery is unauthorized'
            }
        ],
        skills: ['Social Recovery', 'Multi-Signature Systems', 'Threshold Cryptography', 'Guardian Management', 'Account Security'],
        real_world: 'Used in Argent wallet, Gnosis Safe, and modern smart contract wallets. Critical for mainstream adoption.',
        hands_on: 'Students build a complete social recovery system with guardian selection, threshold signatures, and recovery workflows.'
    },

    8: {
        icon: '⭐',
        title: 'Course 8: Reputation & Trust Systems',
        duration: '4 hours',
        modules: 5,
        level: 'Intermediate',
        overview: 'Build on-chain reputation systems. Learn rating algorithms, trust scores, review validation, and how to create trustless marketplaces with reputation-based mechanisms.',
        objectives: [
            'Design reputation scoring algorithms',
            'Implement on-chain reviews',
            'Create trust score calculations',
            'Prevent reputation manipulation',
            'Build reputation-based incentives'
        ],
        modules_content: [
            {
                title: 'Trust in Decentralized Systems',
                lessons: [
                    'The trust problem in peer-to-peer markets',
                    'Centralized vs. decentralized reputation',
                    'On-chain vs. off-chain reputation',
                    'Sybil attack prevention'
                ]
            },
            {
                title: 'Reputation Data Structures',
                lessons: [
                    'User reputation score storage',
                    'Review and rating storage',
                    'Transaction history tracking',
                    'Reputation decay over time'
                ]
            },
            {
                title: 'Rating Algorithms',
                lessons: [
                    'Simple averaging vs. weighted scoring',
                    'Recency weighting',
                    'Volume-based adjustments',
                    'Outlier detection and removal'
                ]
            },
            {
                title: 'Review Validation',
                lessons: [
                    'Proof of transaction',
                    'Review authenticity',
                    'Preventing fake reviews',
                    'Dispute mechanisms'
                ]
            },
            {
                title: 'Reputation-Based Features',
                lessons: [
                    'Access control by reputation',
                    'Fee discounts for high-reputation users',
                    'Reputation staking',
                    'Reputation as collateral'
                ]
            }
        ],
        quiz: [
            {
                question: 'What is a Sybil attack in reputation systems?',
                options: [
                    'A) Hacking someone\'s wallet',
                    'B) Creating multiple fake accounts to inflate reputation',
                    'C) Mining blocks too fast',
                    'D) Double-spending'
                ],
                correct: 'B) Creating multiple fake accounts to inflate reputation'
            },
            {
                question: 'Why use on-chain reputation instead of centralized databases?',
                options: [
                    'A) It\'s cheaper',
                    'B) It\'s transparent, tamper-proof, and portable across platforms',
                    'C) It\'s faster',
                    'D) It uses less storage'
                ],
                correct: 'B) It\'s transparent, tamper-proof, and portable across platforms'
            }
        ],
        skills: ['Reputation Systems', 'Trust Scoring', 'Review Validation', 'Sybil Attack Prevention', 'On-Chain Data'],
        real_world: 'Used in OpenBazaar, decentralized marketplaces, peer-to-peer lending, and DAO membership. Essential for trustless commerce.',
        hands_on: 'Students build a marketplace reputation system with ratings, reviews, and anti-manipulation mechanisms.'
    },

    9: {
        icon: '🗳️',
        title: 'Course 9: Community Governance & Voting',
        duration: '5 hours',
        modules: 6,
        level: 'Advanced',
        overview: 'Implement decentralized governance and token-weighted voting. Learn proposal systems, vote delegation, quadratic voting, and how communities govern blockchain protocols.',
        objectives: [
            'Design governance systems',
            'Implement proposal creation and voting',
            'Build token-weighted voting mechanisms',
            'Create vote delegation features',
            'Understand various voting models'
        ],
        modules_content: [
            {
                title: 'Introduction to DAO Governance',
                lessons: [
                    'What is a DAO?',
                    'Traditional governance vs. decentralized',
                    'Token-weighted voting explained',
                    'Governance participation challenges'
                ]
            },
            {
                title: 'Proposal Systems',
                lessons: [
                    'Creating governance proposals',
                    'Proposal formatting and metadata',
                    'Proposal submission requirements',
                    'Discussion and amendment processes'
                ]
            },
            {
                title: 'Voting Mechanisms',
                lessons: [
                    'Simple majority voting',
                    'Supermajority requirements',
                    'Quadratic voting',
                    'Conviction voting'
                ]
            },
            {
                title: 'Vote Delegation',
                lessons: [
                    'Delegating voting power',
                    'Liquid democracy',
                    'Delegation chains',
                    'Revocation mechanisms'
                ]
            },
            {
                title: 'Execution & Implementation',
                lessons: [
                    'Timelock contracts',
                    'Automatic execution',
                    'Veto mechanisms',
                    'Emergency governance'
                ]
            },
            {
                title: 'Governance Attacks & Defense',
                lessons: [
                    'Whale dominance problem',
                    'Vote buying',
                    'Flash loan attacks on governance',
                    'Governance minimization strategies'
                ]
            }
        ],
        quiz: [
            {
                question: 'What is quadratic voting?',
                options: [
                    'A) Voting with square-shaped ballots',
                    'B) Cost of votes increases quadratically, preventing plutocracy',
                    'C) Voting happens every 4 years',
                    'D) A type of mining algorithm'
                ],
                correct: 'B) Cost of votes increases quadratically, preventing plutocracy'
            },
            {
                question: 'What is a flash loan attack on governance?',
                options: [
                    'A) Very fast voting',
                    'B) Borrowing tokens to gain temporary voting power, then returning them',
                    'C) Lightning network governance',
                    'D) Emergency voting'
                ],
                correct: 'B) Borrowing tokens to gain temporary voting power, then returning them'
            }
        ],
        skills: ['DAO Governance', 'Voting Systems', 'Proposal Management', 'Vote Delegation', 'Decentralized Decision-Making'],
        real_world: 'Used in Uniswap, Compound, MakerDAO, and all major DeFi protocols. Essential for decentralized protocol management.',
        hands_on: 'Students build a complete governance system with proposals, weighted voting, delegation, and execution.'
    },

    10: {
        icon: '⛏️',
        title: 'Course 10: Proof-of-Work Mining',
        duration: '5 hours',
        modules: 6,
        level: 'Intermediate',
        overview: 'Deep dive into classical Proof-of-Work mining. Master SHA-256, difficulty adjustment, mining pools, and the economic game theory that secures billions in cryptocurrency.',
        objectives: [
            'Implement full PoW mining algorithm',
            'Understand economic incentives',
            'Master difficulty adjustment mechanisms',
            'Calculate mining profitability',
            'Understand mining pool dynamics'
        ],
        modules_content: [
            {
                title: 'PoW Fundamentals Review',
                lessons: [
                    'Consensus mechanism overview',
                    'Byzantine fault tolerance',
                    'Why PoW works',
                    'Energy consumption debate'
                ]
            },
            {
                title: 'Advanced SHA-256',
                lessons: [
                    'SHA-256 internals',
                    'Double SHA-256',
                    'Merkle tree optimization',
                    'Hardware acceleration'
                ]
            },
            {
                title: 'Mining Economics',
                lessons: [
                    'Block reward halving',
                    'Fee market dynamics',
                    'Electricity cost calculations',
                    'Hardware ROI analysis'
                ]
            },
            {
                title: 'Mining Pools',
                lessons: [
                    'Why pools exist',
                    'Share calculation',
                    'Payment schemes (PPS, PPLNS)',
                    'Pool centralization risks'
                ]
            },
            {
                title: 'Attack Vectors',
                lessons: [
                    '51% attacks',
                    'Selfish mining',
                    'Timestamp manipulation',
                    'Block withholding'
                ]
            },
            {
                title: 'Future of PoW',
                lessons: [
                    'Sustainability concerns',
                    'Green energy mining',
                    'ASIC resistance',
                    'Alternatives to PoW'
                ]
            }
        ],
        quiz: [
            {
                question: 'What is the main economic incentive for miners?',
                options: [
                    'A) Helping the network',
                    'B) Block rewards + transaction fees',
                    'C) Government subsidies',
                    'D) Reputation points'
                ],
                correct: 'B) Block rewards + transaction fees'
            },
            {
                question: 'What is a 51% attack?',
                options: [
                    'A) Hacking 51% of wallets',
                    'B) Controlling majority hashrate to manipulate the blockchain',
                    'C) Stealing 51% of coins',
                    'D) Winning 51% of votes'
                ],
                correct: 'B) Controlling majority hashrate to manipulate the blockchain'
            }
        ],
        skills: ['SHA-256 Mining', 'PoW Consensus', 'Difficulty Algorithms', 'Mining Economics', 'Attack Prevention'],
        real_world: 'Powers Bitcoin ($800B+ market cap), Litecoin, Bitcoin Cash. Foundation of cryptocurrency security.',
        hands_on: 'Students mine blocks, adjust difficulty, calculate profitability, and simulate mining pool operations.'
    },

    11: {
        icon: '💎',
        title: 'Course 11: Proof-of-Residual-Value (PoRV) Mining',
        duration: '6 hours',
        modules: 7,
        level: 'Advanced',
        overview: 'Revolutionary consensus creating REAL economic value. Mine blocks by completing AI/ML computations for enterprise clients. Earn block rewards PLUS perpetual royalty NFTs (RVTs) that pay you whenever clients use your work commercially.',
        objectives: [
            'Understand value-generating consensus',
            'Implement AI/ML task mining',
            'Create and manage RVT tokens',
            'Calculate royalty distributions',
            'Integrate enterprise payment systems'
        ],
        modules_content: [
            {
                title: 'The PoRV Innovation',
                lessons: [
                    'Problems with traditional mining',
                    'How PoRV generates real value',
                    'Enterprise client integration',
                    'Economic sustainability model'
                ]
            },
            {
                title: 'AI/ML Computational Tasks',
                lessons: [
                    'Types of computations (training, inference)',
                    'Task difficulty scaling',
                    'Result verification',
                    'Quality assurance mechanisms'
                ]
            },
            {
                title: 'Residual Value Tokens (RVTs)',
                lessons: [
                    'RVT as perpetual royalty NFTs',
                    'Ownership and transferability',
                    'Royalty accumulation',
                    'Secondary market potential'
                ]
            },
            {
                title: 'Enterprise Payment System',
                lessons: [
                    'Client task submission',
                    'Payment in fiat (converted to KENO)',
                    'Commercial usage tracking',
                    'Royalty distribution (50% holders, 40% burned, 10% treasury)'
                ]
            },
            {
                title: 'Deflationary Tokenomics',
                lessons: [
                    'Why 40% burn creates scarcity',
                    'Supply reduction over time',
                    'Token value appreciation mechanics',
                    'Long-term economic sustainability'
                ]
            },
            {
                title: 'Mining Profitability',
                lessons: [
                    'Block rewards (KENO)',
                    'RVT passive income potential',
                    'ROI calculations',
                    'Comparing PoRV to traditional mining'
                ]
            },
            {
                title: 'Real-World Case Studies',
                lessons: [
                    'AI model training examples',
                    'Data analysis use cases',
                    'Scientific computation applications',
                    'Actual royalty earnings scenarios'
                ]
            }
        ],
        quiz: [
            {
                question: 'How does PoRV differ from traditional PoW?',
                options: [
                    'A) It uses less electricity',
                    'B) It generates actual economic value through enterprise AI/ML work',
                    'C) It\'s faster',
                    'D) It has no block rewards'
                ],
                correct: 'B) It generates actual economic value through enterprise AI/ML work'
            },
            {
                question: 'What happens to the 40% of royalty payments that are burned?',
                options: [
                    'A) They go to miners',
                    'B) They are permanently removed from circulation, reducing supply',
                    'C) They go to the government',
                    'D) They are recycled'
                ],
                correct: 'B) They are permanently removed from circulation, reducing supply'
            },
            {
                question: 'What are RVTs?',
                options: [
                    'A) Regular tokens like Bitcoin',
                    'B) NFTs that pay perpetual royalties when enterprises use your computation results',
                    'C) Mining hardware',
                    'D) Transaction fees'
                ],
                correct: 'B) NFTs that pay perpetual royalties when enterprises use your computation results'
            }
        ],
        skills: ['PoRV Consensus', 'AI/ML Integration', 'RVT Management', 'Royalty Distributions', 'Enterprise Systems'],
        real_world: 'First blockchain where mining creates tangible economic output. Miners earn passive income from commercial AI usage. Potential for $1,000-$10,000+ monthly royalty income for active miners.',
        hands_on: 'Students mine PoRV blocks, complete AI tasks, earn RVTs, track royalties, and calculate long-term passive income potential.'
    },

    12: {
        icon: '📊',
        title: 'Course 12: RVT Portfolio Management',
        duration: '4 hours',
        modules: 5,
        level: 'Intermediate',
        overview: 'Manage your Residual Value Token portfolio. Track RVT ownership, monitor royalty earnings, analyze commercial usage statistics, and optimize your passive income stream.',
        objectives: [
            'Track RVT token ownership',
            'Monitor royalty accumulation',
            'Analyze usage statistics',
            'Optimize portfolio performance',
            'Understand tokenomics impact'
        ],
        modules_content: [
            {
                title: 'RVT Portfolio Overview',
                lessons: [
                    'What is an RVT portfolio?',
                    'Portfolio dashboard design',
                    'Key performance metrics',
                    'Portfolio diversification'
                ]
            },
            {
                title: 'Royalty Tracking',
                lessons: [
                    'Real-time earnings monitoring',
                    'Historical royalty data',
                    'Payment schedules',
                    'Royalty claim mechanisms'
                ]
            },
            {
                title: 'Commercial Usage Analytics',
                lessons: [
                    'Client usage patterns',
                    'High-value RVT identification',
                    'Usage trend analysis',
                    'Predictive income modeling'
                ]
            },
            {
                title: 'Portfolio Optimization',
                lessons: [
                    'Active vs. inactive RVTs',
                    'Secondary market trading',
                    'RVT bundling strategies',
                    'Tax considerations'
                ]
            },
            {
                title: 'Long-Term Value Growth',
                lessons: [
                    'Compound royalty growth',
                    'Token burn impact on value',
                    'Market supply dynamics',
                    'Retirement income potential'
                ]
            }
        ],
        quiz: [
            {
                question: 'Why might some RVTs be more valuable than others?',
                options: [
                    'A) They look better',
                    'B) They generate more royalties due to higher commercial usage',
                    'C) They are older',
                    'D) Random chance'
                ],
                correct: 'B) They generate more royalties due to higher commercial usage'
            },
            {
                question: 'How does KENO burning affect RVT value?',
                options: [
                    'A) No effect',
                    'B) Reduces circulating supply, increasing value of remaining tokens',
                    'C) Decreases value',
                    'D) Only affects miners'
                ],
                correct: 'B) Reduces circulating supply, increasing value of remaining tokens'
            }
        ],
        skills: ['Portfolio Management', 'Royalty Tracking', 'Analytics', 'Income Optimization', 'NFT Valuation'],
        real_world: 'Similar to managing stock dividends or music royalties, but on-chain and automated. Critical for maximizing passive income.',
        hands_on: 'Students build portfolio dashboards, analyze RVT performance, and calculate long-term income projections.'
    },

    13: {
        icon: '🏢',
        title: 'Course 13: Enterprise Task Submission',
        duration: '5 hours',
        modules: 6,
        level: 'Advanced',
        overview: 'Learn the enterprise side of PoRV. Submit AI/ML computational tasks, pay for processing, track results, and integrate blockchain mining into business operations.',
        objectives: [
            'Design enterprise task submission systems',
            'Implement payment processing',
            'Create result verification mechanisms',
            'Build usage tracking systems',
            'Integrate with business workflows'
        ],
        modules_content: [
            {
                title: 'Enterprise Blockchain Use Cases',
                lessons: [
                    'Why enterprises need decentralized computing',
                    'Cost savings vs. AWS/Azure',
                    'Quality and reliability guarantees',
                    'Compliance and data security'
                ]
            },
            {
                title: 'Task Submission Interface',
                lessons: [
                    'API design for task submission',
                    'Task specification formats',
                    'Dataset upload mechanisms',
                    'Priority and deadline settings'
                ]
            },
            {
                title: 'Payment Processing',
                lessons: [
                    'Fiat payment acceptance',
                    'KENO conversion rates',
                    'Escrow mechanisms',
                    'Refund policies'
                ]
            },
            {
                title: 'Result Verification',
                lessons: [
                    'Quality assurance processes',
                    'Result validation',
                    'Accuracy metrics',
                    'Dispute resolution'
                ]
            },
            {
                title: 'Commercial Usage Tracking',
                lessons: [
                    'Usage metrics collection',
                    'Royalty calculation triggers',
                    'Reporting dashboards',
                    'Audit trails'
                ]
            },
            {
                title: 'Business Integration',
                lessons: [
                    'API integration guides',
                    'Webhook notifications',
                    'Batch processing',
                    'Enterprise support SLAs'
                ]
            }
        ],
        quiz: [
            {
                question: 'Why would an enterprise use PoRV instead of AWS?',
                options: [
                    'A) It\'s always faster',
                    'B) Potentially lower cost and decentralized redundancy',
                    'C) Better graphics',
                    'D) Government requirement'
                ],
                correct: 'B) Potentially lower cost and decentralized redundancy'
            },
            {
                question: 'When do royalty payments trigger?',
                options: [
                    'A) Immediately upon task completion',
                    'B) When enterprises use the computation results commercially',
                    'C) Every 24 hours automatically',
                    'D) Never'
                ],
                correct: 'B) When enterprises use the computation results commercially'
            }
        ],
        skills: ['Enterprise Integration', 'API Design', 'Payment Processing', 'Quality Assurance', 'Business Operations'],
        real_world: 'Powers the enterprise side of PoRV ecosystem. Critical for building B2B blockchain services and generating miner royalties.',
        hands_on: 'Students build an enterprise task submission portal with payment processing, result tracking, and usage analytics.'
    },

    14: {
        icon: '💳',
        title: 'Course 14: Merchant Payment Gateway',
        duration: '6 hours',
        modules: 7,
        level: 'Advanced',
        overview: 'Build a complete cryptocurrency payment gateway for merchants. Implement QR code payments, invoicing, KENO/USD conversion, settlement, and a 4-tier merchant incentive program.',
        objectives: [
            'Create merchant registration systems',
            'Generate payment QR codes',
            'Implement invoice management',
            'Build currency conversion engines',
            'Design merchant incentive programs'
        ],
        modules_content: [
            {
                title: 'Payment Gateway Fundamentals',
                lessons: [
                    'Traditional vs. crypto payment gateways',
                    'Merchant pain points',
                    'Transaction flow overview',
                    'Security requirements'
                ]
            },
            {
                title: 'Merchant Registration & API Keys',
                lessons: [
                    'KYB (Know Your Business) verification',
                    'API key generation',
                    'Webhook configuration',
                    'Account management'
                ]
            },
            {
                title: 'QR Code Payment System',
                lessons: [
                    'Payment request encoding',
                    'Dynamic vs. static QR codes',
                    'Mobile wallet integration',
                    'Payment confirmation flow'
                ]
            },
            {
                title: 'Invoice Management',
                lessons: [
                    'Invoice generation',
                    'Payment tracking',
                    'Partial payments',
                    'Expiration handling'
                ]
            },
            {
                title: 'Currency Conversion',
                lessons: [
                    'Real-time KENO/USD exchange rates',
                    'Price oracle integration',
                    'Conversion fee structure',
                    'Settlement in preferred currency'
                ]
            },
            {
                title: 'Merchant Incentive Program',
                lessons: [
                    'Bronze tier (0-$10K): 1% cashback',
                    'Silver tier ($10K-$50K): 1.5% cashback',
                    'Gold tier ($50K-$250K): 2% cashback',
                    'Platinum tier ($250K+): 2.5% cashback + priority support'
                ]
            },
            {
                title: 'Reporting & Analytics',
                lessons: [
                    'Transaction reports',
                    'Revenue analytics',
                    'Chargeback (reversal) tracking',
                    'Tax reporting tools'
                ]
            }
        ],
        quiz: [
            {
                question: 'What is the main advantage of crypto payments for merchants?',
                options: [
                    'A) Complexity',
                    'B) Lower fees (2.5% vs. 3-4% for credit cards) and instant settlement',
                    'C) Government subsidies',
                    'D) Slower transactions'
                ],
                correct: 'B) Lower fees (2.5% vs. 3-4% for credit cards) and instant settlement'
            },
            {
                question: 'How does the merchant incentive program work?',
                options: [
                    'A) All merchants get same rate',
                    'B) Higher transaction volume = higher cashback tier (up to 2.5%)',
                    'C) Random bonuses',
                    'D) No incentives'
                ],
                correct: 'B) Higher transaction volume = higher cashback tier (up to 2.5%)'
            }
        ],
        skills: ['Payment Gateways', 'QR Codes', 'Invoice Systems', 'Currency Conversion', 'Merchant Services'],
        real_world: 'Used by e-commerce stores, retail POS systems, subscription services. Critical for real-world crypto adoption. Competing with Stripe, Square, PayPal.',
        hands_on: 'Students build a complete payment gateway with merchant dashboard, QR code generation, invoice tracking, and incentive calculations.'
    },

    15: {
        icon: '🏦',
        title: 'Course 15: Banking Integration (PayPal/Stripe)',
        duration: '5 hours',
        modules: 6,
        level: 'Advanced',
        overview: 'Bridge traditional finance and cryptocurrency. Integrate PayPal and Stripe for fiat deposits/withdrawals. Implement KYC, AML compliance, and USD ⟷ KENO conversion.',
        objectives: [
            'Integrate PayPal API',
            'Integrate Stripe API',
            'Implement KYC/AML compliance',
            'Build deposit/withdrawal systems',
            'Create conversion engines'
        ],
        modules_content: [
            {
                title: 'Fiat On/Off Ramps',
                lessons: [
                    'Why fiat integration matters',
                    'Regulatory landscape',
                    'Payment processor comparison',
                    'Integration challenges'
                ]
            },
            {
                title: 'PayPal Integration',
                lessons: [
                    'PayPal API setup',
                    'OAuth authentication',
                    'Deposit processing',
                    'Withdrawal implementation',
                    'Fee structure'
                ]
            },
            {
                title: 'Stripe Integration',
                lessons: [
                    'Stripe API setup',
                    'Card payment processing',
                    'ACH bank transfers',
                    'Subscription billing',
                    'Webhook handling'
                ]
            },
            {
                title: 'KYC/AML Compliance',
                lessons: [
                    'Identity verification requirements',
                    'Document collection',
                    'Risk assessment',
                    'Suspicious activity monitoring'
                ]
            },
            {
                title: 'USD ⟷ KENO Conversion',
                lessons: [
                    'Real-time exchange rates',
                    'Liquidity management',
                    'Spread calculation',
                    'Slippage protection'
                ]
            },
            {
                title: 'Security & Fraud Prevention',
                lessons: [
                    'Chargeback prevention',
                    'Fraud detection',
                    'Transaction limits',
                    'Account freezing procedures'
                ]
            }
        ],
        quiz: [
            {
                question: 'Why is KYC (Know Your Customer) required?',
                options: [
                    'A) To collect user data for marketing',
                    'B) Legal compliance to prevent money laundering and fraud',
                    'C) To slow down registration',
                    'D) It\'s optional'
                ],
                correct: 'B) Legal compliance to prevent money laundering and fraud'
            },
            {
                question: 'What is a chargeback?',
                options: [
                    'A) A discount code',
                    'B) When a customer disputes a credit card charge and gets refunded',
                    'C) Mining reward',
                    'D) Transaction fee'
                ],
                correct: 'B) When a customer disputes a credit card charge and gets refunded'
            }
        ],
        skills: ['PayPal API', 'Stripe API', 'KYC/AML Compliance', 'Fiat Integration', 'Payment Processing'],
        real_world: 'Critical for exchanges, wallets, and any crypto platform serving mainstream users. Required for regulatory compliance.',
        hands_on: 'Students integrate PayPal and Stripe, implement KYC flows, and build complete deposit/withdrawal systems.'
    },

    16: {
        icon: '📈',
        title: 'Course 16: Exchange Trading Platform',
        duration: '7 hours',
        modules: 8,
        level: 'Expert',
        overview: 'Build a complete cryptocurrency exchange. Implement order books for KENO/USD, KENO/BTC, KENO/ETH. Create market and limit orders, match trades, maintain trade history, and understand exchange security architecture.',
        objectives: [
            'Design exchange architecture',
            'Implement order book engines',
            'Create order matching algorithms',
            'Build trading interfaces',
            'Ensure exchange security'
        ],
        modules_content: [
            {
                title: 'Exchange Fundamentals',
                lessons: [
                    'Centralized vs. decentralized exchanges',
                    'Exchange business model',
                    'Trading pairs explained',
                    'Liquidity importance'
                ]
            },
            {
                title: 'Order Book Architecture',
                lessons: [
                    'Bid vs. ask orders',
                    'Order book data structure',
                    'Price-time priority',
                    'Spread calculation'
                ]
            },
            {
                title: 'Order Types',
                lessons: [
                    'Market orders',
                    'Limit orders',
                    'Stop-loss orders',
                    'Iceberg orders',
                    'Fill-or-kill orders'
                ]
            },
            {
                title: 'Order Matching Engine',
                lessons: [
                    'Matching algorithm design',
                    'Price discovery',
                    'Partial fills',
                    'Order execution optimization'
                ]
            },
            {
                title: 'Trading Pairs',
                lessons: [
                    'KENO/USD implementation',
                    'KENO/BTC cross-chain trading',
                    'KENO/ETH integration',
                    'Adding new trading pairs'
                ]
            },
            {
                title: 'Trade History & Analytics',
                lessons: [
                    'Trade recording',
                    'Price charts (OHLCV)',
                    'Volume analysis',
                    'User portfolio tracking'
                ]
            },
            {
                title: 'Exchange Security',
                lessons: [
                    'Hot wallet vs. cold storage',
                    'Multi-signature withdrawals',
                    'API rate limiting',
                    'Front-running prevention',
                    'Wash trading detection'
                ]
            },
            {
                title: 'Fee Structure & Economics',
                lessons: [
                    'Maker vs. taker fees',
                    'Volume-based discounts',
                    'Fee distribution',
                    'Revenue optimization'
                ]
            }
        ],
        quiz: [
            {
                question: 'What is the difference between a market order and a limit order?',
                options: [
                    'A) No difference',
                    'B) Market orders execute immediately at current price; limit orders wait for specific price',
                    'C) Market orders cost more',
                    'D) Limit orders are faster'
                ],
                correct: 'B) Market orders execute immediately at current price; limit orders wait for specific price'
            },
            {
                question: 'What is the bid-ask spread?',
                options: [
                    'A) Transaction fee',
                    'B) Difference between highest buy order and lowest sell order',
                    'C) Mining reward',
                    'D) Wallet balance'
                ],
                correct: 'B) Difference between highest buy order and lowest sell order'
            },
            {
                question: 'Why use cold storage for exchange funds?',
                options: [
                    'A) It\'s faster',
                    'B) Security - keeps majority of funds offline and unhackable',
                    'C) It\'s cheaper',
                    'D) Government requirement'
                ],
                correct: 'B) Security - keeps majority of funds offline and unhackable'
            }
        ],
        skills: ['Order Books', 'Trading Engines', 'Market Mechanics', 'DEX Architecture', 'Exchange Security'],
        real_world: 'Powers Binance, Coinbase, Kraken, and all crypto exchanges. Critical infrastructure for crypto trading. Multi-billion dollar industry.',
        hands_on: 'Students build a complete exchange with order books, matching engine, multiple trading pairs, and security features.'
    },

    17: {
        icon: '💰',
        title: 'Course 17: Financial Literacy & Investment Foundations',
        duration: '6 hours',
        modules: 7,
        level: 'Beginner',
        overview: 'Master personal finance AND investment fundamentals in one comprehensive course. Learn budgeting (50/30/20 rule), emergency funds, debt management strategies (avalanche vs snowball), compound growth with Rule of 72, dollar cost averaging, and portfolio diversification.',
        objectives: [
            'Create and maintain effective budgets using the 50/30/20 rule',
            'Build emergency savings funds (3-6 months expenses)',
            'Develop debt elimination strategies (avalanche vs snowball)',
            'Master compound interest and the Rule of 72',
            'Implement dollar-cost averaging for consistent investing'
        ],
        modules_content: [
            {
                title: 'Money Mindset & Financial Literacy',
                lessons: [
                    'Why most people struggle with money',
                    'The psychology of poverty vs. wealth',
                    'Common financial myths debunked',
                    'Taking control of your financial future'
                ]
            },
            {
                title: 'Budgeting Fundamentals',
                lessons: [
                    '50/30/20 rule (needs, wants, savings)',
                    'Zero-based budgeting',
                    'Tracking income and expenses',
                    'Budget apps and tools'
                ]
            },
            {
                title: 'Emergency Funds & Debt Management',
                lessons: [
                    'Why you need 3-6 months expenses saved',
                    'Good debt vs. bad debt',
                    'Debt avalanche vs. debt snowball methods',
                    'Avoiding predatory loans'
                ]
            },
            {
                title: 'Compound Interest: The 8th Wonder',
                lessons: [
                    'Simple vs. compound interest',
                    'The Rule of 72 (doubling time)',
                    'Real calculation: $100/month for 30 years at 8% = $150,000',
                    'Why starting early matters (time > amount)'
                ]
            },
            {
                title: 'Investment Vehicles',
                lessons: [
                    'Stocks: ownership in companies',
                    'Bonds: lending to governments/corporations',
                    'Index funds: diversification made easy',
                    'Cryptocurrency: digital assets',
                    'Risk vs. return spectrum'
                ]
            },
            {
                title: 'Dollar-Cost Averaging (DCA)',
                lessons: [
                    'Investing fixed amounts regularly',
                    'Why DCA beats market timing',
                    'Automatic investment plans',
                    'Psychological benefits of consistency'
                ]
            },
            {
                title: 'Portfolio Diversification',
                lessons: [
                    '"Don\'t put all eggs in one basket"',
                    'Asset allocation by age',
                    'Rebalancing strategies',
                    'Risk tolerance assessment'
                ]
            }
        ],
        quiz: [
            {
                question: 'What is the 50/30/20 budgeting rule?',
                options: [
                    'A) 50% entertainment, 30% savings, 20% bills',
                    'B) 50% needs, 30% wants, 20% savings/debt',
                    'C) 50% rent, 30% food, 20% other',
                    'D) Random percentages'
                ],
                correct: 'B) 50% needs, 30% wants, 20% savings/debt'
            },
            {
                question: 'Using the Rule of 72, how long does it take to double money at 8% annual return?',
                options: [
                    'A) 4 years',
                    'B) 9 years (72 ÷ 8 = 9)',
                    'C) 12 years',
                    'D) 20 years'
                ],
                correct: 'B) 9 years (72 ÷ 8 = 9)'
            },
            {
                question: 'What is dollar-cost averaging?',
                options: [
                    'A) Trying to time the market',
                    'B) Investing a fixed amount regularly regardless of price',
                    'C) Only buying when prices are low',
                    'D) Averaging your expenses'
                ],
                correct: 'B) Investing a fixed amount regularly regardless of price'
            }
        ],
        skills: ['Budgeting', 'Debt Management', 'Compound Growth', 'Dollar-Cost Averaging', 'Diversification'],
        real_world: 'Essential life skills for everyone. Build the complete foundation for lifelong financial success: from budgeting your first paycheck to building a diversified investment portfolio.',
        hands_on: 'Students create personal budgets, calculate compound growth projections, design 30-year investment plans, and build diversified portfolio allocations.',
        wealth_builder_reward: '250 KENO upon completion + progress toward Bronze RVT NFT'
    },

    18: {
        icon: '⚡',
        title: 'Course 18: Flash Arbitrage Loans (FAL)',
        duration: '6 hours',
        modules: 8,
        level: 'Intermediate',
        overview: 'Master Kenostod\'s revolutionary Flash Arbitrage Loan system. Understand arbitrage mechanics, execute flash loans across exchanges, build reputation tiers (Bronze to Diamond), calculate profit margins, and manage risk. Real case studies with actual profit calculations.',
        objectives: [
            'Understand arbitrage fundamentals and price discrepancies',
            'Master Flash Arbitrage Loan mechanics and execution',
            'Build reputation through successful trades (Bronze→Diamond)',
            'Calculate profit margins and break-even points',
            'Implement risk management strategies'
        ],
        modules_content: [
            {
                title: 'Arbitrage Fundamentals',
                lessons: [
                    'What is arbitrage? Price differences across markets',
                    'Why price discrepancies exist (liquidity, speed, fees)',
                    'Traditional arbitrage vs. crypto arbitrage',
                    'Cross-exchange opportunities in real-time'
                ]
            },
            {
                title: 'Flash Loans Explained',
                lessons: [
                    'What are flash loans? Borrow and repay in same transaction',
                    'Zero collateral requirement - how it works',
                    'Why flash loans exist (atomic transactions)',
                    'Kenostod FAL vs. DeFi flash loans'
                ]
            },
            {
                title: 'FAL Mechanics & Execution',
                lessons: [
                    'Requesting a Flash Arbitrage Loan',
                    'Loan limits based on reputation tier',
                    'Execution window and repayment requirements',
                    'Platform fees and profit distribution'
                ]
            },
            {
                title: 'Reputation Tiers & Loan Limits',
                lessons: [
                    'Bronze Tier: 10 trades = 1,500 KENO limit',
                    'Silver Tier: 50 trades = 2,000 KENO limit',
                    'Gold Tier: 200 trades = 3,000 KENO limit',
                    'Platinum Tier: 500 trades = 5,000 KENO limit',
                    'Diamond Tier: 1,000 trades = 10,000 KENO limit'
                ]
            },
            {
                title: 'Profit Calculation & Break-Even',
                lessons: [
                    'Calculating price spread percentage',
                    'Fee structure: platform fee + gas costs',
                    'Break-even analysis for each trade',
                    'Case study: 2% spread on 1,000 KENO trade'
                ]
            },
            {
                title: 'Risk Management',
                lessons: [
                    'Slippage: when prices move during execution',
                    'Liquidity risks on smaller exchanges',
                    'Failed transaction handling',
                    'Position sizing and exposure limits'
                ]
            },
            {
                title: 'Real Case Studies',
                lessons: [
                    'Case Study 1: Binance-Coinbase spread capture',
                    'Case Study 2: KuCoin arbitrage opportunity',
                    'Case Study 3: Failed trade analysis - what went wrong',
                    'Lessons from top FAL traders'
                ]
            },
            {
                title: 'Advanced FAL Strategies',
                lessons: [
                    'Multi-hop arbitrage (A→B→C→A)',
                    'Timing strategies: when opportunities peak',
                    'Automation and bot considerations',
                    'Scaling from Bronze to Diamond'
                ]
            }
        ],
        quiz: [
            {
                question: 'What is a Flash Arbitrage Loan?',
                options: [
                    'A) A traditional bank loan',
                    'B) A loan that must be borrowed and repaid in the same transaction',
                    'C) A mortgage for buying houses',
                    'D) A credit card'
                ],
                correct: 'B) A loan that must be borrowed and repaid in the same transaction'
            },
            {
                question: 'What is the Diamond Tier loan limit after 1,000 successful trades?',
                options: [
                    'A) 1,500 KENO',
                    'B) 3,000 KENO',
                    'C) 5,000 KENO',
                    'D) 10,000 KENO'
                ],
                correct: 'D) 10,000 KENO'
            },
            {
                question: 'Why do price differences exist between exchanges?',
                options: [
                    'A) Exchanges are broken',
                    'B) Differences in liquidity, trading volume, and price update speed',
                    'C) Government regulations',
                    'D) Price differences don\'t exist'
                ],
                correct: 'B) Differences in liquidity, trading volume, and price update speed'
            }
        ],
        skills: ['Flash Loans', 'Arbitrage Trading', 'Risk Management', 'Profit Calculation', 'Reputation Building'],
        real_world: 'Transform KENO holdings into active income. Learn to spot price differences across exchanges and capture profits in single transactions. Graduates execute real FAL trades earning consistent returns.',
        hands_on: 'Students analyze real arbitrage opportunities, calculate profit margins, simulate FAL trades, and build trading strategies based on market data.',
        wealth_builder_reward: '250 KENO upon completion + progress toward Silver RVT NFT'
    },

    19: {
        icon: '🌊',
        title: 'Course 19: Flash Arbitrage Loan Pools (FALP)',
        duration: '5 hours',
        modules: 8,
        level: 'Intermediate',
        overview: 'Master passive income through liquidity pools. Understand pool mechanics, risk tiers (Conservative to Aggressive), lock period bonuses, profit distribution formulas, and pool management. Learn to evaluate pools and maximize yields safely.',
        objectives: [
            'Understand liquidity pool fundamentals and how they work',
            'Evaluate pools based on risk tiers and historical performance',
            'Master lock period bonuses (1.1x to 2.0x multipliers)',
            'Calculate expected returns and profit distribution',
            'Manage pool contributions and withdrawals strategically'
        ],
        modules_content: [
            {
                title: 'Liquidity Pools Fundamentals',
                lessons: [
                    'What are liquidity pools?',
                    'How pools enable flash loans for traders',
                    'Pool contributors vs. borrowers',
                    'Why passive income beats active trading for most'
                ]
            },
            {
                title: 'FALP Pool Mechanics',
                lessons: [
                    'Depositing KENO into pools',
                    'How your contribution funds arbitrage trades',
                    'Automatic profit distribution',
                    'Pool utilization rates and capacity'
                ]
            },
            {
                title: 'Risk Tiers Explained',
                lessons: [
                    'Conservative pools: Lower risk, lower returns',
                    'Balanced pools: Medium risk, medium returns',
                    'Aggressive pools: Higher risk, higher returns',
                    'Matching your risk tolerance to pool choice'
                ]
            },
            {
                title: 'Lock Period Bonuses',
                lessons: [
                    '30-day lock: 1.1x multiplier on profits',
                    '60-day lock: 1.2x multiplier on profits',
                    '90-day lock: 1.35x multiplier on profits',
                    '180-day lock: 1.5x multiplier on profits',
                    '365-day lock: 2.0x multiplier on profits'
                ]
            },
            {
                title: 'Profit Distribution Formula',
                lessons: [
                    'Your Share = (Your Contribution ÷ Total Pool) × Profits × Lock Bonus',
                    'When distributions occur (daily/weekly)',
                    'Compound earnings by reinvesting',
                    'Real examples with actual numbers'
                ]
            },
            {
                title: 'Pool Evaluation & Selection',
                lessons: [
                    'Historical performance metrics',
                    'Pool manager reputation',
                    'Total Value Locked (TVL) analysis',
                    'Diversifying across multiple pools'
                ]
            },
            {
                title: 'Managing Your Pool Position',
                lessons: [
                    'When to increase contributions',
                    'When to withdraw (after lock period)',
                    'Rebalancing between pools',
                    'Tax considerations for pool income'
                ]
            },
            {
                title: 'Advanced FALP Strategies',
                lessons: [
                    'Laddering lock periods for flexibility',
                    'Combining FAL trading with FALP pooling',
                    'Creating your own pool (for advanced users)',
                    'Pool governance and voting rights'
                ]
            }
        ],
        quiz: [
            {
                question: 'What is the profit multiplier for a 365-day lock period?',
                options: [
                    'A) 1.1x',
                    'B) 1.5x',
                    'C) 2.0x',
                    'D) 3.0x'
                ],
                correct: 'C) 2.0x'
            },
            {
                question: 'How is your share of pool profits calculated?',
                options: [
                    'A) Everyone gets equal amounts',
                    'B) (Your Contribution ÷ Total Pool) × Profits × Lock Bonus',
                    'C) First come, first served',
                    'D) Random distribution'
                ],
                correct: 'B) (Your Contribution ÷ Total Pool) × Profits × Lock Bonus'
            },
            {
                question: 'What type of pool is best for someone who can\'t afford to lose money?',
                options: [
                    'A) Aggressive pool for maximum returns',
                    'B) Conservative pool with lower risk',
                    'C) The newest pool available',
                    'D) All pools are the same risk'
                ],
                correct: 'B) Conservative pool with lower risk'
            }
        ],
        skills: ['Liquidity Pools', 'Passive Income', 'Risk Assessment', 'Yield Optimization', 'Pool Management'],
        real_world: 'Earn passive income without active trading. Deposit KENO into pools and earn a share of arbitrage profits generated by other traders. Lock period bonuses up to 2x multiplier for patient investors.',
        hands_on: 'Students evaluate sample pools, calculate expected returns with different lock periods, design pool contribution strategies, and create diversified pool portfolios.',
        wealth_builder_reward: '250 KENO upon completion + progress toward Silver RVT NFT'
    },

    20: {
        icon: '💎',
        title: 'Course 20: Wealth Building & Asset Allocation',
        duration: '5 hours',
        modules: 6,
        level: 'Advanced',
        overview: 'Advanced wealth accumulation strategies. Learn asset classes, strategic allocation based on age and goals, portfolio rebalancing techniques, KENO deployment strategies, and RVT income building across tiers for perpetual royalty income.',
        objectives: [
            'Understand all major asset classes and their roles',
            'Design age-appropriate asset allocation strategies',
            'Master portfolio rebalancing techniques',
            'Deploy KENO strategically across FAL, FALP, and holding',
            'Build RVT income through tier progression'
        ],
        modules_content: [
            {
                title: 'Asset Classes Overview',
                lessons: [
                    'Stocks: Growth engine of portfolios',
                    'Bonds: Stability and income',
                    'Real estate: Tangible assets and cash flow',
                    'Crypto: High-risk, high-reward digital assets',
                    'KENO: Knowledge Utility Token as core holding'
                ]
            },
            {
                title: 'Strategic Allocation by Age',
                lessons: [
                    '20s: Aggressive growth (80% stocks, 20% crypto)',
                    '30s-40s: Balanced growth (60% stocks, 20% bonds, 20% alternatives)',
                    '50s+: Capital preservation (40% stocks, 40% bonds, 20% alternatives)',
                    'The 120 minus age rule',
                    'Adjusting for personal risk tolerance'
                ]
            },
            {
                title: 'Portfolio Rebalancing',
                lessons: [
                    'Why portfolios drift over time',
                    'Calendar rebalancing (quarterly, annually)',
                    'Threshold rebalancing (when allocation drifts 5%+)',
                    'Tax-efficient rebalancing strategies',
                    'Avoiding emotional decisions'
                ]
            },
            {
                title: 'KENO Deployment Strategies',
                lessons: [
                    'Holding: Long-term appreciation play',
                    'FAL Trading: Active income generation',
                    'FALP Pooling: Passive income stream',
                    'Optimal split: 40% hold, 30% FAL, 30% FALP',
                    'Adjusting based on market conditions'
                ]
            },
            {
                title: 'RVT Income Building',
                lessons: [
                    'Bronze RVT: Complete courses 1-5',
                    'Silver RVT: Complete courses 6-10',
                    'Gold RVT: Complete courses 11-15',
                    'Platinum RVT: Complete courses 16-18',
                    'Diamond RVT: Complete all 21 courses',
                    'Perpetual royalty income from RVT tiers'
                ]
            },
            {
                title: 'Wealth Milestone Planning',
                lessons: [
                    'First $10K: Emergency fund complete',
                    'First $100K: Wealth building accelerates',
                    'First $500K: Financial independence in sight',
                    '$1M+: True wealth and options',
                    'Creating your personal wealth roadmap'
                ]
            }
        ],
        quiz: [
            {
                question: 'What is the recommended KENO deployment split in this course?',
                options: [
                    'A) 100% holding',
                    'B) 100% FAL trading',
                    'C) 40% hold, 30% FAL, 30% FALP',
                    'D) 50% FAL, 50% FALP'
                ],
                correct: 'C) 40% hold, 30% FAL, 30% FALP'
            },
            {
                question: 'What is threshold rebalancing?',
                options: [
                    'A) Rebalancing every day',
                    'B) Rebalancing when allocation drifts beyond a set percentage (e.g., 5%)',
                    'C) Never rebalancing',
                    'D) Only rebalancing when you\'re losing money'
                ],
                correct: 'B) Rebalancing when allocation drifts beyond a set percentage (e.g., 5%)'
            },
            {
                question: 'Which RVT tier do you achieve after completing all 21 courses?',
                options: [
                    'A) Bronze RVT',
                    'B) Gold RVT',
                    'C) Platinum RVT',
                    'D) Diamond RVT'
                ],
                correct: 'D) Diamond RVT'
            }
        ],
        skills: ['Asset Allocation', 'Portfolio Rebalancing', 'KENO Strategies', 'RVT Income', 'Wealth Planning'],
        real_world: 'Bridge the wealth gap. Build $500K-$2M+ net worth through strategic asset allocation. Integrate KENO and RVTs into a comprehensive wealth-building portfolio.',
        hands_on: 'Students design personalized asset allocations, create rebalancing schedules, plan KENO deployment strategies, and map RVT progression paths.',
        wealth_builder_reward: '250 KENO upon completion + progress toward Gold RVT NFT'
    },

    21: {
        icon: '🏛️',
        title: 'Course 21: Generational Wealth & Economic Empowerment',
        duration: '5 hours',
        modules: 7,
        level: 'Advanced',
        overview: 'Create wealth that lasts for generations AND make global impact. Learn the 3-generation wealth problem, estate planning, trusts, crypto inheritance via social recovery, financial inclusion through blockchain, and the Kenostod mission.',
        objectives: [
            'Understand why 90% of families lose wealth by 3rd generation',
            'Create estate plans with crypto-specific considerations',
            'Implement social recovery for crypto inheritance',
            'Leverage blockchain for financial inclusion',
            'Create economic empowerment strategies'
        ],
        modules_content: [
            {
                title: 'Global Poverty Reality',
                lessons: [
                    '700+ million people live on <$2/day',
                    'Poverty traps: lack of education, capital, opportunity',
                    'How technology is changing the equation',
                    'Success stories: villages to prosperity',
                    'Your potential impact as a blockchain developer'
                ]
            },
            {
                title: 'Financial Inclusion',
                lessons: [
                    '1.7 billion unbanked adults globally',
                    'Mobile banking revolution in Africa/Asia',
                    'Cryptocurrency as banking alternative',
                    'Remittance costs: $30B annually lost to fees',
                    'Blockchain reducing remittance costs from 7% to <1%'
                ]
            },
            {
                title: 'Microfinance & Community Lending',
                lessons: [
                    'Muhammad Yunus and Grameen Bank',
                    'Small loans, massive impact',
                    'Peer-to-peer lending platforms',
                    'Blockchain-based microfinance',
                    'Case studies: $100 loan → thriving business'
                ]
            },
            {
                title: 'Social Entrepreneurship',
                lessons: [
                    'Profit + purpose businesses',
                    'B-Corporations and benefit corporations',
                    'Creating jobs in underserved communities',
                    'Fair trade and ethical business',
                    'Measuring social impact (not just profit)'
                ]
            },
            {
                title: 'Blockchain for Good',
                lessons: [
                    'Transparent charity and aid distribution',
                    'Identity systems for the undocumented',
                    'Land registry for property rights',
                    'Supply chain transparency',
                    'Decentralized education credentials',
                    'How Kenostod Wealth Builder Program helps globally'
                ]
            },
            {
                title: 'Remote Work & Global Opportunity',
                lessons: [
                    'Geographic arbitrage: earn USD, live anywhere',
                    'Blockchain development: $50K-$150K+ salaries',
                    'Freelance platforms connecting global talent',
                    'Real examples: $200/month → $4,000/month transformations',
                    'Building remote career from zero resources'
                ]
            },
            {
                title: 'Community Impact Blueprint',
                lessons: [
                    'Teaching blockchain in your community',
                    'Creating local blockchain employment',
                    'Establishing crypto remittance corridors',
                    'Building local investment groups',
                    'Scaling impact: one person → 100 people',
                    'Your personal poverty reduction plan'
                ]
            }
        ],
        quiz: [
            {
                question: 'How many people globally are unbanked (no access to banking)?',
                options: [
                    'A) 10 million',
                    'B) 100 million',
                    'C) 1.7 billion',
                    'D) 5 billion'
                ],
                correct: 'C) 1.7 billion'
            },
            {
                question: 'What is microfinance?',
                options: [
                    'A) Small stock investments',
                    'B) Providing small loans to poor entrepreneurs to start businesses',
                    'C) Cryptocurrency mining',
                    'D) Budgeting apps'
                ],
                correct: 'B) Providing small loans to poor entrepreneurs to start businesses'
            },
            {
                question: 'How can blockchain reduce remittance costs?',
                options: [
                    'A) It can\'t',
                    'B) Eliminates intermediary banks, reducing fees from 7% to <1%',
                    'C) Government subsidies',
                    'D) Sending physical cash'
                ],
                correct: 'B) Eliminates intermediary banks, reducing fees from 7% to <1%'
            }
        ],
        skills: ['Social Impact', 'Microfinance', 'Community Development', 'Financial Inclusion', 'Global Economics'],
        real_world: 'Turn education into impact. Graduates use blockchain skills to earn remote income, create jobs, educate their communities, and help others escape poverty. Real transformation happening worldwide.',
        hands_on: 'Students design community impact projects, calculate remittance savings, plan microfinance programs, and create personal poverty reduction strategies.',
        wealth_builder_reward: '250 KENO upon completion + Platinum RVT NFT unlocked (2% perpetual PoRV royalties)'
    }
};

// Navigation rendering
function checkAnswer(el) {
    const questionDiv = el.closest('.quiz-question');
    if (questionDiv.classList.contains('answered')) return;
    questionDiv.classList.add('answered');
    const correctAnswer = atob(questionDiv.dataset.correct);
    const selectedText = el.textContent.trim();
    if (selectedText === correctAnswer) {
        el.classList.add('selected-correct');
    } else {
        el.classList.add('selected-wrong');
        const allOptions = questionDiv.querySelectorAll('li');
        allOptions.forEach(opt => {
            if (opt.textContent.trim() === correctAnswer) {
                opt.classList.add('reveal-correct');
            }
        });
    }
}

function renderCourseNav() {
    const blockchainList = document.getElementById('blockchain-courses');
    const financeList = document.getElementById('finance-courses');
    
    if (!blockchainList || !financeList) return;
    
    blockchainList.innerHTML = '';
    financeList.innerHTML = '';
    
    // Blockchain courses 1-16
    for (let i = 1; i <= 16; i++) {
        const course = courses[i];
        if (!course) continue;
        const li = document.createElement('li');
        const button = document.createElement('button');
        button.id = `nav-course-${i}`;
        button.innerHTML = `<span class="icon">${course.icon}</span><span>Course ${i}</span>`;
        button.onclick = () => loadCourse(i);
        if (i === 1) button.classList.add('active');
        li.appendChild(button);
        blockchainList.appendChild(li);
    }
    
    // Financial literacy courses 17-21
    for (let i = 17; i <= 21; i++) {
        const course = courses[i];
        if (!course) continue;
        const li = document.createElement('li');
        const button = document.createElement('button');
        button.id = `nav-course-${i}`;
        button.innerHTML = `<span class="icon">${course.icon}</span><span>Course ${i}</span>`;
        button.onclick = () => loadCourse(i);
        li.appendChild(button);
        financeList.appendChild(li);
    }
}

// Function to load course content
function loadCourse(courseId) {
    const course = courses[courseId];
    if (!course) return;

    const contentDiv = document.getElementById('course-content');
    if (!contentDiv) return;
    
    // Update active state
    document.querySelectorAll('.course-nav button').forEach(btn => btn.classList.remove('active'));
    
    // Find the button for this course
    const navBtn = document.getElementById(`nav-course-${courseId}`);
    if (navBtn) {
        navBtn.classList.add('active');
    } else {
        // Fallback for initial load if ID isn't set yet
        const allBtns = document.querySelectorAll('.course-nav button');
        allBtns.forEach(btn => {
            if (btn.textContent.includes(`Course ${courseId}`)) {
                btn.classList.add('active');
            }
        });
    }
    
    // Render course content
    let html = `
        <div class="course-header-section">
            <h2><span class="icon">${course.icon}</span> ${course.title}</h2>
            <div class="course-meta">
                <div class="meta-item">⏱️ ${course.duration}</div>
                <div class="meta-item">📚 ${course.modules} Modules</div>
                <div class="meta-item">📊 ${course.level}</div>
            </div>
        </div>

        <div class="section-block">
            <h3>📖 Course Overview</h3>
            <p>${course.overview}</p>
        </div>

        <div class="section-block">
            <h3>🎯 Learning Objectives</h3>
            <ul>
                ${course.objectives.map(obj => `<li>${obj}</li>`).join('')}
            </ul>
        </div>

        <div class="section-block">
            <h3>📚 Course Modules</h3>
            <div class="module-list">
                ${course.modules_content.map(module => `
                    <div class="module-item">
                        <h4>${module.title}</h4>
                        <ul>
                            ${module.lessons.map(lesson => `<li>${lesson}</li>`).join('')}
                        </ul>
                    </div>
                `).join('')}
            </div>
        </div>

        <div class="section-block">
            <h3>✅ Knowledge Check Quiz</h3>
            ${course.quiz.map((q, idx) => `
                <div class="quiz-question" data-correct="${btoa(q.correct)}">
                    <strong>Question ${idx + 1}: ${q.question}</strong>
                    <ul>
                        ${q.options.map(opt => `
                            <li onclick="checkAnswer(this)">${opt}</li>
                        `).join('')}
                    </ul>
                </div>
            `).join('')}
        </div>

        <div class="section-block">
            <h3>💼 Skills You'll Master</h3>
            <div class="skills-grid">
                ${course.skills.map(skill => `
                    <div class="skill-card">${skill}</div>
                `).join('')}
            </div>
        </div>

        <div class="info-box">
            <strong>🌍 Real-World Application</strong>
            <p>${course.real_world}</p>
        </div>

        <div class="highlight-box">
            <strong>🛠️ Hands-On Practice</strong>
            <p>${course.hands_on}</p>
        </div>
    `;

    const premium = premiumContent[courseId];
    if (premium) {
        if (isSubscribed()) {
            html += `
                <div style="margin-top: 32px; padding-top: 24px; border-top: 3px solid #6366f1;">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
                        <span style="background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; padding: 4px 14px; border-radius: 20px; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.05em;">PREMIUM</span>
                        <span style="color: #6366f1; font-weight: 600; font-size: 1.1rem;">Extended Course Content</span>
                    </div>

                    <div class="section-block" style="background: linear-gradient(135deg, #eef2ff, #e0e7ff); border: 1px solid #c7d2fe;">
                        <h3 style="color: #4338ca;">🔬 Deep Dive Topics</h3>
                        ${premium.deep_dive.map(topic => `
                            <div style="background: white; padding: 16px; border-radius: 8px; margin-bottom: 12px; border-left: 4px solid #6366f1;">
                                <h4 style="color: #4338ca; margin-bottom: 8px; font-size: 1rem;">${topic.title}</h4>
                                <p style="color: #4b5563; line-height: 1.6; margin: 0;">${topic.content}</p>
                            </div>
                        `).join('')}
                    </div>

                    <div class="section-block" style="background: linear-gradient(135deg, #f0fdf4, #dcfce7); border: 1px solid #bbf7d0;">
                        <h3 style="color: #166534;">💻 Coding Exercises</h3>
                        <div style="display: grid; gap: 8px;">
                            ${premium.code_exercises.map((ex, i) => `
                                <div style="background: white; padding: 12px 16px; border-radius: 8px; border-left: 4px solid #22c55e; display: flex; align-items: center; gap: 12px;">
                                    <span style="background: #22c55e; color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: 700; flex-shrink: 0;">${i + 1}</span>
                                    <span style="color: #374151;">${ex}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <div class="section-block" style="background: linear-gradient(135deg, #fff7ed, #ffedd5); border: 1px solid #fed7aa;">
                        <h3 style="color: #9a3412;">📚 Premium Resources</h3>
                        <div style="display: grid; gap: 8px;">
                            ${premium.resources.map(res => `
                                <div style="background: white; padding: 12px 16px; border-radius: 8px; display: flex; align-items: center; gap: 10px;">
                                    <span style="color: #ea580c; font-size: 1.2rem;">📄</span>
                                    <span style="color: #374151;">${res}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `;
        } else {
            html += `
                <div style="margin-top: 32px; padding: 24px; background: linear-gradient(135deg, #f8fafc, #f1f5f9); border: 2px dashed #94a3b8; border-radius: 12px; text-align: center;">
                    <div style="font-size: 2.5rem; margin-bottom: 12px;">🔒</div>
                    <h3 style="color: #334155; margin-bottom: 8px;">Premium Content Locked</h3>
                    <p style="color: #64748b; margin-bottom: 8px;">This course includes <strong>${premium.deep_dive.length} deep-dive topics</strong>, <strong>${premium.code_exercises.length} hands-on coding exercises</strong>, and <strong>${premium.resources.length} premium resources</strong>.</p>
                    <p style="color: #64748b; margin-bottom: 16px;">Subscribe to unlock the full extended curriculum across all 21 courses.</p>
                    <a href="/#subscriptions" style="display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 700; transition: all 0.2s;">Subscribe Now</a>
                </div>
            `;
        }
    }

    // Add Wealth Builder reward info for courses 17-21
    if (courseId >= 17 && course.wealth_builder_reward) {
        html += `
            <div class="highlight-box">
                <strong>💰 Wealth Builder Reward</strong>
                <p>${course.wealth_builder_reward}</p>
            </div>
        `;
    }

    // Add course completion section
    html += `
        <div class="course-completion-section">
            <h3 style="margin-bottom: 24px; color: #1f2937;">Ready to Complete This Course?</h3>
            <button class="completion-button" onclick="completeCourse(${courseId})">
                ✅ Mark Course Complete & Earn 250 KENO
            </button>
        </div>
    `;

    contentDiv.innerHTML = html;
    
    // Show graduate club section for all courses in backoffice view
    const gradSection = document.getElementById('graduate-club-section');
    if (gradSection) gradSection.style.display = 'block';
    
    // Scroll to top of content
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Validate wallet address format
function isValidWalletAddress(address) {
    if (!address || typeof address !== 'string') return false;
    // Valid BSC/ETH wallet: starts with 0x and is 42 characters
    if (address.startsWith('0x') && address.length === 42) return true;
    // Kenostod simulator wallet: starts with 04 and is very long (educational only)
    if (address.startsWith('04') && address.length > 100) return true;
    return false;
}

// KENO contract address - NOT a valid student wallet
const KENO_CONTRACT_ADDRESS = '0x65791e0b5cbac5f40c76cde31bf4f074d982fd0e';

// Complete course and show KENO reward
async function completeCourse(courseId) {
    const course = courses[courseId];
    
    // Get user wallet address from localStorage or app state
    let walletAddress = localStorage.getItem('userWalletAddress') || localStorage.getItem('walletAddress');
    const userEmail = localStorage.getItem('userEmail') || '';
    
    // Validate wallet address before sending
    if (walletAddress) {
        const normalizedWallet = walletAddress.toLowerCase();
        
        // Check if user accidentally used the KENO contract address
        if (normalizedWallet === KENO_CONTRACT_ADDRESS) {
            alert('⚠️ Wrong wallet address!\n\nYou entered the KENO token contract address, not your personal wallet.\n\nPlease use your MetaMask wallet address (the one shown at the TOP of MetaMask app, NOT the contract you add to see your token balance).');
            localStorage.removeItem('userWalletAddress');
            localStorage.removeItem('walletAddress');
            walletAddress = null;
        }
        // Check if wallet format is valid
        else if (!isValidWalletAddress(walletAddress)) {
            alert('⚠️ Invalid wallet address format!\n\nYour MetaMask wallet should:\n- Start with "0x"\n- Be exactly 42 characters long\n\nPlease reconnect your wallet.');
            walletAddress = null;
        }
    }
    
    // If user has valid wallet, credit KENO to their account
    if (walletAddress) {
        try {
            const response = await fetch('/api/wealth/rewards/course-complete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    walletAddress: walletAddress,
                    email: userEmail,
                    courseName: course.title,
                    courseId: courseId
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                console.log('KENO reward credited:', result.message);
            } else {
                console.warn('Reward not credited:', result.error);
                // Show user-friendly error if it's a duplicate or known issue
                if (result.error && result.error.includes('already completed')) {
                    alert('ℹ️ You already earned the KENO reward for this course. Each course can only be completed once.');
                } else if (result.error && result.error.includes('contract address')) {
                    alert('⚠️ ' + result.error);
                    localStorage.removeItem('userWalletAddress');
                    localStorage.removeItem('walletAddress');
                }
            }
        } catch (error) {
            console.error('Error crediting KENO reward:', error);
        }
    } else {
        // Prompt user to connect wallet for real rewards
        console.log('No wallet connected - KENO reward saved locally only');
    }
    
    // Show custom notification (pass wallet status)
    showCourseCompletionNotification(courseId, course.title, !!walletAddress);
}

// Show course completion notification with KENO reward
function showCourseCompletionNotification(courseId, courseTitle, hasWallet = false) {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.6);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;
    
    const box = document.createElement('div');
    box.style.cssText = `
        background: white;
        padding: 40px;
        border-radius: 16px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        max-width: 500px;
        text-align: center;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        animation: slideUp 0.3s ease-out;
    `;
    
    // Add animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideUp {
            from {
                opacity: 0;
                transform: translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
        }
        .keno-token {
            animation: pulse 0.6s ease-in-out;
        }
    `;
    document.head.appendChild(style);
    
    const titleEl = document.createElement('div');
    titleEl.style.cssText = `
        font-size: 28px;
        font-weight: 800;
        margin-bottom: 16px;
        color: #1f2937;
    `;
    titleEl.textContent = '🎉 Course Completed!';
    
    const courseNameEl = document.createElement('div');
    courseNameEl.style.cssText = `
        font-size: 16px;
        color: #6b7280;
        margin-bottom: 24px;
        font-weight: 500;
    `;
    courseNameEl.textContent = courseTitle;
    
    const rewardBox = document.createElement('div');
    rewardBox.style.cssText = `
        background: linear-gradient(135deg, #d1fae5, #a7f3d0);
        border: 2px solid #10b981;
        border-radius: 12px;
        padding: 24px;
        margin: 24px 0;
    `;
    
    const tokenIcon = document.createElement('div');
    tokenIcon.className = 'keno-token';
    tokenIcon.style.cssText = `
        font-size: 48px;
        margin-bottom: 12px;
    `;
    tokenIcon.textContent = '💰';
    
    const kenoText = document.createElement('div');
    kenoText.style.cssText = `
        font-size: 32px;
        font-weight: 800;
        color: #10b981;
        margin-bottom: 8px;
    `;
    kenoText.textContent = '250 KENO';
    
    const kenoDesc = document.createElement('div');
    kenoDesc.style.cssText = `
        font-size: 14px;
        color: #059669;
        font-weight: 600;
    `;
    kenoDesc.textContent = hasWallet ? 'Tokens Credited to Your Wallet!' : 'Tokens Earned!';
    
    rewardBox.appendChild(tokenIcon);
    rewardBox.appendChild(kenoText);
    rewardBox.appendChild(kenoDesc);
    
    // Add wallet connect button if not connected
    if (!hasWallet) {
        const walletConnectBox = document.createElement('div');
        walletConnectBox.style.cssText = `
            background: linear-gradient(135deg, #fef3c7, #fde68a);
            border: 2px solid #f59e0b;
            border-radius: 12px;
            padding: 16px;
            margin-top: 16px;
            text-align: center;
        `;
        
        const walletIcon = document.createElement('div');
        walletIcon.style.cssText = 'font-size: 32px; margin-bottom: 8px;';
        walletIcon.textContent = '💼';
        
        const walletText = document.createElement('div');
        walletText.style.cssText = 'font-size: 14px; color: #92400e; font-weight: 600; margin-bottom: 12px;';
        walletText.textContent = 'Connect your wallet to receive your KENO tokens!';
        
        const connectBtn = document.createElement('button');
        connectBtn.textContent = '🔗 Connect Wallet Now';
        connectBtn.style.cssText = `
            background: linear-gradient(135deg, #10b981, #059669);
            border: none;
            color: white;
            padding: 14px 28px;
            border-radius: 10px;
            font-size: 16px;
            font-weight: 700;
            cursor: pointer;
            width: 100%;
            box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
        `;
        connectBtn.onclick = function() {
            if (window.kenostodWallet && window.kenostodWallet.showModal) {
                window.kenostodWallet.showModal();
            } else {
                window.location.href = '/wealth-builder.html';
            }
        };
        
        walletConnectBox.appendChild(walletIcon);
        walletConnectBox.appendChild(walletText);
        walletConnectBox.appendChild(connectBtn);
        rewardBox.appendChild(walletConnectBox);
    }
    
    // Check if this is the final course (graduation!)
    const isGraduation = courseId === 21;
    
    if (isGraduation) {
        // GRADUATION CELEBRATION!
        titleEl.textContent = '🎓 CONGRATULATIONS!';
        titleEl.style.fontSize = '36px';
        titleEl.style.color = '#065f46';
        
        const graduationMsg = document.createElement('div');
        graduationMsg.style.cssText = `
            font-size: 18px;
            font-weight: 700;
            color: #10b981;
            margin-bottom: 20px;
        `;
        graduationMsg.textContent = 'You\'ve Completed All 21 Courses!';
        
        const celebrationBox = document.createElement('div');
        celebrationBox.style.cssText = `
            background: linear-gradient(135deg, #fef3c7, #fde68a);
            border: 3px solid #d97706;
            border-radius: 16px;
            padding: 32px;
            margin: 24px 0;
            text-align: center;
        `;
        
        const celebrations = document.createElement('div');
        celebrations.style.cssText = `
            font-size: 60px;
            margin-bottom: 16px;
            animation: bounce 0.6s ease-in-out infinite;
        `;
        celebrations.textContent = '🎓✨🎉';
        
        const gradDetails = document.createElement('div');
        gradDetails.style.cssText = `
            font-size: 16px;
            font-weight: 700;
            color: #b45309;
            margin-bottom: 12px;
        `;
        gradDetails.textContent = 'Kenostod Graduate';
        
        const totalReward = document.createElement('div');
        totalReward.style.cssText = `
            font-size: 14px;
            color: #92400e;
            margin-bottom: 8px;
        `;
        totalReward.textContent = '5,250 KENO Total Earned (250 × 21 courses)';
        
        celebrationBox.appendChild(celebrations);
        celebrationBox.appendChild(gradDetails);
        celebrationBox.appendChild(totalReward);
        
        const messageEl = document.createElement('div');
        messageEl.style.cssText = `
            font-size: 15px;
            color: #059669;
            line-height: 1.6;
            margin: 20px 0;
            font-weight: 600;
        `;
        messageEl.textContent = 'You\'re now part of an elite community! Access exclusive benefits, networking, and opportunities.';
        
        const clubBtn = document.createElement('button');
        clubBtn.textContent = '🎓 View Graduate Club →';
        clubBtn.style.cssText = `
            background: linear-gradient(135deg, #10b981, #059669);
            color: white;
            border: none;
            padding: 14px 32px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 15px;
            font-weight: 700;
            transition: all 0.2s;
            width: 100%;
            margin-top: 16px;
        `;
        clubBtn.onmouseover = () => clubBtn.style.transform = 'translateY(-2px)';
        clubBtn.onmouseout = () => clubBtn.style.transform = 'translateY(0)';
        clubBtn.onclick = () => {
            modal.remove();
            loadGraduateClub();
        };
        
        box.appendChild(titleEl);
        box.appendChild(courseNameEl);
        box.appendChild(rewardBox);
        box.appendChild(celebrationBox);
        box.appendChild(messageEl);
        box.appendChild(clubBtn);
        
        // Add bounce animation
        const bounceStyle = document.createElement('style');
        bounceStyle.textContent = `
            @keyframes bounce {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-10px); }
            }
        `;
        document.head.appendChild(bounceStyle);
    } else {
        // Regular course completion
        const messageEl = document.createElement('div');
        messageEl.style.cssText = `
            font-size: 14px;
            color: #6b7280;
            line-height: 1.6;
            margin: 20px 0;
        `;
        messageEl.textContent = 'Keep going! Complete all 21 courses to unlock the Graduate Club and earn additional rewards.';
        
        const progressEl = document.createElement('div');
        progressEl.style.cssText = `
            font-size: 13px;
            color: #9ca3af;
            margin: 16px 0;
        `;
        progressEl.textContent = `Course ${courseId}/21 completed`;
        
        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Next Course →';
        closeBtn.style.cssText = `
            background: linear-gradient(135deg, #2563eb, #1e40af);
            color: white;
            border: none;
            padding: 14px 32px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 15px;
            font-weight: 700;
            transition: all 0.2s;
            width: 100%;
            margin-top: 16px;
        `;
        closeBtn.onmouseover = () => closeBtn.style.transform = 'translateY(-2px)';
        closeBtn.onmouseout = () => closeBtn.style.transform = 'translateY(0)';
        closeBtn.onclick = () => modal.remove();
        
        box.appendChild(titleEl);
        box.appendChild(courseNameEl);
        box.appendChild(rewardBox);
        box.appendChild(messageEl);
        box.appendChild(progressEl);
        box.appendChild(closeBtn);
    }
    modal.appendChild(box);
    document.body.appendChild(modal);
}

// Load Graduate Club content
function loadGraduateClub() {
    const content = document.getElementById('course-content');
    
    // Update active state
    document.querySelectorAll('.course-nav button').forEach(btn => btn.classList.remove('active'));
    document.getElementById('graduate-btn').style.background = 'linear-gradient(135deg, #047857, #065f46)';
    
    let html = `
        <div class="course-header-section" style="background: linear-gradient(135deg, #064e3b 0%, #10b981 50%, #064e3b 100%); color: white; padding: 40px; border-radius: 12px; margin-bottom: 40px;">
            <h2 style="font-size: 2.5rem; margin-bottom: 12px;">🎓 Welcome to the Graduate Club</h2>
            <p style="font-size: 1.1rem; opacity: 0.95;">You've completed all 21 courses and earned your place in the elite Kenostod community</p>
        </div>

        <div class="section-block">
            <h3>🏆 Your Achievement</h3>
            <div style="background: linear-gradient(135deg, #d1fae5, #a7f3d0); border: 2px solid #10b981; border-radius: 12px; padding: 32px; text-align: center; margin: 20px 0;">
                <div style="font-size: 80px; margin-bottom: 16px;">🎓</div>
                <div style="font-size: 28px; font-weight: 800; color: #064e3b; margin-bottom: 8px;">Kenostod Graduate</div>
                <div style="font-size: 16px; color: #059669;">Verified on Blockchain</div>
                <div style="font-size: 14px; color: #10b981; margin-top: 12px;">Certificate ID: KENO-GRAD-2025-${Math.random().toString(36).substr(2, 9).toUpperCase()}</div>
            </div>
        </div>

        <div class="section-block">
            <h3>💰 Your Rewards</h3>
            <div style="background: #f0f9ff; border-left: 4px solid var(--primary-blue); padding: 20px; border-radius: 8px; margin: 20px 0;">
                <div style="margin-bottom: 16px;">
                    <div style="font-weight: 700; margin-bottom: 4px;">Total KENO Earned</div>
                    <div style="font-size: 32px; font-weight: 800; color: var(--primary-blue);">5,250 KENO</div>
                    <div style="font-size: 13px; color: #6b7280;">250 KENO × 21 courses completed</div>
                </div>
            </div>
            
            <div style="background: linear-gradient(135deg, #fef3c7, #fde68a); border-left: 4px solid var(--accent-orange); padding: 20px; border-radius: 8px; margin: 20px 0;">
                <div style="margin-bottom: 16px;">
                    <div style="font-weight: 700; margin-bottom: 4px;">Platinum RVT NFT</div>
                    <div style="font-size: 18px; color: var(--accent-orange); margin-bottom: 8px;">🏆 Unlocked</div>
                    <div style="font-size: 13px; color: #6b7280;">2% perpetual PoRV royalties on all network activity</div>
                </div>
            </div>
        </div>

        <div class="section-block">
            <h3>🌟 Graduate Privileges</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px;">
                <div style="background: white; border: 2px solid #10b981; border-radius: 12px; padding: 24px;">
                    <div style="font-size: 40px; margin-bottom: 12px;">🚀</div>
                    <h4 style="margin-bottom: 8px; font-weight: 700;">Priority Access</h4>
                    <p style="font-size: 13px; color: #6b7280;">First access to new features, advanced trading tools, and exclusive courses</p>
                </div>
                
                <div style="background: white; border: 2px solid #10b981; border-radius: 12px; padding: 24px;">
                    <div style="font-size: 40px; margin-bottom: 12px;">👥</div>
                    <h4 style="margin-bottom: 8px; font-weight: 700;">Graduate Network</h4>
                    <p style="font-size: 13px; color: #6b7280;">Connect with 100+ verified graduates for mentorship and opportunities</p>
                </div>
                
                <div style="background: white; border: 2px solid #10b981; border-radius: 12px; padding: 24px;">
                    <div style="font-size: 40px; margin-bottom: 12px;">💎</div>
                    <h4 style="margin-bottom: 8px; font-weight: 700;">VIP Support</h4>
                    <p style="font-size: 13px; color: #6b7280;">Priority support with dedicated account managers for advanced questions</p>
                </div>
                
                <div style="background: white; border: 2px solid #10b981; border-radius: 12px; padding: 24px;">
                    <div style="font-size: 40px; margin-bottom: 12px;">💼</div>
                    <h4 style="margin-bottom: 8px; font-weight: 700;">Career Opportunities</h4>
                    <p style="font-size: 13px; color: #6b7280;">Access to exclusive job board featuring blockchain companies</p>
                </div>
                
                <div style="background: white; border: 2px solid #10b981; border-radius: 12px; padding: 24px;">
                    <div style="font-size: 40px; margin-bottom: 12px;">🎁</div>
                    <h4 style="margin-bottom: 8px; font-weight: 700;">Exclusive Merchandise</h4>
                    <p style="font-size: 13px; color: #6b7280;">Limited edition Graduate Club merchandise and limited collectibles</p>
                </div>
                
                <div style="background: white; border: 2px solid #10b981; border-radius: 12px; padding: 24px;">
                    <div style="font-size: 40px; margin-bottom: 12px;">📊</div>
                    <h4 style="margin-bottom: 8px; font-weight: 700;">Advanced Analytics</h4>
                    <p style="font-size: 13px; color: #6b7280;">Deep insights into your KENO portfolio and trading performance</p>
                </div>
            </div>
        </div>

        <div class="section-block">
            <h3>🎯 What's Next?</h3>
            <div style="background: #f8fafc; border-left: 4px solid var(--primary-blue); padding: 24px; border-radius: 8px;">
                <h4 style="margin-bottom: 12px; color: var(--primary-blue);">Your Journey Continues</h4>
                <ul style="list-style: none; padding: 0; margin: 0;">
                    <li style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">✅ <strong>Advanced Blockchain Workshops</strong> - Master cutting-edge DeFi protocols</li>
                    <li style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">✅ <strong>Community Governance</strong> - Vote on network direction and policies</li>
                    <li style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">✅ <strong>Mentorship Program</strong> - Mentor new students and earn rewards</li>
                    <li style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">✅ <strong>Real Trading Operations</strong> - When Phase 3 launches (2027+)</li>
                    <li style="padding: 12px 0;">✅ <strong>Scholarship Fund Access</strong> - Help sponsor next generation of blockchain developers</li>
                </ul>
            </div>
        </div>

        <div style="text-align: center; margin-top: 40px; padding: 24px; background: linear-gradient(135deg, #dbeafe, #bfdbfe); border-radius: 12px;">
            <p style="font-size: 1.1rem; font-weight: 700; color: #1e40af; margin-bottom: 16px;">
                🎉 Congratulations on becoming a Kenostod Graduate!
            </p>
            <p style="color: #1e40af; margin-bottom: 20px;">
                You're now part of an elite community transforming blockchain education into opportunity.
            </p>
            <a href="/graduate-club.html" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 700; transition: all 0.3s;">
                View Full Graduate Club →
            </a>
        </div>
    `;
    
    content.innerHTML = html;
    content.scrollTop = 0;
}

// Check if all courses are completed and show Graduate Club button
function checkGraduateStatus() {
    const completedCourses = parseInt(localStorage.getItem('completedCourses') || '0');
    const graduateSection = document.getElementById('graduate-club-section');
    
    if (completedCourses >= 21 && graduateSection) {
        graduateSection.style.display = 'block';
    }
}

// Update completion count when course is completed
function markCourseCompleted(courseId) {
    let completed = JSON.parse(localStorage.getItem('completedCoursesList') || '[]');
    if (!completed.includes(courseId)) {
        completed.push(courseId);
        localStorage.setItem('completedCoursesList', JSON.stringify(completed));
        localStorage.setItem('completedCourses', completed.length.toString());
    }
    checkGraduateStatus();
}

// Update complete course function
const originalCompleteCourse = window.completeCourse;
window.completeCourse = function(courseId) {
    markCourseCompleted(courseId);
    originalCompleteCourse(courseId);
};

// Wallet Connection Feature
function getConnectedWallet() {
    return localStorage.getItem('userWalletAddress') || localStorage.getItem('walletAddress') || null;
}

function renderWalletStatus() {
    const existingWidget = document.getElementById('wallet-connection-widget');
    if (existingWidget) existingWidget.remove();
    
    const wallet = getConnectedWallet();
    const widget = document.createElement('div');
    widget.id = 'wallet-connection-widget';
    widget.style.cssText = `
        position: fixed;
        top: 16px;
        right: 16px;
        z-index: 9999;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;
    
    if (wallet) {
        widget.innerHTML = `
            <div style="background: linear-gradient(135deg, #d1fae5, #a7f3d0); border: 2px solid #10b981; border-radius: 12px; padding: 12px 20px; display: flex; align-items: center; gap: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                <span style="font-size: 20px;">💰</span>
                <div>
                    <div style="font-size: 11px; color: #059669; font-weight: 600;">WALLET CONNECTED</div>
                    <div style="font-size: 13px; color: #065f46; font-weight: 700;">${wallet.slice(0,6)}...${wallet.slice(-4)}</div>
                </div>
                <button onclick="disconnectWallet()" style="background: #fee2e2; border: 1px solid #ef4444; color: #dc2626; padding: 6px 12px; border-radius: 6px; font-size: 11px; cursor: pointer; font-weight: 600;">Disconnect</button>
            </div>
        `;
    } else {
        widget.innerHTML = `
            <div style="background: linear-gradient(135deg, #fef3c7, #fde68a); border: 2px solid #f59e0b; border-radius: 12px; padding: 12px 20px; display: flex; align-items: center; gap: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                <span style="font-size: 20px;">⚠️</span>
                <div>
                    <div style="font-size: 11px; color: #92400e; font-weight: 600;">NO WALLET CONNECTED</div>
                    <div style="font-size: 12px; color: #b45309;">Connect to earn KENO rewards</div>
                </div>
                <button onclick="showWalletConnectModal()" style="background: linear-gradient(135deg, #10b981, #059669); border: none; color: white; padding: 8px 16px; border-radius: 6px; font-size: 12px; cursor: pointer; font-weight: 700;">Connect Wallet</button>
            </div>
        `;
    }
    
    document.body.appendChild(widget);
}

function showWalletConnectModal() {
    const modal = document.createElement('div');
    modal.id = 'wallet-connect-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.6);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;
    
    const hasMetaMask = typeof window.ethereum !== 'undefined';
    
    modal.innerHTML = `
        <div style="background: white; padding: 40px; border-radius: 16px; max-width: 450px; width: 90%; text-align: center; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
            <div style="font-size: 48px; margin-bottom: 16px;">💼</div>
            <h2 style="margin: 0 0 8px 0; color: #1f2937; font-size: 24px;">Connect Your Wallet</h2>
            <p style="color: #6b7280; margin-bottom: 24px; font-size: 14px;">Connect your wallet to receive KENO tokens for course completions</p>
            
            ${hasMetaMask ? `
                <button onclick="connectMetaMask()" style="width: 100%; background: linear-gradient(135deg, #f97316, #ea580c); border: none; color: white; padding: 16px; border-radius: 12px; font-size: 16px; font-weight: 700; cursor: pointer; margin-bottom: 12px; display: flex; align-items: center; justify-content: center; gap: 12px;">
                    <img src="https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg" style="width: 24px; height: 24px;" alt="MetaMask">
                    Connect MetaMask
                </button>
            ` : ''}
            
            <div style="color: #9ca3af; font-size: 12px; margin: 16px 0;">OR</div>
            
            <div style="text-align: left; margin-bottom: 16px;">
                <label style="font-size: 13px; color: #374151; font-weight: 600;">Enter Wallet Address Manually</label>
                <input type="text" id="manual-wallet-input" placeholder="0x..." style="width: 100%; padding: 14px; border: 2px solid #e5e7eb; border-radius: 10px; font-size: 14px; margin-top: 8px; box-sizing: border-box;">
            </div>
            
            <button onclick="connectManualWallet()" style="width: 100%; background: linear-gradient(135deg, #10b981, #059669); border: none; color: white; padding: 14px; border-radius: 10px; font-size: 15px; font-weight: 700; cursor: pointer; margin-bottom: 12px;">
                Save Wallet Address
            </button>
            
            <button onclick="closeWalletModal()" style="width: 100%; background: #f3f4f6; border: none; color: #6b7280; padding: 12px; border-radius: 10px; font-size: 14px; cursor: pointer;">
                Cancel
            </button>
            
            <p style="color: #9ca3af; font-size: 11px; margin-top: 16px;">
                Your wallet address is used to credit KENO rewards. You can disconnect anytime.
            </p>
        </div>
    `;
    
    document.body.appendChild(modal);
}

async function connectMetaMask() {
    try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        const address = accounts[0];
        localStorage.setItem('userWalletAddress', address);
        closeWalletModal();
        renderWalletStatus();
        showWalletToast('Wallet connected successfully!', 'success');
    } catch (error) {
        console.error('MetaMask connection failed:', error);
        showWalletToast('Connection failed. Please try again.', 'error');
    }
}

function connectManualWallet() {
    const input = document.getElementById('manual-wallet-input');
    const address = input.value.trim();
    
    if (!address) {
        showWalletToast('Please enter a wallet address', 'error');
        return;
    }
    
    if (!address.startsWith('0x') || address.length !== 42) {
        showWalletToast('Please enter a valid wallet address (0x...)', 'error');
        return;
    }
    
    localStorage.setItem('userWalletAddress', address);
    closeWalletModal();
    renderWalletStatus();
    showWalletToast('Wallet address saved!', 'success');
}

function disconnectWallet() {
    localStorage.removeItem('userWalletAddress');
    localStorage.removeItem('walletAddress');
    renderWalletStatus();
    showWalletToast('Wallet disconnected', 'info');
}

function closeWalletModal() {
    const modal = document.getElementById('wallet-connect-modal');
    if (modal) modal.remove();
}

function showWalletToast(message, type) {
    const toast = document.createElement('div');
    const colors = {
        success: { bg: '#d1fae5', border: '#10b981', text: '#065f46' },
        error: { bg: '#fee2e2', border: '#ef4444', text: '#991b1b' },
        info: { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' }
    };
    const c = colors[type] || colors.info;
    
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: ${c.bg};
        border: 2px solid ${c.border};
        color: ${c.text};
        padding: 14px 28px;
        border-radius: 10px;
        font-weight: 600;
        z-index: 10001;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.remove(), 3000);
}

// Initialize
// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    renderCourseNav();
    loadCourse(1);
    checkGraduateStatus();
    renderWalletStatus();
});

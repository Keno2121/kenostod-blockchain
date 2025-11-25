// Comprehensive Course Curriculum Data
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
        title: 'Course 17: Personal Finance Foundations',
        duration: '5 hours',
        modules: 6,
        level: 'Beginner',
        overview: 'Master the fundamentals of personal finance and money management. Learn budgeting, emergency funds, debt management, credit scores, and financial goal setting. Build the foundation for lifelong financial success and break the cycle of poverty.',
        objectives: [
            'Create and maintain effective budgets',
            'Build emergency savings funds',
            'Understand and improve credit scores',
            'Develop debt elimination strategies',
            'Set achievable financial goals'
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
                    'Budget apps and tools',
                    'Adjusting budgets over time'
                ]
            },
            {
                title: 'Emergency Funds',
                lessons: [
                    'Why you need 3-6 months expenses saved',
                    'How to build emergency fund from $0',
                    'Where to keep emergency money',
                    'When to use emergency funds',
                    'Rebuilding after emergencies'
                ]
            },
            {
                title: 'Debt Management',
                lessons: [
                    'Good debt vs. bad debt',
                    'Debt avalanche vs. debt snowball methods',
                    'Credit card interest calculations',
                    'Negotiating with creditors',
                    'Avoiding predatory loans (payday, title loans)'
                ]
            },
            {
                title: 'Credit Scores & Reports',
                lessons: [
                    'How credit scores are calculated',
                    'FICO score ranges and what they mean',
                    'How to check credit reports for free',
                    'Disputing credit report errors',
                    'Building credit from scratch',
                    'Impact of credit on life (housing, jobs, insurance)'
                ]
            },
            {
                title: 'Financial Goal Setting',
                lessons: [
                    'Short-term vs. long-term goals',
                    'SMART goals framework',
                    'Creating financial roadmaps',
                    'Tracking progress',
                    'Celebrating milestones'
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
                question: 'How much should you save in an emergency fund?',
                options: [
                    'A) $100',
                    'B) 1 month of expenses',
                    'C) 3-6 months of expenses',
                    'D) $1 million'
                ],
                correct: 'C) 3-6 months of expenses'
            },
            {
                question: 'What is the debt snowball method?',
                options: [
                    'A) Ignoring debt',
                    'B) Paying smallest debts first for psychological wins',
                    'C) Taking on more debt',
                    'D) Paying random amounts'
                ],
                correct: 'B) Paying smallest debts first for psychological wins'
            }
        ],
        skills: ['Budgeting', 'Debt Management', 'Credit Scores', 'Emergency Planning', 'Financial Goal Setting'],
        real_world: 'Essential life skills for everyone. Critical for students from low-income backgrounds to understand money, avoid financial mistakes, and start building wealth.',
        hands_on: 'Students create personal budgets, calculate emergency fund goals, analyze their debt, and design 1-year financial plans.',
        wealth_builder_reward: '250 KENO upon completion + progress toward Bronze RVT NFT'
    },

    18: {
        icon: '📈',
        title: 'Course 18: Investment Strategies & Compound Growth',
        duration: '6 hours',
        modules: 7,
        level: 'Intermediate',
        overview: 'Understand investing fundamentals and the power of compound interest. Learn about stocks, bonds, index funds, cryptocurrency, and dollar-cost averaging. Discover how small, consistent investments can grow into life-changing wealth over time.',
        objectives: [
            'Understand investment vehicles (stocks, bonds, crypto)',
            'Master compound interest mathematics',
            'Implement dollar-cost averaging strategies',
            'Build diversified portfolios',
            'Calculate long-term wealth projections'
        ],
        modules_content: [
            {
                title: 'Why Invest?',
                lessons: [
                    'Inflation erodes savings (3% annual)',
                    'Working for money vs. money working for you',
                    'The millionaire next door: how average people build wealth',
                    'Starting with $100/month: real examples'
                ]
            },
            {
                title: 'Compound Interest: The 8th Wonder',
                lessons: [
                    'Simple vs. compound interest',
                    'The Rule of 72 (doubling time)',
                    'Real calculation: $100/month for 30 years at 8% = $150,000',
                    'Why starting early matters (time > amount)',
                    'Interactive compound interest calculator'
                ]
            },
            {
                title: 'Investment Vehicles',
                lessons: [
                    'Stocks: ownership in companies',
                    'Bonds: lending to governments/corporations',
                    'Index funds: diversification made easy',
                    'Real estate investment trusts (REITs)',
                    'Cryptocurrency: digital assets',
                    'Risk vs. return spectrum'
                ]
            },
            {
                title: 'Stock Market Basics',
                lessons: [
                    'How the stock market works',
                    'Individual stocks vs. index funds',
                    'S&P 500: 500 largest US companies',
                    'Historical returns: ~10% annually long-term',
                    'Market volatility and staying calm'
                ]
            },
            {
                title: 'Dollar-Cost Averaging (DCA)',
                lessons: [
                    'Investing fixed amounts regularly',
                    'Why DCA beats market timing',
                    'Automatic investment plans',
                    'Buying more when prices are low',
                    'Psychological benefits of consistency'
                ]
            },
            {
                title: 'Portfolio Diversification',
                lessons: [
                    '"Don\'t put all eggs in one basket"',
                    'Asset allocation by age',
                    'Rebalancing strategies',
                    'International diversification',
                    'Risk tolerance assessment'
                ]
            },
            {
                title: 'Cryptocurrency Investing',
                lessons: [
                    'Bitcoin and Ethereum fundamentals',
                    'Crypto volatility management',
                    'Percentage allocation recommendations (5-10% of portfolio)',
                    'KENO as long-term hold',
                    'Crypto vs. traditional assets'
                ]
            }
        ],
        quiz: [
            {
                question: 'If you invest $100/month for 30 years at 8% annual return, approximately how much will you have?',
                options: [
                    'A) $36,000',
                    'B) $72,000',
                    'C) $150,000',
                    'D) $500,000'
                ],
                correct: 'C) $150,000'
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
            },
            {
                question: 'What is an index fund?',
                options: [
                    'A) A single company stock',
                    'B) A fund that owns shares of many companies (e.g., S&P 500)',
                    'C) A type of bond',
                    'D) A savings account'
                ],
                correct: 'B) A fund that owns shares of many companies (e.g., S&P 500)'
            }
        ],
        skills: ['Investment Strategies', 'Compound Interest', 'Portfolio Management', 'Dollar-Cost Averaging', 'Asset Allocation'],
        real_world: 'Transform earned income into passive wealth. $100/month invested consistently = financial independence. Warren Buffett built $100B+ fortune using these principles.',
        hands_on: 'Students use compound interest calculators, design 30-year investment plans, allocate sample portfolios, and calculate retirement projections.',
        wealth_builder_reward: '250 KENO upon completion + progress toward Silver RVT NFT'
    },

    19: {
        icon: '💎',
        title: 'Course 19: Wealth Building & Asset Allocation',
        duration: '6 hours',
        modules: 7,
        level: 'Advanced',
        overview: 'Advanced wealth accumulation strategies. Learn multiple income streams, asset diversification, real estate basics, business ownership, and tax optimization. Understand how the wealthy build and preserve multi-generational fortunes.',
        objectives: [
            'Create multiple income streams',
            'Understand real estate investing',
            'Design wealth-building roadmaps',
            'Optimize tax strategies',
            'Build $500K-$2M+ net worth plans'
        ],
        modules_content: [
            {
                title: 'The Wealth Equation',
                lessons: [
                    'Income - Expenses + Investments × Time = Wealth',
                    'Why high income doesn\'t guarantee wealth',
                    'The spending trap (lifestyle inflation)',
                    'Net worth calculation and tracking'
                ]
            },
            {
                title: 'Multiple Income Streams',
                lessons: [
                    'Active income (job/business)',
                    'Passive income (investments, royalties)',
                    'Portfolio income (dividends, interest)',
                    'Side hustles and freelancing',
                    'Building income diversity for security',
                    'Case study: 7 income streams of millionaires'
                ]
            },
            {
                title: 'Real Estate Investing',
                lessons: [
                    'Primary residence as asset',
                    'Rental property basics',
                    'House hacking (rent out rooms)',
                    'REITs for passive real estate exposure',
                    'Real estate appreciation and cash flow',
                    'Leverage and mortgage strategies'
                ]
            },
            {
                title: 'Business Ownership',
                lessons: [
                    'Starting side businesses with low capital',
                    'Online businesses and digital products',
                    'Franchise opportunities',
                    'Equity and business valuation',
                    'Exit strategies (selling businesses)'
                ]
            },
            {
                title: 'Advanced Portfolio Strategies',
                lessons: [
                    'Aggressive vs. conservative allocation',
                    'Alternative investments (commodities, precious metals)',
                    'Private equity and venture capital',
                    'Hedge fund strategies simplified',
                    'Rebalancing for optimal returns'
                ]
            },
            {
                title: 'Tax Optimization',
                lessons: [
                    '401(k) and IRA retirement accounts',
                    'Tax-advantaged investing',
                    'Capital gains vs. ordinary income',
                    'Tax-loss harvesting',
                    'Charitable giving strategies',
                    'Legal tax reduction (not evasion)'
                ]
            },
            {
                title: 'Wealth Protection',
                lessons: [
                    'Insurance: life, disability, umbrella',
                    'Asset protection trusts',
                    'Lawsuit protection strategies',
                    'Estate planning basics',
                    'Protecting wealth from market crashes'
                ]
            }
        ],
        quiz: [
            {
                question: 'What are the three main types of income?',
                options: [
                    'A) Salary, tips, bonuses',
                    'B) Active (earned), passive, and portfolio income',
                    'C) Cash, credit, crypto',
                    'D) Full-time, part-time, contract'
                ],
                correct: 'B) Active (earned), passive, and portfolio income'
            },
            {
                question: 'What is "house hacking"?',
                options: [
                    'A) Illegally breaking into houses',
                    'B) Renting out rooms in your home to cover your mortgage',
                    'C) Buying foreclosed properties',
                    'D) Flipping houses quickly'
                ],
                correct: 'B) Renting out rooms in your home to cover your mortgage'
            },
            {
                question: 'Why is tax optimization important?',
                options: [
                    'A) To avoid paying any taxes',
                    'B) To legally reduce tax burden and keep more wealth growing',
                    'C) It\'s not important',
                    'D) Only for the ultra-rich'
                ],
                correct: 'B) To legally reduce tax burden and keep more wealth growing'
            }
        ],
        skills: ['Asset Allocation', 'Real Estate', 'Multiple Income Streams', 'Tax Strategy', 'Wealth Preservation'],
        real_world: 'Bridge the wealth gap. Students learn to build $500K-$2M+ net worth over 10-20 years through strategic diversification, even starting from poverty.',
        hands_on: 'Students design personal wealth roadmaps, calculate real estate ROI, plan multiple income streams, and create 10-year net worth projections.',
        wealth_builder_reward: '250 KENO upon completion + progress toward Gold RVT NFT'
    },

    20: {
        icon: '🏛️',
        title: 'Course 20: Generational Wealth Planning',
        duration: '5 hours',
        modules: 6,
        level: 'Advanced',
        overview: 'Create wealth that lasts for generations. Learn estate planning, trusts, inheritance strategies, family financial education, and how to pass wealth to children and grandchildren. Break the cycle of poverty for your entire family tree.',
        objectives: [
            'Understand estate planning fundamentals',
            'Create inheritance strategies',
            'Design family wealth education programs',
            'Implement wealth transfer mechanisms',
            'Build multi-generational financial legacies'
        ],
        modules_content: [
            {
                title: 'Generational Wealth Mindset',
                lessons: [
                    'Thinking beyond your lifetime',
                    'How wealthy families stay wealthy (Rockefellers, Rothschilds)',
                    'The 90% rule: 90% of families lose wealth by 3rd generation',
                    'Breaking poverty cycles permanently'
                ]
            },
            {
                title: 'Estate Planning Basics',
                lessons: [
                    'Wills vs. trusts',
                    'Probate process and costs',
                    'Beneficiary designations',
                    'Power of attorney',
                    'Healthcare directives',
                    'Why everyone needs estate planning (not just the rich)'
                ]
            },
            {
                title: 'Trusts & Wealth Transfer',
                lessons: [
                    'Living trusts vs. testamentary trusts',
                    'Revocable vs. irrevocable trusts',
                    'Trust benefits: avoid probate, reduce taxes, control distribution',
                    'Setting up family trusts',
                    'Trustee selection and responsibilities'
                ]
            },
            {
                title: 'Inheritance Strategies',
                lessons: [
                    'Gifting during lifetime vs. inheritance',
                    'Annual gift tax exclusions',
                    'Education funding (529 plans)',
                    'Life insurance as wealth transfer',
                    'Unequal vs. equal distribution among heirs',
                    'Incentive trusts (rewarding education, work ethic)'
                ]
            },
            {
                title: 'Family Financial Education',
                lessons: [
                    'Teaching children about money',
                    'Age-appropriate financial lessons',
                    'The trust fund kid problem (and solutions)',
                    'Family wealth councils and meetings',
                    'Preparing heirs to receive wealth responsibly',
                    'Financial literacy as family tradition'
                ]
            },
            {
                title: 'Long-Term Wealth Preservation',
                lessons: [
                    'Dynasty trusts (wealth for 100+ years)',
                    'Family offices for ultra-wealthy',
                    'Philanthropic foundations',
                    'Business succession planning',
                    'International wealth diversification',
                    'Protecting wealth from lawsuits and creditors'
                ]
            }
        ],
        quiz: [
            {
                question: 'Why do 90% of wealthy families lose their wealth by the 3rd generation?',
                options: [
                    'A) Bad luck',
                    'B) Lack of financial education and planning across generations',
                    'C) Government taxes',
                    'D) Market crashes'
                ],
                correct: 'B) Lack of financial education and planning across generations'
            },
            {
                question: 'What is the main advantage of a trust over a will?',
                options: [
                    'A) It\'s cheaper',
                    'B) Avoids probate, maintains privacy, provides control over distribution',
                    'C) No lawyers needed',
                    'D) Trusts are only for millionaires'
                ],
                correct: 'B) Avoids probate, maintains privacy, provides control over distribution'
            },
            {
                question: 'What is an incentive trust?',
                options: [
                    'A) A trust that rewards heirs for achievements (education, career)',
                    'B) A trust with high interest rates',
                    'C) A government trust fund',
                    'D) A retirement account'
                ],
                correct: 'A) A trust that rewards heirs for achievements (education, career)'
            }
        ],
        skills: ['Estate Planning', 'Trusts', 'Wealth Transfer', 'Family Finance Education', 'Legacy Building'],
        real_world: 'The ultimate goal: financial freedom for your descendants. Learn how families like the Rockefellers and Rothschilds preserve wealth across centuries.',
        hands_on: 'Students create sample wills, design family trust structures, plan inheritance strategies, and develop family financial education programs.',
        wealth_builder_reward: '250 KENO upon completion + progress toward Platinum RVT NFT'
    },

    21: {
        icon: '🌍',
        title: 'Course 21: Economic Empowerment & Poverty Reduction',
        duration: '6 hours',
        modules: 7,
        level: 'Advanced',
        overview: 'Use blockchain and financial knowledge to lift communities out of poverty. Learn microfinance, community investment, social entrepreneurship, and how technology enables global economic opportunity. Discover your role in reducing global poverty.',
        objectives: [
            'Understand global poverty challenges',
            'Learn microfinance and community banking',
            'Design social impact businesses',
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
function renderCourseNav() {
    const blockchainList = document.getElementById('blockchain-courses');
    const financeList = document.getElementById('finance-courses');
    
    // Blockchain courses 1-16
    for (let i = 1; i <= 16; i++) {
        const course = courses[i];
        const li = document.createElement('li');
        const button = document.createElement('button');
        button.innerHTML = `<span class="icon">${course.icon}</span><span>Course ${i}</span>`;
        button.onclick = () => loadCourse(i);
        if (i === 1) button.classList.add('active');
        li.appendChild(button);
        blockchainList.appendChild(li);
    }
    
    // Financial literacy courses 17-21
    for (let i = 17; i <= 21; i++) {
        const course = courses[i];
        const li = document.createElement('li');
        const button = document.createElement('button');
        button.innerHTML = `<span class="icon">${course.icon}</span><span>Course ${i}</span>`;
        button.onclick = () => loadCourse(i);
        li.appendChild(button);
        financeList.appendChild(li);
    }
}

// Load course content
function loadCourse(courseId) {
    const course = courses[courseId];
    const content = document.getElementById('course-content');
    
    // Update active state
    document.querySelectorAll('.course-nav button').forEach(btn => btn.classList.remove('active'));
    event.target.closest('button').classList.add('active');
    
    // Render course content
    let html = `
        <div class="course-header-section">
            <h2><span class="icon">${course.icon}</span>${course.title}</h2>
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
                <div class="quiz-question">
                    <strong>Question ${idx + 1}: ${q.question}</strong>
                    <ul>
                        ${q.options.map(opt => `
                            <li class="${opt === q.correct ? 'correct' : ''}">${opt}</li>
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

    content.innerHTML = html;
    content.scrollTop = 0;
}

// Complete course and show KENO reward
function completeCourse(courseId) {
    const course = courses[courseId];
    
    // Show custom notification
    showCourseCompletionNotification(courseId, course.title);
}

// Show course completion notification with KENO reward
function showCourseCompletionNotification(courseId, courseTitle) {
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
    kenoDesc.textContent = 'Tokens Earned!';
    
    rewardBox.appendChild(tokenIcon);
    rewardBox.appendChild(kenoText);
    rewardBox.appendChild(kenoDesc);
    
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

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    renderCourseNav();
    loadCourse(1);
    checkGraduateStatus();
});

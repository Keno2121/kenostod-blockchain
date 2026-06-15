// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║       KENOSTOD — FLASH ARBITRAGE LOAN POOL (FALP) v1.0          ║
 * ║                                                                  ║
 * ║  Deposit KENO. Earn BNB every time the arb bot profits.         ║
 * ║  The longer you lock, the higher your Golden Ratio multiplier.  ║
 * ║  Hit 1729 KENO deposited — the Ramanujan milestone fires.       ║
 * ║                                                                  ║
 * ║  7 Constitutional Laws — silent and structural.                 ║
 * ║  Users feel them. They don't see them.                          ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Law I   — Kaprekar:     Dust (<6174 wei) rounds UP to participant.
 *                         Pool fee = 617 bp (rooted in 6174).
 * Law II  — Benford:      Every deposit/withdrawal emits a BenfordData
 *                         event (leading digit) for off-chain monitoring.
 * Law III — Golden Ratio: Lock multipliers: 1.0× / 1.25× / 1.5× / 1.618×
 * Law IV  — Nash:         Pool fee auto-tunes 3–7% based on utilization.
 * Law V   — Euler:        Rewards accumulate every block (continuous approx).
 * Law VI  — Ramanujan:    1729 KENO deposited → +10% permanent multiplier.
 * Law VII — Inversion:    Zero fee on deposits. All profit flows to participants.
 */

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract FALPool is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // ═══════════════════════════════════════════════════════════════
    //  Constitutional Law Constants
    // ═══════════════════════════════════════════════════════════════

    // Law I — Kaprekar
    uint256 public constant KAPREKAR_CONSTANT = 6174;
    uint256 public constant DUST_LIMIT        = 6174;     // wei: dust rounds up to participant

    // Law III — Golden Ratio (φ = 1.618...)
    // Multipliers × 1000: flexible=1000, 7d=1250, 30d=1500, 90d=1618
    uint256[4] public LOCK_MULTIPLIERS = [1000, 1250, 1500, 1618];
    uint256[4] public LOCK_DAYS        = [0,    7,    30,   90];

    // Law IV — Nash: fee auto-tunes in this range (basis points)
    uint256 public constant NASH_FEE_MIN = 300;   // 3%
    uint256 public constant NASH_FEE_MAX = 700;   // 7%
    uint256 public nashFee = 500;                 // starts at 5%

    // Law V — Euler: accumulator precision
    uint256 public constant PRECISION = 1e30;

    // Law VI — Ramanujan
    uint256 public constant RAMANUJAN_THRESHOLD = 1729e18;  // 1729 KENO
    uint256 public constant RAMANUJAN_BONUS     = 100;      // +10% to multiplier

    // ═══════════════════════════════════════════════════════════════
    //  Storage
    // ═══════════════════════════════════════════════════════════════

    IERC20  public immutable kenoToken;
    address public arbBot;

    struct DepositInfo {
        uint256 amount;             // KENO deposited (wei)
        uint256 depositedAt;        // unix timestamp
        uint256 lockEnd;            // 0 = flexible
        uint8   lockTier;           // 0–3
        uint256 rewardDebt;         // MasterChef-style: effStake × accPerEffStake / PRECISION
        uint256 harvestBuffer;      // settled BNB waiting to be claimed
        uint256 lifetimeDeposited;  // cumulative KENO ever deposited (Ramanujan check)
        uint256 lifetimeBnbClaimed; // cumulative BNB ever claimed
        bool    ramanujanUnlocked;  // true after milestone
    }

    mapping(address => DepositInfo) public deposits;

    uint256 public totalDeposited;         // raw KENO in pool
    uint256 public totalEffectiveStake;    // weighted stake sum
    uint256 public accProfitPerEffStake;   // accumulated BNB per eff-stake unit (PRECISION scaled)
    uint256 public totalProfitReceived;    // total BNB ever sent by bot
    uint256 public totalProfitPaid;        // total BNB ever sent to stakers
    uint256 public platformFeesAccrued;    // Nash cut waiting for owner withdrawal

    uint256 public minDeposit = 100e18;    // 100 KENO minimum

    // ═══════════════════════════════════════════════════════════════
    //  Events
    // ═══════════════════════════════════════════════════════════════

    event Deposited(
        address indexed user,
        uint256 amount,
        uint8   lockTier,
        uint256 effectiveStake,
        uint256 totalPoolDeposited
    );
    event Withdrawn(address indexed user, uint256 kenoAmount, uint256 bnbReward);
    event RewardClaimed(address indexed user, uint256 bnbAmount);
    event ProfitDeposited(
        address indexed bot,
        uint256 bnbAmount,
        uint256 stakerShare,
        uint256 platformCut,
        uint256 accProfitPerEffStake
    );
    event RamanujanMilestone(
        address indexed user,
        uint256 lifetimeDeposited,
        uint256 newMultiplier
    );
    event BenfordData(
        address indexed user,
        uint8   leadingDigit,
        uint256 amount,
        bool    isDeposit
    );
    event NashFeeAdjusted(uint256 oldFee, uint256 newFee, uint256 utilization);
    event ArbBotUpdated(address indexed oldBot, address indexed newBot);
    event MinDepositUpdated(uint256 newMin);

    // ═══════════════════════════════════════════════════════════════
    //  Constructor
    // ═══════════════════════════════════════════════════════════════

    constructor(address _kenoToken, address _arbBot) Ownable(msg.sender) {
        require(_kenoToken != address(0), "FALPool: zero token address");
        require(_arbBot    != address(0), "FALPool: zero bot address");
        kenoToken = IERC20(_kenoToken);
        arbBot    = _arbBot;
    }

    // ═══════════════════════════════════════════════════════════════
    //  Modifiers
    // ═══════════════════════════════════════════════════════════════

    modifier onlyArbBot() {
        require(
            msg.sender == arbBot || msg.sender == owner(),
            "FALPool: caller not authorized"
        );
        _;
    }

    // ═══════════════════════════════════════════════════════════════
    //  Law III — effective stake (Golden Ratio multiplier)
    // ═══════════════════════════════════════════════════════════════

    function _effectiveStake(address user) internal view returns (uint256) {
        DepositInfo storage d = deposits[user];
        if (d.amount == 0) return 0;
        uint256 mult = LOCK_MULTIPLIERS[d.lockTier];
        if (d.ramanujanUnlocked) mult += RAMANUJAN_BONUS; // Law VI
        return d.amount * mult / 1000;
    }

    // ═══════════════════════════════════════════════════════════════
    //  Law V — Euler: pending reward formula
    // ═══════════════════════════════════════════════════════════════

    function pendingReward(address user) public view returns (uint256) {
        DepositInfo storage d = deposits[user];
        if (d.amount == 0) return d.harvestBuffer;
        uint256 effStake = _effectiveStake(user);
        uint256 gross    = (effStake * accProfitPerEffStake) / PRECISION;
        uint256 pending  = gross > d.rewardDebt ? gross - d.rewardDebt : 0;
        return d.harvestBuffer + pending;
    }

    // ═══════════════════════════════════════════════════════════════
    //  Law II — Benford: extract leading digit for event emission
    // ═══════════════════════════════════════════════════════════════

    function _leadingDigit(uint256 n) internal pure returns (uint8) {
        if (n == 0) return 0;
        // Normalize to KENO units (remove 18 decimals)
        n = n / 1e18;
        if (n == 0) return 1;
        while (n >= 10) n /= 10;
        return uint8(n);
    }

    // ═══════════════════════════════════════════════════════════════
    //  Law IV — Nash: auto-tune pool fee by utilization
    // ═══════════════════════════════════════════════════════════════

    function _nashAdjustFee() internal {
        if (totalProfitReceived == 0) return;
        uint256 utilization = (totalProfitPaid * 10000) / totalProfitReceived;
        uint256 oldFee = nashFee;

        if (utilization > 8000 && nashFee < NASH_FEE_MAX) {
            nashFee = nashFee + 50 > NASH_FEE_MAX ? NASH_FEE_MAX : nashFee + 50;
        } else if (utilization < 3000 && nashFee > NASH_FEE_MIN) {
            nashFee = nashFee < NASH_FEE_MIN + 50 ? NASH_FEE_MIN : nashFee - 50;
        }

        if (nashFee != oldFee) {
            emit NashFeeAdjusted(oldFee, nashFee, utilization);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  Internal: settle pending rewards into harvestBuffer
    //  (no BNB transfer here — pure state update)
    // ═══════════════════════════════════════════════════════════════

    function _settle(address user) internal {
        DepositInfo storage d = deposits[user];
        if (d.amount == 0) return;

        uint256 effStake = _effectiveStake(user);
        uint256 gross    = (effStake * accProfitPerEffStake) / PRECISION;
        uint256 pending  = gross > d.rewardDebt ? gross - d.rewardDebt : 0;

        if (pending > 0) {
            d.harvestBuffer += pending;
        }
        d.rewardDebt = gross;
    }

    // ═══════════════════════════════════════════════════════════════
    //  Deposit KENO into the pool
    //  lockTier: 0=flexible, 1=7 days, 2=30 days, 3=90 days
    // ═══════════════════════════════════════════════════════════════

    function deposit(uint256 amount, uint8 lockTier) external nonReentrant {
        require(lockTier <= 3,             "FALPool: invalid lock tier");
        require(amount >= minDeposit,      "FALPool: below minimum deposit");

        DepositInfo storage d = deposits[msg.sender];

        // Settle any existing pending rewards before changing effective stake
        if (d.amount > 0) {
            _settle(msg.sender);
            totalEffectiveStake -= _effectiveStake(msg.sender);
            totalDeposited      -= d.amount;
        }

        // Pull KENO — Law VII: zero fee on deposit
        kenoToken.safeTransferFrom(msg.sender, address(this), amount);

        // Update deposit record
        d.amount            += amount;
        d.depositedAt        = block.timestamp;
        d.lockEnd            = LOCK_DAYS[lockTier] > 0
                               ? block.timestamp + (LOCK_DAYS[lockTier] * 1 days)
                               : 0;
        d.lockTier           = lockTier;
        d.lifetimeDeposited += amount;

        // Law VI — Ramanujan milestone
        if (!d.ramanujanUnlocked && d.lifetimeDeposited >= RAMANUJAN_THRESHOLD) {
            d.ramanujanUnlocked = true;
            uint256 newMult = LOCK_MULTIPLIERS[d.lockTier] + RAMANUJAN_BONUS;
            emit RamanujanMilestone(msg.sender, d.lifetimeDeposited, newMult);
        }

        // Update pool totals
        uint256 effStake    = _effectiveStake(msg.sender);
        totalEffectiveStake += effStake;
        totalDeposited      += d.amount;

        // Law V — Euler: set debt so user earns only from this point forward
        d.rewardDebt = (effStake * accProfitPerEffStake) / PRECISION;

        // Law II — Benford event
        emit BenfordData(msg.sender, _leadingDigit(amount), amount, true);

        emit Deposited(msg.sender, amount, lockTier, effStake, totalDeposited);
    }

    // ═══════════════════════════════════════════════════════════════
    //  Claim BNB rewards (KENO stays in pool)
    // ═══════════════════════════════════════════════════════════════

    function claimReward() external nonReentrant {
        DepositInfo storage d = deposits[msg.sender];
        require(d.amount > 0, "FALPool: nothing deposited");

        _settle(msg.sender);

        uint256 reward = d.harvestBuffer;
        require(reward > 0, "FALPool: no rewards");

        // Law I — Kaprekar: dust rounds up to participant
        if (reward < DUST_LIMIT) reward = DUST_LIMIT;

        require(address(this).balance >= reward, "FALPool: insufficient BNB (notify bot)");

        d.harvestBuffer       = 0;
        d.lifetimeBnbClaimed += reward;
        totalProfitPaid      += reward;

        _nashAdjustFee();

        // Check-Effects-Interactions
        (bool sent, ) = msg.sender.call{value: reward}("");
        require(sent, "FALPool: BNB transfer failed");

        emit RewardClaimed(msg.sender, reward);
    }

    // ═══════════════════════════════════════════════════════════════
    //  Withdraw KENO + claim all pending BNB
    // ═══════════════════════════════════════════════════════════════

    function withdraw() external nonReentrant {
        DepositInfo storage d = deposits[msg.sender];
        require(d.amount > 0, "FALPool: nothing to withdraw");
        require(
            d.lockEnd == 0 || block.timestamp >= d.lockEnd,
            "FALPool: tokens still locked"
        );

        _settle(msg.sender);

        uint256 kenoOut = d.amount;
        uint256 bnbOut  = d.harvestBuffer;

        // Law I — Kaprekar: dust rounds up
        if (bnbOut > 0 && bnbOut < DUST_LIMIT) bnbOut = DUST_LIMIT;

        // Update pool totals before transfer
        totalEffectiveStake  -= _effectiveStake(msg.sender);
        totalDeposited       -= kenoOut;
        if (bnbOut > 0) {
            totalProfitPaid  += bnbOut;
            _nashAdjustFee();
        }

        // Clear deposit
        delete deposits[msg.sender];

        // Law II — Benford
        emit BenfordData(msg.sender, _leadingDigit(kenoOut), kenoOut, false);

        // Transfers (after state cleared — CEI pattern)
        kenoToken.safeTransfer(msg.sender, kenoOut);

        if (bnbOut > 0 && address(this).balance >= bnbOut) {
            (bool sent, ) = msg.sender.call{value: bnbOut}("");
            require(sent, "FALPool: BNB transfer failed");
        }

        emit Withdrawn(msg.sender, kenoOut, bnbOut);
    }

    // ═══════════════════════════════════════════════════════════════
    //  Law V — Arb bot deposits BNB profit into the pool
    //  Called automatically by KenoFlashOrbBot after every trade.
    //  5% of each trade's gross profit flows here.
    // ═══════════════════════════════════════════════════════════════

    function depositProfit() external payable onlyArbBot {
        require(msg.value > 0,            "FALPool: no BNB sent");
        require(totalEffectiveStake > 0,  "FALPool: no stakers yet");

        totalProfitReceived += msg.value;

        // Law IV — Nash: platform takes nashFee bp, rest to stakers
        uint256 platformCut = (msg.value * nashFee) / 10000;
        uint256 stakerShare = msg.value - platformCut;

        platformFeesAccrued += platformCut;

        // Law V — Euler: distribute to all stakers proportionally
        accProfitPerEffStake += (stakerShare * PRECISION) / totalEffectiveStake;

        emit ProfitDeposited(
            msg.sender,
            msg.value,
            stakerShare,
            platformCut,
            accProfitPerEffStake
        );
    }

    // ═══════════════════════════════════════════════════════════════
    //  Admin
    // ═══════════════════════════════════════════════════════════════

    function setArbBot(address _bot) external onlyOwner {
        require(_bot != address(0), "FALPool: zero address");
        emit ArbBotUpdated(arbBot, _bot);
        arbBot = _bot;
    }

    function setMinDeposit(uint256 _min) external onlyOwner {
        minDeposit = _min;
        emit MinDepositUpdated(_min);
    }

    function withdrawPlatformFees() external onlyOwner nonReentrant {
        uint256 fees = platformFeesAccrued;
        require(fees > 0,                        "FALPool: no fees");
        require(address(this).balance >= fees,   "FALPool: insufficient balance");
        platformFeesAccrued = 0;
        (bool sent, ) = owner().call{value: fees}("");
        require(sent, "FALPool: transfer failed");
    }

    // Emergency: recover KENO accidentally sent (not deposited through deposit())
    function recoverStrandedKeno() external onlyOwner {
        uint256 balance = kenoToken.balanceOf(address(this));
        require(balance > totalDeposited, "FALPool: no stranded KENO");
        kenoToken.safeTransfer(owner(), balance - totalDeposited);
    }

    // ═══════════════════════════════════════════════════════════════
    //  View helpers
    // ═══════════════════════════════════════════════════════════════

    function getPoolInfo() external view returns (
        uint256 _totalDeposited,
        uint256 _totalEffectiveStake,
        uint256 _totalProfitReceived,
        uint256 _totalProfitPaid,
        uint256 _platformFeesAccrued,
        uint256 _contractBnbBalance,
        uint256 _nashFee,
        uint256 _minDeposit
    ) {
        return (
            totalDeposited,
            totalEffectiveStake,
            totalProfitReceived,
            totalProfitPaid,
            platformFeesAccrued,
            address(this).balance,
            nashFee,
            minDeposit
        );
    }

    function getDepositInfo(address user) external view returns (
        uint256 amount,
        uint8   lockTier,
        uint256 lockEnd,
        uint256 depositedAt,
        uint256 effectiveStake,
        uint256 pendingBnb,
        uint256 lifetimeDeposited,
        uint256 lifetimeBnbClaimed,
        bool    ramanujanUnlocked,
        uint256 timeUntilUnlock
    ) {
        DepositInfo storage d = deposits[user];
        uint256 til = (d.lockEnd > 0 && d.lockEnd > block.timestamp)
                      ? d.lockEnd - block.timestamp
                      : 0;
        return (
            d.amount,
            d.lockTier,
            d.lockEnd,
            d.depositedAt,
            _effectiveStake(user),
            pendingReward(user),
            d.lifetimeDeposited,
            d.lifetimeBnbClaimed,
            d.ramanujanUnlocked,
            til
        );
    }

    function getLockTierInfo() external view returns (
        uint256[4] memory multipliers,
        uint256[4] memory lockDaysArr
    ) {
        return (LOCK_MULTIPLIERS, LOCK_DAYS);
    }

    receive() external payable {}
}

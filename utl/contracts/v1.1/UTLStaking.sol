// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// UTL Staking v1.1 — Fixes UTL-001 (Gas DoS loop) and UTL-003 (zombie stakers)
// Changes from v1.0:
//   - Replaced unbounded _getEffectiveTotalStake() loop with running effectiveTotalStake state variable
//   - Added stakerIndex mapping for O(1) staker removal
//   - Full unstake now removes staker from array via swap-and-pop
//   - Added distributionContract reference for future compoundRewards support
//   - Observer multiplier raised from 0.1x to 0.5x (UTL-007 recommendation)

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract UTLStaking is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable kenoToken;
    address public distributionContract;

    uint256 public totalStaked;
    uint256 public totalRewardsDistributed;
    uint256 public rewardPerTokenStored;
    uint256 public lastRewardTimestamp;

    // FIX UTL-001: Running total replaces unbounded loop
    uint256 public effectiveTotalStake;

    uint256 public constant PRECISION = 1e18;
    uint256 public constant MIN_STAKE = 100 * 1e18;

    enum Tier { Observer, Participant, Advocate, Champion, Guardian }

    struct StakeInfo {
        uint256 amount;
        uint256 stakedAt;
        uint256 rewardPerTokenPaid;
        uint256 pendingRewards;
        Tier tier;
    }

    mapping(address => StakeInfo) public stakes;
    address[] public stakers;
    mapping(address => bool) public isStaker;
    // FIX UTL-003: Index tracking for O(1) removal
    mapping(address => uint256) public stakerIndex;

    uint256[5] public tierThresholds = [
        0,
        1000 * 1e18,
        10000 * 1e18,
        100000 * 1e18,
        1000000 * 1e18
    ];

    // FIX UTL-007: Observer raised from 0.1x to 0.5x to reduce small-staker penalty
    uint256[5] public tierMultipliers = [
        5e17,   // Observer: 0.5x (was 0.1x)
        1e18,   // Participant: 1.0x
        12e17,  // Advocate: 1.2x
        15e17,  // Champion: 1.5x
        2e18    // Guardian: 2.0x
    ];

    event Staked(address indexed user, uint256 amount, Tier tier);
    event Unstaked(address indexed user, uint256 amount);
    event RewardsClaimed(address indexed user, uint256 amount);
    event RewardsDeposited(uint256 amount, uint256 timestamp);
    event TierUpgraded(address indexed user, Tier oldTier, Tier newTier);
    event DistributionContractSet(address indexed newContract);

    constructor(address _kenoToken) Ownable(msg.sender) {
        require(_kenoToken != address(0), "Invalid token");
        kenoToken = IERC20(_kenoToken);
        lastRewardTimestamp = block.timestamp;
    }

    function setDistributionContract(address _dist) external onlyOwner {
        require(_dist != address(0), "Invalid address");
        distributionContract = _dist;
        emit DistributionContractSet(_dist);
    }

    function stake(uint256 amount) external nonReentrant {
        require(amount >= MIN_STAKE || stakes[msg.sender].amount > 0, "Below minimum stake");

        _updateRewards(msg.sender);

        // FIX UTL-001: Remove old effective stake from running total before modifying balance
        if (stakes[msg.sender].amount > 0) {
            effectiveTotalStake -= _getEffectiveStake(msg.sender);
        }

        kenoToken.safeTransferFrom(msg.sender, address(this), amount);

        if (!isStaker[msg.sender]) {
            // FIX UTL-003: Track index for O(1) removal
            stakerIndex[msg.sender] = stakers.length;
            stakers.push(msg.sender);
            isStaker[msg.sender] = true;
            stakes[msg.sender].stakedAt = block.timestamp;
        }

        stakes[msg.sender].amount += amount;
        totalStaked += amount;

        Tier oldTier = stakes[msg.sender].tier;
        Tier newTier = _calculateTier(stakes[msg.sender].amount);
        if (newTier != oldTier) {
            stakes[msg.sender].tier = newTier;
            emit TierUpgraded(msg.sender, oldTier, newTier);
        }

        // FIX UTL-001: Add new effective stake to running total
        effectiveTotalStake += _getEffectiveStake(msg.sender);

        emit Staked(msg.sender, amount, newTier);
    }

    function unstake(uint256 amount) external nonReentrant {
        require(stakes[msg.sender].amount >= amount, "Insufficient stake");

        _updateRewards(msg.sender);

        // FIX UTL-001: Remove old effective stake from running total
        effectiveTotalStake -= _getEffectiveStake(msg.sender);

        stakes[msg.sender].amount -= amount;
        totalStaked -= amount;

        Tier newTier = _calculateTier(stakes[msg.sender].amount);
        stakes[msg.sender].tier = newTier;

        if (stakes[msg.sender].amount == 0) {
            // FIX UTL-003: Remove from array via swap-and-pop, clear isStaker
            _removeStaker(msg.sender);
        } else {
            // Add reduced effective stake back to running total
            effectiveTotalStake += _getEffectiveStake(msg.sender);
        }

        kenoToken.safeTransfer(msg.sender, amount);

        emit Unstaked(msg.sender, amount);
    }

    function claimRewards() external nonReentrant {
        _updateRewards(msg.sender);

        uint256 reward = stakes[msg.sender].pendingRewards;
        require(reward > 0, "No rewards");

        stakes[msg.sender].pendingRewards = 0;
        totalRewardsDistributed += reward;

        (bool sent, ) = msg.sender.call{value: reward}("");
        require(sent, "Reward transfer failed");

        emit RewardsClaimed(msg.sender, reward);
    }

    function depositRewards() external payable onlyOwner {
        require(msg.value > 0, "No rewards");
        require(totalStaked > 0, "No stakers");

        // FIX UTL-001: Use running total, no loop
        rewardPerTokenStored += (msg.value * PRECISION) / _getEffectiveTotalStake();
        lastRewardTimestamp = block.timestamp;

        emit RewardsDeposited(msg.value, block.timestamp);
    }

    // Called by distribution contract for auto-compound routing (UTL-005 future fix)
    function receiveCompoundRewards() external payable nonReentrant {
        require(msg.sender == distributionContract, "Not distribution contract");
        require(msg.value > 0, "No ETH");
        require(totalStaked > 0, "No stakers");

        rewardPerTokenStored += (msg.value * PRECISION) / _getEffectiveTotalStake();
        lastRewardTimestamp = block.timestamp;

        emit RewardsDeposited(msg.value, block.timestamp);
    }

    function getStakeInfo(address user) external view returns (
        uint256 amount,
        uint256 stakedAt,
        uint256 pendingRewards,
        Tier tier,
        uint256 multiplier
    ) {
        StakeInfo storage info = stakes[user];
        uint256 pending = info.pendingRewards;

        if (info.amount > 0 && effectiveTotalStake > 0) {
            uint256 effectiveStake = _getEffectiveStake(user);
            uint256 rewardDiff = rewardPerTokenStored - info.rewardPerTokenPaid;
            pending += (effectiveStake * rewardDiff) / PRECISION;
        }

        return (
            info.amount,
            info.stakedAt,
            pending,
            info.tier,
            tierMultipliers[uint256(info.tier)]
        );
    }

    function getStakerCount() external view returns (uint256) {
        return stakers.length;
    }

    function getEffectiveStake(address user) external view returns (uint256) {
        return _getEffectiveStake(user);
    }

    function getDurationBonus(address user) public view returns (uint256) {
        if (stakes[user].stakedAt == 0) return 0;
        uint256 duration = block.timestamp - stakes[user].stakedAt;

        if (duration >= 365 days) return 50;
        if (duration >= 180 days) return 30;
        if (duration >= 90 days) return 15;
        if (duration >= 30 days) return 5;
        return 0;
    }

    // FIX UTL-008: Transparent fee breakdown
    function calculateFeeBreakdown(uint256 transactionAmount) external view returns (
        uint256 effectiveRate,
        uint256 yourTierMultiplier,
        uint256 durationBonus
    ) {
        uint256 mult = tierMultipliers[uint256(stakes[msg.sender].tier)];
        uint256 bonus = getDurationBonus(msg.sender);
        uint256 rate = (transactionAmount > 0)
            ? ((_getEffectiveStake(msg.sender) * PRECISION) / transactionAmount)
            : 0;
        return (rate, mult, bonus);
    }

    function _updateRewards(address user) internal {
        if (stakes[user].amount > 0 && effectiveTotalStake > 0) {
            uint256 effectiveStake = _getEffectiveStake(user);
            uint256 rewardDiff = rewardPerTokenStored - stakes[user].rewardPerTokenPaid;
            stakes[user].pendingRewards += (effectiveStake * rewardDiff) / PRECISION;
        }
        stakes[user].rewardPerTokenPaid = rewardPerTokenStored;
    }

    function _getEffectiveStake(address user) internal view returns (uint256) {
        uint256 base = stakes[user].amount;
        if (base == 0) return 0;

        uint256 multiplier = tierMultipliers[uint256(stakes[user].tier)];
        uint256 durationBonus = getDurationBonus(user);
        uint256 effective = (base * multiplier) / PRECISION;
        effective += (effective * durationBonus) / 100;

        return effective;
    }

    // FIX UTL-001: Replaced unbounded loop with O(1) state variable lookup
    function _getEffectiveTotalStake() internal view returns (uint256) {
        return effectiveTotalStake > 0 ? effectiveTotalStake : 1;
    }

    // FIX UTL-003: Swap-and-pop removal, O(1) gas regardless of staker count
    function _removeStaker(address user) internal {
        uint256 idx = stakerIndex[user];
        uint256 lastIdx = stakers.length - 1;

        if (idx != lastIdx) {
            address lastStaker = stakers[lastIdx];
            stakers[idx] = lastStaker;
            stakerIndex[lastStaker] = idx;
        }

        stakers.pop();
        delete stakerIndex[user];
        isStaker[user] = false;
    }

    function _calculateTier(uint256 amount) internal view returns (Tier) {
        if (amount >= tierThresholds[4]) return Tier.Guardian;
        if (amount >= tierThresholds[3]) return Tier.Champion;
        if (amount >= tierThresholds[2]) return Tier.Advocate;
        if (amount >= tierThresholds[1]) return Tier.Participant;
        return Tier.Observer;
    }

    // FIX UTL-001: receive() no longer calls _getEffectiveTotalStake() loop
    receive() external payable {
        if (totalStaked > 0 && effectiveTotalStake > 0) {
            rewardPerTokenStored += (msg.value * PRECISION) / effectiveTotalStake;
            lastRewardTimestamp = block.timestamp;
            emit RewardsDeposited(msg.value, block.timestamp);
        }
    }
}

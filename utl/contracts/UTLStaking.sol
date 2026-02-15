// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract UTLStaking is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable kenoToken;

    uint256 public totalStaked;
    uint256 public totalRewardsDistributed;
    uint256 public rewardPerTokenStored;
    uint256 public lastRewardTimestamp;

    uint256 public constant PRECISION = 1e18;
    uint256 public constant MIN_STAKE = 100 * 1e18; // 100 KENO minimum

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

    uint256[5] public tierThresholds = [
        0,                // Observer: 0 KENO
        1000 * 1e18,      // Participant: 1,000 KENO
        10000 * 1e18,     // Advocate: 10,000 KENO
        100000 * 1e18,    // Champion: 100,000 KENO
        1000000 * 1e18    // Guardian: 1,000,000 KENO
    ];

    uint256[5] public tierMultipliers = [
        1e17,   // Observer: 0.1x
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

    constructor(address _kenoToken) Ownable(msg.sender) {
        require(_kenoToken != address(0), "Invalid token");
        kenoToken = IERC20(_kenoToken);
        lastRewardTimestamp = block.timestamp;
    }

    function stake(uint256 amount) external nonReentrant {
        require(amount >= MIN_STAKE || stakes[msg.sender].amount > 0, "Below minimum stake");

        _updateRewards(msg.sender);

        kenoToken.safeTransferFrom(msg.sender, address(this), amount);

        if (!isStaker[msg.sender]) {
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

        emit Staked(msg.sender, amount, newTier);
    }

    function unstake(uint256 amount) external nonReentrant {
        require(stakes[msg.sender].amount >= amount, "Insufficient stake");

        _updateRewards(msg.sender);

        stakes[msg.sender].amount -= amount;
        totalStaked -= amount;

        Tier newTier = _calculateTier(stakes[msg.sender].amount);
        stakes[msg.sender].tier = newTier;

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

        if (totalStaked > 0) {
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

        if (duration >= 365 days) return 50;  // +50% for 1+ year
        if (duration >= 180 days) return 30;  // +30% for 6+ months
        if (duration >= 90 days) return 15;   // +15% for 3+ months
        if (duration >= 30 days) return 5;    // +5% for 1+ month
        return 0;
    }

    function _updateRewards(address user) internal {
        if (stakes[user].amount > 0 && totalStaked > 0) {
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

    function _getEffectiveTotalStake() internal view returns (uint256) {
        uint256 total = 0;
        for (uint256 i = 0; i < stakers.length; i++) {
            if (stakes[stakers[i]].amount > 0) {
                total += _getEffectiveStake(stakers[i]);
            }
        }
        return total > 0 ? total : 1;
    }

    function _calculateTier(uint256 amount) internal view returns (Tier) {
        if (amount >= tierThresholds[4]) return Tier.Guardian;
        if (amount >= tierThresholds[3]) return Tier.Champion;
        if (amount >= tierThresholds[2]) return Tier.Advocate;
        if (amount >= tierThresholds[1]) return Tier.Participant;
        return Tier.Observer;
    }

    receive() external payable {
        if (totalStaked > 0) {
            rewardPerTokenStored += (msg.value * PRECISION) / _getEffectiveTotalStake();
            lastRewardTimestamp = block.timestamp;
            emit RewardsDeposited(msg.value, block.timestamp);
        }
    }
}

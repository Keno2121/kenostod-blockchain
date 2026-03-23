// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title UTLFarm v1.0
 * @notice KENO/BNB LP staking farm — stake PancakeSwap LP tokens, earn KENO rewards
 * @dev Part of the UTL Protocol ecosystem by Kenostod Blockchain Academy LLC
 *
 * Flow:
 *   1. User adds liquidity to KENO/BNB on PancakeSwap → receives LP tokens
 *   2. User stakes LP tokens here → earns KENO per second
 *   3. Rewards are harvested at any time; unstake recovers LP tokens
 *   4. Admin funds the reward pool from Treasury allocation
 */

interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
}

contract UTLFarm {

    // ─── State ───────────────────────────────────────────────────────────────

    address public owner;
    bool    public paused;

    /// @notice KENO token — reward currency
    IERC20 public immutable kenoToken;

    /// @notice PancakeSwap KENO/BNB LP token
    IERC20 public immutable lpToken;

    /// @notice KENO rewarded per second across ALL stakers
    uint256 public rewardRate;

    /// @notice Accumulated KENO per staked LP token (scaled 1e18)
    uint256 public rewardPerTokenStored;

    uint256 public lastUpdateTime;

    /// @notice Total LP tokens currently staked
    uint256 public totalStaked;

    /// @notice KENO available in the reward pool
    uint256 public rewardBalance;

    struct UserInfo {
        uint256 staked;                  // LP tokens staked
        uint256 rewardPerTokenPaid;      // snapshot at last interaction
        uint256 pendingHarvest;          // accrued but unclaimed KENO
    }

    mapping(address => UserInfo) public userInfo;

    // ─── Events ──────────────────────────────────────────────────────────────

    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event Harvested(address indexed user, uint256 amount);
    event RewardsFunded(uint256 amount);
    event RewardRateUpdated(uint256 oldRate, uint256 newRate);
    event Paused(bool state);
    event OwnershipTransferred(address indexed oldOwner, address indexed newOwner);

    // ─── Modifiers ───────────────────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "UTLFarm: not owner");
        _;
    }

    modifier notPaused() {
        require(!paused, "UTLFarm: paused");
        _;
    }

    modifier updateReward(address account) {
        rewardPerTokenStored = _rewardPerToken();
        lastUpdateTime = block.timestamp;
        if (account != address(0)) {
            UserInfo storage u = userInfo[account];
            u.pendingHarvest += _earned(account);
            u.rewardPerTokenPaid = rewardPerTokenStored;
        }
        _;
    }

    // ─── Constructor ─────────────────────────────────────────────────────────

    /**
     * @param _kenoToken  KENO token address
     * @param _lpToken    PancakeSwap KENO/BNB LP token address
     * @param _rewardRate Initial KENO per second (e.g. 0.1 KENO/sec = 100000000000000000)
     */
    constructor(
        address _kenoToken,
        address _lpToken,
        uint256 _rewardRate
    ) {
        require(_kenoToken != address(0), "UTLFarm: zero kenoToken");
        require(_lpToken   != address(0), "UTLFarm: zero lpToken");
        owner        = msg.sender;
        kenoToken    = IERC20(_kenoToken);
        lpToken      = IERC20(_lpToken);
        rewardRate   = _rewardRate;
        lastUpdateTime = block.timestamp;
    }

    // ─── User Functions ──────────────────────────────────────────────────────

    /**
     * @notice Stake LP tokens to earn KENO
     * @param amount Amount of LP tokens to stake
     */
    function stake(uint256 amount)
        external
        notPaused
        updateReward(msg.sender)
    {
        require(amount > 0, "UTLFarm: zero amount");
        UserInfo storage u = userInfo[msg.sender];

        bool ok = lpToken.transferFrom(msg.sender, address(this), amount);
        require(ok, "UTLFarm: LP transfer failed");

        u.staked     += amount;
        totalStaked  += amount;

        emit Staked(msg.sender, amount);
    }

    /**
     * @notice Unstake LP tokens (auto-harvests pending KENO)
     * @param amount Amount of LP tokens to withdraw
     */
    function unstake(uint256 amount)
        external
        updateReward(msg.sender)
    {
        require(amount > 0, "UTLFarm: zero amount");
        UserInfo storage u = userInfo[msg.sender];
        require(u.staked >= amount, "UTLFarm: insufficient stake");

        // Harvest first (CEI pattern)
        uint256 harvest = u.pendingHarvest;
        if (harvest > 0) {
            u.pendingHarvest = 0;
            _sendReward(msg.sender, harvest);
        }

        u.staked    -= amount;
        totalStaked -= amount;

        bool ok = lpToken.transfer(msg.sender, amount);
        require(ok, "UTLFarm: LP return failed");

        emit Unstaked(msg.sender, amount);
        if (harvest > 0) emit Harvested(msg.sender, harvest);
    }

    /**
     * @notice Claim all pending KENO rewards without unstaking
     */
    function harvest()
        external
        updateReward(msg.sender)
    {
        UserInfo storage u = userInfo[msg.sender];
        uint256 amount = u.pendingHarvest;
        require(amount > 0, "UTLFarm: nothing to harvest");

        // CEI: clear state before transfer
        u.pendingHarvest = 0;
        _sendReward(msg.sender, amount);

        emit Harvested(msg.sender, amount);
    }

    // ─── View Functions ──────────────────────────────────────────────────────

    /**
     * @notice Pending KENO rewards for an account
     */
    function pendingRewards(address account) external view returns (uint256) {
        UserInfo storage u = userInfo[account];
        return u.pendingHarvest + _earned(account);
    }

    /**
     * @notice Current APR in basis points (divide by 100 for %)
     * @dev Based on rewardRate, totalStaked, and KENO supply (simplified)
     */
    function aprBasisPoints() external view returns (uint256) {
        if (totalStaked == 0) return 0;
        // annualRewards / totalStaked * 10000
        uint256 annual = rewardRate * 365 days;
        return (annual * 10_000) / totalStaked;
    }

    /**
     * @notice Estimated seconds until reward pool runs dry at current rate
     */
    function rewardPoolRunway() external view returns (uint256) {
        if (rewardRate == 0) return type(uint256).max;
        return rewardBalance / rewardRate;
    }

    // ─── Admin Functions ─────────────────────────────────────────────────────

    /**
     * @notice Add KENO to the reward pool
     * @param amount Amount of KENO to deposit
     */
    function fundRewards(uint256 amount)
        external
        onlyOwner
        updateReward(address(0))
    {
        require(amount > 0, "UTLFarm: zero amount");
        bool ok = kenoToken.transferFrom(msg.sender, address(this), amount);
        require(ok, "UTLFarm: KENO transfer failed");
        rewardBalance += amount;
        emit RewardsFunded(amount);
    }

    /**
     * @notice Update the KENO reward rate
     * @param newRate New KENO per second
     */
    function setRewardRate(uint256 newRate)
        external
        onlyOwner
        updateReward(address(0))
    {
        emit RewardRateUpdated(rewardRate, newRate);
        rewardRate = newRate;
    }

    /**
     * @notice Pause / unpause staking (emergency)
     */
    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit Paused(_paused);
    }

    /**
     * @notice Transfer contract ownership
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "UTLFarm: zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    /**
     * @notice Recover any non-LP, non-KENO tokens sent to this contract by mistake
     */
    function recoverToken(address token, uint256 amount) external onlyOwner {
        require(token != address(lpToken),   "UTLFarm: cannot recover LP");
        require(token != address(kenoToken), "UTLFarm: cannot recover KENO");
        IERC20(token).transfer(owner, amount);
    }

    // ─── Internal ────────────────────────────────────────────────────────────

    function _rewardPerToken() internal view returns (uint256) {
        if (totalStaked == 0) return rewardPerTokenStored;
        uint256 elapsed = block.timestamp - lastUpdateTime;
        uint256 distributed = rewardRate * elapsed;
        // Cap to available reward balance
        if (distributed > rewardBalance) distributed = rewardBalance;
        return rewardPerTokenStored + (distributed * 1e18) / totalStaked;
    }

    function _earned(address account) internal view returns (uint256) {
        UserInfo storage u = userInfo[account];
        uint256 rpt = _rewardPerToken();
        return (u.staked * (rpt - u.rewardPerTokenPaid)) / 1e18;
    }

    function _sendReward(address to, uint256 amount) internal {
        if (amount == 0) return;
        if (amount > rewardBalance) amount = rewardBalance;
        rewardBalance -= amount;
        bool ok = kenoToken.transfer(to, amount);
        require(ok, "UTLFarm: reward transfer failed");
    }
}

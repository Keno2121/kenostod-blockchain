// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title KENOAutoBurn
 * @author Kenostod Blockchain Academy LLC
 * @notice Receives BNB from the King's Shield Aegis Tax cross-chain relay,
 *         auto-buys KENO via PancakeSwap, and burns it to the dead address.
 *
 * Flywheel:
 *   SHIELD bonds sold → SHIELD/SOL LP grows → Aegis Tax collected (Solana)
 *   → Cross-chain relay bridges to BSC → this contract buys + burns KENO
 *   → KENO supply ↓, price ↑ → SHIELD narrative strengthens → loop continues
 *
 * Authorized relayers are whitelisted — only they can trigger burns.
 * Anyone can contribute BNB to the burn fund via receive().
 */
contract KENOAutoBurn is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ── Constants ─────────────────────────────────────────────────────────
    address public constant DEAD = 0x000000000000000000000000000000000000dEaD;

    // PancakeSwap V2 Router on BSC Mainnet
    address public constant PANCAKE_ROUTER = 0x10ED43C718714eb63d5aA57B78B54704E256024E;
    address public constant WBNB           = 0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c;

    // ── State ─────────────────────────────────────────────────────────────
    IERC20 public immutable kenoToken;

    /// @notice Max slippage on PancakeSwap swap (default 500 = 5%)
    uint256 public maxSlippageBps = 500;

    /// @notice Total KENO burned through this contract (ever)
    uint256 public totalKenoBurned;

    /// @notice Total BNB used for burns (ever)
    uint256 public totalBnbUsed;

    /// @notice Number of burn events executed
    uint256 public burnCount;

    /// @notice Addresses authorized to trigger burns (cross-chain relayers)
    mapping(address => bool) public authorizedRelayers;

    // ── Events ────────────────────────────────────────────────────────────
    event KenoBurned(
        address indexed triggeredBy,
        uint256 bnbIn,
        uint256 kenoBurned,
        uint256 totalBurned
    );
    event RelayerAdded(address relayer);
    event RelayerRemoved(address relayer);
    event SlippageUpdated(uint256 newBps);
    event BnbWithdrawn(uint256 amount);

    // ── Modifiers ─────────────────────────────────────────────────────────
    modifier onlyRelayerOrOwner() {
        require(
            authorizedRelayers[msg.sender] || msg.sender == owner(),
            "Not authorized"
        );
        _;
    }

    // ── Constructor ───────────────────────────────────────────────────────
    constructor(
        address _kenoToken,
        address _owner
    ) Ownable(_owner) {
        require(_kenoToken != address(0), "Zero: kenoToken");
        kenoToken = IERC20(_kenoToken);
    }

    // ── Core: Burn ────────────────────────────────────────────────────────

    /**
     * @notice Buy KENO with all BNB held in this contract and burn it.
     *         Called by authorized cross-chain relayers after bridging Aegis Tax.
     * @param minKenoOut Minimum KENO to receive (slippage guard).
     */
    function executeBurn(uint256 minKenoOut)
        external
        nonReentrant
        whenNotPaused
        onlyRelayerOrOwner
    {
        uint256 bnbBalance = address(this).balance;
        require(bnbBalance > 0, "No BNB to burn");

        uint256 kenoBefore = kenoToken.balanceOf(address(this));

        // Swap BNB → KENO via PancakeSwap V2
        address[] memory path = new address[](2);
        path[0] = WBNB;
        path[1] = address(kenoToken);

        IPancakeRouter(PANCAKE_ROUTER).swapExactETHForTokensSupportingFeeOnTransferTokens{
            value: bnbBalance
        }(
            minKenoOut,
            path,
            address(this),
            block.timestamp + 300 // 5-minute deadline
        );

        uint256 kenoReceived = kenoToken.balanceOf(address(this)) - kenoBefore;
        require(kenoReceived > 0, "No KENO received");

        // Burn — transfer to dead address
        kenoToken.safeTransfer(DEAD, kenoReceived);

        totalKenoBurned += kenoReceived;
        totalBnbUsed    += bnbBalance;
        burnCount       += 1;

        emit KenoBurned(msg.sender, bnbBalance, kenoReceived, totalKenoBurned);
    }

    /**
     * @notice Burn a specific BNB amount (partial burn from balance).
     * @param bnbAmount  BNB to use for this burn.
     * @param minKenoOut Minimum KENO to receive.
     */
    function executeBurnAmount(uint256 bnbAmount, uint256 minKenoOut)
        external
        nonReentrant
        whenNotPaused
        onlyRelayerOrOwner
    {
        require(bnbAmount > 0,                     "Amount must be > 0");
        require(address(this).balance >= bnbAmount, "Insufficient BNB balance");

        uint256 kenoBefore = kenoToken.balanceOf(address(this));

        address[] memory path = new address[](2);
        path[0] = WBNB;
        path[1] = address(kenoToken);

        IPancakeRouter(PANCAKE_ROUTER).swapExactETHForTokensSupportingFeeOnTransferTokens{
            value: bnbAmount
        }(
            minKenoOut,
            path,
            address(this),
            block.timestamp + 300
        );

        uint256 kenoReceived = kenoToken.balanceOf(address(this)) - kenoBefore;
        require(kenoReceived > 0, "No KENO received");

        kenoToken.safeTransfer(DEAD, kenoReceived);

        totalKenoBurned += kenoReceived;
        totalBnbUsed    += bnbAmount;
        burnCount       += 1;

        emit KenoBurned(msg.sender, bnbAmount, kenoReceived, totalKenoBurned);
    }

    // ── View ──────────────────────────────────────────────────────────────

    /// @notice Preview: how much KENO would be bought with current BNB balance.
    function getBurnQuote() external view returns (uint256 kenoOut) {
        uint256 bnb = address(this).balance;
        if (bnb == 0) return 0;
        address[] memory path = new address[](2);
        path[0] = WBNB;
        path[1] = address(kenoToken);
        try IPancakeRouter(PANCAKE_ROUTER).getAmountsOut(bnb, path)
            returns (uint256[] memory amounts)
        {
            kenoOut = amounts[1];
        } catch {
            kenoOut = 0;
        }
    }

    /// @notice Stats summary.
    function stats() external view returns (
        uint256 _totalBurned,
        uint256 _totalBnbUsed,
        uint256 _burnCount,
        uint256 _pendingBnb
    ) {
        return (totalKenoBurned, totalBnbUsed, burnCount, address(this).balance);
    }

    // ── Owner ─────────────────────────────────────────────────────────────

    function addRelayer(address relayer) external onlyOwner {
        require(relayer != address(0), "Zero address");
        authorizedRelayers[relayer] = true;
        emit RelayerAdded(relayer);
    }

    function removeRelayer(address relayer) external onlyOwner {
        authorizedRelayers[relayer] = false;
        emit RelayerRemoved(relayer);
    }

    function setMaxSlippage(uint256 bps) external onlyOwner {
        require(bps <= 3000, "Max 30%");
        maxSlippageBps = bps;
        emit SlippageUpdated(bps);
    }

    function pause()   external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    /// @notice Emergency: withdraw BNB if something goes wrong.
    function emergencyWithdrawBnb() external onlyOwner {
        uint256 bal = address(this).balance;
        require(bal > 0, "No BNB");
        (bool sent,) = payable(owner()).call{value: bal}("");
        require(sent, "Transfer failed");
        emit BnbWithdrawn(bal);
    }

    /// @notice Accept BNB from relay bridges, wallets, or direct contributions.
    receive() external payable {}
}

// ── Interface: PancakeSwap V2 Router ─────────────────────────────────────
interface IPancakeRouter {
    function swapExactETHForTokensSupportingFeeOnTransferTokens(
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external payable;

    function getAmountsOut(uint256 amountIn, address[] calldata path)
        external
        view
        returns (uint256[] memory amounts);
}

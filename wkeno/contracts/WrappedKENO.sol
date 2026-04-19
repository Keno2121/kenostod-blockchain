// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

/**
 * @title WrappedKENO
 * @notice Wrapped KENO (wKENO) — Phantom-compatible bridge token
 *         Deployed on Base and Polygon. Backed 1:1 by KENO locked on BSC.
 *
 * @dev Bridge mechanics (Phase 2):
 *      - BSC side:  lock KENO in bridge contract → relayer mints wKENO here
 *      - This side: burn wKENO → relayer releases KENO on BSC
 *
 * @dev Phase 1 (current):
 *      - Owner (T.D.I.R. Foundation treasury) manually mints/burns
 *      - 1:1 peg maintained off-chain via public treasury records
 *      - Full trustless bridge in Phase 2 (automated relayer)
 *
 * BSC KENO contract: 0x — (original BEP-20)
 * Safe wallet / owner: 0x4AA73FadfFd71E6549867a37455EA957A52Cf849
 */
contract WrappedKENO is ERC20, ERC20Burnable, Ownable, ERC20Permit {

    // ── Constants ──────────────────────────────────────────────────
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10**18; // 1 Billion — matches BSC supply

    // ── Bridge state ───────────────────────────────────────────────
    address public bridgeRelayer;           // Phase 2: automated relayer address
    bool    public bridgePaused;            // emergency pause
    uint256 public totalBridgedFromBSC;     // cumulative KENO locked on BSC
    uint256 public totalBridgedToBSC;       // cumulative wKENO burned back

    // ── Events ────────────────────────────────────────────────────
    event BridgeMint(address indexed to, uint256 amount, bytes32 indexed bscTxHash);
    event BridgeBurn(address indexed from, uint256 amount, string bscRecipient);
    event RelayerUpdated(address indexed oldRelayer, address indexed newRelayer);
    event BridgePauseToggled(bool paused);

    // ── Constructor ───────────────────────────────────────────────
    constructor(address _owner)
        ERC20("Wrapped KENO", "wKENO")
        Ownable(_owner)
        ERC20Permit("Wrapped KENO")
    {
        bridgePaused = false;
    }

    // ── Modifiers ─────────────────────────────────────────────────
    modifier onlyBridge() {
        require(
            msg.sender == owner() || msg.sender == bridgeRelayer,
            "wKENO: caller is not bridge"
        );
        _;
    }

    modifier whenBridgeActive() {
        require(!bridgePaused, "wKENO: bridge is paused");
        _;
    }

    // ── Bridge: Mint (BSC → this chain) ──────────────────────────
    /**
     * @notice Mint wKENO when KENO is locked on BSC.
     *         Phase 1: called by owner (manual).
     *         Phase 2: called by automated relayer.
     * @param to          Recipient address on this chain
     * @param amount      Amount of wKENO to mint (18 decimals)
     * @param bscTxHash   BSC lock transaction hash (for audit trail)
     */
    function bridgeMint(
        address to,
        uint256 amount,
        bytes32 bscTxHash
    ) external onlyBridge whenBridgeActive {
        require(to != address(0), "wKENO: mint to zero address");
        require(totalSupply() + amount <= MAX_SUPPLY, "wKENO: exceeds max supply");
        totalBridgedFromBSC += amount;
        _mint(to, amount);
        emit BridgeMint(to, amount, bscTxHash);
    }

    // ── Bridge: Burn (this chain → BSC) ──────────────────────────
    /**
     * @notice Burn wKENO to release KENO on BSC.
     *         User calls this directly — relayer watches the event and
     *         releases KENO to bscRecipient on BSC.
     * @param amount        Amount of wKENO to burn
     * @param bscRecipient  BSC wallet address to receive released KENO
     */
    function bridgeBurn(
        uint256 amount,
        string calldata bscRecipient
    ) external whenBridgeActive {
        require(amount > 0, "wKENO: amount must be > 0");
        require(bytes(bscRecipient).length > 0, "wKENO: BSC recipient required");
        totalBridgedToBSC += amount;
        _burn(msg.sender, amount);
        emit BridgeBurn(msg.sender, amount, bscRecipient);
    }

    // ── Admin ──────────────────────────────────────────────────────
    function setRelayer(address _relayer) external onlyOwner {
        emit RelayerUpdated(bridgeRelayer, _relayer);
        bridgeRelayer = _relayer;
    }

    function toggleBridgePause() external onlyOwner {
        bridgePaused = !bridgePaused;
        emit BridgePauseToggled(bridgePaused);
    }

    // ── View ───────────────────────────────────────────────────────
    function circulatingSupply() external view returns (uint256) {
        return totalSupply();
    }

    function bridgeStats() external view returns (
        uint256 minted,
        uint256 burned,
        uint256 netCirculating,
        bool paused
    ) {
        return (
            totalBridgedFromBSC,
            totalBridgedToBSC,
            totalSupply(),
            bridgePaused
        );
    }
}

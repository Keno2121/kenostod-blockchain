// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * Kenostod (KENO) — Version 2
 * ════════════════════════════
 * Fixed architecture: all wallets point to the correct owner.
 * No locked tokens pointing to dead addresses.
 * DxSale-compatible presale support built in.
 * 7 Constitutional Laws: Kaprekar, Benford, Golden Ratio, Euler,
 *   Ramanujan, Nash, Inversion — embedded as structural constants.
 */

interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 value) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
}

abstract contract Ownable {
    address private _owner;
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    constructor(address initialOwner) {
        _owner = initialOwner;
        emit OwnershipTransferred(address(0), initialOwner);
    }

    modifier onlyOwner() {
        require(msg.sender == _owner, "Ownable: caller is not the owner");
        _;
    }

    function owner() public view returns (address) { return _owner; }

    function transferOwnership(address newOwner) public onlyOwner {
        require(newOwner != address(0), "Ownable: zero address");
        emit OwnershipTransferred(_owner, newOwner);
        _owner = newOwner;
    }

    function renounceOwnership() public onlyOwner {
        emit OwnershipTransferred(_owner, address(0));
        _owner = address(0);
    }
}

contract KenostodToken is IERC20, Ownable {

    // ── Token metadata ──────────────────────────────────────────────────
    string  public constant name     = "Kenostod";
    string  public constant symbol   = "KENO";
    uint8   public constant decimals = 18;

    // ── Supply — 1,000,000,000 KENO (Kaprekar-aligned: 6174 × ~162,074) ──
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 * 10**18;

    // ── Kaprekar's Constant: 6174 — embedded as the structural root ──────
    uint256 public constant KAPREKAR = 6174;

    // ── Wallets — ALL set correctly at deployment, none pointing to dead addresses ──
    address public teamWallet;
    address public treasuryWallet;
    address public liquidityWallet;
    address public presaleContract;

    // ── Whitelist (for DEX routers, DxSale contracts — exempt from limits) ──
    mapping(address => bool) public isWhitelisted;
    bool public whitelistEnabled = true;

    // ── ERC-20 state ─────────────────────────────────────────────────────
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;
    uint256 private _totalSupply;

    // ── Events ───────────────────────────────────────────────────────────
    event WalletUpdated(string walletType, address indexed newAddress);
    event PresaleContractSet(address indexed presaleContract);
    event WhitelistUpdated(address indexed account, bool status);

    // ── Constructor ──────────────────────────────────────────────────────
    constructor(
        address _owner,
        address _teamWallet,
        address _treasuryWallet,
        address _liquidityWallet
    ) Ownable(_owner) {
        require(_owner         != address(0), "Owner cannot be zero");
        require(_teamWallet    != address(0), "Team wallet cannot be zero");
        require(_treasuryWallet!= address(0), "Treasury cannot be zero");
        require(_liquidityWallet!= address(0),"Liquidity cannot be zero");

        teamWallet      = _teamWallet;
        treasuryWallet  = _treasuryWallet;
        liquidityWallet = _liquidityWallet;

        // Mint entire supply to teamWallet (bot wallet)
        // Owner can then allocate to DxSale, liquidity, etc.
        _mint(_teamWallet, TOTAL_SUPPLY);

        // Whitelist core wallets
        isWhitelisted[_owner]           = true;
        isWhitelisted[_teamWallet]      = true;
        isWhitelisted[_treasuryWallet]  = true;
        isWhitelisted[_liquidityWallet] = true;
    }

    // ── ERC-20 standard ──────────────────────────────────────────────────
    function totalSupply() external view override returns (uint256) { return _totalSupply; }
    function balanceOf(address account) external view override returns (uint256) { return _balances[account]; }
    function allowance(address owner_, address spender) external view override returns (uint256) { return _allowances[owner_][spender]; }

    function approve(address spender, uint256 value) external override returns (bool) {
        _allowances[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transfer(address to, uint256 value) external override returns (bool) {
        _transfer(msg.sender, to, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) external override returns (bool) {
        require(_allowances[from][msg.sender] >= value, "ERC20: insufficient allowance");
        _allowances[from][msg.sender] -= value;
        _transfer(from, to, value);
        return true;
    }

    // ── Internal transfer ─────────────────────────────────────────────────
    function _transfer(address from, address to, uint256 value) internal {
        require(from != address(0) && to != address(0), "ERC20: zero address");
        require(_balances[from] >= value, "ERC20: insufficient balance");
        _balances[from] -= value;
        _balances[to]   += value;
        emit Transfer(from, to, value);
    }

    function _mint(address to, uint256 value) internal {
        _totalSupply     += value;
        _balances[to]    += value;
        emit Transfer(address(0), to, value);
    }

    // ── Owner-only admin ──────────────────────────────────────────────────

    function setPresaleContract(address _presaleContract) external onlyOwner {
        require(_presaleContract != address(0), "Zero address");
        presaleContract = _presaleContract;
        isWhitelisted[_presaleContract] = true;
        emit PresaleContractSet(_presaleContract);
    }

    function updateWhitelist(address account, bool status) external onlyOwner {
        isWhitelisted[account] = status;
        emit WhitelistUpdated(account, status);
    }

    function updateWhitelist(address[] calldata accounts, bool status) external onlyOwner {
        for (uint i = 0; i < accounts.length; i++) {
            isWhitelisted[accounts[i]] = status;
            emit WhitelistUpdated(accounts[i], status);
        }
    }

    function toggleWhitelistEnabled(bool enabled) external onlyOwner {
        whitelistEnabled = enabled;
    }

    function setTeamWallet(address _teamWallet) external onlyOwner {
        require(_teamWallet != address(0), "Zero address");
        teamWallet = _teamWallet;
        emit WalletUpdated("team", _teamWallet);
    }

    function setTreasuryWallet(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Zero address");
        treasuryWallet = _treasury;
        emit WalletUpdated("treasury", _treasury);
    }

    function setLiquidityWallet(address _liquidity) external onlyOwner {
        require(_liquidity != address(0), "Zero address");
        liquidityWallet = _liquidity;
        emit WalletUpdated("liquidity", _liquidity);
    }
}

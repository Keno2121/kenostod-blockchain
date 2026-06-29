// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract KENO is ERC20, ERC20Burnable, ERC20Pausable, Ownable {
    
    uint256 public constant MAX_SUPPLY = 1000000000 * 10**18;
    uint256 public constant ICO_SUPPLY = 300000000 * 10**18;
    uint256 public constant TEAM_SUPPLY = 100000000 * 10**18;
    uint256 public constant LIQUIDITY_SUPPLY = 50000000 * 10**18;
    uint256 public constant TREASURY_SUPPLY = 550000000 * 10**18;
    
    uint256 public teamReleaseTime;
    uint256 public constant TEAM_LOCK_DURATION = 365 days;
    
    address public teamWallet;
    address public treasuryWallet;
    address public liquidityWallet;
    address public presaleContract;
    
    mapping(address => bool) public isWhitelisted;
    bool public whitelistEnabled = true;
    
    event WhitelistUpdated(address indexed account, bool status);
    event WhitelistToggled(bool enabled);
    event TeamTokensReleased(uint256 amount);
    
    constructor(
        address _teamWallet,
        address _treasuryWallet,
        address _liquidityWallet,
        address _icoWallet
    ) ERC20("Kenostod Token", "KENO") Ownable(msg.sender) {
        require(_teamWallet != address(0), "Team wallet cannot be zero address");
        require(_treasuryWallet != address(0), "Treasury wallet cannot be zero address");
        require(_liquidityWallet != address(0), "Liquidity wallet cannot be zero address");
        require(_icoWallet != address(0), "ICO wallet cannot be zero address");
        
        teamWallet = _teamWallet;
        treasuryWallet = _treasuryWallet;
        liquidityWallet = _liquidityWallet;
        
        teamReleaseTime = block.timestamp + TEAM_LOCK_DURATION;
        
        _mint(_icoWallet, ICO_SUPPLY);
        _mint(treasuryWallet, TREASURY_SUPPLY);
        _mint(liquidityWallet, LIQUIDITY_SUPPLY);
        _mint(address(this), TEAM_SUPPLY);
    }
    
    function updateWhitelist(address account, bool status) external onlyOwner {
        isWhitelisted[account] = status;
        emit WhitelistUpdated(account, status);
    }
    
    function updateWhitelistBatch(address[] calldata accounts, bool status) external onlyOwner {
        for (uint256 i = 0; i < accounts.length; i++) {
            isWhitelisted[accounts[i]] = status;
            emit WhitelistUpdated(accounts[i], status);
        }
    }
    
    function toggleWhitelist(bool enabled) external onlyOwner {
        whitelistEnabled = enabled;
        emit WhitelistToggled(enabled);
    }
    
    function setPresaleContract(address _presaleContract) external onlyOwner {
        require(_presaleContract != address(0), "Invalid presale address");
        presaleContract = _presaleContract;
        isWhitelisted[_presaleContract] = true;
    }
    
    function releaseTeamTokens() external {
        require(block.timestamp >= teamReleaseTime, "Team tokens are still locked");
        uint256 balance = balanceOf(address(this));
        require(balance > 0, "No team tokens to release");
        
        _transfer(address(this), teamWallet, balance);
        emit TeamTokensReleased(balance);
    }
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
    function _update(address from, address to, uint256 value)
        internal
        virtual
        override(ERC20, ERC20Pausable)
    {
        if (whitelistEnabled && from != address(0) && to != address(0)) {
            require(
                isWhitelisted[from] || 
                isWhitelisted[to] || 
                from == owner() || 
                to == owner() ||
                from == presaleContract ||
                to == presaleContract,
                "Transfer not allowed: address not whitelisted"
            );
        }
        
        super._update(from, to, value);
    }
}

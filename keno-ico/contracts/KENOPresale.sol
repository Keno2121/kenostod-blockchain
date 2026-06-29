// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract KENOPresale is Ownable, ReentrancyGuard, Pausable {
    
    IERC20 public kenoToken;
    
    uint256 public constant PRIVATE_SALE_PRICE = 0.00001 ether;
    uint256 public constant PUBLIC_SALE_PRICE = 0.00005 ether;
    
    uint256 public constant MIN_PURCHASE = 0.01 ether;
    uint256 public constant MAX_PURCHASE_PRIVATE = 5 ether;
    uint256 public constant MAX_PURCHASE_PUBLIC = 2 ether;
    
    uint256 public privateSaleStart;
    uint256 public privateSaleEnd;
    uint256 public publicSaleStart;
    uint256 public publicSaleEnd;
    
    uint256 public privateSaleCap = 50000000 * 10**18;
    uint256 public publicSaleCap = 250000000 * 10**18;
    
    uint256 public totalTokensSoldPrivate;
    uint256 public totalTokensSoldPublic;
    uint256 public totalEthRaised;
    
    mapping(address => bool) public isWhitelisted;
    mapping(address => uint256) public purchasedAmountPrivate;
    mapping(address => uint256) public purchasedAmountPublic;
    
    bool public presaleFinalized = false;
    
    event TokensPurchased(
        address indexed buyer,
        uint256 ethAmount,
        uint256 tokenAmount,
        bool isPrivateSale
    );
    event WhitelistUpdated(address indexed account, bool status);
    event PresaleFinalized(uint256 totalRaised, uint256 totalSold);
    event FundsWithdrawn(address indexed to, uint256 amount);
    event UnsoldTokensWithdrawn(uint256 amount);
    
    constructor(
        address _kenoToken,
        uint256 _privateSaleStart,
        uint256 _privateSaleDuration,
        uint256 _publicSaleStart,
        uint256 _publicSaleDuration
    ) Ownable(msg.sender) {
        require(_kenoToken != address(0), "Invalid token address");
        require(_privateSaleStart > block.timestamp, "Private sale must start in future");
        require(_publicSaleStart > _privateSaleStart + _privateSaleDuration, "Public sale must start after private sale");
        
        kenoToken = IERC20(_kenoToken);
        
        privateSaleStart = _privateSaleStart;
        privateSaleEnd = _privateSaleStart + _privateSaleDuration;
        publicSaleStart = _publicSaleStart;
        publicSaleEnd = _publicSaleStart + _publicSaleDuration;
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
    
    function buyTokens() external payable nonReentrant whenNotPaused {
        require(!presaleFinalized, "Presale has been finalized");
        require(msg.value >= MIN_PURCHASE, "Purchase amount too low");
        
        bool isPrivateSale = block.timestamp >= privateSaleStart && block.timestamp <= privateSaleEnd;
        bool isPublicSale = block.timestamp >= publicSaleStart && block.timestamp <= publicSaleEnd;
        
        require(isPrivateSale || isPublicSale, "No active sale period");
        
        if (isPrivateSale) {
            require(isWhitelisted[msg.sender], "Not whitelisted for private sale");
            require(
                purchasedAmountPrivate[msg.sender] + msg.value <= MAX_PURCHASE_PRIVATE,
                "Exceeds private sale purchase limit"
            );
            
            uint256 tokenAmount = (msg.value * 10**18) / PRIVATE_SALE_PRICE;
            require(totalTokensSoldPrivate + tokenAmount <= privateSaleCap, "Private sale cap exceeded");
            
            purchasedAmountPrivate[msg.sender] += msg.value;
            totalTokensSoldPrivate += tokenAmount;
            totalEthRaised += msg.value;
            
            require(kenoToken.transfer(msg.sender, tokenAmount), "Token transfer failed");
            
            emit TokensPurchased(msg.sender, msg.value, tokenAmount, true);
            
        } else if (isPublicSale) {
            require(
                purchasedAmountPublic[msg.sender] + msg.value <= MAX_PURCHASE_PUBLIC,
                "Exceeds public sale purchase limit"
            );
            
            uint256 tokenAmount = (msg.value * 10**18) / PUBLIC_SALE_PRICE;
            require(totalTokensSoldPublic + tokenAmount <= publicSaleCap, "Public sale cap exceeded");
            
            purchasedAmountPublic[msg.sender] += msg.value;
            totalTokensSoldPublic += tokenAmount;
            totalEthRaised += msg.value;
            
            require(kenoToken.transfer(msg.sender, tokenAmount), "Token transfer failed");
            
            emit TokensPurchased(msg.sender, msg.value, tokenAmount, false);
        }
    }
    
    function finalizePresale() external onlyOwner {
        require(block.timestamp > publicSaleEnd, "Public sale not ended yet");
        require(!presaleFinalized, "Presale already finalized");
        
        presaleFinalized = true;
        emit PresaleFinalized(totalEthRaised, totalTokensSoldPrivate + totalTokensSoldPublic);
    }
    
    function withdrawFunds() external onlyOwner {
        require(presaleFinalized, "Presale not finalized");
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");
        
        (bool success, ) = payable(owner()).call{value: balance}("");
        require(success, "Withdrawal failed");
        
        emit FundsWithdrawn(owner(), balance);
    }
    
    function withdrawUnsoldTokens() external onlyOwner {
        require(presaleFinalized, "Presale not finalized");
        uint256 unsoldTokens = kenoToken.balanceOf(address(this));
        require(unsoldTokens > 0, "No unsold tokens");
        
        require(kenoToken.transfer(owner(), unsoldTokens), "Token transfer failed");
        
        emit UnsoldTokensWithdrawn(unsoldTokens);
    }
    
    function extendSale(bool isPrivate, uint256 newEndTime) external onlyOwner {
        require(newEndTime > block.timestamp, "New end time must be in future");
        
        if (isPrivate) {
            require(newEndTime > privateSaleEnd, "Can only extend, not shorten");
            privateSaleEnd = newEndTime;
        } else {
            require(newEndTime > publicSaleEnd, "Can only extend, not shorten");
            publicSaleEnd = newEndTime;
        }
    }
    
    function pausePresale() external onlyOwner {
        _pause();
    }
    
    function unpausePresale() external onlyOwner {
        _unpause();
    }
    
    function getCurrentPrice() external view returns (uint256) {
        if (block.timestamp >= privateSaleStart && block.timestamp <= privateSaleEnd) {
            return PRIVATE_SALE_PRICE;
        } else if (block.timestamp >= publicSaleStart && block.timestamp <= publicSaleEnd) {
            return PUBLIC_SALE_PRICE;
        } else {
            return 0;
        }
    }
    
    function getPresaleStatus() external view returns (
        bool privateSaleActive,
        bool publicSaleActive,
        uint256 privateTokensSold,
        uint256 publicTokensSold,
        uint256 totalRaised,
        bool finalized
    ) {
        privateSaleActive = block.timestamp >= privateSaleStart && block.timestamp <= privateSaleEnd;
        publicSaleActive = block.timestamp >= publicSaleStart && block.timestamp <= publicSaleEnd;
        privateTokensSold = totalTokensSoldPrivate;
        publicTokensSold = totalTokensSoldPublic;
        totalRaised = totalEthRaised;
        finalized = presaleFinalized;
    }
    
    receive() external payable {
        revert("Use buyTokens() function");
    }
}

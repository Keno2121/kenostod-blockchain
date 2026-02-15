// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract UTLFeeCollector is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant FEE_DENOMINATOR = 10000;
    uint256 public feeRate = 10; // 0.1% = 10 basis points
    uint256 public minFee = 0.0001 ether;
    uint256 public maxFee = 1 ether;

    address public treasury;
    address public distributionContract;

    uint256 public totalFeesCollectedNative;
    uint256 public totalTransactionsProcessed;

    mapping(address => uint256) public tokenFeesCollected;
    mapping(address => bool) public supportedTokens;
    mapping(address => uint256) public userTransactionCount;
    mapping(address => uint256) public userTotalFeesPaid;

    address[] public supportedTokenList;

    event NativeFeeCollected(
        address indexed user,
        uint256 transactionAmount,
        uint256 feeAmount,
        uint256 timestamp
    );

    event TokenFeeCollected(
        address indexed user,
        address indexed token,
        uint256 transactionAmount,
        uint256 feeAmount,
        uint256 timestamp
    );

    event FeesForwarded(
        address indexed destination,
        uint256 nativeAmount,
        uint256 timestamp
    );

    event TokenFeesForwarded(
        address indexed destination,
        address indexed token,
        uint256 amount,
        uint256 timestamp
    );

    event FeeRateUpdated(uint256 oldRate, uint256 newRate);
    event TreasuryUpdated(address oldTreasury, address newTreasury);
    event TokenAdded(address indexed token);
    event TokenRemoved(address indexed token);

    constructor(address _treasury, address _distributionContract) Ownable(msg.sender) {
        require(_treasury != address(0), "Invalid treasury");
        require(_distributionContract != address(0), "Invalid distribution");
        treasury = _treasury;
        distributionContract = _distributionContract;
    }

    function collectNativeFee() external payable nonReentrant {
        require(msg.value > 0, "No value sent");

        uint256 fee = calculateFee(msg.value);
        require(fee > 0, "Fee too small");

        totalFeesCollectedNative += fee;
        totalTransactionsProcessed++;
        userTransactionCount[msg.sender]++;
        userTotalFeesPaid[msg.sender] += fee;

        uint256 remainder = msg.value - fee;
        if (remainder > 0) {
            (bool sent, ) = msg.sender.call{value: remainder}("");
            require(sent, "Refund failed");
        }

        emit NativeFeeCollected(msg.sender, msg.value, fee, block.timestamp);
    }

    function collectTokenFee(address token, uint256 amount) external nonReentrant {
        require(supportedTokens[token], "Token not supported");
        require(amount > 0, "Zero amount");

        uint256 fee = (amount * feeRate) / FEE_DENOMINATOR;
        require(fee > 0, "Fee too small");

        IERC20(token).safeTransferFrom(msg.sender, address(this), fee);

        tokenFeesCollected[token] += fee;
        totalTransactionsProcessed++;
        userTransactionCount[msg.sender]++;

        emit TokenFeeCollected(msg.sender, token, amount, fee, block.timestamp);
    }

    function processTransactionWithFee(address recipient) external payable nonReentrant {
        require(msg.value > 0, "No value sent");
        require(recipient != address(0), "Invalid recipient");

        uint256 fee = calculateFee(msg.value);
        uint256 transferAmount = msg.value - fee;

        totalFeesCollectedNative += fee;
        totalTransactionsProcessed++;
        userTransactionCount[msg.sender]++;
        userTotalFeesPaid[msg.sender] += fee;

        (bool sent, ) = recipient.call{value: transferAmount}("");
        require(sent, "Transfer failed");

        emit NativeFeeCollected(msg.sender, msg.value, fee, block.timestamp);
    }

    function forwardFeesToTreasury() external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        require(balance > 0, "No fees to forward");

        uint256 treasuryShare = (balance * 40) / 100;    // 40% to treasury (ops + scholarships + TDIR)
        uint256 distributionShare = balance - treasuryShare; // 60% to staker distribution

        (bool sent1, ) = treasury.call{value: treasuryShare}("");
        require(sent1, "Treasury transfer failed");

        (bool sent2, ) = distributionContract.call{value: distributionShare}("");
        require(sent2, "Distribution transfer failed");

        emit FeesForwarded(treasury, treasuryShare, block.timestamp);
        emit FeesForwarded(distributionContract, distributionShare, block.timestamp);
    }

    function forwardTokenFees(address token) external onlyOwner nonReentrant {
        require(supportedTokens[token], "Token not supported");
        uint256 balance = IERC20(token).balanceOf(address(this));
        require(balance > 0, "No token fees");

        uint256 treasuryShare = (balance * 40) / 100;
        uint256 distributionShare = balance - treasuryShare;

        IERC20(token).safeTransfer(treasury, treasuryShare);
        IERC20(token).safeTransfer(distributionContract, distributionShare);

        emit TokenFeesForwarded(treasury, token, treasuryShare, block.timestamp);
        emit TokenFeesForwarded(distributionContract, token, distributionShare, block.timestamp);
    }

    function calculateFee(uint256 amount) public view returns (uint256) {
        uint256 fee = (amount * feeRate) / FEE_DENOMINATOR;
        if (fee < minFee) fee = minFee;
        if (fee > maxFee) fee = maxFee;
        if (fee > amount) fee = amount;
        return fee;
    }

    function addSupportedToken(address token) external onlyOwner {
        require(token != address(0), "Invalid token");
        require(!supportedTokens[token], "Already supported");
        supportedTokens[token] = true;
        supportedTokenList.push(token);
        emit TokenAdded(token);
    }

    function removeSupportedToken(address token) external onlyOwner {
        require(supportedTokens[token], "Not supported");
        supportedTokens[token] = false;
        emit TokenRemoved(token);
    }

    function setFeeRate(uint256 newRate) external onlyOwner {
        require(newRate <= 100, "Fee too high"); // Max 1%
        uint256 oldRate = feeRate;
        feeRate = newRate;
        emit FeeRateUpdated(oldRate, newRate);
    }

    function setFeeBounds(uint256 _minFee, uint256 _maxFee) external onlyOwner {
        require(_minFee < _maxFee, "Invalid bounds");
        minFee = _minFee;
        maxFee = _maxFee;
    }

    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid address");
        address old = treasury;
        treasury = _treasury;
        emit TreasuryUpdated(old, _treasury);
    }

    function setDistributionContract(address _distribution) external onlyOwner {
        require(_distribution != address(0), "Invalid address");
        distributionContract = _distribution;
    }

    function getStats() external view returns (
        uint256 _totalFeesNative,
        uint256 _totalTransactions,
        uint256 _currentBalance,
        uint256 _feeRate
    ) {
        return (
            totalFeesCollectedNative,
            totalTransactionsProcessed,
            address(this).balance,
            feeRate
        );
    }

    function getUserStats(address user) external view returns (
        uint256 _transactionCount,
        uint256 _totalFeesPaid
    ) {
        return (userTransactionCount[user], userTotalFeesPaid[user]);
    }

    function getSupportedTokens() external view returns (address[] memory) {
        return supportedTokenList;
    }

    receive() external payable {
        totalFeesCollectedNative += msg.value;
        totalTransactionsProcessed++;
        emit NativeFeeCollected(msg.sender, msg.value, msg.value, block.timestamp);
    }
}

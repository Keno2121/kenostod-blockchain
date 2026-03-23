// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract UTLTreasury is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public kenostodOperations;
    address public scholarshipFund;
    address public tdirFoundation;
    address public insuranceReserve;

    uint256 public constant ALLOCATION_DENOMINATOR = 1000;
    uint256 public kenostodAllocation = 375;   // 37.5% of treasury (15% of total fees)
    uint256 public scholarshipAllocation = 250; // 25% of treasury (10% of total fees)
    uint256 public tdirAllocation = 250;        // 25% of treasury (10% of total fees)
    uint256 public insuranceAllocation = 125;   // 12.5% of treasury (5% of total fees)

    uint256 public totalReceived;
    uint256 public totalDistributed;

    uint256 public constant TIMELOCK_DURATION = 48 hours;

    struct PendingWithdrawal {
        address destination;
        uint256 amount;
        address token;
        uint256 executeAfter;
        bool executed;
        bool cancelled;
    }

    PendingWithdrawal[] public pendingWithdrawals;

    mapping(address => bool) public authorizedCollectors;

    event FundsReceived(address indexed from, uint256 amount, uint256 timestamp);
    event FundsDistributed(
        uint256 kenostodAmount,
        uint256 scholarshipAmount,
        uint256 tdirAmount,
        uint256 insuranceAmount,
        uint256 timestamp
    );
    event WithdrawalQueued(uint256 indexed id, address destination, uint256 amount, uint256 executeAfter);
    event WithdrawalExecuted(uint256 indexed id);
    event WithdrawalCancelled(uint256 indexed id);
    event CollectorAuthorized(address indexed collector);
    event CollectorRevoked(address indexed collector);

    modifier onlyAuthorized() {
        require(authorizedCollectors[msg.sender] || msg.sender == owner(), "Not authorized");
        _;
    }

    constructor(
        address _kenostodOps,
        address _scholarshipFund,
        address _tdirFoundation,
        address _insuranceReserve
    ) Ownable(msg.sender) {
        require(_kenostodOps != address(0), "Invalid kenostod ops");
        require(_scholarshipFund != address(0), "Invalid scholarship");
        require(_tdirFoundation != address(0), "Invalid TDIR");
        require(_insuranceReserve != address(0), "Invalid insurance");

        kenostodOperations = _kenostodOps;
        scholarshipFund = _scholarshipFund;
        tdirFoundation = _tdirFoundation;
        insuranceReserve = _insuranceReserve;
    }

    function distributeNativeFunds() external onlyAuthorized nonReentrant {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to distribute");

        uint256 kenostodAmount = (balance * kenostodAllocation) / ALLOCATION_DENOMINATOR;
        uint256 scholarshipAmount = (balance * scholarshipAllocation) / ALLOCATION_DENOMINATOR;
        uint256 tdirAmount = (balance * tdirAllocation) / ALLOCATION_DENOMINATOR;
        uint256 insuranceAmount = balance - kenostodAmount - scholarshipAmount - tdirAmount;

        _safeTransferNative(kenostodOperations, kenostodAmount);
        _safeTransferNative(scholarshipFund, scholarshipAmount);
        _safeTransferNative(tdirFoundation, tdirAmount);
        _safeTransferNative(insuranceReserve, insuranceAmount);

        totalDistributed += balance;

        emit FundsDistributed(
            kenostodAmount,
            scholarshipAmount,
            tdirAmount,
            insuranceAmount,
            block.timestamp
        );
    }

    function distributeTokenFunds(address token) external onlyAuthorized nonReentrant {
        uint256 balance = IERC20(token).balanceOf(address(this));
        require(balance > 0, "No token funds");

        uint256 kenostodAmount = (balance * kenostodAllocation) / ALLOCATION_DENOMINATOR;
        uint256 scholarshipAmount = (balance * scholarshipAllocation) / ALLOCATION_DENOMINATOR;
        uint256 tdirAmount = (balance * tdirAllocation) / ALLOCATION_DENOMINATOR;
        uint256 insuranceAmount = balance - kenostodAmount - scholarshipAmount - tdirAmount;

        IERC20(token).safeTransfer(kenostodOperations, kenostodAmount);
        IERC20(token).safeTransfer(scholarshipFund, scholarshipAmount);
        IERC20(token).safeTransfer(tdirFoundation, tdirAmount);
        IERC20(token).safeTransfer(insuranceReserve, insuranceAmount);
    }

    function queueWithdrawal(address destination, uint256 amount, address token) external onlyOwner {
        require(destination != address(0), "Invalid destination");
        require(amount > 0, "Zero amount");

        uint256 executeAfter = block.timestamp + TIMELOCK_DURATION;

        pendingWithdrawals.push(PendingWithdrawal({
            destination: destination,
            amount: amount,
            token: token,
            executeAfter: executeAfter,
            executed: false,
            cancelled: false
        }));

        uint256 id = pendingWithdrawals.length - 1;
        emit WithdrawalQueued(id, destination, amount, executeAfter);
    }

    function executeWithdrawal(uint256 id) external onlyOwner nonReentrant {
        require(id < pendingWithdrawals.length, "Invalid ID");
        PendingWithdrawal storage w = pendingWithdrawals[id];

        require(!w.executed, "Already executed");
        require(!w.cancelled, "Cancelled");
        require(block.timestamp >= w.executeAfter, "Timelock active");

        w.executed = true;

        if (w.token == address(0)) {
            _safeTransferNative(w.destination, w.amount);
        } else {
            IERC20(w.token).safeTransfer(w.destination, w.amount);
        }

        emit WithdrawalExecuted(id);
    }

    function cancelWithdrawal(uint256 id) external onlyOwner {
        require(id < pendingWithdrawals.length, "Invalid ID");
        PendingWithdrawal storage w = pendingWithdrawals[id];
        require(!w.executed, "Already executed");
        require(!w.cancelled, "Already cancelled");

        w.cancelled = true;
        emit WithdrawalCancelled(id);
    }

    function authorizeCollector(address collector) external onlyOwner {
        require(collector != address(0), "Invalid address");
        authorizedCollectors[collector] = true;
        emit CollectorAuthorized(collector);
    }

    function revokeCollector(address collector) external onlyOwner {
        authorizedCollectors[collector] = false;
        emit CollectorRevoked(collector);
    }

    function updateAllocations(
        uint256 _kenostod,
        uint256 _scholarship,
        uint256 _tdir,
        uint256 _insurance
    ) external onlyOwner {
        require(
            _kenostod + _scholarship + _tdir + _insurance == ALLOCATION_DENOMINATOR,
            "Must total 1000"
        );
        kenostodAllocation = _kenostod;
        scholarshipAllocation = _scholarship;
        tdirAllocation = _tdir;
        insuranceAllocation = _insurance;
    }

    function updateRecipients(
        address _kenostodOps,
        address _scholarshipFund,
        address _tdirFoundation,
        address _insuranceReserve
    ) external onlyOwner {
        if (_kenostodOps != address(0)) kenostodOperations = _kenostodOps;
        if (_scholarshipFund != address(0)) scholarshipFund = _scholarshipFund;
        if (_tdirFoundation != address(0)) tdirFoundation = _tdirFoundation;
        if (_insuranceReserve != address(0)) insuranceReserve = _insuranceReserve;
    }

    function getBalances() external view returns (uint256 native) {
        return address(this).balance;
    }

    function getTokenBalance(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }

    function getPendingWithdrawalsCount() external view returns (uint256) {
        return pendingWithdrawals.length;
    }

    function _safeTransferNative(address to, uint256 amount) internal {
        (bool success, ) = to.call{value: amount}("");
        require(success, "Native transfer failed");
    }

    receive() external payable {
        totalReceived += msg.value;
        emit FundsReceived(msg.sender, msg.value, block.timestamp);
    }
}

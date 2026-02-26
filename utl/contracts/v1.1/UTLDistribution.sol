// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// UTL Distribution v1.1 — Fixes UTL-005 (auto-compound pathway) and UTL-006 (unbounded loop)
// Changes from v1.0:
//   - Auto-compound now calls receiveCompoundRewards() on staking contract instead of raw ETH send
//   - Added autoCompoundEnabled global toggle (owner-controlled)
//   - getUnclaimedEpochs() now accepts fromEpoch and limit for paginated queries
//   - batchClaim() caches epoch storage reference to reduce SLOADs (UTL-010)
//   - Added IUTLStaking interface for type-safe compoundRewards call

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// FIX UTL-005: Typed interface instead of raw call
interface IUTLStaking {
    function receiveCompoundRewards() external payable;
}

contract UTLDistribution is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public stakingContract;

    // FIX UTL-005: Global auto-compound toggle controlled by owner
    bool public autoCompoundEnabled;

    struct DistributionEpoch {
        bytes32 merkleRoot;
        uint256 totalAmount;
        uint256 claimedAmount;
        uint256 startTime;
        uint256 endTime;
        bool finalized;
    }

    uint256 public currentEpoch;
    mapping(uint256 => DistributionEpoch) public epochs;
    mapping(uint256 => mapping(address => bool)) public claimed;

    uint256 public totalDistributed;
    uint256 public totalClaimed;

    mapping(address => bool) public userAutoCompound;

    event EpochCreated(uint256 indexed epoch, bytes32 merkleRoot, uint256 totalAmount);
    event RewardClaimed(address indexed user, uint256 indexed epoch, uint256 amount);
    event BatchClaimed(address indexed user, uint256[] epochs, uint256 totalAmount);
    event AutoCompoundToggled(address indexed user, bool enabled);
    event GlobalAutoCompoundSet(bool enabled);
    event FundsReceived(uint256 amount, uint256 timestamp);

    constructor(address _stakingContract) Ownable(msg.sender) {
        require(_stakingContract != address(0), "Invalid staking contract");
        stakingContract = _stakingContract;
        autoCompoundEnabled = false;
    }

    function createEpoch(
        bytes32 _merkleRoot,
        uint256 _duration
    ) external payable onlyOwner {
        require(msg.value > 0, "No funds for epoch");
        require(_merkleRoot != bytes32(0), "Invalid merkle root");

        currentEpoch++;

        epochs[currentEpoch] = DistributionEpoch({
            merkleRoot: _merkleRoot,
            totalAmount: msg.value,
            claimedAmount: 0,
            startTime: block.timestamp,
            endTime: block.timestamp + _duration,
            finalized: true
        });

        totalDistributed += msg.value;

        emit EpochCreated(currentEpoch, _merkleRoot, msg.value);
    }

    function claim(
        uint256 epoch,
        uint256 amount,
        bytes32[] calldata proof
    ) external nonReentrant {
        require(epoch <= currentEpoch, "Invalid epoch");
        require(!claimed[epoch][msg.sender], "Already claimed");

        DistributionEpoch storage ep = epochs[epoch];
        require(ep.finalized, "Epoch not finalized");
        require(block.timestamp <= ep.endTime, "Epoch expired");

        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, amount));
        require(MerkleProof.verify(proof, ep.merkleRoot, leaf), "Invalid proof");

        claimed[epoch][msg.sender] = true;
        require(ep.claimedAmount + amount <= ep.totalAmount, "Epoch funds exceeded");
        ep.claimedAmount += amount;
        totalClaimed += amount;

        // FIX UTL-005: Use typed interface call instead of raw ETH send for auto-compound
        if (autoCompoundEnabled && userAutoCompound[msg.sender]) {
            IUTLStaking(stakingContract).receiveCompoundRewards{value: amount}();
        } else {
            (bool sent, ) = msg.sender.call{value: amount}("");
            require(sent, "Claim transfer failed");
        }

        emit RewardClaimed(msg.sender, epoch, amount);
    }

    // FIX UTL-010: Cache epoch storage reference, reducing SLOADs per iteration
    function batchClaim(
        uint256[] calldata epochIds,
        uint256[] calldata amounts,
        bytes32[][] calldata proofs
    ) external nonReentrant {
        require(epochIds.length == amounts.length, "Length mismatch");
        require(epochIds.length == proofs.length, "Length mismatch");
        require(epochIds.length <= 50, "Batch too large");

        uint256 totalAmount = 0;

        for (uint256 i = 0; i < epochIds.length; i++) {
            uint256 epoch = epochIds[i];
            require(epoch <= currentEpoch, "Invalid epoch");
            require(!claimed[epoch][msg.sender], "Already claimed");

            // FIX UTL-010: Single storage reference per iteration
            DistributionEpoch storage ep = epochs[epoch];
            uint256 epEndTime = ep.endTime;
            bytes32 epMerkleRoot = ep.merkleRoot;
            uint256 epTotalAmount = ep.totalAmount;
            uint256 epClaimedAmount = ep.claimedAmount;

            require(ep.finalized, "Not finalized");
            require(block.timestamp <= epEndTime, "Expired");

            bytes32 leaf = keccak256(abi.encodePacked(msg.sender, amounts[i]));
            require(MerkleProof.verify(proofs[i], epMerkleRoot, leaf), "Invalid proof");

            claimed[epoch][msg.sender] = true;
            require(epClaimedAmount + amounts[i] <= epTotalAmount, "Epoch funds exceeded");
            ep.claimedAmount = epClaimedAmount + amounts[i];
            totalAmount += amounts[i];
        }

        totalClaimed += totalAmount;

        // FIX UTL-005: Use typed interface call for auto-compound
        if (autoCompoundEnabled && userAutoCompound[msg.sender]) {
            IUTLStaking(stakingContract).receiveCompoundRewards{value: totalAmount}();
        } else {
            (bool sent, ) = msg.sender.call{value: totalAmount}("");
            require(sent, "Transfer failed");
        }

        emit BatchClaimed(msg.sender, epochIds, totalAmount);
    }

    function toggleAutoCompound() external {
        require(autoCompoundEnabled, "Auto-compound not available yet");
        userAutoCompound[msg.sender] = !userAutoCompound[msg.sender];
        emit AutoCompoundToggled(msg.sender, userAutoCompound[msg.sender]);
    }

    // Owner enables auto-compound once staking contract supports receiveCompoundRewards()
    function setAutoCompoundEnabled(bool enabled) external onlyOwner {
        autoCompoundEnabled = enabled;
        emit GlobalAutoCompoundSet(enabled);
    }

    // FIX UTL-006: Paginated version replaces unbounded loop
    function getUnclaimedEpochs(
        address user,
        uint256 fromEpoch,
        uint256 limit
    ) external view returns (uint256[] memory, uint256 nextFrom) {
        require(fromEpoch >= 1, "fromEpoch must be >= 1");
        require(limit > 0 && limit <= 100, "Limit 1-100");

        uint256 maxEpoch = currentEpoch;
        uint256[] memory result = new uint256[](limit);
        uint256 count = 0;
        uint256 i = fromEpoch;

        for (; i <= maxEpoch && count < limit; i++) {
            if (!claimed[i][user] && epochs[i].finalized && block.timestamp <= epochs[i].endTime) {
                result[count] = i;
                count++;
            }
        }

        uint256[] memory trimmed = new uint256[](count);
        for (uint256 j = 0; j < count; j++) {
            trimmed[j] = result[j];
        }

        return (trimmed, i);
    }

    // Legacy view — safe for off-chain calls only, do not call from contracts
    function getUnclaimedEpochsLegacy(address user) external view returns (uint256[] memory) {
        uint256 count = 0;
        for (uint256 i = 1; i <= currentEpoch; i++) {
            if (!claimed[i][user] && epochs[i].finalized && block.timestamp <= epochs[i].endTime) {
                count++;
            }
        }

        uint256[] memory unclaimed = new uint256[](count);
        uint256 idx = 0;
        for (uint256 i = 1; i <= currentEpoch; i++) {
            if (!claimed[i][user] && epochs[i].finalized && block.timestamp <= epochs[i].endTime) {
                unclaimed[idx] = i;
                idx++;
            }
        }
        return unclaimed;
    }

    function getEpochInfo(uint256 epoch) external view returns (
        bytes32 merkleRoot,
        uint256 totalAmount,
        uint256 claimedAmount,
        uint256 startTime,
        uint256 endTime,
        bool finalized,
        uint256 remainingAmount
    ) {
        DistributionEpoch storage ep = epochs[epoch];
        return (
            ep.merkleRoot,
            ep.totalAmount,
            ep.claimedAmount,
            ep.startTime,
            ep.endTime,
            ep.finalized,
            ep.totalAmount - ep.claimedAmount
        );
    }

    function hasClaimedEpoch(address user, uint256 epoch) external view returns (bool) {
        return claimed[epoch][user];
    }

    function setStakingContract(address _staking) external onlyOwner {
        require(_staking != address(0), "Invalid address");
        stakingContract = _staking;
    }

    function recoverExpiredFunds(uint256 epoch) external onlyOwner nonReentrant {
        DistributionEpoch storage ep = epochs[epoch];
        require(block.timestamp > ep.endTime, "Epoch not expired");

        uint256 unclaimed = ep.totalAmount - ep.claimedAmount;
        require(unclaimed > 0, "Nothing to recover");

        ep.claimedAmount = ep.totalAmount;

        (bool sent, ) = owner().call{value: unclaimed}("");
        require(sent, "Recovery failed");
    }

    receive() external payable {
        emit FundsReceived(msg.value, block.timestamp);
    }
}

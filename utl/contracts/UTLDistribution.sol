// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract UTLDistribution is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public stakingContract;

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

    bool public autoCompoundEnabled;
    mapping(address => bool) public userAutoCompound;

    event EpochCreated(uint256 indexed epoch, bytes32 merkleRoot, uint256 totalAmount);
    event RewardClaimed(address indexed user, uint256 indexed epoch, uint256 amount);
    event BatchClaimed(address indexed user, uint256[] epochs, uint256 totalAmount);
    event AutoCompoundToggled(address indexed user, bool enabled);
    event FundsReceived(uint256 amount, uint256 timestamp);

    constructor(address _stakingContract) Ownable(msg.sender) {
        require(_stakingContract != address(0), "Invalid staking contract");
        stakingContract = _stakingContract;
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

        if (userAutoCompound[msg.sender]) {
            (bool sent, ) = stakingContract.call{value: amount}("");
            require(sent, "Auto-compound failed");
        } else {
            (bool sent, ) = msg.sender.call{value: amount}("");
            require(sent, "Claim transfer failed");
        }

        emit RewardClaimed(msg.sender, epoch, amount);
    }

    function batchClaim(
        uint256[] calldata epochIds,
        uint256[] calldata amounts,
        bytes32[][] calldata proofs
    ) external nonReentrant {
        require(epochIds.length == amounts.length, "Length mismatch");
        require(epochIds.length == proofs.length, "Length mismatch");

        uint256 totalAmount = 0;

        for (uint256 i = 0; i < epochIds.length; i++) {
            uint256 epoch = epochIds[i];
            require(epoch <= currentEpoch, "Invalid epoch");
            require(!claimed[epoch][msg.sender], "Already claimed");

            DistributionEpoch storage ep = epochs[epoch];
            require(ep.finalized, "Not finalized");
            require(block.timestamp <= ep.endTime, "Expired");

            bytes32 leaf = keccak256(abi.encodePacked(msg.sender, amounts[i]));
            require(MerkleProof.verify(proofs[i], ep.merkleRoot, leaf), "Invalid proof");

            claimed[epoch][msg.sender] = true;
            require(ep.claimedAmount + amounts[i] <= ep.totalAmount, "Epoch funds exceeded");
            ep.claimedAmount += amounts[i];
            totalAmount += amounts[i];
        }

        totalClaimed += totalAmount;

        if (userAutoCompound[msg.sender]) {
            (bool sent, ) = stakingContract.call{value: totalAmount}("");
            require(sent, "Auto-compound failed");
        } else {
            (bool sent, ) = msg.sender.call{value: totalAmount}("");
            require(sent, "Transfer failed");
        }

        emit BatchClaimed(msg.sender, epochIds, totalAmount);
    }

    function toggleAutoCompound() external {
        userAutoCompound[msg.sender] = !userAutoCompound[msg.sender];
        emit AutoCompoundToggled(msg.sender, userAutoCompound[msg.sender]);
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

    function getUnclaimedEpochs(address user) external view returns (uint256[] memory) {
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

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {ERC20Pausable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";

/**
 * @title KenostodTokenV3
 * @notice Fixed-supply KENO replacement token.
 *
 * Security boundaries:
 * - The entire fixed supply is minted once during construction.
 * - There is no external mint function.
 * - There is no blacklist, clawback, seizure, or forced-transfer function.
 * - Holders may permanently burn their own tokens or an approved allowance.
 * - The owner may pause transfers during a documented emergency.
 * - Ownership transfers require acceptance by the proposed new owner.
 *
 * The initial owner should be a Safe multisig when one is available. The
 * deployer does not automatically receive ownership or token supply.
 */
contract KenostodTokenV3 is ERC20, ERC20Burnable, ERC20Pausable, Ownable2Step {
    uint256 public constant MAX_SUPPLY = 1_000_000_000 ether;

    error DeployerCannotBeOwner();
    error DeployerCannotReceiveSupply();
    error RenouncingOwnershipDisabled();

    constructor(address initialOwner, address supplyRecipient)
        ERC20("Kenostod", "KENO")
        Ownable(initialOwner)
    {
        require(initialOwner != address(0), "KENO: owner is zero");
        require(supplyRecipient != address(0), "KENO: recipient is zero");
        if (initialOwner == msg.sender) revert DeployerCannotBeOwner();
        if (supplyRecipient == msg.sender) revert DeployerCannotReceiveSupply();

        _mint(supplyRecipient, MAX_SUPPLY);
    }

    /**
     * @notice Stops token transfers during an emergency.
     * @dev Pausing does not let the owner move or seize anyone's tokens.
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Restores token transfers after an emergency.
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Ownership must be transferred rather than accidentally destroyed.
     */
    function renounceOwnership() public pure override {
        revert RenouncingOwnershipDisabled();
    }

    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Pausable)
    {
        super._update(from, to, value);
    }
}
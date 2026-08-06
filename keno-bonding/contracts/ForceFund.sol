// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Deploy with ETH value — immediately selfdestruct to target.
/// Per EIP-6780, selfdestruct in the same tx as creation still transfers ETH,
/// even to non-payable contracts. Used to gas-fund a contract-owner wallet.
contract ForceFund {
    constructor(address payable target) payable {
        selfdestruct(target);
    }
}

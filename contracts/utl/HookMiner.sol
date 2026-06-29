// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// ─────────────────────────────────────────────────────────────────────────────
//  HookMiner — Utility for finding a CREATE2 salt that produces a hook address
//  with the required permission bits set in its lower 14 bits.
//
//  PancakeSwap v4 encodes hook permissions directly into the contract address.
//  UTLHook only implements afterSwap, so bit 6 (AFTER_SWAP_FLAG = 64) must be
//  set and all other hook bits must be zero.
//
//  Required address: lower 14 bits = 0b00_0000_0100_0000 = 64 (decimal)
//
//  Usage: call find() off-chain in a script to compute the correct salt,
//  then deploy UTLHook using CREATE2 with that salt.
// ─────────────────────────────────────────────────────────────────────────────

library HookMiner {

    // Only AFTER_SWAP_FLAG must be set
    uint160 constant REQUIRED_FLAGS = 64;   // 1 << 6
    uint160 constant ALL_HOOK_BITS  = (1 << 14) - 1;

    // Find a salt such that CREATE2(deployer, salt, initCodeHash) produces
    // an address whose lower 14 bits == REQUIRED_FLAGS
    function find(
        address deployer,
        bytes memory creationCode,
        bytes memory constructorArgs
    ) internal pure returns (bytes32 salt, address hookAddress) {
        bytes memory initCode = abi.encodePacked(creationCode, constructorArgs);
        bytes32 initCodeHash  = keccak256(initCode);

        for (uint256 i = 0; i < 160_000; i++) {
            salt = bytes32(i);
            hookAddress = _predictAddress(deployer, salt, initCodeHash);
            if (uint160(hookAddress) & ALL_HOOK_BITS == REQUIRED_FLAGS) {
                return (salt, hookAddress);
            }
        }
        revert("HookMiner: no valid salt found in 160k iterations");
    }

    function _predictAddress(
        address deployer,
        bytes32 salt,
        bytes32 initCodeHash
    ) internal pure returns (address) {
        return address(uint160(uint256(keccak256(abi.encodePacked(
            bytes1(0xff),
            deployer,
            salt,
            initCodeHash
        )))));
    }
}

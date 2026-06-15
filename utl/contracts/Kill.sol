// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
contract Kill {
    address payable public target;
    constructor(address payable _target) payable {
        target = _target;
    }
    function kill() external {
        selfdestruct(target);
    }
}

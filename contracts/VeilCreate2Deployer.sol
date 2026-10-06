// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

/// @notice Lightweight CREATE2 deployer for mining Uniswap v4 hook addresses.
contract VeilCreate2Deployer {
    event Deployed(address indexed deployedAddress, bytes32 indexed salt);

    function deploy(bytes32 salt, bytes memory initCode) external returns (address deployed) {
        assembly {
            deployed := create2(0, add(initCode, 0x20), mload(initCode), salt)
            if iszero(extcodesize(deployed)) {
                revert(0, 0)
            }
        }
        emit Deployed(deployed, salt);
    }
}

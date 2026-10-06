// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

/// @notice Mock verifier for testnet and unit tests. Accepts any non-empty proof.
/// @dev In production, replace with Groth16 WithdrawalVerifier generated from Circom circuits.
contract ShieldedVerifierMock {
    bool public shouldPass = true;

    event VerificationAttempted(bytes32 root, bytes32 nullifierHash, address recipient, uint256 fee, bool result);

    function setShouldPass(bool _pass) external {
        shouldPass = _pass;
    }

    function verify(
        bytes calldata proof,
        bytes32 root,
        bytes32 nullifierHash,
        address recipient,
        uint256 fee,
        bytes32 associationRoot
    ) external view returns (bool) {
        if (!shouldPass) return false;
        if (proof.length == 0) return false;
        if (nullifierHash == bytes32(0)) return false;
        if (recipient == address(0)) return false;
        if (root == bytes32(0)) return false;
        // associationRoot must be provided if used
        if (associationRoot == bytes32(0) && proof.length < 4) return false;
        return true;
    }
}

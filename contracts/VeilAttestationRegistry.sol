// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/// @title VeilAttestationRegistry
/// @notice Registry for addresses verified via ZK attestations (proof-of-clean-funds / proof-of-human).
/// Used by VeilHook to enforce anti-bot gating during launch windows or pool lifespans.
contract VeilAttestationRegistry {
    address public owner;
    
    // Attestation status per address
    mapping(address => bool) public isAttested;
    mapping(address => uint256) public attestationTimestamp;
    mapping(address => bytes32) public attestationRoot;

    // Authorized verifiers / postmen who can register verified attestations
    mapping(address => bool) public authorizedAttesters;

    // Per-user nonce for self-attestation signatures (replay protection).
    mapping(address => uint256) public attestationNonce;

    event AddressAttested(address indexed user, bytes32 indexed proofRoot, uint256 timestamp);
    event AttestationRevoked(address indexed user);
    event AttesterUpdated(address indexed attester, bool authorized);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error OnlyOwner();
    error OnlyAttester();
    error ZeroAddress();
    error Expired();
    error InvalidSignature();

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    modifier onlyAttester() {
        if (!authorizedAttesters[msg.sender] && msg.sender != owner) revert OnlyAttester();
        _;
    }

    constructor(address _owner) {
        if (_owner == address(0)) revert ZeroAddress();
        owner = _owner;
        authorizedAttesters[_owner] = true;
    }

    function setAttester(address attester, bool authorized) external onlyOwner {
        if (attester == address(0)) revert ZeroAddress();
        authorizedAttesters[attester] = authorized;
        emit AttesterUpdated(attester, authorized);
    }

    function registerAttestation(address user, bytes32 proofRoot) external onlyAttester {
        if (user == address(0)) revert ZeroAddress();
        isAttested[user] = true;
        attestationTimestamp[user] = block.timestamp;
        attestationRoot[user] = proofRoot;
        emit AddressAttested(user, proofRoot, block.timestamp);
    }

    function batchRegisterAttestation(address[] calldata users, bytes32[] calldata proofRoots) external onlyAttester {
        require(users.length == proofRoots.length, "length mismatch");
        for (uint256 i = 0; i < users.length; i++) {
            address user = users[i];
            if (user != address(0)) {
                isAttested[user] = true;
                attestationTimestamp[user] = block.timestamp;
                attestationRoot[user] = proofRoots[i];
                emit AddressAttested(user, proofRoots[i], block.timestamp);
            }
        }
    }

    function revokeAttestation(address user) external onlyOwner {
        isAttested[user] = false;
        emit AttestationRevoked(user);
    }

    /// @notice Permissionless self-attestation: the user submits their own
    /// proof root with an EIP-191 signature over (registry, chain, user,
    /// root, nonce, deadline). No owner or attester involved.
    function selfAttest(bytes32 proofRoot, uint256 deadline, bytes calldata signature) external {
        address user = msg.sender;
        if (user == address(0)) revert ZeroAddress();
        if (block.timestamp > deadline) revert Expired();
        uint256 nonce = attestationNonce[user];
        bytes32 inner = keccak256(abi.encode(address(this), block.chainid, user, proofRoot, nonce, deadline));
        address signer = ECDSA.recover(MessageHashUtils.toEthSignedMessageHash(inner), signature);
        if (signer != user) revert InvalidSignature();
        attestationNonce[user] = nonce + 1;
        isAttested[user] = true;
        attestationTimestamp[user] = block.timestamp;
        attestationRoot[user] = proofRoot;
        emit AddressAttested(user, proofRoot, block.timestamp);
    }

    function verifyAttestation(address user) external view returns (bool) {
        return isAttested[user];
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
}

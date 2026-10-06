// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IShieldedVerifier {
    function verify(
        bytes calldata proof,
        bytes32 root,
        bytes32 nullifierHash,
        address recipient,
        uint256 fee,
        bytes32 associationRoot
    ) external view returns (bool);
}

/// @title ShieldedPool
/// @notice Fixed-denomination non-custodial shielded pool with association set.
/// Supports both native ETH (asset == address(0)) and ERC20 tokens.
/// @dev Invariant: Withdrawals can NEVER be paused by anyone. Guardian can only pause deposits.
contract ShieldedPool {
    using SafeERC20 for IERC20;

    uint8 public constant TREE_DEPTH = 20;
    uint8 public constant ROOT_HISTORY = 100;

    address public immutable asset; // address(0) for native ETH
    IShieldedVerifier public immutable verifier;
    uint256 public immutable denomination;
    uint256 public immutable poolCap;
    bytes32 public immutable associationRoot;
    address public guardian;

    bool public depositsPaused;
    uint256 public totalDeposits;
    uint256 public totalWithdrawn;
    uint32 public nextIndex;

    mapping(uint32 => bytes32) public filledSubtrees;
    mapping(bytes32 => bool) public knownRoots;
    bytes32[] public rootHistory;
    mapping(bytes32 => bool) public nullifierUsed;

    event Deposit(uint32 indexed index, bytes32 indexed commitment, uint256 leafIndex, uint256 timestamp);
    event Withdraw(bytes32 indexed nullifierHash, address indexed recipient, address indexed relayer, uint256 fee);
    event DepositsPaused(address indexed guardian);
    event DepositsUnpaused(address indexed guardian);
    event GuardianRenounced(address indexed previousGuardian);

    error DepositsArePaused();
    error InvalidDenomination();
    error PoolCapExceeded();
    error TreeIsFull();
    error NullifierAlreadySpent();
    error UnknownRoot();
    error InvalidRecipient();
    error InvalidFee();
    error InvalidProof();
    error OnlyGuardian();
    error EtherTransferFailed();

    constructor(
        address _asset,
        address _verifier,
        uint256 _denomination,
        uint256 _poolCap,
        bytes32 _associationRoot,
        address _guardian
    ) {
        require(_verifier != address(0), "verifier required");
        require(_denomination > 0, "denomination > 0");
        require(_poolCap >= _denomination, "cap >= denomination");
        require(_guardian != address(0), "guardian required");

        asset = _asset;
        verifier = IShieldedVerifier(_verifier);
        denomination = _denomination;
        poolCap = _poolCap;
        associationRoot = _associationRoot;
        guardian = _guardian;

        bytes32 currentZero = bytes32(0);
        for (uint8 i = 0; i < TREE_DEPTH; i++) {
            filledSubtrees[i] = currentZero;
            currentZero = keccak256(abi.encodePacked(currentZero, currentZero));
        }
        knownRoots[currentZero] = true;
        rootHistory.push(currentZero);
    }

    modifier onlyGuardian() {
        if (msg.sender != guardian) revert OnlyGuardian();
        _;
    }

    /// @notice Deposit denomination into the pool and append commitment leaf to Merkle tree
    function deposit(bytes32 commitment) external payable returns (uint32 index) {
        if (depositsPaused) revert DepositsArePaused();
        if (totalDeposits + denomination > poolCap) revert PoolCapExceeded();
        if (nextIndex >= 2 ** TREE_DEPTH) revert TreeIsFull();

        if (asset == address(0)) {
            if (msg.value != denomination) revert InvalidDenomination();
        } else {
            if (msg.value != 0) revert InvalidDenomination();
            IERC20(asset).safeTransferFrom(msg.sender, address(this), denomination);
        }

        index = nextIndex;
        unchecked {
            nextIndex = index + 1;
        }
        totalDeposits += denomination;

        bytes32 node = commitment;
        uint32 current = index;
        for (uint8 level = 0; level < TREE_DEPTH; level++) {
            if (current % 2 == 0) {
                filledSubtrees[level] = node;
                node = keccak256(abi.encodePacked(node, _zero(level)));
            } else {
                node = keccak256(abi.encodePacked(filledSubtrees[level], node));
            }
            current /= 2;
        }

        knownRoots[node] = true;
        rootHistory.push(node);
        if (rootHistory.length > ROOT_HISTORY) {
            bytes32 evicted = rootHistory[0];
            rootHistory[0] = rootHistory[rootHistory.length - 1];
            rootHistory.pop();
            delete knownRoots[evicted];
        }

        emit Deposit(index, commitment, index, block.timestamp);
    }

    /// @notice Withdraw funds to a clean recipient using zero-knowledge proof.
    /// @dev Non-blocking: never checks deposit pause or guardian state.
    function withdraw(
        bytes calldata proof,
        bytes32 root,
        bytes32 nullifierHash,
        address recipient,
        uint256 fee
    ) external {
        if (nullifierUsed[nullifierHash]) revert NullifierAlreadySpent();
        if (!knownRoots[root]) revert UnknownRoot();
        if (recipient == address(0)) revert InvalidRecipient();
        if (fee >= denomination) revert InvalidFee();

        if (!verifier.verify(proof, root, nullifierHash, recipient, fee, associationRoot)) {
            revert InvalidProof();
        }

        nullifierUsed[nullifierHash] = true;
        uint256 payout = denomination - fee;
        totalWithdrawn += denomination;

        if (asset == address(0)) {
            (bool okRecipient, ) = recipient.call{value: payout}("");
            if (!okRecipient) revert EtherTransferFailed();
            if (fee > 0) {
                (bool okFee, ) = msg.sender.call{value: fee}("");
                if (!okFee) revert EtherTransferFailed();
            }
        } else {
            IERC20(asset).safeTransfer(recipient, payout);
            if (fee > 0) {
                IERC20(asset).safeTransfer(msg.sender, fee);
            }
        }

        emit Withdraw(nullifierHash, recipient, msg.sender, fee);
    }

    function isKnownRoot(bytes32 root) external view returns (bool) {
        return knownRoots[root];
    }

    function isNullifierSpent(bytes32 nullifier) external view returns (bool) {
        return nullifierUsed[nullifier];
    }

    function pauseDeposits() external onlyGuardian {
        depositsPaused = true;
        emit DepositsPaused(msg.sender);
    }

    function unpauseDeposits() external onlyGuardian {
        depositsPaused = false;
        emit DepositsUnpaused(msg.sender);
    }

    function renounceGuardian() external onlyGuardian {
        emit GuardianRenounced(guardian);
        guardian = address(0);
    }

    function _zero(uint8 level) internal pure returns (bytes32 currentZero) {
        currentZero = bytes32(0);
        for (uint8 i = 0; i < level; i++) {
            currentZero = keccak256(abi.encodePacked(currentZero, currentZero));
        }
    }

    receive() external payable {
        revert("direct ether not accepted");
    }
}

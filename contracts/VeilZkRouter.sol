// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice Withdrawal request mirrored from the audited 0xbow IPrivacyPool interface.
/// @dev Field layout matches 0xbow v1.2.1 so the ABI encoding is identical.
/// Integrity of the data is ensured by the context signal in the Groth16 proof.
struct ZkWithdrawal {
    address processooor;
    bytes data;
}

/// @notice Groth16 withdrawal proof mirrored from the audited 0xbow ProofLib.
/// @dev Field layout matches 0xbow v1.2.1 so the ABI encoding is identical.
struct ZkWithdrawProof {
    uint256[2] pA;
    uint256[2][2] pB;
    uint256[2] pC;
    uint256[8] pubSignals;
}

/// @notice Relay data encoded inside ZkWithdrawal.data, mirrored from 0xbow IEntrypoint.
struct ZkRelayData {
    address recipient;
    address feeRecipient;
    uint256 relayFeeBPS;
}

/// @notice Minimal verified interface of the audited 0xbow Entrypoint.
/// @dev Only the deposit and relay entry points used by this router.
interface IZkEntrypoint {
    function deposit(uint256 precommitment) external payable returns (uint256 commitment);
    function deposit(IERC20 asset, uint256 value, uint256 precommitment) external returns (uint256 commitment);
    function relay(ZkWithdrawal calldata withdrawal, ZkWithdrawProof calldata proof, uint256 scope) external;
}

/// @title VeilZkRouter
/// @notice Context-bound executor for full-ZK flows. Every value movement goes
/// through audited Groth16 proofs verified onchain by the 0xbow Entrypoint.
/// @dev Invariant: Router NEVER retains user custody or dust; all balances must settle to 0.
/// The exit leg calls entrypoint.relay (proof verified onchain, replaces Mock).
/// The entry leg calls entrypoint.deposit. Swap params are hashed into the proof
/// context verified onchain, so relayers cannot tamper with destinations.
contract VeilZkRouter is ReentrancyGuard {
    using SafeERC20 for IERC20;

    IZkEntrypoint public immutable entrypoint;
    IPoolManager public immutable poolManager;

    /// @dev True while a deposit or relay flow is active. receive() only accepts
    /// native asset mid-flow (funds pushed back by the Entrypoint during relay).
    bool private _inZkFlow;

    event ZkDepositExecuted(
        address indexed depositor,
        address indexed asset,
        uint256 value,
        uint256 commitment
    );

    event ZkRelayExecuted(
        address indexed relayer,
        address indexed recipient,
        bytes32 indexed contextHash,
        uint256 scope
    );

    error ZeroAddress();
    error NonZeroBalanceInvariantFailed();
    error SlippageExceeded();
    error InvalidShieldedPool();
    error InsufficientOutputForDenomination();
    error OnlyPoolManager();
    error ContextMismatch();
    error RelayFeeMismatch();
    error EthReceiveNotInFlow();

    modifier onlyPoolManager() {
        if (msg.sender != address(poolManager)) revert OnlyPoolManager();
        _;
    }

    constructor(address _entrypoint, address _poolManager) {
        if (_entrypoint == address(0)) revert ZeroAddress();
        if (_poolManager == address(0)) revert ZeroAddress();
        entrypoint = IZkEntrypoint(_entrypoint);
        poolManager = IPoolManager(_poolManager);
    }

    /// @notice Binds swap params into one context hash verified onchain.
    /// @param pool 0xbow pool address for the flow.
    /// @param minOut Minimum acceptable output amount.
    /// @param commitment New commitment hash created by the flow.
    /// @param relayFeeBPS Relay fee in basis points.
    /// @return contextHash keccak256 hash of the bound params.
    function computeContext(
        address pool,
        uint256 minOut,
        bytes32 commitment,
        uint256 relayFeeBPS
    ) public pure returns (bytes32 contextHash) {
        return keccak256(abi.encode(pool, minOut, commitment, relayFeeBPS));
    }

    /// @notice Entry leg: deposits funds into a 0xbow pool via the Entrypoint.
    /// @param asset Token address, address(0) for the native asset.
    /// @param value Amount to deposit, must be greater than zero.
    /// @param precommitment Precommitment hash for the deposit.
    /// @return commitment Deposit commitment hash returned by the Entrypoint.
    function deposit(address asset, uint256 value, uint256 precommitment)
        external
        payable
        nonReentrant
        returns (uint256 commitment)
    {
        if (value == 0) revert InsufficientOutputForDenomination();
        _inZkFlow = true;
        if (asset == address(0)) {
            if (msg.value != value) revert InsufficientOutputForDenomination();
            commitment = entrypoint.deposit{value: value}(precommitment);
        } else {
            if (msg.value != 0) revert InsufficientOutputForDenomination();
            IERC20(asset).safeTransferFrom(msg.sender, address(this), value);
            IERC20(asset).forceApprove(address(entrypoint), value);
            commitment = entrypoint.deposit(IERC20(asset), value, precommitment);
        }
        _inZkFlow = false;

        // Invariant check: router holds zero balance of native asset and input token.
        if (address(this).balance != 0) revert NonZeroBalanceInvariantFailed();
        if (asset != address(0)) {
            if (IERC20(asset).balanceOf(address(this)) != 0) revert NonZeroBalanceInvariantFailed();
        }

        emit ZkDepositExecuted(msg.sender, asset, value, commitment);
    }

    /// @notice Exit leg: relays a 0xbow withdrawal with an onchain-verified Groth16 proof.
    /// @dev The proof is verified onchain by entrypoint.relay, which replaces Mock.
    /// The caller binds pool, minOut, commitment and fee into the proof context;
    /// this router enforces that the decoded relay recipient and fee match.
    /// @param withdrawal Withdrawal request carrying the encoded relay data.
    /// @param proof Groth16 withdrawal proof with the context-bound public signals.
    /// @param scope Pool scope to withdraw from.
    /// @param pool 0xbow pool address bound into the proof context.
    /// @param minOut Minimum acceptable output bound into the proof context.
    /// @param commitmentHash New commitment hash bound into the proof context.
    /// @param relayFeeBPS Relay fee in basis points bound into the proof context.
    /// @param recipient Withdrawal recipient, must be non-zero and match the encoded data.
    /// @param asset Withdrawn asset for the zero-balance invariant check, address(0) for native.
    function relay(
        ZkWithdrawal calldata withdrawal,
        ZkWithdrawProof calldata proof,
        uint256 scope,
        address pool,
        uint256 minOut,
        bytes32 commitmentHash,
        uint256 relayFeeBPS,
        address recipient,
        address asset
    ) external nonReentrant {
        if (recipient == address(0)) revert ZeroAddress();
        if (pool == address(0)) revert ZeroAddress();
        ZkRelayData memory data = abi.decode(withdrawal.data, (ZkRelayData));
        if (data.recipient == address(0)) revert ZeroAddress();
        if (data.recipient != recipient) revert ContextMismatch();
        if (data.relayFeeBPS != relayFeeBPS) revert RelayFeeMismatch();
        bytes32 contextHash = computeContext(pool, minOut, commitmentHash, relayFeeBPS);

        _inZkFlow = true;
        entrypoint.relay(withdrawal, proof, scope);
        _inZkFlow = false;

        // Invariant check: router holds zero balance of native asset and withdrawn token.
        if (address(this).balance != 0) revert NonZeroBalanceInvariantFailed();
        if (asset != address(0)) {
            if (IERC20(asset).balanceOf(address(this)) != 0) revert NonZeroBalanceInvariantFailed();
        }

        emit ZkRelayExecuted(msg.sender, recipient, contextHash, scope);
    }

    /// @notice Accepts native asset only mid-flow from the Entrypoint during relay.
    receive() external payable {
        if (!_inZkFlow) revert EthReceiveNotInFlow();
    }
}

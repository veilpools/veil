// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice Withdrawal request mirrored from the audited 0xbow IPrivacyPool interface.
/// @dev Field layout matches 0xbow v1.2.1 so the ABI encoding is identical.
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
/// @notice Atomic executor for full-ZK flows. Every value movement goes
/// through audited Groth16 proofs verified onchain by the 0xbow Entrypoint.
/// @dev Proof verification delegated to Entrypoint; router enforces atomicity, not proof validity.
/// Relay -> swap -> deposit must complete in ONE transaction via executeFullZkFlow.
/// A relay without a matching same-tx deposit always reverts: there is no
/// standalone relay entry point, and the transient stage machine rejects nested
/// or interleaved legs with AtomicityViolation.
/// The withdrawal leg yields exactly the 0xbow fixed denomination
/// (PrivacyPool.DEPOSIT_DENOMINATION); NO minOut check applies on withdrawal.
/// The Entrypoint enforces the canonical context keccak(abi.encode(withdrawal, scope))
/// reduced modulo the SNARK field; this router performs no proof re-check.
/// minOut/slippage applies ONLY to post-swap amountOut: minSwapOut on
/// executeFullZkFlow is the swap-leg wiring point, enforced via SlippageExceeded
/// once poolManager.swap lands (skeleton: swap is pass-through, guard documented).
/// Invariant: Router NEVER retains user custody or dust; all balances must settle to 0.
contract VeilZkRouter is ReentrancyGuard {
    using SafeERC20 for IERC20;

    IZkEntrypoint public immutable entrypoint;
    /// @dev Reserved for the future swap leg. No PoolManager callback exists
    /// yet, so there is intentionally no access-control modifier on this
    /// skeleton (atomic flow and deposit are permissionless self-relay by design).
    IPoolManager public immutable poolManager;

    /// @dev Atomicity state machine, cleared automatically at transaction end.
    /// IDLE means no flow is active. RELAYING means the relay leg has started
    /// and the deposit leg is still pending. DEPOSITING means the deposit leg
    /// has started. Any unexpected state reverts with AtomicityViolation.
    uint8 private transient _stage;
    uint8 private constant STAGE_IDLE = 0;
    uint8 private constant STAGE_RELAYING = 1;
    uint8 private constant STAGE_DEPOSITING = 2;

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
        uint256 scope
    );

    error ZeroAddress();
    error NonZeroBalanceInvariantFailed();
    error SlippageExceeded();
    error InsufficientOutputForDenomination();
    error InvalidPrecommitment();
    error RecipientMismatch();
    error AtomicityViolation();
    error EthReceiveNotInFlow();

    constructor(address _entrypoint, address _poolManager) {
        if (_entrypoint == address(0)) revert ZeroAddress();
        if (_poolManager == address(0)) revert ZeroAddress();
        entrypoint = IZkEntrypoint(_entrypoint);
        poolManager = IPoolManager(_poolManager);
    }

    /// @notice Entry leg: deposits funds into a 0xbow pool via the Entrypoint.
    /// @param asset Token address, address(0) for the native asset.
    /// @param value Amount to deposit, must be greater than zero.
    /// @param precommitment Precommitment hash for the deposit, must be non-zero.
    /// @return commitment Deposit commitment hash returned by the Entrypoint.
    function deposit(address asset, uint256 value, uint256 precommitment)
        external
        payable
        nonReentrant
        returns (uint256 commitment)
    {
        if (_stage != STAGE_IDLE) revert AtomicityViolation();
        if (value == 0) revert InsufficientOutputForDenomination();
        if (precommitment == 0) revert InvalidPrecommitment();
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
        if (commitment == 0) revert InvalidPrecommitment();
        _inZkFlow = false;

        // Invariant check: router holds zero balance of native asset and input token.
        if (address(this).balance != 0) revert NonZeroBalanceInvariantFailed();
        if (asset != address(0)) {
            if (IERC20(asset).balanceOf(address(this)) != 0) revert NonZeroBalanceInvariantFailed();
        }

        emit ZkDepositExecuted(msg.sender, asset, value, commitment);
    }

    /// @notice Atomic relay -> swap -> deposit in ONE transaction.
    /// @dev Proof verification delegated to Entrypoint; router enforces atomicity, not proof validity.
    /// The withdrawal leg accepts NO minOut param: 0xbow always yields exactly the
    /// fixed denomination, so no withdrawal-leg slippage check exists. minSwapOut
    /// guards ONLY the post-swap amountOut; swap-leg wiring lands later and is
    /// enforced via SlippageExceeded once poolManager.swap is wired. Skeleton
    /// grade: swap is pass-through, so minSwapOut is accepted as the wiring point
    /// and documented here, not yet enforced against an amountOut.
    /// A relay without a matching same-tx deposit always reverts: the relay leg
    /// runs only inside this function, the transient stage machine forces the
    /// deposit leg to follow, and any nested or interleaved call reverts with
    /// AtomicityViolation. Existing invariant-0 checks and leg events apply.
    /// @param withdrawal Withdrawal request carrying the encoded relay data.
    /// @param proof Groth16 withdrawal proof verified onchain by entrypoint.relay.
    /// @param scope Pool scope to withdraw from.
    /// @param recipient Withdrawal recipient, must be non-zero and match the encoded data.
    /// @param withdrawAsset Withdrawn asset for the zero-balance invariant check, address(0) for native.
    /// @param depositAsset Deposit asset for the entry leg, address(0) for native.
    /// @param depositValue Deposit amount, must be greater than zero.
    /// @param precommitment Precommitment hash for the deposit, must be non-zero.
    /// @param minSwapOut Minimum acceptable post-swap output, swap-leg wiring point.
    /// @return commitment Deposit commitment hash returned by the Entrypoint.
    function executeFullZkFlow(
        ZkWithdrawal calldata withdrawal,
        ZkWithdrawProof calldata proof,
        uint256 scope,
        address recipient,
        address withdrawAsset,
        address depositAsset,
        uint256 depositValue,
        uint256 precommitment,
        uint256 minSwapOut
    ) external payable nonReentrant returns (uint256 commitment) {
        if (_stage != STAGE_IDLE) revert AtomicityViolation();
        if (recipient == address(0)) revert ZeroAddress();
        ZkRelayData memory data = abi.decode(withdrawal.data, (ZkRelayData));
        if (data.recipient == address(0)) revert ZeroAddress();
        if (data.recipient != recipient) revert RecipientMismatch();
        if (depositValue == 0) revert InsufficientOutputForDenomination();
        if (precommitment == 0) revert InvalidPrecommitment();

        _stage = STAGE_RELAYING;
        _inZkFlow = true;
        entrypoint.relay(withdrawal, proof, scope);

        // Swap-leg wiring point: poolManager.swap lands here. Once wired, enforce
        // post-swap slippage with: if (amountOut < minSwapOut) revert SlippageExceeded();
        // minSwapOut is intentionally NOT checked against the withdrawal leg, which
        // always yields exactly the fixed denomination. The param stays in the
        // signature as the explicit wiring point until the swap leg lands.

        _stage = STAGE_DEPOSITING;
        if (depositAsset == address(0)) {
            if (msg.value != depositValue) revert InsufficientOutputForDenomination();
            commitment = entrypoint.deposit{value: depositValue}(precommitment);
        } else {
            if (msg.value != 0) revert InsufficientOutputForDenomination();
            IERC20(depositAsset).safeTransferFrom(msg.sender, address(this), depositValue);
            IERC20(depositAsset).forceApprove(address(entrypoint), depositValue);
            commitment = entrypoint.deposit(IERC20(depositAsset), depositValue, precommitment);
        }
        if (commitment == 0) revert InvalidPrecommitment();
        _stage = STAGE_IDLE;
        _inZkFlow = false;

        // Invariant check: router holds zero balance of native asset and both leg tokens.
        if (address(this).balance != 0) revert NonZeroBalanceInvariantFailed();
        if (withdrawAsset != address(0) && withdrawAsset != depositAsset) {
            if (IERC20(withdrawAsset).balanceOf(address(this)) != 0) revert NonZeroBalanceInvariantFailed();
        }
        if (depositAsset != address(0)) {
            if (IERC20(depositAsset).balanceOf(address(this)) != 0) revert NonZeroBalanceInvariantFailed();
        }

        emit ZkRelayExecuted(msg.sender, recipient, scope);
        emit ZkDepositExecuted(msg.sender, depositAsset, depositValue, commitment);
    }

    /// @notice Accepts native asset only mid-flow from the Entrypoint during relay.
    receive() external payable {
        if (!_inZkFlow) revert EthReceiveNotInFlow();
    }
}

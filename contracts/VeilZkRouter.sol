// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
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

/// @notice Exact-input swap leg for the atomic full-ZK flow.
/// @dev Mirrors VeilShieldRouter swap params: v4 PoolKey plus direction,
/// sqrtPriceLimit bound and hook data. The input amount is always the exact
/// relay exit held by this router, never a caller-supplied value.
struct ZkSwapLeg {
    PoolKey key;
    bool zeroForOne;
    uint160 sqrtPriceLimitX96;
    bytes hookData;
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
/// executeFullZkFlow is enforced via SlippageExceeded once poolManager.swap lands.
/// The relay exit must land in this router (recipient equals address(this)) so the
/// exact relayed amount chains fund-to-fund into the swap input; the deposit leg
/// is funded from the swap output, msg.value must be zero, and any dust above
/// depositValue is refunded to the caller immediately.
/// Invariant: Router NEVER retains user custody or dust; all balances must settle to 0.
contract VeilZkRouter is ReentrancyGuard {
    using SafeERC20 for IERC20;

    IZkEntrypoint public immutable entrypoint;
    /// @dev Live swap rail. PoolManager calls back into unlockCallback during
    /// executeFullZkFlow; the callback is gated by onlyPoolManager plus the
    /// transient SWAPPING stage, so it is unreachable outside the atomic flow.
    IPoolManager public immutable poolManager;

    /// @dev Atomicity state machine, cleared automatically at transaction end.
    /// IDLE means no flow is active. RELAYING means the relay leg has started
    /// and the swap leg is still pending. SWAPPING means the v4 swap leg has
    /// started and the deposit leg is still pending. DEPOSITING means the
    /// deposit leg has started. Any unexpected state reverts with AtomicityViolation.
    uint8 private transient _stage;
    uint8 private constant STAGE_IDLE = 0;
    uint8 private constant STAGE_RELAYING = 1;
    uint8 private constant STAGE_SWAPPING = 2;
    uint8 private constant STAGE_DEPOSITING = 3;

    /// @dev True while a deposit, relay or swap flow is active. receive() only accepts
    /// native asset mid-flow (funds pushed back by the Entrypoint during relay
    /// and by the PoolManager when taking native swap output).
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

    event ZkSwapExecuted(
        address indexed relayer,
        uint256 amountIn,
        uint256 amountOut
    );

    event FullZkFlowExecuted(
        address indexed relayer,
        address indexed recipient,
        uint256 scope,
        uint256 amountIn,
        uint256 amountOut,
        uint256 commitment
    );

    error ZeroAddress();
    error NonZeroBalanceInvariantFailed();
    error SlippageExceeded();
    error InsufficientOutputForDenomination();
    error InvalidPrecommitment();
    error RecipientMismatch();
    error AtomicityViolation();
    error EthReceiveNotInFlow();
    error OnlyPoolManager();
    error InvalidSwapLeg();

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
    /// guards ONLY the post-swap amountOut and reverts with SlippageExceeded.
    /// The relay recipient must equal address(this) so the exact relay exit chains
    /// into the swap input; msg.value must be zero because every leg is funded
    /// router-internally. A relay without a matching same-tx deposit always reverts:
    /// the relay leg runs only inside this function, the transient stage machine
    /// forces swap then deposit to follow, and any nested or interleaved call
    /// reverts with AtomicityViolation. Existing invariant-0 checks and leg events apply.
    /// @param withdrawal Withdrawal request carrying the encoded relay data.
    /// @param proof Groth16 withdrawal proof verified onchain by entrypoint.relay.
    /// @param scope Pool scope to withdraw from.
    /// @param recipient Withdrawal recipient, must equal address(this) and match the encoded data.
    /// @param withdrawAsset Withdrawn asset swapped as exact input, address(0) for native.
    /// @param depositAsset Deposit asset taken as swap output, address(0) for native.
    /// @param depositValue Deposit amount carved from the swap output, must be greater than zero.
    /// @param precommitment Precommitment hash for the deposit, must be non-zero.
    /// @param swapLeg Exact-input v4 swap path with sqrtPriceLimit bound.
    /// @param minSwapOut Minimum acceptable post-swap output, enforced on amountOut only.
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
        ZkSwapLeg calldata swapLeg,
        uint256 minSwapOut
    ) external payable nonReentrant returns (uint256 commitment) {
        if (_stage != STAGE_IDLE) revert AtomicityViolation();
        if (recipient == address(0)) revert ZeroAddress();
        if (recipient != address(this)) revert RecipientMismatch();
        ZkRelayData memory data = abi.decode(withdrawal.data, (ZkRelayData));
        if (data.recipient == address(0)) revert ZeroAddress();
        if (data.recipient != recipient) revert RecipientMismatch();
        if (depositValue == 0) revert InsufficientOutputForDenomination();
        if (precommitment == 0) revert InvalidPrecommitment();
        if (msg.value != 0) revert InsufficientOutputForDenomination();
        Currency input = swapLeg.zeroForOne ? swapLeg.key.currency0 : swapLeg.key.currency1;
        Currency output = swapLeg.zeroForOne ? swapLeg.key.currency1 : swapLeg.key.currency0;
        if (Currency.unwrap(input) != withdrawAsset) revert InvalidSwapLeg();
        if (Currency.unwrap(output) != depositAsset) revert InvalidSwapLeg();

        _stage = STAGE_RELAYING;
        _inZkFlow = true;
        uint256 nativeBefore = address(this).balance;
        uint256 withdrawBefore = withdrawAsset == address(0)
            ? 0
            : IERC20(withdrawAsset).balanceOf(address(this));
        entrypoint.relay(withdrawal, proof, scope);

        _stage = STAGE_SWAPPING;
        uint256 swapAmountIn = withdrawAsset == address(0)
            ? address(this).balance - nativeBefore
            : IERC20(withdrawAsset).balanceOf(address(this)) - withdrawBefore;
        if (swapAmountIn == 0) revert InsufficientOutputForDenomination();
        if (swapAmountIn > uint256(uint256(type(int256).max))) revert InsufficientOutputForDenomination();
        bytes memory result = poolManager.unlock(abi.encode(swapLeg, swapAmountIn));
        uint256 amountOut = abi.decode(result, (uint256));
        if (amountOut < minSwapOut) revert SlippageExceeded();

        _stage = STAGE_DEPOSITING;
        if (amountOut < depositValue) revert InsufficientOutputForDenomination();
        if (depositAsset == address(0)) {
            commitment = entrypoint.deposit{value: depositValue}(precommitment);
        } else {
            IERC20(depositAsset).forceApprove(address(entrypoint), depositValue);
            commitment = entrypoint.deposit(IERC20(depositAsset), depositValue, precommitment);
        }
        if (commitment == 0) revert InvalidPrecommitment();
        if (amountOut > depositValue) {
            uint256 dust = amountOut - depositValue;
            if (depositAsset == address(0)) {
                (bool refundOk, ) = msg.sender.call{value: dust}("");
                require(refundOk, "dust refund failed");
            } else {
                IERC20(depositAsset).safeTransfer(msg.sender, dust);
            }
        }
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
        emit ZkSwapExecuted(msg.sender, swapAmountIn, amountOut);
        emit ZkDepositExecuted(msg.sender, depositAsset, depositValue, commitment);
        emit FullZkFlowExecuted(msg.sender, recipient, scope, swapAmountIn, amountOut, commitment);
    }

    /// @notice Callback invoked by PoolManager.unlock for the atomic swap leg.
    /// @dev Mirrors the proven VeilShieldRouter pattern: exact-input swap with
    /// sqrtPriceLimit, input settlement and output take. Only reachable mid-flow.
    function unlockCallback(bytes calldata data) external onlyPoolManager returns (bytes memory) {
        if (_stage != STAGE_SWAPPING) revert AtomicityViolation();
        (ZkSwapLeg memory leg, uint256 amountIn) = abi.decode(data, (ZkSwapLeg, uint256));
        Currency input = leg.zeroForOne ? leg.key.currency0 : leg.key.currency1;
        Currency output = leg.zeroForOne ? leg.key.currency1 : leg.key.currency0;

        BalanceDelta delta = poolManager.swap(
            leg.key,
            SwapParams({
                zeroForOne: leg.zeroForOne,
                amountSpecified: -int256(amountIn),
                sqrtPriceLimitX96: leg.sqrtPriceLimitX96
            }),
            leg.hookData
        );

        int128 outDelta = leg.zeroForOne ? delta.amount1() : delta.amount0();
        require(outDelta > 0, "no swap output");
        uint256 amountOut = uint256(uint128(outDelta));

        // Settle input to PoolManager
        _settleCurrency(input, amountIn);

        // Take output to this router
        poolManager.take(output, address(this), amountOut);

        return abi.encode(amountOut);
    }

    function _settleCurrency(Currency currency, uint256 amount) internal {
        poolManager.sync(currency);
        address assetAddr = Currency.unwrap(currency);
        if (assetAddr == address(0)) {
            // Root cause (R1): PoolManager has no receive()/fallback()
            // (v4-core PoolManager.sol), so a bare value call to it always
            // reverts. Native settlement MUST go through the payable
            // settle() entrypoint (IPoolManager.sol:183), where
            // paid = msg.value (PoolManager.sol `_settle`).
            uint256 paid = poolManager.settle{value: amount}();
            require(paid == amount, "eth settle failed");
        } else {
            IERC20(assetAddr).safeTransfer(address(poolManager), amount);
            poolManager.settle();
        }
    }

    /// @notice Accepts native asset only mid-flow from the Entrypoint during relay
    /// and from the PoolManager when taking native swap output.
    receive() external payable {
        if (!_inZkFlow) revert EthReceiveNotInFlow();
    }
}

// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IShieldedPool {
    function asset() external view returns (address);
    function denomination() external view returns (uint256);
    function deposit(bytes32 commitment) external payable returns (uint32);
    function withdraw(
        bytes calldata proof,
        bytes32 root,
        bytes32 nullifierHash,
        address recipient,
        uint256 fee
    ) external;
}

/// @title VeilShieldRouter
/// @notice Peripheral router orchestrating 1-tx Swap-to-Shield and Shielded Swaps.
/// @dev Invariant: Router NEVER retains user custody or dust; all balances must settle to 0.
contract VeilShieldRouter is ReentrancyGuard {
    using SafeERC20 for IERC20;
    using CurrencyLibrary for Currency;

    IPoolManager public immutable poolManager;

    enum ActionType {
        SWAP_TO_SHIELD,
        SHIELDED_SWAP
    }

    struct SwapToShieldParams {
        PoolKey key;
        bool zeroForOne;
        uint128 amountIn;
        uint128 minAmountOut;
        uint160 sqrtPriceLimitX96;
        bytes32 commitment;
        address shieldedPool;
        bytes hookData;
    }

    struct ShieldedSwapParams {
        address poolSource; // PrivacyPool for Asset A
        bytes proof;
        bytes32 root;
        bytes32 nullifierHash;
        uint256 relayerFee;
        PoolKey key;
        bool zeroForOne;
        uint128 minAmountOut;
        uint160 sqrtPriceLimitX96;
        bytes32 newCommitment;
        address poolDestination; // PrivacyPool for Asset B
        bytes hookData;
    }

    event SwapToShieldExecuted(
        address indexed swapper,
        address indexed shieldedPool,
        bytes32 indexed commitment,
        uint256 amountIn,
        uint256 amountOut
    );

    event ShieldedSwapExecuted(
        address indexed relayer,
        address indexed poolSource,
        address indexed poolDestination,
        bytes32 nullifierHash,
        bytes32 newCommitment,
        uint256 amountOut
    );

    error OnlyPoolManager();
    error SlippageExceeded();
    error NonZeroBalanceInvariantFailed();
    error InvalidShieldedPool();
    error InsufficientOutputForDenomination();

    modifier onlyPoolManager() {
        if (msg.sender != address(poolManager)) revert OnlyPoolManager();
        _;
    }

    constructor(IPoolManager _poolManager) {
        require(address(_poolManager) != address(0), "zero pool manager");
        poolManager = _poolManager;
    }

    /// @notice 1-Transaction Swap-to-Shield: Swaps input token/ETH and deposits directly into ShieldedPool
    function swapToShield(SwapToShieldParams calldata params) external payable nonReentrant returns (uint256 amountOut) {
        Currency input = params.zeroForOne ? params.key.currency0 : params.key.currency1;
        address inputAsset = Currency.unwrap(input);

        if (inputAsset == address(0)) {
            require(msg.value == params.amountIn, "msg.value mismatch");
        } else {
            require(msg.value == 0, "no eth expected");
            IERC20(inputAsset).safeTransferFrom(msg.sender, address(this), params.amountIn);
        }

        bytes memory unlockData = abi.encode(ActionType.SWAP_TO_SHIELD, msg.sender, params);
        bytes memory result = poolManager.unlock(unlockData);
        amountOut = abi.decode(result, (uint256));

        // Invariant check: router holds zero balance of input and output tokens, and zero native ETH
        if (address(this).balance != 0) revert NonZeroBalanceInvariantFailed();
        if (inputAsset != address(0)) {
            if (IERC20(inputAsset).balanceOf(address(this)) != 0) revert NonZeroBalanceInvariantFailed();
        }
        Currency output = params.zeroForOne ? params.key.currency1 : params.key.currency0;
        address outputAsset = Currency.unwrap(output);
        if (outputAsset != address(0)) {
            if (IERC20(outputAsset).balanceOf(address(this)) != 0) revert NonZeroBalanceInvariantFailed();
        }

        emit SwapToShieldExecuted(msg.sender, params.shieldedPool, params.commitment, params.amountIn, amountOut);
    }

    /// @notice Shielded Swap: Withdraws from ShieldedPool A -> Swaps A to B -> Deposits to ShieldedPool B
    function shieldedSwap(ShieldedSwapParams calldata params) external nonReentrant returns (uint256 amountOut) {
        // 1. Withdraw from source pool directly to router
        IShieldedPool source = IShieldedPool(params.poolSource);
        uint256 denominationA = source.denomination();

        // Withdraw from source pool. Recipient is this router.
        source.withdraw(params.proof, params.root, params.nullifierHash, address(this), params.relayerFee);

        uint256 swapAmount = denominationA - params.relayerFee;
        require(swapAmount > 0, "empty swap amount");

        // 2. Execute swap on Uniswap v4
        bytes memory unlockData = abi.encode(ActionType.SHIELDED_SWAP, msg.sender, params, swapAmount);
        bytes memory result = poolManager.unlock(unlockData);
        amountOut = abi.decode(result, (uint256));

        // Invariant verification: zero leftover balance (ETH and ERC20 tokens)
        if (address(this).balance != 0) revert NonZeroBalanceInvariantFailed();
        address assetA = source.asset();
        if (assetA != address(0) && IERC20(assetA).balanceOf(address(this)) != 0) {
            revert NonZeroBalanceInvariantFailed();
        }
        address assetB = IShieldedPool(params.poolDestination).asset();
        if (assetB != address(0) && IERC20(assetB).balanceOf(address(this)) != 0) {
            revert NonZeroBalanceInvariantFailed();
        }

        emit ShieldedSwapExecuted(
            msg.sender,
            params.poolSource,
            params.poolDestination,
            params.nullifierHash,
            params.newCommitment,
            amountOut
        );
    }

    /// @notice Callback invoked by PoolManager.unlock
    function unlockCallback(bytes calldata data) external onlyPoolManager returns (bytes memory) {
        (ActionType action, address origin) = abi.decode(data, (ActionType, address));

        if (action == ActionType.SWAP_TO_SHIELD) {
            (, , SwapToShieldParams memory params) = abi.decode(data, (ActionType, address, SwapToShieldParams));
            return _handleSwapToShield(origin, params);
        } else {
            (, , ShieldedSwapParams memory params, uint256 swapAmount) = abi.decode(
                data,
                (ActionType, address, ShieldedSwapParams, uint256)
            );
            return _handleShieldedSwap(origin, params, swapAmount);
        }
    }

    function _handleSwapToShield(
        address origin,
        SwapToShieldParams memory params
    ) internal returns (bytes memory) {
        Currency input = params.zeroForOne ? params.key.currency0 : params.key.currency1;
        Currency output = params.zeroForOne ? params.key.currency1 : params.key.currency0;

        BalanceDelta delta = poolManager.swap(
            params.key,
            SwapParams({
                zeroForOne: params.zeroForOne,
                amountSpecified: -int256(uint256(params.amountIn)),
                sqrtPriceLimitX96: params.sqrtPriceLimitX96
            }),
            params.hookData
        );

        int128 outDelta = params.zeroForOne ? delta.amount1() : delta.amount0();
        require(outDelta > 0, "no swap output");
        uint256 amountOut = uint256(uint128(outDelta));
        if (amountOut < params.minAmountOut) revert SlippageExceeded();

        // Settle input to PoolManager
        _settleCurrency(input, params.amountIn);

        // Take output to this router
        poolManager.take(output, address(this), amountOut);

        // Deposit into ShieldedPool
        IShieldedPool pool = IShieldedPool(params.shieldedPool);
        uint256 denomination = pool.denomination();
        if (amountOut < denomination) revert InsufficientOutputForDenomination();

        address outputAsset = Currency.unwrap(output);
        if (outputAsset == address(0)) {
            pool.deposit{value: denomination}(params.commitment);
            // Refund any excess dust back to user immediately
            if (amountOut > denomination) {
                (bool refundOk, ) = origin.call{value: amountOut - denomination}("");
                require(refundOk, "dust refund failed");
            }
        } else {
            IERC20(outputAsset).forceApprove(params.shieldedPool, denomination);
            pool.deposit(params.commitment);
            if (amountOut > denomination) {
                IERC20(outputAsset).safeTransfer(origin, amountOut - denomination);
            }
        }

        return abi.encode(amountOut);
    }

    function _handleShieldedSwap(
        address origin,
        ShieldedSwapParams memory params,
        uint256 swapAmount
    ) internal returns (bytes memory) {
        Currency input = params.zeroForOne ? params.key.currency0 : params.key.currency1;
        Currency output = params.zeroForOne ? params.key.currency1 : params.key.currency0;

        BalanceDelta delta = poolManager.swap(
            params.key,
            SwapParams({
                zeroForOne: params.zeroForOne,
                amountSpecified: -int256(swapAmount),
                sqrtPriceLimitX96: params.sqrtPriceLimitX96
            }),
            params.hookData
        );

        int128 outDelta = params.zeroForOne ? delta.amount1() : delta.amount0();
        require(outDelta > 0, "no swap output");
        uint256 amountOut = uint256(uint128(outDelta));
        if (amountOut < params.minAmountOut) revert SlippageExceeded();

        // Settle input
        _settleCurrency(input, swapAmount);

        // Take output to router
        poolManager.take(output, address(this), amountOut);

        // Deposit into destination shielded pool
        IShieldedPool destPool = IShieldedPool(params.poolDestination);
        uint256 denominationB = destPool.denomination();
        if (amountOut < denominationB) revert InsufficientOutputForDenomination();

        address outputAsset = Currency.unwrap(output);
        if (outputAsset == address(0)) {
            destPool.deposit{value: denominationB}(params.newCommitment);
            if (amountOut > denominationB) {
                (bool refundOk, ) = origin.call{value: amountOut - denominationB}("");
                require(refundOk, "dust refund failed");
            }
        } else {
            IERC20(outputAsset).forceApprove(params.poolDestination, denominationB);
            destPool.deposit(params.newCommitment);
            if (amountOut > denominationB) {
                IERC20(outputAsset).safeTransfer(origin, amountOut - denominationB);
            }
        }

        return abi.encode(amountOut);
    }

    function _settleCurrency(Currency currency, uint256 amount) internal {
        poolManager.sync(currency);
        address assetAddr = Currency.unwrap(currency);
        if (assetAddr == address(0)) {
            (bool ok, ) = address(poolManager).call{value: amount}("");
            require(ok, "eth settle failed");
        } else {
            IERC20(assetAddr).safeTransfer(address(poolManager), amount);
        }
        poolManager.settle();
    }

    receive() external payable {}
}

// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {BaseHook} from "@uniswap/v4-periphery/src/utils/BaseHook.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

interface IVeilAttestationRegistry {
    function verifyAttestation(address user) external view returns (bool);
}

/// @title VeilHook
/// @notice Uniswap v4 hook combining ZK-gated pool authorization (beforeSwap)
/// and protocol fee collection for Veil buyback and burn treasury (afterSwap).
contract VeilHook is BaseHook {
    using PoolIdLibrary for PoolKey;
    using CurrencyLibrary for Currency;

    uint256 public constant BPS = 10_000;
    uint256 public feeBps = 30; // 0.30% default protocol fee

    address public immutable treasury;
    address public immutable registry;
    address public owner;

    // Gated pool tracking
    mapping(bytes32 => bool) public isPoolGated;
    mapping(bytes32 => uint256) public poolLaunchTime;
    mapping(bytes32 => uint256) public poolGatingDuration; // 0 = permanent, > 0 = temporary launch window (anti-sniper)

    error OnlyOwner();
    error UnauthorizedSwapper();
    error GatingActiveUserNotAttested();
    error FeeOverflow();
    error ZeroAddress();
    error Expired();
    error InvalidSignature();

    event ProtocolFeeCollected(bytes32 indexed poolId, address indexed currency, uint256 feeAmount);
    event PoolGatingConfigured(bytes32 indexed poolId, bool gated, uint256 gatingDuration);
    event ProtocolFeeUpdated(uint256 newFeeBps);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    constructor(
        IPoolManager _manager,
        address _treasury,
        address _registry,
        address _owner
    ) BaseHook(_manager) {
        if (_treasury == address(0) || _registry == address(0) || _owner == address(0)) revert ZeroAddress();
        treasury = _treasury;
        registry = _registry;
        owner = _owner;
    }

    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: true,
            afterInitialize: false,
            beforeAddLiquidity: false,
            afterAddLiquidity: false,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: false,
            beforeSwap: true,
            afterSwap: true,
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: true,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    function setFeeBps(uint256 _feeBps) external onlyOwner {
        require(_feeBps <= 500, "fee too high"); // max 5%
        feeBps = _feeBps;
        emit ProtocolFeeUpdated(_feeBps);
    }

    function setPoolGating(PoolKey calldata key, bool gated, uint256 duration) external onlyOwner {
        bytes32 poolId = PoolId.unwrap(key.toId());
        isPoolGated[poolId] = gated;
        poolLaunchTime[poolId] = block.timestamp;
        poolGatingDuration[poolId] = duration;
        emit PoolGatingConfigured(poolId, gated, duration);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function _beforeInitialize(address, PoolKey calldata key, uint160) internal override returns (bytes4) {
        bytes32 poolId = PoolId.unwrap(key.toId());
        poolLaunchTime[poolId] = block.timestamp;
        return BaseHook.beforeInitialize.selector;
    }

    function _beforeSwap(
        address,
        PoolKey calldata key,
        SwapParams calldata,
        bytes calldata hookData
    ) internal view override returns (bytes4, BeforeSwapDelta, uint24) {
        bytes32 poolId = PoolId.unwrap(key.toId());

        if (isPoolGated[poolId]) {
            uint256 launch = poolLaunchTime[poolId];
            uint256 duration = poolGatingDuration[poolId];

            // If gating duration is active
            if (duration == 0 || block.timestamp < launch + duration) {
                // hookData binds the swapper: (user, deadline, signature).
                // The signature must be the user's EIP-191 signature over
                // (hook, chain, user, poolId, deadline), so hookData cannot
                // be spoofed or moved across pools.
                (address user, uint256 deadline, bytes memory signature) = abi.decode(
                    hookData,
                    (address, uint256, bytes)
                );
                if (user == address(0)) revert GatingActiveUserNotAttested();
                if (block.timestamp > deadline) revert Expired();
                bytes32 inner = keccak256(
                    abi.encode(address(this), block.chainid, user, poolId, deadline)
                );
                address signer = ECDSA.recover(MessageHashUtils.toEthSignedMessageHash(inner), signature);
                if (signer != user) revert InvalidSignature();
                if (!IVeilAttestationRegistry(registry).verifyAttestation(user)) {
                    revert GatingActiveUserNotAttested();
                }
            }
        }

        return (BaseHook.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);
    }

    function _afterSwap(
        address,
        PoolKey calldata key,
        SwapParams calldata params,
        BalanceDelta delta,
        bytes calldata
    ) internal override returns (bytes4, int128) {
        if (feeBps == 0) return (BaseHook.afterSwap.selector, 0);

        bool exactInput = params.amountSpecified < 0;
        bool currency0IsFee = exactInput ? !params.zeroForOne : params.zeroForOne;
        int128 signedAmount = currency0IsFee ? delta.amount0() : delta.amount1();
        if (signedAmount == 0) return (BaseHook.afterSwap.selector, 0);

        uint256 feeBase = uint256(signedAmount > 0 ? int256(signedAmount) : -int256(signedAmount));
        uint256 feeAmount = (feeBase * feeBps) / BPS;
        if (feeAmount == 0) return (BaseHook.afterSwap.selector, 0);
        if (feeAmount > uint256(uint128(type(int128).max))) revert FeeOverflow();

        Currency feeCurrency = currency0IsFee ? key.currency0 : key.currency1;
        poolManager.take(feeCurrency, treasury, feeAmount);

        emit ProtocolFeeCollected(PoolId.unwrap(key.toId()), Currency.unwrap(feeCurrency), feeAmount);

        return (BaseHook.afterSwap.selector, int128(uint128(feeAmount)));
    }
}

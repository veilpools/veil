// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {BalanceDelta, BalanceDeltaLibrary} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {CurrencySettler} from "@uniswap/v4-core/test/utils/CurrencySettler.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";

/// @notice Minimal testnet exact-input swapper (no PositionManager needed).
contract TestnetSwapHelper {
    using CurrencySettler for Currency;
    using BalanceDeltaLibrary for BalanceDelta;

    IPoolManager public immutable manager;

    constructor(IPoolManager _manager) {
        manager = _manager;
    }

    struct SwapArgs {
        PoolKey key;
        bool zeroForOne;
        uint128 amountIn;
        uint128 minOut;
        bytes hookData;
        address inputToken;
    }

    function swapExactIn(SwapArgs calldata s) external payable returns (uint128 amountOut) {
        if (s.inputToken != address(0)) {
            IERC20(s.inputToken).transferFrom(msg.sender, address(this), s.amountIn);
            IERC20(s.inputToken).approve(address(manager), s.amountIn);
        }
        bytes memory ret = manager.unlock(abi.encode(msg.sender, s));
        amountOut = abi.decode(ret, (uint128));
        require(amountOut >= s.minOut, "slippage");
        uint256 leftover = address(this).balance;
        if (leftover > 0) {
            (bool ok,) = msg.sender.call{value: leftover}("");
            require(ok, "refund failed");
        }
    }

    function unlockCallback(bytes calldata rawData) external returns (bytes memory) {
        require(msg.sender == address(manager), "only manager");
        (address sender, SwapArgs memory s) = abi.decode(rawData, (address, SwapArgs));
        uint160 limit = s.zeroForOne ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1;
        BalanceDelta delta = manager.swap(
            s.key,
            SwapParams({zeroForOne: s.zeroForOne, amountSpecified: -int256(uint256(s.amountIn)), sqrtPriceLimitX96: limit}),
            s.hookData
        );
        int256 d0 = delta.amount0();
        int256 d1 = delta.amount1();
        if (d0 < 0) s.key.currency0.settle(manager, address(this), uint256(-d0), false);
        if (d1 < 0) s.key.currency1.settle(manager, address(this), uint256(-d1), false);
        uint256 out;
        if (d0 > 0) { s.key.currency0.take(manager, sender, uint256(d0), false); out = uint256(d0); }
        if (d1 > 0) { s.key.currency1.take(manager, sender, uint256(d1), false); out = uint256(d1); }
        return abi.encode(uint128(out));
    }

    receive() external payable {}
}

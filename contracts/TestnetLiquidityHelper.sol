// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {ModifyLiquidityParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {BalanceDelta, BalanceDeltaLibrary} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {CurrencySettler} from "@uniswap/v4-core/test/utils/CurrencySettler.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice Minimal testnet helper adding v4 liquidity without PositionManager.
/// Follows PoolModifyLiquidityTest: unlock -> modifyLiquidity -> settle/take.
contract TestnetLiquidityHelper {
    using CurrencySettler for Currency;
    using BalanceDeltaLibrary for BalanceDelta;

    IPoolManager public immutable manager;

    constructor(IPoolManager _manager) {
        manager = _manager;
    }

    struct AddParams {
        PoolKey key;
        int24 tickLower;
        int24 tickUpper;
        uint256 liquidity;
        uint128 amount0Max;
        uint128 amount1Max;
        address veil;
    }

    function addLiquidity(AddParams calldata p) external payable returns (BalanceDelta delta) {
        IERC20(p.veil).transferFrom(msg.sender, address(this), p.amount1Max);
        IERC20(p.veil).approve(address(manager), p.amount1Max);
        delta = abi.decode(
            manager.unlock(abi.encode(msg.sender, p)),
            (BalanceDelta)
        );
        uint256 leftoverVeil = IERC20(p.veil).balanceOf(address(this));
        if (leftoverVeil > 0) {
            IERC20(p.veil).transfer(msg.sender, leftoverVeil);
        }
        uint256 leftover = address(this).balance;
        if (leftover > 0) {
            (bool ok,) = msg.sender.call{value: leftover}("");
            require(ok, "refund failed");
        }
    }

    function unlockCallback(bytes calldata rawData) external returns (bytes memory) {
        require(msg.sender == address(manager), "only manager");
        (address sender, AddParams memory p) = abi.decode(rawData, (address, AddParams));
        (BalanceDelta delta,) = manager.modifyLiquidity(
            p.key,
            ModifyLiquidityParams({
                tickLower: p.tickLower,
                tickUpper: p.tickUpper,
                liquidityDelta: int256(p.liquidity),
                salt: bytes32(0)
            }),
            ""
        );
        int256 d0 = delta.amount0();
        int256 d1 = delta.amount1();
        require(d0 <= 0 && d1 <= 0, "unexpected positive delta");
        require(uint256(-d0) <= p.amount0Max && uint256(-d1) <= p.amount1Max, "exceeds max");
        if (d0 < 0) p.key.currency0.settle(manager, address(this), uint256(-d0), false);
        if (d1 < 0) p.key.currency1.settle(manager, address(this), uint256(-d1), false);
        return abi.encode(delta);
    }

    receive() external payable {}
}

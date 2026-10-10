// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IBurnableToken {
    function burn(uint256 amount) external;
}

/// @title VeilTreasury
/// @notice Dedicated protocol treasury collecting fees from VeilHook and Pons creator fees.
/// Holds protocol fee reserves and executes burns of Veil tokens to reduce circulating supply.
contract VeilTreasury {
    using SafeERC20 for IERC20;

    address public owner;
    address public veilToken;
    uint256 public buybackShareBps = 7000; // 70% for buyback & burn, 30% for operations
    uint256 public constant BPS = 10_000;

    uint256 public totalBurned;
    uint256 public totalFeeReceived;

    event FeeReceived(address indexed token, uint256 amount);
    event BuybackConfigUpdated(uint256 newBuybackBps);
    event VeilTokenConfigured(address indexed veilToken);
    event TokensBurned(uint256 amount, uint256 totalBurnedCumulative);
    event EmergencyFundsRescued(address indexed token, address indexed recipient, uint256 amount);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error OnlyOwner();
    error ZeroAddress();
    error InvalidBps();

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    constructor(address _owner, address _veilToken) {
        if (_owner == address(0)) revert ZeroAddress();
        owner = _owner;
        veilToken = _veilToken;
    }

    function setVeilToken(address _veilToken) external onlyOwner {
        if (_veilToken == address(0)) revert ZeroAddress();
        veilToken = _veilToken;
        emit VeilTokenConfigured(_veilToken);
    }

    function setBuybackShareBps(uint256 _bps) external onlyOwner {
        if (_bps > BPS) revert InvalidBps();
        buybackShareBps = _bps;
        emit BuybackConfigUpdated(_bps);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    /// @notice Burns Veil tokens held by the treasury to permanently reduce total supply.
    function executeBurn(uint256 amount) external {
        if (veilToken == address(0)) revert ZeroAddress();
        uint256 balance = IERC20(veilToken).balanceOf(address(this));
        uint256 burnAmount = amount > balance ? balance : amount;
        require(burnAmount > 0, "no tokens to burn");

        IBurnableToken(veilToken).burn(burnAmount);
        totalBurned += burnAmount;
        emit TokensBurned(burnAmount, totalBurned);
    }

    /// @notice Rescue operations or non-Veil tokens
    function rescue(address token, address recipient, uint256 amount) external onlyOwner {
        if (recipient == address(0)) revert ZeroAddress();
        if (token == address(0)) {
            (bool success, ) = recipient.call{value: amount}("");
            require(success, "eth transfer failed");
        } else {
            IERC20(token).safeTransfer(recipient, amount);
        }
        emit EmergencyFundsRescued(token, recipient, amount);
    }

    receive() external payable {
        totalFeeReceived += msg.value;
        emit FeeReceived(address(0), msg.value);
    }
}

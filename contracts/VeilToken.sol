// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

/// @title VeilToken (temporary protocol token)
/// @notice Fixed-supply ERC20 with self-burn, matching the VeilTreasury
/// IBurnableToken interface (burn from holder balance, reducing totalSupply).
/// Temporary deployment for end-to-end testing; the canonical token
/// launches on Pons per the brief.
contract VeilToken is ERC20, ERC20Burnable {
    constructor(string memory tokenName, string memory tokenSymbol, uint256 supply)
        ERC20(tokenName, tokenSymbol)
    {
        _mint(msg.sender, supply);
    }
}
